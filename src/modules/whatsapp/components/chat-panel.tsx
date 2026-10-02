import { useState } from "react";
import { ArrowLeft, Check, Info, LoaderCircle, RotateCcw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { WhatsAppConversation, WhatsAppMessage } from "../types";

const unsupported: Record<string, string> = {
  image: "Mensagem de imagem",
  audio: "Mensagem de áudio",
  document: "Mensagem de documento",
  video: "Mensagem de vídeo",
  sticker: "Mensagem de figurinha",
};

const body = (message: WhatsAppMessage) =>
  message.messageType === "text" && message.textBody
    ? message.textBody
    : unsupported[message.messageType] ?? "Tipo de mensagem não suportado";

type Props = {
  conversation?: WhatsAppConversation;
  messages: WhatsAppMessage[];
  loading: boolean;
  sending: boolean;
  canReply: boolean;
  onBack: () => void;
  onDetails: () => void;
  onSend: (text: string) => Promise<unknown>;
};

type PendingMessage = {
  text: string;
  status: "sending" | "sent" | "failed";
};

export function ChatPanel({
  conversation,
  messages,
  loading,
  sending,
  canReply,
  onBack,
  onDetails,
  onSend,
}: Props) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [pendingMessage, setPendingMessage] = useState<PendingMessage | null>(null);

  if (!conversation) {
    return (
      <section className="hidden min-h-0 place-items-center bg-background text-center text-muted-foreground md:grid">
        <div>
          <p className="font-semibold text-foreground">Selecione uma conversa</p>
          <p className="mt-2 text-sm">O histórico aparecerá aqui.</p>
        </div>
      </section>
    );
  }

  const sendText = async (text: string) => {
    setError("");
    setPendingMessage({ text, status: "sending" });

    try {
      await onSend(text);
      setDraft("");
      setPendingMessage({ text, status: "sent" });

      window.setTimeout(() => {
        setPendingMessage((current) =>
          current?.text === text && current.status === "sent" ? null : current,
        );
      }, 1200);
    } catch (reason) {
      const message =
        reason instanceof Error
          ? reason.message
          : "Não foi possível enviar a mensagem.";

      setError(message);
      setPendingMessage({ text, status: "failed" });
    }
  };

  const submit = async () => {
    const text = draft.trim();
    if (!text || sending || !canReply) return;
    await sendText(text);
  };

  const retry = async () => {
    if (!pendingMessage || pendingMessage.status !== "failed" || sending || !canReply) {
      return;
    }

    await sendText(pendingMessage.text);
  };

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <header className="flex min-h-16 items-center gap-3 border-b bg-card px-3 md:px-5">
        <button
          onClick={onBack}
          className="premium-focus grid h-11 w-11 place-items-center rounded-xl md:hidden"
          aria-label="Voltar para conversas"
        >
          <ArrowLeft />
        </button>

        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold">
            {conversation.contactName || conversation.waId}
          </h2>
          <p className="truncate text-xs text-muted-foreground">
            {conversation.waId} ·{" "}
            {conversation.status === "open" ? "Conversa aberta" : "Conversa fechada"}
            {conversation.assignedUserName ? ` · ${conversation.assignedUserName}` : ""}
          </p>
        </div>

        <button
          onClick={onDetails}
          className="premium-focus grid h-11 w-11 place-items-center rounded-xl hover:bg-muted xl:hidden"
          aria-label="Ver informações do CRM"
        >
          <Info size={20} />
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 md:p-6" aria-live="polite">
        {loading ? (
          <p className="text-center text-sm text-muted-foreground">Carregando mensagens…</p>
        ) : messages.length === 0 && !pendingMessage ? (
          <p className="text-center text-sm text-muted-foreground">Nenhuma mensagem nesta conversa.</p>
        ) : (
          <>
            {messages.map((message) => (
              <article
                key={message.id}
                className={`flex ${message.direction === "outbound" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm md:max-w-[70%] ${
                    message.direction === "outbound"
                      ? "rounded-br-md bg-primary text-primary-foreground"
                      : "rounded-bl-md border bg-card"
                  }`}
                >
                  <p
                    className={`whitespace-pre-wrap break-words text-sm ${
                      message.messageType !== "text" ? "italic opacity-75" : ""
                    }`}
                  >
                    {body(message)}
                  </p>
                  <div className="mt-1 flex justify-end gap-2 text-[10px] opacity-60">
                    <span>{message.messageType}</span>
                    <time>
                      {new Date(message.messageTimestamp || message.createdAt).toLocaleTimeString(
                        "pt-BR",
                        { hour: "2-digit", minute: "2-digit" },
                      )}
                    </time>
                  </div>
                </div>
              </article>
            ))}

            {pendingMessage && (
              <article className="flex justify-end">
                <div
                  className={`max-w-[85%] rounded-2xl rounded-br-md px-4 py-3 shadow-sm md:max-w-[70%] ${
                    pendingMessage.status === "failed"
                      ? "border border-destructive/40 bg-destructive/5 text-foreground"
                      : "bg-primary text-primary-foreground"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words text-sm">
                    {pendingMessage.text}
                  </p>

                  <div className="mt-1 flex items-center justify-end gap-1.5 text-[10px] opacity-70">
                    {pendingMessage.status === "sending" && (
                      <>
                        <LoaderCircle size={11} className="animate-spin" />
                        <span>Enviando…</span>
                      </>
                    )}

                    {pendingMessage.status === "sent" && (
                      <>
                        <Check size={11} />
                        <span>Enviada</span>
                      </>
                    )}

                    {pendingMessage.status === "failed" && (
                      <>
                        <span>Falhou</span>
                        <button
                          type="button"
                          onClick={() => void retry()}
                          disabled={sending}
                          className="ml-1 inline-flex items-center gap-1 font-medium underline underline-offset-2 disabled:opacity-50"
                        >
                          <RotateCcw size={11} />
                          Tentar novamente
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </article>
            )}
          </>
        )}
      </div>

      <footer className="border-t bg-card p-3 pb-[max(.75rem,env(safe-area-inset-bottom))] md:p-4">
        <div className="flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                void submit();
              }
            }}
            disabled={!canReply || sending}
            maxLength={4096}
            aria-label="Responder mensagem"
            placeholder={
              canReply
                ? "Digite uma mensagem"
                : "Seu perfil não possui permissão para responder."
            }
            className="max-h-36 min-h-12 resize-none"
          />

          <Button
            onClick={() => void submit()}
            disabled={!canReply || sending || !draft.trim()}
            aria-label={sending ? "Enviando mensagem" : "Enviar mensagem"}
          >
            {sending ? (
              <LoaderCircle className="animate-spin" size={18} />
            ) : (
              <Send size={18} />
            )}
            <span className="sr-only">{sending ? "Enviando" : "Enviar"}</span>
          </Button>
        </div>

        {error && (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <p className="mt-2 text-xs text-muted-foreground">
          Enter envia · Shift+Enter quebra a linha. Mensagens livres dependem da janela de atendimento do WhatsApp.
        </p>
      </footer>
    </section>
  );
}
