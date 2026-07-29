export type Role = 'admin' | 'manager' | 'consultant' | 'finance' | 'marketing' | 'operations';
export type Resource = 'dashboard' | 'crm' | 'agenda' | 'clients' | 'finance' | 'marketing' | 'ai' | 'reports' | 'settings';
export type Action = 'view' | 'create' | 'edit' | 'delete' | 'export' | 'import' | 'admin';
export type Permission = `${Resource}:${Action}`;

export const roles: Record<Role, string> = {
  admin: 'Administrador',
  manager: 'Gestor',
  consultant: 'Consultor',
  finance: 'Financeiro',
  marketing: 'Marketing',
  operations: 'Operacional',
};

const resources: Resource[] = ['dashboard', 'crm', 'agenda', 'clients', 'finance', 'marketing', 'ai', 'reports', 'settings'];
const actions: Action[] = ['view', 'create', 'edit', 'delete', 'export', 'import', 'admin'];

export const rolePermissions: Record<Role, Permission[]> = {
  admin: resources.flatMap((resource) => actions.map((action) => `${resource}:${action}` as Permission)),
  manager: ['dashboard:view', 'crm:view', 'crm:create', 'crm:edit', 'reports:view'],
  consultant: ['dashboard:view', 'crm:view', 'crm:create', 'crm:edit', 'agenda:view'],
  finance: ['dashboard:view', 'finance:view', 'crm:view'],
  marketing: ['dashboard:view', 'marketing:view', 'crm:view'],
  operations: ['dashboard:view', 'crm:view', 'agenda:view'],
};

export function can(permissions: Permission[], permission: Permission) {
  return permissions.includes(permission);
}
