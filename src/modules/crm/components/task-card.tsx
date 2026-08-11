import { Check, ExternalLink, MoreHorizontal, RotateCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PriorityBadge } from "@/shared/components/data-display/status-badges";
import type { Company, Opportunity, Task } from "../types";
import {
  formatDateTime,
  relativeDueLabel,
  taskTypeLabel,
} from "../utils/formatters";

export function TaskCard({
  task,
  company,
  opportunity,
  compact = false,
  onComplete,
  onReschedule,
  onCancel,
  onOpenCompany,
}: {
  task: Task;
  company?: Company;
  opportunity?: Opportunity;
  compact?: boolean;
  onComplete?: () => void;
  onReschedule?: () => void;
  onCancel?: () => void;
  onOpenCompany?: () => void;
}) {
  const overdue =
    task.status === "pending" && task.dueAt < new Date().toISOString();
  const priority =
    task.priority === "low"
      ? "baixa"
      : task.priority === "medium"
        ? "media"
        : "alta";
  return (
    <Card className={overdue ? "border-amber-300" : ""}>
      <CardContent className="flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <b className="truncate">{task.title}</b>
            <PriorityBadge priority={priority} />
            {task.priority === "urgent" && (
              <span className="text-xs font-bold text-red-700">Urgente</span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {taskTypeLabel(task.type)} · {formatDateTime(task.dueAt)} ·{" "}
            {relativeDueLabel(task.dueAt)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {company?.fantasyName ?? "Atividade interna"}
            {opportunity ? ` · ${opportunity.title}` : ""} ·{" "}
            {task.assigneeName ?? "Sem responsável"}
          </p>
          {task.type === "meeting" && task.meetingUrl && (
            <a
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-champagne-dark"
              href={task.meetingUrl}
              target="_blank"
              rel="noreferrer"
            >
              Abrir reunião <ExternalLink size={12} />
            </a>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          {onOpenCompany && (
            <Button size="sm" variant="ghost" onClick={onOpenCompany}>
              <MoreHorizontal size={14} /> Empresa
            </Button>
          )}
          {task.status === "pending" && (
            <>
              {onComplete && (
                <Button size="sm" onClick={onComplete}>
                  <Check size={14} /> Concluir
                </Button>
              )}
              {!compact && onReschedule && (
                <Button size="sm" variant="outline" onClick={onReschedule}>
                  <RotateCw size={14} /> Reagendar
                </Button>
              )}
              {!compact && onCancel && (
                <Button size="sm" variant="ghost" onClick={onCancel}>
                  <X size={14} /> Cancelar
                </Button>
              )}
            </>
          )}
          {task.status === "completed" && (
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700">
              <Check size={14} /> Concluída
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
