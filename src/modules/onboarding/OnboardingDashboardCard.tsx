import { CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAppState } from "@/shared/state/app-state-context";
import { useOnboarding, useOnboardingActions } from "./hooks";
import { onboardingProgress } from "./types";

export function OnboardingDashboardCard() {
  const { can } = useAppState(); const onboarding = useOnboarding(); const actions = useOnboardingActions();
  if (!can("settings.manage") || !onboarding.data || onboarding.data.state.dismissedAt) return null;
  const progress = onboardingProgress(onboarding.data.state);
  if (onboarding.data.state.completedAt) return <Card className="border border-emerald-200 bg-emerald-50"><CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center"><CheckCircle2 className="text-emerald-700"/><div className="flex-1"><h2 className="font-semibold">Tudo pronto!</h2><p className="text-sm text-emerald-900">Sua conta está configurada para começar a organizar seus leads.</p></div><Button variant="ghost" disabled={actions.complete.isPending} onClick={() => actions.complete.mutate("dismiss")}>Ocultar</Button></CardContent></Card>;
  return <Card className="border border-champagne/40"><CardContent className="pt-6"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.15em] text-muted-foreground">Primeiros passos</p><h2 className="mt-1 text-xl font-semibold">Configure sua conta</h2><p className="mt-1 text-sm text-muted-foreground">{progress.completed} de {progress.total} concluídos · {progress.total-progress.completed} etapas restantes</p></div><strong className="text-2xl">{progress.percentage}%</strong></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{width:`${progress.percentage}%`}}/></div><Link to="/onboarding" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground">Continuar configuração</Link></CardContent></Card>;
}
