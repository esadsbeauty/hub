import { supabase } from "@/lib/supabase";
import type { ProspectingImportRow } from "./prospecting-import";

export type ProspectingList = {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  sourceType: "csv" | "paste";
  totalLeads: number;
  createdAt: string;
  updatedAt: string;
};

export type ProspectingLeadStatus =
  | "new"
  | "message_sent"
  | "replied"
  | "in_conversation"
  | "opportunity"
  | "not_interested";

export type ProspectingLead = {
  id: string;
  organizationId: string;
  listId: string;
  name: string;
  whatsapp: string;
  instagram: string;
  city: string;
  businessType: string;
  notes: string;

  generatedMessage: string;
  messageEdited: boolean;
  messageGeneratedAt: string | null;
  messageOpenedAt: string | null;

  status: ProspectingLeadStatus;

  createdAt: string;
  updatedAt: string;
};

type CreateListInput = {
  organizationId: string;
  name: string;
  description?: string;
  sourceType: "csv" | "paste";
  rows: ProspectingImportRow[];
};

function client() {
  if (!supabase) {
    throw new Error("Supabase não configurado.");
  }

  return supabase;
}

export async function listProspectingLists(
  organizationId: string,
): Promise<ProspectingList[]> {
  const api = client();

  const { data, error } = await api
    .from("prospecting_lists")
    .select(
      "id, organization_id, name, description, source_type, total_leads, created_at, updated_at",
    )
    .eq("organization_id", organizationId)
    .order("created_at", {
      ascending: false,
    });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    description: row.description,
    sourceType: row.source_type as
      | "csv"
      | "paste",
    totalLeads: row.total_leads,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function listProspectingLeads(
  organizationId: string,
  listId: string,
): Promise<ProspectingLead[]> {
  const api = client();

  const { data, error } = await api
    .from("prospecting_leads")
    .select(
      `
        id,
        organization_id,
        list_id,
        name,
        whatsapp,
        instagram,
        city,
        business_type,
        notes,
        generated_message,
        message_edited,
        message_generated_at,
        message_opened_at,
        status,
        created_at,
        updated_at
      `,
    )
    .eq("organization_id", organizationId)
    .eq("list_id", listId)
    .order("created_at", {
      ascending: true,
    });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    organizationId: row.organization_id,
    listId: row.list_id,

    name: row.name ?? "",
    whatsapp: row.whatsapp ?? "",
    instagram: row.instagram ?? "",
    city: row.city ?? "",
    businessType:
      row.business_type ?? "",
    notes: row.notes ?? "",

    generatedMessage:
      row.generated_message ?? "",

    messageEdited:
      row.message_edited ?? false,

    messageGeneratedAt:
      row.message_generated_at ?? null,

    messageOpenedAt:
      row.message_opened_at ?? null,

    status:
      row.status as ProspectingLeadStatus,

    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function createProspectingList(
  input: CreateListInput,
): Promise<string> {
  const api = client();

  const validRows = input.rows.filter(
    (row) => !row.error,
  );

  if (!validRows.length) {
    throw new Error(
      "Nenhum lead válido para salvar.",
    );
  }

  const {
    data: authData,
    error: authError,
  } = await api.auth.getUser();

  if (authError) throw authError;

  const user = authData.user;

  if (!user) {
    throw new Error(
      "Sessão expirada. Entre novamente.",
    );
  }

  const {
    data: list,
    error: listError,
  } = await api
    .from("prospecting_lists")
    .insert({
      organization_id:
        input.organizationId,

      name:
        input.name.trim(),

      description:
        input.description?.trim() ||
        null,

      source_type:
        input.sourceType,

      total_leads:
        validRows.length,

      created_by:
        user.id,
    })
    .select("id")
    .single();

  if (listError) throw listError;

  const listId = list.id;

  const leads = validRows.map(
    (row) => ({
      organization_id:
        input.organizationId,

      list_id:
        listId,

      name:
        row.name || null,

      whatsapp:
        row.whatsapp || null,

      instagram:
        row.instagram || null,

      city:
        row.city || null,

      business_type:
        row.businessType || null,

      notes:
        row.notes || null,

      status:
        "new",

      created_by:
        user.id,
    }),
  );

  const { error: leadsError } =
    await api
      .from("prospecting_leads")
      .insert(leads);

  if (leadsError) {
    await api
      .from("prospecting_lists")
      .delete()
      .eq("id", listId)
      .eq(
        "organization_id",
        input.organizationId,
      );

    throw leadsError;
  }

  return listId;
}

export async function generateProspectingMessage(
  organizationId: string,
  leadId: string,
): Promise<string> {
  const api = client();

  const { data, error } =
    await api.functions.invoke(
      "prospecting-generate-message",
      {
        body: {
          organization_id:
            organizationId,

          lead_id:
            leadId,
        },
      },
    );

  if (error) {
    console.error(
      "[PROSPECTING GENERATE]",
      error,
    );

    throw new Error(
      "Não foi possível gerar a mensagem.",
    );
  }

  const message =
    typeof data?.message === "string"
      ? data.message.trim()
      : "";

  if (!message) {
    throw new Error(
      "A IA não retornou uma mensagem válida.",
    );
  }

  return message;
}

export async function updateProspectingMessage(
  organizationId: string,
  leadId: string,
  message: string,
): Promise<void> {
  const api = client();

  const cleanMessage =
    message.trim();

  if (!cleanMessage) {
    throw new Error(
      "A mensagem não pode ficar vazia.",
    );
  }

  const { error } = await api
    .from("prospecting_leads")
    .update({
      generated_message:
        cleanMessage,

      message_edited:
        true,

      updated_at:
        new Date().toISOString(),
    })
    .eq("id", leadId)
    .eq(
      "organization_id",
      organizationId,
    );

  if (error) {
    throw error;
  }
}

function normalizeWhatsappForLink(
  whatsapp: string,
) {
  let digits =
    whatsapp.replace(/\D/g, "");

  if (!digits) {
    throw new Error(
      "Este lead não possui WhatsApp.",
    );
  }

  if (
    digits.startsWith("55") &&
    (digits.length === 12 ||
      digits.length === 13)
  ) {
    return digits;
  }

  if (
    digits.startsWith("0") &&
    (digits.length === 11 ||
      digits.length === 12)
  ) {
    digits = digits.slice(1);
  }

  if (
    digits.length !== 10 &&
    digits.length !== 11
  ) {
    throw new Error(
      "O WhatsApp deste lead é inválido.",
    );
  }

  return `55${digits}`;
}

export function buildProspectingWhatsappUrl(
  whatsapp: string,
  message: string,
) {
  const phone =
    normalizeWhatsappForLink(
      whatsapp,
    );

  const cleanMessage =
    message.trim();

  if (!cleanMessage) {
    throw new Error(
      "Gere ou escreva uma mensagem antes de abrir o WhatsApp.",
    );
  }

  return `https://wa.me/${phone}?text=${encodeURIComponent(
    cleanMessage,
  )}`;
}

export async function markProspectingMessageOpened(
  organizationId: string,
  leadId: string,
): Promise<void> {
  const api = client();

  const {
    data: lead,
    error: readError,
  } = await api
    .from("prospecting_leads")
    .select("status")
    .eq("id", leadId)
    .eq(
      "organization_id",
      organizationId,
    )
    .maybeSingle();

  if (readError) {
    throw readError;
  }

  if (!lead) {
    throw new Error(
      "Lead não encontrado.",
    );
  }

  const now =
    new Date().toISOString();

  const currentStatus =
    lead.status as ProspectingLeadStatus;

  const nextStatus:
    ProspectingLeadStatus =
    currentStatus === "new"
      ? "message_sent"
      : currentStatus;

  const { error: updateError } =
    await api
      .from("prospecting_leads")
      .update({
        message_opened_at:
          now,

        status:
          nextStatus,

        updated_at:
          now,
      })
      .eq("id", leadId)
      .eq(
        "organization_id",
        organizationId,
      );

  if (updateError) {
    throw updateError;
  }
}