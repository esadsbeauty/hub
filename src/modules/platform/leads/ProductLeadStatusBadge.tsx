import type{ProductLeadStatus}from"./types";import{statusLabels}from"./utils";
const colors:Record<ProductLeadStatus,string>={new:"bg-champagne-soft text-foreground",contacted:"bg-slate-100 text-slate-700",conversation:"bg-amber-50 text-amber-900",meeting:"bg-violet-50 text-violet-800",customer:"bg-emerald-50 text-emerald-800",lost:"bg-red-50 text-red-800"};
export function ProductLeadStatusBadge({status}:{status:ProductLeadStatus}){return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${colors[status]}`}>{statusLabels[status]}</span>}
