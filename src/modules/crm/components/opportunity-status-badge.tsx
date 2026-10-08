import type { Opportunity, PipelineStage } from "../types";

type StatusBadge = {
  label: string;
  className: string;
};

function normalize(value: string | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function getStatusBadge(
  opportunity: Opportunity,
  stages: PipelineStage[],
): StatusBadge {
  const stage = stages.find((item) => item.id === opportunity.stageId);
  const stageName = normalize(stage?.name);

  if (opportunity.status === "won" || stage?.isWon) {
    return {
      label: "Ganho",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }

  if (opportunity.status === "lost" || stage?.isLost) {
    return {
      label: "Perdido",
      className: "border-red-200 bg-red-50 text-red-700",
    };
  }

  if (stageName.includes("atendimento humano")) {
    return {
      label: "Aguardando atendimento humano",
      className: "border-orange-200 bg-orange-50 text-orange-700",
    };
  }

  if (stageName.includes("agend")) {
    return {
      label: "Agendado",
      className: "border-green-200 bg-green-50 text-green-700",
    };
  }

  if (stageName.includes("compareceu")) {
    return {
      label: "Compareceu",
      className: "border-teal-200 bg-teal-50 text-teal-700",
    };
  }

  if (stageName.includes("proposta")) {
    return {
      label: "Proposta",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }

  if (opportunity.assistantStatus === "handoff") {
    return {
      label: "Aguardando atendimento humano",
      className: "border-orange-200 bg-orange-50 text-orange-700",
    };
  }

  if (opportunity.assistantStatus === "qualified") {
    return {
      label: "Lead qualificado",
      className: "border-violet-200 bg-violet-50 text-violet-700",
    };
  }

  if (
    opportunity.assistantStatus === "active" &&
    (stageName.includes("novo lead") || stageName.includes("em atendimento"))
  ) {
    return {
      label: "Assistente atendendo",
      className: "border-blue-200 bg-blue-50 text-blue-700",
    };
  }

  if (stageName.includes("em atendimento")) {
    return {
      label: "Em atendimento",
      className: "border-sky-200 bg-sky-50 text-sky-700",
    };
  }

  if (stageName.includes("novo lead")) {
    return {
      label: "Novo lead",
      className: "border-slate-200 bg-slate-50 text-slate-700",
    };
  }

  return {
    label: stage?.name ?? "Em andamento",
    className: "border-border bg-muted/60 text-muted-foreground",
  };
}

export function OpportunityStatusBadge({
  opportunity,
  stages,
  compact = false,
}: {
  opportunity: Opportunity;
  stages: PipelineStage[];
  compact?: boolean;
}) {
  const status = getStatusBadge(opportunity, stages);

  return (
    <span
      className={[
        "mt-2 inline-flex w-fit items-center rounded-full border font-semibold",
        compact ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs",
        status.className,
      ].join(" ")}
    >
      {status.label}
    </span>
  );
}
