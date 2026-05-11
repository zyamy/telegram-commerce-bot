import { useOrders } from "@/hooks/use-orders";
import { useProducts } from "@/hooks/use-products";
import { Package, ShoppingCart, TrendingUp, Clock, ArrowUpRight, CheckCircle2, ChevronRight, Trophy, Banknote, CalendarDays } from "lucide-react";
import { motion } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";
import { format, subDays, parseISO, startOfMonth, startOfDay } from "date-fns";
import { ms } from "date-fns/locale";
import { Link } from "wouter";
import { useLanguage } from "@/lib/i18n";

export default function Dashboard() {
  const { t } = useLanguage();
  const { data: rawOrders = [], isLoading } = useOrders();
  const { data: rawProducts = [] } = useProducts();

  // Defensive: ensure data is always an array even if API returns non-array
  const orders = Array.isArray(rawOrders) ? rawOrders : [];
  const products = Array.isArray(rawProducts) ? rawProducts : [];

  // Build cost price lookup: productId -> costPrice
  const costPriceMap = (products as any[]).reduce((acc, p) => {
    acc[p.id] = p.costPrice ?? 0;
    return acc;
  }, {} as Record<number, number>);

  const statusLabel: Record<string, { label: string; color: string }> = {
    pending_payment: { label: t("status_pending_payment"), color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
    payment_uploaded: { label: t("status_payment_uploaded"), color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
    confirmed: { label: t("status_confirmed"), color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
    rejected: { label: t("status_rejected"), color: "text-red-400 bg-red-500/10 border-red-500/20" },
  };

  const confirmedOrders = orders.filter(o => o.status === "confirmed");
  const totalOrders = orders.length;
  const pendingOrders = orders.filter(o => o.status === "payment_uploaded" || o.status === "pending_payment").length;
  const totalRevenue = confirmedOrders.reduce((sum, o) => sum + (o.productPrice || 0), 0);

  // Profit calculation helper
  const calcProfit = (orderList: typeof orders) =>
    orderList.reduce((sum, o) => {
      const cost = (costPriceMap[(o as any).productId] ?? 0) * ((o as any).quantity || 1);
      return sum + ((o.productPrice || 0) - cost);
    }, 0);

  // Daily profit (today)
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const todayConfirmed = confirmedOrders.filter(o => format(parseISO(o.createdAt), "yyyy-MM-dd") === todayStr);
  const dailyProfit = calcProfit(todayConfirmed);

  // Monthly profit (this month)
  const monthStart = startOfMonth(new Date());
  const monthConfirmed = confirmedOrders.filter(o => parseISO(o.createdAt) >= monthStart);
  const monthlyProfit = calcProfit(monthConfirmed);

  const topProducts = Object.values(
    confirmedOrders
      .reduce((acc, o) => {
        const key = o.productName;
        if (!acc[key]) acc[key] = { name: key, count: 0, revenue: 0 };
        acc[key].count += 1;
        acc[key].revenue += Number(o.productPrice) || 0;
        return acc;
      }, {} as Record<string, { name: string; count: number; revenue: number }>)
  ).sort((a, b) => b.count - a.count).slice(0, 5);

  const maxCount = topProducts[0]?.count || 1;

  const chartData = Array.from({ length: 7 }).map((_, i) => {
    const date = subDays(new Date(), 6 - i);
    const dateStr = format(date, "yyyy-MM-dd");
    const dayOrders = confirmedOrders.filter(o => format(parseISO(o.createdAt), "yyyy-MM-dd") === dateStr);
    const revenue = dayOrders.reduce((sum, o) => sum + (o.productPrice || 0), 0);
    const profit = calcProfit(dayOrders);
    return {
      name: format(date, "dd MMM", { locale: ms }),
      total: revenue,
      untung: profit,
    };
  });

  const stats = [
    {
      label: t("dash_revenue"),
      value: `RM ${totalRevenue.toFixed(2)}`,
      icon: TrendingUp,
      accent: "from-emerald-500 to-teal-500",
      glow: "rgba(16,185,129,0.12)",
      border: "border-emerald-500/15",
      iconBg: "bg-emerald-500/10 border-emerald-500/20",
      iconColor: "text-emerald-400",
      valueColor: "text-emerald-400",
    },
    {
      label: t("dash_profit_monthly"),
      value: `RM ${monthlyProfit.toFixed(2)}`,
      icon: CalendarDays,
      accent: "from-pink-500 to-rose-500",
      glow: "rgba(236,72,153,0.12)",
      border: "border-pink-500/15",
      iconBg: "bg-pink-500/10 border-pink-500/20",
      iconColor: "text-pink-400",
      valueColor: monthlyProfit >= 0 ? "text-pink-400" : "text-red-400",
    },
    {
      label: t("dash_profit_daily"),
      value: `RM ${dailyProfit.toFixed(2)}`,
      icon: Banknote,
      accent: "from-amber-500 to-yellow-500",
      glow: "rgba(251,191,36,0.12)",
      border: "border-amber-500/15",
      iconBg: "bg-amber-500/10 border-amber-500/20",
      iconColor: "text-amber-400",
      valueColor: dailyProfit >= 0 ? "text-amber-400" : "text-red-400",
    },
    {
      label: t("dash_confirmed"),
      value: confirmedOrders.length,
      icon: CheckCircle2,
      accent: "from-blue-500 to-cyan-500",
      glow: "rgba(59,130,246,0.12)",
      border: "border-blue-500/15",
      iconBg: "bg-blue-500/10 border-blue-500/20",
      iconColor: "text-blue-400",
      valueColor: "text-white",
    },
    {
      label: t("dash_pending"),
      value: pendingOrders,
      icon: Clock,
      accent: "from-orange-500 to-red-500",
      glow: "rgba(245,158,11,0.12)",
      border: "border-orange-500/15",
      iconBg: "bg-orange-500/10 border-orange-500/20",
      iconColor: "text-orange-400",
      valueColor: pendingOrders > 0 ? "text-orange-400" : "text-white",
    },
    {
      label: t("dash_total"),
      value: totalOrders,
      icon: ShoppingCart,
      accent: "from-violet-500 to-purple-500",
      glow: "rgba(139,92,246,0.12)",
      border: "border-violet-500/15",
      iconBg: "bg-violet-500/10 border-violet-500/20",
      iconColor: "text-violet-400",
      valueColor: "text-white",
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-10 h-10 border-[3px] border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-white tracking-tight">{t("dash_title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {format(new Date(), "EEEE, dd MMMM yyyy", { locale: ms })}
          </p>
        </div>
        {pendingOrders > 0 && (
          <Link href="/orders">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium px-3 py-2 rounded-xl cursor-pointer hover:bg-amber-500/15 transition-colors"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              {pendingOrders} {t("dash_pending_alert")}
              <ChevronRight className="w-3.5 h-3.5" />
            </motion.div>
          </Link>
        )}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.07 }}
              className={`relative rounded-2xl border ${stat.border} bg-white/[0.03] p-4 lg:p-5 overflow-hidden group hover:bg-white/[0.05] transition-all duration-300`}
              style={{ boxShadow: `inset 0 0 30px ${stat.glow}` }}
            >
              <div className={`w-9 h-9 rounded-xl ${stat.iconBg} border flex items-center justify-center mb-3`}>
                <Icon className={`w-4.5 h-4.5 ${stat.iconColor}`} style={{ width: 18, height: 18 }} />
              </div>
              <p className="text-xs text-muted-foreground mb-1.5 font-medium">{stat.label}</p>
              <p className={`text-xl lg:text-2xl font-display font-bold ${stat.valueColor} leading-none tracking-tight`}>
                {stat.value}
              </p>
            </motion.div>
          );
        })}
      </div>

      {/* Chart + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Revenue Chart */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.35 }}
          className="lg:col-span-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5"
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-semibold text-white">{t("dash_chart_title")}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{t("dash_chart_sub")}</p>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-medium bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1.5 rounded-lg">
              <ArrowUpRight className="w-3.5 h-3.5" />
              {t("dash_trend")}
            </div>
          </div>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} dy={8} />
                <YAxis stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `RM${v}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#111113", borderColor: "rgba(255,255,255,0.08)", borderRadius: 12, color: "white", fontSize: 12, padding: "8px 14px" }}
                  formatter={(v: number, name: string) => [`RM ${v.toFixed(2)}`, name === "total" ? t("dash_revenue") : t("dash_profit_daily")]}
                  cursor={{ stroke: "rgba(255,255,255,0.08)", strokeWidth: 1 }}
                />
                <Area type="monotone" dataKey="total" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#revenueGrad)" activeDot={{ r: 4, strokeWidth: 0, fill: "#10b981" }} />
                <Area type="monotone" dataKey="untung" stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 2" fillOpacity={1} fill="url(#profitGrad)" activeDot={{ r: 4, strokeWidth: 0, fill: "#f59e0b" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-emerald-400 rounded" />
              <span className="text-[11px] text-muted-foreground">{t("dash_revenue")}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-amber-400 rounded border-dashed" style={{ borderTop: "2px dashed #f59e0b", background: "none" }} />
              <span className="text-[11px] text-muted-foreground">{t("dash_profit_daily")}</span>
            </div>
          </div>
        </motion.div>

        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.45 }}
          className="lg:col-span-2 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 flex flex-col"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">{t("dash_activity_title")}</h3>
            <Link href="/orders">
              <span className="text-xs text-blue-400 hover:text-blue-300 transition-colors cursor-pointer">{t("dash_activity_all")}</span>
            </Link>
          </div>
          <div className="space-y-2 flex-1 overflow-y-auto">
            {orders.slice(0, 6).map((order) => {
              const st = statusLabel[order.status] || { label: order.status, color: "text-muted-foreground bg-white/5 border-white/10" };
              return (
                <div key={order.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-colors group">
                  <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center shrink-0 text-xs font-bold text-muted-foreground">
                    #{order.id}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate leading-tight">{order.productName}</p>
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                      @{order.telegramUsername || order.telegramFirstName || order.telegramUserId}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-white">RM {order.productPrice}</p>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${st.color}`}>
                      {st.label}
                    </span>
                  </div>
                </div>
              );
            })}
            {orders.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full py-8 text-muted-foreground">
                <Package className="w-10 h-10 mb-2 opacity-15" />
                <p className="text-xs">{t("dash_activity_empty")}</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Top Selling Products */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.55 }}
        className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5"
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Trophy className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">{t("dash_top_title")}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{t("dash_top_sub")}</p>
            </div>
          </div>
          <Link href="/products">
            <span className="text-xs text-blue-400 hover:text-blue-300 transition-colors cursor-pointer">{t("dash_top_manage")}</span>
          </Link>
        </div>

        {topProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <Trophy className="w-10 h-10 mb-2 opacity-15" />
            <p className="text-xs">{t("dash_top_empty")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {topProducts.map((product, i) => {
              const medals = ["🥇", "🥈", "🥉"];
              const barColors = [
                "bg-amber-400",
                "bg-slate-400",
                "bg-orange-600",
                "bg-blue-400",
                "bg-violet-400",
              ];
              const glowColors = [
                "rgba(251,191,36,0.15)",
                "rgba(148,163,184,0.1)",
                "rgba(234,88,12,0.1)",
                "rgba(96,165,250,0.1)",
                "rgba(167,139,250,0.1)",
              ];
              const pct = Math.round((product.count / maxCount) * 100);

              return (
                <motion.div
                  key={product.name}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.55 + i * 0.07 }}
                  className="flex items-center gap-4 p-3 rounded-xl border border-white/[0.05] hover:bg-white/[0.03] transition-colors"
                  style={{ boxShadow: `inset 0 0 20px ${glowColors[i]}` }}
                >
                  <div className="w-8 h-8 flex items-center justify-center shrink-0">
                    {i < 3 ? (
                      <span className="text-xl leading-none">{medals[i]}</span>
                    ) : (
                      <span className="text-sm font-bold text-muted-foreground">#{i + 1}</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs font-semibold text-white truncate pr-2">{product.name}</p>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-bold text-white bg-white/8 border border-white/10 px-2 py-0.5 rounded-full">
                          {product.count} {t("dash_top_sold")}
                        </span>
                        <span className="text-[10px] font-medium text-emerald-400">
                          RM {product.revenue.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${barColors[i]}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, delay: 0.6 + i * 0.07, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}
