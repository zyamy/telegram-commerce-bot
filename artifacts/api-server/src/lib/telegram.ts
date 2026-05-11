import { Telegraf, Markup } from "telegraf";
import { db, productsTable, ordersTable, settingsTable, productAccountsTable, categoriesTable } from "@workspace/db";
import { eq, desc, and, isNull, lt, inArray } from "drizzle-orm";
import { createBill, getBillUrl } from "./toyyibpay.js";

const token = process.env.TELEGRAM_BOT_TOKEN;
const adminId = process.env.ADMIN_TELEGRAM_ID;
const publicDomain =
  process.env.PUBLIC_DOMAIN ||
  process.env.RAILWAY_STATIC_URL ||
  process.env.REPLIT_DOMAINS?.split(",")[0] ||
  "";

if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN is required");
}

export const bot = new Telegraf(token);

// ─── In-memory: restock notification waiters ──────────────────────────────────
// Map<productId, Set<chatId>>
const restockWaiters = new Map<number, Set<string>>();

// ─── In-memory: users waiting to type custom quantity ─────────────────────────
// Map<chatId, productId>
const awaitingCustomQty = new Map<string, number>();

const SETTINGS_DEFAULTS = {
  isOpen: true,
  welcomeMessage: "Welcome! We sell premium accounts.",
  closedMessage: "Sorry, our store is currently closed. Please try again later.",
  paymentInstructions: "Please make payment via Touch & Go QR above.",
  qrImageUrl: null as string | null,
};

async function getSettings() {
  const [s] = await db.select().from(settingsTable).limit(1);
  if (s) {
    return {
      ...SETTINGS_DEFAULTS,
      ...Object.fromEntries(Object.entries(s).filter(([, v]) => v !== null && v !== undefined)),
    };
  }
  const [created] = await db.insert(settingsTable).values({}).returning();
  return { ...SETTINGS_DEFAULTS, ...created };
}

export async function sendTelegramMessage(chatId: string, text: string) {
  try {
    await bot.telegram.sendMessage(chatId, text, { parse_mode: "Markdown" });
  } catch (err) {
    console.error("Failed to send Telegram message:", err);
  }
}

// Escape Markdown v1 special chars in user-provided strings
// to prevent Telegram from rejecting messages with underscores/asterisks in names
function esc(str: string): string {
  return str.replace(/[_*`[\]]/g, "\\$&");
}

export async function notifyAdmin(message: string) {
  if (!adminId) {
    console.warn("[notifyAdmin] ADMIN_TELEGRAM_ID not set — skipping notification");
    return;
  }
  try {
    await bot.telegram.sendMessage(adminId, message, { parse_mode: "Markdown" });
  } catch (err) {
    console.error("[notifyAdmin] Failed:", err);
    // Retry without parse_mode in case of Markdown parse error
    try {
      const plain = message.replace(/[*_`[\]]/g, "");
      await bot.telegram.sendMessage(adminId, plain);
    } catch (err2) {
      console.error("[notifyAdmin] Retry (plain) also failed:", err2);
    }
  }
}

// ─── Helper: resolve channel ID for getChatMember ────────────────────────────
// Accepts: @username, plain username, or numeric chat ID (e.g. -1003160687279)
// Use the ID from Telegram Web URL (web.telegram.org) directly — copy the number after #
function resolveChannelId(input: string): string | number {
  const trimmed = input.trim();
  // Numeric chat ID — use as-is (positive or negative)
  if (/^-?\d+$/.test(trimmed)) return parseInt(trimmed);
  // @username or plain username (public channel)
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}

// ─── Helper: check if user has joined required channel ────────────────────────
async function isChannelMember(userId: number, channelId: string): Promise<boolean> {
  try {
    const id = resolveChannelId(channelId);
    const member = await bot.telegram.getChatMember(id, userId);
    return ["member", "administrator", "creator", "restricted"].includes(member.status);
  } catch {
    return false; // if check fails, block user (bot not admin or invalid ID)
  }
}

function channelJoinMessage(inviteLink: string) {
  return {
    text:
      `⚠️ *Join Our Channel First!*\n\n` +
      `You must join our channel before using this bot.\n\n` +
      `1️⃣ Click *Join Channel* below\n` +
      `2️⃣ Then click *✅ I've Joined* to continue`,
    keyboard: Markup.inlineKeyboard([
      [Markup.button.url("📢 Join Channel", inviteLink)],
      [Markup.button.callback("✅ I've Joined", "check_membership")],
    ]),
  };
}

// ─── Channel membership middleware ────────────────────────────────────────────
bot.use(async (ctx, next) => {
  const settings = await getSettings();
  if (!settings.requiredChannel) return next();

  const userId = ctx.from?.id;
  if (!userId) return next();

  // Allow the "I've Joined" check to pass through
  const cbData = ctx.callbackQuery && "data" in ctx.callbackQuery ? ctx.callbackQuery.data : null;
  if (cbData === "check_membership") return next();

  const joined = await isChannelMember(userId, settings.requiredChannel);
  if (joined) return next();

  // Use channelInviteLink for button, fallback to requiredChannel if not set
  const inviteLink = (settings as any).channelInviteLink || settings.requiredChannel;
  const { text, keyboard } = channelJoinMessage(inviteLink);
  await ctx.reply(text, { parse_mode: "Markdown", ...keyboard });
});

// ─── I've Joined — re-check membership ───────────────────────────────────────
bot.action("check_membership", async (ctx) => {
  const settings = await getSettings();

  if (!settings.requiredChannel) {
    await ctx.answerCbQuery();
    await ctx.reply(
      settings.welcomeMessage + "\n\nPlease select an option below:",
      Markup.keyboard([
        ["🛍️ View Products"],
        ["📦 My Orders"],
        ["📞 Contact Admin"],
      ]).resize()
    );
    return;
  }

  const userId = ctx.from.id;
  const joined = await isChannelMember(userId, settings.requiredChannel);

  if (joined) {
    await ctx.answerCbQuery("✅ Verified! Welcome!");
    try {
      await ctx.editMessageText(
        `✅ *Thank you for joining!*\n\nYou can now use the bot. Use the menu below to get started.`,
        { parse_mode: "Markdown" }
      );
    } catch { /* ignore if message can't be edited */ }
    await ctx.reply(
      settings.welcomeMessage + "\n\nPlease select an option below:",
      Markup.keyboard([
        ["🛍️ View Products"],
        ["📦 My Orders"],
        ["📞 Contact Admin"],
      ]).resize()
    );
  } else {
    await ctx.answerCbQuery(
      "❌ You haven't joined yet! Please join the channel first.",
      { show_alert: true }
    );
  }
});

// ─── /start ───────────────────────────────────────────────────────────────────
bot.start(async (ctx) => {
  const payload = (ctx as any).startPayload as string | undefined;

  // Deep link from inline query: /start product_<id>
  if (payload?.startsWith("product_")) {
    const productId = parseInt(payload.replace("product_", ""));
    if (!isNaN(productId)) {
      const [product] = await db.select().from(productsTable).where(eq(productsTable.id, productId));
      if (product && product.isActive) {
        const stock = product.stock ?? -1;
        if (stock === 0) {
          await ctx.reply("❌ Maaf, produk ini telah habis stok.", Markup.inlineKeyboard([
            [Markup.button.callback("🛍️ Lihat Produk Lain", "view_products")],
          ]));
          return;
        }
        await ctx.replyWithMarkdown(
          `🛍️ *${product.name}*\n` +
          `💰 *RM ${product.price}*\n` +
          (product.description ? `\n📝 ${product.description}\n` : "") +
          `\n⚠️ _No refund for all products._`,
          Markup.inlineKeyboard([
            [Markup.button.callback(`🛒 Beli — RM ${product.price}`, `buy_${product.id}`)],
            [Markup.button.callback("🏠 Main Menu", "back_to_menu")],
          ])
        );
        return;
      }
    }
  }

  const settings = await getSettings();
  await ctx.reply(
    settings.welcomeMessage + "\n\nPlease select an option below:",
    Markup.keyboard([
      ["🛍️ View Products"],
      ["📦 My Orders"],
      ["📞 Contact Admin"],
    ]).resize()
  );
});

// ─── Helper: show categories ──────────────────────────────────────────────────
async function showCategories(ctx: any) {
  const categories = await db
    .select()
    .from(categoriesTable)
    .where(eq(categoriesTable.isActive, true))
    .orderBy(categoriesTable.sortOrder, categoriesTable.createdAt);

  if (categories.length === 0) {
    // No categories — fall back to flat product list
    await showAllProducts(ctx);
    return;
  }

  const rows = categories.map((c) => [
    Markup.button.callback(`${c.emoji} ${c.name}`, `cat_${c.id}`),
  ]);
  rows.push([Markup.button.callback("🏠 Main Menu", "back_to_menu")]);

  await ctx.reply(
    `🛍️ *Pilih Kategori Produk:*\n\n⚠️ _No refund for all products._`,
    { parse_mode: "Markdown", ...Markup.inlineKeyboard(rows) }
  );
}

// ─── Helper: show all products (flat, no category filter) ─────────────────────
async function showAllProducts(ctx: any, backAction = "back_to_menu") {
  const products = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.isActive, true));

  if (products.length === 0) {
    await ctx.reply("No products are available at the moment.");
    return;
  }

  const lines = products.map((p, i) => {
    const stock = p.stock ?? -1;
    const stockBadge = stock === 0 ? " ❌" : "";
    return `${i + 1}. ${p.name}${stockBadge}`;
  });

  const msg =
    `🛍️ *Senarai Produk:*\n` +
    `${"─".repeat(28)}\n` +
    lines.join("\n") +
    `\n${"─".repeat(28)}\n` +
    `_Pilih nombor untuk lihat butiran:_\n\n` +
    `⚠️ _No refund for all products._`;

  const numButtons = products.map((p, i) =>
    Markup.button.callback(String(i + 1), `product_${p.id}`)
  );
  const rows: ReturnType<typeof Markup.button.callback>[][] = [];
  for (let i = 0; i < numButtons.length; i += 5) rows.push(numButtons.slice(i, i + 5));
  rows.push([Markup.button.callback("🏠 Main Menu", backAction)]);

  await ctx.reply(msg, { parse_mode: "Markdown", ...Markup.inlineKeyboard(rows) });
}

// ─── Helper: show products by category ───────────────────────────────────────
async function showProductsByCategory(ctx: any, categoryId: number) {
  const [category] = await db
    .select()
    .from(categoriesTable)
    .where(eq(categoriesTable.id, categoryId));

  const products = await db
    .select()
    .from(productsTable)
    .where(and(eq(productsTable.isActive, true), eq(productsTable.categoryId, categoryId)));

  if (products.length === 0) {
    await ctx.reply("Tiada produk dalam kategori ini.", Markup.inlineKeyboard([
      [Markup.button.callback("◀️ Kembali", "show_products")],
    ]));
    return;
  }

  const catName = category ? `${category.emoji} ${category.name}` : "Produk";
  const lines = products.map((p, i) => {
    const stock = p.stock ?? -1;
    const stockBadge = stock === 0 ? " ❌" : "";
    return `${i + 1}. ${p.name}${stockBadge}`;
  });

  const msg =
    `${catName}\n` +
    `${"─".repeat(28)}\n` +
    lines.join("\n") +
    `\n${"─".repeat(28)}\n` +
    `_Pilih nombor untuk lihat butiran:_\n\n` +
    `⚠️ _No refund for all products._`;

  const numButtons = products.map((p, i) =>
    Markup.button.callback(String(i + 1), `product_${p.id}`)
  );
  const rows: ReturnType<typeof Markup.button.callback>[][] = [];
  for (let i = 0; i < numButtons.length; i += 5) rows.push(numButtons.slice(i, i + 5));
  rows.push([Markup.button.callback("◀️ Kembali ke Kategori", "show_products")]);

  await ctx.reply(msg, { parse_mode: "Markdown", ...Markup.inlineKeyboard(rows) });
}

// ─── View Products → show categories ─────────────────────────────────────────
bot.hears(["🛍️ View Products", "🛍️ Lihat Produk"], async (ctx) => {
  const settings = await getSettings();
  if (!settings.isOpen) {
    await ctx.reply(`🔒 ${settings.closedMessage}`);
    return;
  }
  await showCategories(ctx);
});

// ─── Category selected ────────────────────────────────────────────────────────
bot.action(/^cat_(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const categoryId = parseInt(ctx.match[1]);
  await showProductsByCategory(ctx, categoryId);
});

// ─── Back to product/category list (callback) ─────────────────────────────────
bot.action("show_products", async (ctx) => {
  await ctx.answerCbQuery();
  await showCategories(ctx);
});

// ─── Back to main menu (callback) ────────────────────────────────────────────
bot.action("back_to_menu", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply(
    "Choose an action:",
    Markup.keyboard([
      ["🛍️ View Products"],
      ["📦 My Orders", "📞 Contact Admin"],
    ]).resize()
  );
});

// ─── Show product detail ──────────────────────────────────────────────────────
bot.action(/^product_(\d+)$/, async (ctx) => {
  const productId = parseInt(ctx.match[1]);
  const [p] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, productId));

  if (!p || !p.isActive) {
    await ctx.answerCbQuery("Product not found.");
    return;
  }

  await ctx.answerCbQuery();

  const stock = p.stock ?? -1;
  const outOfStock = stock === 0;
  const stockText = stock <= -1
    ? ""
    : outOfStock
    ? "\n⚠️ *Out of Stock!*"
    : `\n📦 Stock: ${stock} unit(s)`;

  const validLine = p.validPeriod ? `\n📅 Valid Period: *${p.validPeriod}*` : "";
  const warrantyLine = p.warranty ? `\n🛡️ Warranty: *${p.warranty}*` : "";

  const msg =
    `*${p.name}*\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `${p.description}\n\n` +
    `💰 Price: *RM ${p.price.toFixed(2)}*` +
    stockText +
    validLine +
    warrantyLine +
    `\n\n⚠️ _No refund for all products._`;

  if (outOfStock) {
    await ctx.reply(msg, {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [Markup.button.callback("❌ Habis Stok", `outofstock_${p.id}`)],
        [Markup.button.callback("🔔 Notify Me (bila ada stok)", `notify_${p.id}`)],
        [Markup.button.callback("◀️ Senarai Produk", "show_products")],
      ]),
    });
  } else {
    await ctx.reply(msg, {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [Markup.button.callback("🛒 Beli 1 unit", `buy_${p.id}`)],
        [Markup.button.callback("📦 Beli Borong (2x–10x)", `bulk_${p.id}`)],
        [Markup.button.callback("◀️ Senarai Produk", "show_products")],
      ]),
    });
  }
});

// ─── My Orders (accept both old Malay and new English buttons) ───────────────
bot.hears(["📦 My Orders", "📦 Pesanan Saya"], async (ctx) => {
  const userId = String(ctx.from.id);
  const orders = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.telegramUserId, userId))
    .orderBy(desc(ordersTable.createdAt))
    .limit(5);

  if (orders.length === 0) {
    await ctx.reply("You have not placed any orders yet.");
    return;
  }

  const statusLabel: Record<string, string> = {
    pending_payment: "⏳ Awaiting Payment",
    payment_uploaded: "🔍 Under Review",
    confirmed: "✅ Confirmed",
    rejected: "❌ Rejected",
  };

  const methodLabel: Record<string, string> = {
    toyyibpay: "💳 Toyyibpay",
    tng_qr: "📱 Touch & Go QR",
  };

  let msg = `📋 *Pesanan Terkini Anda (${orders.length}):*\n\n`;
  for (const o of orders) {
    const method = methodLabel[o.paymentMethod] || o.paymentMethod;
    const qty = (o.quantity ?? 1) > 1 ? ` x${o.quantity}` : "";
    msg += `🔖 *#${o.id}* — ${esc(o.productName)}${qty}\n`;
    msg += `💰 RM${o.productPrice.toFixed(2)} • ${method}\n`;
    msg += `📊 ${statusLabel[o.status] || o.status}\n`;
    msg += `📅 ${new Date(o.createdAt).toLocaleDateString("en-MY")}\n\n`;
  }
  msg += `_Hantar gambar/PDF resit bayaran untuk mengemaskini pesanan._`;
  await ctx.reply(msg, { parse_mode: "Markdown" });
});

// ─── Contact Admin (accept both old Malay and new English buttons) ───────────
bot.hears(["📞 Contact Admin", "📞 Hubungi Admin"], async (ctx) => {
  if (adminId) {
    await ctx.reply(
      `For any inquiries, please contact our admin:\n👤 [Click to contact admin](tg://user?id=${adminId})`,
      { parse_mode: "Markdown" }
    );
  } else {
    await ctx.reply("Please contact admin for further assistance.");
  }
});

// ─── Buy Now → place order with TnG QR ───────────────────────────────────────
bot.action(/^buy_(\d+)$/, async (ctx) => {
  const productId = parseInt(ctx.match[1]);
  const [product] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, productId));

  if (!product || !product.isActive) {
    await ctx.answerCbQuery("Product not available.");
    return;
  }
  if (product.stock === 0) {
    await ctx.answerCbQuery("Sorry, this product is out of stock.");
    return;
  }

  const settings = await getSettings();
  if (!settings.isOpen) {
    await ctx.answerCbQuery("The store is currently closed.");
    return;
  }

  await ctx.answerCbQuery();

  const userId = String(ctx.from.id);
  const [order] = await db
    .insert(ordersTable)
    .values({
      telegramUserId: userId,
      telegramUsername: ctx.from.username || null,
      telegramFirstName: ctx.from.first_name || null,
      productId: product.id,
      productName: product.name,
      productPrice: product.price,
      status: "pending_payment",
      paymentMethod: "tng_qr",
    })
    .returning();

  if (settings.qrImageUrl && settings.qrImageUrl.trim()) {
    try {
      await sendQrPhoto(
        ctx,
        settings.qrImageUrl,
        `📱 *Touch & Go QR*\n\n` +
        `📦 Product: *${product.name}*\n` +
        `💰 Amount: *RM ${product.price.toFixed(2)}*\n\n` +
        `Scan the QR code above to make payment.`
      );
    } catch (err) {
      console.error("[qr] Failed to send QR photo:", err);
    }
  }

  await ctx.reply(
    `📝 *Payment Instructions:*\n\n` +
      (settings.paymentInstructions
        ? settings.paymentInstructions + "\n\n"
        : "") +
      `⚠️ *After paying, please send a screenshot or receipt of your payment in this chat.*\n\n` +
      `🔖 Order No: *#${order.id}*`,
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [Markup.button.callback("❌ Cancel Order", `cancel_${order.id}`)],
      ]),
    }
  );

  await notifyAdmin(
    `🆕 *New Order (Touch & Go QR)*\n\n` +
      `👤 ${esc(ctx.from.first_name || "Unknown")}${ctx.from.username ? ` (@${esc(ctx.from.username)})` : ""}\n` +
      `📦 ${esc(product.name)}\n` +
      `💰 RM${product.price.toFixed(2)}\n` +
      `🔖 Order No: #${order.id}\n\n` +
      `⏳ Waiting for payment proof from customer...`
  );
});

// ─── Bulk Order — show quantity selector ──────────────────────────────────────
bot.action(/^bulk_(\d+)$/, async (ctx) => {
  const productId = parseInt(ctx.match[1]);
  await ctx.answerCbQuery();

  const [p] = await db.select().from(productsTable).where(eq(productsTable.id, productId));
  if (!p || !p.isActive || p.stock === 0) {
    await ctx.reply("❌ Produk tidak tersedia atau habis stok.");
    return;
  }

  const stock = p.stock ?? -1;
  const maxQty = stock > 0 ? Math.min(stock, 50) : 50;
  const qtys = [2, 3, 5, 10].filter((q) => q <= maxQty);

  const rows = qtys.map((q) => [
    Markup.button.callback(
      `📦 ${q}x — RM ${(p.price * q).toFixed(2)}`,
      `qty_${p.id}_${q}`
    ),
  ]);
  // Add custom quantity input button
  rows.push([Markup.button.callback("✏️ Taip kuantiti sendiri", `custom_qty_${p.id}`)]);
  rows.push([Markup.button.callback("◀️ Kembali", `product_${p.id}`)]);

  await ctx.reply(
    `📦 *Pilih Kuantiti — ${esc(p.name)}*\n\n` +
    `💰 Harga seunit: *RM ${p.price.toFixed(2)}*\n` +
    (stock > 0 ? `📊 Stok: *${stock} unit*\n` : "") +
    `\nPilih kuantiti atau taip sendiri:`,
    { parse_mode: "Markdown", ...Markup.inlineKeyboard(rows) }
  );
});

// ─── Custom quantity — ask user to type a number ──────────────────────────────
bot.action(/^custom_qty_(\d+)$/, async (ctx) => {
  const productId = parseInt(ctx.match[1]);
  await ctx.answerCbQuery();

  const [p] = await db.select().from(productsTable).where(eq(productsTable.id, productId));
  if (!p || !p.isActive) { await ctx.reply("❌ Produk tidak dijumpai."); return; }

  const chatId = String(ctx.from.id);
  awaitingCustomQty.set(chatId, productId);

  const stock = p.stock ?? -1;
  const maxNote = stock > 0 ? ` (maks: ${stock} unit)` : "";

  await ctx.reply(
    `✏️ *Taip Kuantiti Anda*\n\n` +
    `📦 Produk: *${esc(p.name)}*\n` +
    `💰 Harga seunit: *RM ${p.price.toFixed(2)}*\n\n` +
    `Sila taip nombor kuantiti yang anda inginkan${maxNote}:\n` +
    `_(contoh: 4, 7, 15...)_`,
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([[Markup.button.callback("❌ Batal", `bulk_${productId}`)]]),
    }
  );
});

// ─── Quantity selected — confirm bulk order ────────────────────────────────────
bot.action(/^qty_(\d+)_(\d+)$/, async (ctx) => {
  const productId = parseInt(ctx.match[1]);
  const qty = parseInt(ctx.match[2]);
  await ctx.answerCbQuery();

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, productId));
  if (!product || !product.isActive) {
    await ctx.reply("❌ Produk tidak tersedia.");
    return;
  }
  if (product.stock >= 0 && product.stock < qty) {
    await ctx.reply(`❌ Stok tidak mencukupi. Stok semasa: ${product.stock} unit.`);
    return;
  }

  const settings = await getSettings();
  if (!settings.isOpen) {
    await ctx.reply("🔒 Kedai sedang tutup.");
    return;
  }

  const totalPrice = product.price * qty;
  const userId = String(ctx.from.id);

  const [order] = await db
    .insert(ordersTable)
    .values({
      telegramUserId: userId,
      telegramUsername: ctx.from.username || null,
      telegramFirstName: ctx.from.first_name || null,
      productId: product.id,
      productName: product.name,
      productPrice: totalPrice,
      quantity: qty,
      status: "pending_payment",
      paymentMethod: "tng_qr",
    })
    .returning();

  if (settings.qrImageUrl && settings.qrImageUrl.trim()) {
    try {
      await sendQrPhoto(
        ctx,
        settings.qrImageUrl,
        `📱 *Touch & Go QR — Borong ${qty}x*\n\n` +
        `📦 Produk: *${product.name}*\n` +
        `🔢 Kuantiti: *${qty} unit*\n` +
        `💰 Jumlah: *RM ${totalPrice.toFixed(2)}*\n\n` +
        `Scan QR di atas untuk bayar.`
      );
    } catch (err) {
      console.error("[qr bulk] Failed to send QR:", err);
    }
  }

  await ctx.reply(
    `📝 *Arahan Bayaran:*\n\n` +
    (settings.paymentInstructions ? settings.paymentInstructions + "\n\n" : "") +
    `📦 Produk: *${product.name}*\n` +
    `🔢 Kuantiti: *${qty} unit*\n` +
    `💰 Jumlah Bayar: *RM ${totalPrice.toFixed(2)}*\n\n` +
    `⚠️ *Setelah bayar, sila hantar screenshot/resit bayaran dalam chat ini.*\n\n` +
    `🔖 No. Pesanan: *#${order.id}*`,
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [Markup.button.callback("❌ Batal Pesanan", `cancel_${order.id}`)],
      ]),
    }
  );

  await notifyAdmin(
    `🆕 *New BULK Order (Touch & Go QR)*\n\n` +
    `👤 ${esc(ctx.from.first_name || "Unknown")}${ctx.from.username ? ` (@${esc(ctx.from.username)})` : ""}\n` +
    `📦 ${esc(product.name)}\n` +
    `🔢 Kuantiti: ${qty}x\n` +
    `💰 Jumlah: RM${totalPrice.toFixed(2)}\n` +
    `🔖 Order No: #${order.id}\n\n` +
    `⏳ Menunggu bukti bayaran...`
  );
});

// ─── Notify Me when product back in stock ─────────────────────────────────────
bot.action(/^notify_(\d+)$/, async (ctx) => {
  const productId = parseInt(ctx.match[1]);
  await ctx.answerCbQuery();

  const [p] = await db.select().from(productsTable).where(eq(productsTable.id, productId));
  if (!p) { await ctx.reply("Produk tidak dijumpai."); return; }

  if (!restockWaiters.has(productId)) restockWaiters.set(productId, new Set());
  restockWaiters.get(productId)!.add(String(ctx.from.id));

  await ctx.reply(
    `🔔 *Notifikasi Diaktifkan!*\n\n` +
    `Anda akan diberitahu apabila *${esc(p.name)}* ada stok semula.\n\n` +
    `_Notifikasi akan dihantar terus ke chat ini._`,
    { parse_mode: "Markdown" }
  );
});

// ─── Pay via Toyyibpay ────────────────────────────────────────────────────────
bot.action(/^pay_toyyibpay_(\d+)$/, async (ctx) => {
  const productId = parseInt(ctx.match[1]);
  await ctx.answerCbQuery();

  const [product] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, productId));

  if (!product || !product.isActive || product.stock === 0) {
    await ctx.reply("❌ Product not available or out of stock.");
    return;
  }

  const userId = String(ctx.from.id);
  const customerName = ctx.from.first_name || "Customer";

  const [order] = await db
    .insert(ordersTable)
    .values({
      telegramUserId: userId,
      telegramUsername: ctx.from.username || null,
      telegramFirstName: ctx.from.first_name || null,
      productId: product.id,
      productName: product.name,
      productPrice: product.price,
      status: "pending_payment",
      paymentMethod: "toyyibpay",
    })
    .returning();

  const callbackUrl = `https://${publicDomain}/api/webhook/toyyibpay`;
  const returnUrl = `https://${publicDomain}/api/webhook/toyyibpay`;

  let paymentUrl: string | null = null;
  try {
    const billCode = await createBill({
      orderId: order.id,
      productName: product.name,
      amount: product.price,
      customerName,
      callbackUrl,
      returnUrl,
    });
    if (billCode) paymentUrl = getBillUrl(billCode);
  } catch (err) {
    console.error("Failed to create Toyyibpay bill:", err);
  }

  if (paymentUrl) {
    await ctx.reply(
      `✅ *Order Created!*\n\n` +
        `📦 Product: *${product.name}*\n` +
        `💰 Price: *RM ${product.price.toFixed(2)}*\n` +
        `💳 Method: Toyyibpay\n\n` +
        `Click the button below to pay via *FPX / TNG eWallet / Credit Card*.\n\n` +
        `⚡ Product will be delivered *automatically* after payment is confirmed!`,
      {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [Markup.button.url("💳 Pay Now via Toyyibpay", paymentUrl)],
          [Markup.button.callback("❌ Cancel Order", `cancel_${order.id}`)],
        ]),
      }
    );
  } else {
    await ctx.reply(
      `⚠️ There was a technical issue with Toyyibpay. Please contact admin for help.\n\n` +
        `Order No: #${order.id}`,
      { parse_mode: "Markdown" }
    );
  }

  await notifyAdmin(
    `🆕 *New Order (Toyyibpay)*\n\n` +
      `👤 ${esc(ctx.from.first_name || "Unknown")}${ctx.from.username ? ` (@${esc(ctx.from.username)})` : ""}\n` +
      `📦 ${esc(product.name)}\n` +
      `💰 RM${product.price.toFixed(2)}\n` +
      `🔖 Order No: #${order.id}` +
      (paymentUrl ? `\n🔗 ${paymentUrl}` : "")
  );
});

// ─── Pay via Touch & Go QR ────────────────────────────────────────────────────
bot.action(/^pay_tng_(\d+)$/, async (ctx) => {
  const productId = parseInt(ctx.match[1]);
  await ctx.answerCbQuery();

  const [product] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, productId));

  if (!product || !product.isActive || product.stock === 0) {
    await ctx.reply("❌ Product not available or out of stock.");
    return;
  }

  const settings = await getSettings();

  const userId = String(ctx.from.id);
  const [order] = await db
    .insert(ordersTable)
    .values({
      telegramUserId: userId,
      telegramUsername: ctx.from.username || null,
      telegramFirstName: ctx.from.first_name || null,
      productId: product.id,
      productName: product.name,
      productPrice: product.price,
      status: "pending_payment",
      paymentMethod: "tng_qr",
    })
    .returning();

  if (settings.qrImageUrl && settings.qrImageUrl.trim()) {
    try {
      await sendQrPhoto(
        ctx,
        settings.qrImageUrl,
        `📱 *Touch & Go QR*\n\n` +
        `📦 Product: *${product.name}*\n` +
        `💰 Amount: *RM ${product.price.toFixed(2)}*\n\n` +
        `Scan the QR code above to make payment.`
      );
    } catch (err) {
      console.error("[qr] Failed to send QR photo:", err);
    }
  }

  await ctx.reply(
    `📝 *Payment Instructions:*\n\n` +
      (settings.paymentInstructions
        ? settings.paymentInstructions + "\n\n"
        : "") +
      `⚠️ *After paying, please send a screenshot or receipt of your payment in this chat.*\n\n` +
      `🔖 Order No: *#${order.id}*`,
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [Markup.button.callback("❌ Cancel Order", `cancel_${order.id}`)],
      ]),
    }
  );

  await notifyAdmin(
    `🆕 *New Order (Touch & Go QR)*\n\n` +
      `👤 ${esc(ctx.from.first_name || "Unknown")}${ctx.from.username ? ` (@${esc(ctx.from.username)})` : ""}\n` +
      `📦 ${esc(product.name)}\n` +
      `💰 RM${product.price.toFixed(2)}\n` +
      `🔖 Order No: #${order.id}\n\n` +
      `⏳ Waiting for payment proof from customer...`
  );
});

// ─── Helper: deliver order to customer ────────────────────────────────────────
async function deliverOrder(orderId: number): Promise<string> {
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
  if (!order) return "Order not found";

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, order.productId));
  const qty = order.quantity ?? 1;
  const defaultDelivery = product?.deliveryContent || "Sila hubungi admin untuk terima produk anda.";

  // Pick qty accounts from pool (for bulk orders)
  const poolAccounts = await db
    .select()
    .from(productAccountsTable)
    .where(and(eq(productAccountsTable.productId, order.productId), eq(productAccountsTable.isDelivered, false)))
    .limit(qty);

  let deliveryContent = defaultDelivery;
  const accountLines: string[] = [];

  if (poolAccounts.length > 0) {
    const deliveredIds = poolAccounts.map((a) => a.id);
    await db
      .update(productAccountsTable)
      .set({ isDelivered: true, orderId })
      .where(inArray(productAccountsTable.id, deliveredIds));
    accountLines.push(...poolAccounts.map((a) => a.content));
    deliveryContent = accountLines.join("\n\n---\n\n");
  }

  await db
    .update(ordersTable)
    .set({ status: "confirmed", deliveryMessage: deliveryContent, updatedAt: new Date() })
    .where(eq(ordersTable.id, orderId));

  // Reduce stock by qty
  if (product && product.stock > 0) {
    const newStock = Math.max(0, product.stock - qty);
    await db.update(productsTable).set({ stock: newStock }).where(eq(productsTable.id, product.id));

    // Trigger restock notification if stock was 0 before (newly restocked) — won't apply here
    // Restock notification is handled separately in checkRestockNotifications
  }

  const installGuide = product?.installGuide || null;
  const isMultiple = qty > 1;

  let confirmMsg =
    `✅ *Bayaran Disahkan!*\n\n` +
    `Terima kasih kerana membeli *${esc(order.productName)}*` +
    (isMultiple ? ` (${qty}x)` : "") + `!\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `📦 *AKAUN / PRODUK ANDA:*\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n\n`;

  if (isMultiple && accountLines.length > 1) {
    // Send each account as a separate block
    for (let i = 0; i < accountLines.length; i++) {
      confirmMsg += `*Akaun ${i + 1}:*\n\`\`\`\n${accountLines[i]}\n\`\`\`\n\n`;
    }
  } else {
    confirmMsg += `\`\`\`\n${deliveryContent}\n\`\`\``;
  }

  if (installGuide?.trim()) {
    confirmMsg +=
      `\n\n━━━━━━━━━━━━━━━━━━━━━\n` +
      `📋 *CARA PENGGUNAAN / PANDUAN INSTALL:*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n\n` +
      installGuide.trim();
  }
  confirmMsg += `\n\n━━━━━━━━━━━━━━━━━━━━━\n⚠️ _Jangan kongsikan maklumat ini kepada sesiapa._\n\nSelamat menggunakan! Hubungi admin jika ada masalah. 😊`;

  await bot.telegram.sendMessage(order.telegramUserId, confirmMsg, { parse_mode: "Markdown" });
  return deliveryContent;
}

// ─── Helper: process payment proof (photo or document/PDF) ────────────────────
async function handlePaymentProof(ctx: any, fileId: string, fileType: "photo" | "document") {
  const userId = String(ctx.from.id);

  const [pendingOrder] = await db
    .select()
    .from(ordersTable)
    .where(and(
      eq(ordersTable.telegramUserId, userId),
      eq(ordersTable.status, "pending_payment"),
      eq(ordersTable.paymentMethod, "tng_qr")
    ))
    .orderBy(desc(ordersTable.createdAt))
    .limit(1);

  if (!pendingOrder) {
    await ctx.reply(
      "Terima kasih. Jika ingin membuat pesanan, sila tekan *🛍️ View Products*.",
      { parse_mode: "Markdown" }
    );
    return;
  }

  // Check if returning customer
  const [prevCompleted] = await db
    .select()
    .from(ordersTable)
    .where(and(
      eq(ordersTable.telegramUserId, userId),
      inArray(ordersTable.status, ["confirmed", "completed"])
    ))
    .limit(1);

  const isReturningCustomer = !!prevCompleted;

  await db
    .update(ordersTable)
    .set({ status: "payment_uploaded", paymentProofUrl: fileId, updatedAt: new Date() })
    .where(eq(ordersTable.id, pendingOrder.id));

  // Helper: send file to admin (photo or document), with plain-text retry on Markdown error
  const sendToAdmin = async (caption: string, markup: any) => {
    if (!adminId) {
      console.warn("[sendToAdmin] ADMIN_TELEGRAM_ID not set — skipping");
      return;
    }
    const send = (cap: string, extra: any) =>
      fileType === "photo"
        ? bot.telegram.sendPhoto(adminId, fileId, { caption: cap, ...extra, reply_markup: markup })
        : bot.telegram.sendDocument(adminId, fileId, { caption: cap, ...extra, reply_markup: markup });
    try {
      await send(caption, { parse_mode: "Markdown" });
    } catch (err) {
      console.error("[sendToAdmin] Failed with Markdown, retrying as plain:", err);
      try {
        await send(caption.replace(/[*_`[\]]/g, ""), {});
      } catch (err2) {
        console.error("[sendToAdmin] Retry (plain) also failed:", err2);
      }
    }
  };

  if (isReturningCustomer) {
    await ctx.reply(
      `✅ *Bayaran diterima & disahkan secara automatik!*\n\n` +
      `Terima kasih pelanggan setia kami! Produk sedang diproses...\n\n` +
      `🔖 Order No: *#${pendingOrder.id}*`,
      { parse_mode: "Markdown" }
    );
    try { await deliverOrder(pendingOrder.id); } catch (err) {
      console.error("[auto-approve] Delivery failed:", err);
    }
    try {
      const customerTag = `${esc(ctx.from.first_name || "Unknown")}${ctx.from.username ? ` (@${esc(ctx.from.username)})` : ""}`;
      await sendToAdmin(
        `⚡ *Auto-Approved (Pelanggan Lama)*${fileType === "document" ? " 📄 PDF" : ""}\n\n` +
        `👤 ${customerTag}\n` +
        `📦 ${esc(pendingOrder.productName)}\n` +
        `💰 RM${pendingOrder.productPrice.toFixed(2)}\n` +
        `🔖 Order No: #${pendingOrder.id}\n\n` +
        `✅ _Produk telah dihantar secara automatik._`,
        Markup.inlineKeyboard([[Markup.button.callback(`🔄 Batalkan #${pendingOrder.id}`, `admin_reject_${pendingOrder.id}`)]]).reply_markup
      );
    } catch (err) { console.error("Failed to notify admin (auto-approve):", err); }
  } else {
    await ctx.reply(
      `✅ *Bukti bayaran diterima!*\n\n` +
      `Terima kasih! Admin akan semak bayaran anda tidak lama lagi.\n\n` +
      `🔖 Order No: *#${pendingOrder.id}*`,
      { parse_mode: "Markdown" }
    );
    try {
      const customerTag = `${esc(ctx.from.first_name || "Unknown")}${ctx.from.username ? ` (@${esc(ctx.from.username)})` : ""}`;
      await sendToAdmin(
        `💳 *Bukti Bayaran — Pelanggan Baru* 🆕${fileType === "document" ? " 📄 PDF" : ""}\n\n` +
        `👤 ${customerTag}\n` +
        `📦 ${esc(pendingOrder.productName)}\n` +
        `💰 RM${pendingOrder.productPrice.toFixed(2)}\n` +
        `🔖 Order No: #${pendingOrder.id}\n\n` +
        `⚠️ _Pelanggan baru — sila semak bukti bayaran sebelum sahkan._`,
        Markup.inlineKeyboard([[
          Markup.button.callback(`✅ Sahkan #${pendingOrder.id}`, `admin_confirm_${pendingOrder.id}`),
          Markup.button.callback(`❌ Tolak #${pendingOrder.id}`, `admin_reject_${pendingOrder.id}`),
        ]]).reply_markup
      );
    } catch (err) { console.error("Failed to notify admin with proof:", err); }
  }
}

// ─── Handle custom quantity text input ────────────────────────────────────────
bot.on("text", async (ctx, next) => {
  const chatId = String(ctx.from.id);
  const productId = awaitingCustomQty.get(chatId);

  // Not waiting for custom qty — pass to next handler
  if (!productId) return next();

  const text = ctx.message.text.trim();

  // User typed a menu button — cancel and pass through
  const menuButtons = ["🛍️ View Products", "📦 My Orders", "📞 Contact Admin", "🛍️ Lihat Produk", "📦 Pesanan Saya", "📞 Hubungi Admin"];
  if (menuButtons.includes(text)) {
    awaitingCustomQty.delete(chatId);
    return next();
  }

  const qty = parseInt(text);

  if (isNaN(qty) || qty < 1) {
    await ctx.reply(
      "❌ Sila taip nombor yang sah. Contoh: `4`, `7`, `15`",
      { parse_mode: "Markdown" }
    );
    return;
  }

  // Validate stock
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, productId));
  if (!product || !product.isActive) {
    awaitingCustomQty.delete(chatId);
    await ctx.reply("❌ Produk tidak dijumpai. Sila mulakan semula.");
    return;
  }

  if (product.stock >= 0 && qty > product.stock) {
    await ctx.reply(
      `❌ Stok tidak mencukupi!\n\nStok semasa: *${product.stock} unit*\nSila taip kuantiti antara 1–${product.stock}:`,
      { parse_mode: "Markdown" }
    );
    return;
  }

  if (qty > 50) {
    await ctx.reply(
      "❌ Kuantiti maksimum ialah *50 unit* sekaligus.\nSila taip kuantiti antara 1–50:",
      { parse_mode: "Markdown" }
    );
    return;
  }

  // Valid qty — clear state and proceed
  awaitingCustomQty.delete(chatId);

  const settings = await getSettings();
  if (!settings.isOpen) {
    await ctx.reply("🔒 Kedai sedang tutup.");
    return;
  }

  const totalPrice = product.price * qty;

  const [order] = await db
    .insert(ordersTable)
    .values({
      telegramUserId: chatId,
      telegramUsername: ctx.from.username || null,
      telegramFirstName: ctx.from.first_name || null,
      productId: product.id,
      productName: product.name,
      productPrice: totalPrice,
      quantity: qty,
      status: "pending_payment",
      paymentMethod: "tng_qr",
    })
    .returning();

  if (settings.qrImageUrl && settings.qrImageUrl.trim()) {
    try {
      await sendQrPhoto(
        ctx,
        settings.qrImageUrl,
        `📱 *Touch & Go QR*\n\n` +
        `📦 Produk: *${product.name}*\n` +
        `🔢 Kuantiti: *${qty} unit*\n` +
        `💰 Jumlah: *RM ${totalPrice.toFixed(2)}*\n\n` +
        `Scan QR di atas untuk bayar.`
      );
    } catch (err) {
      console.error("[qr custom qty] Failed:", err);
    }
  }

  await ctx.reply(
    `✅ *Pesanan Dicipta!*\n\n` +
    `📦 Produk: *${esc(product.name)}*\n` +
    `🔢 Kuantiti: *${qty} unit*\n` +
    `💰 Jumlah Bayar: *RM ${totalPrice.toFixed(2)}*\n\n` +
    (settings.paymentInstructions ? settings.paymentInstructions + "\n\n" : "") +
    `⚠️ *Setelah bayar, sila hantar screenshot/resit bayaran dalam chat ini.*\n\n` +
    `🔖 No. Pesanan: *#${order.id}*`,
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [Markup.button.callback("❌ Batal Pesanan", `cancel_${order.id}`)],
      ]),
    }
  );

  await notifyAdmin(
    `🆕 *New Order (Custom Qty ${qty}x)*\n\n` +
    `👤 ${esc(ctx.from.first_name || "Unknown")}${ctx.from.username ? ` (@${esc(ctx.from.username)})` : ""}\n` +
    `📦 ${esc(product.name)}\n` +
    `🔢 Kuantiti: ${qty}x\n` +
    `💰 Jumlah: RM${totalPrice.toFixed(2)}\n` +
    `🔖 Order No: #${order.id}\n\n` +
    `⏳ Menunggu bukti bayaran...`
  );
});

// ─── Receive payment proof — photo ────────────────────────────────────────────
bot.on("photo", async (ctx) => {
  const photos = ctx.message.photo;
  const fileId = photos[photos.length - 1].file_id;
  await handlePaymentProof(ctx, fileId, "photo");
});

// ─── Receive payment proof — document / PDF ───────────────────────────────────
bot.on("document", async (ctx) => {
  const doc = ctx.message.document;
  // Accept PDF or any image document (e.g. HEIC, BMP)
  const allowed = ["application/pdf", "image/"];
  const mime = doc.mime_type || "";
  if (!allowed.some((a) => mime.startsWith(a))) {
    await ctx.reply(
      "📎 Sila hantar bukti bayaran dalam format *gambar* atau *PDF* sahaja.",
      { parse_mode: "Markdown" }
    );
    return;
  }
  await handlePaymentProof(ctx, doc.file_id, "document");
});

// ─── Admin confirm payment ────────────────────────────────────────────────────
bot.action(/^admin_confirm_(\d+)$/, async (ctx) => {
  const orderId = parseInt(ctx.match[1]);

  if (adminId && String(ctx.from.id) !== adminId) {
    await ctx.answerCbQuery("❌ You do not have permission.");
    return;
  }

  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, orderId));

  if (!order) {
    await ctx.answerCbQuery("Order not found.");
    return;
  }

  if (order.status === "confirmed") {
    await ctx.answerCbQuery("This order has already been confirmed.");
    return;
  }

  try {
    await deliverOrder(orderId);
  } catch (err) {
    console.error("Failed to deliver order:", err);
  }

  await ctx.answerCbQuery("✅ Bayaran disahkan! Produk dihantar.");
  await ctx.editMessageCaption(
    `✅ *CONFIRMED* — Order #${orderId}\n\n📦 ${order.productName}\n💰 RM${order.productPrice.toFixed(2)}\n\n_Produk telah dihantar kepada pelanggan._`,
    { parse_mode: "Markdown" }
  );
});

// ─── Admin reject payment ─────────────────────────────────────────────────────
bot.action(/^admin_reject_(\d+)$/, async (ctx) => {
  const orderId = parseInt(ctx.match[1]);

  if (adminId && String(ctx.from.id) !== adminId) {
    await ctx.answerCbQuery("❌ You do not have permission.");
    return;
  }

  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, orderId));

  if (!order) {
    await ctx.answerCbQuery("Order not found.");
    return;
  }

  if (order.status === "rejected") {
    await ctx.answerCbQuery("This order has already been rejected.");
    return;
  }

  await db
    .update(ordersTable)
    .set({ status: "rejected", updatedAt: new Date() })
    .where(eq(ordersTable.id, orderId));

  try {
    await bot.telegram.sendMessage(
      order.telegramUserId,
      `❌ *Payment Rejected*\n\n` +
        `Sorry, your payment for order *#${orderId}* (${order.productName}) could not be verified.\n\n` +
        `Please contact admin if you believe this is an error.`,
      { parse_mode: "Markdown" }
    );
  } catch (err) {
    console.error("Failed to notify customer of rejection:", err);
  }

  await ctx.answerCbQuery("❌ Payment rejected.");
  await ctx.editMessageCaption(
    `❌ *REJECTED* — Order #${orderId}\n\n📦 ${order.productName}\n💰 RM${order.productPrice.toFixed(2)}\n\n_Customer has been notified._`,
    { parse_mode: "Markdown" }
  );
});

// ─── Out of stock ─────────────────────────────────────────────────────────────
bot.action(/^outofstock_(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery("Sorry, this product is out of stock.");
});

// ─── Cancel during method selection ──────────────────────────────────────────
bot.action("cancel_select", async (ctx) => {
  await ctx.answerCbQuery("Cancelled.");
  await ctx.deleteMessage();
});

// ─── Cancel order ─────────────────────────────────────────────────────────────
bot.action(/^cancel_(\d+)$/, async (ctx) => {
  const orderId = parseInt(ctx.match[1]);
  const userId = String(ctx.from.id);

  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, orderId));

  if (!order || order.telegramUserId !== userId) {
    await ctx.answerCbQuery("Order not found.");
    return;
  }

  if (order.status !== "pending_payment") {
    await ctx.answerCbQuery("This order cannot be cancelled.");
    return;
  }

  await db
    .update(ordersTable)
    .set({ status: "rejected", updatedAt: new Date() })
    .where(eq(ordersTable.id, orderId));

  await ctx.answerCbQuery("Order cancelled.");
  await ctx.reply("❌ Your order has been cancelled.");
});

// ─── /help command ────────────────────────────────────────────────────────────
bot.command("help", async (ctx) => {
  await ctx.replyWithMarkdown(
    `❓ *Bantuan & FAQ*\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `*Cara Membeli:*\n` +
    `1️⃣ Tekan 🛍️ *View Products*\n` +
    `2️⃣ Pilih produk yang anda inginkan\n` +
    `3️⃣ Pilih 🛒 *Beli 1 unit* atau 📦 *Beli Borong*\n` +
    `4️⃣ Buat bayaran melalui TnG QR\n` +
    `5️⃣ Hantar *screenshot resit bayaran* ke sini\n` +
    `6️⃣ Admin akan sahkan & produk dihantar!\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `*Soalan Lazim:*\n\n` +
    `🔹 *Berapa lama penghantaran?*\n` +
    `Setelah bayaran disahkan, produk dihantar dalam masa 5–30 minit.\n\n` +
    `🔹 *Boleh refund?*\n` +
    `❌ Tiada refund untuk semua produk digital.\n\n` +
    `🔹 *Apa yang perlu buat jika ada masalah?*\n` +
    `Hubungi admin melalui butang 📞 Contact Admin.\n\n` +
    `🔹 *Berapa unit boleh beli sekaligus?*\n` +
    `Maksimum 10 unit sekaligus (borong).\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `*Arahan Bot:*\n` +
    `/start — Mulakan bot\n` +
    `/help — Tunjuk bantuan ini\n` +
    `/orders — Semak pesanan anda\n\n` +
    `💬 Ada soalan lain? Hubungi 📞 *Contact Admin*`
  );
});

// ─── /orders command (shortcut for My Orders) ─────────────────────────────────
bot.command("orders", async (ctx) => {
  const userId = String(ctx.from.id);
  const orders = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.telegramUserId, userId))
    .orderBy(desc(ordersTable.createdAt))
    .limit(5);

  if (orders.length === 0) {
    await ctx.reply("Anda belum membuat sebarang pesanan. Taip /start untuk mula beli! 🛍️");
    return;
  }

  const statusLabel: Record<string, string> = {
    pending_payment: "⏳ Menunggu Bayaran",
    payment_uploaded: "🔍 Sedang Disemak",
    confirmed: "✅ Disahkan",
    rejected: "❌ Ditolak",
    cancelled: "🚫 Dibatalkan",
  };

  let msg = `📋 *Pesanan Terkini Anda (${orders.length}):*\n\n`;
  for (const o of orders) {
    const qty = (o.quantity ?? 1) > 1 ? ` x${o.quantity}` : "";
    msg += `🔖 *#${o.id}* — ${esc(o.productName)}${qty}\n`;
    msg += `💰 RM${o.productPrice.toFixed(2)}\n`;
    msg += `📊 ${statusLabel[o.status] || o.status}\n`;
    msg += `📅 ${new Date(o.createdAt).toLocaleDateString("en-MY")}\n\n`;
  }
  await ctx.reply(msg, { parse_mode: "Markdown" });
});

// ─── Admin /pending command ────────────────────────────────────────────────────
bot.command("pending", async (ctx) => {
  if (!adminId || String(ctx.from.id) !== adminId) return;

  const pendingOrders = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.status, "payment_uploaded"))
    .orderBy(desc(ordersTable.createdAt))
    .limit(10);

  if (pendingOrders.length === 0) {
    await ctx.reply("✅ Tiada pesanan yang menunggu pengesahan.");
    return;
  }

  let msg = `⏳ *${pendingOrders.length} Pesanan Menunggu Pengesahan:*\n\n`;
  for (const o of pendingOrders) {
    const qty = (o.quantity ?? 1) > 1 ? ` (${o.quantity}x)` : "";
    const customer = `${esc(o.telegramFirstName || "?")}${o.telegramUsername ? ` @${esc(o.telegramUsername)}` : ""}`;
    msg += `🔖 *#${o.id}* — ${esc(o.productName)}${qty}\n`;
    msg += `👤 ${customer} • 💰 RM${o.productPrice.toFixed(2)}\n`;
    msg += `📅 ${new Date(o.createdAt).toLocaleString("en-MY")}\n\n`;
  }

  await ctx.reply(msg, { parse_mode: "Markdown" });
});

// ─── Admin /stats command ──────────────────────────────────────────────────────
bot.command("stats", async (ctx) => {
  if (!adminId || String(ctx.from.id) !== adminId) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString();

  const [allOrders, products] = await Promise.all([
    db.select().from(ordersTable).where(eq(ordersTable.status, "confirmed")),
    db.select().from(productsTable).where(eq(productsTable.isActive, true)),
  ]);

  const todayOrders = allOrders.filter((o) => new Date(o.createdAt) >= today);
  const todayRevenue = todayOrders.reduce((sum, o) => sum + o.productPrice, 0);
  const totalRevenue = allOrders.reduce((sum, o) => sum + o.productPrice, 0);

  const lowStock = products.filter((p) => p.stock >= 0 && p.stock <= 3);

  let msg =
    `📊 *Statistik Kedai*\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `*Hari ini (${today.toLocaleDateString("en-MY")}):*\n` +
    `🛒 Pesanan: *${todayOrders.length}*\n` +
    `💰 Jualan: *RM${todayRevenue.toFixed(2)}*\n\n` +
    `*Keseluruhan:*\n` +
    `🛒 Pesanan Disahkan: *${allOrders.length}*\n` +
    `💰 Jualan Total: *RM${totalRevenue.toFixed(2)}*\n` +
    `🛍️ Produk Aktif: *${products.length}*\n`;

  if (lowStock.length > 0) {
    msg += `\n⚠️ *Stok Hampir Habis:*\n`;
    for (const p of lowStock) {
      msg += `• ${esc(p.name)}: *${p.stock} unit*\n`;
    }
  }

  await ctx.reply(msg, { parse_mode: "Markdown" });
});

// ─── Auto-cancel expired orders ───────────────────────────────────────────────
const AUTO_CANCEL_MINUTES = 10;

// ─── Check restock and notify waiters ─────────────────────────────────────────
async function checkRestockNotifications() {
  if (restockWaiters.size === 0) return;
  for (const [productId, chatIds] of restockWaiters) {
    if (chatIds.size === 0) continue;
    const [product] = await db
      .select()
      .from(productsTable)
      .where(and(eq(productsTable.id, productId), eq(productsTable.isActive, true)));
    if (!product || product.stock === 0) continue;
    // Product is in stock — notify all waiters
    for (const chatId of chatIds) {
      try {
        await bot.telegram.sendMessage(
          chatId,
          `🔔 *Stok Ada Semula!*\n\n` +
          `✅ *${esc(product.name)}* kini ada stok!\n\n` +
          `💰 Harga: RM${product.price.toFixed(2)}\n📦 Stok: ${product.stock} unit\n\n` +
          `Tekan butang di bawah untuk beli sekarang!`,
          {
            parse_mode: "Markdown",
            ...Markup.inlineKeyboard([
              [Markup.button.callback("🛒 Beli Sekarang", `product_${product.id}`)],
            ]),
          }
        );
      } catch { /* ignore if user blocked bot */ }
    }
    restockWaiters.delete(productId);
    console.log(`[restock] Notified ${chatIds.size} waiter(s) for product #${productId} (${product.name})`);
  }
}

export function startAutoCancel() {
  const intervalMs = 60 * 1000; // check every 1 minute

  const run = async () => {
    try {
      const cutoff = new Date(Date.now() - AUTO_CANCEL_MINUTES * 60 * 1000);

      // Find pending_payment orders older than AUTO_CANCEL_MINUTES
      const expired = await db
        .select()
        .from(ordersTable)
        .where(
          and(
            inArray(ordersTable.status, ["pending_payment"]),
            lt(ordersTable.createdAt, cutoff)
          )
        );

      if (expired.length === 0) return;

      const ids = expired.map((o) => o.id);

      await db
        .update(ordersTable)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(inArray(ordersTable.id, ids));

      console.log(`[auto-cancel] Cancelled ${expired.length} expired order(s): #${ids.join(", #")}`);

      // Notify each customer
      for (const order of expired) {
        try {
          await bot.telegram.sendMessage(
            order.telegramUserId,
            `⏰ *Pesanan Dibatalkan Automatik*\n\n` +
              `Pesanan anda *#${order.id}* (${order.productName}) telah dibatalkan kerana tiada bukti bayaran diterima dalam masa *${AUTO_CANCEL_MINUTES} minit*.\n\n` +
              `Jika anda telah membuat bayaran, sila hubungi admin.\n` +
              `Jika tidak, anda boleh buat pesanan baru bila-bila masa. 😊`,
            { parse_mode: "Markdown" }
          );
        } catch {
          // ignore if user blocked bot
        }
      }

      // Notify admin summary
      if (adminId && expired.length > 0) {
        const lines = expired.map((o) => `• #${o.id} — ${o.productName} (${o.telegramFirstName || o.telegramUserId})`).join("\n");
        try {
          await bot.telegram.sendMessage(
            adminId,
            `⏰ *Auto-Cancel: ${expired.length} Pesanan Tamat Tempoh*\n\n${lines}\n\n_Tiada bukti bayaran dalam ${AUTO_CANCEL_MINUTES} minit._`,
            { parse_mode: "Markdown" }
          );
        } catch {
          // ignore
        }
      }
    } catch (err) {
      console.error("[auto-cancel] Error:", err);
    }
    // Also check restock notifications
    try { await checkRestockNotifications(); } catch { /* ignore */ }
  };

  setInterval(run, intervalMs);
  console.log(`Auto-cancel scheduler started (checks every 1 min, cancels after ${AUTO_CANCEL_MINUTES} min)`);
}

// ─── Helper: send QR photo (supports base64 data URL or https URL) ────────────
async function sendQrPhoto(ctx: any, qrImageUrl: string, caption: string) {
  const url = qrImageUrl.trim();
  if (url.startsWith("data:image/")) {
    // Base64 data URL — convert to Buffer (works on Railway without Replit server)
    const base64Data = url.split(",")[1];
    if (base64Data) {
      const buf = Buffer.from(base64Data, "base64");
      await ctx.replyWithPhoto({ source: buf }, { caption, parse_mode: "Markdown" });
      return;
    }
  }
  // Absolute or relative URL
  let qrUrl = url;
  if (qrUrl.startsWith("/api/uploads/")) {
    qrUrl = `https://${publicDomain}${qrUrl}`;
  }
  await ctx.replyWithPhoto({ url: qrUrl }, { caption, parse_mode: "Markdown" });
}

// ─── Brand logo → PNG filename mapping ───────────────────────────────────────
const ADMIN_PANEL_URL = (process.env.ADMIN_PANEL_URL || "https://exmedia.replit.app").replace(/\/$/, "");

function getBrandLogoUrl(categoryName: string, logoUrl?: string | null): string | undefined {
  if (logoUrl) {
    // If stored as absolute path like /logos/chatgpt.png or .svg
    if (logoUrl.startsWith("/logos/")) {
      const pngPath = logoUrl.replace(/\.svg$/, ".png");
      return `${ADMIN_PANEL_URL}${pngPath}`;
    }
    // If stored as data URL — try to match name
  }
  // Fallback: match from category name
  const n = categoryName.toLowerCase();
  const map: Record<string, string> = {
    chatgpt: "chatgpt", openai: "chatgpt",
    gemini: "gemini", google: "google",
    claude: "claude", anthropic: "claude",
    grok: "grok",
    canva: "canva",
    linkedin: "linkedin",
    netflix: "netflix",
    spotify: "spotify",
    youtube: "youtube",
    discord: "discord",
    tiktok: "tiktok",
    instagram: "instagram",
    facebook: "facebook",
    github: "github",
    notion: "notion",
    figma: "figma",
    zoom: "zoom",
    microsoft: "microsoft",
    adobe: "adobe",
    slack: "slack",
    midjourney: "midjourney",
    copilot: "copilot",
    dropbox: "dropbox",
    grammarly: "grammarly",
    duolingo: "duolingo",
    nordvpn: "nordvpn",
    expressvpn: "expressvpn",
    skillshare: "skillshare",
    perplexity: "perplexity",
    apple: "apple",
  };
  for (const [keyword, file] of Object.entries(map)) {
    if (n.includes(keyword)) return `${ADMIN_PANEL_URL}/logos/${file}.png`;
  }
  return undefined;
}

// ─── Inline query — show products with brand logo thumbnails ─────────────────
let botUsername = "";

bot.on("inline_query", async (ctx) => {
  try {
    const query = ctx.inlineQuery.query?.toLowerCase() || "";

    // Fetch active categories & products
    const [categories, products] = await Promise.all([
      db.select().from(categoriesTable).where(eq(categoriesTable.isActive, true)),
      db.select().from(productsTable).where(eq(productsTable.isActive, true)),
    ]);

    const catMap = new Map(categories.map((c) => [c.id, c]));

    // Filter by query
    const filtered = products.filter((p) => {
      if (!query) return true;
      return (
        p.name.toLowerCase().includes(query) ||
        (p.description?.toLowerCase().includes(query) ?? false)
      );
    });

    const results: any[] = filtered.slice(0, 20).map((p) => {
      const cat = p.categoryId ? catMap.get(p.categoryId) : undefined;
      const thumbUrl = cat ? getBrandLogoUrl(cat.name, cat.logoUrl) : undefined;
      const stock = p.stock ?? -1;
      const stockText = stock === 0 ? " ❌ Habis" : stock > 0 ? ` (Stok: ${stock})` : "";
      const deepLink = `https://t.me/${botUsername}?start=product_${p.id}`;

      return {
        type: "article",
        id: p.id.toString(),
        title: p.name,
        description: `RM${p.price}${stockText}${cat ? ` • ${cat.emoji} ${cat.name}` : ""}`,
        ...(thumbUrl ? { thumb_url: thumbUrl, thumb_width: 64, thumb_height: 64 } : {}),
        input_message_content: {
          message_text:
            `🛍️ *${p.name}*\n` +
            `💰 *RM ${p.price}*${stockText ? `\n📦 ${stockText.trim()}` : ""}\n` +
            (p.description ? `\n${p.description}\n` : "") +
            `\n[Tekan butang di bawah untuk beli]`,
          parse_mode: "Markdown",
        },
        reply_markup: {
          inline_keyboard: [[{ text: "🛒 Beli Sekarang", url: deepLink }]],
        },
      };
    });

    if (results.length === 0) {
      await ctx.answerInlineQuery([], {
        cache_time: 10,
        is_personal: false,
        switch_pm_text: "🛍️ Lihat Semua Produk",
        switch_pm_parameter: "start",
      } as any);
      return;
    }

    await ctx.answerInlineQuery(results, {
      cache_time: 30,
      is_personal: false,
      switch_pm_text: "🛍️ Buka Kedai Penuh",
      switch_pm_parameter: "start",
    } as any);
  } catch (err) {
    console.error("[inline_query] Error:", err);
    await ctx.answerInlineQuery([], { cache_time: 5 } as any);
  }
});

// ─── Start bot ────────────────────────────────────────────────────────────────
export function startBot() {
  bot.catch((err: unknown) => {
    console.error("[bot] Middleware error:", err);
  });

  // dropPendingUpdates: false — supaya notifikasi yang datang masa restart tidak terlepas
  bot.launch({ dropPendingUpdates: false }).then(async () => {
    try {
      const me = await bot.telegram.getMe();
      botUsername = me.username || "";
      console.log(`Bot @${botUsername} started (inline query + PDF support enabled)`);
      // Log admin ID for debugging
      console.log(`Admin ID: ${adminId || "NOT SET — notifications disabled!"}`);
    } catch (err) {
      console.error("[bot] getMe failed:", err);
    }
  }).catch((err: unknown) => {
    console.error("[bot] Polling stopped with error:", err);
    console.error("[bot] Exiting so Railway can restart...");
    process.exit(1);
  });

  console.log("Telegram bot started (polling)");

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}
