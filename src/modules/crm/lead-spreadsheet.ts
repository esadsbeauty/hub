import * as XLSX from "xlsx";

export type LeadSpreadsheetRow = {
  row: number;
  name: string;
  whatsapp: string;
  instagram: string;
  note: string;
  source: string;
  owner: string;
  error?: string;
};

const HEADER_ALIASES: Record<string, keyof Omit<LeadSpreadsheetRow, "row" | "error">> = {
  nome: "name",
  name: "name",
  lead: "name",
  cliente: "name",

  whatsapp: "whatsapp",
  whats: "whatsapp",
  telefone: "whatsapp",
  celular: "whatsapp",
  phone: "whatsapp",

  instagram: "instagram",
  insta: "instagram",

  observacao: "note",
  observacoes: "note",
  nota: "note",
  notas: "note",
  observation: "note",

  origem: "source",
  source: "source",

  responsavel: "owner",
  owner: "owner",
};

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeKey(value: unknown) {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function normalizeLeadWhatsapp(value: unknown) {
  let digits = normalizeText(value).replace(/\D/g, "");

  if (!digits) return "";

  // Remove DDI brasileiro.
  if (
    digits.startsWith("55") &&
    (digits.length === 12 || digits.length === 13)
  ) {
    digits = digits.slice(2);
  }

  // Remove o zero usado antes do DDD:
  // 031999999999 -> 31999999999
  // 037999922021 -> 37999922021
  if (
    digits.startsWith("0") &&
    (digits.length === 11 || digits.length === 12)
  ) {
    digits = digits.slice(1);
  }

  // Celulares brasileiros antigos sem o nono dígito.
  // Ex.: 3198887777 -> 31998887777
  if (
    digits.length === 10 &&
    ["6", "7", "8", "9"].includes(digits.charAt(2))
  ) {
    digits = `${digits.slice(0, 2)}9${digits.slice(2)}`;
  }

  if (digits.length !== 10 && digits.length !== 11) {
    return "";
  }

  return digits;
}

export function normalizeLeadInstagram(value: unknown) {
  const raw = normalizeText(value);

  if (!raw) return "";

  const username = raw
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .split(/[/?#]/)[0]
    ?.trim();

  return username ? `@${username}` : "";
}

function mapHeaders(headers: unknown[]) {
  return headers.map((header) => {
    const normalized = normalizeKey(header);
    return HEADER_ALIASES[normalized];
  });
}

function rowsFromWorksheet(worksheet: XLSX.WorkSheet) {
  return XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    defval: "",
    raw: false,
  });
}

export async function parseLeadSpreadsheet(
  file: File,
): Promise<LeadSpreadsheetRow[]> {
  let workbook: XLSX.WorkBook;

  if (file.name.toLowerCase().endsWith(".csv")) {
    const text = await file.text();

    workbook = XLSX.read(text, {
      type: "string",
      raw: false,
    });
  } else {
    const buffer = await file.arrayBuffer();

    workbook = XLSX.read(buffer, {
      type: "array",
      raw: false,
    });
  }

  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error("A planilha não possui nenhuma aba.");
  }

  const worksheet = workbook.Sheets[firstSheetName];

  if (!worksheet) {
    throw new Error("Não foi possível ler a primeira aba da planilha.");
  }

  const rows = rowsFromWorksheet(worksheet);

  if (rows.length < 2) {
    throw new Error("A planilha não possui leads para importar.");
  }

  const headers = mapHeaders(rows[0] ?? []);

  if (!headers.includes("name")) {
    throw new Error('A coluna "Nome" não foi encontrada.');
  }

  if (!headers.includes("whatsapp")) {
    throw new Error('A coluna "WhatsApp" não foi encontrada.');
  }

  return rows
    .slice(1)
    .map((values, index) => {
      const mapped: Record<string, string> = {};

      headers.forEach((field, columnIndex) => {
        if (!field) return;

        mapped[field] = normalizeText(values[columnIndex]);
      });

      const name = normalizeText(mapped.name);
      const rawWhatsapp = normalizeText(mapped.whatsapp);
      const whatsapp = normalizeLeadWhatsapp(rawWhatsapp);

      const errors: string[] = [];

      if (!name) {
        errors.push("Nome não informado");
      }

      if (!rawWhatsapp) {
        errors.push("WhatsApp não informado");
      } else if (!whatsapp) {
        errors.push("WhatsApp inválido");
      }

      return {
        row: index + 2,
        name,
        whatsapp,
        instagram: normalizeLeadInstagram(mapped.instagram),
        note: normalizeText(mapped.note),
        source: normalizeText(mapped.source),
        owner: normalizeText(mapped.owner),
        error: errors.length ? errors.join(" · ") : undefined,
      } satisfies LeadSpreadsheetRow;
    })
    .filter((row) => {
      return Boolean(
        row.name ||
          row.whatsapp ||
          row.instagram ||
          row.note ||
          row.source ||
          row.owner,
      );
    });
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");

  if (
    text.includes(";") ||
    text.includes('"') ||
    text.includes("\n") ||
    text.includes("\r")
  ) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

export function downloadLeadExport(
  rows: Array<{
    name: string;
    whatsapp?: string;
    instagram?: string;
    note?: string;
    source?: string;
    owner?: string;
    stage?: string;
    createdAt?: string;
  }>,
) {
  const headers = [
    "Nome",
    "WhatsApp",
    "Instagram",
    "Observação",
    "Origem",
    "Responsável",
    "Etapa",
    "Data de criação",
  ];

  const lines = [
    headers.join(";"),
    ...rows.map((row) =>
      [
        row.name,
        row.whatsapp ?? "",
        row.instagram ?? "",
        row.note ?? "",
        row.source ?? "",
        row.owner ?? "",
        row.stage ?? "",
        row.createdAt ?? "",
      ]
        .map(csvEscape)
        .join(";"),
    ),
  ];

  const content = `\uFEFF${lines.join("\r\n")}`;
  const blob = new Blob([content], {
    type: "text/csv;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = `leads-esads-beauty-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
}