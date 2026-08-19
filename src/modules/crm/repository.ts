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
  CommercialActivity,
  Company,
  CompanyContact,
  CompanyFile,
  CompanyNote,
  CrmData,
  Opportunity,
  OpportunityStageHistory,
  PipelineStage,
  Task,
  TaskPriority,
  TimelineEvent,
} from "./types";
import { localDateTimeToUtc } from "./utils/formatters";
import { defineCrmRepository } from "./repository-contract";

const STORAGE = "esads-hub-local-v1:crm";
const LEGACY_STORAGE = "esads_crm_data_v3";
const ORGANIZATION_ID = "local-esads-beauty";
const USER_ID = "local-owner";
const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();
const taskPriority = (value: string): TaskPriority =>
  value === "baixa" || value === "low"
    ? "low"
    : value === "alta" || value === "high"
      ? "high"
      : value === "urgent"
        ? "urgent"
        : "medium";
const tags = (value?: string) =>
  value
    ?.split(",")
    .map((tag) => tag.trim())
    .filter(Boolean) ?? [];

function activity(
  type: ActivityType,
  title: string,
  companyId?: string,
  opportunityId?: string,
  description?: string,
  metadata: TimelineEvent["metadata"] = {},
): TimelineEvent {
  return {
    id: id(),
    organizationId: ORGANIZATION_ID,
    companyId,
    opportunityId,
    userId: USER_ID,
    user: "Administrador",
    type,
    title,
    description,
    metadata,
    createdAt: now(),
  };
}
function seed(): CrmData {
  const createdAt = now();
  const pipelineId = id();
  const names = [
    "Novo Lead",
    "Pesquisado",
    "Primeiro Contato",
    "Aguardando Resposta",
    "Em Conversa",
    "Reunião Agendada",
    "Proposta Enviada",
    "Negociação",
    "Cliente Fechado",
    "Perdido",
  ];
  const stages = names.map(
    (name, position): PipelineStage => ({
      id: id(),
      pipelineId,
      name,
      slug: [
        "novo_lead",
        "pesquisado",
        "primeiro_contato",
        "aguardando_resposta",
        "em_conversa",
        "reuniao_agendada",
        "proposta_enviada",
        "negociacao",
        "cliente_fechado",
        "perdido",
      ][position],
      position,
      probability: [10, 15, 20, 25, 35, 50, 65, 80, 100, 0][position],
      isWon: position === 8,
      isLost: position === 9,
      createdAt,
      updatedAt: createdAt,
    }),
  );
  return {
    organization: {
      id: ORGANIZATION_ID,
      name: "ESADS Beauty",
      slug: "esads-beauty",
      timezone: "America/Sao_Paulo",
      createdAt,
      updatedAt: createdAt,
    },
    profile: {
      id: USER_ID,
      organizationId: ORGANIZATION_ID,
      name: "Administrador",
      email: "admin@esadsbeauty.local",
      role: "admin",
      createdAt,
      updatedAt: createdAt,
    },
    profiles: [
      {
        id: USER_ID,
        organizationId: ORGANIZATION_ID,
        name: "Administrador",
        email: "admin@esadsbeauty.local",
        role: "admin",
        createdAt,
        updatedAt: createdAt,
      },
    ],
    companies: [],
    contacts: [],
    pipelines: [
      {
        id: pipelineId,
        organizationId: ORGANIZATION_ID,
        name: "Pipeline Comercial",
        description: "Pipeline padrão da ESADS Beauty",
        isDefault: true,
        createdAt,
        updatedAt: createdAt,
      },
    ],
    stages,
    opportunities: [],
    stageHistory: [],
    events: [],
    tasks: [],
    activities: [],
    files: [],
    notes: [],
  };
}
function read(): CrmData {
  const raw = localStorage.getItem(STORAGE) ?? localStorage.getItem(LEGACY_STORAGE);
  if (!raw) {
    const data = seed();
    write(data);
    return data;
  }
  const stored = JSON.parse(raw) as CrmData;
  return {
    ...stored,
    organization: {
      ...stored.organization,
      timezone: stored.organization.timezone ?? "America/Sao_Paulo",
    },
    stageHistory: stored.stageHistory ?? [],
    profiles: stored.profiles ?? [stored.profile],
    tasks: (stored.tasks ?? []).map((task) => {
      return {
        ...task,
        dueAt: task.dueAt ?? legacyDueAt(task) ?? task.createdAt,
        priority: taskPriority(task.priority),
        assigneeName: task.assigneeName ?? "Administrador",
      };
    }),
  };
}
function write(data: CrmData) {
  localStorage.setItem(STORAGE, JSON.stringify(data));
}
function legacyDueAt(task: Task) {
  if ("dueDate" in task && typeof task.dueDate === "string")
    return task.dueDate;
  return undefined;
}
function companyInput(input: CompanyFormData) {
  const { tags: tagList, ...company } = input;
  return { ...company, tags: tags(tagList) };
}

export const crmRepository = defineCrmRepository({
  async list() {
    return read();
  },
  async listTasksRange(from: string, to: string) {
    return read().tasks.filter(
      (task) => !task.deletedAt && task.dueAt >= from && task.dueAt < to,
    );
  },
  async listOverdueTasks(until: string) {
    return read().tasks.filter(
      (task) =>
        !task.deletedAt && task.status === "pending" && task.dueAt < until,
    );
  },
  async createCompany(input: CompanyFormData) {
    const data = read();
    const createdAt = now();
    const company: Company = {
      id: id(),
      organizationId: ORGANIZATION_ID,
      ...companyInput(input),
      lifecycleStage: "lead",
      createdBy: USER_ID,
      createdAt,
      updatedAt: createdAt,
    };
    data.companies.unshift(company);
    data.events.unshift(
      activity(
        "company_created",
        "Empresa criada",
        company.id,
        undefined,
        company.fantasyName,
      ),
    );
    if (input.responsibleName) {
      const contact: CompanyContact = {
        id: id(),
        organizationId: ORGANIZATION_ID,
        companyId: company.id,
        name: input.responsibleName,
        role: input.responsibleRole,
        phone: input.phone,
        whatsapp: input.whatsapp,
        email: input.email,
        instagram: input.instagram,
        isPrimary: true,
        isFinancial: false,
        isCommercial: true,
        status: "ativo",
        createdAt,
        updatedAt: createdAt,
      };
      data.contacts.unshift(contact);
      data.events.unshift(
        activity(
          "contact_created",
          "Contato principal criado",
          company.id,
          undefined,
          contact.name,
        ),
      );
    }
    write(data);
    return company;
  },
  async updateCompany(companyId: string, input: Partial<CompanyFormData>) {
    const data = read();
    const existing = data.companies.find((company) => company.id === companyId);
    if (!existing) throw new Error("Empresa não encontrada");
    const { tags: tagList, ...patch } = input;
    const updated = {
      ...existing,
      ...patch,
      tags: tagList === undefined ? existing.tags : tags(tagList),
      updatedAt: now(),
      lastInteractionAt: now(),
    };
    data.companies = data.companies.map((company) =>
      company.id === companyId ? updated : company,
    );
    data.events.unshift(
      activity(
        "company_updated",
        "Empresa atualizada",
        companyId,
        undefined,
        existing.fantasyName,
      ),
    );
    write(data);
    return updated;
  },
  async deleteCompany(companyId: string) {
    const data = read();
    data.companies = data.companies.map((company) =>
      company.id === companyId
        ? { ...company, deletedAt: now(), updatedAt: now() }
        : company,
    );
    data.opportunities = data.opportunities.map((item) =>
      item.companyId === companyId
        ? { ...item, status: "archived", deletedAt: now(), updatedAt: now() }
        : item,
    );
    write(data);
  },
  async duplicateCompany(companyId: string) {
    const source = read().companies.find((company) => company.id === companyId);
    if (!source) throw new Error("Empresa não encontrada");
    return this.createCompany({
      ...source,
      fantasyName: `${source.fantasyName} (cópia)`,
      tags: source.tags.join(", "),
    });
  },
  async createOpportunity(input: OpportunityFormData) {
    const data = read();
    const createdAt = now();
    const stage = data.stages.find(
      (item) =>
        item.id === input.stageId && item.pipelineId === input.pipelineId,
    );
    if (!stage) throw new Error("Etapa inválida para o pipeline selecionado");
    const opportunity: Opportunity = {
      id: id(),
      organizationId: ORGANIZATION_ID,
      ...input,
      probability: input.probability,
      ownerId: USER_ID,
      status: "open",
      createdBy: USER_ID,
      createdAt,
      updatedAt: createdAt,
      stageEnteredAt: createdAt,
    };
    data.opportunities.unshift(opportunity);
    data.events.unshift(
      activity(
        "opportunity_created",
        "Oportunidade criada",
        input.companyId,
        opportunity.id,
        `${opportunity.title} · ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(opportunity.value)}`,
      ),
    );
    write(data);
    return opportunity;
  },
  async updateOpportunity(
    opportunityId: string,
    input: Partial<OpportunityFormData>,
  ): Promise<Opportunity> {
    const data = read();
    const current = data.opportunities.find(
      (item) => item.id === opportunityId,
    );
    if (!current) throw new Error("Oportunidade não encontrada");
    if (input.stageId && input.stageId !== current.stageId) {
      const { stageId, ...remaining } = input;
      await this.moveOpportunity(opportunityId, stageId);
      return this.updateOpportunity(opportunityId, remaining);
    }
    const updated = { ...current, ...input, updatedAt: now() };
    data.opportunities = data.opportunities.map((item) =>
      item.id === opportunityId ? updated : item,
    );
    write(data);
    return updated;
  },
  async duplicateOpportunity(opportunityId: string) {
    const source = read().opportunities.find(
      (item) => item.id === opportunityId,
    );
    if (!source) throw new Error("Oportunidade não encontrada");
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
  async moveOpportunity(opportunityId: string, stageId: string) {
    const data = read();
    const stage = data.stages.find((item) => item.id === stageId);
    const current = data.opportunities.find(
      (item) => item.id === opportunityId,
    );
    if (!stage || !current || stage.pipelineId !== current.pipelineId)
      throw new Error("Oportunidade ou etapa não encontrada");
    if (current.stageId === stageId) return current;
    const previous = data.stages.find((item) => item.id === current.stageId);
    const changedAt = now();
    const status = stage.isWon ? "won" : stage.isLost ? "lost" : "open";
    const updated: Opportunity = {
      ...current,
      stageId,
      probability: stage.probability,
      status,
      wonAt: stage.isWon ? changedAt : undefined,
      lostAt: stage.isLost ? changedAt : undefined,
      stageEnteredAt: changedAt,
      updatedAt: changedAt,
    };
    data.opportunities = data.opportunities.map((item) =>
      item.id === opportunityId ? updated : item,
    );
    const history: OpportunityStageHistory = {
      id: id(),
      organizationId: ORGANIZATION_ID,
      opportunityId,
      fromStageId: current.stageId,
      toStageId: stageId,
      changedBy: USER_ID,
      changedAt,
    };
    data.stageHistory.unshift(history);
    if (stage.isWon)
      data.companies = data.companies.map((company) =>
        company.id === current.companyId
          ? { ...company, lifecycleStage: "customer", updatedAt: changedAt }
          : company,
      );
    data.events.unshift(
      activity(
        stage.isWon ? "deal_won" : stage.isLost ? "deal_lost" : "stage_changed",
        stage.isWon
          ? "Negócio ganho"
          : stage.isLost
            ? "Negócio perdido"
            : "Etapa atualizada",
        current.companyId,
        current.id,
        `${previous?.name ?? "Etapa anterior"} → ${stage.name}`,
        { fromStage: previous?.name ?? null, toStage: stage.name },
      ),
    );
    write(data);
    return updated;
  },
  async markOpportunityWon(opportunityId: string) {
    const data = read();
    const opportunity = data.opportunities.find(
      (item) => item.id === opportunityId,
    );
    if (!opportunity) throw new Error("Oportunidade não encontrada");
    const wonStage = data.stages.find(
      (item) => item.pipelineId === opportunity.pipelineId && item.isWon,
    );
    if (!wonStage) throw new Error("Pipeline sem etapa de ganho");
    return this.moveOpportunity(opportunityId, wonStage.id);
  },
  async markOpportunityLost(
    opportunityId: string,
    input: LostOpportunityFormData,
  ) {
    const data = read();
    const opportunity = data.opportunities.find(
      (item) => item.id === opportunityId,
    );
    if (!opportunity) throw new Error("Oportunidade não encontrada");
    const lostStage = data.stages.find(
      (item) => item.pipelineId === opportunity.pipelineId && item.isLost,
    );
    if (!lostStage) throw new Error("Pipeline sem etapa de perda");
    await this.moveOpportunity(opportunityId, lostStage.id);
    const refreshed = read();
    refreshed.opportunities = refreshed.opportunities.map((item) =>
      item.id === opportunityId
        ? {
            ...item,
            lostReason: input.reason,
            lostReasonNotes: input.notes,
            updatedAt: now(),
          }
        : item,
    );
    write(refreshed);
  },
  async archiveOpportunity(opportunityId: string) {
    const data = read();
    data.opportunities = data.opportunities.map((item) =>
      item.id === opportunityId
        ? { ...item, status: "archived", deletedAt: now(), updatedAt: now() }
        : item,
    );
    write(data);
  },
  async createContact(companyId: string, input: ContactFormData) {
    const data = read();
    const contact: CompanyContact = {
      id: id(),
      organizationId: ORGANIZATION_ID,
      companyId,
      ...input,
      createdAt: now(),
      updatedAt: now(),
    };
    if (contact.isPrimary)
      data.contacts = data.contacts.map((item) =>
        item.companyId === companyId ? { ...item, isPrimary: false } : item,
      );
    data.contacts.unshift(contact);
    data.events.unshift(
      activity(
        "contact_created",
        "Contato criado",
        companyId,
        undefined,
        contact.name,
      ),
    );
    write(data);
    return contact;
  },
  async updateContact(contactId: string, input: Partial<ContactFormData>) {
    const data = read();
    const current = data.contacts.find((item) => item.id === contactId);
    if (!current) throw new Error("Contato não encontrado");
    if (input.isPrimary)
      data.contacts = data.contacts.map((item) =>
        item.companyId === current.companyId
          ? { ...item, isPrimary: item.id === contactId, updatedAt: now() }
          : item,
      );
    data.contacts = data.contacts.map((item) =>
      item.id === contactId ? { ...item, ...input, updatedAt: now() } : item,
    );
    write(data);
  },
  async deleteContact(contactId: string) {
    const data = read();
    data.contacts = data.contacts.map((item) =>
      item.id === contactId
        ? { ...item, deletedAt: now(), updatedAt: now() }
        : item,
    );
    write(data);
  },
  async createTask(input: TaskFormData) {
    const data = read();
    const createdAt = now();
    const task: Task = {
      id: id(),
      organizationId: ORGANIZATION_ID,
      companyId: input.companyId || undefined,
      opportunityId: input.opportunityId || undefined,
      assignedTo: input.assignedTo,
      assigneeName: data.profile.name,
      createdBy: USER_ID,
      title: input.title,
      description: input.description,
      type: input.type,
      status: "pending",
      priority: input.priority,
      dueAt: localDateTimeToUtc(input.date, input.time),
      durationMinutes: input.durationMinutes,
      locationType: input.locationType,
      location: input.location,
      meetingUrl: input.meetingUrl || undefined,
      createdAt,
      updatedAt: createdAt,
    };
    data.tasks.unshift(task);
    data.events.unshift(
      activity(
        task.type === "meeting"
          ? "meeting_scheduled"
          : task.type === "follow_up"
            ? "followup_created"
            : "task_created",
        task.type === "meeting"
          ? "Reunião agendada"
          : task.type === "follow_up"
            ? "Follow-up criado"
            : "Tarefa criada",
        task.companyId,
        task.opportunityId,
        task.title,
      ),
    );
    write(data);
    return task;
  },
  async createFollowUp(
    companyId: string,
    input: FollowUpFormData,
    opportunityId?: string,
  ) {
    const data = read();
    const task: Task = {
      id: id(),
      organizationId: ORGANIZATION_ID,
      companyId,
      opportunityId,
      assignedTo: USER_ID,
      assigneeName: data.profile.name,
      createdBy: USER_ID,
      title: input.title,
      description: input.description ?? input.notes,
      type:
        input.type === "ligacao"
          ? "call"
          : input.type === "reuniao"
            ? "meeting"
            : input.type,
      status:
        input.status === "concluido"
          ? "completed"
          : input.status === "cancelado"
            ? "cancelled"
            : "pending",
      priority: taskPriority(input.priority),
      dueAt: localDateTimeToUtc(input.date, input.time),
      createdAt: now(),
      updatedAt: now(),
    };
    data.tasks.unshift(task);
    data.events.unshift(
      activity(
        "followup_created",
        "Follow-up criado",
        companyId,
        opportunityId,
        task.title,
      ),
    );
    write(data);
    return task;
  },
  async updateFollowUp(taskId: string, input: Partial<FollowUpFormData>) {
    const data = read();
    data.tasks = data.tasks.map((task) =>
      task.id === taskId
        ? {
            ...task,
            title: input.title ?? task.title,
            description: input.description ?? task.description,
            status:
              input.status === "concluido"
                ? "completed"
                : input.status === "cancelado"
                  ? "cancelled"
                  : task.status,
            updatedAt: now(),
          }
        : task,
    );
    write(data);
  },
  async createActivity(companyId: string, input: ActivityFormData) {
    const data = read();
    const item: CommercialActivity = {
      id: id(),
      organizationId: ORGANIZATION_ID,
      companyId,
      ...input,
      createdAt: now(),
      updatedAt: now(),
    };
    data.activities.unshift(item);
    const eventType: ActivityType =
      input.type === "ligacao"
        ? "call_completed"
        : input.type === "whatsapp"
          ? "whatsapp_sent"
          : input.type === "reuniao" || input.type === "videochamada"
            ? "meeting_completed"
            : "task_completed";
    const event = activity(
      eventType,
      input.title,
      companyId,
      undefined,
      input.description,
    );
    event.createdAt = localDateTimeToUtc(input.date, input.time);
    data.events.unshift(event);
    write(data);
    return item;
  },
  async completeTask(taskId: string) {
    const data = read();
    const task = data.tasks.find((item) => item.id === taskId);
    if (!task) throw new Error("Tarefa não encontrada");
    const completedAt = now();
    data.tasks = data.tasks.map((item) =>
      item.id === taskId
        ? { ...item, status: "completed", completedAt, updatedAt: completedAt }
        : item,
    );
    const eventType: ActivityType =
      task.type === "follow_up"
        ? "followup_completed"
        : task.type === "meeting"
          ? "meeting_completed"
          : task.type === "call"
            ? "call_completed"
            : task.type === "whatsapp"
              ? "whatsapp_sent"
              : task.type === "email"
                ? "email_sent"
                : "task_completed";
    data.events.unshift(
      activity(
        eventType,
        task.type === "follow_up" ? "Follow-up concluído" : "Tarefa concluída",
        task.companyId,
        task.opportunityId,
        task.title,
      ),
    );
    write(data);
    const updated = data.tasks.find((item) => item.id === taskId);
    if (!updated) throw new Error("Tarefa atualizada não encontrada");
    return updated;
  },
  async rescheduleTask(taskId: string, dueAt: string) {
    const data = read();
    const task = data.tasks.find((item) => item.id === taskId);
    if (!task || task.status !== "pending")
      throw new Error("Tarefa pendente não encontrada");
    data.tasks = data.tasks.map((item) =>
      item.id === taskId ? { ...item, dueAt, updatedAt: now() } : item,
    );
    data.events.unshift(
      activity(
        "task_rescheduled",
        "Tarefa reagendada",
        task.companyId,
        task.opportunityId,
        task.title,
        { old_due_at: task.dueAt, new_due_at: dueAt },
      ),
    );
    write(data);
    const updated = data.tasks.find((item) => item.id === taskId);
    if (!updated) throw new Error("Tarefa atualizada não encontrada");
    return updated;
  },
  async cancelTask(taskId: string) {
    const data = read();
    const task = data.tasks.find((item) => item.id === taskId);
    if (!task || task.status !== "pending")
      throw new Error("Tarefa pendente não encontrada");
    const cancelledAt = now();
    data.tasks = data.tasks.map((item) =>
      item.id === taskId
        ? { ...item, status: "cancelled", cancelledAt, updatedAt: cancelledAt }
        : item,
    );
    data.events.unshift(
      activity(
        task.type === "meeting" ? "meeting_cancelled" : "task_cancelled",
        task.type === "meeting" ? "Reunião cancelada" : "Tarefa cancelada",
        task.companyId,
        task.opportunityId,
        task.title,
      ),
    );
    write(data);
    const updated = data.tasks.find((item) => item.id === taskId);
    if (!updated) throw new Error("Tarefa atualizada não encontrada");
    return updated;
  },
  async addNote(companyId: string, text: string, opportunityId?: string) {
    const data = read();
    const note: CompanyNote = {
      id: id(),
      organizationId: ORGANIZATION_ID,
      companyId,
      opportunityId,
      text,
      author: "Administrador",
      createdAt: now(),
      updatedAt: now(),
    };
    data.notes.unshift(note);
    data.events.unshift(
      activity(
        "note_created",
        "Observação criada",
        companyId,
        opportunityId,
        text,
      ),
    );
    write(data);
    return note;
  },
  async addFile(
    companyId: string,
    file: Omit<
      CompanyFile,
      "id" | "organizationId" | "companyId" | "user" | "createdAt"
    >,
  ) {
    const data = read();
    const item: CompanyFile = {
      id: id(),
      organizationId: ORGANIZATION_ID,
      companyId,
      user: "Administrador",
      createdAt: now(),
      ...file,
    };
    data.files.unshift(item);
    write(data);
    return item;
  },
});

// Domain-facing repositories keep hooks independent from the preview storage implementation.
export const companyRepository = {
  list: crmRepository.list,
  create: crmRepository.createCompany,
  update: crmRepository.updateCompany,
  archive: crmRepository.deleteCompany,
  duplicate: (id: string) => crmRepository.duplicateCompany(id),
};
export const contactRepository = {
  create: crmRepository.createContact,
  update: crmRepository.updateContact,
  archive: crmRepository.deleteContact,
};
export const opportunityRepository = {
  create: crmRepository.createOpportunity,
  update: (id: string, input: Partial<OpportunityFormData>) =>
    crmRepository.updateOpportunity(id, input),
  duplicate: (id: string) => crmRepository.duplicateOpportunity(id),
  move: (id: string, stageId: string) =>
    crmRepository.moveOpportunity(id, stageId),
  markWon: (id: string) => crmRepository.markOpportunityWon(id),
  markLost: (id: string, input: LostOpportunityFormData) =>
    crmRepository.markOpportunityLost(id, input),
  archive: crmRepository.archiveOpportunity,
};
export const taskRepository = {
  createTask: crmRepository.createTask,
  create: crmRepository.createFollowUp,
  update: crmRepository.updateFollowUp,
  complete: crmRepository.completeTask,
  reschedule: crmRepository.rescheduleTask,
  cancel: crmRepository.cancelTask,
};
export const activityRepository = {
  create: crmRepository.createActivity,
  addNote: crmRepository.addNote,
};
export const fileRepository = { add: crmRepository.addFile };
