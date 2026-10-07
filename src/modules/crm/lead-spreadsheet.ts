import type { Company, CompanyContact, CompanyNote, Opportunity, PipelineStage, Profile } from "./types";

export const leadSpreadsheetColumns = ["Nome", "WhatsApp", "Instagram", "Observação", "Origem", "Responsável"] as const;

export type LeadSpreadsheetRow = {
  row: number;
  name: string;
  whatsapp: string;
  instagram: string;
  note: string;
  source: string;
  ownerName: string;
};

export type LeadImportStatus = "new" | "duplicate" | "invalid_phone" | "missing_name" | "owner_not_found" | "duplicate_file";
export type LeadImportPreviewRow = LeadSpreadsheetRow & { status: LeadImportStatus; ownerId?: string };
export type LeadImportInput = Pick<LeadImportPreviewRow, "row" | "name" | "whatsapp" | "instagram" | "note" | "source" | "ownerId">;
export type LeadImportResult = { imported: number; duplicates: number; errors: number; results: Array<{ row: number; status: string; companyId?: string }> };

const normalizedText = (value: unknown) => String(value ?? "").trim();
const normalizedName = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");

export function normalizeBrazilianWhatsapp(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) digits = digits.slice(2);
  if (digits.length === 10 && /^[1-9]{2}[6-9]/.test(digits)) digits = `${digits.slice(0, 2)}9${digits.slice(2)}`;
  return digits.length === 11 && /^[1-9]{2}9\d{8}$/.test(digits) ? digits : undefined;
}

function parseCsvLine(line: string, separator: string) {
  const values: string[] = [];
  let value = "", quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && quoted && line[index + 1] === '"') { value += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === separator && !quoted) { values.push(value); value = ""; }
    else value += character;
  }
  values.push(value);
  return values;
}

function rowsFromMatrix(matrix: unknown[][]): LeadSpreadsheetRow[] {
  if (!matrix.length) return [];
  const headers = matrix[0].map(value => normalizedText(value).toLocaleLowerCase("pt-BR"));
  const aliases: Record<string, string[]> = {
    name: ["nome"], whatsapp: ["whatsapp", "telefone", "celular"], instagram: ["instagram"],
    note: ["observação", "observacao", "nota"], source: ["origem"], ownerName: ["responsável", "responsavel"],
  };
  const column = (key: keyof typeof aliases) => headers.findIndex(header => aliases[key].includes(header));
  const indexes = { name:column("name"), whatsapp:column("whatsapp"), instagram:column("instagram"), note:column("note"), source:column("source"), ownerName:column("ownerName") };
  if (indexes.name < 0 || indexes.whatsapp < 0) throw new Error("A planilha precisa conter as colunas Nome e WhatsApp.");
  return matrix.slice(1).map((values, index) => ({
    row:index + 2,
    name:normalizedText(values[indexes.name]), whatsapp:normalizedText(values[indexes.whatsapp]),
    instagram:indexes.instagram < 0 ? "" : normalizedText(values[indexes.instagram]),
    note:indexes.note < 0 ? "" : normalizedText(values[indexes.note]),
    source:indexes.source < 0 ? "" : normalizedText(values[indexes.source]),
    ownerName:indexes.ownerName < 0 ? "" : normalizedText(values[indexes.ownerName]),
  })).filter(row => Object.values(row).some(value => typeof value === "string" && value.length > 0));
}

export function parseCsv(text: string) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(line => line.trim());
  const separator = (lines[0]?.match(/;/g)?.length ?? 0) > (lines[0]?.match(/,/g)?.length ?? 0) ? ";" : ",";
  return rowsFromMatrix(lines.map(line => parseCsvLine(line, separator)));
}

async function unzipXlsx(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer), view = new DataView(buffer);
  let end = bytes.length - 22;
  while (end >= Math.max(0, bytes.length - 65_557) && view.getUint32(end, true) !== 0x06054b50) end -= 1;
  if (end < 0) throw new Error("Arquivo XLSX inválido.");
  const entries = new Map<string, string>();
  let cursor = view.getUint32(end + 16, true);
  const total = view.getUint16(end + 10, true);
  for (let entry = 0; entry < total; entry += 1) {
    if (view.getUint32(cursor, true) !== 0x02014b50) throw new Error("Arquivo XLSX inválido.");
    const method=view.getUint16(cursor+10,true),compressed=view.getUint32(cursor+20,true),nameLength=view.getUint16(cursor+28,true),extraLength=view.getUint16(cursor+30,true),commentLength=view.getUint16(cursor+32,true),localOffset=view.getUint32(cursor+42,true);
    const name = new TextDecoder().decode(bytes.slice(cursor + 46, cursor + 46 + nameLength));
    if (name.endsWith(".xml")) {
      const localNameLength=view.getUint16(localOffset+26,true),localExtraLength=view.getUint16(localOffset+28,true),start=localOffset+30+localNameLength+localExtraLength;
      const compressedBytes=bytes.slice(start,start+compressed);
      let content: Uint8Array;
      if(method===0) content=compressedBytes;
      else if(method===8){const stream=new Blob([compressedBytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));content=new Uint8Array(await new Response(stream).arrayBuffer());}
      else throw new Error("Compactação XLSX não suportada.");
      entries.set(name,new TextDecoder().decode(content));
    }
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

export async function parseXlsx(buffer: ArrayBuffer) {
  const files=await unzipXlsx(buffer),parser=new DOMParser();
  const shared=files.get("xl/sharedStrings.xml") ? [...parser.parseFromString(files.get("xl/sharedStrings.xml")!,"application/xml").querySelectorAll("si")].map(node=>node.textContent??"") : [];
  const sheet=[...files.entries()].find(([name])=>/^xl\/worksheets\/sheet\d+\.xml$/.test(name))?.[1];
  if(!sheet) throw new Error("A planilha XLSX não possui uma aba válida.");
  const matrix:unknown[][]=[];
  for(const row of parser.parseFromString(sheet,"application/xml").querySelectorAll("row")){
    const values:unknown[]=[];
    for(const cell of row.querySelectorAll("c")){
      const reference=cell.getAttribute("r")??"A1",letters=reference.match(/[A-Z]+/)?.[0]??"A";
      let index=0;for(const letter of letters)index=index*26+letter.charCodeAt(0)-64;index-=1;
      const raw=cell.querySelector("v")?.textContent??cell.querySelector("is")?.textContent??"";
      values[index]=cell.getAttribute("t")==="s"?shared[Number(raw)]??"":raw;
    }
    matrix.push(values);
  }
  return rowsFromMatrix(matrix);
}

export async function readLeadSpreadsheet(file: File) {
  const extension=file.name.split(".").pop()?.toLowerCase();
  if(extension==="csv") return parseCsv(await file.text());
  if(extension==="xlsx") return parseXlsx(await file.arrayBuffer());
  throw new Error("Selecione um arquivo .xlsx ou .csv.");
}

export function validateLeadRows(rows:LeadSpreadsheetRow[],contacts:CompanyContact[],profiles:Profile[]):LeadImportPreviewRow[]{
  const existing=new Set(contacts.flatMap(contact=>[contact.whatsapp,contact.phone].map(value=>normalizeBrazilianWhatsapp(value??"")).filter(Boolean) as string[]));
  const names=new Map<string,Profile[]>();for(const profile of profiles){const key=normalizedName(profile.name);names.set(key,[...(names.get(key)??[]),profile]);}
  const seen=new Set<string>();
  return rows.map(row=>{const whatsapp=normalizeBrazilianWhatsapp(row.whatsapp);let status:LeadImportStatus="new",ownerId:string|undefined;
    if(!row.name.trim())status="missing_name";else if(!whatsapp)status="invalid_phone";else if(existing.has(whatsapp))status="duplicate";else if(seen.has(whatsapp))status="duplicate_file";
    if(status==="new"&&row.ownerName){const matches=names.get(normalizedName(row.ownerName))??[];if(matches.length===1)ownerId=matches[0].id;else status="owner_not_found";}
    if(whatsapp)seen.add(whatsapp);return{...row,whatsapp:whatsapp??row.whatsapp,status,ownerId};});
}

const csvCell=(value:unknown)=>`"${String(value??"").replace(/"/g,'""')}"`;
const download=(content:BlobPart,name:string,type:string)=>{const url=URL.createObjectURL(new Blob([content],{type})),anchor=document.createElement("a");anchor.href=url;anchor.download=name;anchor.click();URL.revokeObjectURL(url);};
export function downloadLeadTemplate(){const examples=[["Maria Silva","75999999999","@mariasilva","Interessada em preenchimento","Prospecção","Elielson"],["Ana Souza","75988888888","@anasouza","Veio de indicação","Indicação","Andressa"]];download(`\uFEFF${[leadSpreadsheetColumns,...examples].map(row=>row.map(csvCell).join(";")).join("\n")}`,"modelo-importacao-leads.csv","text/csv;charset=utf-8");}

export function exportLeadsCsv(input:{companies:Company[];contacts:CompanyContact[];opportunities:Opportunity[];stages:PipelineStage[];notes:CompanyNote[]}){
  const headers=[...leadSpreadsheetColumns,"Etapa","Status","Data de criação"];
  const status:Record<string,string>={open:"Em aberto",won:"Fechado",lost:"Perdido",archived:"Arquivado"};
  const rows=input.companies.map(company=>{const contact=input.contacts.find(item=>item.companyId===company.id&&item.isPrimary&&!item.deletedAt)??input.contacts.find(item=>item.companyId===company.id&&!item.deletedAt),opportunity=input.opportunities.find(item=>item.companyId===company.id&&!item.deletedAt),stage=input.stages.find(item=>item.id===opportunity?.stageId),note=input.notes.find(item=>item.companyId===company.id);return[contact?.name??company.responsibleName??company.fantasyName,contact?.whatsapp??company.whatsapp??"",contact?.instagram??company.instagram??"",note?.text??company.notes??"",company.leadSource??opportunity?.source??"",company.owner??opportunity?.owner??"",stage?.name??"",opportunity?status[opportunity.status]??opportunity.status:"Sem oportunidade",new Intl.DateTimeFormat("pt-BR").format(new Date(company.createdAt))];});
  download(`\uFEFF${[headers,...rows].map(row=>row.map(csvCell).join(";")).join("\n")}`,`leads-${new Date().toISOString().slice(0,10)}.csv`,"text/csv;charset=utf-8");
}
