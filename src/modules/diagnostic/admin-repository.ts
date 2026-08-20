import { isSupabaseConfigured } from "@/config/env";
import { supabase } from "@/lib/supabase";
import type { DiagnosticSubmission } from "./types";

export type DiagnosticAdminRow = {
  id: string;
  name: string;
  businessName: string;
  whatsapp: string;
  email: string;
  instagram: string;
  totalScore: number;
  resultLevel: string;
  businessStage: string;
  primaryNeed: string;
  primaryBottleneck: string;
  utmSource?: string;
  utmCampaign?: string;
  companyId?: string;
  opportunityId?: string;
  completedAt: string;
};

const localRows = (): DiagnosticAdminRow[] => {
  const submissions = JSON.parse(localStorage.getItem("esads-diagnostic-results") ?? "[]") as DiagnosticSubmission[];
  return submissions.map((submission) => ({
    id: String(submission.token), name: submission.lead.name, businessName: submission.lead.businessName,
    whatsapp: submission.lead.whatsapp, email: submission.lead.email, instagram: submission.lead.instagram,
    totalScore: submission.result.totalScore, resultLevel: submission.result.level,
    businessStage: submission.result.businessStage, primaryNeed: submission.result.primaryNeed,
    primaryBottleneck: submission.result.primaryBottleneck, completedAt: submission.createdAt,
  }));
};

export async function listDiagnosticSubmissions(): Promise<DiagnosticAdminRow[]> {
  if (!isSupabaseConfigured) return localRows();
  if (!supabase) throw new Error("Supabase não configurado.");
  const { data, error } = await supabase.rpc("list_diagnostic_submissions", { page_limit: 100, page_offset: 0 });
  if (error) throw new Error("Não foi possível carregar os diagnósticos.");
  return (data ?? []) as unknown as DiagnosticAdminRow[];
}
