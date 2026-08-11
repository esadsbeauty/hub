export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];
type Table<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};
type Base = {
  id: string;
  organization_id: string;
  created_at: string;
  updated_at: string;
};
type Priority = "baixa" | "media" | "alta";
type Temperature = "frio" | "morno" | "quente";
export type Database = {
  public: {
    Tables: {
      organizations: Table<
        Omit<Base, "organization_id"> & {
          name: string;
          slug: string;
          timezone: string;
        }
      >;
      profiles: Table<
        Base & {
          name: string;
          email: string;
          avatar_url: string | null;
          role: "admin" | "manager" | "sales" | "financial" | "member";
        }
      >;
      companies: Table<
        Base & {
          name: string;
          legal_name: string | null;
          cnpj: string | null;
          phone: string | null;
          whatsapp: string | null;
          instagram: string | null;
          facebook: string | null;
          website: string | null;
          email: string | null;
          zip_code: string | null;
          address: string | null;
          address_number: string | null;
          complement: string | null;
          district: string | null;
          city: string | null;
          state: string | null;
          responsible_name: string | null;
          responsible_role: string | null;
          employees: number | null;
          business_area: string | null;
          source: string | null;
          temperature: Temperature;
          priority: Priority;
          notes: string | null;
          tags: string[];
          lifecycle_stage: "lead" | "customer" | "inactive";
          owner_id: string | null;
          created_by: string;
          last_interaction_at: string | null;
          deleted_at: string | null;
        }
      >;
      contacts: Table<
        Base & {
          company_id: string;
          name: string;
          role: string | null;
          email: string | null;
          phone: string | null;
          whatsapp: string | null;
          instagram: string | null;
          linkedin: string | null;
          birth_date: string | null;
          notes: string | null;
          is_primary: boolean;
          is_financial: boolean;
          is_commercial: boolean;
          status: "ativo" | "inativo";
          deleted_at: string | null;
        }
      >;
      pipelines: Table<
        Base & { name: string; description: string | null; is_default: boolean }
      >;
      pipeline_stages: Table<
        Omit<Base, "organization_id"> & {
          pipeline_id: string;
          name: string;
          slug: string;
          position: number;
          probability: number;
          is_won: boolean;
          is_lost: boolean;
        }
      >;
      opportunities: Table<
        Base & {
          company_id: string;
          pipeline_id: string;
          stage_id: string;
          title: string;
          description: string | null;
          value: number;
          probability: number;
          expected_close_date: string | null;
          owner_id: string | null;
          source: string | null;
          status: "open" | "won" | "lost" | "archived";
          lost_reason: string | null;
          lost_reason_notes: string | null;
          won_at: string | null;
          lost_at: string | null;
          stage_entered_at: string;
          created_by: string;
          deleted_at: string | null;
        }
      >;
      opportunity_stage_history: Table<{
        id: string;
        organization_id: string;
        opportunity_id: string;
        from_stage_id: string | null;
        to_stage_id: string;
        changed_by: string | null;
        changed_at: string;
      }>;
      activities: Table<{
        id: string;
        organization_id: string;
        company_id: string | null;
        opportunity_id: string | null;
        user_id: string | null;
        type: string;
        title: string;
        description: string | null;
        metadata: Json;
        created_at: string;
      }>;
      tasks: Table<
        Base & {
          company_id: string | null;
          opportunity_id: string | null;
          assigned_to: string | null;
          created_by: string;
          title: string;
          description: string | null;
          type:
            | "follow_up"
            | "call"
            | "whatsapp"
            | "email"
            | "meeting"
            | "task";
          status: "pending" | "completed" | "cancelled";
          priority: "low" | "medium" | "high" | "urgent";
          due_at: string | null;
          completed_at: string | null;
          cancelled_at: string | null;
          duration_minutes: number | null;
          location_type: "online" | "in_person" | "phone" | "other" | null;
          location: string | null;
          meeting_url: string | null;
          deleted_at: string | null;
        }
      >;
      notes: Table<
        Base & {
          company_id: string;
          opportunity_id: string | null;
          created_by: string;
          body: string;
          deleted_at: string | null;
        }
      >;
      customer_accounts: Table<Base & { company_id: string; status: "onboarding" | "active" | "paused" | "cancelled" | "inactive"; client_since: string; owner_id: string | null; success_owner_id: string | null; source_opportunity_id: string | null; cancellation_reason: string | null; cancellation_notes: string | null; cancelled_at: string | null; archived_at: string | null }>;
      services: Table<Base & { name: string; description: string | null; category: string | null; default_price: number | null; billing_type: "one_time" | "recurring" | "custom"; is_active: boolean }>;
      customer_services: Table<Base & { customer_account_id: string; service_id: string; source_opportunity_id: string | null; status: "pending" | "active" | "paused" | "completed" | "cancelled"; start_date: string | null; end_date: string | null; agreed_price: number | null; billing_type: "one_time" | "recurring" | "custom"; billing_interval: "monthly" | "quarterly" | "yearly" | "one_time" | "custom"; owner_id: string | null; notes: string | null; cancelled_at: string | null; deleted_at: string | null }>;
      onboardings: Table<Base & { customer_account_id: string; customer_service_id: string | null; source_opportunity_id: string | null; title: string; status: "not_started" | "in_progress" | "blocked" | "completed" | "cancelled"; owner_id: string | null; started_at: string | null; due_at: string | null; completed_at: string | null; deleted_at: string | null }>;
      onboarding_steps: Table<Base & { onboarding_id: string; task_id: string | null; title: string; description: string | null; position: number; status: "pending" | "in_progress" | "completed" | "blocked" | "cancelled"; assigned_to: string | null; due_at: string | null; completed_at: string | null; blocked_by: "internal" | "client" | "external" | null; blocked_reason: string | null }>;
      contracts: Table<Base & { customer_account_id: string; source_opportunity_id: string | null; title: string; status: "draft" | "sent" | "signed" | "active" | "expired" | "cancelled"; contract_number: string; start_date: string; end_date: string | null; signed_at: string | null; value: number | null; billing_type: "one_time" | "recurring" | "custom"; billing_interval: "monthly" | "quarterly" | "yearly" | "one_time" | "custom"; auto_renew: boolean; notice_days: number; owner_id: string | null; notes: string | null; cancelled_at: string | null; deleted_at: string | null }>;
      contract_services: Table<{ contract_id: string; customer_service_id: string }>;
    };
    Views: Record<string, never>;
    Functions: {
      current_organization_id: { Args: Record<string, never>; Returns: string };
      create_default_pipeline: {
        Args: { target_organization_id: string };
        Returns: string;
      };
      set_primary_contact: {
        Args: { target_contact_id: string };
        Returns: undefined;
      };
      create_company_with_primary_contact: {
        Args: { company_data: Json; contact_data?: Json };
        Returns: Database["public"]["Tables"]["companies"]["Row"];
      };
      complete_task: {
        Args: { target_task_id: string };
        Returns: Database["public"]["Tables"]["tasks"]["Row"];
      };
      reschedule_task: {
        Args: { target_task_id: string; new_due_at: string };
        Returns: Database["public"]["Tables"]["tasks"]["Row"];
      };
      cancel_task: {
        Args: { target_task_id: string };
        Returns: Database["public"]["Tables"]["tasks"]["Row"];
      };
      activate_customer_from_won_opportunity: { Args: { target_opportunity_id: string }; Returns: Database["public"]["Tables"]["customer_accounts"]["Row"] };
      complete_onboarding_step: { Args: { target_step_id: string }; Returns: Database["public"]["Tables"]["onboarding_steps"]["Row"] };
    };
    Enums: {
      profile_role: "admin" | "manager" | "sales" | "financial" | "member";
      opportunity_status: "open" | "won" | "lost" | "archived";
      task_status: "pending" | "completed" | "cancelled";
    };
    CompositeTypes: Record<string, never>;
  };
};
