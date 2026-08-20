import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Drawer({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null;
  return <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]">
    <aside role="dialog" aria-modal="true" aria-label={title} className="absolute inset-x-0 bottom-0 flex max-h-[92dvh] min-h-[55dvh] flex-col rounded-t-[2rem] bg-card shadow-overlay md:inset-y-0 md:left-auto md:h-full md:max-h-none md:min-h-0 md:w-full md:max-w-xl md:rounded-none">
      <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-border md:hidden"/>
      <header className="flex shrink-0 items-center justify-between px-5 py-4 md:px-6">
        <h2 className="text-2xl font-semibold tracking-[-.03em] md:text-lg">{title}</h2>
        <Button variant="ghost" size="sm" aria-label="Fechar" onClick={onClose}><X size={24}/></Button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(2rem,env(safe-area-inset-bottom))] md:px-6">{children}</div>
    </aside>
  </div>;
}
