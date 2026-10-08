import { useMemo, useState } from "react";
import {
  FileSpreadsheet,
  Trash2,
  Upload,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/shared/components/overlays/modal";
import {
  parseProspectingCsv,
  parseProspectingPaste,
  type ProspectingImportRow,
} from "./prospecting-import";
import { useCreateProspectingList } from "./hooks";

type Props = {
  open: boolean;
  onClose: () => void;
};

type SourceType = "csv" | "paste";

export function ProspectingListDialog({
  open,
  onClose,
}: Props) {
  const createList = useCreateProspectingList();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sourceType, setSourceType] =
    useState<SourceType>("csv");

  const [pasteValue, setPasteValue] = useState("");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<
    ProspectingImportRow[]
  >([]);

  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");

  const validRows = useMemo(
    () => rows.filter((row) => !row.error),
    [rows],
  );

  const invalidRows = useMemo(
    () => rows.filter((row) => row.error),
    [rows],
  );

  function reset() {
    setName("");
    setDescription("");
    setSourceType("csv");
    setPasteValue("");
    setFileName("");
    setRows([]);
    setError("");
    setReading(false);
  }

  function handleClose() {
    if (createList.isPending) return;

    reset();
    onClose();
  }

  async function handleFile(file?: File) {
    if (!file) return;

    setReading(true);
    setError("");
    setRows([]);
    setFileName(file.name);

    try {
      const parsed =
        await parseProspectingCsv(file);

      setRows(parsed);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível ler o arquivo.",
      );
    } finally {
      setReading(false);
    }
  }

  function handlePaste() {
    setError("");

    try {
      const parsed =
        parseProspectingPaste(pasteValue);

      setRows(parsed);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível ler os dados colados.",
      );
    }
  }

  function removeRow(rowNumber: number) {
    setRows((current) =>
      current.filter(
        (row) => row.row !== rowNumber,
      ),
    );
  }

  async function handleSave() {
    const trimmedName = name.trim();

    if (!trimmedName) {
      setError("Informe o nome da lista.");
      return;
    }

    if (!validRows.length) {
      setError(
        "Adicione pelo menos um lead válido.",
      );
      return;
    }

    setError("");

    try {
      await createList.mutateAsync({
        name: trimmedName,
        description: description.trim(),
        sourceType,
        rows: validRows,
      });

      reset();
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível salvar a lista.",
      );
    }
  }

  return (
    <Modal
      open={open}
      title="Nova lista de prospecção"
      onClose={handleClose}
    >
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-sm font-medium">
              Nome da lista
            </span>

            <input
              value={name}
              onChange={(event) =>
                setName(event.target.value)
              }
              placeholder="Ex.: Clínicas de estética - Outubro"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-sm font-medium">
              Método de entrada
            </span>

            <select
              value={sourceType}
              onChange={(event) => {
                setSourceType(
                  event.target.value as SourceType,
                );
                setRows([]);
                setError("");
              }}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="csv">
                Importar CSV
              </option>
              <option value="paste">
                Colar leads
              </option>
            </select>
          </label>
        </div>

        <label className="space-y-1.5">
          <span className="text-sm font-medium">
            Descrição
          </span>

          <textarea
            value={description}
            onChange={(event) =>
              setDescription(
                event.target.value,
              )
            }
            placeholder="Opcional"
            rows={3}
            className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>

        {sourceType === "csv" ? (
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-border p-6 text-center transition hover:bg-muted/40">
            <FileSpreadsheet size={30} />

            <span className="mt-3 font-semibold">
              Selecione o arquivo CSV
            </span>

            <span className="mt-1 text-sm text-muted-foreground">
              Nome, WhatsApp, Instagram,
              Cidade, Tipo de negócio e
              Observações
            </span>

            <input
              className="hidden"
              type="file"
              accept=".csv"
              onChange={(event) =>
                handleFile(
                  event.target.files?.[0],
                )
              }
            />
          </label>
        ) : (
          <div className="space-y-3">
            <label className="space-y-1.5">
              <span className="text-sm font-medium">
                Cole os leads
              </span>

              <textarea
                value={pasteValue}
                onChange={(event) =>
                  setPasteValue(
                    event.target.value,
                  )
                }
                rows={8}
                placeholder={
                  "Nome\tWhatsApp\tInstagram\tCidade\tTipo de negócio\tObservações"
                }
                className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
              />
            </label>

            <Button
              type="button"
              variant="outline"
              onClick={handlePaste}
            >
              Revisar dados colados
            </Button>
          </div>
        )}

        {reading && (
          <p className="text-sm text-muted-foreground">
            Lendo arquivo...
          </p>
        )}

        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {fileName && rows.length > 0 && (
          <div className="rounded-xl bg-muted/50 p-4">
            <p className="font-semibold">
              {fileName}
            </p>
          </div>
        )}

        {rows.length > 0 && (
          <>
            <div className="grid grid-cols-3 gap-3 rounded-xl bg-muted/50 p-4 text-center">
              <div>
                <p className="text-xl font-semibold">
                  {rows.length}
                </p>
                <p className="text-xs text-muted-foreground">
                  encontrados
                </p>
              </div>

              <div>
                <p className="text-xl font-semibold">
                  {validRows.length}
                </p>
                <p className="text-xs text-muted-foreground">
                  válidos
                </p>
              </div>

              <div>
                <p className="text-xl font-semibold">
                  {invalidRows.length}
                </p>
                <p className="text-xs text-muted-foreground">
                  com erro
                </p>
              </div>
            </div>

            <div className="max-h-80 overflow-auto rounded-xl border">
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b">
                    <th className="p-3">
                      Nome
                    </th>
                    <th className="p-3">
                      WhatsApp
                    </th>
                    <th className="p-3">
                      Instagram
                    </th>
                    <th className="p-3">
                      Cidade
                    </th>
                    <th className="p-3">
                      Tipo de negócio
                    </th>
                    <th className="p-3">
                      Observações
                    </th>
                    <th className="p-3">
                      Status
                    </th>
                    <th className="p-3">
                      Ação
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.row}
                      className="border-b last:border-0"
                    >
                      <td className="p-3">
                        {row.name || "—"}
                      </td>

                      <td className="p-3">
                        {row.whatsapp || "—"}
                      </td>

                      <td className="p-3">
                        {row.instagram || "—"}
                      </td>

                      <td className="p-3">
                        {row.city || "—"}
                      </td>

                      <td className="p-3">
                        {row.businessType || "—"}
                      </td>

                      <td className="max-w-xs whitespace-normal p-3">
                        {row.notes || "—"}
                      </td>

                      <td className="p-3">
                        {row.error ? (
                          <span className="text-destructive">
                            {row.error}
                          </span>
                        ) : (
                          <span className="font-medium text-emerald-700">
                            Pronto
                          </span>
                        )}
                      </td>

                      <td className="p-3">
                        <button
                          type="button"
                          onClick={() =>
                            removeRow(row.row)
                          }
                          className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-destructive"
                          aria-label="Remover lead"
                          title="Remover lead"
                        >
                          <Trash2 size={16} />
                        </button>
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
            onClick={handleClose}
            disabled={createList.isPending}
          >
            Cancelar
          </Button>

          <Button
            onClick={handleSave}
            disabled={
              createList.isPending ||
              reading ||
              !name.trim() ||
              validRows.length === 0
            }
          >
            <Upload size={17} />
            {createList.isPending
              ? "Salvando..."
              : `Salvar lista${
                  validRows.length
                    ? ` (${validRows.length})`
                    : ""
                }`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}