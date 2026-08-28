import { Navigate } from "react-router-dom";
import { useAppState } from "@/shared/state/app-state-context";

export function PlatformAdminRoute({ children }: { children: React.ReactNode }) {
  const { authorizationLoading, isPlatformAdmin } = useAppState();
  if (authorizationLoading) return <div className="grid min-h-[50vh] place-items-center text-sm text-muted-foreground">Validando acesso à plataforma...</div>;
  return isPlatformAdmin ? <>{children}</> : <Navigate to="/acesso-restrito" replace />;
}
