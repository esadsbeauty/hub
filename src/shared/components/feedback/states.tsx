import { AlertTriangle, Inbox, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return <div className="grid place-items-center rounded-2xl border border-dashed bg-card p-10 text-center"><Inbox className="mb-4 text-champagne-dark" size={40} /><h3 className="font-bold">{title}</h3>{description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}{action && <div className="mt-5">{action}</div>}</div>;
}
export function LoadingState({ label = 'Carregando...' }: { label?: string }) { return <div className="flex items-center justify-center gap-2 rounded-2xl border bg-card p-10 text-muted-foreground"><Loader2 className="animate-spin" size={18} />{label}</div>; }
export function ErrorState({ title = 'Não foi possível carregar', retry }: { title?: string; retry?: () => void }) { return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700"><div className="flex items-center gap-2"><AlertTriangle size={18}/><b>{title}</b></div>{retry && <Button className="mt-4" variant="outline" onClick={retry}>Tentar novamente</Button>}</div>; }
export function Skeleton({ className = '' }: { className?: string }) { return <div className={`animate-pulse rounded-xl bg-muted ${className}`} />; }
