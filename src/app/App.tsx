import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/layouts/app-layout";
import { ProtectedRoute } from "@/routes/protected-route";
import { PermissionRoute } from "@/routes/permission-route";
import { useAuth } from "@/providers/auth-context";
import { UnderDevelopment } from "@/modules/placeholder/UnderDevelopment";

const page=<T extends Record<string,unknown>,K extends keyof T>(loader:()=>Promise<T>,name:K)=>lazy(()=>loader().then(module=>({default:module[name]as React.ComponentType})));
const AuthPage=page(()=>import("@/modules/auth/AuthPage"),"AuthPage");
const RegisterPage=page(()=>import("@/modules/auth/RegisterPage"),"RegisterPage");
const InviteAcceptancePage=page(()=>import("@/modules/auth/InviteAcceptancePage"),"InviteAcceptancePage");
const InitialOwnerPage=page(()=>import("@/modules/settings/InitialOwnerPage"),"InitialOwnerPage");
const RestrictedAccessPage=page(()=>import("@/modules/settings/RestrictedAccessPage"),"RestrictedAccessPage");
const DashboardPage=page(()=>import("@/modules/dashboard/DashboardPage"),"DashboardPage");
const CrmPage=page(()=>import("@/modules/crm/CrmPage"),"CrmPage");
const CompanyCentralPage=page(()=>import("@/modules/crm/pages/CompanyCentralPage"),"CompanyCentralPage");
const AgendaPage=page(()=>import("@/modules/agenda/AgendaPage"),"AgendaPage");
const ReportsPage=page(()=>import("@/modules/reports/ReportsPage"),"ReportsPage");
const CustomersPage=page(()=>import("@/modules/customers/CustomersPage"),"CustomersPage");
const FinancePage=page(()=>import("@/modules/finance/FinancePage"),"FinancePage");
const MarketingPage=page(()=>import("@/modules/marketing/MarketingPage"),"MarketingPage");
const BlogCmsPage=page(()=>import("@/modules/blog/pages/BlogCmsPage"),"BlogCmsPage");
const DiagnosticAdminPage=page(()=>import("@/modules/diagnostic/pages/DiagnosticAdminPage"),"DiagnosticAdminPage");
const SettingsPage=page(()=>import("@/modules/settings/SettingsPage"),"SettingsPage");

function LoginRoute() {
  const { user, passwordRecovery } = useAuth();
  return user && !passwordRecovery ? <Navigate to="/" replace /> : <AuthPage />;
}
export function App() {
  const { appMode } = useAuth();
  return (
    <BrowserRouter><Suspense fallback={<div className="grid min-h-[40vh] place-items-center text-sm text-muted-foreground">Carregando módulo…</div>}>
      <Routes>
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/register" element={<RegisterPage />} />
        {appMode === "supabase" && <Route path="/aceitar-convite" element={<ProtectedRoute><InviteAcceptancePage /></ProtectedRoute>} />}
        {appMode === "supabase" && <Route path="/finalizar-configuracao" element={<ProtectedRoute><InitialOwnerPage /></ProtectedRoute>} />}
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="acesso-restrito" element={<RestrictedAccessPage />} />
          <Route path="acesso-pendente" element={<RestrictedAccessPage />} />
          <Route index element={<PermissionRoute permission="dashboard.view"><DashboardPage /></PermissionRoute>} />
          <Route path="crm" element={<PermissionRoute permission="crm.view"><CrmPage /></PermissionRoute>} />
          <Route path="crm/empresas/:id" element={<PermissionRoute permission="crm.view"><CompanyCentralPage /></PermissionRoute>} />
          <Route path="crm/companies/:id" element={<PermissionRoute permission="crm.view"><CompanyCentralPage /></PermissionRoute>} />
          <Route path="agenda" element={<PermissionRoute permission="agenda.view"><AgendaPage /></PermissionRoute>} />
          <Route path="relatorios" element={<PermissionRoute permission="reports.view"><ReportsPage /></PermissionRoute>} />
          <Route path="clientes" element={<PermissionRoute permission="customers.view"><CustomersPage /></PermissionRoute>} />
          <Route path="financeiro" element={<PermissionRoute permission="finance.view"><FinancePage /></PermissionRoute>} />
          <Route path="marketing" element={<PermissionRoute permission="marketing.view"><MarketingPage /></PermissionRoute>} />
          <Route path="marketing/diagnosticos" element={<PermissionRoute permission="marketing.view"><DiagnosticAdminPage /></PermissionRoute>} />
          <Route path="marketing/blog" element={<PermissionRoute permission="blog.view"><BlogCmsPage /></PermissionRoute>} />
          <Route path="configuracoes" element={<PermissionRoute permission="settings.view"><SettingsPage /></PermissionRoute>} />
          {["ia"].map(
            (path) => (
              <Route
                key={path}
                path={path}
                element={
                  <UnderDevelopment
                    title={path[0].toUpperCase() + path.slice(1)}
                  />
                }
              />
            ),
          )}
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense></BrowserRouter>
  );
}