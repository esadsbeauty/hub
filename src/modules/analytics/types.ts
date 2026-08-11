import type { Opportunity } from "@/modules/crm/types";

export type PeriodPreset =
  | "today"
  | "last7"
  | "month"
  | "previousMonth"
  | "quarter"
  | "year"
  | "custom";

export type AnalyticsFilters = {
  period: PeriodPreset;
  from: string;
  to: string;
  pipelineId?: string;
  ownerId?: string;
  source?: string;
};

export type PeriodRange = {
  from: string;
  to: string;
  previousFrom: string;
  previousTo: string;
  label: string;
};

export type MetricResult = {
  value: number;
  count: number;
  opportunities: Opportunity[];
};

export type PerformanceRow = {
  key: string;
  label: string;
  created: number;
  generated: number;
  open: number;
  pipeline: number;
  weighted: number;
  won: number;
  wonValue: number;
  lost: number;
  winRate?: number;
  averageTicket?: number;
  averageCycleDays?: number;
  overdueFollowups?: number;
};
