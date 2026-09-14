import { useMemo, useState } from "react";
import { Upload, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/shared/components/overlays/modal";
import type { Profile } from "../types";
import {
  parseLeadSpreadsheet,
  type LeadSpreadsheetRow,
} from "../lead-spreadsheet";

type Props = {
  open: boolean;
  profiles: Profile[];
  onClose: () => void;
  onImport: (rows: LeadSpreadsheetRow[]) => Promise<void>;
};

export function LeadImportDialog({
  open,
  profiles,
  onClose,
  onImport,
}: Props) {
  const [rows, setRows] = useState<LeadSpreadsheetRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [reading, setReading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [fileError, setFileError] = useState("");

  const validRows = useMemo(
    () => rows.filter((row) => !row.error),
    [rows],
  );

  const errorRows = useMemo(
    () => rows.filter((row) => row.error),
    [rows],
  );

  const ownerNames = useMemo(
    () => new Set(profiles.map((profile) => profile.name.toLowerCase())),
    [profiles],
  );

  const rowsWithOwnerValidation = useMemo(() => {
    return rows.map((row) => {
      if (!row.owner || row.error) return row;

      const exists = ownerNames.has(row.owner.toLowerCase());

      if (exists) return row;

      return {
        ...row,
        error: `Responsável "${row.owner}" não encontrado`,
      };
    });
  }, [rows, ownerNames]);

  const finalValidRows = rowsWithOwnerValidation.filter((row) => !row.error);
  const finalErrorRows = rowsWithOwnerValidation.filter((row) => row.error);

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
    if (!finalValidRows.length) return;

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

          <span className="mt-3 font-semibold">
            Selecione sua planilha
          </span>

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
          <p className="text-sm text-muted-foreground">
            Lendo planilha...
          </p>
        )}

        {fileError && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {fileError}
          </div>
        )}

        {fileName && rows.length > 0 && (
          <>
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
                  <p className="text-xs text-muted-foreground">
                    com erro
                  </p>
                </div>
              </div>
            </div>

            <div className="max-h-72 overflow-auto rounded-xl border">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b">
                    <th className="p-3">Linha</th>
                    <th className="p-3">Nome</th>
                    <th className="p-3">WhatsApp</th>
                    <th className="p-3">Responsável</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>

                <tbody>
                  {rowsWithOwnerValidation.map((row) => (
                    <tr key={row.row} className="border-b last:border-0">
                      <td className="p-3">{row.row}</td>
                      <td className="p-3">{row.name || "—"}</td>
                      <td className="p-3">{row.whatsapp || "—"}</td>
                      <td className="p-3">{row.owner || "Atual"}</td>
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
              finalValidRows.length === 0
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