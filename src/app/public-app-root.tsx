import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppQueryProvider } from "@/providers/query-provider";
import { PublicLayout } from "@/layouts/public-layout";
import { BlogIndexPage } from "@/modules/blog/pages/BlogIndexPage";
import { BlogPostPage } from "@/modules/blog/pages/BlogPostPage";
import { DiagnosticPage } from "@/modules/diagnostic/pages/DiagnosticPage";
import { LegalNoticePage } from "@/modules/diagnostic/pages/LegalNoticePage";
export default function PublicAppRoot(){return <AppQueryProvider><BrowserRouter><Routes><Route element={<PublicLayout/>}><Route path="/blog" element={<BlogIndexPage/>}/><Route path="/blog/:slug" element={<BlogPostPage/>}/><Route path="/diagnostico" element={<DiagnosticPage/>}/><Route path="/diagnostico/resultado/:token" element={<DiagnosticPage/>}/><Route path="/diagnostico/obrigado/:token" element={<DiagnosticPage/>}/><Route path="/privacidade" element={<LegalNoticePage/>}/><Route path="/termos" element={<LegalNoticePage/>}/></Route><Route path="*" element={<Navigate to="/diagnostico" replace/>}/></Routes></BrowserRouter></AppQueryProvider>}
