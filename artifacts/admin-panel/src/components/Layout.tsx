import { ReactNode } from "react";
import { Link, useRoute } from "wouter";
import { LayoutDashboard, Package, ShoppingCart, Settings, Menu, Megaphone, Zap, Layers, Globe } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n";

interface LayoutProps {
  children: ReactNode;
}

function NavLinks({ onClick }: { onClick?: () => void }) {
  const { t } = useLanguage();

  const navItems = [
    { href: "/", label: t("nav_dashboard"), icon: LayoutDashboard, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", glow: "rgba(59,130,246,0.15)" },
    { href: "/categories", label: t("nav_categories"), icon: Layers, color: "text-pink-400", bg: "bg-pink-500/10", border: "border-pink-500/20", glow: "rgba(236,72,153,0.15)" },
    { href: "/products", label: t("nav_products"), icon: Package, color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/20", glow: "rgba(139,92,246,0.15)" },
    { href: "/orders", label: t("nav_orders"), icon: ShoppingCart, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", glow: "rgba(16,185,129,0.15)" },
    { href: "/broadcast", label: t("nav_broadcast"), icon: Megaphone, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", glow: "rgba(245,158,11,0.15)" },
    { href: "/settings", label: t("nav_settings"), icon: Settings, color: "text-slate-400", bg: "bg-slate-500/10", border: "border-slate-500/20", glow: "rgba(100,116,139,0.15)" },
  ];

  return (
    <div className="space-y-1 mt-6">
      {navItems.map((item) => {
        const [isActive] = useRoute(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClick}
            className={`
              flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group
              ${isActive
                ? `${item.bg} ${item.color} font-medium border ${item.border}`
                : "text-muted-foreground hover:bg-white/5 hover:text-white border border-transparent"
              }
            `}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all duration-200 ${isActive ? `${item.bg} border ${item.border}` : "group-hover:bg-white/5"}`}>
              <Icon className={`w-4 h-4 ${isActive ? item.color : ""}`} />
            </div>
            <span className="text-sm">{item.label}</span>
            {isActive && <div className={`ml-auto w-1.5 h-1.5 rounded-full ${item.color.replace("text-", "bg-")}`} />}
          </Link>
        );
      })}
    </div>
  );
}

function Brand() {
  const { t } = useLanguage();
  return (
    <div className="flex items-center gap-3 px-1">
      <div className="relative">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 via-blue-600 to-violet-600 flex items-center justify-center shadow-lg">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-background" />
      </div>
      <div>
        <h1 className="font-display font-bold text-base text-white leading-tight tracking-tight">Affilexmedia</h1>
        <p className="text-[11px] text-muted-foreground leading-none mt-0.5">{t("nav_brand_sub")}</p>
      </div>
    </div>
  );
}

function LangToggle() {
  const { lang, toggleLang, t } = useLanguage();
  return (
    <button
      onClick={toggleLang}
      className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl border border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06] transition-all duration-200 group"
      title={lang === "bm" ? "Switch to English" : "Tukar ke Bahasa Malaysia"}
    >
      <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
        <Globe className="w-4 h-4 text-blue-400" />
      </div>
      <div className="flex-1 min-w-0 text-left">
        <p className="text-xs font-semibold text-white truncate">{t("lang_toggle")}</p>
        <p className="text-[10px] text-muted-foreground">
          {lang === "bm" ? "Bahasa Malaysia" : "English"} → {lang === "bm" ? "English" : "BM"}
        </p>
      </div>
      <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded-md shrink-0">
        {t("lang_current")}
      </span>
    </button>
  );
}

export default function Layout({ children }: LayoutProps) {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row overflow-hidden selection:bg-primary/30">

      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-white/5 bg-background/95 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-display font-bold text-base text-white">Affilexmedia</span>
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-white h-9 w-9">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="bg-card border-r border-white/5 p-5 w-72">
            <div className="mb-6"><Brand /></div>
            <NavLinks />
            <div className="mt-4"><LangToggle /></div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-white/5 bg-[#0d0d10] p-5 relative z-10 shrink-0">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-950/20 via-transparent to-violet-950/10 pointer-events-none" />

        <Brand />

        <div className="mt-6 mb-2 px-3">
          <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">{t("nav_menu")}</p>
        </div>

        <nav className="flex-1">
          <NavLinks />
        </nav>

        <div className="mt-auto pt-4 border-t border-white/5 space-y-2">
          {/* Language Toggle */}
          <LangToggle />

          {/* Admin badge */}
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/3 border border-white/5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-white">AD</span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">{t("nav_admin")}</p>
              <p className="text-[11px] text-muted-foreground truncate">{t("nav_system")}</p>
            </div>
            <div className="ml-auto w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 relative overflow-y-auto bg-[#09090b]">
        <div className="absolute top-0 right-0 w-[600px] h-[400px] bg-blue-600/3 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[300px] bg-violet-600/3 blur-[100px] rounded-full pointer-events-none" />
        <div className="p-5 md:p-8 max-w-7xl mx-auto relative z-10 min-h-full">
          {children}
        </div>
      </main>
    </div>
  );
}
