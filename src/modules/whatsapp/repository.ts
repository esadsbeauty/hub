import { isLocalMode } from "@/config/app-mode";
import { supabase } from "@/lib/supabase";
import type {
  WhatsAppConnection,
  WhatsAppConversation,
  WhatsAppInboxData,
  WhatsAppMessage,
} from "./types";

type Row = Record<string, unknown>;

const text = (value: unknown) =>
  value == null ? undefined : String(value);

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

const mapConversation = (
  row: Row,
  lastMessage?: WhatsAppMessage,
): WhatsAppConversation => ({
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
  lastMessage,
});

const configured = () => {
  if (!supabase) {
    throw new Error(
      "Não foi possível conectar à Inbox do WhatsApp.",
    );
  }

  return supabase;
};

export const whatsappRepository = {
  async inbox(
    organizationId: string,
  ): Promise<WhatsAppInboxData> {
    if (isLocalMode) {
      return { conversations: [] };
    }

    const client = configured();

    const connectionResult = await client
      .from("whatsapp_connections")
      .select(
        "id,organization_id,display_phone_number,status",
      )
      .eq("organization_id", organizationId)
      .in("status", ["active", "connected"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (connectionResult.error) {
      throw new Error(
        "Não foi possível carregar a conexão do WhatsApp.",
      );
    }

    if (!connectionResult.data) {
      return { conversations: [] };
    }

    const connection: WhatsAppConnection = {
      id: String(connectionResult.data.id),
      organizationId: String(
        connectionResult.data.organization_id,
      ),
      displayPhoneNumber: String(
        connectionResult.data.display_phone_number,
      ),
      status: String(connectionResult.data.status),
    };

    const conversationResult = await client
      .from("whatsapp_conversations")
      .select(
        [
          "id",
          "organization_id",
          "connection_id",
          "company_id",
          "contact_id",
          "opportunity_id",
          "wa_id",
          "contact_name",
          "status",
          "assigned_user_id",
          "last_message_at",
          "created_at",
          "updated_at",
        ].join(","),
      )
      .eq("organization_id", organizationId)
      .eq("connection_id", connection.id)
      .order("last_message_at", {
        ascending: false,
        nullsFirst: false,
      });

    if (conversationResult.error) {
      throw new Error(
        "Não foi possível carregar as conversas.",
      );
    }

    const rows = (conversationResult.data ?? []) as unknown as Row[];

    if (rows.length === 0) {
      return {
        connection,
        conversations: [],
      };
    }

    const conversationIds = rows.map((row) =>
      String(row.id),
    );

    const idsFor = (key: string) => [
      ...new Set(
        rows
          .map((row) => text(row[key]))
          .filter(Boolean) as string[],
      ),
    ];

    const fetchNames = async (
      table:
        | "companies"
        | "contacts"
        | "opportunities"
        | "profiles",
      ids: string[],
      column: "name" | "title",
    ) => {
      const values = new Map<string, string>();

      if (ids.length === 0) {
        return values;
      }

      const result = await client
        .from(table)
        .select(`id,${column}`)
        .eq("organization_id", organizationId)
        .in("id", ids);

      if (result.error) {
        console.warn(
          `[WhatsApp Inbox] Não foi possível carregar ${table}.`,
          result.error,
        );

        return values;
      }

      for (const row of (result.data ?? []) as unknown as Row[]) {
        const value = row[column];

        if (value != null) {
          values.set(
            String(row.id),
            String(value),
          );
        }
      }

      return values;
    };

    /*
     * Carrega mensagens recentes e dados auxiliares em paralelo.
     * Antes essas consultas aconteciam em duas etapas sequenciais.
     */
    const [
      messageResult,
      companies,
      contacts,
      opportunities,
      assignees,
    ] = await Promise.all([
      client
        .from("whatsapp_messages")
        .select(
          [
            "id",
            "organization_id",
            "conversation_id",
            "external_message_id",
            "direction",
            "message_type",
            "text_body",
            "message_timestamp",
            "created_at",
          ].join(","),
        )
        .eq("organization_id", organizationId)
        .in("conversation_id", conversationIds)
        .order("created_at", {
          ascending: false,
        })
        .limit(
          Math.min(
            Math.max(
              conversationIds.length * 6,
              100,
            ),
            600,
          ),
        ),

      fetchNames(
        "companies",
        idsFor("company_id"),
        "name",
      ),

      fetchNames(
        "contacts",
        idsFor("contact_id"),
        "name",
      ),

      fetchNames(
        "opportunities",
        idsFor("opportunity_id"),
        "title",
      ),

      fetchNames(
        "profiles",
        idsFor("assigned_user_id"),
        "name",
      ),
    ]);

    if (messageResult.error) {
      throw new Error(
        "Não foi possível carregar as mensagens recentes.",
      );
    }

    const latestMessages =
      new Map<string, WhatsAppMessage>();

    for (const row of messageResult.data ?? []) {
      const message = mapMessage(row as unknown as Row);

      const current = latestMessages.get(
        message.conversationId,
      );

      const messageAt = new Date(
        message.messageTimestamp ??
          message.createdAt,
      ).getTime();

      const currentAt = current
        ? new Date(
            current.messageTimestamp ??
              current.createdAt,
          ).getTime()
        : 0;

      if (!current || messageAt > currentAt) {
        latestMessages.set(
          message.conversationId,
          message,
        );
      }
    }

    return {
      connection,
      conversations: rows.map((row) => {
        const mapped = mapConversation(
          row,
          latestMessages.get(String(row.id)),
        );

        return {
          ...mapped,

          companyName: mapped.companyId
            ? companies.get(mapped.companyId)
            : undefined,

          contactDisplayName: mapped.contactId
            ? contacts.get(mapped.contactId)
            : undefined,

          opportunityTitle: mapped.opportunityId
            ? opportunities.get(
                mapped.opportunityId,
              )
            : undefined,

          assignedUserName: mapped.assignedUserId
            ? assignees.get(
                mapped.assignedUserId,
              )
            : undefined,
        };
      }),
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
        [
          "id",
          "organization_id",
          "conversation_id",
          "external_message_id",
          "direction",
          "message_type",
          "text_body",
          "message_timestamp",
          "created_at",
        ].join(","),
      )
      .eq("organization_id", organizationId)
      .eq("conversation_id", conversationId)
      .order("message_timestamp", {
        ascending: true,
        nullsFirst: true,
      })
      .order("created_at", {
        ascending: true,
      });

    if (result.error) {
      throw new Error(
        "Não foi possível carregar o histórico desta conversa.",
      );
    }

    return (result.data ?? [])
      .map((row) =>
        mapMessage(row as unknown as Row),
      )
      .sort(
        (a, b) =>
          new Date(
            a.messageTimestamp ??
              a.createdAt,
          ).getTime() -
          new Date(
            b.messageTimestamp ??
              b.createdAt,
          ).getTime(),
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
      payload.company_id =
        input.companyId || null;
    }

    if (input.contactId !== undefined) {
      payload.contact_id =
        input.contactId || null;
    }

    if (
      input.opportunityId !== undefined
    ) {
      payload.opportunity_id =
        input.opportunityId || null;
    }

    if (
      Object.keys(payload).length === 0
    ) {
      return;
    }

    const result = await configured()
      .from("whatsapp_conversations")
      .update(payload)
      .eq("id", input.conversationId)
      .eq(
        "organization_id",
        input.organizationId,
      );

    if (result.error) {
      console.error(
        "[WhatsApp CRM link]",
        result.error,
      );

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
      throw new Error(
        "O envio real exige conexão com o Supabase.",
      );
    }

    const result =
      await configured().functions.invoke(
        "whatsapp-send-message",
        {
          body: input,
        },
      );

    if (result.error) {
      let message =
        "Não foi possível enviar a mensagem pelo WhatsApp.";

      const context =
        result.error.context as unknown;

      if (
        context &&
        typeof context === "object"
      ) {
        const candidate = context as {
          json?: () => Promise<unknown>;
          message?: unknown;
        };

        if (
          typeof candidate.json ===
          "function"
        ) {
          try {
            const payload =
              (await candidate.json()) as {
                message?: unknown;
              };

            if (
              typeof payload?.message ===
                "string" &&
              payload.message.trim()
            ) {
              message =
                payload.message;
            }
          } catch {
            // Mantém a mensagem padrão.
          }
        } else if (
          typeof candidate.message ===
            "string" &&
          candidate.message.trim()
        ) {
          message =
            candidate.message;
        }
      }

      if (
        result.error.message &&
        result.error.message !==
          "Edge Function returned a non-2xx status code"
      ) {
        message =
          result.error.message;
      }

      throw new Error(message);
    }

    return result.data as {
      messageId?: string;
      externalMessageId: string;
    };
  },
};
