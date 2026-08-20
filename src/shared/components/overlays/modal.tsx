import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null;
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-[2px] md:grid md:place-items-center md:p-4">
    <section role="dialog" aria-modal="true" aria-label={title} className="flex h-[100dvh] w-full flex-col overflow-hidden bg-card pt-[env(safe-area-inset-top)] shadow-overlay md:max-h-[92dvh] md:h-auto md:max-w-4xl md:rounded-[1.5rem] md:pt-0">
      <header className="flex shrink-0 items-center justify-between border-b border-border/60 px-5 py-4 md:border-0 md:px-6 md:pb-2 md:pt-5">
        <h2 className="text-2xl font-semibold leading-tight tracking-[-.03em] md:text-lg">{title}</h2>
        <Button variant="ghost" size="sm" aria-label="Fechar" onClick={onClose}><X size={24}/></Button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-5 md:px-6 md:pb-6 md:pt-3">{children}</div>
    </section>
  </div>;
}
