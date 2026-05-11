import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Lang = "bm" | "en";

const translations = {
  bm: {
    // Nav
    nav_dashboard: "Papan Pemuka",
    nav_categories: "Kategori",
    nav_products: "Produk",
    nav_orders: "Pesanan",
    nav_broadcast: "Siaran",
    nav_settings: "Tetapan",
    nav_menu: "Menu",
    nav_admin: "Administrator",
    nav_system: "Sistem Utama",
    nav_brand_sub: "Bot Jualan Digital",

    // Dashboard
    dash_title: "Papan Pemuka",
    dash_revenue: "Jumlah Pendapatan",
    dash_profit_daily: "Keuntungan Hari Ini",
    dash_profit_monthly: "Keuntungan Bulan Ini",
    dash_confirmed: "Pesanan Berjaya",
    dash_pending: "Menunggu Tindakan",
    dash_total: "Jumlah Pesanan",
    dash_chart_title: "Pendapatan 7 Hari",
    dash_chart_sub: "Aliran jualan harian",
    dash_activity_title: "Aktiviti Terkini",
    dash_activity_all: "Lihat semua",
    dash_activity_empty: "Tiada pesanan setakat ini",
    dash_top_title: "Produk Terlaris",
    dash_top_sub: "Berdasarkan pesanan berjaya",
    dash_top_empty: "Belum ada jualan lagi",
    dash_top_manage: "Urus produk",
    dash_top_sold: "terjual",
    dash_pending_alert: "pesanan perlu tindakan",
    dash_trend: "Trend",

    // Status
    status_pending_payment: "Menunggu Bayaran",
    status_payment_uploaded: "Bukti Dihantar",
    status_confirmed: "Disahkan",
    status_rejected: "Ditolak",
    status_cancelled: "⏰ Auto-Batal",
    status_completed: "Selesai",

    // Orders page
    orders_title: "Pesanan",
    orders_subtitle: "Urus semua pesanan dari pelanggan Telegram",
    orders_search: "Cari produk atau pelanggan...",
    orders_all: "Semua",
    orders_pending: "Tertangguh",
    orders_confirmed: "Disahkan",
    orders_rejected: "Ditolak",
    orders_empty: "Tiada pesanan dijumpai",
    orders_empty_sub: "Tiada pesanan yang sepadan dengan penapis anda",
    orders_order: "Pesanan",
    orders_customer: "Pelanggan",
    orders_product: "Produk",
    orders_amount: "Amaun",
    orders_status: "Status",
    orders_date: "Tarikh",
    orders_manage: "Urus",
    orders_manage_title: "Maklumat Pesanan",
    orders_payment_method: "Kaedah Bayaran:",
    orders_proof: "Bukti Pembayaran",
    orders_proof_received: "Bukti bayaran TnG diterima",
    orders_proof_sent: "Foto telah dihantar ke Telegram admin anda untuk semakan. Sahkan atau tolak melalui bot Telegram atau butang di bawah.",
    orders_proof_none: "Belum ada bukti bayaran",
    orders_delivery_msg: "Mesej Penghantaran Produk",
    orders_delivery_placeholder: "Masukkan detail produk seperti akaun/password di sini untuk dihantar kepada pelanggan...",
    orders_delivery_hint: "Mesej ini akan dihantar terus ke Telegram pelanggan.",
    orders_confirm: "Sahkan & Hantar",
    orders_reject: "Tolak Pesanan",
    orders_close: "Tutup",
    orders_confirm_dialog: "Adakah anda pasti mahu menolak pesanan ini?",
    orders_view_proof: "Lihat Bukti",
    orders_loading: "Memuatkan pesanan...",
    orders_count: "pesanan",

    // Products page
    products_title: "Produk",
    products_subtitle: "Urus katalog produk digital anda",
    products_add: "Tambah Produk",
    products_edit: "Edit Produk",
    products_delete: "Padam",
    products_empty: "Tiada produk lagi",
    products_empty_sub: "Tambah produk pertama anda untuk mula menjual",
    products_name: "Nama Produk",
    products_desc: "Penerangan",
    products_price: "Harga (RM)",
    products_delivery: "Kandungan Penghantaran",
    products_delivery_hint: "Ini akan dihantar kepada pelanggan selepas bayaran disahkan.",
    products_install: "Panduan Pemasangan (Optional)",
    products_install_hint: "Arahan langkah demi langkah untuk pelanggan.",
    products_active: "Aktif",
    products_stock: "Stok (-1 = Unlimited)",
    products_valid: "Tempoh Sah",
    products_warranty: "Waranti",
    products_category: "Kategori",
    products_category_none: "Tiada Kategori",
    products_pool: "Akaun Pool",
    products_pool_sub: "Senarai akaun / produk untuk dihantar satu per satu kepada pelanggan",
    products_pool_add: "Tambah Akaun/Produk",
    products_pool_empty: "Tiada akaun dalam pool",
    products_pool_hint: "Pisahkan setiap akaun dengan baris kosong (blank line)",
    products_pool_label: "Akaun/Produk Baru (satu per satu, pisah dengan baris kosong)",
    products_pool_count: "akaun tersedia",
    products_pool_delivered: "Telah dihantar",
    products_save: "Simpan Produk",
    products_delete_confirm: "Padam produk ini secara kekal?",
    products_cancel: "Batal",
    products_stock_unlimited: "Unlimited",
    products_stock_label: "unit",
    products_active_label: "Aktif",
    products_inactive_label: "Tidak Aktif",

    // Categories page
    categories_title: "Kategori",
    categories_subtitle: "Urus kategori produk untuk bot Telegram anda",
    categories_add: "Tambah Kategori",
    categories_edit: "Edit Kategori",
    categories_empty: "Tiada kategori lagi",
    categories_empty_sub: "Tambah kategori untuk mengatur produk anda",
    categories_name: "Nama Kategori",
    categories_emoji: "Emoji",
    categories_active: "Aktif",
    categories_save: "Simpan",
    categories_delete: "Padam",
    categories_delete_confirm: "Padam kategori ini?",
    categories_cancel: "Batal",
    categories_products: "produk",

    // Broadcast page
    broadcast_title: "Siaran Mesej",
    broadcast_subtitle: "Hantar mesej kepada semua pelanggan",
    broadcast_customers: "Jumlah Pelanggan Unik",
    broadcast_compose: "Tulis Mesej",
    broadcast_placeholder: "Taip mesej siaran anda di sini...\n\nBoleh gunakan Markdown:\n*bold* _italic_ `code`",
    broadcast_hint: "Mesej ini akan dihantar kepada semua pelanggan yang pernah buat pesanan.",
    broadcast_send: "Hantar Siaran",
    broadcast_sending: "Menghantar...",
    broadcast_success: "Siaran Berjaya!",
    broadcast_result: "dihantar,",
    broadcast_result_failed: "gagal daripada",
    broadcast_result_total: "jumlah",
    broadcast_error: "Ralat",
    broadcast_confirm: "Hantar kepada",
    broadcast_confirm2: "pelanggan?",

    // Settings page
    settings_title: "Tetapan",
    settings_subtitle: "Konfigurasi bot Telegram anda",
    settings_store: "Tetapan Kedai",
    settings_open: "Kedai Buka",
    settings_closed: "Kedai Ditutup",
    settings_welcome: "Mesej Alu-aluan",
    settings_welcome_ph: "Selamat datang! Kami menjual akaun premium...",
    settings_closed_msg: "Mesej Kedai Ditutup",
    settings_closed_ph: "Maaf, kedai kami ditutup buat sementara...",
    settings_payment: "Tetapan Bayaran",
    settings_instructions: "Arahan Bayaran",
    settings_instructions_ph: "Sila buat bayaran melalui TnG QR di atas...",
    settings_qr: "Gambar QR TnG",
    settings_qr_change: "Tukar Gambar QR",
    settings_qr_upload: "Muat Naik Gambar QR",
    settings_qr_hint: "Gambar QR ini akan dihantar kepada pelanggan untuk bayaran.",
    settings_save: "Simpan Tetapan",
    settings_saving: "Menyimpan...",
    settings_saved: "Tetapan disimpan!",
    settings_error: "Gagal menyimpan tetapan",
    settings_load_error: "Gagal memuatkan tetapan",

    // Common
    common_save: "Simpan",
    common_cancel: "Batal",
    common_delete: "Padam",
    common_edit: "Edit",
    common_add: "Tambah",
    common_close: "Tutup",
    common_loading: "Memuatkan...",
    common_error: "Ralat",
    common_search: "Cari...",
    common_active: "Aktif",
    common_inactive: "Tidak Aktif",

    // Language
    lang_toggle: "English",
    lang_current: "BM",
  },

  en: {
    // Nav
    nav_dashboard: "Dashboard",
    nav_categories: "Categories",
    nav_products: "Products",
    nav_orders: "Orders",
    nav_broadcast: "Broadcast",
    nav_settings: "Settings",
    nav_menu: "Menu",
    nav_admin: "Administrator",
    nav_system: "Main System",
    nav_brand_sub: "Digital Sales Bot",

    // Dashboard
    dash_title: "Dashboard",
    dash_revenue: "Total Revenue",
    dash_profit_daily: "Today's Profit",
    dash_profit_monthly: "Monthly Profit",
    dash_confirmed: "Successful Orders",
    dash_pending: "Pending Action",
    dash_total: "Total Orders",
    dash_chart_title: "Revenue (7 Days)",
    dash_chart_sub: "Daily sales flow",
    dash_activity_title: "Recent Activity",
    dash_activity_all: "View all",
    dash_activity_empty: "No orders yet",
    dash_top_title: "Top Selling Products",
    dash_top_sub: "Based on confirmed orders",
    dash_top_empty: "No sales yet",
    dash_top_manage: "Manage products",
    dash_top_sold: "sold",
    dash_pending_alert: "orders need action",
    dash_trend: "Trend",

    // Status
    status_pending_payment: "Awaiting Payment",
    status_payment_uploaded: "Proof Submitted",
    status_confirmed: "Confirmed",
    status_rejected: "Rejected",
    status_cancelled: "⏰ Auto-Cancelled",
    status_completed: "Completed",

    // Orders page
    orders_title: "Orders",
    orders_subtitle: "Manage all orders from Telegram customers",
    orders_search: "Search product or customer...",
    orders_all: "All",
    orders_pending: "Pending",
    orders_confirmed: "Confirmed",
    orders_rejected: "Rejected",
    orders_empty: "No orders found",
    orders_empty_sub: "No orders match your filter",
    orders_order: "Order",
    orders_customer: "Customer",
    orders_product: "Product",
    orders_amount: "Amount",
    orders_status: "Status",
    orders_date: "Date",
    orders_manage: "Manage",
    orders_manage_title: "Order Details",
    orders_payment_method: "Payment Method:",
    orders_proof: "Payment Proof",
    orders_proof_received: "TnG payment proof received",
    orders_proof_sent: "Photo has been sent to your Telegram admin for review. Confirm or reject via Telegram bot or buttons below.",
    orders_proof_none: "No payment proof yet",
    orders_delivery_msg: "Product Delivery Message",
    orders_delivery_placeholder: "Enter product details like account/password here to send to customer...",
    orders_delivery_hint: "This message will be sent directly to the customer's Telegram.",
    orders_confirm: "Confirm & Deliver",
    orders_reject: "Reject Order",
    orders_close: "Close",
    orders_confirm_dialog: "Are you sure you want to reject this order?",
    orders_view_proof: "View Proof",
    orders_loading: "Loading orders...",
    orders_count: "orders",

    // Products page
    products_title: "Products",
    products_subtitle: "Manage your digital product catalog",
    products_add: "Add Product",
    products_edit: "Edit Product",
    products_delete: "Delete",
    products_empty: "No products yet",
    products_empty_sub: "Add your first product to start selling",
    products_name: "Product Name",
    products_desc: "Description",
    products_price: "Price (RM)",
    products_delivery: "Delivery Content",
    products_delivery_hint: "This will be sent to the customer after payment is confirmed.",
    products_install: "Installation Guide (Optional)",
    products_install_hint: "Step-by-step instructions for the customer.",
    products_active: "Active",
    products_stock: "Stock (-1 = Unlimited)",
    products_valid: "Validity Period",
    products_warranty: "Warranty",
    products_category: "Category",
    products_category_none: "No Category",
    products_pool: "Pool Accounts",
    products_pool_sub: "List of accounts/products to deliver one-by-one to customers",
    products_pool_add: "Add Account/Product",
    products_pool_empty: "No accounts in pool",
    products_pool_hint: "Separate each account with a blank line",
    products_pool_label: "New Account/Product (one per block, separated by blank line)",
    products_pool_count: "accounts available",
    products_pool_delivered: "Delivered",
    products_save: "Save Product",
    products_delete_confirm: "Permanently delete this product?",
    products_cancel: "Cancel",
    products_stock_unlimited: "Unlimited",
    products_stock_label: "units",
    products_active_label: "Active",
    products_inactive_label: "Inactive",

    // Categories page
    categories_title: "Categories",
    categories_subtitle: "Manage product categories for your Telegram bot",
    categories_add: "Add Category",
    categories_edit: "Edit Category",
    categories_empty: "No categories yet",
    categories_empty_sub: "Add categories to organize your products",
    categories_name: "Category Name",
    categories_emoji: "Emoji",
    categories_active: "Active",
    categories_save: "Save",
    categories_delete: "Delete",
    categories_delete_confirm: "Delete this category?",
    categories_cancel: "Cancel",
    categories_products: "products",

    // Broadcast page
    broadcast_title: "Message Broadcast",
    broadcast_subtitle: "Send messages to all customers",
    broadcast_customers: "Total Unique Customers",
    broadcast_compose: "Compose Message",
    broadcast_placeholder: "Type your broadcast message here...\n\nMarkdown supported:\n*bold* _italic_ `code`",
    broadcast_hint: "This message will be sent to all customers who have ever placed an order.",
    broadcast_send: "Send Broadcast",
    broadcast_sending: "Sending...",
    broadcast_success: "Broadcast Successful!",
    broadcast_result: "sent,",
    broadcast_result_failed: "failed out of",
    broadcast_result_total: "total",
    broadcast_error: "Error",
    broadcast_confirm: "Send to",
    broadcast_confirm2: "customers?",

    // Settings page
    settings_title: "Settings",
    settings_subtitle: "Configure your Telegram bot",
    settings_store: "Store Settings",
    settings_open: "Store Open",
    settings_closed: "Store Closed",
    settings_welcome: "Welcome Message",
    settings_welcome_ph: "Welcome! We sell premium accounts...",
    settings_closed_msg: "Closed Store Message",
    settings_closed_ph: "Sorry, our store is temporarily closed...",
    settings_payment: "Payment Settings",
    settings_instructions: "Payment Instructions",
    settings_instructions_ph: "Please make payment via TnG QR above...",
    settings_qr: "TnG QR Image",
    settings_qr_change: "Change QR Image",
    settings_qr_upload: "Upload QR Image",
    settings_qr_hint: "This QR image will be sent to customers for payment.",
    settings_save: "Save Settings",
    settings_saving: "Saving...",
    settings_saved: "Settings saved!",
    settings_error: "Failed to save settings",
    settings_load_error: "Failed to load settings",

    // Common
    common_save: "Save",
    common_cancel: "Cancel",
    common_delete: "Delete",
    common_edit: "Edit",
    common_add: "Add",
    common_close: "Close",
    common_loading: "Loading...",
    common_error: "Error",
    common_search: "Search...",
    common_active: "Active",
    common_inactive: "Inactive",

    // Language
    lang_toggle: "Bahasa",
    lang_current: "EN",
  },
};

type TranslationKey = keyof typeof translations.bm;

interface LanguageContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey) => string;
  toggleLang: () => void;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem("admin-lang");
    return (saved === "en" || saved === "bm") ? saved : "bm";
  });

  const setLang = (newLang: Lang) => {
    setLangState(newLang);
    localStorage.setItem("admin-lang", newLang);
  };

  const toggleLang = () => setLang(lang === "bm" ? "en" : "bm");

  const t = (key: TranslationKey): string => {
    return translations[lang][key] ?? translations.bm[key] ?? key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, toggleLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
