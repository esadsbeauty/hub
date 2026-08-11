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
import { useAuth } from "@/providers/auth-provider";

function LoginRoute() {
  const { user } = useAuth();
  return user ? <Navigate to="/" replace /> : <AuthPage />;
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
          <Route index element={<DashboardPage />} />
          <Route path="crm" element={<CrmPage />} />
          <Route path="crm/empresas/:id" element={<CompanyCentralPage />} />
          <Route path="crm/companies/:id" element={<CompanyCentralPage />} />
          <Route path="agenda" element={<AgendaPage />} />
          <Route path="relatorios" element={<ReportsPage />} />
          <Route path="clientes" element={<CustomersPage />} />
          <Route path="financeiro" element={<FinancePage />} />
          <Route path="marketing" element={<MarketingPage />} />
          {["ia", "configuracoes"].map(
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
