import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
export function Drawer({ open, title, children, onClose }: { open: boolean; title: string; children: React.ReactNode; onClose: () => void }) {
  if (!open) return null;
  return <div className="fixed inset-0 z-50 bg-black/40"><aside className="ml-auto h-full w-full max-w-xl overflow-auto border-l bg-card p-6 shadow-premium"><div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-bold">{title}</h2><Button variant="ghost" size="sm" onClick={onClose}><X size={18}/></Button></div>{children}</aside></div>;
}
