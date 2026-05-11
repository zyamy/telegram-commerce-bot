import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit2, Trash2, Layers } from "lucide-react";
import { motion } from "framer-motion";
import { useLanguage } from "@/lib/i18n";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  siGooglegemini, siAnthropic, siX, siNetflix, siSpotify, siYoutube,
  siDiscord, siTiktok, siInstagram, siFacebook, siGithub, siNotion,
  siFigma, siZoom, siGoogle, siApple, siPerplexity, siDropbox,
  siGrammarly, siDuolingo, siNordvpn, siExpressvpn, siSkillshare,
} from "simple-icons";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";

interface Category {
  id: number;
  name: string;
  emoji: string;
  logoUrl?: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

// ─── SVG data URL builder ────────────────────────────────────────────────────
function svgUrl(path: string, fillColor: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#${fillColor}" d="${path}"/></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

// Base path for local public assets
const B = import.meta.env.BASE_URL.replace(/\/$/, "");
function localLogo(name: string) { return `${B}/logos/${name}.svg`; }

// ─── Brand logos list ────────────────────────────────────────────────────────
const BRAND_LOGOS = [
  // ── AI / Productivity ──
  { name: "ChatGPT",     url: localLogo("chatgpt"),                        emoji: "🤖",  bg: "#10A37F" },
  { name: "Gemini",      url: svgUrl(siGooglegemini.path, "8E75B2"),       emoji: "🌟",  bg: "#8E75B2" },
  { name: "Claude",      url: svgUrl(siAnthropic.path, "D4693A"),          emoji: "🧠",  bg: "#D4693A" },
  { name: "Grok / X",   url: svgUrl(siX.path, "ffffff"),                  emoji: "⚡",  bg: "#1a1a1a" },
  { name: "Canva",       url: localLogo("canva"),                          emoji: "🎨",  bg: "#00C4CC" },
  { name: "Copilot",     url: localLogo("copilot"),                        emoji: "✈️",  bg: "#258FFA" },
  { name: "Midjourney",  url: localLogo("midjourney"),                     emoji: "🖼️",  bg: "#2c2c2c" },
  { name: "Perplexity",  url: svgUrl(siPerplexity.path, "1FB8CD"),         emoji: "🔎",  bg: "#1FB8CD" },
  { name: "Grammarly",   url: svgUrl(siGrammarly.path, "15C39A"),          emoji: "✏️",  bg: "#15C39A" },
  // ── Social / Video ──
  { name: "YouTube",     url: svgUrl(siYoutube.path, "FF0000"),            emoji: "📺",  bg: "#FF0000" },
  { name: "TikTok",      url: svgUrl(siTiktok.path, "ffffff"),             emoji: "📱",  bg: "#1a1a1a" },
  { name: "Instagram",   url: svgUrl(siInstagram.path, "FF0069"),          emoji: "📸",  bg: "#E4405F" },
  { name: "Facebook",    url: svgUrl(siFacebook.path, "0866FF"),           emoji: "👤",  bg: "#1877F2" },
  { name: "LinkedIn",    url: localLogo("linkedin"),                       emoji: "💼",  bg: "#0A66C2" },
  { name: "Discord",     url: svgUrl(siDiscord.path, "5865F2"),            emoji: "💬",  bg: "#5865F2" },
  // ── Streaming / Music ──
  { name: "Netflix",     url: svgUrl(siNetflix.path, "E50914"),            emoji: "🎬",  bg: "#E50914" },
  { name: "Spotify",     url: svgUrl(siSpotify.path, "1ED760"),            emoji: "🎵",  bg: "#1DB954" },
  // ── Business / Tools ──
  { name: "Microsoft",   url: localLogo("microsoft"),                      emoji: "🖥️",  bg: "#F25022" },
  { name: "Adobe",       url: localLogo("adobe"),                          emoji: "🅰️",  bg: "#FF0000" },
  { name: "Slack",       url: localLogo("slack"),                          emoji: "💬",  bg: "#4A154B" },
  { name: "Figma",       url: svgUrl(siFigma.path, "F24E1E"),              emoji: "🎨",  bg: "#F24E1E" },
  { name: "Notion",      url: svgUrl(siNotion.path, "ffffff"),             emoji: "📝",  bg: "#1a1a1a" },
  { name: "Zoom",        url: svgUrl(siZoom.path, "2D8CFF"),               emoji: "📹",  bg: "#2D8CFF" },
  { name: "Dropbox",     url: svgUrl(siDropbox.path, "0061FF"),            emoji: "📁",  bg: "#0061FF" },
  // ── Tech ──
  { name: "Google",      url: svgUrl(siGoogle.path, "4285F4"),             emoji: "🔍",  bg: "#4285F4" },
  { name: "Apple",       url: svgUrl(siApple.path, "ffffff"),              emoji: "🍎",  bg: "#1a1a1a" },
  { name: "GitHub",      url: svgUrl(siGithub.path, "ffffff"),             emoji: "💻",  bg: "#1a1a1a" },
  // ── VPN / Security ──
  { name: "NordVPN",     url: svgUrl(siNordvpn.path, "4687FF"),            emoji: "🔒",  bg: "#4687FF" },
  { name: "ExpressVPN",  url: svgUrl(siExpressvpn.path, "DA3940"),         emoji: "🔐",  bg: "#DA3940" },
  // ── Education ──
  { name: "Duolingo",    url: svgUrl(siDuolingo.path, "58CC02"),           emoji: "🦜",  bg: "#58CC02" },
  { name: "Skillshare",  url: svgUrl(siSkillshare.path, "00FF84"),         emoji: "📚",  bg: "#00FF84" },
];

const FALLBACK_EMOJIS = ["📦","🤖","🎬","🎵","🎮","📱","💼","🔥","⭐","🌟","💎","🛡️","🎓","🏆","💡","🚀","🎯","💰","🔑","✨"];

const schema = z.object({
  name: z.string().min(2, "Nama mesti sekurang-kurangnya 2 aksara"),
  emoji: z.string().min(1, "Pilih emoji atau logo"),
  logoUrl: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
});
type FormValues = z.infer<typeof schema>;

function useCategories() {
  return useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await fetch("/api/categories");
      if (!res.ok) throw new Error("Failed to fetch categories");
      return res.json();
    },
  });
}

function resolveUrl(url: string): string {
  if (url.startsWith("/logos/")) {
    return `${B}/logos/${url.replace("/logos/", "")}`;
  }
  return url;
}

function CategoryIcon({ logoUrl, emoji, size = "md" }: { logoUrl?: string | null; emoji: string; size?: "sm" | "md" | "lg" }) {
  const dim = size === "lg" ? "w-12 h-12" : size === "sm" ? "w-8 h-8" : "w-10 h-10";
  const txtSize = size === "lg" ? "text-4xl" : size === "sm" ? "text-xl" : "text-3xl";
  const [failed, setFailed] = useState(false);

  if (logoUrl && !failed) {
    return (
      <div className={`${dim} flex items-center justify-center rounded-xl bg-white/5 border border-white/10 overflow-hidden`}>
        <img src={resolveUrl(logoUrl)} alt="" className="w-[70%] h-[70%] object-contain" onError={() => setFailed(true)} />
      </div>
    );
  }
  return <span className={txtSize}>{emoji}</span>;
}

export default function Categories() {
  const { t, lang } = useLanguage();
  const { data: categories = [], isLoading } = useCategories();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [logoTab, setLogoTab] = useState<"brand" | "emoji">("brand");
  const [emojiInput, setEmojiInput] = useState("");

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", emoji: "📦", logoUrl: null, isActive: true, sortOrder: 0 },
  });

  const createMut = useMutation({
    mutationFn: async (data: FormValues) => {
      const res = await fetch("/api/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Gagal menambah kategori"); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["categories"] }); setIsDialogOpen(false); toast({ title: "✅ Kategori berjaya ditambah" }); },
    onError: (e: Error) => toast({ variant: "destructive", title: "❌ Ralat", description: e.message }),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<FormValues> }) => {
      const res = await fetch(`/api/categories/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Gagal mengemaskini"); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["categories"] }); setIsDialogOpen(false); toast({ title: "✅ Kategori dikemas kini" }); },
    onError: (e: Error) => toast({ variant: "destructive", title: "❌ Ralat", description: e.message }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => { await fetch(`/api/categories/${id}`, { method: "DELETE" }); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["categories"] }); toast({ title: "🗑️ Kategori dipadam" }); },
  });

  const openCreate = () => {
    setEditing(null); setLogoTab("brand"); setEmojiInput("");
    form.reset({ name: "", emoji: "📦", logoUrl: null, isActive: true, sortOrder: 0 });
    setIsDialogOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditing(cat);
    setLogoTab(cat.logoUrl ? "brand" : "emoji");
    setEmojiInput(cat.emoji);
    form.reset({ name: cat.name, emoji: cat.emoji, logoUrl: cat.logoUrl ?? null, isActive: cat.isActive, sortOrder: cat.sortOrder });
    setIsDialogOpen(true);
  };

  const onSubmit = (data: FormValues) => {
    if (editing) updateMut.mutate({ id: editing.id, data });
    else createMut.mutate(data);
  };

  const currentEmoji = form.watch("emoji");
  const currentLogoUrl = form.watch("logoUrl");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-10 h-10 border-[3px] border-violet-500/20 border-t-violet-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-white tracking-tight">{t("categories_title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("categories_subtitle")}</p>
        </div>
        <Button onClick={openCreate} className="bg-violet-600 hover:bg-violet-500 text-white shadow-lg gap-2">
          <Plus className="w-4 h-4" /> {t("categories_add")}
        </Button>
      </div>

      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-sm text-blue-300">
        <p className="font-medium mb-1">💡 Cara penggunaan:</p>
        <p className="text-blue-300/80">Apabila ada kategori aktif, bot akan tunjuk kategori dahulu → customer pilih → baru nampak produk. Logo jenama hanya kelihatan di admin panel — bot Telegram guna emoji.</p>
      </div>

      {/* Categories grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((cat, idx) => (
          <motion.div
            key={cat.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: idx * 0.05 }}
            className="glass-panel rounded-2xl p-5 group flex flex-col gap-3"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <CategoryIcon logoUrl={cat.logoUrl} emoji={cat.emoji} size="md" />
                <div>
                  <h3 className="font-bold text-white text-lg leading-tight">{cat.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Urutan: {cat.sortOrder}</p>
                </div>
              </div>
              <Badge variant={cat.isActive ? "default" : "secondary"} className={cat.isActive ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : ""}>
                {cat.isActive ? "Aktif" : "Tidak Aktif"}
              </Badge>
            </div>
            <div className="flex gap-2 pt-2 border-t border-white/5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
              <Button variant="outline" size="sm" onClick={() => openEdit(cat)} className="flex-1 border-white/10 hover:bg-white/5 gap-1.5">
                <Edit2 className="w-3.5 h-3.5" /> Edit
              </Button>
              <Button variant="destructive" size="sm" onClick={() => { if (confirm(`Padam kategori "${cat.name}"?`)) deleteMut.mutate(cat.id); }} className="bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </motion.div>
        ))}
        {categories.length === 0 && (
          <div className="col-span-full py-20 flex flex-col items-center justify-center text-muted-foreground glass-panel rounded-2xl border-dashed">
            <Layers className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-lg">Tiada kategori lagi.</p>
          </div>
        )}
      </div>

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[520px] bg-card/95 backdrop-blur-xl border-white/10 text-white max-h-[90vh] flex flex-col p-0 gap-0">
          <div className="px-6 pt-6 pb-4 border-b border-white/10 shrink-0">
            <DialogHeader>
              <DialogTitle className="text-xl font-display">{editing ? "Edit Kategori" : "Tambah Kategori Baru"}</DialogTitle>
              <DialogDescription className="text-muted-foreground">Pilih logo jenama atau emoji, kemudian isi nama kategori.</DialogDescription>
            </DialogHeader>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
              <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">

                {/* Tab switcher */}
                <div className="flex bg-background/50 rounded-xl p-1 border border-white/10">
                  <button type="button" onClick={() => setLogoTab("brand")}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${logoTab === "brand" ? "bg-violet-600 text-white shadow" : "text-muted-foreground hover:text-white"}`}>
                    🏷️ Logo Jenama
                  </button>
                  <button type="button" onClick={() => setLogoTab("emoji")}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${logoTab === "emoji" ? "bg-violet-600 text-white shadow" : "text-muted-foreground hover:text-white"}`}>
                    😀 Emoji
                  </button>
                </div>

                {/* Brand Logo Tab */}
                {logoTab === "brand" && (
                  <FormField control={form.control} name="logoUrl" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-300 text-xs uppercase tracking-wider">Pilih Logo Jenama</FormLabel>
                      <div className="grid grid-cols-4 gap-2">
                        {BRAND_LOGOS.map((brand) => {
                          const isSelected = field.value === brand.url;
                          return (
                            <button
                              type="button" key={brand.name}
                              onClick={() => { field.onChange(brand.url); form.setValue("emoji", brand.emoji); }}
                              className={`relative flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition-all ${
                                isSelected ? "border-violet-500 bg-violet-500/20 scale-105 shadow-lg shadow-violet-500/20" : "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/25"
                              }`}
                            >
                              {isSelected && (
                                <div className="absolute top-1 right-1 w-3 h-3 rounded-full bg-violet-500 flex items-center justify-center">
                                  <span className="text-white text-[8px]">✓</span>
                                </div>
                              )}
                              <BrandLogoImg url={brand.url} name={brand.name} bg={brand.bg} />
                              <span className="text-[10px] text-gray-300 leading-tight text-center w-full truncate">{brand.name}</span>
                            </button>
                          );
                        })}
                        {/* Clear */}
                        {field.value && (
                          <button type="button" onClick={() => { field.onChange(null); }}
                            className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl border border-dashed border-white/20 bg-white/5 hover:bg-white/10 transition-all">
                            <div className="w-9 h-9 flex items-center justify-center text-muted-foreground text-xl">✕</div>
                            <span className="text-[10px] text-muted-foreground">Tiada</span>
                          </button>
                        )}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}

                {/* Emoji Tab */}
                {logoTab === "emoji" && (
                  <FormField control={form.control} name="emoji" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-300 text-xs uppercase tracking-wider">Pilih Emoji</FormLabel>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <span className="text-4xl">{field.value}</span>
                          <Input
                            placeholder="Taip emoji sendiri..."
                            value={emojiInput}
                            onChange={(e) => {
                              setEmojiInput(e.target.value);
                              if (e.target.value) { field.onChange(e.target.value); form.setValue("logoUrl", null); }
                            }}
                            className="bg-background/50 border-white/10 text-xl"
                          />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {FALLBACK_EMOJIS.map((e) => (
                            <button type="button" key={e}
                              onClick={() => { field.onChange(e); setEmojiInput(e); form.setValue("logoUrl", null); }}
                              className={`text-2xl w-10 h-10 rounded-lg flex items-center justify-center transition-all ${field.value === e && !currentLogoUrl ? "bg-violet-500/30 border border-violet-500/50 scale-110" : "bg-white/5 hover:bg-white/10 border border-white/10"}`}
                            >{e}</button>
                          ))}
                        </div>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}

                {/* Name */}
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-300">Nama Kategori</FormLabel>
                    <FormControl>
                      <Input placeholder="Cth: ChatGPT, Netflix, Spotify..." className="bg-background/50 border-white/10" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* Sort + Active */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="sortOrder" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-300">Urutan (0 = pertama)</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" className="bg-background/50 border-white/10" {...field} />
                      </FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="isActive" render={({ field }) => (
                    <FormItem className="flex flex-col justify-end">
                      <FormLabel className="text-gray-300">Status</FormLabel>
                      <div className="flex items-center gap-2 h-10">
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} className="data-[state=checked]:bg-primary" />
                        </FormControl>
                        <span className="text-sm text-muted-foreground">{field.value ? "Aktif" : "Tidak Aktif"}</span>
                      </div>
                    </FormItem>
                  )} />
                </div>

                {/* Preview */}
                <div className="bg-background/30 border border-white/10 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground mb-2">Pratonton:</p>
                  <div className="flex gap-4 items-center">
                    {/* Admin panel preview */}
                    <div className="flex flex-col items-center gap-1">
                      <p className="text-[10px] text-muted-foreground">Admin Panel</p>
                      <div className="bg-black/40 rounded-lg p-2 flex items-center gap-2 border border-white/10">
                        <CategoryIcon logoUrl={currentLogoUrl} emoji={currentEmoji} size="sm" />
                        <span className="text-white text-sm">{form.watch("name") || "Kategori"}</span>
                      </div>
                    </div>
                    {/* Telegram preview */}
                    <div className="flex flex-col items-center gap-1">
                      <p className="text-[10px] text-muted-foreground">Bot Telegram</p>
                      <div className="bg-[#2b5278] rounded-lg px-3 py-2 border border-[#3d6d9e]">
                        <span className="text-white text-sm">{currentEmoji} {form.watch("name") || "Kategori"}</span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Sticky footer */}
              <div className="px-6 py-4 border-t border-white/10 bg-card/95 shrink-0 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="border-white/10 hover:bg-white/5">Batal</Button>
                <Button type="submit" disabled={createMut.isPending || updateMut.isPending} className="bg-primary hover:bg-primary/90">
                  {createMut.isPending || updateMut.isPending ? "Menyimpan..." : "💾 Simpan"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Brand logo image with fallback ──────────────────────────────────────────
function BrandLogoImg({ url, name, bg }: { url: string; name: string; bg: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    // Letter avatar fallback
    return (
      <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: bg }}>
        {name.charAt(0)}
      </div>
    );
  }

  return (
    <div className="w-9 h-9 flex items-center justify-center rounded-lg" style={{ backgroundColor: `${bg}22` }}>
      <img src={url} alt={name} className="w-7 h-7 object-contain" onError={() => setFailed(true)} />
    </div>
  );
}
