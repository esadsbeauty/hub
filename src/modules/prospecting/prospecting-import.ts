import * as XLSX from "xlsx";

export type ProspectingImportRow = {
  row: number;
  name: string;
  whatsapp: string;
  instagram: string;
  city: string;
  businessType: string;
  notes: string;
  error?: string;
};

const HEADER_ALIASES: Record<
  string,
  keyof Omit<ProspectingImportRow, "row" | "error">
> = {
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

  cidade: "city",
  city: "city",
  municipio: "city",

  profissao: "businessType",
  profissaotipo: "businessType",
  tipodenegocio: "businessType",
  negocio: "businessType",
  business: "businessType",
  businesstype: "businessType",
  segmento: "businessType",

  observacao: "notes",
  observacoes: "notes",
  nota: "notes",
  notas: "notes",
  notes: "notes",
  observation: "notes",
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

export function normalizeProspectingWhatsapp(
  value: unknown,
) {
  let digits = normalizeText(value).replace(/\D/g, "");

  if (!digits) return "";

  if (
    digits.startsWith("55") &&
    (digits.length === 12 || digits.length === 13)
  ) {
    digits = digits.slice(2);
  }

  if (
    digits.startsWith("0") &&
    (digits.length === 11 || digits.length === 12)
  ) {
    digits = digits.slice(1);
  }

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

export function normalizeProspectingInstagram(
  value: unknown,
) {
  const raw = normalizeText(value);

  if (!raw) return "";

  const username = raw
    .replace(
      /^https?:\/\/(www\.)?instagram\.com\//i,
      "",
    )
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

function hasIdentifiableData(
  row: Omit<ProspectingImportRow, "row" | "error">,
) {
  return Boolean(
    row.name ||
      row.whatsapp ||
      row.instagram ||
      row.city ||
      row.businessType ||
      row.notes,
  );
}

function parseRows(rows: unknown[][]) {
  if (rows.length < 2) {
    throw new Error(
      "Não foram encontrados leads para importar.",
    );
  }

  const headers = mapHeaders(rows[0] ?? []);

  const recognizedHeaders = headers.filter(Boolean);

  if (!recognizedHeaders.length) {
    throw new Error(
      "Não foi possível identificar as colunas da lista.",
    );
  }

  return rows
    .slice(1)
    .map((values, index) => {
      const mapped: Record<string, string> = {};

      headers.forEach((field, columnIndex) => {
        if (!field) return;

        mapped[field] = normalizeText(
          values[columnIndex],
        );
      });

      const rawWhatsapp = normalizeText(
        mapped.whatsapp,
      );

      const whatsapp =
        normalizeProspectingWhatsapp(rawWhatsapp);

      const row = {
        name: normalizeText(mapped.name),
        whatsapp,
        instagram:
          normalizeProspectingInstagram(
            mapped.instagram,
          ),
        city: normalizeText(mapped.city),
        businessType: normalizeText(
          mapped.businessType,
        ),
        notes: normalizeText(mapped.notes),
      };

      const errors: string[] = [];

      if (rawWhatsapp && !whatsapp) {
        errors.push("WhatsApp inválido");
      }

      if (!hasIdentifiableData(row)) {
        errors.push(
          "Nenhuma informação identificável encontrada",
        );
      }

      return {
        row: index + 2,
        ...row,
        error: errors.length
          ? errors.join(" · ")
          : undefined,
      } satisfies ProspectingImportRow;
    })
    .filter((row) =>
      Boolean(
        row.name ||
          row.whatsapp ||
          row.instagram ||
          row.city ||
          row.businessType ||
          row.notes ||
          row.error,
      ),
    );
}

function rowsFromWorksheet(
  worksheet: XLSX.WorkSheet,
) {
  return XLSX.utils.sheet_to_json<unknown[]>(
    worksheet,
    {
      header: 1,
      defval: "",
      raw: false,
    },
  );
}

export async function parseProspectingCsv(
  file: File,
): Promise<ProspectingImportRow[]> {
  if (!file.name.toLowerCase().endsWith(".csv")) {
    throw new Error(
      "Selecione um arquivo no formato .csv.",
    );
  }

  const text = await file.text();

  const workbook = XLSX.read(text, {
    type: "string",
    raw: false,
  });

  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error(
      "O arquivo não possui dados para importar.",
    );
  }

  const worksheet =
    workbook.Sheets[firstSheetName];

  if (!worksheet) {
    throw new Error(
      "Não foi possível ler o arquivo CSV.",
    );
  }

  const parsed = parseRows(
    rowsFromWorksheet(worksheet),
  );

  if (!parsed.some((row) => !row.error)) {
    throw new Error(
      "Nenhum lead válido foi encontrado no arquivo.",
    );
  }

  return parsed;
}

export function parseProspectingPaste(
  value: string,
): ProspectingImportRow[] {
  const text = value.trim();

  if (!text) {
    throw new Error(
      "Cole os leads que deseja importar.",
    );
  }

  const workbook = XLSX.read(text, {
    type: "string",
    raw: false,
  });

  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error(
      "Não foi possível identificar os dados colados.",
    );
  }

  const worksheet =
    workbook.Sheets[firstSheetName];

  if (!worksheet) {
    throw new Error(
      "Não foi possível ler os dados colados.",
    );
  }

  const parsed = parseRows(
    rowsFromWorksheet(worksheet),
  );

  if (!parsed.some((row) => !row.error)) {
    throw new Error(
      "Nenhum lead válido foi encontrado nos dados colados.",
    );
  }

  return parsed;
}