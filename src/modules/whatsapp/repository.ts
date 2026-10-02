import { isLocalMode } from "@/config/app-mode";
import { supabase } from "@/lib/supabase";
import type {
  WhatsAppConnection,
  WhatsAppConversation,
  WhatsAppInboxData,
  WhatsAppMessage,
} from "./types";

type Row = Record<string, unknown>;

type InboxSnapshot = {
  connection?: Row | null;
  conversations?: Row[] | null;
  total?: number | null;
  limit?: number | null;
  offset?: number | null;
  has_more?: boolean | null;
};

export type WhatsAppInboxPageData = WhatsAppInboxData & {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

const text = (value: unknown) =>
  value === null || value === undefined ? undefined : String(value);

const mapMessage = (row: Row): WhatsAppMessage => ({
  id: String(row.id),
  organizationId: String(row.organization_id),
  conversationId: String(row.conversation_id),
  externalMessageId: String(row.external_message_id),
  direction: row.direction as "inbound" | "outbound",
  messageType: String(row.message_type),
  textBody: text(row.text_body),
  messageTimestamp: text(row.message_timestamp),
  createdAt: String(row.created_at),
});

const mapSnapshotConversation = (row: Row): WhatsAppConversation => {
  const lastMessageRow =
    row.last_message && typeof row.last_message === "object"
      ? (row.last_message as Row)
      : null;

  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    connectionId: String(row.connection_id),
    companyId: text(row.company_id),
    contactId: text(row.contact_id),
    opportunityId: text(row.opportunity_id),
    waId: String(row.wa_id),
    contactName: text(row.contact_name),
    status: String(row.status),
    assignedUserId: text(row.assigned_user_id),
    lastMessageAt: text(row.last_message_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    companyName: text(row.company_name),
    contactDisplayName: text(row.contact_display_name),
    opportunityTitle: text(row.opportunity_title),
    assignedUserName: text(row.assigned_user_name),
    lastMessage: lastMessageRow ? mapMessage(lastMessageRow) : undefined,
  };
};

const configured = () => {
  if (!supabase) {
    throw new Error("Não foi possível conectar à Inbox do WhatsApp.");
  }

  return supabase;
};

export const whatsappRepository = {
  async inbox(
    organizationId: string,
    limit = 25,
    offset = 0,
  ): Promise<WhatsAppInboxPageData> {
    if (isLocalMode) {
      return {
        conversations: [],
        total: 0,
        limit,
        offset,
        hasMore: false,
      };
    }

    const client = configured();

    const rpc = client.rpc.bind(client) as unknown as (
      functionName: string,
      args: Record<string, unknown>,
    ) => Promise<{
      data: unknown;
      error: {
        message?: string;
      } | null;
    }>;

    const { data, error } = await rpc(
      "whatsapp_inbox_snapshot",
      {
        p_organization_id: organizationId,
        p_limit: limit,
        p_offset: offset,
      },
    );

    if (error) {
      console.error("[WhatsApp Inbox RPC]", error);

      throw new Error(
        error.message || "Não foi possível carregar a Inbox do WhatsApp.",
      );
    }

    const snapshot = (data ?? {}) as unknown as InboxSnapshot;

    const connectionRow =
      snapshot.connection && typeof snapshot.connection === "object"
        ? snapshot.connection
        : null;

    const connection: WhatsAppConnection | undefined = connectionRow
      ? {
          id: String(connectionRow.id),
          organizationId: String(connectionRow.organization_id),
          displayPhoneNumber: String(
            connectionRow.display_phone_number ?? "",
          ),
          status: String(connectionRow.status),
        }
      : undefined;

    const conversationRows = Array.isArray(snapshot.conversations)
      ? snapshot.conversations
      : [];

    return {
      connection,
      conversations: conversationRows.map((row) =>
        mapSnapshotConversation(row as Row),
      ),
      total: Number(snapshot.total ?? conversationRows.length),
      limit: Number(snapshot.limit ?? limit),
      offset: Number(snapshot.offset ?? offset),
      hasMore: Boolean(snapshot.has_more),
    };
  },

  async messages(
    organizationId: string,
    conversationId: string,
  ): Promise<WhatsAppMessage[]> {
    if (isLocalMode) {
      return [];
    }

    const result = await configured()
      .from("whatsapp_messages")
      .select(
        "id,organization_id,conversation_id,external_message_id,direction,message_type,text_body,message_timestamp,created_at",
      )
      .eq("organization_id", organizationId)
      .eq("conversation_id", conversationId)
      .order("message_timestamp", {
        ascending: true,
        nullsFirst: true,
      })
      .order("created_at", { ascending: true });

    if (result.error) {
      throw new Error(
        "Não foi possível carregar o histórico desta conversa.",
      );
    }

    return (result.data ?? [])
      .map((row) => mapMessage(row as unknown as Row))
      .sort(
        (a, b) =>
          new Date(a.messageTimestamp || a.createdAt).getTime() -
          new Date(b.messageTimestamp || b.createdAt).getTime(),
      );
  },

  async linkCrmContext(input: {
    organizationId: string;
    conversationId: string;
    companyId?: string;
    contactId?: string;
    opportunityId?: string;
  }): Promise<void> {
    if (isLocalMode) {
      return;
    }

    const payload: {
      company_id?: string | null;
      contact_id?: string | null;
      opportunity_id?: string | null;
    } = {};

    if (input.companyId !== undefined) {
      payload.company_id = input.companyId || null;
    }

    if (input.contactId !== undefined) {
      payload.contact_id = input.contactId || null;
    }

    if (input.opportunityId !== undefined) {
      payload.opportunity_id = input.opportunityId || null;
    }

    if (!Object.keys(payload).length) {
      return;
    }

    const result = await configured()
      .from("whatsapp_conversations")
      .update(payload)
      .eq("id", input.conversationId)
      .eq("organization_id", input.organizationId);

    if (result.error) {
      console.error("[WhatsApp CRM link]", result.error);

      throw new Error(
        "Não foi possível vincular esta conversa ao CRM.",
      );
    }
  },

  async sendMessage(input: {
    organizationId: string;
    conversationId: string;
    text: string;
  }): Promise<{
    messageId?: string;
    externalMessageId: string;
  }> {
    if (isLocalMode) {
      throw new Error("O envio real exige conexão com o Supabase.");
    }

    const result = await configured().functions.invoke(
      "whatsapp-send-message",
      {
        body: input,
      },
    );

    if (result.error) {
      let message = "Não foi possível enviar a mensagem pelo WhatsApp.";

      const context = result.error.context as unknown;

      if (context && typeof context === "object") {
        const candidate = context as {
          json?: () => Promise<unknown>;
          message?: unknown;
        };

        if (typeof candidate.json === "function") {
          try {
            const payload = (await candidate.json()) as {
              message?: unknown;
            };

            if (
              typeof payload?.message === "string" &&
              payload.message.trim()
            ) {
              message = payload.message;
            }
          } catch {
            // Mantém a mensagem padrão.
          }
        } else if (
          typeof candidate.message === "string" &&
          candidate.message.trim()
        ) {
          message = candidate.message;
        }
      }

      if (
        result.error.message &&
        result.error.message !==
          "Edge Function returned a non-2xx status code"
      ) {
        message = result.error.message;
      }

      throw new Error(message);
    }

    return result.data as {
      messageId?: string;
      externalMessageId: string;
    };
  },
};
