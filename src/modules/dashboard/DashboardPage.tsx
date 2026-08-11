import {
  CalendarClock,
  CheckSquare,
  CircleDollarSign,
  Handshake,
  Target,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/shared/components/data-display/metric-card";
import { PageContainer } from "@/shared/components/layout/page-container";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Skeleton } from "@/shared/components/feedback/states";
import { ActivityTimeline } from "@/modules/crm/components/activity-timeline";
import { TaskCard } from "@/modules/crm/components/task-card";
import {
  useCrmActions,
  useCrmData,
  useOverdueTasks,
  useTasksRange,
} from "@/modules/crm/hooks";
import { currency, localDateKey } from "@/modules/crm/utils/formatters";

export function DashboardPage() {
  const crm = useCrmData();
  const actions = useCrmActions();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const today = useTasksRange(start.toISOString(), end.toISOString());
  const overdue = useOverdueTasks(start.toISOString());
  if (crm.isLoading || today.isLoading || overdue.isLoading)
    return (
      <PageContainer>
        <div className="space-y-4">
          <Skeleton className="h-32" />
          <div className="grid gap-4 md:grid-cols-4">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
          <Skeleton className="h-72" />
        </div>
      </PageContainer>
    );
  const opportunities = (crm.data?.opportunities ?? []).filter(
    (item) => item.status === "open" && !item.deletedAt,
  );
  const pendingToday = (today.data ?? []).filter(
    (task) => task.status === "pending",
  );
  const followupsToday = pendingToday.filter(
    (task) => task.type === "follow_up",
  );
  const meetingsToday = pendingToday.filter((task) => task.type === "meeting");
  const pipeline = opportunities.reduce((sum, item) => sum + item.value, 0);
  const weighted = opportunities.reduce(
    (sum, item) => sum + (item.value * item.probability) / 100,
    0,
  );
  const complete = (id: string) => actions.completeTask.mutate(id);
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Visão executiva"
        title="Dashboard Executivo"
        description={`Operação comercial de ${localDateKey(new Date()).split("-").reverse().join("/")}.`}
      />
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Pipeline aberto"
          value={currency.format(pipeline)}
          icon={Handshake}
        />
        <MetricCard
          label="Pipeline ponderado"
          value={currency.format(weighted)}
          icon={CircleDollarSign}
        />
        <MetricCard
          label="Follow-ups hoje"
          value={followupsToday.length}
          icon={CalendarClock}
        />
        <MetricCard
          label="Follow-ups atrasados"
          value={
            (overdue.data ?? []).filter((task) => task.type === "follow_up")
              .length
          }
          icon={Target}
        />
        <MetricCard
          label="Reuniões hoje"
          value={meetingsToday.length}
          icon={Users}
        />
        <MetricCard
          label="Tarefas pendentes hoje"
          value={pendingToday.length}
          icon={CheckSquare}
        />
      </section>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_.95fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Agenda de hoje</CardTitle>
            <Link
              className="text-sm font-semibold text-champagne-dark"
              to="/agenda"
            >
              Ver agenda completa
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingToday.length ? (
              pendingToday
                .slice(0, 5)
                .map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    compact
                    onComplete={() => complete(task.id)}
                  />
                ))
            ) : (
              <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                Você não possui atividades agendadas para hoje.
              </p>
            )}
            {(overdue.data?.length ?? 0) > 0 && (
              <Link
                className="block rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900"
                to="/agenda"
              >
                {overdue.data?.length} atividades atrasadas — revisar agora
              </Link>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Últimas atividades</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityTimeline
              events={(crm.data?.events ?? []).slice(0, 8)}
              compact
            />
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
