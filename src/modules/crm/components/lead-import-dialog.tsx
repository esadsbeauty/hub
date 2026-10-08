import { useEffect, useMemo, useState } from "react";
import { Upload, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Modal } from "@/shared/components/overlays/modal";
import type { Pipeline, PipelineStage, Profile } from "../types";
import {
  parseLeadSpreadsheet,
  type LeadSpreadsheetRow,
} from "../lead-spreadsheet";

type Props = {
  open: boolean;
  profiles: Profile[];
  pipelines: Pipeline[];
  stages: PipelineStage[];
  onClose: () => void;
  onImport: (rows: LeadSpreadsheetRow[]) => Promise<void>;
};

type Temperature = "frio" | "morno" | "quente";
type Priority = "baixa" | "media" | "alta";

export function LeadImportDialog({
  open,
  profiles,
  pipelines,
  stages,
  onClose,
  onImport,
}: Props) {
  const [rows, setRows] = useState<LeadSpreadsheetRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [reading, setReading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [fileError, setFileError] = useState("");

  const defaultPipeline = useMemo(
    () => pipelines.find((pipeline) => pipeline.isDefault) ?? pipelines[0],
    [pipelines],
  );

  const [pipelineId, setPipelineId] = useState("");
  const [stageId, setStageId] = useState("");
  const [defaultSource, setDefaultSource] = useState("Prospecção");
  const [defaultOwnerId, setDefaultOwnerId] = useState("");
  const [temperature, setTemperature] = useState<Temperature>("morno");
  const [priority, setPriority] = useState<Priority>("media");
  const [keepSpreadsheetSource, setKeepSpreadsheetSource] = useState(true);
  const [keepSpreadsheetOwner, setKeepSpreadsheetOwner] = useState(true);

  useEffect(() => {
    if (!open) return;
    if (!pipelineId && defaultPipeline?.id) {
      setPipelineId(defaultPipeline.id);
    }
  }, [open, defaultPipeline, pipelineId]);

  const pipelineStages = useMemo(
    () =>
      stages
        .filter(
          (stage) =>
            stage.pipelineId === pipelineId &&
            stage.isActive !== false &&
            !stage.isWon &&
            !stage.isLost,
        )
        .sort((a, b) => a.position - b.position),
    [stages, pipelineId],
  );

  useEffect(() => {
    if (!pipelineId) {
      setStageId("");
      return;
    }

    const stageStillValid = pipelineStages.some((stage) => stage.id === stageId);
    if (!stageStillValid) {
      setStageId(pipelineStages[0]?.id ?? "");
    }
  }, [pipelineId, pipelineStages, stageId]);

  const ownerNames = useMemo(
    () => new Set(profiles.map((profile) => profile.name.toLowerCase())),
    [profiles],
  );

  const ownerById = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile.name])),
    [profiles],
  );

  const selectedStageName =
    pipelineStages.find((stage) => stage.id === stageId)?.name ?? "";

  const selectedPipelineName =
    pipelines.find((pipeline) => pipeline.id === pipelineId)?.name ?? "";

  const selectedDefaultOwnerName =
    defaultOwnerId ? ownerById.get(defaultOwnerId) ?? "" : "";

  const rowsWithOwnerValidation = useMemo(() => {
    return rows.map((row) => {
      if (!keepSpreadsheetOwner || !row.owner || row.error) return row;

      const exists = ownerNames.has(row.owner.toLowerCase());
      if (exists) return row;

      return {
        ...row,
        error: `Responsável "${row.owner}" não encontrado`,
      };
    });
  }, [rows, ownerNames, keepSpreadsheetOwner]);

  const preparedRows = useMemo(() => {
    return rowsWithOwnerValidation.map((row) => {
      const source =
        keepSpreadsheetSource && row.source
          ? row.source
          : defaultSource.trim();

      const owner =
        keepSpreadsheetOwner && row.owner
          ? row.owner
          : selectedDefaultOwnerName;

      return {
        ...row,
        source,
        owner,
        pipelineId,
        stageId,
        temperature,
        priority,
      } satisfies LeadSpreadsheetRow;
    });
  }, [
    rowsWithOwnerValidation,
    keepSpreadsheetSource,
    keepSpreadsheetOwner,
    defaultSource,
    selectedDefaultOwnerName,
    pipelineId,
    stageId,
    temperature,
    priority,
  ]);

  const finalValidRows = preparedRows.filter((row) => !row.error);
  const finalErrorRows = preparedRows.filter((row) => row.error);

  async function handleFile(file?: File) {
    if (!file) return;

    setReading(true);
    setFileError("");
    setRows([]);
    setFileName(file.name);

    try {
      const parsed = await parseLeadSpreadsheet(file);
      setRows(parsed);
    } catch (error) {
      setFileError(
        error instanceof Error
          ? error.message
          : "Não foi possível ler a planilha.",
      );
    } finally {
      setReading(false);
    }
  }

  async function handleImport() {
    if (!finalValidRows.length || !pipelineId || !stageId) return;

    setImporting(true);

    try {
      await onImport(finalValidRows);
      setRows([]);
      setFileName("");
      onClose();
    } finally {
      setImporting(false);
    }
  }

  return (
    <Modal open={open} title="Importar leads" onClose={onClose}>
      <div className="space-y-5">
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-border p-6 text-center transition hover:bg-muted/40">
          <FileSpreadsheet size={30} />

          <span className="mt-3 font-semibold">Selecione sua planilha</span>

          <span className="mt-1 text-sm text-muted-foreground">
            Arquivos .xlsx, .xls ou .csv
          </span>

          <input
            className="hidden"
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(event) => handleFile(event.target.files?.[0])}
          />
        </label>

        {reading && (
          <p className="text-sm text-muted-foreground">Lendo planilha...</p>
        )}

        {fileError && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {fileError}
          </div>
        )}

        {fileName && rows.length > 0 && (
          <>
            <div className="rounded-xl border bg-muted/20 p-4">
              <div className="mb-4">
                <p className="font-semibold">Configuração da importação</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Defina onde e como os leads desta planilha entrarão no CRM.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-sm font-medium">Pipeline</span>
                  <Select
                    value={pipelineId}
                    onChange={(event) => {
                      setPipelineId(event.target.value);
                      setStageId("");
                    }}
                  >
                    <option value="">Selecione o pipeline</option>
                    {pipelines.map((pipeline) => (
                      <option key={pipeline.id} value={pipeline.id}>
                        {pipeline.name}
                      </option>
                    ))}
                  </Select>
                </label>

                <label className="space-y-1.5">
                  <span className="text-sm font-medium">Etapa inicial</span>
                  <Select
                    value={stageId}
                    onChange={(event) => setStageId(event.target.value)}
                    disabled={!pipelineId}
                  >
                    <option value="">Selecione a etapa</option>
                    {pipelineStages.map((stage) => (
                      <option key={stage.id} value={stage.id}>
                        {stage.name}
                      </option>
                    ))}
                  </Select>
                </label>

                <label className="space-y-1.5">
                  <span className="text-sm font-medium">Origem padrão</span>
                  <input
                    value={defaultSource}
                    onChange={(event) => setDefaultSource(event.target.value)}
                    placeholder="Ex.: Prospecção"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="text-sm font-medium">Responsável padrão</span>
                  <Select
                    value={defaultOwnerId}
                    onChange={(event) => setDefaultOwnerId(event.target.value)}
                  >
                    <option value="">Usuário atual</option>
                    {profiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.name}
                      </option>
                    ))}
                  </Select>
                </label>

                <label className="space-y-1.5">
                  <span className="text-sm font-medium">Temperatura</span>
                  <Select
                    value={temperature}
                    onChange={(event) =>
                      setTemperature(event.target.value as Temperature)
                    }
                  >
                    <option value="frio">Frio</option>
                    <option value="morno">Morno</option>
                    <option value="quente">Quente</option>
                  </Select>
                </label>

                <label className="space-y-1.5">
                  <span className="text-sm font-medium">Prioridade</span>
                  <Select
                    value={priority}
                    onChange={(event) =>
                      setPriority(event.target.value as Priority)
                    }
                  >
                    <option value="baixa">Baixa</option>
                    <option value="media">Média</option>
                    <option value="alta">Alta</option>
                  </Select>
                </label>
              </div>

              <div className="mt-4 space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={keepSpreadsheetSource}
                    onChange={(event) =>
                      setKeepSpreadsheetSource(event.target.checked)
                    }
                  />
                  Usar a origem da planilha quando ela estiver preenchida
                </label>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={keepSpreadsheetOwner}
                    onChange={(event) =>
                      setKeepSpreadsheetOwner(event.target.checked)
                    }
                  />
                  Usar o responsável da planilha quando ele estiver preenchido
                </label>
              </div>
            </div>

            <div className="rounded-xl bg-muted/50 p-4">
              <p className="font-semibold">{fileName}</p>

              <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-xl font-semibold">{rows.length}</p>
                  <p className="text-xs text-muted-foreground">
                    linhas encontradas
                  </p>
                </div>

                <div>
                  <p className="text-xl font-semibold">
                    {finalValidRows.length}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    prontas para importar
                  </p>
                </div>

                <div>
                  <p className="text-xl font-semibold">
                    {finalErrorRows.length}
                  </p>
                  <p className="text-xs text-muted-foreground">com erro</p>
                </div>
              </div>
            </div>

            <div className="max-h-72 overflow-auto rounded-xl border">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b">
                    <th className="p-3">Linha</th>
                    <th className="p-3">Nome</th>
                    <th className="p-3">WhatsApp</th>
                    <th className="p-3">Origem</th>
                    <th className="p-3">Responsável</th>
                    <th className="p-3">Pipeline</th>
                    <th className="p-3">Etapa</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>

                <tbody>
                  {preparedRows.map((row) => (
                    <tr key={row.row} className="border-b last:border-0">
                      <td className="p-3">{row.row}</td>
                      <td className="p-3">{row.name || "—"}</td>
                      <td className="p-3">{row.whatsapp || "—"}</td>
                      <td className="p-3">{row.source || "—"}</td>
                      <td className="p-3">{row.owner || "Usuário atual"}</td>
                      <td className="p-3">{selectedPipelineName || "—"}</td>
                      <td className="p-3">{selectedStageName || "—"}</td>
                      <td className="p-3">
                        {row.error ? (
                          <span className="text-destructive">{row.error}</span>
                        ) : (
                          <span className="font-medium text-emerald-700">
                            Pronto
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={importing}
          >
            Cancelar
          </Button>

          <Button
            onClick={handleImport}
            disabled={
              importing ||
              reading ||
              finalValidRows.length === 0 ||
              !pipelineId ||
              !stageId
            }
          >
            <Upload size={17} />
            {importing
              ? "Importando..."
              : `Importar ${finalValidRows.length || ""}`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
