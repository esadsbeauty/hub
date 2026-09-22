import { isLocalMode } from "@/config/app-mode";
import { supabase } from "@/lib/supabase";
import type { OnboardingSection, OnboardingSnapshot } from "./types";

const local: OnboardingSnapshot = { organization: { name: "ESADS Beauty" }, owner: { name: "Admin ESADS Beauty", email: "admin@esadsbeauty.local" }, pipeline: { id: "local", name: "Pipeline Comercial", stages: [] }, state: { companyProfileCompleted: true, ownerProfileCompleted: true, whatsappCompleted: true, pipelineIntroCompleted: true, firstLeadCompleted: true, introSeenAt: new Date().toISOString(), completedAt: new Date().toISOString(), dismissedAt: new Date().toISOString() } };
const client = () => { if (!supabase) throw new Error("Não foi possível conectar à configuração da conta."); return supabase; };
const checked = <T>(result: { data: unknown; error: { message: string } | null }, message: string) => { if (result.error) throw new Error(message); return result.data as T; };
export const onboardingRepository = {
  async snapshot() { if (isLocalMode) return local; return checked<OnboardingSnapshot>(await client().rpc("organization_onboarding_snapshot"), "Não foi possível carregar a configuração da conta."); },
  async update(section: OnboardingSection, data: Record<string, string>) { if (isLocalMode) return local; return checked<OnboardingSnapshot>(await client().rpc("update_organization_onboarding_profile", { target_section: section, profile_data: data }), "Não foi possível salvar esta etapa."); },
  async complete(step: "pipeline_intro" | "intro_seen" | "dismiss") { if (isLocalMode) return local; return checked<OnboardingSnapshot>(await client().rpc("complete_organization_onboarding_step", { target_step: step }), "Não foi possível concluir esta etapa."); },
};
