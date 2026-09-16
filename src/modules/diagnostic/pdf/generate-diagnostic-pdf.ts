import { categoryContent } from "../content";
import type { DiagnosticSubmission } from "../types";
import reportTemplate from "./diagnostic-report-template.html?raw";

type ReportArea = {
  name: string;
  score: number;
  desc: string;
};

type ReportData = {
  name: string;
  instagram: string;
  phone: string;
  date: string;
  businessType: string;
  overallScore: number;
  status: string;
  statusText: string;
  mainOpportunity: string;
  opportunityText: string;
  insightText: string;
  recommendedDirection: string;
  areas: ReportArea[];
  strengths: string[];
  nextSteps: string[];
};

function safeJsonForHtml(value: unknown) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function normalizeInstagram(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}

function createReportData(submission: DiagnosticSubmission): ReportData {
  const result = submission.result;
  const bottleneck = categoryContent[result.primaryBottleneck];

  const orderedAreas = Object.entries(result.categoryScores)
    .sort(([, a], [, b]) => b - a)
    .map(([key, score]) => {
      const content = categoryContent[key as keyof typeof categoryContent];

      return {
        name: content.label,
        score: Math.round(score),
        desc: content.discovery,
      };
    });

  const strengths = Object.entries(result.categoryScores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([key]) => categoryContent[key as keyof typeof categoryContent].positive);

  const date = new Intl.DateTimeFormat("pt-BR").format(
    new Date(submission.createdAt),
  );

  return {
    name: submission.lead.name,
    instagram: normalizeInstagram(submission.lead.instagram),
    phone: submission.lead.whatsapp,
    date,
    businessType: "Estética e beleza",
    overallScore: Math.round(result.totalScore),
    status: result.level,
    statusText: `Pelas suas respostas, seu negócio está em ${result.level.toLowerCase()}. O próximo passo é transformar ações isoladas em uma rotina mais organizada, consistente e preparada para crescer.`,
    mainOpportunity: bottleneck.label,
    opportunityText: bottleneck.discovery,
    insightText: `Seu momento atual é ${result.businessStage.toLowerCase()}. Isso mostra que existem bases construídas e espaço real para avançar com mais clareza. O principal desafio identificado está em ${bottleneck.label.toLowerCase()}. Esse ponto influencia a forma como novas oportunidades são aproveitadas. A boa notícia é que você não precisa mudar tudo ao mesmo tempo: pequenas rotinas bem escolhidas podem gerar consistência e liberar energia para crescer.`,
    recommendedDirection: result.primaryNeed,
    areas: orderedAreas,
    strengths,
    nextSteps: result.recommendations,
  };
}

export function createDiagnosticHtml(submission: DiagnosticSubmission) {
  const data = createReportData(submission);

  return reportTemplate.replace("__REPORT_DATA__", safeJsonForHtml(data));
}

export function downloadDiagnosticPdf(submission: DiagnosticSubmission) {
  const html = createDiagnosticHtml(submission);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const reportWindow = window.open(url, "_blank");

  if (!reportWindow) {
    URL.revokeObjectURL(url);
    throw new Error(
      "O navegador bloqueou a abertura do relatório. Permita pop-ups e tente novamente.",
    );
  }

  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
