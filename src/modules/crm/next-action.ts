import type { Opportunity, PipelineStage, Task, TimelineEvent } from "./types";

export type NextActionState = "overdue" | "today" | "upcoming" | "missing" | "not_required";

const startOfLocalDay = (date: Date) => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
};

export function isOpenStage(opportunity: Opportunity, stages: PipelineStage[]) {
  const stage = stages.find((item) => item.id === opportunity.stageId);
  return opportunity.status === "open" && !stage?.isWon && !stage?.isLost;
}

export function nextActionForOpportunity(opportunity: Opportunity, tasks: Task[]) {
  return tasks
    .filter((task) => task.organizationId === opportunity.organizationId && task.status === "pending" && !task.deletedAt)
    .filter((task) => task.opportunityId === opportunity.id || (!task.opportunityId && task.companyId === opportunity.companyId))
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0];
}

export function nextActionState(opportunity: Opportunity, stages: PipelineStage[], task?: Task, now = new Date()): NextActionState {
  if (!isOpenStage(opportunity, stages)) return "not_required";
  if (!task) return "missing";
  const due = new Date(task.dueAt);
  const today = startOfLocalDay(now);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (due < today) return "overdue";
  if (due < tomorrow) return due < now ? "overdue" : "today";
  return "upcoming";
}

export function prioritizedPendingActions(tasks: Task[], now = new Date()) {
  const today = startOfLocalDay(now);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const rank = (task: Task) => new Date(task.dueAt) < now ? 0 : new Date(task.dueAt) < tomorrow ? 1 : 2;
  return tasks.filter((task) => task.status === "pending" && !task.deletedAt).sort((a, b) => rank(a) - rank(b) || a.dueAt.localeCompare(b.dueAt));
}

export function lastContactForOpportunity(opportunity: Opportunity, events: TimelineEvent[]) {
  return events
    .filter((event) => event.organizationId === opportunity.organizationId)
    .filter((event) => event.opportunityId === opportunity.id || event.companyId === opportunity.companyId)
    .filter((event) => ["call_completed", "whatsapp_sent", "email_sent", "meeting_completed", "followup_completed"].includes(event.type))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}
