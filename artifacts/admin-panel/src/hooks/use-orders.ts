import { useQueryClient } from "@tanstack/react-query";
import {
  useListOrders as useGeneratedListOrders,
  useConfirmOrder as useGeneratedConfirmOrder,
  useRejectOrder as useGeneratedRejectOrder,
  getListOrdersQueryKey,
  type ListOrdersParams
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

export function useOrders(params?: ListOrdersParams) {
  return useGeneratedListOrders(params);
}

export function useConfirmOrder() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useGeneratedConfirmOrder({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
        toast({
          title: "Pesanan Disahkan",
          description: "Produk telah dihantar kepada pelanggan.",
        });
      },
      onError: (error: any) => {
        toast({
          variant: "destructive",
          title: "Ralat",
          description: error.message || "Gagal mengesahkan pesanan.",
        });
      }
    }
  });
}

export function useRejectOrder() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useGeneratedRejectOrder({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
        toast({
          title: "Pesanan Ditolak",
          description: "Pesanan ini telah dibatalkan.",
        });
      },
      onError: (error: any) => {
        toast({
          variant: "destructive",
          title: "Ralat",
          description: error.message || "Gagal menolak pesanan.",
        });
      }
    }
  });
}
