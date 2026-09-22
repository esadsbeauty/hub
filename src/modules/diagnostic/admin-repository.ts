import { isSupabaseConfigured } from "@/config/env";
import { supabase } from "@/lib/supabase";
import type {
  DiagnosticAnswers,
  DiagnosticCategory,
  DiagnosticSubmission,
} from "./types";

export type DiagnosticAdminRow = {
  id: string;
  token: string;
  name: string;
  businessName: string;
  whatsapp: string;
  email?: string;
  instagram: string;
  totalScore: number;
  resultLevel: string;
  businessStage: string;
  primaryNeed: string;
  primaryBottleneck: DiagnosticCategory;
  strongestArea: DiagnosticCategory;
  categoryScores: Record<DiagnosticCategory, number>;
  answers: DiagnosticAnswers;
  utmSource?: string;
  utmCampaign?: string;
  companyId?: string;
  opportunityId?: string;
  completedAt: string;
  createdAt: string;
};

const localRows = (): DiagnosticAdminRow[] => {
  const submissions = JSON.parse(
    localStorage.getItem("esads-diagnostic-results") ?? "[]",
  ) as DiagnosticSubmission[];

  return submissions.map((submission) => ({
    id: String(submission.token),
    token: String(submission.token),
    name: submission.lead.name,
    businessName: submission.lead.name,
    whatsapp: submission.lead.whatsapp,
    email: "",
    instagram: submission.lead.instagram,
    totalScore: submission.result.totalScore,
    resultLevel: submission.result.level,
    businessStage: submission.result.businessStage,
    primaryNeed: submission.result.primaryNeed,
    primaryBottleneck: submission.result.primaryBottleneck,
    strongestArea: submission.result.strongestArea,
    categoryScores: submission.result.categoryScores,
    answers: submission.answers,
    completedAt: submission.createdAt,
    createdAt: submission.createdAt,
  }));
};

export async function listDiagnosticSubmissions(): Promise<
  DiagnosticAdminRow[]
> {
  if (!isSupabaseConfigured) return localRows();

  if (!supabase) {
    throw new Error("Supabase não configurado.");
  }

  const { data, error } = await supabase.rpc("list_diagnostic_submissions", {
    page_limit: 100,
    page_offset: 0,
  });

  if (error) {
    throw new Error("Não foi possível carregar os diagnósticos.");
  }

  return (data ?? []) as unknown as DiagnosticAdminRow[];
}