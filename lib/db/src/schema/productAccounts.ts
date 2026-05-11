import { pgTable, text, serial, boolean, integer, timestamp } from "drizzle-orm/pg-core";

export const productAccountsTable = pgTable("product_accounts", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  content: text("content").notNull(),
  isDelivered: boolean("is_delivered").notNull().default(false),
  orderId: integer("order_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
