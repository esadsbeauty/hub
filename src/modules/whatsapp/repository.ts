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
  mediaId: text(row.media_id),
  mediaPath: text(row.media_path),
  mediaMimeType: text(row.media_mime_type),
  mediaFileName: text(row.media_file_name),
  mediaSizeBytes:
    row.media_size_bytes === null || row.media_size_bytes === undefined
      ? undefined
      : Number(row.media_size_bytes),
  mediaTranscript: text(row.media_transcript),
  mediaTranscriptionStatus: text(row.media_transcription_status),
  deliveryStatus: text(row.delivery_status),
  deliveredAt: text(row.delivered_at),
  readAt: text(row.read_at),
  failedAt: text(row.failed_at),
  replyToExternalMessageId: text(row.reply_to_external_message_id),
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
        "id,organization_id,conversation_id,external_message_id,direction,message_type,text_body,message_timestamp,media_id,media_path,media_mime_type,media_file_name,media_size_bytes,media_transcript,media_transcription_status,delivery_status,delivered_at,read_at,failed_at,reply_to_external_message_id,created_at",
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

    const messages = (result.data ?? [])
      .map((row) => mapMessage(row as unknown as Row))
      .sort(
        (a, b) =>
          new Date(a.messageTimestamp || a.createdAt).getTime() -
          new Date(b.messageTimestamp || b.createdAt).getTime(),
      );

    const mediaPaths = [
      ...new Set(
        messages
          .map((message) => message.mediaPath)
          .filter((path): path is string => Boolean(path)),
      ),
    ];

    if (!mediaPaths.length) {
      return messages;
    }

    const signed = await configured()
      .storage
      .from("whatsapp-media")
      .createSignedUrls(mediaPaths, 60 * 60);

    if (signed.error) {
      console.error("[WhatsApp media signed URLs]", signed.error);
      return messages;
    }

    const signedByPath = new Map<string, string>();

    for (const item of signed.data ?? []) {
      if (item.path && item.signedUrl) {
        signedByPath.set(item.path, item.signedUrl);
      }
    }

    return messages.map((message) => ({
      ...message,
      mediaUrl:
        message.mediaPath
          ? signedByPath.get(message.mediaPath)
          : undefined,
    }));
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

  async sendMedia(input: {
    organizationId: string;
    conversationId: string;
    file: File;
    replyToExternalMessageId?: string;
  }): Promise<{
    messageId?: string;
    externalMessageId: string;
  }> {
    if (isLocalMode) {
      throw new Error("O envio real exige conexão com o Supabase.");
    }

    if (input.file.size > 25 * 1024 * 1024) {
      throw new Error("O arquivo deve ter no máximo 25 MB.");
    }

    const safeName =
      input.file.name
        .normalize("NFKD")
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .slice(0, 120) || "arquivo";

    const mediaPath = [
      input.organizationId,
      input.conversationId,
      "outgoing",
      `${crypto.randomUUID()}-${safeName}`,
    ].join("/");

    const client = configured();

    const uploaded = await client.storage
      .from("whatsapp-media")
      .upload(mediaPath, input.file, {
        contentType:
          input.file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploaded.error) {
      throw new Error(
        uploaded.error.message ||
        "Não foi possível preparar o arquivo para envio.",
      );
    }

    try {
      const result = await client.functions.invoke(
        "whatsapp-send-message",
        {
          body: {
            organizationId: input.organizationId,
            conversationId: input.conversationId,
            mediaPath,
            mediaMimeType:
              input.file.type || "application/octet-stream",
            mediaFileName: input.file.name || safeName,
            replyToExternalMessageId:
              input.replyToExternalMessageId,
          },
        },
      );

      if (result.error) {
        let message =
          "Não foi possível enviar o arquivo pelo WhatsApp.";

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
          }
        }

        throw new Error(message);
      }

      return result.data as {
        messageId?: string;
        externalMessageId: string;
      };
    } catch (error) {
      await client.storage
        .from("whatsapp-media")
        .remove([mediaPath]);

      throw error;
    }
  },

  async sendMessage(input: {
    organizationId: string;
    conversationId: string;
    text: string;
    replyToExternalMessageId?: string;
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
