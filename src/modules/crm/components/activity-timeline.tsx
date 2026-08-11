import { useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  Building2,
  Calendar,
  CheckSquare,
  Clock3,
  FileText,
  Mail,
  MessageCircle,
  NotebookPen,
  PackageCheck,
  Phone,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/shared/components/feedback/states";
import type { ActivityType, TimelineEvent } from "../types";

type Filter =
  | "all"
  | "notes"
  | "followups"
  | "tasks"
  | "meetings"
  | "stages"
  | "deals"
  | "customers"
  | "finance"
  | "communications";
const filters: { value: Filter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "notes", label: "Notas" },
  { value: "followups", label: "Follow-ups" },
  { value: "tasks", label: "Tarefas" },
  { value: "meetings", label: "Reuniões" },
  { value: "stages", label: "Etapas" },
  { value: "deals", label: "Negócios" },
  { value: "customers", label: "Clientes" },
  { value: "finance", label: "Financeiro" },
  { value: "communications", label: "Comunicações" },
];
const activityLabels: Record<ActivityType, string> = {
  company_created: "Empresa criada",
  company_updated: "Empresa atualizada",
  contact_created: "Contato criado",
  contact_updated: "Contato atualizado",
  opportunity_created: "Oportunidade criada",
  opportunity_updated: "Oportunidade atualizada",
  stage_changed: "Etapa alterada",
  note_created: "Nota adicionada",
  followup_created: "Follow-up criado",
  followup_completed: "Follow-up concluído",
  task_created: "Tarefa criada",
  task_completed: "Tarefa concluída",
  task_cancelled: "Tarefa cancelada",
  task_rescheduled: "Tarefa reagendada",
  meeting_scheduled: "Reunião agendada",
  meeting_completed: "Reunião concluída",
  meeting_cancelled: "Reunião cancelada",
  call_completed: "Ligação concluída",
  whatsapp_sent: "WhatsApp registrado",
  email_sent: "Email registrado",
  deal_won: "Negócio ganho",
  deal_lost: "Negócio perdido",
  owner_changed: "Responsável alterado",
  customer_created: "Cliente ativado",
  customer_cancelled: "Cliente cancelado",
  service_started: "Serviço iniciado",
  service_paused: "Serviço pausado",
  service_cancelled: "Serviço cancelado",
  onboarding_started: "Onboarding iniciado",
  onboarding_step_completed: "Etapa do onboarding concluída",
  contract_created: "Contrato criado",
  contract_sent: "Contrato enviado",
  contract_signed: "Contrato assinado",
  contract_expiring: "Contrato próximo do vencimento",
  contract_cancelled: "Contrato cancelado",
  receivable_created: "Cobrança criada",
  receivable_paid: "Cobrança recebida",
  receivable_partially_paid: "Pagamento parcial recebido",
  receivable_cancelled: "Cobrança cancelada",
  payment_received: "Pagamento recebido",
  payable_created: "Despesa criada",
  payable_paid: "Despesa paga",
  transaction_reversed: "Movimentação estornada",
  recurrence_created: "Recorrência criada",
  recurrence_cancelled: "Recorrência cancelada",
};
function category(type: ActivityType): Filter {
  if (type === "note_created") return "notes";
  if (type.startsWith("followup")) return "followups";
  if (type.startsWith("meeting")) return "meetings";
  if (type === "stage_changed") return "stages";
  if (type === "deal_won" || type === "deal_lost") return "deals";
  if (
    type.startsWith("receivable_") ||
    type.startsWith("payable_") ||
    type.startsWith("payment_") ||
    type.startsWith("transaction_") ||
    type.startsWith("recurrence_")
  )
    return "finance";
  if (
    type.startsWith("customer_") ||
    type.startsWith("service_") ||
    type.startsWith("onboarding_") ||
    type.startsWith("contract_")
  )
    return "customers";
  if (
    type === "call_completed" ||
    type === "whatsapp_sent" ||
    type === "email_sent"
  )
    return "communications";
  return "tasks";
}
function groupLabel(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const key = date.toDateString();
  if (key === today.toDateString()) return "Hoje";
  if (key === yesterday.toDateString()) return "Ontem";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" })
    .format(date)
    .replace(".", "");
}
function ActivityIcon({ type }: { type: ActivityType }) {
  const props = { size: 16, "aria-hidden": true };
  if (type === "note_created") return <NotebookPen {...props} />;
  if (type.startsWith("meeting")) return <Calendar {...props} />;
  if (type === "call_completed") return <Phone {...props} />;
  if (type === "whatsapp_sent") return <MessageCircle {...props} />;
  if (type === "email_sent") return <Mail {...props} />;
  if (type === "stage_changed" || type === "task_rescheduled")
    return <RefreshCw {...props} />;
  if (type.startsWith("task") || type.startsWith("followup"))
    return <CheckSquare {...props} />;
  if (type.startsWith("deal")) return <BriefcaseBusiness {...props} />;
  if (type.startsWith("customer_")) return <Building2 {...props} />;
  if (type.startsWith("service_")) return <PackageCheck {...props} />;
  if (type.startsWith("onboarding_")) return <CheckSquare {...props} />;
  if (type.startsWith("contract_")) return <FileText {...props} />;
  if (
    type.startsWith("receivable_") ||
    type.startsWith("payable_") ||
    type.startsWith("payment_") ||
    type.startsWith("transaction_") ||
    type.startsWith("recurrence_")
  )
    return <BriefcaseBusiness {...props} />;
  return <Clock3 {...props} />;
}
export function ActivityTimeline({
  events,
  onAddNote,
  compact = false,
}: {
  events: TimelineEvent[];
  onAddNote?: () => void;
  compact?: boolean;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [limit, setLimit] = useState(compact ? 5 : 20);
  const filtered = useMemo(
    () =>
      [...events]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .filter((event) => filter === "all" || category(event.type) === filter),
    [events, filter],
  );
  const visible = filtered.slice(0, limit);
  const groups: { label: string; items: TimelineEvent[] }[] = [];
  for (const event of visible) {
    const label = groupLabel(event.createdAt);
    const group = groups.find((item) => item.label === label);
    if (group) group.items.push(event);
    else groups.push({ label, items: [event] });
  }
  return (
    <div className="space-y-5">
      {!compact && (
        <div className="flex flex-wrap justify-between gap-2">
          <div className="flex flex-wrap gap-1">
            {filters.map((item) => (
              <Button
                key={item.value}
                size="sm"
                variant={filter === item.value ? "default" : "ghost"}
                onClick={() => {
                  setFilter(item.value);
                  setLimit(20);
                }}
              >
                {item.label}
              </Button>
            ))}
          </div>
          {onAddNote && (
            <Button size="sm" variant="outline" onClick={onAddNote}>
              <NotebookPen size={15} /> Nova nota
            </Button>
          )}
        </div>
      )}
      {visible.length === 0 ? (
        <EmptyState title="Nenhuma atividade registrada ainda" />
      ) : (
        groups.map(({ label, items }) => (
          <section key={label}>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {label}
            </h3>
            <div className="space-y-4">
              {items.map((event) => (
                <article
                  key={event.id}
                  className="grid grid-cols-[2rem_1fr] gap-3"
                >
                  <div className="grid h-8 w-8 place-items-center rounded-full border bg-card text-champagne-dark">
                    <ActivityIcon type={event.type} />
                  </div>
                  <div className="border-b pb-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <b>{activityLabels[event.type]}</b>
                      <time className="text-xs text-muted-foreground">
                        {new Intl.DateTimeFormat("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(new Date(event.createdAt))}
                      </time>
                    </div>
                    {event.description && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {event.description}
                      </p>
                    )}
                    {event.type === "stage_changed" && (
                      <p className="mt-1 text-sm font-medium">
                        {String(
                          event.metadata.from_stage ??
                            event.metadata.from_stage_name ??
                            "",
                        )}{" "}
                        →{" "}
                        {String(
                          event.metadata.to_stage ??
                            event.metadata.to_stage_name ??
                            "",
                        )}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {event.user}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))
      )}
      {limit < filtered.length && (
        <Button
          className="w-full"
          variant="outline"
          onClick={() => setLimit((value) => value + (compact ? 5 : 20))}
        >
          Carregar mais
        </Button>
      )}
    </div>
  );
}
