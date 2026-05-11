import { Router, type IRouter } from "express";
import { db, ordersTable } from "@workspace/db";
import { bot, notifyAdmin } from "../lib/telegram.js";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

router.post("/broadcast", async (req, res): Promise<void> => {
  const { message } = req.body;

  if (!message || typeof message !== "string" || message.trim().length < 1) {
    res.status(400).json({ error: "Mesej tidak boleh kosong" });
    return;
  }

  const recipients = await db
    .selectDistinct({ telegramUserId: ordersTable.telegramUserId })
    .from(ordersTable);

  let sent = 0;
  let failed = 0;

  for (const r of recipients) {
    try {
      await bot.telegram.sendMessage(r.telegramUserId, `📢 *Pengumuman*\n\n${message}`, { parse_mode: "Markdown" });
      sent++;
    } catch {
      failed++;
    }
  }

  await notifyAdmin(`📢 Broadcast dihantar: ${sent} berjaya, ${failed} gagal`);

  res.json({ sent, failed, total: recipients.length });
});

export default router;
