import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/shared/components/feedback/states";
import { PageContainer } from "@/shared/components/layout/page-container";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Tabs } from "@/shared/components/navigation/tabs";
import { Drawer } from "@/shared/components/overlays/drawer";
import { Modal } from "@/shared/components/overlays/modal";
import { useToast } from "@/shared/components/feedback/toast";
import { TaskCard } from "@/modules/crm/components/task-card";
import { TaskForm } from "@/modules/crm/components/task-form";
import {
  useCrmActions,
  useCrmData,
  useOverdueTasks,
  useTasksRange,
} from "@/modules/crm/hooks";
import type {
  Task,
  TaskPriority,
  TaskStatus,
  TaskType,
} from "@/modules/crm/types";
import { localDateKey } from "@/modules/crm/utils/formatters";

type View = "today" | "week" | "month" | "list";
const views: { value: View; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mês" },
  { value: "list", label: "Lista" },
];
const dayMs = 86_400_000;
function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}
function endOfDay(date: Date) {
  const result = startOfDay(date);
  result.setDate(result.getDate() + 1);
  return result;
}
function startOfWeek(date: Date) {
  const result = startOfDay(date);
  const day = result.getDay();
  result.setDate(result.getDate() - (day === 0 ? 6 : day - 1));
  return result;
}
function startOfMonthGrid(date: Date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  return startOfWeek(first);
}
function rangeFor(view: View, cursor: Date) {
  if (view === "today") return [startOfDay(cursor), endOfDay(cursor)];
  if (view === "week") {
    const from = startOfWeek(cursor);
    return [from, new Date(from.getTime() + 7 * dayMs)];
  }
  if (view === "month") {
    const from = startOfMonthGrid(cursor);
    return [from, new Date(from.getTime() + 42 * dayMs)];
  }
  const from = startOfDay(new Date());
  return [
    new Date(from.getTime() - 30 * dayMs),
    new Date(from.getTime() + 90 * dayMs),
  ];
}
function dayTitle(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  })
    .format(date)
    .replaceAll(".", "");
}

export function AgendaPage() {
  const [view, setView] = useState<View>("today");
  const [searchParams, setSearchParams] = useSearchParams();
  const [cursor, setCursor] = useState(() => new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string>();
  const [rescheduling, setRescheduling] = useState<Task>();
  const [owner, setOwner] = useState("mine");
  const [type, setType] = useState<TaskType | "all">("all");
  const [status, setStatus] = useState<TaskStatus | "all">("all");
  const [priority, setPriority] = useState<TaskPriority | "all">("all");
  const requestedType = searchParams.get("new");
  const initialType: TaskType =
    requestedType === "meeting" ||
    requestedType === "task" ||
    requestedType === "follow_up"
      ? requestedType
      : "follow_up";
  useEffect(() => {
    if (requestedType) setModalOpen(true);
  }, [requestedType]);
  const [from, to] = rangeFor(view, cursor);
  const range = useTasksRange(from.toISOString(), to.toISOString());
  const overdue = useOverdueTasks(startOfDay(new Date()).toISOString());
  const crm = useCrmData();
  const actions = useCrmActions();
  const { notify } = useToast();
  const currentProfile = crm.data?.profiles[0];
  const filtered = useMemo(
    () =>
      (range.data ?? []).filter(
        (task) =>
          (owner === "all" ||
            (owner === "mine" &&
              (!currentProfile || task.assignedTo === currentProfile.id)) ||
            task.assignedTo === owner) &&
          (type === "all" || task.type === type) &&
          (status === "all" || task.status === status) &&
          (priority === "all" || task.priority === priority),
      ),
    [range.data, owner, currentProfile, type, status, priority],
  );
  const overdueFiltered = (overdue.data ?? []).filter(
    (task) =>
      owner === "all" ||
      (owner === "mine" &&
        (!currentProfile || task.assignedTo === currentProfile.id)) ||
      task.assignedTo === owner,
  );
  const mutateSuccess = (title: string) => notify({ title });
  const complete = (task: Task) =>
    actions.completeTask.mutate(task.id, {
      onSuccess: () => mutateSuccess("Tarefa concluída."),
    });
  const cancel = (task: Task) =>
    actions.cancelTask.mutate(task.id, {
      onSuccess: () => mutateSuccess("Tarefa cancelada."),
    });
  const taskCard = (task: Task) => (
    <TaskCard
      key={task.id}
      task={task}
      onComplete={() => complete(task)}
      onReschedule={() => setRescheduling(task)}
      onCancel={() => cancel(task)}
    />
  );
  const moveCursor = (direction: number) => {
    const next = new Date(cursor);
    next.setDate(
      next.getDate() +
        direction * (view === "today" ? 1 : view === "week" ? 7 : 30),
    );
    setCursor(next);
  };
  const days = Array.from(
    { length: view === "month" ? 42 : 7 },
    (_, index) => new Date(from.getTime() + index * dayMs),
  );
  const tasksForDay = (date: Date) =>
    filtered.filter(
      (task) => localDateKey(new Date(task.dueAt)) === localDateKey(date),
    );
  const selectedTasks = selectedDay
    ? filtered.filter(
        (task) => localDateKey(new Date(task.dueAt)) === selectedDay,
      )
    : [];
  return (
    <PageContainer>
      <PageHeader
        title="Agenda"
        description="Sua rotina de follow-ups, reuniões e tarefas."
        actions={
          <Button onClick={() => setModalOpen(true)}>
            <Plus size={16} /> Nova atividade
          </Button>
        }
      />
      <div className="mb-5 flex flex-col justify-between gap-3 xl:flex-row xl:items-center">
        <Tabs tabs={views} value={view} onChange={setView} />
        <div className="flex flex-wrap gap-2">
          <Select
            aria-label="Responsável"
            value={owner}
            onChange={(event) => setOwner(event.target.value)}
          >
            <option value="mine">Minha agenda</option>
            <option value="all">Toda a equipe</option>
            {crm.data?.profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Tipo"
            value={type}
            onChange={(event) =>
              setType(event.target.value as TaskType | "all")
            }
          >
            <option value="all">Todos os tipos</option>
            <option value="follow_up">Follow-up</option>
            <option value="call">Ligação</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="email">Email</option>
            <option value="meeting">Reunião</option>
            <option value="task">Tarefa</option>
          </Select>
          <Select
            aria-label="Status"
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as TaskStatus | "all")
            }
          >
            <option value="all">Todos os status</option>
            <option value="pending">Pendentes</option>
            <option value="completed">Concluídas</option>
            <option value="cancelled">Canceladas</option>
          </Select>
          <Select
            aria-label="Prioridade"
            value={priority}
            onChange={(event) =>
              setPriority(event.target.value as TaskPriority | "all")
            }
          >
            <option value="all">Todas as prioridades</option>
            <option value="low">Baixa</option>
            <option value="medium">Média</option>
            <option value="high">Alta</option>
            <option value="urgent">Urgente</option>
          </Select>
        </div>
      </div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="outline"
            aria-label="Período anterior"
            onClick={() => moveCursor(-1)}
          >
            <ChevronLeft size={16} />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setCursor(new Date())}
          >
            Hoje
          </Button>
          <Button
            size="sm"
            variant="outline"
            aria-label="Próximo período"
            onClick={() => moveCursor(1)}
          >
            <ChevronRight size={16} />
          </Button>
        </div>
        <b>
          {view === "month"
            ? new Intl.DateTimeFormat("pt-BR", {
                month: "long",
                year: "numeric",
              }).format(cursor)
            : dayTitle(from)}
        </b>
      </div>
      {range.isLoading || crm.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : view === "today" ? (
        <div className="space-y-6">
          {overdueFiltered.length > 0 && (
            <AgendaGroup title={`Atrasadas (${overdueFiltered.length})`}>
              {overdueFiltered.map(taskCard)}
            </AgendaGroup>
          )}
          <AgendaGroup title="Manhã">
            {filtered
              .filter(
                (task) =>
                  task.status === "pending" &&
                  new Date(task.dueAt).getHours() < 12,
              )
              .map(taskCard)}
          </AgendaGroup>
          <AgendaGroup title="Tarde">
            {filtered
              .filter(
                (task) =>
                  task.status === "pending" &&
                  new Date(task.dueAt).getHours() >= 12,
              )
              .map(taskCard)}
          </AgendaGroup>
          <AgendaGroup title="Concluídas">
            {filtered
              .filter((task) => task.status === "completed")
              .map(taskCard)}
          </AgendaGroup>
        </div>
      ) : view === "list" ? (
        <div className="space-y-3">
          {[...overdueFiltered, ...filtered]
            .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
            .map(taskCard)}
        </div>
      ) : (
        <div
          className={
            view === "month"
              ? "grid grid-cols-7 overflow-hidden rounded-2xl border bg-card"
              : "grid min-w-[900px] grid-cols-7 gap-3 overflow-x-auto"
          }
        >
          {days.map((day) => {
            const items = tasksForDay(day);
            const meetings = items.filter(
              (item) => item.type === "meeting",
            ).length;
            return view === "month" ? (
              <button
                key={day.toISOString()}
                className="min-h-28 border-b border-r p-2 text-left hover:bg-muted"
                onClick={() => setSelectedDay(localDateKey(day))}
              >
                <b className="text-sm">{dayTitle(day)}</b>
                <div className="mt-4 space-y-1 text-xs text-muted-foreground">
                  <p>{items.length} atividades</p>
                  <p>{meetings} reuniões</p>
                </div>
              </button>
            ) : (
              <section
                key={day.toISOString()}
                className="min-h-80 rounded-2xl border bg-card p-3"
              >
                <button
                  className="w-full text-left"
                  onClick={() => setSelectedDay(localDateKey(day))}
                >
                  <b className="text-sm">{dayTitle(day)}</b>
                </button>
                <div className="mt-3 space-y-2">{items.map(taskCard)}</div>
              </section>
            );
          })}
        </div>
      )}
      {!range.isLoading && filtered.length === 0 && view !== "today" && (
        <Card className="mt-4">
          <CardContent className="grid place-items-center p-10 text-center">
            <CalendarDays className="mb-3 text-champagne-dark" />
            <b>Nenhuma atividade neste período.</b>
            <p className="text-sm text-muted-foreground">
              Crie uma atividade ou altere os filtros.
            </p>
          </CardContent>
        </Card>
      )}
      <Modal
        open={modalOpen}
        title="Nova atividade"
        onClose={() => {
          setModalOpen(false);
          setSearchParams({});
        }}
      >
        {crm.data && (
          <TaskForm
            initialDate={selectedDay}
            initialType={initialType}
            companies={crm.data.companies.filter((item) => !item.deletedAt)}
            opportunities={crm.data.opportunities.filter(
              (item) => !item.deletedAt,
            )}
            profiles={crm.data.profiles}
            onCancel={() => {
              setModalOpen(false);
              setSearchParams({});
            }}
            onSubmit={async (form) => {
              await actions.createTask.mutateAsync(form);
              setModalOpen(false);
              setSearchParams({});
              mutateSuccess("Atividade agendada.");
            }}
          />
        )}
      </Modal>
      <Drawer
        open={Boolean(selectedDay)}
        title={
          selectedDay
            ? `Atividades de ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date(`${selectedDay}T12:00:00`))}`
            : "Atividades"
        }
        onClose={() => setSelectedDay(undefined)}
      >
        <div className="space-y-3">
          {selectedTasks.map(taskCard)}
          <Button
            className="w-full"
            variant="outline"
            onClick={() => setModalOpen(true)}
          >
            <Plus size={16} /> Nova atividade neste dia
          </Button>
        </div>
      </Drawer>
      <Modal
        open={Boolean(rescheduling)}
        title="Reagendar atividade"
        onClose={() => setRescheduling(undefined)}
      >
        {rescheduling && crm.data && (
          <TaskForm
            task={rescheduling}
            companies={crm.data.companies.filter((item) => !item.deletedAt)}
            opportunities={crm.data.opportunities.filter(
              (item) => !item.deletedAt,
            )}
            profiles={crm.data.profiles}
            onCancel={() => setRescheduling(undefined)}
            onSubmit={async (form) => {
              const dueAt = new Date(
                `${form.date}T${form.time}:00`,
              ).toISOString();
              await actions.rescheduleTask.mutateAsync({
                id: rescheduling.id,
                dueAt,
              });
              setRescheduling(undefined);
              mutateSuccess("Atividade reagendada.");
            }}
          />
        )}
      </Modal>
    </PageContainer>
  );
}

function AgendaGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 text-xs font-bold uppercase tracking-[.18em] text-muted-foreground">
        {title}
      </h2>
      <div className="space-y-3">
        {children || (
          <p className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
            Nenhuma atividade agendada.
          </p>
        )}
      </div>
    </section>
  );
}
