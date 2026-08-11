import { Navigate } from "react-router-dom";
import type { Permission } from "@/shared/permissions/permissions";
import { useAppState } from "@/shared/state/app-state";

export function PermissionRoute({ permission, children }: { permission: Permission; children: React.ReactNode }) {
  const { can, authorizationLoading, status } = useAppState();
  if (authorizationLoading) return <div className="grid min-h-[50vh] place-items-center text-sm text-muted-foreground">Validando acesso...</div>;
  if (status !== "active" || !can(permission)) return <Navigate to="/acesso-restrito" replace />;
  return <>{children}</>;
}
