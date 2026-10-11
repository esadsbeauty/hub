import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
type Toast = { id: string; title: string; description?: string; href?: string };
const ToastContext = createContext<{ notify: (toast: Omit<Toast,"id">) => void } | null>(null);
function ToastItems({toasts,dismiss}:{toasts:Toast[];dismiss:(id:string)=>void}) {
 const navigate=useNavigate();
 return <div className="pointer-events-none fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-[80] w-[calc(100%-2rem)] max-w-sm space-y-2 md:bottom-5">{toasts.map(toast=><div key={toast.id} className="pointer-events-auto rounded-2xl border bg-card p-4 shadow-overlay">
 <div className="flex items-start justify-between gap-3"><div className="min-w-0 flex-1">{toast.href?<button className="text-left" onClick={()=>{navigate(toast.href!);dismiss(toast.id)}}><b className="font-semibold">{toast.title}</b>{toast.description&&<p className="mt-1 text-sm text-muted-foreground">{toast.description}</p>}<span className="mt-2 block text-xs font-semibold text-primary">Abrir atendimento →</span></button>:<><b className="font-semibold">{toast.title}</b>{toast.description&&<p className="mt-1 text-sm text-muted-foreground">{toast.description}</p>}</>}</div><button aria-label="Dispensar aviso" onClick={()=>dismiss(toast.id)} className="rounded-lg px-2 py-1 text-lg text-muted-foreground">×</button></div></div>)}</div>;
}
export function ToastProvider({children}:{children:React.ReactNode}) {
 const [toasts,setToasts]=useState<Toast[]>([]);
 const dismiss=useCallback((id:string)=>setToasts(current=>current.filter(item=>item.id!==id)),[]);
 const notify=useCallback((toast:Omit<Toast,"id">)=>{const id=crypto.randomUUID();setToasts(current=>[...current.slice(-3),{...toast,id}]);window.setTimeout(()=>dismiss(id),6000)},[dismiss]);
 const value=useMemo(()=>({notify}),[notify]);
 return <ToastContext.Provider value={value}>{children}<ToastItems toasts={toasts} dismiss={dismiss}/></ToastContext.Provider>;
}
export function useToast(){const value=useContext(ToastContext);if(!value)throw new Error("useToast must be used inside ToastProvider");return value;}
