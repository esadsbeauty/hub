import type { Permission } from "./permissions";
import { useAppState } from "@/shared/state/app-state-context";

export function Can({ permission, children, fallback = null }: { permission: Permission; children: React.ReactNode; fallback?: React.ReactNode }) {
  const { can } = useAppState();
  return can(permission) ? <>{children}</> : <>{fallback}</>;
}
