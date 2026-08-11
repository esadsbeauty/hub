import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { resolvePeriod } from "./analytics-service";
import type { AnalyticsFilters, PeriodPreset } from "./types";

const periods: PeriodPreset[] = [
  "today",
  "last7",
  "month",
  "previousMonth",
  "quarter",
  "year",
  "custom",
];
function validPeriod(value: string | null): PeriodPreset {
  return periods.find((item) => item === value) ?? "month";
}

export function useAnalyticsFilters(timezone: string) {
  const [params, setParams] = useSearchParams();
  const filters = useMemo<AnalyticsFilters>(() => {
    const period = validPeriod(params.get("period"));
    const defaultRange = resolvePeriod(period, timezone);
    return {
      period,
      from: params.get("from") ?? defaultRange.from,
      to: params.get("to") ?? defaultRange.to,
      pipelineId: params.get("pipeline") || undefined,
      ownerId: params.get("owner") || undefined,
      source: params.get("source") || undefined,
    };
  }, [params, timezone]);
  const update = (next: AnalyticsFilters) => {
    const query = new URLSearchParams();
    query.set("period", next.period);
    if (next.period === "custom") {
      query.set("from", next.from);
      query.set("to", next.to);
    }
    if (next.pipelineId) query.set("pipeline", next.pipelineId);
    if (next.ownerId) query.set("owner", next.ownerId);
    if (next.source) query.set("source", next.source);
    setParams(query, { replace: true });
  };
  return [filters, update] as const;
}
