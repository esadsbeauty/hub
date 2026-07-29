import { Badge } from '@/components/ui/badge';
import type { LeadStatus } from '@/modules/crm/types';
import { pipelineLabel } from '@/modules/crm/utils/formatters';

export function StatusBadge({ status }: { status: LeadStatus }) {
  return <Badge className="border-champagne bg-champagne-soft text-champagne-dark">{pipelineLabel(status)}</Badge>;
}

export function PriorityBadge({ priority }: { priority: 'baixa' | 'media' | 'alta' }) {
  const tone = priority === 'alta' ? 'border-red-200 bg-red-50 text-red-700' : priority === 'media' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700';
  return <Badge className={tone}>{priority}</Badge>;
}
