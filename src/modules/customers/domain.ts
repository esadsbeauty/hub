import type { Contract, OnboardingStep } from "./types";

export function onboardingProgress(steps: OnboardingStep[]) {
  const relevant = steps.filter((step) => step.status !== "cancelled");
  const completed = relevant.filter((step) => step.status === "completed").length;
  return { completed, total: relevant.length, percentage: relevant.length ? Math.round(completed / relevant.length * 100) : 0 };
}
export function isOnboardingStepOverdue(step: OnboardingStep, reference = new Date()) {
  return Boolean(step.dueAt && !["completed", "cancelled"].includes(step.status) && new Date(step.dueAt) < reference);
}
export function isContractExpiring(contract: Contract, days: 30 | 60 | 90, reference = new Date()) {
  if (!contract.endDate || ["expired", "cancelled"].includes(contract.status)) return false;
  const end = new Date(`${contract.endDate}T23:59:59.999Z`).getTime();
  return end >= reference.getTime() && end <= reference.getTime() + days * 86_400_000;
}
