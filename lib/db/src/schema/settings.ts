import { pgTable, text, serial, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const settingsTable = pgTable("settings", {
  id: serial("id").primaryKey(),
  qrImageUrl: text("qr_image_url"),
  paymentInstructions: text("payment_instructions").notNull().default("Sila buat bayaran melalui Touch & Go QR di atas."),
  welcomeMessage: text("welcome_message").notNull().default("Selamat datang! Kami menjual akaun premium. Gunakan /products untuk lihat senarai produk."),
  isOpen: boolean("is_open").notNull().default(true),
  closedMessage: text("closed_message").notNull().default("Maaf, kedai kami sedang tutup buat masa ini. Sila cuba lagi kemudian."),
  requiredChannel: text("required_channel"),
  channelInviteLink: text("channel_invite_link"),
});

export const insertSettingsSchema = createInsertSchema(settingsTable).omit({ id: true });
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settingsTable.$inferSelect;
