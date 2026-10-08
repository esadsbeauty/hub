import type { Opportunity, PipelineStage, Task } from "../types";
import { nextActionState } from "../next-action";
import { formatDateTime, taskTypeLabel } from "../utils/formatters";

export function NextActionStatus({opportunity,stages,task,compact=false}:{opportunity:Opportunity;stages:PipelineStage[];task?:Task;compact?:boolean}) {
  const state=nextActionState(opportunity,stages,task);
  if(state==="not_required")return null;
  const tone=state==="overdue"?"border-red-200 bg-red-50 text-red-800":state==="today"?"border-amber-200 bg-amber-50 text-amber-900":state==="missing"?"border-amber-200/70 bg-amber-50/60 text-amber-800":"border-border/70 bg-muted/60 text-foreground";
  const title=state==="missing"?"Sem próxima ação":state==="overdue"?"Próxima ação atrasada":state==="today"?"Próxima ação hoje":"Próxima ação";
  return <div data-next-action-state={state} className={`${compact?"mt-2 p-2 text-xs":"mt-3 p-3 text-sm"} rounded-xl border ${tone}`}><p className="font-semibold">{title}</p>{task&&<p className="mt-0.5">{taskTypeLabel(task.type)} · {formatDateTime(task.dueAt)}</p>}</div>;
}
