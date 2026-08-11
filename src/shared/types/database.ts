export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
type Table<Row> = { Row: Row; Insert: Partial<Row>; Update: Partial<Row>; Relationships: [] };
type Base = { id: string; organization_id: string; created_at: string; updated_at: string };
export type Database = { public: { Tables: {
  organizations: Table<Omit<Base, 'organization_id'> & { name: string; slug: string }>;
  profiles: Table<Base & { name: string; email: string; avatar_url: string | null; role: 'admin'|'manager'|'sales'|'financial'|'member' }>;
  companies: Table<Base & { name: string; lifecycle_stage: 'lead'|'customer'|'inactive'; owner_id: string|null; created_by: string; deleted_at: string|null }>;
  contacts: Table<Base & { company_id: string; name: string; deleted_at: string|null }>;
  pipelines: Table<Base & { name: string; description: string|null; is_default: boolean }>;
  pipeline_stages: Table<Omit<Base,'organization_id'> & { pipeline_id: string; name: string; slug: string; position: number; probability: number; is_won: boolean; is_lost: boolean }>;
  opportunities: Table<Base & { company_id: string; pipeline_id: string; stage_id: string; title: string; value: number; probability: number; status: 'open'|'won'|'lost'|'archived'; lost_reason: string|null; lost_reason_notes: string|null; deleted_at: string|null }>;
  opportunity_stage_history: Table<{ id: string; organization_id: string; opportunity_id: string; from_stage_id: string|null; to_stage_id: string; changed_by: string|null; changed_at: string }>;
  activities: Table<Omit<Base,'updated_at'> & { company_id: string|null; opportunity_id: string|null; user_id: string|null; type: string; title: string; description: string|null; metadata: Json }>;
  tasks: Table<Base & { company_id: string|null; opportunity_id: string|null; title: string; status: 'pending'|'completed'|'cancelled'; due_date: string|null; deleted_at: string|null }>;
  notes: Table<Base & { company_id: string; opportunity_id: string|null; body: string; deleted_at: string|null }>;
}; Views: Record<string, never>; Functions: { current_organization_id: { Args: Record<string, never>; Returns: string }; create_default_pipeline: { Args: { target_organization_id: string }; Returns: string } }; Enums: { profile_role: 'admin'|'manager'|'sales'|'financial'|'member'; opportunity_status: 'open'|'won'|'lost'|'archived'; task_status: 'pending'|'completed'|'cancelled' }; CompositeTypes: Record<string, never> } };
