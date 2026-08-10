import { Badge } from '@/components/ui/badge';
import type { Priority } from '@/modules/crm/types';
export function StatusBadge({ status }: { status: string }) { return <Badge className="border-champagne bg-champagne-soft text-champagne-dark">{status}</Badge>; }
export function PriorityBadge({ priority }: { priority: Priority }) { const labels: Record<Priority,string>={baixa:'Baixa',media:'Média',alta:'Alta'}; return <Badge className={priority==='alta'?'bg-red-50 text-red-700':priority==='media'?'bg-amber-50 text-amber-700':'bg-slate-100 text-slate-700'}>{labels[priority]}</Badge>; }
