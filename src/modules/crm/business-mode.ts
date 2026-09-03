import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isLocalMode } from "@/config/app-mode";
import { supabase } from "@/lib/supabase";
import { useAppState } from "@/shared/state/app-state-context";
import type { BusinessMode } from "./business-mode-model";

export { crmTerminology, type BusinessMode } from "./business-mode-model";
export const businessModeKey = (organizationId: string) => ["organization", organizationId, "business-mode"] as const;

export function useBusinessMode() {
  const { organizationId } = useAppState();
  return useQuery({
    queryKey: businessModeKey(organizationId),
    queryFn: async (): Promise<BusinessMode> => {
      if (isLocalMode || !supabase) return "b2b";
      const result = await supabase.rpc("current_business_mode");
      if (result.error) throw new Error("Não foi possível carregar o tipo de operação.");
      return result.data === "b2c" ? "b2c" : "b2b";
    },
    enabled: Boolean(organizationId),
    staleTime: 60_000,
  });
}

export function useUpdateBusinessMode() {
  const { organizationId } = useAppState();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (mode: BusinessMode) => {
      if (isLocalMode || !supabase) return mode;
      const result = await supabase.rpc("update_organization_business_mode", { next_mode: mode });
      if (result.error) throw new Error("Você não possui permissão para alterar o tipo de operação.");
      return result.data === "b2c" ? "b2c" : "b2b";
    },
    onSuccess: mode => client.setQueryData(businessModeKey(organizationId), mode),
  });
}
