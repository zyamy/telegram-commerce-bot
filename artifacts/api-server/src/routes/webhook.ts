import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, ordersTable, productsTable } from "@workspace/db";
import { bot, notifyAdmin } from "../lib/telegram.js";

const router: IRouter = Router();

router.post("/webhook/toyyibpay", async (req, res): Promise<void> => {
  console.log("Toyyibpay callback received:", req.body);

  const {
    refno,
    status,
    billcode,
    order_id,
    msg,
    transaction_id,
    amount,
  } = req.body;

  // status: 1 = success, 2 = pending, 3 = fail
  if (status !== "1") {
    console.log("Payment not successful, status:", status);
    res.send("OK");
    return;
  }

  const orderId = parseInt(order_id || refno);
  if (isNaN(orderId)) {
    console.error("Invalid order_id:", order_id);
    res.send("OK");
    return;
  }

  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, orderId));

  if (!order) {
    console.error("Order not found:", orderId);
    res.send("OK");
    return;
  }

  if (order.status === "confirmed") {
    console.log("Order already confirmed:", orderId);
    res.send("OK");
    return;
  }

  const [product] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, order.productId));

  const deliveryContent = product?.deliveryContent || "Sila hubungi admin untuk mendapatkan produk anda.";

  await db
    .update(ordersTable)
    .set({
      status: "confirmed",
      deliveryMessage: deliveryContent,
      updatedAt: new Date(),
    })
    .where(eq(ordersTable.id, orderId));

  if (product && product.stock > 0) {
    await db
      .update(productsTable)
      .set({ stock: product.stock - 1 })
      .where(eq(productsTable.id, product.id));
  }

  try {
    await bot.telegram.sendMessage(
      order.telegramUserId,
      `✅ *Bayaran Berjaya!*\n\nTerima kasih kerana membeli *${order.productName}*!\n\n📦 *Produk anda:*\n\n${deliveryContent}`,
      { parse_mode: "Markdown" }
    );
  } catch (err) {
    console.error("Failed to send delivery message:", err);
  }

  await notifyAdmin(
    `💰 *Bayaran Berjaya (Toyyibpay)!*\n\nPesanan #${order.id}\nPelanggan: ${order.telegramFirstName || "Tanpa nama"}${order.telegramUsername ? ` (@${order.telegramUsername})` : ""}\nProduk: ${order.productName}\nJumlah: RM${order.productPrice.toFixed(2)}\nRef: ${refno || transaction_id}\n\nProduk telah dihantar automatik ✅`
  );

  res.send("OK");
});

export default router;
