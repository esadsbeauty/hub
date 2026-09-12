export type OnboardingState = { companyProfileCompleted: boolean; ownerProfileCompleted: boolean; whatsappCompleted: boolean; pipelineIntroCompleted: boolean; firstLeadCompleted: boolean; introSeenAt?: string; completedAt?: string; dismissedAt?: string };
export type OnboardingSnapshot = {
  organization: { name: string; whatsapp?: string; city?: string; state?: string; instagram?: string };
  owner: { name: string; email: string; whatsapp?: string };
  pipeline: { id: string; name: string; stages: { id: string; name: string; position: number; isWon: boolean; isLost: boolean }[] };
  state: OnboardingState;
};
export type OnboardingSection = "company" | "owner" | "whatsapp";
export const onboardingSteps = ["companyProfileCompleted", "ownerProfileCompleted", "whatsappCompleted", "pipelineIntroCompleted", "firstLeadCompleted"] as const;
export function onboardingProgress(state: OnboardingState) { const completed = onboardingSteps.filter((key) => state[key]).length; return { completed, total: onboardingSteps.length, percentage: completed * 20 }; }
