import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { CrmData } from "@/modules/crm/types";
import type { AnalyticsFilters, PeriodPreset } from "../types";

const presets: { value: PeriodPreset; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "last7", label: "Últimos 7 dias" },
  { value: "month", label: "Este mês" },
  { value: "previousMonth", label: "Mês anterior" },
  { value: "quarter", label: "Este trimestre" },
  { value: "year", label: "Este ano" },
  { value: "custom", label: "Personalizado" },
];

function period(value: string): PeriodPreset {
  return presets.some((item) => item.value === value)
    ? (presets.find((item) => item.value === value)?.value ?? "month")
    : "month";
}

export function AnalyticsFiltersBar({
  data,
  filters,
  onChange,
}: {
  data: CrmData;
  filters: AnalyticsFilters;
  onChange: (filters: AnalyticsFilters) => void;
}) {
  const sources = [
    ...new Set(
      data.opportunities
        .map((item) => item.source)
        .filter((source): source is string => Boolean(source)),
    ),
  ];
  return (
    <div className="rounded-2xl border bg-card p-3">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <Select
          aria-label="Período"
          value={filters.period}
          onChange={(event) =>
            onChange({ ...filters, period: period(event.target.value) })
          }
        >
          {presets.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Pipeline"
          value={filters.pipelineId ?? ""}
          onChange={(event) =>
            onChange({
              ...filters,
              pipelineId: event.target.value || undefined,
            })
          }
        >
          <option value="">Todos os pipelines</option>
          {data.pipelines.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Responsável"
          value={filters.ownerId ?? ""}
          onChange={(event) =>
            onChange({ ...filters, ownerId: event.target.value || undefined })
          }
        >
          <option value="">Todos os responsáveis</option>
          {data.profiles.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Origem"
          value={filters.source ?? ""}
          onChange={(event) =>
            onChange({ ...filters, source: event.target.value || undefined })
          }
        >
          <option value="">Todas as origens</option>
          {sources.map((source) => (
            <option key={source} value={source}>
              {source}
            </option>
          ))}
        </Select>
      </div>
      {filters.period === "custom" && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <Input
            aria-label="Data inicial"
            type="date"
            value={filters.from}
            onChange={(event) =>
              onChange({ ...filters, from: event.target.value })
            }
          />
          <Input
            aria-label="Data final"
            type="date"
            value={filters.to}
            onChange={(event) =>
              onChange({ ...filters, to: event.target.value })
            }
          />
        </div>
      )}
    </div>
  );
}
