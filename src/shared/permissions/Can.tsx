import { can, type Permission } from './permissions';
import { useAppState } from '@/shared/state/app-state';

export function Can({ permission, children, fallback = null }: { permission: Permission; children: React.ReactNode; fallback?: React.ReactNode }) {
  const { permissions } = useAppState();
  return can(permissions, permission) ? <>{children}</> : <>{fallback}</>;
}
