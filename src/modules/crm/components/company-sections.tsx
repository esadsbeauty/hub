import { ExternalLink, Mail, MessageCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/shared/components/feedback/states";
import {
  PriorityBadge,
  StatusBadge,
} from "@/shared/components/data-display/status-badges";
import type {
  Company,
  CompanyContact,
  CompanyNote,
  Opportunity,
  Pipeline,
  PipelineStage,
  Task,
  TimelineEvent,
} from "../types";
import { currency, formatDateTime } from "../utils/formatters";
import { ActivityTimeline } from "./activity-timeline";
import { TaskCard } from "./task-card";
export function CompanyOverview({
  businessMode = "b2b",
  company,
  contacts,
  opportunities,
  tasks,
  events,
  notes,
}: {
  businessMode?: "b2c" | "b2b";
  company: Company;
  contacts: CompanyContact[];
  opportunities: Opportunity[];
  tasks: Task[];
  events: TimelineEvent[];
  notes: CompanyNote[];
}) {
  const primary = contacts.find((item) => item.isPrimary);
  const open = opportunities.filter((item) => item.status === "open");
  const next = [...tasks]
    .filter((item) => item.status === "pending" && item.type === "follow_up")
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{businessMode==="b2c"?"Dados do Lead":"Informações da empresa"}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          {company.whatsapp && (
            <a
              className="flex items-center gap-2 hover:text-champagne-dark"
              href={`https://wa.me/${company.whatsapp.replace(/\D/g, "")}`}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle size={15} /> {company.whatsapp}
            </a>
          )}
          {company.email && (
            <a
              className="flex items-center gap-2 hover:text-champagne-dark"
              href={`mailto:${company.email}`}
            >
              <Mail size={15} /> {company.email}
            </a>
          )}
          {company.instagram && (
            <a
              className="flex items-center gap-2 hover:text-champagne-dark"
              href={`https://instagram.com/${company.instagram.replace("@", "")}`}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={15} /> {company.instagram}
            </a>
          )}
          {businessMode==="b2b"&&<span>
            {company.city ?? "—"} / {company.state ?? "—"}
          </span>}
          {businessMode==="b2c"&&<span>Interesse: <b>{company.businessArea??"—"}</b></span>}
          <span>
            Origem: <b>{company.leadSource ?? "—"}</b>
          </span>
          <span>
            Criada em: <b>{formatDateTime(company.createdAt)}</b>
          </span>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Resumo comercial</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Pipeline aberto</p>
            <b>
              {currency.format(open.reduce((sum, item) => sum + item.value, 0))}
            </b>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              Oportunidades abertas
            </p>
            <b>{open.length}</b>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Próximo follow-up</p>
            <b>{next ? formatDateTime(next.dueAt) : "Nenhum"}</b>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Última atividade</p>
            <b>{events[0] ? formatDateTime(events[0].createdAt) : "Nenhuma"}</b>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Contato principal</CardTitle>
        </CardHeader>
        <CardContent>
          {primary ? (
            <div>
              <b>{primary.name}</b>
              <p className="text-sm text-muted-foreground">
                {primary.role ?? "Sem cargo"}
              </p>
              <p className="mt-2 text-sm">
                {primary.whatsapp ?? primary.email ?? "Sem canal informado"}
              </p>
            </div>
          ) : (
            <EmptyState title="Nenhum contato principal" />
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Notas recentes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {notes.length ? (
            notes.slice(0, 3).map((note) => (
              <div key={note.id} className="rounded-xl bg-muted p-3 text-sm">
                <p>{note.text}</p>
                <small className="text-muted-foreground">
                  {note.author} · {formatDateTime(note.createdAt)}
                </small>
              </div>
            ))
          ) : (
            <EmptyState title="Nenhuma nota registrada" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
export function CompanyContacts({
  contacts,
  onEdit,
  onDelete,
  onSetPrimary,
}: {
  contacts: CompanyContact[];
  onEdit: (contact: CompanyContact) => void;
  onDelete: (contact: CompanyContact) => void;
  onSetPrimary: (contact: CompanyContact) => void;
}) {
  return contacts.length ? (
    <div className="space-y-3">
      {contacts.map((contact) => (
        <Card key={contact.id}>
          <CardContent className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-2">
                <b>{contact.name}</b>
                {contact.isPrimary && <StatusBadge status="Principal" />}
              </div>
              <p className="text-sm text-muted-foreground">
                {contact.role ?? "Sem cargo"} ·{" "}
                {contact.whatsapp ?? contact.email ?? "Sem contato"}
              </p>
            </div>
            <div className="flex flex-wrap gap-1">
              <Button size="sm" variant="ghost" onClick={() => onEdit(contact)}>
                Editar
              </Button>
              {!contact.isPrimary && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onSetPrimary(contact)}
                >
                  Definir como principal
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDelete(contact)}
              >
                <Trash2 size={14} /> Arquivar
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  ) : (
    <EmptyState
      title="Nenhum contato cadastrado"
      description="Adicione as pessoas responsáveis pelo relacionamento com esta empresa."
    />
  );
}
export function CompanyOpportunities({
  opportunities,
  pipelines,
  stages,
  onOpen,
}: {
  opportunities: Opportunity[];
  pipelines: Pipeline[];
  stages: PipelineStage[];
  onOpen: (item: Opportunity) => void;
}) {
  return opportunities.length ? (
    <div className="space-y-3">
      {opportunities.map((item) => {
        const pipeline = pipelines.find(
          (value) => value.id === item.pipelineId,
        );
        const stage = stages.find((value) => value.id === item.stageId);
        return (
          <button
            key={item.id}
            className="w-full rounded-2xl border bg-card p-4 text-left smooth hover:border-champagne hover:shadow-sm"
            onClick={() => onOpen(item)}
          >
            <div className="flex flex-col justify-between gap-3 sm:flex-row">
              <div>
                <b>{item.title}</b>
                <p className="text-sm text-muted-foreground">
                  {pipeline?.name} · {stage?.name}
                </p>
              </div>
              <div className="text-left sm:text-right">
                <b>{currency.format(item.value)}</b>
                <p className="text-xs text-muted-foreground">
                  {item.probability}% ·{" "}
                  {item.status === "open"
                    ? "Aberta"
                    : item.status === "won"
                      ? "Ganha"
                      : item.status === "lost"
                        ? "Perdida"
                        : "Arquivada"}
                </p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  ) : (
    <EmptyState
      title="Esta empresa ainda não possui oportunidades"
      description="Crie a primeira negociação para iniciar o acompanhamento comercial."
    />
  );
}
export function CompanyTimeline({
  events,
  onAddNote,
}: {
  events: TimelineEvent[];
  onAddNote?: () => void;
}) {
  return <ActivityTimeline events={events} onAddNote={onAddNote} />;
}
export function CompanyTasks({
  tasks,
  onComplete,
  onReschedule,
  onCancel,
}: {
  tasks: Task[];
  onComplete: (id: string) => void;
  onReschedule: (task: Task) => void;
  onCancel: (id: string) => void;
}) {
  return tasks.length ? (
    <div className="space-y-3">
      {[...tasks]
        .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
        .map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onComplete={() => onComplete(task.id)}
            onReschedule={() => onReschedule(task)}
            onCancel={() => onCancel(task.id)}
          />
        ))}
    </div>
  ) : (
    <EmptyState title="Nenhuma tarefa ou follow-up" />
  );
}
export function CompanyBadges({
  relationship,
  company,
}: {
  relationship: string;
  company: Company;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <StatusBadge status={relationship} />
      <StatusBadge
        status={
          company.temperature[0].toUpperCase() + company.temperature.slice(1)
        }
      />
      <PriorityBadge priority={company.priority} />
    </div>
  );
}
