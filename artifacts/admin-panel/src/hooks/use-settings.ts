import { useQueryClient } from "@tanstack/react-query";
import {
  useGetSettings as useGeneratedGetSettings,
  useUpdateSettings as useGeneratedUpdateSettings,
  getGetSettingsQueryKey
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

export function useSettings() {
  return useGeneratedGetSettings();
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useGeneratedUpdateSettings({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
        toast({
          title: "Tetapan Disimpan",
          description: "Tetapan bot telah berjaya dikemaskini.",
        });
      },
      onError: (error: any) => {
        toast({
          variant: "destructive",
          title: "Ralat",
          description: error.message || "Gagal menyimpan tetapan.",
        });
      }
    }
  });
}
