import { useEffect, useMemo, useState } from "react";
import { Archive, ArrowDown, ArrowUp, Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/shared/components/overlays/modal";
import type { Opportunity, Pipeline, PipelineStage } from "../types";

type Draft = {
  name: string;
  probability: string;
};

type CreateStageInput = {
  name: string;
  probability: number;
};

type UpdateStageInput = {
  id: string;
  name: string;
  probability?: number;
};

export function PipelineStageManager({
  open,
  pipeline,
  stages,
  opportunities,
  onClose,
  onCreate,
  onUpdate,
  onReorder,
  onArchive,
}: {
  open: boolean;
  pipeline?: Pipeline;
  stages: PipelineStage[];
  opportunities: Opportunity[];
  onClose: () => void;
  onCreate: (input: CreateStageInput) => Promise<void>;
  onUpdate: (input: UpdateStageInput) => Promise<void>;
  onReorder: (stageIds: string[]) => Promise<void>;
  onArchive: (stageId: string) => Promise<void>;
}) {
  const orderedStages = useMemo(
    () => [...stages].sort((a, b) => a.position - b.position),
    [stages],
  );
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [newName, setNewName] = useState("");
  const [newProbability, setNewProbability] = useState("10");
  const [busyId, setBusyId] = useState<string>();
  const [creating, setCreating] = useState(false);
  const [reordering, setReordering] = useState(false);

  useEffect(() => {
    setDrafts(
      Object.fromEntries(
        orderedStages.map((stage) => [
          stage.id,
          {
            name: stage.name,
            probability: String(stage.probability),
          },
        ]),
      ),
    );
  }, [orderedStages]);

  const opportunityCount = (stageId: string) =>
    opportunities.filter(
      (item) =>
        item.stageId === stageId &&
        !item.deletedAt &&
        item.status !== "archived",
    ).length;

  const updateDraft = (stageId: string, patch: Partial<Draft>) =>
    setDrafts((current) => ({
      ...current,
      [stageId]: { ...current[stageId], ...patch },
    }));

  const saveStage = async (stage: PipelineStage) => {
    const draft = drafts[stage.id];
    if (!draft?.name.trim()) return;
    setBusyId(stage.id);
    try {
      await onUpdate({
        id: stage.id,
        name: draft.name.trim(),
        probability:
          stage.isWon || stage.isLost
            ? undefined
            : Math.max(0, Math.min(100, Number(draft.probability) || 0)),
      });
    } finally {
      setBusyId(undefined);
    }
  };

  const move = async (stageId: string, direction: -1 | 1) => {
    const currentIndex = orderedStages.findIndex((stage) => stage.id === stageId);
    const targetIndex = currentIndex + direction;
    if (
      currentIndex < 0 ||
      targetIndex < 0 ||
      targetIndex >= orderedStages.length
    )
      return;

    const next = orderedStages.map((stage) => stage.id);
    [next[currentIndex], next[targetIndex]] = [
      next[targetIndex],
      next[currentIndex],
    ];

    setReordering(true);
    try {
      await onReorder(next);
    } finally {
      setReordering(false);
    }
  };

  const createStage = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      await onCreate({
        name,
        probability: Math.max(
          0,
          Math.min(100, Number(newProbability) || 0),
        ),
      });
      setNewName("");
      setNewProbability("10");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal open={open} title="Editar pipeline" onClose={onClose}>
      <div className="space-y-5">
        <div>
          <p className="font-semibold">{pipeline?.name ?? "Pipeline"}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Crie, renomeie e reorganize as etapas da sua organização.
            As etapas de ganho e perda continuam protegidas.
          </p>
        </div>

        <div className="space-y-3">
          {orderedStages.map((stage, index) => {
            const draft = drafts[stage.id] ?? {
              name: stage.name,
              probability: String(stage.probability),
            };
            const count = opportunityCount(stage.id);
            const protectedStage = stage.isWon || stage.isLost;

            return (
              <section
                key={stage.id}
                className="rounded-2xl border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">
                      Etapa {index + 1}
                      {stage.isWon ? " · Ganho" : stage.isLost ? " · Perda" : ""}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {count} oportunidade{count === 1 ? "" : "s"} nesta etapa
                    </p>
                  </div>

                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={index === 0 || reordering}
                      onClick={() => move(stage.id, -1)}
                      aria-label={`Mover ${stage.name} para a esquerda`}
                    >
                      <ArrowUp size={15} />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={
                        index === orderedStages.length - 1 || reordering
                      }
                      onClick={() => move(stage.id, 1)}
                      aria-label={`Mover ${stage.name} para a direita`}
                    >
                      <ArrowDown size={15} />
                    </Button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_8rem_auto] sm:items-end">
                  <label className="grid gap-2">
                    <span className="text-sm font-medium">Nome</span>
                    <Input
                      value={draft.name}
                      onChange={(event) =>
                        updateDraft(stage.id, { name: event.target.value })
                      }
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-sm font-medium">Probabilidade</span>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      disabled={protectedStage}
                      value={
                        stage.isWon
                          ? "100"
                          : stage.isLost
                            ? "0"
                            : draft.probability
                      }
                      onChange={(event) =>
                        updateDraft(stage.id, {
                          probability: event.target.value,
                        })
                      }
                    />
                  </label>

                  <Button
                    type="button"
                    onClick={() => saveStage(stage)}
                    disabled={busyId === stage.id || !draft.name.trim()}
                  >
                    <Save size={16} /> Salvar
                  </Button>
                </div>

                <div className="mt-3 flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-destructive"
                    disabled={protectedStage || count > 0 || busyId === stage.id}
                    title={
                      protectedStage
                        ? "Etapas de ganho e perda não podem ser arquivadas."
                        : count > 0
                          ? "Mova as oportunidades antes de arquivar esta etapa."
                          : "Arquivar etapa"
                    }
                    onClick={async () => {
                      if (
                        protectedStage ||
                        count > 0 ||
                        !window.confirm(
                          `Arquivar a etapa "${stage.name}"?`,
                        )
                      )
                        return;
                      setBusyId(stage.id);
                      try {
                        await onArchive(stage.id);
                      } finally {
                        setBusyId(undefined);
                      }
                    }}
                  >
                    <Archive size={15} /> Arquivar etapa
                  </Button>
                </div>
              </section>
            );
          })}
        </div>

        <section className="rounded-2xl border border-dashed p-4">
          <h3 className="font-semibold">Nova etapa</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_8rem_auto] sm:items-end">
            <label className="grid gap-2">
              <Label htmlFor="new-pipeline-stage-name">Nome</Label>
              <Input
                id="new-pipeline-stage-name"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder="Ex.: Orçamento enviado"
              />
            </label>
            <label className="grid gap-2">
              <Label htmlFor="new-pipeline-stage-probability">
                Probabilidade
              </Label>
              <Input
                id="new-pipeline-stage-probability"
                type="number"
                min={0}
                max={100}
                value={newProbability}
                onChange={(event) => setNewProbability(event.target.value)}
              />
            </label>
            <Button
              type="button"
              onClick={createStage}
              disabled={creating || !newName.trim()}
            >
              <Plus size={16} /> Criar etapa
            </Button>
          </div>
        </section>
      </div>
    </Modal>
  );
}
