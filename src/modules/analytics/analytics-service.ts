import type {
  CrmData,
  LostReason,
  Opportunity,
  PipelineStage,
} from "@/modules/crm/types";
import type {
  AnalyticsFilters,
  MetricResult,
  PerformanceRow,
  PeriodPreset,
  PeriodRange,
} from "./types";

const dayMs = 86_400_000;
const lostReasonLabels: Record<LostReason, string> = {
  price: "Preço",
  no_response: "Sem resposta",
  no_interest: "Sem interesse",
  competitor: "Concorrente",
  timing: "Timing",
  no_budget: "Sem orçamento",
  unqualified: "Não qualificado",
  other: "Outro",
};

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDays(key: string, amount: number) {
  const date = new Date(`${key}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return dateKey(date);
}

export function zonedDateKey(value: string | Date, timezone: string) {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function resolvePeriod(
  preset: PeriodPreset,
  timezone: string,
  customFrom?: string,
  customTo?: string,
  now = new Date(),
): PeriodRange {
  const today = zonedDateKey(now, timezone);
  const base = new Date(`${today}T12:00:00`);
  let from = today;
  let to = today;
  let label = "Hoje";
  if (preset === "last7") {
    from = addDays(today, -6);
    label = "Últimos 7 dias";
  } else if (preset === "month" || preset === "previousMonth") {
    const offset = preset === "previousMonth" ? -1 : 0;
    from = dateKey(
      new Date(base.getFullYear(), base.getMonth() + offset, 1, 12),
    );
    to = dateKey(
      new Date(base.getFullYear(), base.getMonth() + offset + 1, 0, 12),
    );
    label = preset === "month" ? "Este mês" : "Mês anterior";
  } else if (preset === "quarter") {
    const quarterMonth = Math.floor(base.getMonth() / 3) * 3;
    from = dateKey(new Date(base.getFullYear(), quarterMonth, 1, 12));
    to = dateKey(new Date(base.getFullYear(), quarterMonth + 3, 0, 12));
    label = "Este trimestre";
  } else if (preset === "year") {
    from = `${base.getFullYear()}-01-01`;
    to = `${base.getFullYear()}-12-31`;
    label = "Este ano";
  } else if (preset === "custom" && customFrom && customTo) {
    from = customFrom <= customTo ? customFrom : customTo;
    to = customFrom <= customTo ? customTo : customFrom;
    label = "Período personalizado";
  }
  const days = Math.round(
    (new Date(`${to}T12:00:00`).getTime() -
      new Date(`${from}T12:00:00`).getTime()) /
      dayMs,
  );
  let previousFrom = addDays(from, -(days + 1));
  let previousTo = addDays(from, -1);
  if (preset === "month" || preset === "previousMonth") {
    const offset = preset === "previousMonth" ? -2 : -1;
    previousFrom = dateKey(
      new Date(base.getFullYear(), base.getMonth() + offset, 1, 12),
    );
    previousTo = dateKey(
      new Date(base.getFullYear(), base.getMonth() + offset + 1, 0, 12),
    );
  } else if (preset === "quarter") {
    const quarterMonth = Math.floor(base.getMonth() / 3) * 3;
    previousFrom = dateKey(
      new Date(base.getFullYear(), quarterMonth - 3, 1, 12),
    );
    previousTo = dateKey(new Date(base.getFullYear(), quarterMonth, 0, 12));
  } else if (preset === "year") {
    previousFrom = `${base.getFullYear() - 1}-01-01`;
    previousTo = `${base.getFullYear() - 1}-12-31`;
  }
  return {
    from,
    to,
    previousFrom,
    previousTo,
    label,
  };
}

function inPeriod(
  value: string | undefined,
  range: PeriodRange,
  timezone: string,
) {
  if (!value) return false;
  const key = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : zonedDateKey(value, timezone);
  return key >= range.from && key <= range.to;
}

function probability(opportunity: Opportunity, stages: PipelineStage[]) {
  if (
    Number.isFinite(opportunity.probability) &&
    opportunity.probability >= 0 &&
    opportunity.probability <= 100
  )
    return opportunity.probability;
  return (
    stages.find((stage) => stage.id === opportunity.stageId)?.probability ?? 0
  );
}

function matches(opportunity: Opportunity, filters: AnalyticsFilters) {
  return (
    !opportunity.deletedAt &&
    (!filters.pipelineId || opportunity.pipelineId === filters.pipelineId) &&
    (!filters.ownerId || opportunity.ownerId === filters.ownerId) &&
    (!filters.source || opportunity.source === filters.source)
  );
}

function sum(opportunities: Opportunity[]) {
  return (
    opportunities.reduce(
      (totalInCents, item) => totalInCents + Math.round(item.value * 100),
      0,
    ) / 100
  );
}

function weightedValue(opportunity: Opportunity, stages: PipelineStage[]) {
  const cents = Math.round(opportunity.value * 100);
  return Math.round((cents * probability(opportunity, stages)) / 100) / 100;
}

function average(values: number[]) {
  return values.length
    ? values.reduce((total, value) => total + value, 0) / values.length
    : undefined;
}

export function calculateAnalytics(data: CrmData, filters: AnalyticsFilters) {
  const timezone = data.organization.timezone;
  const range = resolvePeriod(
    filters.period,
    timezone,
    filters.from,
    filters.to,
  );
  const previousRange: PeriodRange = {
    ...range,
    from: range.previousFrom,
    to: range.previousTo,
  };
  const all = data.opportunities.filter((item) => matches(item, filters));
  const open = all.filter((item) => item.status === "open");
  const won = all.filter(
    (item) => item.status === "won" && inPeriod(item.wonAt, range, timezone),
  );
  const lost = all.filter(
    (item) => item.status === "lost" && inPeriod(item.lostAt, range, timezone),
  );
  const previousWon = all.filter(
    (item) =>
      item.status === "won" && inPeriod(item.wonAt, previousRange, timezone),
  );
  const created = all.filter((item) =>
    inPeriod(item.createdAt, range, timezone),
  );
  const forecast = open.filter((item) =>
    inPeriod(item.expectedCloseDate, range, timezone),
  );
  const pipeline: MetricResult = {
    value: sum(open),
    count: open.length,
    opportunities: open,
  };
  const weighted: MetricResult = {
    value: open.reduce(
      (total, item) => total + weightedValue(item, data.stages),
      0,
    ),
    count: open.length,
    opportunities: open,
  };
  const wonValue = sum(won);
  const closed = won.length + lost.length;
  const cycleValues = won
    .filter((item) => item.wonAt)
    .map((item) =>
      Math.max(
        0,
        (new Date(item.wonAt ?? item.createdAt).getTime() -
          new Date(item.createdAt).getTime()) /
          dayMs,
      ),
    );
  const now = new Date();
  const futureTaskOpportunityIds = new Set(
    data.tasks
      .filter(
        (task) =>
          !task.deletedAt &&
          task.status === "pending" &&
          task.opportunityId &&
          new Date(task.dueAt) >= now,
      )
      .map((task) => task.opportunityId),
  );
  const overdueFollowups = data.tasks.filter(
    (task) =>
      !task.deletedAt &&
      task.status === "pending" &&
      task.type === "follow_up" &&
      new Date(task.dueAt) < now,
  );
  const stageRows = data.stages
    .filter(
      (stage) => !filters.pipelineId || stage.pipelineId === filters.pipelineId,
    )
    .sort((a, b) => a.position - b.position)
    .map((stage) => {
      const items = open.filter((item) => item.stageId === stage.id);
      const allowed = new Set(all.map((item) => item.id));
      const entries = data.stageHistory.filter(
        (history) =>
          history.toStageId === stage.id &&
          allowed.has(history.opportunityId) &&
          inPeriod(history.changedAt, range, timezone),
      );
      const advanced = new Set(
        entries.flatMap((entry) =>
          data.stageHistory.some(
            (history) =>
              history.opportunityId === entry.opportunityId &&
              history.changedAt > entry.changedAt,
          )
            ? [entry.opportunityId]
            : [],
        ),
      ).size;
      const durations = entries.flatMap((entry) => {
        const next = data.stageHistory
          .filter(
            (history) =>
              history.opportunityId === entry.opportunityId &&
              history.changedAt > entry.changedAt,
          )
          .sort((a, b) => a.changedAt.localeCompare(b.changedAt))[0];
        return next
          ? [
              (new Date(next.changedAt).getTime() -
                new Date(entry.changedAt).getTime()) /
                dayMs,
            ]
          : [];
      });
      return {
        stage,
        count: items.length,
        value: sum(items),
        weighted: items.reduce(
          (total, item) => total + weightedValue(item, data.stages),
          0,
        ),
        entered: new Set(entries.map((entry) => entry.opportunityId)).size,
        advanced,
        averageDays: average(durations),
      };
    });
  const performance = (
    field: "owner" | "source" | "pipeline",
  ): PerformanceRow[] => {
    const keys = new Set(
      all.map((item) =>
        field === "owner"
          ? (item.ownerId ?? "unassigned")
          : field === "pipeline"
            ? item.pipelineId
            : (item.source ?? "unknown"),
      ),
    );
    return [...keys].map((key) => {
      const rows = all.filter((item) =>
        field === "owner"
          ? (item.ownerId ?? "unassigned") === key
          : field === "pipeline"
            ? item.pipelineId === key
            : (item.source ?? "unknown") === key,
      );
      const rowWon = rows.filter(
        (item) =>
          item.status === "won" && inPeriod(item.wonAt, range, timezone),
      );
      const rowLost = rows.filter(
        (item) =>
          item.status === "lost" && inPeriod(item.lostAt, range, timezone),
      );
      const rowCreated = rows.filter((item) =>
        inPeriod(item.createdAt, range, timezone),
      );
      const rowOpen = rows.filter((item) => item.status === "open");
      const cycles = rowWon.map(
        (item) =>
          (new Date(item.wonAt ?? item.createdAt).getTime() -
            new Date(item.createdAt).getTime()) /
          dayMs,
      );
      return {
        key,
        label:
          field === "owner"
            ? (data.profiles.find((profile) => profile.id === key)?.name ??
              "Sem responsável")
            : field === "pipeline"
              ? (data.pipelines.find((pipeline) => pipeline.id === key)?.name ??
                "Pipeline")
              : key === "unknown"
                ? "Sem origem"
                : key,
        created: rowCreated.length,
        generated: sum(rowCreated),
        open: rowOpen.length,
        pipeline: sum(rowOpen),
        weighted: rowOpen.reduce(
          (total, item) => total + weightedValue(item, data.stages),
          0,
        ),
        won: rowWon.length,
        wonValue: sum(rowWon),
        lost: rowLost.length,
        winRate:
          rowWon.length + rowLost.length
            ? rowWon.length / (rowWon.length + rowLost.length)
            : undefined,
        averageTicket: rowWon.length ? sum(rowWon) / rowWon.length : undefined,
        averageCycleDays: average(cycles),
        overdueFollowups:
          field === "owner"
            ? overdueFollowups.filter((task) => task.assignedTo === key).length
            : undefined,
      };
    });
  };
  const topThree = [...open].sort((a, b) => b.value - a.value).slice(0, 3);
  return {
    range,
    filteredOpportunities: all,
    pipeline,
    weighted,
    won: { value: wonValue, count: won.length, opportunities: won },
    lost: { value: sum(lost), count: lost.length, opportunities: lost },
    generated: {
      value: sum(created),
      count: created.length,
      opportunities: created,
    },
    winRate: closed ? won.length / closed : undefined,
    averageTicket: won.length ? wonValue / won.length : undefined,
    averageCycleDays: average(cycleValues),
    previousWonValue: sum(previousWon),
    forecast: {
      value: sum(forecast),
      weighted: forecast.reduce(
        (total, item) => total + weightedValue(item, data.stages),
        0,
      ),
      count: forecast.length,
      opportunities: forecast,
    },
    stageRows,
    ownerRows: performance("owner"),
    sourceRows: performance("source"),
    pipelineRows: performance("pipeline"),
    lostReasons: Object.entries(lostReasonLabels)
      .map(([reason, label]) => {
        const opportunities = lost.filter((item) => item.lostReason === reason);
        return {
          reason,
          label,
          count: opportunities.length,
          value: sum(opportunities),
          percentage: lost.length ? opportunities.length / lost.length : 0,
          opportunities,
        };
      })
      .filter((item) => item.count > 0),
    attention: {
      overdueFollowups,
      withoutNextStep: open.filter(
        (item) => !futureTaskOpportunityIds.has(item.id),
      ),
      overdueCloseDate: open.filter(
        (item) =>
          item.expectedCloseDate &&
          item.expectedCloseDate < zonedDateKey(now, timezone),
      ),
      withoutValue: open.filter((item) => !item.value),
      withoutCloseDate: open.filter((item) => !item.expectedCloseDate),
      withoutOwner: open.filter((item) => !item.ownerId),
      withoutSource: open.filter((item) => !item.source),
    },
    concentration: pipeline.value ? sum(topThree) / pipeline.value : 0,
    salesTrend: [
      ...new Set([
        ...created.map((item) => zonedDateKey(item.createdAt, timezone)),
        ...won
          .filter((item) => item.wonAt)
          .map((item) => zonedDateKey(item.wonAt ?? item.createdAt, timezone)),
      ]),
    ]
      .sort()
      .map((key) => ({
        key,
        generated: sum(
          created.filter(
            (item) => zonedDateKey(item.createdAt, timezone) === key,
          ),
        ),
        won: sum(
          won.filter(
            (item) => item.wonAt && zonedDateKey(item.wonAt, timezone) === key,
          ),
        ),
      })),
  };
}

export type AnalyticsResult = ReturnType<typeof calculateAnalytics>;
