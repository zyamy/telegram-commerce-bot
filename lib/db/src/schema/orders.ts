import { pgTable, text, serial, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  telegramUserId: text("telegram_user_id").notNull(),
  telegramUsername: text("telegram_username"),
  telegramFirstName: text("telegram_first_name"),
  productId: integer("product_id").notNull(),
  productName: text("product_name").notNull(),
  productPrice: real("product_price").notNull(),
  quantity: integer("quantity").notNull().default(1),
  status: text("status").notNull().default("pending_payment"),
  paymentMethod: text("payment_method").notNull().default("toyyibpay"),
  paymentProofUrl: text("payment_proof_url"),
  deliveryMessage: text("delivery_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;
