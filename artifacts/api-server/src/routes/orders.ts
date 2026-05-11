import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, ordersTable, settingsTable, productsTable, productAccountsTable } from "@workspace/db";
import {
  GetOrderParams,
  ConfirmOrderParams,
  ConfirmOrderBody,
  RejectOrderParams,
  ListOrdersQueryParams,
} from "@workspace/api-zod";
import { sendTelegramMessage } from "../lib/telegram.js";

const router: IRouter = Router();

router.get("/orders", async (req, res): Promise<void> => {
  const query = ListOrdersQueryParams.safeParse(req.query);
  let orders = await db.select().from(ordersTable).orderBy(ordersTable.createdAt);
  if (query.success && query.data.status) {
    orders = orders.filter((o) => o.status === query.data.status);
  }
  res.json(orders);
});

router.get("/orders/:id", async (req, res): Promise<void> => {
  const params = GetOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, params.data.id));
  if (!order) {
    res.status(404).json({ error: "Pesanan tidak dijumpai" });
    return;
  }
  res.json(order);
});

router.patch("/orders/:id/confirm", async (req, res): Promise<void> => {
  const params = ConfirmOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = ConfirmOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existingOrder] = await db.select().from(ordersTable).where(eq(ordersTable.id, params.data.id));
  if (!existingOrder) {
    res.status(404).json({ error: "Pesanan tidak dijumpai" });
    return;
  }

  // Try pool account first, fallback to admin's delivery message
  let finalDeliveryMessage = parsed.data.deliveryMessage;
  const [poolAccount] = await db
    .select()
    .from(productAccountsTable)
    .where(and(
      eq(productAccountsTable.productId, existingOrder.productId),
      eq(productAccountsTable.isDelivered, false)
    ))
    .limit(1);

  if (poolAccount) {
    finalDeliveryMessage = poolAccount.content;
    await db
      .update(productAccountsTable)
      .set({ isDelivered: true, orderId: params.data.id })
      .where(eq(productAccountsTable.id, poolAccount.id));
  }

  const [order] = await db
    .update(ordersTable)
    .set({ status: "confirmed", deliveryMessage: finalDeliveryMessage, updatedAt: new Date() })
    .where(eq(ordersTable.id, params.data.id))
    .returning();

  // Decrement stock
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, existingOrder.productId));
  if (product && product.stock > 0) {
    await db.update(productsTable).set({ stock: product.stock - 1 }).where(eq(productsTable.id, product.id));
  }

  // Fetch install guide from product
  const installGuide = product?.installGuide || null;

  let confirmMsg =
    `✅ *Bayaran Disahkan!*\n\n` +
    `Terima kasih kerana membeli *${order.productName}*!\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `📦 *AKAUN / PRODUK ANDA:*\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `\`\`\`\n${finalDeliveryMessage}\n\`\`\``;

  if (installGuide && installGuide.trim()) {
    confirmMsg +=
      `\n\n━━━━━━━━━━━━━━━━━━━━━\n` +
      `📋 *CARA PENGGUNAAN / PANDUAN INSTALL:*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n\n` +
      installGuide.trim();
  }

  confirmMsg += `\n\n━━━━━━━━━━━━━━━━━━━━━\n⚠️ _Jangan kongsikan maklumat ini kepada sesiapa._\n\nSelamat menggunakan! Hubungi admin jika ada masalah. 😊`;

  await sendTelegramMessage(order.telegramUserId, confirmMsg);

  res.json(order);
});

router.patch("/orders/:id/reject", async (req, res): Promise<void> => {
  const params = RejectOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [order] = await db
    .update(ordersTable)
    .set({ status: "rejected", updatedAt: new Date() })
    .where(eq(ordersTable.id, params.data.id))
    .returning();
  if (!order) {
    res.status(404).json({ error: "Pesanan tidak dijumpai" });
    return;
  }

  await sendTelegramMessage(
    order.telegramUserId,
    `❌ *Bayaran Ditolak*\n\nMaaf, bayaran anda untuk *${order.productName}* telah ditolak. Sila hubungi admin untuk maklumat lanjut.`
  );

  res.json(order);
});

export default router;
