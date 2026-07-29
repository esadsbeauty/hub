import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Modal({ open, title, children, onClose }: { open: boolean; title: string; children: React.ReactNode; onClose: () => void }) {
  if (!open) return null;
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4"><div className="glass max-h-[92vh] w-full max-w-4xl overflow-auto rounded-[1.6rem] bg-card p-6"><div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-bold">{title}</h2><Button variant="ghost" size="sm" onClick={onClose}><X size={18}/></Button></div>{children}</div></div>;
}
