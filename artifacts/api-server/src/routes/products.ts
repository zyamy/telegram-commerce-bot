import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, productsTable, productAccountsTable } from "@workspace/db";
import {
  CreateProductBody,
  UpdateProductBody,
  GetProductParams,
  UpdateProductParams,
  DeleteProductParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/products", async (_req, res): Promise<void> => {
  const products = await db.select().from(productsTable).orderBy(productsTable.createdAt);
  // Attach account counts
  const allAccounts = await db.select().from(productAccountsTable);
  const result = products.map((p) => {
    const accounts = allAccounts.filter((a) => a.productId === p.id);
    return {
      ...p,
      totalAccounts: accounts.length,
      availableAccounts: accounts.filter((a) => !a.isDelivered).length,
    };
  });
  res.json(result);
});

router.post("/products", async (req, res): Promise<void> => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [product] = await db.insert(productsTable).values(parsed.data).returning();
  res.status(201).json(product);
});

router.get("/products/:id", async (req, res): Promise<void> => {
  const params = GetProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, params.data.id));
  if (!product) {
    res.status(404).json({ error: "Produk tidak dijumpai" });
    return;
  }
  res.json(product);
});

router.patch("/products/:id", async (req, res): Promise<void> => {
  const params = UpdateProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [product] = await db
    .update(productsTable)
    .set(parsed.data)
    .where(eq(productsTable.id, params.data.id))
    .returning();
  if (!product) {
    res.status(404).json({ error: "Produk tidak dijumpai" });
    return;
  }
  res.json(product);
});

router.delete("/products/:id", async (req, res): Promise<void> => {
  const params = DeleteProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [product] = await db
    .delete(productsTable)
    .where(eq(productsTable.id, params.data.id))
    .returning();
  if (!product) {
    res.status(404).json({ error: "Produk tidak dijumpai" });
    return;
  }
  res.sendStatus(204);
});

// ─── Product Accounts (Pool) ──────────────────────────────────────────────────

router.get("/products/:id/accounts", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const accounts = await db
    .select()
    .from(productAccountsTable)
    .where(eq(productAccountsTable.productId, id))
    .orderBy(productAccountsTable.createdAt);
  res.json(accounts);
});

router.post("/products/:id/accounts", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { entries } = req.body;
  if (!Array.isArray(entries) || entries.length === 0) { res.status(400).json({ error: "entries array required" }); return; }
  const rows = (entries as string[]).filter(Boolean).map((content) => ({ productId: id, content }));
  if (!rows.length) { res.status(400).json({ error: "No valid entries" }); return; }
  const accounts = await db.insert(productAccountsTable).values(rows).returning();
  // Update product stock to count of available accounts
  const allAvailable = await db
    .select()
    .from(productAccountsTable)
    .where(and(eq(productAccountsTable.productId, id), eq(productAccountsTable.isDelivered, false)));
  await db.update(productsTable).set({ stock: allAvailable.length }).where(eq(productsTable.id, id));
  res.status(201).json(accounts);
});

router.delete("/products/:productId/accounts/:accountId", async (req, res): Promise<void> => {
  const productId = parseInt(req.params.productId);
  const accountId = parseInt(req.params.accountId);
  if (isNaN(productId) || isNaN(accountId)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(productAccountsTable).where(
    and(eq(productAccountsTable.id, accountId), eq(productAccountsTable.productId, productId))
  );
  // Update product stock
  const allAvailable = await db
    .select()
    .from(productAccountsTable)
    .where(and(eq(productAccountsTable.productId, productId), eq(productAccountsTable.isDelivered, false)));
  await db.update(productsTable).set({ stock: allAvailable.length }).where(eq(productsTable.id, productId));
  res.sendStatus(204);
});

export default router;
