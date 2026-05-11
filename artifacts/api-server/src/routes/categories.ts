import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, categoriesTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/categories", async (_req, res): Promise<void> => {
  const categories = await db
    .select()
    .from(categoriesTable)
    .orderBy(categoriesTable.sortOrder, categoriesTable.createdAt);
  res.json(categories);
});

router.post("/categories", async (req, res): Promise<void> => {
  const { name, emoji, logoUrl, isActive, sortOrder } = req.body;
  if (!name || typeof name !== "string") {
    res.status(400).json({ error: "name is required" });
    return;
  }
  const [cat] = await db
    .insert(categoriesTable)
    .values({ name, emoji: emoji || "📦", logoUrl: logoUrl || null, isActive: isActive ?? true, sortOrder: sortOrder ?? 0 })
    .returning();
  res.status(201).json(cat);
});

router.patch("/categories/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { name, emoji, logoUrl, isActive, sortOrder } = req.body;
  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (emoji !== undefined) updateData.emoji = emoji;
  if (logoUrl !== undefined) updateData.logoUrl = logoUrl;
  if (isActive !== undefined) updateData.isActive = isActive;
  if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
  const [cat] = await db
    .update(categoriesTable)
    .set(updateData)
    .where(eq(categoriesTable.id, id))
    .returning();
  if (!cat) { res.status(404).json({ error: "Kategori tidak dijumpai" }); return; }
  res.json(cat);
});

router.delete("/categories/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(categoriesTable).where(eq(categoriesTable.id, id));
  res.sendStatus(204);
});

export default router;
