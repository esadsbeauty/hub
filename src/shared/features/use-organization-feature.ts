import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAppState } from "@/shared/state/app-state-context";

export function useOrganizationFeature(featureKey: string) {
  const { organizationId, authorizationLoading } = useAppState();

  return useQuery({
    queryKey: [
      "organization-feature",
      organizationId,
      featureKey,
    ],
    queryFn: async () => {
      if (!supabase || !organizationId) {
        return false;
      }

      const { data, error } = await supabase
        .from("organization_features")
        .select("enabled")
        .eq("organization_id", organizationId)
        .eq("feature_key", featureKey)
        .eq("enabled", true)
        .maybeSingle();

      if (error) throw error;

      return data?.enabled === true;
    },
    enabled:
      !authorizationLoading &&
      Boolean(organizationId) &&
      Boolean(supabase),
    staleTime: 30_000,
  });
}