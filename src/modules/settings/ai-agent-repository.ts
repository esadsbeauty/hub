import { supabase } from "@/lib/supabase";

export type AiAgentBehaviorConfig = {
  mobile_lines_per_message: number;
  max_consecutive_messages: number;
  questions_per_message: number;
  avoid_long_paragraphs: boolean;
  split_long_messages: boolean;
  followup_first_min_minutes: number;
  followup_first_max_minutes: number;
  followup_second_min_minutes: number;
  followup_second_max_minutes: number;
  followup_max_per_round: number;
  followup_max_per_24h: number;
  followup_timezone: string;
  followup_quiet_start_hour: number;
  followup_quiet_end_hour: number;
};

export type AiAgentCapabilities = {
  respond_new_messages: boolean;
  continue_team_conversations: boolean;
  qualify_leads: boolean;
  update_crm: boolean;
  generate_summary: boolean;
  calculate_score: boolean;
  handoff_to_human: boolean;
  send_prices: boolean;
  schedule_appointments: boolean;
  reactivate_leads: boolean;
  follow_up_leads?: boolean;
};

export type AiAgentQualificationQuestion = {
  key: string;
  question: string;
  required: boolean;
  enabled: boolean;
};

export type AiAgentBusinessContext = Record<string, unknown> & {
  company_about?: string;
  main_services?: string;
  differentiators?: string;
  target_audience?: string;
  service_region?: string;
  business_hours?: string;
  commercial_information?: string;
  allowed_prices?: string;
  restricted_information?: string;
};

export type AiAgentConfig = {
  id: string;
  organization_id: string;
  name: string;
  role: string;
  is_enabled: boolean;
  objective: string;
  tone: string;
  welcome_message: string | null;
  qualification_questions: AiAgentQualificationQuestion[];
  handoff_rules: Record<string, unknown>;
  business_context: AiAgentBusinessContext;
  crm_config: Record<string, unknown>;
  behavior_config: AiAgentBehaviorConfig;
  capabilities: AiAgentCapabilities;
  system_prompt: string | null;
  model_provider: string;
  model_name: string | null;
};

export type AiAgentConfigUpdate = Omit<
  AiAgentConfig,
  "id" | "organization_id"
>;

function client() {
  if (!supabase) {
    throw new Error("Não foi possível conectar ao Supabase.");
  }

  return supabase;
}

export const aiAgentRepository = {
  async get(
    organizationId: string,
  ): Promise<AiAgentConfig | null> {
    const db = client() as any;

    const { data, error } = await db
      .from("ai_agents")
      .select("*")
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (error) {
      console.error("[AiAgent] Erro ao carregar agente:", error);

      throw new Error(
        "Não foi possível carregar as configurações do agente.",
      );
    }

    if (!data) {
      return null;
    }

    return data as AiAgentConfig;
  },

  async update(
    organizationId: string,
    input: Partial<AiAgentConfigUpdate>,
  ): Promise<AiAgentConfig> {
    const db = client() as any;

    const { data, error } = await db
      .from("ai_agents")
      .update({
        ...input,
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", organizationId)
      .select("*")
      .single();

    if (error) {
      console.error("[AiAgent] Erro ao salvar agente:", error);

      throw new Error(
        "Não foi possível salvar as configurações do agente.",
      );
    }

    return data as AiAgentConfig;
  },
};
