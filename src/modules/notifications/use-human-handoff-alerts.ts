import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { useAppState } from "@/shared/state/app-state-context";
import { useToast } from "@/shared/components/feedback/toast";

export type HumanHandoffAlert = {
  opportunityId: string;
  title: string;
  waitingSince: string;
  waitingMinutes: number;
};

function client() {
  if (!supabase) {
    throw new Error("Supabase não configurado.");
  }

  return supabase;
}

async function listHumanHandoffAlerts(
  organizationId: string,
): Promise<HumanHandoffAlert[]> {
  const api = client();

  const { data: stages, error: stageError } = await api
    .from("pipeline_stages")
    .select("id,pipeline_id,name,slug")
    .eq("is_active", true)
    .or("slug.eq.atendimento_humano,name.ilike.Atendimento humano");

  if (stageError) throw stageError;

  const humanStageIds = (stages ?? []).map((stage) => stage.id);

  if (humanStageIds.length === 0) {
    return [];
  }

  const { data: opportunities, error: opportunityError } = await api
    .from("opportunities")
    .select("id,title,stage_entered_at")
    .eq("organization_id", organizationId)
    .eq("status", "open")
    .is("deleted_at", null)
    .in("stage_id", humanStageIds)
    .order("stage_entered_at", { ascending: true });

  if (opportunityError) throw opportunityError;

  const now = Date.now();

  return (opportunities ?? []).map((opportunity) => {
    const waitingSince = opportunity.stage_entered_at;
    const waitingMinutes = Math.max(
      0,
      Math.floor((now - new Date(waitingSince).getTime()) / 60000),
    );

    return {
      opportunityId: opportunity.id,
      title: opportunity.title,
      waitingSince,
      waitingMinutes,
    };
  });
}

function reminderSlot(waitingMinutes: number) {
  if (waitingMinutes < 5) return 0;
  if (waitingMinutes < 15) return 5;
  if (waitingMinutes < 30) return 15;
  return 30 + Math.floor((waitingMinutes - 30) / 30) * 30;
}

function storageKey(
  organizationId: string,
  opportunityId: string,
) {
  return `esads-human-handoff-reminder:${organizationId}:${opportunityId}`;
}

export function useHumanHandoffAlerts() {
  const {
    organizationId,
    authorizationLoading,
  } = useAppState();

  const { notify } = useToast();

  const query = useQuery({
    queryKey: [
      "notifications",
      "human-handoff",
      organizationId,
    ],
    queryFn: () =>
      listHumanHandoffAlerts(
        organizationId,
      ),
    enabled:
      !authorizationLoading &&
      Boolean(organizationId),
    refetchInterval: 60_000,
    refetchIntervalInBackground: true,
  });

  const alerts = useMemo(
    () => query.data ?? [],
    [query.data],
  );

  useEffect(() => {
    if (!organizationId || !query.isSuccess) {
      return;
    }

    const activeIds = new Set(
      alerts.map(
        (alert) =>
          alert.opportunityId,
      ),
    );

    const prefix =
      `esads-human-handoff-reminder:${organizationId}:`;

    for (
      let index = localStorage.length - 1;
      index >= 0;
      index -= 1
    ) {
      const key =
        localStorage.key(index);

      if (
        key &&
        key.startsWith(prefix)
      ) {
        const opportunityId =
          key.slice(prefix.length);

        if (
          !activeIds.has(
            opportunityId,
          )
        ) {
          localStorage.removeItem(
            key,
          );
        }
      }
    }

    for (const alert of alerts) {
      const slot =
        reminderSlot(
          alert.waitingMinutes,
        );

      const key = storageKey(
        organizationId,
        alert.opportunityId,
      );

      const previousSlot =
        Number(
          localStorage.getItem(
            key,
          ) ?? "-1",
        );

      if (slot <= previousSlot) {
        continue;
      }

      localStorage.setItem(
        key,
        String(slot),
      );

      notify({
        title:
          slot === 0
            ? "Novo lead aguardando atendimento"
            : "Lead ainda aguardando atendimento",
        description:
          slot === 0
            ? `${alert.title} entrou em Atendimento humano.`
            : `${alert.title} está aguardando há ${alert.waitingMinutes} min.`,
      });
    }
  }, [
    alerts,
    notify,
    organizationId,
    query.isSuccess,
  ]);

  return {
    ...query,
    alerts,
  };
}
