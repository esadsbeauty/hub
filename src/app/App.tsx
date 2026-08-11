import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthPage } from "@/modules/auth/AuthPage";
import { CrmPage } from "@/modules/crm/CrmPage";
import { CompanyCentralPage } from "@/modules/crm/pages/CompanyCentralPage";
import { DashboardPage } from "@/modules/dashboard/DashboardPage";
import { AgendaPage } from "@/modules/agenda/AgendaPage";
import { ReportsPage } from "@/modules/reports/ReportsPage";
import { CustomersPage } from "@/modules/customers/CustomersPage";
import { FinancePage } from "@/modules/finance/FinancePage";
import { MarketingPage } from "@/modules/marketing/MarketingPage";
import { UnderDevelopment } from "@/modules/placeholder/UnderDevelopment";
import { AppLayout } from "@/layouts/app-layout";
import { ProtectedRoute } from "@/routes/protected-route";
import { PermissionRoute } from "@/routes/permission-route";
import { SettingsPage } from "@/modules/settings/SettingsPage";
import { RestrictedAccessPage } from "@/modules/settings/RestrictedAccessPage";
import { useAuth } from "@/providers/auth-provider";

function LoginRoute() {
  const { user, passwordRecovery } = useAuth();
  return user && !passwordRecovery ? <Navigate to="/" replace /> : <AuthPage />;
}
export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginRoute />} />
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="acesso-restrito" element={<RestrictedAccessPage />} />
          <Route index element={<PermissionRoute permission="dashboard.view"><DashboardPage /></PermissionRoute>} />
          <Route path="crm" element={<PermissionRoute permission="crm.view"><CrmPage /></PermissionRoute>} />
          <Route path="crm/empresas/:id" element={<PermissionRoute permission="crm.view"><CompanyCentralPage /></PermissionRoute>} />
          <Route path="crm/companies/:id" element={<PermissionRoute permission="crm.view"><CompanyCentralPage /></PermissionRoute>} />
          <Route path="agenda" element={<PermissionRoute permission="agenda.view"><AgendaPage /></PermissionRoute>} />
          <Route path="relatorios" element={<PermissionRoute permission="reports.view"><ReportsPage /></PermissionRoute>} />
          <Route path="clientes" element={<PermissionRoute permission="customers.view"><CustomersPage /></PermissionRoute>} />
          <Route path="financeiro" element={<PermissionRoute permission="finance.view"><FinancePage /></PermissionRoute>} />
          <Route path="marketing" element={<PermissionRoute permission="marketing.view"><MarketingPage /></PermissionRoute>} />
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
      </Routes>
    </BrowserRouter>
  );
}
