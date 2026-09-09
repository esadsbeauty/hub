import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppQueryProvider } from "@/providers/query-provider";
import { PublicLayout } from "@/layouts/public-layout";
import { BlogIndexPage } from "@/modules/blog/pages/BlogIndexPage";
import { BlogPostPage } from "@/modules/blog/pages/BlogPostPage";
import { DiagnosticPage } from "@/modules/diagnostic/pages/DiagnosticPage";
import { DataDeletionPage } from "@/modules/legal/pages/DataDeletionPage";
import { PrivacyPolicyPage } from "@/modules/legal/pages/PrivacyPolicyPage";
import { TermsOfUsePage } from "@/modules/legal/pages/TermsOfUsePage";
import { SalesPage } from "@/modules/sales/SalesPage";

export default function PublicAppRoot() {
  return (
    <AppQueryProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<SalesPage />} />
            <Route path="/sistema" element={<SalesPage />} />
            <Route path="/blog" element={<BlogIndexPage />} />
            <Route path="/blog/:slug" element={<BlogPostPage />} />
            <Route path="/diagnostico" element={<DiagnosticPage />} />
            <Route path="/diagnostico/resultado/:token" element={<DiagnosticPage />} />
            <Route path="/diagnostico/obrigado/:token" element={<DiagnosticPage />} />

            <Route path="/politica-de-privacidade" element={<PrivacyPolicyPage />} />
            <Route path="/termos-de-uso" element={<TermsOfUsePage />} />
            <Route path="/exclusao-de-dados" element={<DataDeletionPage />} />

            <Route path="/privacidade" element={<Navigate to="/politica-de-privacidade" replace />} />
            <Route path="/termos" element={<Navigate to="/termos-de-uso" replace />} />
          </Route>

          <Route path="*" element={<Navigate to="/diagnostico" replace />} />
        </Routes>
      </BrowserRouter>
    </AppQueryProvider>
  );
}
