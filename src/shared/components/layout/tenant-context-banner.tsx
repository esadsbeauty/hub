import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppState } from "@/shared/state/app-state-context";

export function TenantContextBanner() {
  const state = useAppState();
  if (!state.isPlatformAdmin || !state.isImpersonating) return null;
  return <div role="status" className="border-b border-amber-300/70 bg-amber-50 px-4 py-2 text-amber-950 md:px-6 lg:px-8"><div className="mx-auto flex max-w-[90rem] flex-wrap items-center gap-2 text-sm"><ShieldAlert size={18}/><strong>Visualizando organização: {state.organizationName}</strong><span className="text-amber-800">Alterações serão registradas neste tenant.</span><Button className="ml-auto h-9 min-h-9 border-amber-400 bg-white text-amber-950 hover:bg-amber-100" variant="outline" onClick={()=>void state.returnToBaseOrganization()}>Voltar para {state.baseOrganizationName}</Button></div></div>;
}
