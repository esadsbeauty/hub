import { categoryContent } from "./content";
import { diagnosticQuestions } from "./questions";
import type { AnswerKey, DiagnosticAnswers, DiagnosticCategory, DiagnosticResult } from "./types";

const currentCategories: DiagnosticCategory[] = ["acquisition", "demand", "service", "follow_up"];
const legacyCategories: DiagnosticCategory[] = ["acquisition", "service", "organization", "follow_up", "metrics", "demand", "marketing", "financial_clarity"];
const legacyPoints: Record<AnswerKey, number> = { a: 0, b: 33.3333, c: 66.6667, d: 100 };
const currentPoints: Record<(typeof currentCategories)[number], Record<AnswerKey, number>> = {
  acquisition: { a: 50, b: 70, c: 85, d: 0 },
  demand: { a: 0, b: 33, c: 67, d: 100 },
  service: { a: 25, b: 50, c: 100, d: 0 },
  follow_up: { a: 0, b: 33, c: 67, d: 100 },
};

export function calculateDiagnosticResult(answers: DiagnosticAnswers): DiagnosticResult {
  const legacy = Boolean(answers.organization && answers.metrics && answers.marketing && answers.financial_clarity);
  const missing = (legacy ? [...legacyCategories, "business_stage", "primary_need"] : diagnosticQuestions.map(question => question.key))
    .filter(key => !answers[key]);
  if (missing.length) throw new Error("Responda todas as perguntas para continuar.");

  const categories = legacy ? legacyCategories : currentCategories;
  const categoryScores = Object.fromEntries(categories.map(category => [
    category,
    legacy ? legacyPoints[answers[category]] : currentPoints[category][answers[category]],
  ])) as Partial<Record<DiagnosticCategory, number>>;
  const ordered = [...categories].sort((a, b) =>
    (categoryScores[a] ?? 0) - (categoryScores[b] ?? 0) || categories.indexOf(a) - categories.indexOf(b)
  );
  const totalScore = Math.round(categories.reduce((sum, key) => sum + (categoryScores[key] ?? 0), 0) / categories.length);
  const level = totalScore <= 30 ? "Começando a construir a base"
    : totalScore <= 50 ? "Fase de estruturação"
    : totalScore <= 70 ? "Negócio em desenvolvimento"
    : totalScore <= 85 ? "Negócio em crescimento" : "Base bem estruturada";
  const stage = { a: "Começando", b: "Em desenvolvimento", c: "Em crescimento", d: "Em estruturação" }[answers.business_stage];
  const need = {
    a: "Atrair mais clientes novas",
    b: "Conseguir mais agendamentos",
    c: "Organizar o atendimento",
    d: "Crescer com mais previsibilidade",
  }[answers.primary_need];
  return {
    totalScore, level, businessStage: stage, categoryScores,
    primaryBottleneck: ordered[0], strongestArea: ordered[ordered.length - 1],
    primaryNeed: need,
    recommendations: ordered.slice(0, 3).map(key => categoryContent[key].recommendation),
  };
}
