import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { onboardingRepository } from "./repository";
import type { OnboardingSection } from "./types";
import { useAppState } from "@/shared/state/app-state-context";
export const onboardingKey = ["organization-onboarding"] as const;
export function useOnboarding() { const{organizationId,isImpersonating}=useAppState();return useQuery({ queryKey:[...onboardingKey,organizationId], queryFn:onboardingRepository.snapshot,enabled:Boolean(organizationId)&&!isImpersonating }); }
export function useOnboardingActions() { const client = useQueryClient(); const refresh = () => client.invalidateQueries({ queryKey: onboardingKey }); return {
  update: useMutation({ mutationFn: ({ section, data }: { section: OnboardingSection; data: Record<string, string> }) => onboardingRepository.update(section, data), onSuccess: refresh }),
  complete: useMutation({ mutationFn: onboardingRepository.complete, onSuccess: refresh }),
}; }
