import { useState } from "react";
import { useOrders, useConfirmOrder, useRejectOrder } from "@/hooks/use-orders";
import { Order } from "@workspace/api-client-react";
import { CheckCircle2, XCircle, ExternalLink, Filter, Search, Image as ImageIcon } from "lucide-react";
import { motion } from "framer-motion";
import { format, parseISO } from "date-fns";
import { ms } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/lib/i18n";

const METHOD_MAP: Record<string, { label: string; color: string }> = {
  toyyibpay: { label: "💳 Toyyibpay", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  tng_qr: { label: "📱 TnG QR", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
};

export default function Orders() {
  const { t } = useLanguage();
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const { data: rawOrders = [], isLoading } = useOrders(filter !== "all" ? { status: filter } : undefined);

  // Defensive: ensure data is always an array even if API returns non-array
  const allOrders = Array.isArray(rawOrders) ? rawOrders : [];

  const STATUS_MAP: Record<string, { label: string; color: string }> = {
    pending_payment: { label: t("status_pending_payment"), color: "bg-secondary text-muted-foreground border-white/10" },
    payment_uploaded: { label: t("status_payment_uploaded"), color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
    confirmed: { label: t("status_confirmed"), color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
    rejected: { label: t("status_rejected"), color: "bg-destructive/10 text-destructive border-destructive/20" },
    cancelled: { label: t("status_cancelled"), color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  };
  
  const confirmOrder = useConfirmOrder();
  const rejectOrder = useRejectOrder();

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [deliveryMessage, setDeliveryMessage] = useState("");

  const filteredOrders = allOrders.filter(o => 
    o.productName.toLowerCase().includes(search.toLowerCase()) || 
    o.telegramFirstName?.toLowerCase().includes(search.toLowerCase()) ||
    o.telegramUsername?.toLowerCase().includes(search.toLowerCase())
  );

  const openManage = (order: Order) => {
    setSelectedOrder(order);
    setDeliveryMessage(order.deliveryMessage || "");
  };

  const handleConfirm = () => {
    if (!selectedOrder) return;
    confirmOrder.mutate({ id: selectedOrder.id, data: { deliveryMessage } }, {
      onSuccess: () => setSelectedOrder(null)
    });
  };

  const handleReject = () => {
    if (!selectedOrder) return;
    if (confirm("Adakah anda pasti mahu menolak pesanan ini?")) {
      rejectOrder.mutate({ id: selectedOrder.id }, {
        onSuccess: () => setSelectedOrder(null)
      });
    }
  };

  const FilterButton = ({ value, label }: { value: string, label: string }) => (
    <button
      onClick={() => setFilter(value)}
      className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
        filter === value 
          ? "bg-primary text-primary-foreground shadow-glow border border-primary/50" 
          : "bg-card border border-white/5 text-muted-foreground hover:text-white hover:bg-white/5"
      }`}
    >
      {label}
    </button>
  );

  if (isLoading && allOrders.length === 0) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-10 h-10 border-[3px] border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-display font-bold text-white tracking-tight">{t("orders_title")}</h1>
        <p className="text-muted-foreground">{t("orders_subtitle")}</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="flex flex-wrap gap-2">
          <FilterButton value="all" label={t("orders_all")} />
          <FilterButton value="pending_payment" label={t("status_pending_payment")} />
          <FilterButton value="payment_uploaded" label={t("status_payment_uploaded")} />
          <FilterButton value="confirmed" label={t("status_confirmed")} />
          <FilterButton value="rejected" label={t("status_rejected")} />
          <FilterButton value="cancelled" label={t("status_cancelled")} />
        </div>
        
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input 
            placeholder={t("orders_search")} 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card/50 border-white/10 focus-visible:ring-primary"
          />
        </div>
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden border border-white/5">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-black/20 border-b border-white/5">
              <tr>
                <th className="px-6 py-4 font-medium">{t("orders_order")}</th>
                <th className="px-6 py-4 font-medium">{t("orders_customer")}</th>
                <th className="px-6 py-4 font-medium">{t("orders_product")}</th>
                <th className="px-6 py-4 font-medium">{t("orders_amount")}</th>
                <th className="px-6 py-4 font-medium">{t("orders_status")}</th>
                <th className="px-6 py-4 font-medium text-right">{t("orders_manage")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    {t("orders_empty")}
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order, idx) => (
                  <motion.tr 
                    key={order.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: idx * 0.05 }}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="font-mono text-white">#{order.id}</div>
                      <div className="text-xs text-muted-foreground">{format(parseISO(order.createdAt), 'd MMM yyyy, HH:mm')}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-white">{order.telegramFirstName || 'Pengguna'}</div>
                      <div className="text-xs text-blue-400">@{order.telegramUsername || order.telegramUserId}</div>
                    </td>
                    <td className="px-6 py-4 font-medium text-white">
                      {order.productName}
                    </td>
                    <td className="px-6 py-4 font-bold text-white">
                      RM {order.productPrice.toFixed(2)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1.5">
                        <Badge variant="outline" className={STATUS_MAP[order.status]?.color || STATUS_MAP.pending_payment.color}>
                          {STATUS_MAP[order.status]?.label || order.status}
                        </Badge>
                        <div>
                          <Badge variant="outline" className={`text-xs ${METHOD_MAP[order.paymentMethod]?.color || "bg-secondary text-muted-foreground border-white/10"}`}>
                            {METHOD_MAP[order.paymentMethod]?.label || order.paymentMethod}
                          </Badge>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {(order.status === 'pending_payment' || order.status === 'payment_uploaded') && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (confirm(`${t("orders_reject")} #${order.id}?`)) {
                                rejectOrder.mutate({ id: order.id });
                              }
                            }}
                            disabled={rejectOrder.isPending}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20"
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            {t("orders_reject")}
                          </Button>
                        )}
                        <Button 
                          size="sm" 
                          variant={order.status === 'payment_uploaded' ? "default" : "secondary"}
                          onClick={() => openManage(order)}
                          className={order.status === 'payment_uploaded' ? "bg-primary hover:bg-primary/90 shadow-glow text-white" : "bg-white/10 hover:bg-white/20 text-white"}
                        >
                          {order.status === 'payment_uploaded' ? t("orders_confirm") : t("orders_manage")}
                        </Button>
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="sm:max-w-[600px] bg-card/95 backdrop-blur-xl border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-display flex items-center gap-2">
              {t("orders_manage_title")} #{selectedOrder?.id}
              <Badge variant="outline" className={`ml-2 ${selectedOrder ? STATUS_MAP[selectedOrder.status]?.color : ''}`}>
                {selectedOrder && STATUS_MAP[selectedOrder.status]?.label}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4 bg-background/50 p-4 rounded-xl border border-white/5">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{t("orders_customer")}</p>
                  <p className="font-medium">{selectedOrder.telegramFirstName}</p>
                  <p className="text-sm text-blue-400">@{selectedOrder.telegramUsername}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{t("orders_product")}</p>
                  <p className="font-medium text-primary">{selectedOrder.productName}</p>
                  <p className="text-sm">RM {selectedOrder.productPrice.toFixed(2)}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 bg-background/50 p-3 rounded-xl border border-white/5">
                <p className="text-xs text-muted-foreground">{t("orders_payment_method")}</p>
                <Badge variant="outline" className={METHOD_MAP[selectedOrder.paymentMethod]?.color || "bg-secondary text-muted-foreground border-white/10"}>
                  {METHOD_MAP[selectedOrder.paymentMethod]?.label || selectedOrder.paymentMethod}
                </Badge>
              </div>

              <div>
                <p className="text-sm font-medium mb-3">{t("orders_proof")}</p>
                {selectedOrder.paymentMethod === 'tng_qr' && selectedOrder.paymentProofUrl ? (
                  <div className="border border-purple-500/20 rounded-xl p-5 bg-purple-500/5 flex flex-col items-center gap-2">
                    <ImageIcon className="w-8 h-8 text-purple-400" />
                    <p className="text-sm text-purple-300 font-medium">📱 {t("orders_proof_received")}</p>
                    <p className="text-xs text-muted-foreground text-center">{t("orders_proof_sent")}</p>
                  </div>
                ) : selectedOrder.paymentProofUrl && !selectedOrder.paymentProofUrl.startsWith('AAEC') ? (
                  <div className="border border-white/10 rounded-xl overflow-hidden bg-black/40">
                    <img 
                      src={selectedOrder.paymentProofUrl} 
                      alt="Bukti Bayaran" 
                      className="w-full max-h-[300px] object-contain"
                    />
                    <div className="p-3 border-t border-white/10 flex justify-end">
                      <a href={selectedOrder.paymentProofUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-400 hover:underline flex items-center gap-1">
                        Lihat Gambar Penuh <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                ) : selectedOrder.status === 'confirmed' ? (
                  <div className="border border-emerald-500/20 rounded-xl p-6 flex flex-col items-center justify-center bg-emerald-500/5">
                    <CheckCircle2 className="w-8 h-8 mb-2 text-emerald-400 opacity-80" />
                    <p className="text-sm text-emerald-400 font-medium">
                      {selectedOrder.paymentMethod === 'toyyibpay' ? 'Bayaran disahkan automatik melalui Toyyibpay' : 'Bayaran disahkan'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Tiada screenshot diperlukan</p>
                  </div>
                ) : (
                  <div className="border border-dashed border-white/20 rounded-xl p-8 flex flex-col items-center justify-center text-muted-foreground bg-black/20">
                    <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
                    <p className="text-sm">
                      {selectedOrder.paymentMethod === 'tng_qr' ? 'Menunggu pelanggan hantar bukti bayaran.' : 'Menunggu bayaran pelanggan.'}
                    </p>
                  </div>
                )}
              </div>

              {selectedOrder.status === 'payment_uploaded' && (
                <div className="space-y-3 pt-4 border-t border-white/5">
                  <p className="text-sm font-medium">{t("orders_delivery_msg")}</p>
                  <Textarea 
                    value={deliveryMessage}
                    onChange={(e) => setDeliveryMessage(e.target.value)}
                    placeholder={t("orders_delivery_placeholder")}
                    className="min-h-[120px] font-mono text-sm bg-background/80 border-primary/30 focus-visible:ring-primary text-emerald-400"
                  />
                  <p className="text-xs text-muted-foreground">{t("orders_delivery_hint")}</p>
                </div>
              )}

              {selectedOrder.status === 'confirmed' && selectedOrder.deliveryMessage && (
                <div className="space-y-3 pt-4 border-t border-white/5">
                  <p className="text-sm font-medium text-emerald-400 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> Kandungan Dihantar
                  </p>
                  <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl font-mono text-sm text-emerald-300 whitespace-pre-wrap">
                    {selectedOrder.deliveryMessage}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setSelectedOrder(null)} className="border-white/10 hover:bg-white/5">
              {t("orders_close")}
            </Button>
            
            {(selectedOrder?.status === 'payment_uploaded' || selectedOrder?.status === 'pending_payment') && (
              <>
                <Button 
                  variant="destructive" 
                  onClick={handleReject}
                  disabled={rejectOrder.isPending}
                  className="bg-destructive/20 text-destructive hover:bg-destructive/40 border border-destructive/50"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  {t("orders_reject")}
                </Button>
                {selectedOrder?.status === 'payment_uploaded' && (
                  <Button 
                    onClick={handleConfirm}
                    disabled={confirmOrder.isPending || !deliveryMessage.trim()}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    {t("orders_confirm")}
                  </Button>
                )}
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
