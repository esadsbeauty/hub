import { supabase } from "@/lib/supabase";
import type { Database, Json } from "@/shared/types/database";
import type {
  ActivityFormData,
  CompanyFormData,
  ContactFormData,
  FollowUpFormData,
  LostOpportunityFormData,
  OpportunityFormData,
  TaskFormData,
} from "./schema";
import type {
  ActivityType,
  Company,
  CompanyContact,
  CompanyNote,
  CrmData,
  LostReason,
  Opportunity,
  OpportunityStageHistory,
  PipelineStage,
  Task,
  TimelineEvent,
} from "./types";
import { localDateTimeToUtc } from "./utils/formatters";
import { defineCrmRepository } from "./repository-contract";

type Tables = Database["public"]["Tables"];
type OrganizationRow = Tables["organizations"]["Row"];
type ProfileRow = Tables["profiles"]["Row"];
type PipelineRow = Tables["pipelines"]["Row"];
type StageRow = Tables["pipeline_stages"]["Row"];
type HistoryRow = Tables["opportunity_stage_history"]["Row"];
type CompanyRow = Tables["companies"]["Row"];
type ContactRow = Tables["contacts"]["Row"];
type OpportunityRow = Tables["opportunities"]["Row"];
type TaskRow = Tables["tasks"]["Row"];
type ActivityRow = Tables["activities"]["Row"];
type NoteRow = Tables["notes"]["Row"];

function client() {
  if (!supabase) throw new Error("Supabase não configurado");
  return supabase;
}
function friendlyError(error: { message: string; code?: string }) {
  console.error("[CRM]", error);
  if (error.code === "23505")
    return new Error("Já existe um registro com essas informações.");
  if (error.code === "23503")
    return new Error(
      "Não foi possível concluir porque existem dados relacionados.",
    );
  return new Error("Não foi possível concluir esta ação. Tente novamente.");
}
function ensure<T>(
  data: T | null,
  error: { message: string; code?: string } | null,
): T {
  if (error) throw friendlyError(error);
  if (data === null) throw new Error("Registro não encontrado.");
  return data;
}
async function context() {
  const api = client();
  const { data: auth } = await api.auth.getUser();
  if (!auth.user) throw new Error("Sessão expirada. Entre novamente.");
  const result = await api
    .from("profiles")
    .select("*")
    .eq("id", auth.user.id)
    .single();
  return ensure(result.data, result.error);
}

function activityType(value: string): ActivityType {
  switch (value) {
    case "company_created":
    case "company_updated":
    case "contact_created":
    case "contact_updated":
    case "opportunity_created":
    case "opportunity_updated":
    case "stage_changed":
    case "followup_created":
    case "followup_completed":
    case "meeting_scheduled":
    case "task_created":
    case "task_completed":
    case "task_cancelled":
    case "task_rescheduled":
    case "note_created":
    case "meeting_completed":
    case "meeting_cancelled":
    case "call_completed":
    case "whatsapp_sent":
    case "email_sent":
    case "owner_changed":
    case "deal_won":
    case "deal_lost":
    case "customer_created":
    case "customer_cancelled":
    case "service_started":
    case "service_paused":
    case "service_cancelled":
    case "onboarding_started":
    case "onboarding_step_completed":
    case "contract_created":
    case "contract_sent":
    case "contract_signed":
    case "contract_expiring":
    case "contract_cancelled":
      return value;
    default:
      return "company_updated";
  }
}
function lostReason(value: string | null): LostReason | undefined {
  switch (value) {
    case "price":
    case "no_response":
    case "no_interest":
    case "competitor":
    case "timing":
    case "no_budget":
    case "unqualified":
    case "other":
      return value;
    default:
      return undefined;
  }
}
function metadata(value: Json): TimelineEvent["metadata"] {
  if (!value || Array.isArray(value) || typeof value !== "object") return {};
  const result: TimelineEvent["metadata"] = {};
  for (const [key, item] of Object.entries(value))
    if (
      item === null ||
      typeof item === "string" ||
      typeof item === "number" ||
      typeof item === "boolean"
    )
      result[key] = item;
  return result;
}
function company(row: CompanyRow, owners: Map<string, string>): Company {
  return {
    id: row.id,
    organizationId: row.organization_id,
    fantasyName: row.name,
    legalName: row.legal_name ?? undefined,
    cnpj: row.cnpj ?? undefined,
    phone: row.phone ?? undefined,
    whatsapp: row.whatsapp ?? undefined,
    instagram: row.instagram ?? undefined,
    facebook: row.facebook ?? undefined,
    website: row.website ?? undefined,
    email: row.email ?? undefined,
    zipCode: row.zip_code ?? undefined,
    address: row.address ?? undefined,
    number: row.address_number ?? undefined,
    complement: row.complement ?? undefined,
    district: row.district ?? undefined,
    city: row.city ?? undefined,
    state: row.state ?? undefined,
    responsibleName: row.responsible_name ?? undefined,
    responsibleRole: row.responsible_role ?? undefined,
    employees: row.employees ?? undefined,
    businessArea: row.business_area ?? undefined,
    leadSource: row.source ?? undefined,
    ownerId: row.owner_id ?? undefined,
    owner: row.owner_id ? owners.get(row.owner_id) : undefined,
    temperature: row.temperature,
    priority: row.priority,
    notes: row.notes ?? undefined,
    tags: row.tags,
    lifecycleStage: row.lifecycle_stage,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastInteractionAt: row.last_interaction_at ?? undefined,
    deletedAt: row.deleted_at,
  };
}
function contact(row: ContactRow): CompanyContact {
  return {
    id: row.id,
    organizationId: row.organization_id,
    companyId: row.company_id,
    name: row.name,
    role: row.role ?? undefined,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    whatsapp: row.whatsapp ?? undefined,
    instagram: row.instagram ?? undefined,
    linkedin: row.linkedin ?? undefined,
    birthDate: row.birth_date ?? undefined,
    notes: row.notes ?? undefined,
    isPrimary: row.is_primary,
    isFinancial: row.is_financial,
    isCommercial: row.is_commercial,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}
function opportunity(
  row: OpportunityRow,
  owners: Map<string, string>,
): Opportunity {
  return {
    id: row.id,
    organizationId: row.organization_id,
    companyId: row.company_id,
    pipelineId: row.pipeline_id,
    stageId: row.stage_id,
    title: row.title,
    description: row.description ?? undefined,
    value: Number(row.value),
    probability: Number(row.probability),
    expectedCloseDate: row.expected_close_date ?? undefined,
    ownerId: row.owner_id ?? undefined,
    owner: row.owner_id ? owners.get(row.owner_id) : undefined,
    source: row.source ?? undefined,
    status: row.status,
    lostReason: lostReason(row.lost_reason),
    lostReasonNotes: row.lost_reason_notes ?? undefined,
    wonAt: row.won_at ?? undefined,
    lostAt: row.lost_at ?? undefined,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    stageEnteredAt: row.stage_entered_at,
    deletedAt: row.deleted_at,
  };
}
function task(row: TaskRow, owners: Map<string, string> = new Map()): Task {
  return {
    id: row.id,
    organizationId: row.organization_id,
    companyId: row.company_id ?? undefined,
    opportunityId: row.opportunity_id ?? undefined,
    assignedTo: row.assigned_to ?? "",
    assigneeName: row.assigned_to ? owners.get(row.assigned_to) : undefined,
    createdBy: row.created_by,
    title: row.title,
    description: row.description ?? undefined,
    type: row.type,
    status: row.status,
    priority: row.priority,
    dueAt: row.due_at ?? row.created_at,
    completedAt: row.completed_at ?? undefined,
    cancelledAt: row.cancelled_at ?? undefined,
    durationMinutes: row.duration_minutes ?? undefined,
    locationType: row.location_type ?? undefined,
    location: row.location ?? undefined,
    meetingUrl: row.meeting_url ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

async function list(): Promise<CrmData> {
  const api = client();
  const profile = await context();
  const results = await Promise.all([
    api
      .from("organizations")
      .select("*")
      .eq("id", profile.organization_id)
      .single(),
    api.from("profiles").select("*"),
    api
      .from("companies")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    api.from("contacts").select("*").is("deleted_at", null),
    api.from("pipelines").select("*"),
    api.from("pipeline_stages").select("*").order("position"),
    api.from("opportunities").select("*").is("deleted_at", null),
    api
      .from("opportunity_stage_history")
      .select("*")
      .order("changed_at", { ascending: false }),
    api
      .from("activities")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500),
    api.from("tasks").select("*").is("deleted_at", null),
    api
      .from("notes")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
  ]);
  const [
    organizationResult,
    profilesResult,
    companiesResult,
    contactsResult,
    pipelinesResult,
    stagesResult,
    opportunitiesResult,
    historyResult,
    activitiesResult,
    tasksResult,
    notesResult,
  ] = results;
  const organization: OrganizationRow = ensure(
    organizationResult.data,
    organizationResult.error,
  );
  const profiles: ProfileRow[] = ensure(
    profilesResult.data,
    profilesResult.error,
  );
  const companyRows: CompanyRow[] = ensure(
    companiesResult.data,
    companiesResult.error,
  );
  const contactRows: ContactRow[] = ensure(
    contactsResult.data,
    contactsResult.error,
  );
  const pipelineRows: PipelineRow[] = ensure(
    pipelinesResult.data,
    pipelinesResult.error,
  );
  const stageRows: StageRow[] = ensure(stagesResult.data, stagesResult.error);
  const opportunityRows: OpportunityRow[] = ensure(
    opportunitiesResult.data,
    opportunitiesResult.error,
  );
  const historyRows: HistoryRow[] = ensure(
    historyResult.data,
    historyResult.error,
  );
  const activityRows: ActivityRow[] = ensure(
    activitiesResult.data,
    activitiesResult.error,
  );
  const taskRows: TaskRow[] = ensure(tasksResult.data, tasksResult.error);
  const noteRows: NoteRow[] = ensure(notesResult.data, notesResult.error);
  const owners = new Map<string, string>(
    profiles.map((item) => [item.id, item.name]),
  );

  return {
    organization: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      timezone: organization.timezone,
      createdAt: organization.created_at,
      updatedAt: organization.updated_at,
    },
    profile: {
      id: profile.id,
      organizationId: profile.organization_id,
      name: profile.name,
      email: profile.email,
      avatarUrl: profile.avatar_url ?? undefined,
      role: profile.role,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
    },
    profiles: profiles.map((item) => ({
      id: item.id,
      organizationId: item.organization_id,
      name: item.name,
      email: item.email,
      avatarUrl: item.avatar_url ?? undefined,
      role: item.role,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    })),
    companies: companyRows.map((item) => company(item, owners)),
    contacts: contactRows.map(contact),
    pipelines: pipelineRows.map((item) => ({
      id: item.id,
      organizationId: item.organization_id,
      name: item.name,
      description: item.description ?? undefined,
      isDefault: item.is_default,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    })),
    stages: stageRows.map(
      (item): PipelineStage => ({
        id: item.id,
        pipelineId: item.pipeline_id,
        name: item.name,
        slug: item.slug,
        position: item.position,
        probability: Number(item.probability),
        isWon: item.is_won,
        isLost: item.is_lost,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      }),
    ),
    opportunities: opportunityRows.map((item) => opportunity(item, owners)),
    stageHistory: historyRows.map(
      (item): OpportunityStageHistory => ({
        id: item.id,
        organizationId: item.organization_id,
        opportunityId: item.opportunity_id,
        fromStageId: item.from_stage_id ?? undefined,
        toStageId: item.to_stage_id,
        changedBy: item.changed_by ?? "",
        changedAt: item.changed_at,
      }),
    ),
    events: activityRows.map(
      (item): TimelineEvent => ({
        id: item.id,
        organizationId: item.organization_id,
        companyId: item.company_id ?? undefined,
        opportunityId: item.opportunity_id ?? undefined,
        userId: item.user_id ?? "",
        user: item.user_id
          ? (owners.get(item.user_id) ?? "Usuário")
          : "Sistema",
        type: activityType(item.type),
        title: item.title,
        description: item.description ?? undefined,
        metadata: metadata(item.metadata),
        createdAt: item.created_at,
      }),
    ),
    tasks: taskRows.map((item) => task(item, owners)),
    activities: [],
    files: [],
    notes: noteRows.map(
      (item): CompanyNote => ({
        id: item.id,
        organizationId: item.organization_id,
        companyId: item.company_id,
        opportunityId: item.opportunity_id ?? undefined,
        text: item.body,
        author: owners.get(item.created_by) ?? "Usuário",
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      }),
    ),
  };
}

function companyPayload(input: Partial<CompanyFormData>) {
  return {
    name: input.fantasyName,
    legal_name: input.legalName,
    cnpj: input.cnpj,
    phone: input.phone,
    whatsapp: input.whatsapp,
    instagram: input.instagram,
    facebook: input.facebook,
    website: input.website,
    email: input.email,
    zip_code: input.zipCode,
    address: input.address,
    address_number: input.number,
    complement: input.complement,
    district: input.district,
    city: input.city,
    state: input.state,
    responsible_name: input.responsibleName,
    responsible_role: input.responsibleRole,
    employees: input.employees,
    business_area: input.businessArea,
    source: input.leadSource,
    temperature: input.temperature,
    priority: input.priority,
    notes: input.notes,
    tags: input.tags
      ?.split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  };
}

export const supabaseCrmRepository = defineCrmRepository({
  list,
  async listTasksRange(from: string, to: string) {
    const profile = await context();
    const profilesResult = await client().from("profiles").select("*");
    const profiles: ProfileRow[] = ensure(
      profilesResult.data,
      profilesResult.error,
    );
    const owners = new Map<string, string>(
      profiles.map((item) => [item.id, item.name]),
    );
    const result = await client()
      .from("tasks")
      .select("*")
      .eq("organization_id", profile.organization_id)
      .gte("due_at", from)
      .lt("due_at", to)
      .is("deleted_at", null)
      .order("due_at");
    return ensure(result.data, result.error).map((item) => task(item, owners));
  },
  async listOverdueTasks(until: string) {
    const profile = await context();
    const profilesResult = await client().from("profiles").select("*");
    const profiles: ProfileRow[] = ensure(
      profilesResult.data,
      profilesResult.error,
    );
    const owners = new Map<string, string>(
      profiles.map((item) => [item.id, item.name]),
    );
    const { data, error } = await client()
      .from("tasks")
      .select("*")
      .eq("organization_id", profile.organization_id)
      .eq("status", "pending")
      .lt("due_at", until)
      .is("deleted_at", null)
      .order("due_at", { ascending: true });
    if (error) throw friendlyError(error);
    return (data ?? []).map((row) => task(row, owners));
  },
  async createCompany(input: CompanyFormData) {
    const profile = await context();
    const payload = companyPayload(input);
    const contactData = input.responsibleName
      ? {
          name: input.responsibleName,
          role: input.responsibleRole,
          phone: input.phone,
          whatsapp: input.whatsapp,
          email: input.email,
          instagram: input.instagram,
        }
      : undefined;
    const result = await client().rpc("create_company_with_primary_contact", {
      company_data: payload,
      contact_data: contactData,
    });
    return company(
      ensure(result.data, result.error),
      new Map([[profile.id, profile.name]]),
    );
  },
  async updateCompany(id: string, input: Partial<CompanyFormData>) {
    const result = await client()
      .from("companies")
      .update(companyPayload(input))
      .eq("id", id)
      .select("*")
      .single();
    const row = ensure(result.data, result.error);
    const profile = await context();
    return company(row, new Map([[profile.id, profile.name]]));
  },
  async deleteCompany(id: string) {
    const result = await client()
      .from("companies")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (result.error) throw friendlyError(result.error);
  },
  async duplicateCompany(id: string) {
    const sourceResult = await client()
      .from("companies")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();
    const profile = await context();
    const source = company(
      ensure(sourceResult.data, sourceResult.error),
      new Map([[profile.id, profile.name]]),
    );
    return this.createCompany({
      fantasyName: `${source.fantasyName} (cópia)`,
      legalName: source.legalName,
      cnpj: source.cnpj,
      phone: source.phone,
      whatsapp: source.whatsapp,
      instagram: source.instagram,
      facebook: source.facebook,
      website: source.website,
      email: source.email,
      zipCode: source.zipCode,
      address: source.address,
      number: source.number,
      complement: source.complement,
      district: source.district,
      city: source.city,
      state: source.state,
      responsibleName: source.responsibleName,
      responsibleRole: source.responsibleRole,
      employees: source.employees,
      businessArea: source.businessArea,
      leadSource: source.leadSource,
      owner: source.owner,
      temperature: source.temperature,
      priority: source.priority,
      notes: source.notes,
      tags: source.tags.join(", "),
    });
  },
  async createOpportunity(input: OpportunityFormData) {
    const profile = await context();
    const result = await client()
      .from("opportunities")
      .insert({
        organization_id: profile.organization_id,
        company_id: input.companyId,
        pipeline_id: input.pipelineId,
        stage_id: input.stageId,
        title: input.title,
        description: input.description,
        value: input.value,
        probability: input.probability,
        expected_close_date: input.expectedCloseDate || null,
        owner_id: profile.id,
        source: input.source,
        created_by: profile.id,
      })
      .select("*")
      .single();
    return opportunity(
      ensure(result.data, result.error),
      new Map([[profile.id, profile.name]]),
    );
  },
  async updateOpportunity(id: string, input: Partial<OpportunityFormData>) {
    const result = await client()
      .from("opportunities")
      .update({
        company_id: input.companyId,
        pipeline_id: input.pipelineId,
        stage_id: input.stageId,
        title: input.title,
        description: input.description,
        value: input.value,
        probability: input.probability,
        expected_close_date: input.expectedCloseDate || null,
        source: input.source,
      })
      .eq("id", id)
      .select("*")
      .single();
    const profile = await context();
    return opportunity(
      ensure(result.data, result.error),
      new Map([[profile.id, profile.name]]),
    );
  },
  async moveOpportunity(id: string, stageId: string) {
    const stageResult = await client()
      .from("pipeline_stages")
      .select("*")
      .eq("id", stageId)
      .single();
    const stage = ensure(stageResult.data, stageResult.error);
    const status = stage.is_won ? "won" : stage.is_lost ? "lost" : "open";
    const changedAt = new Date().toISOString();
    const result = await client()
      .from("opportunities")
      .update({
        stage_id: stageId,
        probability: Number(stage.probability),
        status,
        won_at: stage.is_won ? changedAt : null,
        lost_at: stage.is_lost ? changedAt : null,
      })
      .eq("id", id)
      .select("*")
      .single();
    return opportunity(ensure(result.data, result.error), new Map());
  },
  async markOpportunityWon(id: string) {
    const activation = await client().rpc(
      "activate_customer_from_won_opportunity",
      { target_opportunity_id: id },
    );
    if (activation.error) throw friendlyError(activation.error);
    const updated = await client()
      .from("opportunities")
      .select("*")
      .eq("id", id)
      .single();
    return opportunity(ensure(updated.data, updated.error), new Map());
  },
  async markOpportunityLost(id: string, input: LostOpportunityFormData) {
    const currentResult = await client()
      .from("opportunities")
      .select("pipeline_id")
      .eq("id", id)
      .single();
    const current = ensure(currentResult.data, currentResult.error);
    const stageResult = await client()
      .from("pipeline_stages")
      .select("*")
      .eq("pipeline_id", current.pipeline_id)
      .eq("is_lost", true)
      .single();
    const stage = ensure(stageResult.data, stageResult.error);
    const changedAt = new Date().toISOString();
    const result = await client()
      .from("opportunities")
      .update({
        stage_id: stage.id,
        probability: Number(stage.probability),
        status: "lost",
        lost_at: changedAt,
        won_at: null,
        lost_reason: input.reason,
        lost_reason_notes: input.notes,
      })
      .eq("id", id);
    if (result.error) throw friendlyError(result.error);
  },
  async archiveOpportunity(id: string) {
    const result = await client()
      .from("opportunities")
      .update({ status: "archived", deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (result.error) throw friendlyError(result.error);
  },
  async duplicateOpportunity(id: string) {
    const sourceResult = await client()
      .from("opportunities")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();
    const source = opportunity(
      ensure(sourceResult.data, sourceResult.error),
      new Map(),
    );
    return this.createOpportunity({
      companyId: source.companyId,
      pipelineId: source.pipelineId,
      stageId: source.stageId,
      title: `${source.title} (cópia)`,
      description: source.description,
      value: source.value,
      probability: source.probability,
      expectedCloseDate: source.expectedCloseDate,
      owner: source.owner,
      source: source.source,
    });
  },
  async createContact(companyId: string, input: ContactFormData) {
    const profile = await context();
    const result = await client()
      .from("contacts")
      .insert({
        organization_id: profile.organization_id,
        company_id: companyId,
        name: input.name,
        role: input.role,
        email: input.email,
        phone: input.phone,
        whatsapp: input.whatsapp,
        instagram: input.instagram,
        linkedin: input.linkedin,
        birth_date: input.birthDate || null,
        notes: input.notes,
        is_primary: false,
        is_financial: input.isFinancial,
        is_commercial: input.isCommercial,
        status: input.status,
      })
      .select("*")
      .single();
    const created = ensure(result.data, result.error);
    if (input.isPrimary) {
      const rpc = await client().rpc("set_primary_contact", {
        target_contact_id: created.id,
      });
      if (rpc.error) throw friendlyError(rpc.error);
      return contact({ ...created, is_primary: true });
    }
    return contact(created);
  },
  async updateContact(id: string, input: Partial<ContactFormData>) {
    if (input.isPrimary) {
      const rpc = await client().rpc("set_primary_contact", {
        target_contact_id: id,
      });
      if (rpc.error) throw friendlyError(rpc.error);
    }
    const result = await client()
      .from("contacts")
      .update({
        name: input.name,
        role: input.role,
        email: input.email,
        phone: input.phone,
        whatsapp: input.whatsapp,
        instagram: input.instagram,
        linkedin: input.linkedin,
        birth_date: input.birthDate || null,
        notes: input.notes,
        is_financial: input.isFinancial,
        is_commercial: input.isCommercial,
        status: input.status,
      })
      .eq("id", id);
    if (result.error) throw friendlyError(result.error);
  },
  async deleteContact(id: string) {
    const result = await client()
      .from("contacts")
      .update({ deleted_at: new Date().toISOString(), is_primary: false })
      .eq("id", id);
    if (result.error) throw friendlyError(result.error);
  },
  async createTask(input: TaskFormData) {
    const profile = await context();
    const result = await client()
      .from("tasks")
      .insert({
        organization_id: profile.organization_id,
        company_id: input.companyId || null,
        opportunity_id: input.opportunityId || null,
        assigned_to: input.assignedTo,
        created_by: profile.id,
        title: input.title,
        description: input.description,
        type: input.type,
        status: "pending",
        priority: input.priority,
        due_at: localDateTimeToUtc(input.date, input.time),
        duration_minutes: input.durationMinutes,
        location_type: input.locationType,
        location: input.location,
        meeting_url: input.meetingUrl || null,
      })
      .select("*")
      .single();
    return task(
      ensure(result.data, result.error),
      new Map([[profile.id, profile.name]]),
    );
  },
  async createFollowUp(
    companyId: string,
    input: FollowUpFormData,
    opportunityId?: string,
  ) {
    const profile = await context();
    const type =
      input.type === "ligacao"
        ? "call"
        : input.type === "reuniao"
          ? "meeting"
          : input.type;
    const status =
      input.status === "concluido"
        ? "completed"
        : input.status === "cancelado"
          ? "cancelled"
          : "pending";
    const result = await client()
      .from("tasks")
      .insert({
        organization_id: profile.organization_id,
        company_id: companyId,
        opportunity_id: opportunityId,
        assigned_to: profile.id,
        created_by: profile.id,
        title: input.title,
        description: input.description ?? input.notes,
        type,
        status,
        priority:
          input.priority === "baixa"
            ? "low"
            : input.priority === "alta"
              ? "high"
              : "medium",
        due_at: localDateTimeToUtc(input.date, input.time),
      })
      .select("*")
      .single();
    return task(ensure(result.data, result.error));
  },
  async updateFollowUp(id: string, input: Partial<FollowUpFormData>) {
    const priority = input.priority
      ? input.priority === "baixa"
        ? "low"
        : input.priority === "alta"
          ? "high"
          : "medium"
      : undefined;
    const result = await client()
      .from("tasks")
      .update({
        title: input.title,
        description: input.description ?? input.notes,
        priority,
        due_at:
          input.date && input.time
            ? localDateTimeToUtc(input.date, input.time)
            : undefined,
      })
      .eq("id", id);
    if (result.error) throw friendlyError(result.error);
  },
  async completeTask(id: string) {
    const result = await client().rpc("complete_task", { target_task_id: id });
    return task(ensure(result.data, result.error));
  },
  async rescheduleTask(id: string, dueAt: string) {
    const result = await client().rpc("reschedule_task", {
      target_task_id: id,
      new_due_at: dueAt,
    });
    return task(ensure(result.data, result.error));
  },
  async cancelTask(id: string) {
    const result = await client().rpc("cancel_task", { target_task_id: id });
    return task(ensure(result.data, result.error));
  },
  async addNote(companyId: string, text: string, opportunityId?: string) {
    const profile = await context();
    const result = await client()
      .from("notes")
      .insert({
        organization_id: profile.organization_id,
        company_id: companyId,
        opportunity_id: opportunityId,
        created_by: profile.id,
        body: text,
      })
      .select("*")
      .single();
    const row = ensure(result.data, result.error);
    return {
      id: row.id,
      organizationId: row.organization_id,
      companyId: row.company_id,
      opportunityId: row.opportunity_id ?? undefined,
      text: row.body,
      author: profile.name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },
  async createActivity(companyId: string, input: ActivityFormData) {
    const profile = await context();
    const type: ActivityType =
      input.type === "ligacao"
        ? "call_completed"
        : input.type === "whatsapp"
          ? "whatsapp_sent"
          : input.type === "reuniao" || input.type === "videochamada"
            ? "meeting_completed"
            : "task_completed";
    const result = await client()
      .from("activities")
      .insert({
        organization_id: profile.organization_id,
        company_id: companyId,
        user_id: profile.id,
        type,
        title: input.title,
        description: input.description,
        metadata: { date: input.date, time: input.time, owner: input.owner },
        created_at: localDateTimeToUtc(input.date, input.time),
      });
    if (result.error) throw friendlyError(result.error);
    return input;
  },
});
