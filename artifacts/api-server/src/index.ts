import app from "./app.js";
import { startBot, startAutoCancel } from "./lib/telegram.js";
import { pool } from "@workspace/db";

// Tangkap ralat yang tidak dijangka supaya server tidak crash
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function runMigrations() {
  try {
    await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1`);
    console.log("[migrate] orders.quantity OK");
    await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes TEXT`);
    console.log("[migrate] orders.notes OK");
    await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price REAL NOT NULL DEFAULT 0`);
    console.log("[migrate] products.cost_price OK");
  } catch (err) {
    console.error("[migrate] Warning:", err);
  }
}

runMigrations().then(() => {
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
    if (process.env["ENABLE_BOT"] === "true") {
      startBot();
      startAutoCancel();
    } else {
      console.log("Bot polling disabled (set ENABLE_BOT=true to enable)");
    }
  });
});
