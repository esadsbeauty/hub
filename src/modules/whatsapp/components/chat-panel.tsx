import { useRef, useState } from "react";
import { ArrowLeft, Check, CheckCheck, FileText, Info, LoaderCircle, Mic, Paperclip, Reply, RotateCcw, Send, Square, X } from "lucide-react";
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

function MessageContent({
  message,
}: {
  message: WhatsAppMessage;
}) {
  if (
    message.messageType === "audio" &&
    message.mediaUrl
  ) {
    return (
      <div className="min-w-[230px]">
        <audio
          controls
          preload="metadata"
          src={message.mediaUrl}
          className="h-10 w-full max-w-[320px]"
        >
          Seu navegador não suporta reprodução de áudio.
        </audio>

        {message.mediaTranscript && (
          <details className="mt-2 max-w-[320px] text-xs">
            <summary className="cursor-pointer font-medium opacity-80">
              Ver transcrição
            </summary>
            <p className="mt-1 whitespace-pre-wrap break-words opacity-80">
              {message.mediaTranscript}
            </p>
          </details>
        )}

        {!message.mediaTranscript &&
          message.mediaTranscriptionStatus === "processing" && (
            <p className="mt-2 text-xs opacity-60">
              Transcrevendo áudio…
            </p>
          )}
      </div>
    );
  }

  if (
    message.messageType === "sticker" &&
    message.mediaUrl
  ) {
    return (
      <img
        src={message.mediaUrl}
        alt="Figurinha do WhatsApp"
        loading="lazy"
        className="max-h-48 max-w-48 object-contain"
      />
    );
  }

  if (
    message.messageType === "image" &&
    message.mediaUrl
  ) {
    return (
      <a
        href={message.mediaUrl}
        target="_blank"
        rel="noreferrer"
        className="block"
        aria-label="Abrir imagem em tamanho maior"
      >
        <img
          src={message.mediaUrl}
          alt={message.mediaFileName || "Imagem do WhatsApp"}
          loading="lazy"
          className="max-h-80 max-w-full rounded-xl object-contain"
        />
      </a>
    );
  }

  if (
    message.messageType === "video" &&
    message.mediaUrl
  ) {
    return (
      <video
        controls
        preload="metadata"
        src={message.mediaUrl}
        className="max-h-80 max-w-full rounded-xl"
      >
        Seu navegador não suporta reprodução de vídeo.
      </video>
    );
  }

  if (
    message.messageType === "document" &&
    message.mediaUrl
  ) {
    return (
      <a
        href={message.mediaUrl}
        target="_blank"
        rel="noreferrer"
        className="flex min-w-[220px] items-center gap-3 rounded-xl border border-current/15 px-3 py-2 text-sm"
      >
        <FileText size={20} className="shrink-0" />
        <span className="min-w-0">
          <b className="block truncate">
            {message.mediaFileName || "Arquivo"}
          </b>
          <span className="text-xs opacity-70">
            Abrir arquivo
          </span>
        </span>
      </a>
    );
  }

  return (
    <p
      className={`whitespace-pre-wrap break-words text-sm ${
        message.messageType !== "text"
          ? "italic opacity-75"
          : ""
      }`}
    >
      {body(message)}
    </p>
  );
}

const messagePreview = (message: WhatsAppMessage) => {
  if (message.textBody?.trim()) {
    return message.textBody.trim();
  }

  if (message.mediaTranscript?.trim()) {
    return message.mediaTranscript.trim();
  }

  return unsupported[message.messageType] ?? "Mensagem";
};

const deliveryLabel = (message: WhatsAppMessage) => {
  if (message.direction !== "outbound") {
    return null;
  }

  switch (message.deliveryStatus) {
    case "read":
      return "Lida";
    case "delivered":
      return "Entregue";
    case "failed":
      return "Falhou";
    default:
      return "Enviada";
  }
};

type Props = {
  conversation?: WhatsAppConversation;
  messages: WhatsAppMessage[];
  loading: boolean;
  sending: boolean;
  canReply: boolean;
  onBack: () => void;
  onDetails: () => void;
  onSend: (
    text: string,
    replyToExternalMessageId?: string,
  ) => Promise<unknown>;
  onSendMedia: (
    file: File,
    replyToExternalMessageId?: string,
  ) => Promise<unknown>;
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
  onSendMedia,
}: Props) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [pendingMessage, setPendingMessage] = useState<PendingMessage | null>(null);
  const [recording, setRecording] = useState(false);
  const [replyingTo, setReplyingTo] = useState<WhatsAppMessage | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recorderChunksRef = useRef<Blob[]>([]);
  const recorderStreamRef = useRef<MediaStream | null>(null);

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
      await onSend(
        text,
        replyingTo?.externalMessageId,
      );
      setDraft("");
      setReplyingTo(null);
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

  const sendMediaFile = async (file?: File) => {
    if (!file || sending || !canReply) return;

    setError("");

    try {
      await onSendMedia(
        file,
        replyingTo?.externalMessageId,
      );
      setReplyingTo(null);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível enviar o arquivo.",
      );
    }
  };

  const stopRecorderStream = () => {
    recorderStreamRef.current?.getTracks().forEach((track) => track.stop());
    recorderStreamRef.current = null;
  };

  const startRecording = async () => {
    if (sending || !canReply || recording) return;

    setError("");

    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        throw new Error("Este navegador não permite gravar áudio por aqui.");
      }

      const compatibleMimeType = [
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ].find((type) => MediaRecorder.isTypeSupported(type));

      if (!compatibleMimeType) {
        throw new Error(
          "Seu navegador não oferece um formato de gravação compatível com o WhatsApp. Use o botão de anexo para enviar um áudio MP3, M4A, AAC, AMR ou OGG.",
        );
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recorderStreamRef.current = stream;
      recorderChunksRef.current = [];

      const recorder = new MediaRecorder(stream, {
        mimeType: compatibleMimeType,
      });

      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recorderChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const chunks = recorderChunksRef.current;
        recorderChunksRef.current = [];
        stopRecorderStream();
        recorderRef.current = null;
        setRecording(false);

        if (!chunks.length) return;

        const mimeType = compatibleMimeType.split(";")[0];
        const extension =
          mimeType === "audio/mp4" ? "m4a" : "ogg";
        const blob = new Blob(chunks, { type: mimeType });
        const file = new File(
          [blob],
          `audio-${Date.now()}.${extension}`,
          { type: mimeType },
        );

        void sendMediaFile(file);
      };

      recorder.onerror = () => {
        stopRecorderStream();
        recorderRef.current = null;
        setRecording(false);
        setError("Não foi possível concluir a gravação.");
      };

      recorder.start();
      setRecording(true);
    } catch (reason) {
      stopRecorderStream();
      setRecording(false);
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível iniciar a gravação.",
      );
    }
  };

  const stopRecording = () => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
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
            {messages.map((message) => {
              const repliedMessage =
                message.replyToExternalMessageId
                  ? messages.find(
                      (item) =>
                        item.externalMessageId ===
                        message.replyToExternalMessageId,
                    )
                  : undefined;

              const statusLabel =
                deliveryLabel(message);

              return (
                <article
                  key={message.id}
                  className={`group flex ${message.direction === "outbound" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`relative max-w-[85%] rounded-2xl px-4 py-3 shadow-sm md:max-w-[70%] ${
                      message.direction === "outbound"
                        ? "rounded-br-md bg-primary text-primary-foreground"
                        : "rounded-bl-md border bg-card"
                    }`}
                  >
                    {repliedMessage && (
                      <div className="mb-2 rounded-lg border-l-2 border-current/40 bg-black/5 px-2 py-1.5 text-xs opacity-75">
                        <p className="truncate font-medium">
                          {repliedMessage.direction === "outbound"
                            ? "Você"
                            : conversation.contactName || "Contato"}
                        </p>
                        <p className="line-clamp-2">
                          {messagePreview(repliedMessage)}
                        </p>
                      </div>
                    )}

                    <MessageContent message={message} />

                    <div className="mt-1 flex items-center justify-end gap-2 text-[10px] opacity-60">
                      <button
                        type="button"
                        onClick={() => setReplyingTo(message)}
                        className="inline-flex items-center gap-1 rounded px-1 py-0.5 opacity-0 transition-opacity hover:bg-black/5 group-hover:opacity-100 focus:opacity-100"
                        aria-label="Responder esta mensagem"
                        title="Responder"
                      >
                        <Reply size={11} />
                        Responder
                      </button>

                      <span>{message.messageType}</span>

                      <time>
                        {new Date(message.messageTimestamp || message.createdAt).toLocaleTimeString(
                          "pt-BR",
                          { hour: "2-digit", minute: "2-digit" },
                        )}
                      </time>

                      {statusLabel && (
                        <span
                          className="inline-flex items-center gap-1"
                          title={statusLabel}
                        >
                          {message.deliveryStatus === "read" ||
                          message.deliveryStatus === "delivered" ? (
                            <CheckCheck size={12} />
                          ) : (
                            <Check size={12} />
                          )}
                          {statusLabel}
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}

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
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="audio/*,video/mp4,video/3gpp,video/quicktime,image/jpeg,image/png,image/webp,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.currentTarget.value = "";
            void sendMediaFile(file);
          }}
        />

        {replyingTo && (
          <div className="mb-2 flex items-start gap-2 rounded-xl border bg-muted/50 px-3 py-2 text-sm">
            <Reply size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground">
                Respondendo a {replyingTo.direction === "outbound"
                  ? "você"
                  : conversation.contactName || "contato"}
              </p>
              <p className="truncate">
                {messagePreview(replyingTo)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-lg hover:bg-muted"
              aria-label="Cancelar resposta"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {recording && (
          <div className="mb-2 flex items-center gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <span className="h-2 w-2 animate-pulse rounded-full bg-current" />
            Gravando áudio…
            <button
              type="button"
              className="ml-auto font-medium underline underline-offset-2"
              onClick={stopRecording}
            >
              Parar e enviar
            </button>
          </div>
        )}

        <div className="flex items-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm" className="h-12 w-12 px-0 md:h-11 md:w-11 md:px-0"
            disabled={!canReply || sending || recording}
            onClick={() => fileInputRef.current?.click()}
            aria-label="Anexar arquivo ou áudio"
            title="Anexar arquivo"
          >
            <Paperclip size={18} />
          </Button>

          <Button
            type="button"
            variant={recording ? "default" : "outline"}
            size="sm" className="h-12 w-12 px-0 md:h-11 md:w-11 md:px-0"
            disabled={!canReply || sending}
            onClick={() =>
              recording
                ? stopRecording()
                : void startRecording()
            }
            aria-label={recording ? "Parar gravação" : "Gravar áudio"}
            title={recording ? "Parar e enviar" : "Gravar áudio"}
          >
            {recording ? <Square size={16} /> : <Mic size={18} />}
          </Button>

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
