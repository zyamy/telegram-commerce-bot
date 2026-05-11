import { useState } from "react";
import { Megaphone, Send, Users } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useOrders } from "@/hooks/use-orders";
import { useLanguage } from "@/lib/i18n";

export default function Broadcast() {
  const { t, lang } = useLanguage();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { data: orders = [] } = useOrders();

  const uniqueCustomers = new Set(orders.map(o => o.telegramUserId)).size;

  const handleSend = async () => {
    if (!message.trim()) return;
    if (!confirm(`${t("broadcast_confirm")} ${uniqueCustomers} ${t("broadcast_confirm2")}`)) return;

    setSending(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || t("broadcast_error"));
      }

      const data = await res.json();
      setResult(data);
      setMessage("");
    } catch (err: any) {
      setError(err.message || t("broadcast_error"));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-display font-bold text-white tracking-tight">{t("broadcast_title")}</h1>
        <p className="text-muted-foreground">{t("broadcast_subtitle")}</p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel p-6 rounded-2xl border border-white/5"
      >
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
            <Megaphone className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">{t("broadcast_compose")}</h3>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Users className="w-3 h-3" />
              <span>{uniqueCustomers} {t("broadcast_customers").toLowerCase()}</span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t("broadcast_placeholder")}
            className="min-h-[200px] bg-background/50 border-white/10 focus-visible:ring-primary text-white placeholder:text-muted-foreground/50"
          />
          <p className="text-xs text-muted-foreground">{message.length} chars</p>

          {result && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <p className="text-emerald-400 font-medium">✅ {t("broadcast_success")}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {result.sent} {t("broadcast_result")} {result.failed} {t("broadcast_result_failed")} {result.total} {t("broadcast_result_total")}
              </p>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20">
              <p className="text-destructive text-sm">❌ {error}</p>
            </div>
          )}

          <Button
            onClick={handleSend}
            disabled={sending || !message.trim()}
            className="w-full bg-primary hover:bg-primary/90 text-white shadow-glow"
            size="lg"
          >
            <Send className="w-4 h-4 mr-2" />
            {sending ? t("broadcast_sending") : `${t("broadcast_send")} (${uniqueCustomers})`}
          </Button>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-panel p-6 rounded-2xl border border-white/5"
      >
        <h3 className="font-bold text-white mb-3">💡 Tips</h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>• {lang === "en" ? "Use emojis to grab attention 🎯" : "Gunakan emoji untuk menarik perhatian 🎯"}</li>
          <li>• {lang === "en" ? "State your offer clearly and concisely" : "Nyatakan tawaran dengan jelas dan ringkas"}</li>
          <li>• {lang === "en" ? "Add a time limit to create urgency (e.g. 'today only')" : "Tambah tempoh masa untuk tawaran (contoh: 'hari ini sahaja')"}</li>
          <li>• {lang === "en" ? "Don't send too often — max 2-3 times a week" : "Jangan hantar terlalu kerap — maksimum 2-3 kali seminggu"}</li>
        </ul>
      </motion.div>
    </div>
  );
}
