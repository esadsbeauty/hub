export const permissionKeys = [
  "dashboard.view", "crm.view", "crm.manage", "crm.opportunity.move", "crm.opportunity.close", "crm.settings.manage",
  "agenda.view", "agenda.manage", "customers.view", "customers.manage", "finance.view", "finance.manage", "finance.transactions.reverse",
  "finance.settings.manage", "marketing.view", "marketing.manage", "reports.view", "settings.view", "settings.manage",
  "users.view", "users.manage", "roles.manage", "audit.view",
  "blog.view", "blog.create", "blog.edit", "blog.publish", "blog.delete",
] as const;

export type Permission = typeof permissionKeys[number];
export const permissionLabels: Record<Permission, string> = {
  "dashboard.view":"Visualizar dashboard","crm.view":"Visualizar CRM","crm.manage":"Gerenciar CRM","crm.opportunity.move":"Mover oportunidades","crm.opportunity.close":"Fechar oportunidades","crm.settings.manage":"Configurar CRM","agenda.view":"Visualizar agenda","agenda.manage":"Gerenciar agenda","customers.view":"Visualizar clientes","customers.manage":"Gerenciar clientes","finance.view":"Visualizar Financeiro","finance.manage":"Gerenciar Financeiro","finance.transactions.reverse":"Estornar transações","finance.settings.manage":"Configurar Financeiro","marketing.view":"Visualizar Marketing","marketing.manage":"Gerenciar Marketing","reports.view":"Visualizar relatórios","settings.view":"Visualizar configurações","settings.manage":"Gerenciar organização","users.view":"Visualizar usuários","users.manage":"Gerenciar usuários","roles.manage":"Gerenciar papéis","audit.view":"Visualizar auditoria","blog.view":"Visualizar Blog","blog.create":"Criar artigos","blog.edit":"Editar artigos","blog.publish":"Publicar artigos","blog.delete":"Excluir artigos",
};
export type RoleSlug = "owner" | "admin" | "manager" | "sales" | "operations" | "financial" | "marketing" | "reader";

export const previewRolePermissions: Record<RoleSlug, Permission[]> = {
  owner: [...permissionKeys],
  admin: [...permissionKeys],
  manager: ["dashboard.view", "crm.view", "crm.manage", "crm.opportunity.move", "crm.opportunity.close", "agenda.view", "agenda.manage", "customers.view", "customers.manage", "reports.view", "settings.view", "users.view"],
  sales: ["dashboard.view", "crm.view", "crm.manage", "crm.opportunity.move", "crm.opportunity.close", "agenda.view", "agenda.manage", "customers.view"],
  operations: ["dashboard.view", "crm.view", "agenda.view", "agenda.manage", "customers.view", "customers.manage"],
  financial: ["dashboard.view", "finance.view", "finance.manage", "finance.transactions.reverse", "finance.settings.manage", "reports.view"],
  marketing: ["dashboard.view", "marketing.view", "marketing.manage", "crm.view", "reports.view", "blog.view", "blog.create", "blog.edit", "blog.publish"],
  reader: ["dashboard.view", "crm.view", "agenda.view", "customers.view", "reports.view"],
};

export const can = (permissions: readonly Permission[], permission: Permission) => permissions.includes(permission);
export const canAny = (permissions: readonly Permission[], required: readonly Permission[]) => required.some((permission) => can(permissions, permission));
export const canAll = (permissions: readonly Permission[], required: readonly Permission[]) => required.every((permission) => can(permissions, permission));
