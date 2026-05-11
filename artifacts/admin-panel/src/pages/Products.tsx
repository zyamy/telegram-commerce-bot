import { useState } from "react";
import { useProducts, useCreateProduct, useUpdateProduct, useDeleteProduct } from "@/hooks/use-products";
import { Product } from "@workspace/api-client-react";
import { Plus, Edit2, Trash2, Tag, Box, Package, Clock, ShieldCheck, KeyRound, CheckCircle2, CircleDot, Layers } from "lucide-react";
import { motion } from "framer-motion";
import { useLanguage } from "@/lib/i18n";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const productSchema = z.object({
  name: z.string().min(3, "Nama produk mesti melebihi 3 aksara"),
  description: z.string().min(10, "Penerangan mesti melebihi 10 aksara"),
  price: z.coerce.number().min(0.1, "Harga mesti lebih dari RM0"),
  costPrice: z.coerce.number().min(0, "Modal tidak boleh negatif").default(0),
  deliveryContent: z.string().min(1, "Kandungan tidak boleh kosong"),
  isActive: z.boolean().default(true),
  stock: z.coerce.number().int().min(-1).default(-1),
  validPeriod: z.string().optional(),
  warranty: z.string().optional(),
  categoryId: z.coerce.number().int().nullable().optional(),
  installGuide: z.string().optional().nullable(),
});

interface Category {
  id: number;
  name: string;
  emoji: string;
  isActive: boolean;
}

function useCategories() {
  return useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await fetch("/api/categories");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });
}

type ProductFormValues = z.infer<typeof productSchema>;

interface ProductAccount {
  id: number;
  productId: number;
  content: string;
  isDelivered: boolean;
  orderId: number | null;
  createdAt: string;
}

function useProductAccounts(productId: number | null) {
  return useQuery({
    queryKey: ["product-accounts", productId],
    enabled: !!productId,
    queryFn: async () => {
      const res = await fetch(`/api/products/${productId}/accounts`);
      if (!res.ok) throw new Error("Failed to fetch accounts");
      return res.json() as Promise<ProductAccount[]>;
    },
  });
}

function useAddAccounts(productId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entries: string[]) => {
      const res = await fetch(`/api/products/${productId}/accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      });
      if (!res.ok) throw new Error("Failed to add accounts");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product-accounts", productId] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

function useDeleteAccount(productId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (accountId: number) => {
      const res = await fetch(`/api/products/${productId}/accounts/${accountId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete account");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product-accounts", productId] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export default function Products() {
  const { t, lang } = useLanguage();
  const { data: rawProducts = [], isLoading } = useProducts();
  const { data: rawCategories = [] } = useCategories();

  // Defensive: ensure data is always an array even if API returns non-array
  const products = Array.isArray(rawProducts) ? rawProducts : [];
  const categories = Array.isArray(rawCategories) ? rawCategories : [];
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const { toast } = useToast();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [accountsProduct, setAccountsProduct] = useState<(Product & { availableAccounts?: number; totalAccounts?: number }) | null>(null);
  const [newAccountsText, setNewAccountsText] = useState("");

  const { data: accounts = [] } = useProductAccounts(accountsProduct?.id ?? null);
  const addAccounts = useAddAccounts(accountsProduct?.id ?? 0);
  const deleteAccount = useDeleteAccount(accountsProduct?.id ?? 0);

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: { name: "", description: "", price: 0, costPrice: 0, deliveryContent: "", isActive: true, stock: -1, validPeriod: "", warranty: "", installGuide: "" }
  });

  const openCreate = () => {
    setEditingProduct(null);
    form.reset({ name: "", description: "", price: 0, costPrice: 0, deliveryContent: "", isActive: true, stock: -1, validPeriod: "", warranty: "", categoryId: null, installGuide: "" });
    setIsDialogOpen(true);
  };

  const openEdit = (product: Product) => {
    setEditingProduct(product);
    form.reset({
      name: product.name,
      description: product.description,
      price: product.price,
      costPrice: (product as any).costPrice ?? 0,
      deliveryContent: product.deliveryContent,
      isActive: product.isActive,
      stock: (product as any).stock ?? -1,
      validPeriod: (product as any).validPeriod ?? "",
      warranty: (product as any).warranty ?? "",
      categoryId: (product as any).categoryId ?? null,
      installGuide: (product as any).installGuide ?? "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Adakah anda pasti mahu memadam produk ini?")) {
      deleteProduct.mutate({ id });
    }
  };

  const onSubmit = (data: ProductFormValues) => {
    if (editingProduct) {
      updateProduct.mutate({ id: editingProduct.id, data }, { onSuccess: () => setIsDialogOpen(false) });
    } else {
      createProduct.mutate({ data }, { onSuccess: () => setIsDialogOpen(false) });
    }
  };

  const handleAddAccounts = () => {
    // Split by blank line — each block (can be multi-line) = 1 account
    const entries = newAccountsText
      .split(/\n\s*\n/)
      .map((block) => block.trim())
      .filter(Boolean);
    if (!entries.length) return;
    addAccounts.mutate(entries, {
      onSuccess: () => {
        setNewAccountsText("");
        toast({ title: `✅ ${entries.length} akaun berjaya ditambah` });
      },
    });
  };

  const available = accounts.filter((a) => !a.isDelivered);
  const delivered = accounts.filter((a) => a.isDelivered);

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
          <h1 className="text-2xl font-display font-bold text-white tracking-tight">{t("products_title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("products_subtitle")}</p>
        </div>
        <Button onClick={openCreate} className="bg-violet-600 hover:bg-violet-500 text-white shadow-lg transition-all gap-2">
          <Plus className="w-4 h-4" />
          {t("products_add")}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {products.map((product, idx) => {
          const p = product as any;
          return (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: idx * 0.05 }}
              className="glass-panel rounded-2xl overflow-hidden flex flex-col group"
            >
              <div className="p-6 flex-1">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-blue-900/20 flex items-center justify-center border border-primary/20">
                    <Box className="w-6 h-6 text-primary" />
                  </div>
                  <Badge variant={product.isActive ? "default" : "secondary"} className={product.isActive ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/20" : ""}>
                    {product.isActive ? 'Aktif' : 'Tidak Aktif'}
                  </Badge>
                </div>
                <h3 className="font-display font-bold text-xl text-white mb-1">{product.name}</h3>
                {p.categoryId && (() => {
                  const cat = categories.find((c) => c.id === p.categoryId);
                  return cat ? (
                    <span className="inline-flex items-center gap-1 text-[11px] bg-pink-500/10 text-pink-300 border border-pink-500/20 px-2 py-0.5 rounded-full mb-2">
                      <Layers className="w-3 h-3" /> {cat.emoji} {cat.name}
                    </span>
                  ) : null;
                })()}
                <p className="text-muted-foreground text-sm line-clamp-2 mb-4">{product.description}</p>

                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-lg font-bold text-primary">
                    <Tag className="w-4 h-4" />
                    RM {product.price.toFixed(2)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {p.stock === -1 ? (
                      <span className="text-blue-400">∞ Tanpa had stok</span>
                    ) : p.stock === 0 ? (
                      <span className="text-destructive font-medium">⚠️ Stok habis</span>
                    ) : (
                      <span className="text-emerald-400">📦 Stok: {p.stock}</span>
                    )}
                  </div>
                </div>

                {/* Modal & Margin */}
                {(p.costPrice != null && p.costPrice > 0) && (() => {
                  const margin = product.price - p.costPrice;
                  const pct = ((margin / product.price) * 100).toFixed(0);
                  return (
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                        Modal: RM {p.costPrice.toFixed(2)}
                      </span>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full border ${margin >= 0 ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' : 'text-red-300 bg-red-500/10 border-red-500/20'}`}>
                        Untung: RM {margin.toFixed(2)} ({pct}%)
                      </span>
                    </div>
                  );
                })()}

                {/* Account pool status */}
                {p.totalAccounts > 0 && (
                  <div className="flex items-center gap-2 mb-3 p-2 rounded-lg bg-violet-500/10 border border-violet-500/20">
                    <KeyRound className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                    <span className="text-xs text-violet-300">
                      Pool: <span className="font-semibold text-white">{p.availableAccounts}</span> tersedia / <span className="text-muted-foreground">{p.totalAccounts} jumlah</span>
                    </span>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {p.validPeriod && (
                    <span className="flex items-center gap-1 text-[11px] bg-blue-500/10 text-blue-300 border border-blue-500/20 px-2 py-0.5 rounded-full">
                      <Clock className="w-3 h-3" /> {p.validPeriod}
                    </span>
                  )}
                  {p.warranty && (
                    <span className="flex items-center gap-1 text-[11px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                      <ShieldCheck className="w-3 h-3" /> {p.warranty}
                    </span>
                  )}
                </div>
              </div>

              <div className="px-6 py-4 border-t border-white/5 bg-black/20 flex justify-between gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                <Button
                  variant="outline" size="sm"
                  onClick={() => { setAccountsProduct(product as any); setNewAccountsText(""); }}
                  className="border-violet-500/30 text-violet-400 hover:bg-violet-500/10 gap-1"
                >
                  <KeyRound className="w-3.5 h-3.5" /> Urus Akaun
                  {(p.availableAccounts > 0) && (
                    <Badge className="ml-1 bg-violet-500/20 text-violet-300 border-violet-500/30 text-[10px] px-1.5 py-0">{p.availableAccounts}</Badge>
                  )}
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(product)} className="border-white/10 hover:bg-white/5">
                    <Edit2 className="w-4 h-4 mr-2" /> Kemaskini
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(product.id)} className="bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          );
        })}

        {products.length === 0 && (
          <div className="col-span-full py-20 flex flex-col items-center justify-center text-muted-foreground glass-panel rounded-2xl border-dashed">
            <Package className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-lg">Tiada produk dijumpai.</p>
            <p className="text-sm">Sila tambah produk baru untuk mula menjual.</p>
          </div>
        )}
      </div>

      {/* Product Form Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px] bg-card/95 backdrop-blur-xl border-white/10 text-white max-h-[90vh] flex flex-col p-0 gap-0">
          <div className="px-6 pt-6 pb-4 border-b border-white/10 shrink-0">
            <DialogHeader>
              <DialogTitle className="text-2xl font-display">{editingProduct ? 'Kemaskini Produk' : 'Tambah Produk Baru'}</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Isi maklumat produk di bawah. 'Kandungan Penghantaran' adalah fallback jika tiada akaun dalam pool.
              </DialogDescription>
            </DialogHeader>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem className="col-span-2 sm:col-span-1">
                    <FormLabel className="text-gray-300">Nama Produk</FormLabel>
                    <FormControl><Input placeholder="Cth: Netflix Premium 1 Bulan" className="bg-background/50 border-white/10 focus-visible:ring-primary" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="categoryId" render={({ field }) => (
                  <FormItem className="col-span-2 sm:col-span-1">
                    <FormLabel className="text-gray-300">Kategori</FormLabel>
                    <Select
                      value={field.value != null ? String(field.value) : "none"}
                      onValueChange={(v) => field.onChange(v === "none" ? null : parseInt(v))}
                    >
                      <FormControl>
                        <SelectTrigger className="bg-background/50 border-white/10 text-white">
                          <SelectValue placeholder="Pilih kategori..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-card border-white/10 text-white">
                        <SelectItem value="none" className="text-muted-foreground">— Tiada Kategori —</SelectItem>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>{c.emoji} {c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="price" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-300">Harga Jual (RM)</FormLabel>
                    <FormControl><Input type="number" step="0.01" className="bg-background/50 border-white/10 focus-visible:ring-primary" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="costPrice" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-300 flex items-center gap-1.5">
                      Harga Modal (RM)
                      <span className="text-[10px] text-amber-400 font-normal bg-amber-500/10 px-1.5 py-0.5 rounded-full">Untung = Jual - Modal</span>
                    </FormLabel>
                    <FormControl><Input type="number" step="0.01" min="0" placeholder="0.00" className="bg-background/50 border-amber-500/20 focus-visible:ring-amber-500/50 text-amber-300" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="stock" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-300">Stok (-1 = Tanpa Had)</FormLabel>
                    <FormControl><Input type="number" min="-1" step="1" placeholder="-1" className="bg-background/50 border-white/10 focus-visible:ring-primary" {...field} /></FormControl>
                    <p className="text-xs text-muted-foreground">Jika guna pool akaun, stok dikira auto.</p>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="validPeriod" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-300">Tempoh Sah</FormLabel>
                    <FormControl><Input placeholder="Cth: 1 Bulan, Seumur Hidup" className="bg-background/50 border-white/10 focus-visible:ring-primary" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="warranty" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-300">Jaminan / Warranty</FormLabel>
                    <FormControl><Input placeholder="Cth: Garansi Penuh 1 Bulan" className="bg-background/50 border-white/10 focus-visible:ring-primary" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="isActive" render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border border-white/10 bg-background/50 p-3">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base text-gray-300">Status Aktif</FormLabel>
                    <p className="text-xs text-muted-foreground">Produk kelihatan kepada pelanggan</p>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} className="data-[state=checked]:bg-primary" />
                  </FormControl>
                </FormItem>
              )} />

              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-300">Penerangan Produk</FormLabel>
                  <FormControl><Textarea placeholder="Penerangan ringkas produk yang akan dipaparkan kepada pelanggan..." className="resize-none bg-background/50 border-white/10 focus-visible:ring-primary" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="deliveryContent" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-300">
                    Kandungan Penghantaran Fallback <span className="text-amber-400 text-xs font-normal">(dihantar jika tiada akaun dalam pool)</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Contoh: Hubungi admin untuk dapatkan akaun anda."
                      className="min-h-[80px] font-mono text-sm bg-background/50 border-white/10 focus-visible:ring-primary text-amber-400"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="installGuide" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-300 flex items-center gap-2">
                    📋 Cara Penggunaan / Panduan Install
                    <span className="text-emerald-400 text-xs font-normal">(dihantar kepada customer selepas bayar)</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={`Contoh:\n1. Buka apl Netflix\n2. Tekan 'Daftar Masuk'\n3. Masukkan email & password yang diberikan\n4. Pilih profil anda\n\nHubungi admin jika ada masalah! 😊`}
                      className="min-h-[120px] text-sm bg-background/50 border-emerald-500/30 focus-visible:ring-emerald-500/50 text-emerald-300 placeholder:text-muted-foreground"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">Kosongkan jika tiada panduan khas. Panduan ini akan dihantar automatik selepas pesanan disahkan.</p>
                  <FormMessage />
                </FormItem>
              )} />

            </div>

            {/* Sticky footer — sentiasa kelihatan */}
            <div className="px-6 py-4 border-t border-white/10 bg-card/95 shrink-0 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="border-white/10 hover:bg-white/5">Batal</Button>
              <Button type="submit" disabled={createProduct.isPending || updateProduct.isPending} className="bg-primary hover:bg-primary/90 shadow-glow">
                {(createProduct.isPending || updateProduct.isPending) ? "Menyimpan..." : "💾 Simpan Produk"}
              </Button>
            </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Account Pool Sheet */}
      <Sheet open={!!accountsProduct} onOpenChange={(o) => { if (!o) setAccountsProduct(null); }}>
        <SheetContent className="bg-card/95 backdrop-blur-xl border-white/10 text-white w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-white flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-violet-400" />
              Pool Akaun — {accountsProduct?.name}
            </SheetTitle>
            <SheetDescription className="text-muted-foreground">
              Setiap akaun akan dihantar auto kepada customer apabila pembayaran disahkan.
            </SheetDescription>
          </SheetHeader>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-emerald-400">{available.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Tersedia</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-white">{delivered.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Dah Dihantar</p>
            </div>
          </div>

          {/* Add accounts */}
          <div className="mb-6">
            <label className="text-sm font-medium text-gray-300 block mb-2">
              Tambah Akaun Baru <span className="text-muted-foreground text-xs font-normal">(pisahkan setiap akaun dengan <strong className="text-white">baris kosong</strong>)</span>
            </label>
            <Textarea
              value={newAccountsText}
              onChange={(e) => setNewAccountsText(e.target.value)}
              placeholder={"Email: user1@gmail.com\nPassword: abc123\nLink: https://...\n\nEmail: user2@gmail.com\nPassword: xyz456\nLink: https://..."}
              className="min-h-[160px] font-mono text-sm bg-background/50 border-white/10 text-emerald-400 placeholder:text-muted-foreground/50 mb-2"
            />
            <Button
              onClick={handleAddAccounts}
              disabled={!newAccountsText.trim() || addAccounts.isPending}
              className="w-full bg-violet-600 hover:bg-violet-500"
            >
              <Plus className="w-4 h-4 mr-2" />
              {addAccounts.isPending ? "Menambah..." : `Tambah ${newAccountsText.split(/\n\s*\n/).filter(b => b.trim()).length || ""} Akaun`}
            </Button>
          </div>

          {/* Available accounts list */}
          {available.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <CircleDot className="w-3 h-3" /> Tersedia ({available.length})
              </p>
              <div className="space-y-2">
                {available.map((acc) => (
                  <div key={acc.id} className="flex items-start gap-2 bg-white/5 border border-white/10 rounded-lg p-3">
                    <p className="flex-1 font-mono text-xs text-emerald-300 break-all">{acc.content}</p>
                    <button
                      onClick={() => {
                        if (confirm("Buang akaun ini?")) deleteAccount.mutate(acc.id);
                      }}
                      className="text-destructive hover:text-destructive/70 shrink-0 mt-0.5 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Delivered accounts */}
          {delivered.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3" /> Dah Dihantar ({delivered.length})
              </p>
              <div className="space-y-2">
                {delivered.map((acc) => (
                  <div key={acc.id} className="flex items-start gap-2 bg-white/5 border border-white/10 rounded-lg p-3 opacity-50">
                    <p className="flex-1 font-mono text-xs text-muted-foreground break-all line-through">{acc.content}</p>
                    {acc.orderId && (
                      <span className="text-[10px] text-muted-foreground shrink-0">Order #{acc.orderId}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {accounts.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <KeyRound className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Tiada akaun dalam pool lagi.</p>
              <p className="text-xs mt-1">Tambah akaun di atas untuk mula.</p>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
