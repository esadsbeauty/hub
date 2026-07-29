import { cn } from '@/lib/utils';
export type Column<T> = { key: string; header: string; render: (row: T) => React.ReactNode; className?: string };
export function DataTable<T>({ columns, data, onRowClick }: { columns: Column<T>[]; data: T[]; onRowClick?: (row: T) => void }) {
  return <div className="overflow-hidden rounded-2xl border bg-card"><table className="w-full text-sm"><thead className="bg-muted/70 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr>{columns.map((c) => <th key={c.key} className={cn('px-4 py-3 font-bold', c.className)}>{c.header}</th>)}</tr></thead><tbody>{data.map((row, index) => <tr key={index} onClick={() => onRowClick?.(row)} className={cn('border-t smooth hover:bg-muted/50', onRowClick && 'cursor-pointer')}>{columns.map((c) => <td key={c.key} className={cn('px-4 py-4', c.className)}>{c.render(row)}</td>)}</tr>)}</tbody></table></div>;
}
