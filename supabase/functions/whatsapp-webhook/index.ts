import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN") ?? "";
const APP_SECRET = Deno.env.get("WHATSAPP_APP_SECRET") ?? "";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
);

const jsonHeaders = {
  "Content-Type": "application/json",
};

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: jsonHeaders,
    },
  );
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;

  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

async function verifyMetaSignature(
  body: string,
  signatureHeader: string | null,
) {
  if (!APP_SECRET || !signatureHeader) {
    return false;
  }

  if (!signatureHeader.startsWith("sha256=")) {
    return false;
  }

  const receivedSignature =
    signatureHeader.replace("sha256=", "");

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(APP_SECRET),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(body),
  );

  const expectedSignature =
    bytesToHex(new Uint8Array(signature));

  return safeEqual(
    receivedSignature,
    expectedSignature,
  );
}

Deno.serve(async (request) => {
  const url = new URL(request.url);

  // =====================================================
  // META WEBHOOK VERIFICATION
  // =====================================================

  if (request.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token =
      url.searchParams.get("hub.verify_token");
    const challenge =
      url.searchParams.get("hub.challenge");

    if (
      mode === "subscribe" &&
      token === VERIFY_TOKEN &&
      challenge
    ) {
      return new Response(
        challenge,
        {
          status: 200,
          headers: {
            "Content-Type": "text/plain",
          },
        },
      );
    }

    return jsonResponse(
      {
        error: "Webhook verification failed",
      },
      403,
    );
  }

  // =====================================================
  // WHATSAPP EVENTS
  // =====================================================

  if (request.method === "POST") {
    try {
      const rawBody = await request.text();

      const signature =
        request.headers.get("x-hub-signature-256");

      const signatureIsValid =
        await verifyMetaSignature(
          rawBody,
          signature,
        );

      if (!signatureIsValid) {
        console.error(
          "Invalid WhatsApp webhook signature",
        );

        return jsonResponse(
          {
            error: "Invalid signature",
          },
          401,
        );
      }

      const payload = JSON.parse(rawBody);

      console.log(
        "WhatsApp webhook payload:",
        JSON.stringify(payload),
      );

      const entries = payload?.entry ?? [];

      for (const entry of entries) {
        const changes = entry?.changes ?? [];

        for (const change of changes) {
          if (change?.field !== "messages") {
            continue;
          }

          const value = change?.value;

          const phoneNumberId =
            value?.metadata?.phone_number_id;

          if (!phoneNumberId) {
            console.log(
              "Webhook without phone_number_id",
            );

            continue;
          }

          // ===============================================
          // IDENTIFY TENANT / ORGANIZATION
          // ===============================================

          const {
            data: connection,
            error: connectionError,
          } = await supabase
            .from("whatsapp_connections")
            .select(
              "id, organization_id, phone_number_id",
            )
            .eq(
              "phone_number_id",
              phoneNumberId,
            )
            .eq("status", "active")
            .maybeSingle();

          if (connectionError) {
            console.error(
              "Error finding WhatsApp connection:",
              connectionError,
            );

            continue;
          }

          if (!connection) {
            console.log(
              `No WhatsApp connection found for phone_number_id ${phoneNumberId}`,
            );

            continue;
          }

          const messages = value?.messages ?? [];
          const contacts = value?.contacts ?? [];

          const contactMap = new Map<
            string,
            string
          >();

          for (const contact of contacts) {
            if (contact?.wa_id) {
              contactMap.set(
                contact.wa_id,
                contact?.profile?.name ??
                  contact.wa_id,
              );
            }
          }

          // ===============================================
          // PROCESS RECEIVED MESSAGES
          // ===============================================

          for (const message of messages) {
            const externalMessageId =
              message?.id;

            const waId = message?.from;

            if (
              !externalMessageId ||
              !waId
            ) {
              continue;
            }

            const contactName =
              contactMap.get(waId) ??
              waId;

            const messageType =
              message?.type ?? "unknown";

            let textBody: string | null =
              null;

            if (messageType === "text") {
              textBody =
                message?.text?.body ?? null;
            }

            const unixTimestamp =
              Number(message?.timestamp);

            const messageTimestamp =
              Number.isFinite(unixTimestamp)
                ? new Date(
                    unixTimestamp * 1000,
                  ).toISOString()
                : new Date().toISOString();

            // =============================================
            // FIND OR CREATE CONVERSATION
            // =============================================

            const {
              data: existingConversation,
              error: conversationLookupError,
            } = await supabase
              .from(
                "whatsapp_conversations",
              )
              .select("id")
              .eq(
                "organization_id",
                connection.organization_id,
              )
              .eq("wa_id", waId)
              .maybeSingle();

            if (conversationLookupError) {
              console.error(
                "Error finding conversation:",
                conversationLookupError,
              );

              continue;
            }

            let conversationId =
              existingConversation?.id;

            if (!conversationId) {
              const {
                data: newConversation,
                error:
                  conversationInsertError,
              } = await supabase
                .from(
                  "whatsapp_conversations",
                )
                .insert({
                  organization_id:
                    connection.organization_id,

                  connection_id:
                    connection.id,

                  wa_id: waId,

                  contact_name:
                    contactName,

                  status: "open",

                  last_message_at:
                    messageTimestamp,
                })
                .select("id")
                .single();

              if (
                conversationInsertError ||
                !newConversation
              ) {
                console.error(
                  "Error creating conversation:",
                  conversationInsertError,
                );

                continue;
              }

              conversationId =
                newConversation.id;
            } else {
              const {
                error:
                  conversationUpdateError,
              } = await supabase
                .from(
                  "whatsapp_conversations",
                )
                .update({
                  contact_name:
                    contactName,

                  last_message_at:
                    messageTimestamp,

                  status: "open",

                  updated_at:
                    new Date().toISOString(),
                })
                .eq(
                  "id",
                  conversationId,
                );

              if (
                conversationUpdateError
              ) {
                console.error(
                  "Error updating conversation:",
                  conversationUpdateError,
                );
              }
            }

            // =============================================
            // SAVE MESSAGE
            // =============================================

            const {
              error: messageInsertError,
            } = await supabase
              .from("whatsapp_messages")
              .upsert(
                {
                  organization_id:
                    connection.organization_id,

                  conversation_id:
                    conversationId,

                  external_message_id:
                    externalMessageId,

                  direction: "inbound",

                  message_type:
                    messageType,

                  text_body:
                    textBody,

                  message_timestamp:
                    messageTimestamp,

                  raw_payload:
                    message,
                },
                {
                  onConflict:
                    "external_message_id",

                  ignoreDuplicates:
                    true,
                },
              );

            if (messageInsertError) {
              console.error(
                "Error saving WhatsApp message:",
                messageInsertError,
              );

              continue;
            }

            console.log(
              `WhatsApp message saved: ${externalMessageId}`,
            );
          }
        }
      }

      return jsonResponse({
        received: true,
      });
    } catch (error) {
      console.error(
        "WhatsApp webhook processing error:",
        error,
      );

      // Meta deve receber erro quando realmente
      // não conseguimos processar o evento.
      return jsonResponse(
        {
          error:
            "Webhook processing failed",
        },
        500,
      );
    }
  }

  return jsonResponse(
    {
      error: "Method not allowed",
    },
    405,
  );
});