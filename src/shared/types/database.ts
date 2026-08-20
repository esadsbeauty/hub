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
          currency: string;
          locale: string;
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
      financial_accounts: Table<Base & { name:string; type:"bank"|"cash"|"digital_wallet"|"other"; bank_name:string|null; initial_balance:number; is_active:boolean; deleted_at:string|null }>;
      financial_categories: Table<Base & { name:string; type:"income"|"expense"; parent_id:string|null; dre_group:"gross_revenue"|"deduction"|"direct_cost"|"operating_expense"|"other_income"|"other_expense"; is_active:boolean }>;
      cost_centers: Table<Base & { name:string; description:string|null; is_active:boolean }>;
      recurrence_rules: Table<Base & { type:"receivable"|"payable"; customer_account_id:string|null; contract_id:string|null; customer_service_id:string|null; supplier_name:string|null; description:string; amount:number; category_id:string|null; cost_center_id:string|null; frequency:"monthly"|"quarterly"|"semiannual"|"yearly"; interval_count:number; start_date:string; end_date:string|null; due_day:number; is_active:boolean; next_generation_date:string; cancelled_at:string|null }>;
      receivables: Table<Base & { customer_account_id:string|null; company_id:string|null; contract_id:string|null; customer_service_id:string|null; source_opportunity_id:string|null; description:string; category_id:string|null; cost_center_id:string|null; competence_date:string; due_date:string; original_amount:number; discount_amount:number; interest_amount:number; penalty_amount:number; net_amount:number; status:"pending"|"partially_paid"|"paid"|"cancelled"|"refunded"; payment_method:string|null; notes:string|null; recurrence_rule_id:string|null; recurrence_key:string|null; created_by:string; cancelled_at:string|null; deleted_at:string|null }>;
      payables: Table<Base & { supplier_name:string; description:string; category_id:string|null; cost_center_id:string|null; competence_date:string; due_date:string; original_amount:number; discount_amount:number; interest_amount:number; penalty_amount:number; net_amount:number; status:"pending"|"partially_paid"|"paid"|"cancelled"|"refunded"; financial_account_id:string|null; notes:string|null; recurrence_rule_id:string|null; recurrence_key:string|null; created_by:string; cancelled_at:string|null; deleted_at:string|null }>;
      financial_transactions: Table<{ id:string; organization_id:string; financial_account_id:string; type:"income"|"expense"|"transfer"|"adjustment"; transfer_direction:"in"|"out"|null; amount:number; occurred_at:string; description:string; payment_method:string|null; reference:string|null; created_by:string; reversed_at:string|null; reversed_by:string|null; reversal_of_id:string|null; transfer_id:string|null; created_at:string }>;
      payment_allocations: Table<{ id:string; organization_id:string; transaction_id:string; receivable_id:string|null; payable_id:string|null; amount:number; created_at:string }>;
      marketing_sources: Table<Base&{name:string;slug:string;channel:"paid_social"|"paid_search"|"organic_social"|"organic_search"|"referral"|"outbound"|"direct"|"partner"|"other";platform:string;type:string;is_paid:boolean;is_active:boolean}>;
      marketing_campaigns: Table<Base&{source_id:string;provider:string;external_id:string|null;name:string;objective:string|null;status:"active"|"paused"|"completed"|"archived";start_date:string|null;end_date:string|null;budget:number|null;external_account_id:string|null;metadata:Json}>;
      marketing_ad_groups: Table<Base&{campaign_id:string;external_id:string|null;name:string;status:string;metadata:Json}>;
      marketing_ads: Table<Base&{campaign_id:string;ad_group_id:string|null;external_id:string|null;name:string;status:string;creative_name:string|null;destination_url:string|null;metadata:Json}>;
      lead_acquisitions: Table<{id:string;organization_id:string;company_id:string;contact_id:string|null;opportunity_id:string|null;source_id:string|null;campaign_id:string|null;ad_group_id:string|null;ad_id:string|null;provider:string|null;external_event_id:string|null;utm_source:string|null;utm_medium:string|null;utm_campaign:string|null;utm_content:string|null;utm_term:string|null;landing_page:string|null;referrer:string|null;gclid:string|null;fbclid:string|null;utm_id:string|null;captured_at:string;is_first_touch:boolean;is_last_touch:boolean;metadata:Json;created_by:string|null;created_at:string}>;
      marketing_spend: Table<Base&{provider:string;source_id:string|null;campaign_id:string|null;ad_group_id:string|null;ad_id:string|null;external_entity_id:string|null;date:string;amount:number;currency:string;impressions:number;reach:number;clicks:number;external_conversions:number;external_data:Json}>;
      marketing_connections: Table<Base&{provider:string;external_account_id:string;name:string;status:"connected"|"disconnected"|"error"|"syncing";last_sync_at:string|null;last_successful_sync_at:string|null;sync_error:string|null}>;
      blog_categories: Table<{id:string;organization_id:string;name:string;slug:string;created_at:string;updated_at:string}>;
      blog_posts: Table<{id:string;organization_id:string;title:string;slug:string;excerpt:string;content:string;cover_image_path:string|null;category_id:string|null;status:"draft"|"published"|"archived";author_id:string;published_at:string|null;seo_title:string|null;seo_description:string|null;created_at:string;updated_at:string;deleted_at:string|null}>;
      permissions: Table<{id:string;key:string;name:string;description:string;module:string;created_at:string}>;
      roles: Table<{id:string;organization_id:string|null;name:string;slug:string;is_system:boolean;created_at:string;updated_at:string}>;
      role_permissions: Table<{role_id:string;permission_id:string}>;
      organization_members: Table<{id:string;organization_id:string;user_id:string;role_id:string;status:"pending"|"invited"|"active"|"suspended"|"inactive";joined_at:string|null;invited_by:string|null;approved_at:string|null;approved_by:string|null;created_at:string;updated_at:string}>;
      audit_logs: Table<{id:string;organization_id:string;user_id:string|null;action:string;entity_type:string;entity_id:string|null;module:string;old_values:Json;new_values:Json;metadata:Json;ip_address:string|null;user_agent:string|null;created_at:string}>;
    };
    Views: Record<string, never>;
    Functions: {
      submit_public_diagnostic: { Args: { submission_data: Json }; Returns: Json };
      public_diagnostic_result: { Args: { result_token: string }; Returns: Json };
      list_diagnostic_submissions: { Args: { page_limit?: number; page_offset?: number }; Returns: Json };
      public_blog_posts: { Args: { search_term?: string | null; category_slug?: string | null; page_offset?: number; page_limit?: number }; Returns: Json };
      public_blog_post: { Args: { post_slug: string }; Returns: Json };
      save_blog_post: { Args: { post_id: string | null; post_title: string; post_slug: string; post_excerpt: string; post_content: string; post_cover_image_path: string | null; post_category_id: string | null; post_seo_title: string | null; post_seo_description: string | null }; Returns: string };
      set_blog_post_status: { Args: { post_id: string; next_status: string }; Returns: undefined };
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
      register_financial_payment: { Args:{ entry_kind:string; target_entry_id:string; target_account_id:string; payment_amount:number; payment_occurred_at:string; payment_method_value:string; payment_reference:string; payment_notes?:string }; Returns:string };
      reverse_financial_transaction: { Args:{target_transaction_id:string}; Returns:undefined };
      generate_recurring_entries: { Args:{target_rule_id:string;through_date:string}; Returns:number };
      upsert_marketing_spend:{Args:{spend_data:Json};Returns:Database["public"]["Tables"]["marketing_spend"]["Row"]};
      capture_lead_acquisition:{Args:{acquisition_data:Json};Returns:Database["public"]["Tables"]["lead_acquisitions"]["Row"]};
      has_permission:{Args:{required_permission:string};Returns:boolean};
      current_authorization:{Args:Record<string,never>;Returns:Json};
      accept_own_invitation:{Args:Record<string,never>;Returns:undefined};
      governance_snapshot:{Args:{audit_limit?:number;audit_offset?:number};Returns:Json};
      change_member_role:{Args:{target_member_id:string;target_role_id:string};Returns:undefined};
      change_member_status:{Args:{target_member_id:string;target_status:string};Returns:undefined};
      update_organization_settings:{Args:{settings_data:Json};Returns:undefined};
      write_invitation_audit:{Args:{invited_user_id:string;invited_role_id:string};Returns:undefined};
      initial_owner_bootstrap_status:{Args:Record<string,never>;Returns:Json};
      claim_initial_owner:{Args:{target_name:string};Returns:Json};
      complete_registration:{Args:Record<string,never>;Returns:Json};
      approve_access_request:{Args:{target_member_id:string;target_role_id:string};Returns:undefined};
      reject_access_request:{Args:{target_member_id:string};Returns:undefined};
      manage_member_invitation:{Args:{actor_user_id:string;target_user_id:string;target_role_id:string;target_action:string};Returns:string};
    };
    Enums: {
      profile_role: "admin" | "manager" | "sales" | "financial" | "member";
      opportunity_status: "open" | "won" | "lost" | "archived";
      task_status: "pending" | "completed" | "cancelled";
    };
    CompositeTypes: Record<string, never>;
  };
};
