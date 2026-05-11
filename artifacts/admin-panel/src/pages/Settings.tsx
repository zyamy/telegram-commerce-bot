import { useEffect, useRef, useState } from "react";
import { useSettings, useUpdateSettings } from "@/hooks/use-settings";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Save, QrCode, MessageSquare, Upload, X, ImageIcon, Store, Users } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";

const settingsSchema = z.object({
  qrImageUrl: z.string().optional(),
  paymentInstructions: z.string().min(5, "Sila berikan arahan pembayaran yang jelas"),
  welcomeMessage: z.string().min(5, "Mesej selamat datang diperlukan"),
  isOpen: z.boolean().default(true),
  closedMessage: z.string().min(5, "Sila berikan mesej tutup kedai"),
  requiredChannel: z.string().optional(),
  channelInviteLink: z.string().optional(),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

export default function Settings() {
  const { t, lang } = useLanguage();
  const { data: settings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      qrImageUrl: "",
      paymentInstructions: "",
      welcomeMessage: "",
      isOpen: true,
      closedMessage: "Maaf, kedai kami sedang tutup buat masa ini. Sila cuba lagi kemudian.",
      requiredChannel: "",
      channelInviteLink: "",
    }
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        qrImageUrl: settings.qrImageUrl || "",
        paymentInstructions: settings.paymentInstructions,
        welcomeMessage: settings.welcomeMessage,
        isOpen: settings.isOpen ?? true,
        closedMessage: settings.closedMessage || "Maaf, kedai kami sedang tutup buat masa ini.",
        requiredChannel: (settings as any).requiredChannel || "",
        channelInviteLink: (settings as any).channelInviteLink || "",
      });
      setPreviewUrl(settings.qrImageUrl || "");
    }
  }, [settings, form]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);

    try {
      // Convert to base64 data URL and store directly in DB
      // This ensures Railway bot can send QR without depending on Replit server
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Gagal membaca fail"));
        reader.readAsDataURL(file);
      });
      form.setValue("qrImageUrl", base64);
      setPreviewUrl(base64);
    } catch (err: any) {
      setUploadError(err.message || "Ralat semasa memproses gambar");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveQr = () => {
    form.setValue("qrImageUrl", "");
    setPreviewUrl("");
  };

  const onSubmit = (data: SettingsFormValues) => {
    updateSettings.mutate({
      data: {
        ...data,
        requiredChannel: data.requiredChannel?.trim() || null,
        channelInviteLink: data.channelInviteLink?.trim() || null,
      },
    });
  };

  const isOpen = form.watch("isOpen");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-10 h-10 border-[3px] border-slate-500/20 border-t-slate-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-display font-bold text-white tracking-tight">{t("settings_title")}</h1>
        <p className="text-muted-foreground">{t("settings_subtitle")}</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

          {/* Status Kedai */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`border p-6 sm:p-8 rounded-2xl transition-all ${isOpen ? "bg-emerald-500/5 border-emerald-500/20" : "bg-destructive/5 border-destructive/20"}`}
          >
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${isOpen ? "bg-emerald-500/10 border-emerald-500/20" : "bg-destructive/10 border-destructive/20"}`}>
                <Store className={`w-5 h-5 ${isOpen ? "text-emerald-400" : "text-destructive"}`} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">{t("settings_store")}</h3>
                <p className="text-sm text-muted-foreground">{lang === "en" ? "Open or close your store" : "Buka atau tutup kedai anda"}</p>
              </div>
            </div>

            <div className="space-y-6">
              <FormField
                control={form.control}
                name="isOpen"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-xl border border-white/10 bg-background/30 p-5">
                    <div className="space-y-1">
                      <FormLabel className="text-base font-semibold text-white">
                        {field.value ? `🟢 ${t("settings_open")}` : `🔴 ${t("settings_closed")}`}
                      </FormLabel>
                      <p className="text-sm text-muted-foreground">
                        {field.value
                          ? (lang === "en" ? "Customers can place orders now" : "Pelanggan boleh membuat pesanan sekarang")
                          : (lang === "en" ? "Customers cannot place orders" : "Pelanggan tidak boleh membuat pesanan")
                        }
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        className="data-[state=checked]:bg-emerald-500"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {!isOpen && (
                <FormField
                  control={form.control}
                  name="closedMessage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-300">Mesej Bila Kedai Tutup</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Maaf, kedai kami sedang tutup..."
                          className="resize-none bg-background/50 border-white/10 min-h-[80px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>
          </motion.div>

          {/* Payment Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-white/5 border border-white/10 p-6 sm:p-8 rounded-2xl"
          >
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                <QrCode className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">{t("settings_payment")}</h3>
                <p className="text-sm text-muted-foreground">{lang === "en" ? "TnG QR and payment instructions" : "QR Touch & Go dan arahan pembayaran"}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <FormField
                  control={form.control}
                  name="qrImageUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-300">{t("settings_qr")}</FormLabel>
                      <div className="space-y-3">
                        <div
                          onClick={() => fileInputRef.current?.click()}
                          className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-white/20 rounded-xl cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all group"
                        >
                          {uploading ? (
                            <div className="flex flex-col items-center gap-2">
                              <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                              <span className="text-sm text-muted-foreground">Memuat naik...</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-2">
                              <Upload className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                              <span className="text-sm text-muted-foreground group-hover:text-primary transition-colors font-medium">Klik untuk muat naik gambar QR</span>
                              <span className="text-xs text-muted-foreground/60">PNG, JPG sehingga 5MB</span>
                            </div>
                          )}
                        </div>
                        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                        <div className="flex gap-2 items-center">
                          <Input
                            placeholder="Atau tampal URL gambar di sini"
                            className="bg-background/50 border-white/10 text-sm"
                            value={field.value || ""}
                            onChange={(e) => { field.onChange(e); setPreviewUrl(e.target.value); }}
                          />
                          {previewUrl && (
                            <Button type="button" variant="ghost" size="icon" onClick={handleRemoveQr} className="shrink-0 text-muted-foreground hover:text-destructive">
                              <X className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                        {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="paymentInstructions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-300">{t("settings_instructions")}</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Sila scan QR di atas..." className="min-h-[120px] resize-none bg-background/50 border-white/10" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex flex-col items-center justify-center p-6 border border-dashed border-white/10 rounded-2xl bg-black/20 min-h-[250px]">
                <p className="text-sm text-muted-foreground mb-4 font-medium">Pratonton QR Code</p>
                {previewUrl ? (
                  <div className="relative group">
                    <img src={previewUrl} alt="QR Preview" className="w-52 h-52 object-contain bg-white p-3 rounded-xl shadow-lg" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    <button type="button" onClick={handleRemoveQr} className="absolute -top-2 -right-2 w-6 h-6 bg-destructive rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ) : (
                  <div className="w-52 h-52 rounded-xl bg-white/5 flex flex-col items-center justify-center border border-white/10 gap-3">
                    <ImageIcon className="w-10 h-10 text-muted-foreground/30" />
                    <p className="text-xs text-muted-foreground/50 text-center px-4">Muat naik gambar QR untuk pratonton</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Bot Messages */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white/5 border border-white/10 p-6 sm:p-8 rounded-2xl"
          >
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                <MessageSquare className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">{lang === "en" ? "Bot Messages" : "Komunikasi Bot"}</h3>
                <p className="text-sm text-muted-foreground">Mesej yang dihantar oleh bot kepada pelanggan</p>
              </div>
            </div>

            <FormField
              control={form.control}
              name="welcomeMessage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-300">{t("settings_welcome")} (/start)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Selamat datang ke kedai digital kami!..." className="min-h-[150px] bg-background/50 border-white/10" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </motion.div>

          {/* Required Channel */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-white/5 border border-white/10 p-6 sm:p-8 rounded-2xl"
          >
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
              <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center border border-violet-500/20">
                <Users className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Wajib Join Channel</h3>
                <p className="text-sm text-muted-foreground">Paksa pengguna join channel sebelum guna bot</p>
              </div>
            </div>

            <div className="space-y-5">
              <FormField
                control={form.control}
                name="requiredChannel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-300">Chat ID Channel <span className="text-amber-400 text-xs font-normal">(untuk semak ahli)</span></FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Contoh: @namaChannel atau -1001234567890"
                        className="bg-background/50 border-white/10 font-mono"
                        {...field}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground mt-1">
                      • Channel <span className="text-white">awam</span>: masuk <span className="text-white font-mono">@namaChannel</span><br />
                      • Channel <span className="text-white">private</span>: buka channel di <span className="text-white font-mono">web.telegram.org</span> → tengok URL → salin nombor selepas <span className="text-white font-mono">#</span> (contoh: <span className="text-white font-mono">-1003160687279</span>)<br />
                      • Bot <span className="text-amber-400 font-semibold">mesti jadi Admin</span> dalam channel untuk semak ahli.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="channelInviteLink"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-300">Link Join Channel <span className="text-green-400 text-xs font-normal">(untuk button)</span></FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Contoh: https://t.me/+abc123 atau https://t.me/namaChannel"
                        className="bg-background/50 border-white/10 font-mono"
                        {...field}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground mt-1">
                      Link ini akan muncul pada button "📢 Join Channel" dalam bot. Untuk channel private, guna invite link anda.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </motion.div>

          <div className="flex justify-end pt-2">
            <Button type="submit" size="lg" disabled={updateSettings.isPending || uploading} className="bg-primary hover:bg-primary/90 text-white px-8 rounded-full">
              <Save className="w-5 h-5 mr-2" />
              {updateSettings.isPending ? t("settings_saving") : t("settings_save")}
            </Button>
          </div>

        </form>
      </Form>
    </div>
  );
}
