import { useQueryClient } from "@tanstack/react-query";
import { 
  useListProducts as useGeneratedListProducts,
  useCreateProduct as useGeneratedCreateProduct,
  useUpdateProduct as useGeneratedUpdateProduct,
  useDeleteProduct as useGeneratedDeleteProduct,
  getListProductsQueryKey
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

// Wrappers around generated hooks to add toast notifications and cache invalidation

export function useProducts() {
  return useGeneratedListProducts();
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useGeneratedCreateProduct({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
        toast({
          title: "Berjaya",
          description: "Produk baru telah berjaya ditambah.",
        });
      },
      onError: (error: any) => {
        toast({
          variant: "destructive",
          title: "Ralat",
          description: error.message || "Gagal menambah produk.",
        });
      }
    }
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useGeneratedUpdateProduct({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
        toast({
          title: "Berjaya",
          description: "Produk telah dikemaskini.",
        });
      },
      onError: (error: any) => {
        toast({
          variant: "destructive",
          title: "Ralat",
          description: error.message || "Gagal mengemaskini produk.",
        });
      }
    }
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useGeneratedDeleteProduct({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
        toast({
          title: "Berjaya",
          description: "Produk telah dipadam.",
        });
      },
      onError: (error: any) => {
        toast({
          variant: "destructive",
          title: "Ralat",
          description: error.message || "Gagal memadam produk.",
        });
      }
    }
  });
}
