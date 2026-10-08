import {
  useEffect,
  useState,
} from "react";
import {
  ArrowLeft,
  FileSpreadsheet,
  ListPlus,
  MessageCircle,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { PageContainer } from "@/shared/components/layout/page-container";
import { PageHeader } from "@/shared/components/layout/page-header";
import { ProspectingListDialog } from "./ProspectingListDialog";
import {
  useDeleteProspectingList,
  useGenerateProspectingMessage,
  useMarkProspectingMessageOpened,
  useProspectingLeads,
  useProspectingLists,
  useUpdateProspectingMessage,
} from "./hooks";
import {
  buildProspectingWhatsappUrl,
  type ProspectingLead,
  type ProspectingList,
} from "./prospecting-repository";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
  }).format(new Date(value));
}

function statusLabel(
  status: ProspectingLead["status"],
) {
  switch (status) {
    case "new":
      return "Novo";

    case "message_sent":
      return "Mensagem enviada";

    case "replied":
      return "Respondeu";

    case "in_conversation":
      return "Em conversa";

    case "opportunity":
      return "Oportunidade";

    case "not_interested":
      return "Sem interesse";

    default:
      return status;
  }
}

function LeadMessageEditor({
  lead,
  listId,
}: {
  lead: ProspectingLead;
  listId: string;
}) {
  const generateMessage =
    useGenerateProspectingMessage(
      listId,
    );

  const updateMessage =
    useUpdateProspectingMessage(
      listId,
    );

  const markMessageOpened =
    useMarkProspectingMessageOpened(
      listId,
    );

  const [draft, setDraft] =
    useState(
      lead.generatedMessage,
    );

  const [
    localError,
    setLocalError,
  ] = useState("");

  useEffect(() => {
    setDraft(
      lead.generatedMessage,
    );
  }, [
    lead.generatedMessage,
    lead.id,
  ]);

  const isGenerating =
    generateMessage.isPending &&
    generateMessage.variables ===
      lead.id;

  const isSaving =
    updateMessage.isPending &&
    updateMessage.variables
      ?.leadId === lead.id;

  const isOpeningWhatsapp =
    markMessageOpened.isPending &&
    markMessageOpened.variables ===
      lead.id;

  const hasMessage =
    Boolean(
      lead.generatedMessage,
    );

  const hasChanges =
    draft.trim() !==
    lead.generatedMessage.trim();

  async function handleGenerate() {
    setLocalError("");

    try {
      await generateMessage.mutateAsync(
        lead.id,
      );
    } catch {
      // O erro é exibido abaixo.
    }
  }

  async function handleSave() {
    if (!draft.trim()) {
      return;
    }

    setLocalError("");

    try {
      await updateMessage.mutateAsync({
        leadId: lead.id,
        message: draft,
      });
    } catch {
      // O erro é exibido abaixo.
    }
  }

  async function handleOpenWhatsapp() {
    setLocalError("");

    try {
      const url =
        buildProspectingWhatsappUrl(
          lead.whatsapp,
          draft,
        );

      /*
       * A abertura precisa acontecer
       * diretamente no clique.
       *
       * Sem "noopener,noreferrer" no
       * terceiro parâmetro porque alguns
       * navegadores retornam null mesmo
       * quando a aba abre corretamente.
       */
      const whatsappWindow =
        window.open(
          url,
          "_blank",
        );

      if (!whatsappWindow) {
        setLocalError(
          "O navegador bloqueou a abertura do WhatsApp. Libere pop-ups para este site e tente novamente.",
        );

        return;
      }

      /*
       * Depois de abrir, removemos
       * a referência da nova aba
       * para a aplicação atual.
       */
      whatsappWindow.opener = null;

      /*
       * Agora registramos a abertura
       * no banco.
       *
       * Se o status ainda for "new",
       * ele passa para "message_sent".
       */
      await markMessageOpened.mutateAsync(
        lead.id,
      );
    } catch (cause) {
      setLocalError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível abrir o WhatsApp.",
      );
    }
  }

  if (!hasMessage) {
    return (
      <div className="min-w-[280px]">
        <Button
          size="sm"
          onClick={
            handleGenerate
          }
          disabled={
            isGenerating
          }
        >
          <Sparkles
            size={16}
          />

          {isGenerating
            ? "Gerando..."
            : "Gerar mensagem"}
        </Button>

        {generateMessage.isError && (
          <p className="mt-2 max-w-xs text-xs text-destructive">
            {generateMessage.error instanceof
            Error
              ? generateMessage.error.message
              : "Não foi possível gerar a mensagem."}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="min-w-[390px] space-y-2">
      <textarea
        value={draft}
        onChange={(event) => {
          setDraft(
            event.target.value,
          );

          setLocalError("");
        }}
        rows={5}
        className="w-full resize-y rounded-xl border border-input bg-background px-3 py-2 text-sm leading-5"
      />

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={
            handleGenerate
          }
          disabled={
            isGenerating ||
            isSaving ||
            isOpeningWhatsapp
          }
        >
          <RefreshCw
            size={15}
            className={
              isGenerating
                ? "animate-spin"
                : ""
            }
          />

          {isGenerating
            ? "Gerando..."
            : "Regenerar"}
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={
            handleSave
          }
          disabled={
            isSaving ||
            isGenerating ||
            isOpeningWhatsapp ||
            !draft.trim() ||
            !hasChanges
          }
        >
          <Save
            size={15}
          />

          {isSaving
            ? "Salvando..."
            : "Salvar edição"}
        </Button>

        <Button
          size="sm"
          onClick={
            handleOpenWhatsapp
          }
          disabled={
            isOpeningWhatsapp ||
            isGenerating ||
            !draft.trim() ||
            !lead.whatsapp
          }
          className="bg-emerald-600 text-white hover:bg-emerald-700"
        >
          <MessageCircle
            size={16}
          />

          {isOpeningWhatsapp
            ? "Abrindo..."
            : "Abrir no WhatsApp"}
        </Button>
      </div>

      {lead.messageEdited && (
        <p className="text-xs text-muted-foreground">
          Mensagem editada
          manualmente
        </p>
      )}

      {!lead.whatsapp && (
        <p className="text-xs text-amber-700">
          Este lead não possui
          WhatsApp cadastrado.
        </p>
      )}

      {localError && (
        <p className="max-w-sm text-xs text-destructive">
          {localError}
        </p>
      )}

      {(generateMessage.isError ||
        updateMessage.isError ||
        markMessageOpened.isError) &&
        !localError && (
          <p className="max-w-sm text-xs text-destructive">
            {generateMessage.error instanceof
            Error
              ? generateMessage.error.message
              : updateMessage.error instanceof
                  Error
                ? updateMessage.error.message
                : markMessageOpened.error instanceof
                    Error
                  ? markMessageOpened.error.message
                  : "Não foi possível concluir a ação."}
          </p>
        )}
    </div>
  );
}

export function ProspectingPage() {
  const [
    dialogOpen,
    setDialogOpen,
  ] = useState(false);

  const [
    selectedList,
    setSelectedList,
  ] =
    useState<ProspectingList | null>(
      null,
    );

  const [
    deleteTarget,
    setDeleteTarget,
  ] =
    useState<ProspectingList | null>(
      null,
    );

  const deleteList =
    useDeleteProspectingList();

  const listsQuery =
    useProspectingLists();

  const leadsQuery =
    useProspectingLeads(
      selectedList?.id ??
        null,
    );

  const lists =
    listsQuery.data ?? [];

  const leads =
    leadsQuery.data ?? [];

  if (selectedList) {
    return (
      <PageContainer>
        <PageHeader
          title={
            selectedList.name
          }
          description={
            selectedList.description ||
            "Leads desta lista de prospecção."
          }
          actions={
            <Button
              variant="outline"
              onClick={() =>
                setSelectedList(
                  null,
                )
              }
            >
              <ArrowLeft
                size={17}
              />

              Voltar
            </Button>
          }
        />

        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">
                Leads
              </p>

              <p className="mt-1 text-2xl font-semibold">
                {
                  selectedList.totalLeads
                }
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">
                Origem
              </p>

              <p className="mt-1 font-semibold">
                {selectedList.sourceType ===
                "csv"
                  ? "CSV"
                  : "Colado"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">
                Criada em
              </p>

              <p className="mt-1 font-semibold">
                {formatDate(
                  selectedList.createdAt,
                )}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-0">
            {leadsQuery.isLoading ? (
              <div className="grid min-h-64 place-items-center text-sm text-muted-foreground">
                Carregando leads...
              </div>
            ) : leadsQuery.isError ? (
              <div className="grid min-h-64 place-items-center px-6 text-center">
                <div>
                  <p className="font-semibold">
                    Não foi possível carregar os leads.
                  </p>

                  <Button
                    className="mt-4"
                    variant="outline"
                    onClick={() =>
                      void leadsQuery.refetch()
                    }
                  >
                    Tentar novamente
                  </Button>
                </div>
              </div>
            ) : leads.length ===
              0 ? (
              <div className="grid min-h-64 place-items-center px-6 text-center text-sm text-muted-foreground">
                Nenhum lead encontrado nesta lista.
              </div>
            ) : (
              <div className="overflow-auto">
                <table className="w-full min-w-[1650px] text-left text-sm">
                  <thead className="border-b bg-muted/30">
                    <tr>
                      <th className="p-3">
                        Nome
                      </th>

                      <th className="p-3">
                        WhatsApp
                      </th>

                      <th className="p-3">
                        Instagram
                      </th>

                      <th className="p-3">
                        Cidade
                      </th>

                      <th className="p-3">
                        Tipo de negócio
                      </th>

                      <th className="p-3">
                        Observações
                      </th>

                      <th className="p-3">
                        Mensagem
                      </th>

                      <th className="p-3">
                        Status
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {leads.map(
                      (lead) => (
                        <tr
                          key={
                            lead.id
                          }
                          className="border-b align-top last:border-0"
                        >
                          <td className="p-3">
                            {lead.name ||
                              "—"}
                          </td>

                          <td className="p-3 whitespace-nowrap">
                            {lead.whatsapp ||
                              "—"}
                          </td>

                          <td className="p-3">
                            {lead.instagram ||
                              "—"}
                          </td>

                          <td className="p-3">
                            {lead.city ||
                              "—"}
                          </td>

                          <td className="p-3">
                            {lead.businessType ||
                              "—"}
                          </td>

                          <td className="max-w-sm whitespace-normal p-3">
                            {lead.notes ||
                              "—"}
                          </td>

                          <td className="p-3">
                            <LeadMessageEditor
                              lead={
                                lead
                              }
                              listId={
                                selectedList.id
                              }
                            />
                          </td>

                          <td className="p-3">
                            <span className="whitespace-nowrap rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                              {statusLabel(
                                lead.status,
                              )}
                            </span>
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Prospecção"
        description="Organize listas e acompanhe novas oportunidades comerciais."
        actions={
          <Button
            onClick={() =>
              setDialogOpen(
                true,
              )
            }
          >
            <ListPlus
              size={17}
            />

            Nova lista
          </Button>
        }
      />

      {listsQuery.isLoading ? (
        <Card>
          <CardContent className="grid min-h-72 place-items-center text-sm text-muted-foreground">
            Carregando listas...
          </CardContent>
        </Card>
      ) : listsQuery.isError ? (
        <Card>
          <CardContent className="grid min-h-72 place-items-center px-6 text-center">
            <div>
              <p className="font-semibold">
                Não foi possível carregar as listas.
              </p>

              <Button
                className="mt-4"
                variant="outline"
                onClick={() =>
                  void listsQuery.refetch()
                }
              >
                Tentar novamente
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : lists.length === 0 ? (
        <Card>
          <CardContent className="grid min-h-72 place-items-center px-6 py-12 text-center">
            <div>
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-champagne-soft text-champagne-dark">
                <ListPlus
                  size={23}
                />
              </span>

              <h2 className="mt-4 text-xl font-semibold tracking-[-.03em]">
                Nenhuma lista criada ainda
              </h2>

              <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                Crie sua primeira lista de prospecção para organizar os leads que serão trabalhados.
              </p>

              <Button
                className="mt-5"
                onClick={() =>
                  setDialogOpen(
                    true,
                  )
                }
              >
                <ListPlus
                  size={17}
                />

                Criar primeira lista
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {lists.map(
            (list) => (
              <Card
                key={
                  list.id
                }
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-champagne-soft text-champagne-dark">
                      <FileSpreadsheet
                        size={
                          21
                        }
                      />
                    </span>

                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      {list.sourceType ===
                      "csv"
                        ? "CSV"
                        : "Colado"}
                    </span>
                  </div>

                  <h2 className="mt-4 text-lg font-semibold">
                    {
                      list.name
                    }
                  </h2>

                  {list.description && (
                    <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">
                      {
                        list.description
                      }
                    </p>
                  )}

                  <div className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-muted/40 p-3">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Leads
                      </p>

                      <p className="mt-1 font-semibold">
                        {
                          list.totalLeads
                        }
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">
                        Criada em
                      </p>

                      <p className="mt-1 font-semibold">
                        {formatDate(
                          list.createdAt,
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
                    <Button
                      variant="outline"
                      onClick={() =>
                        setSelectedList(
                          list,
                        )
                      }
                    >
                      Abrir lista
                    </Button>

                    <Button
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      aria-label={`Excluir lista ${list.name}`}
                      onClick={() =>
                        setDeleteTarget(
                          list,
                        )
                      }
                    >
                      <Trash2 size={16} />
                      Excluir
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ),
          )}
        </div>
      )}

      <ProspectingListDialog
        open={
          dialogOpen
        }
        onClose={() =>
          setDialogOpen(
            false,
          )
        }
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Excluir esta lista?"
        description={
          deleteTarget
            ? `A lista "${deleteTarget.name}" e os leads importados nela serão removidos. Oportunidades já criadas no CRM não serão excluídas.`
            : ""
        }
        confirmLabel={
          deleteList.isPending
            ? "Excluindo..."
            : "Excluir lista"
        }
        onCancel={() => {
          if (!deleteList.isPending) {
            setDeleteTarget(null);
          }
        }}
        onConfirm={() => {
          if (!deleteTarget) return;

          void deleteList
            .mutateAsync(
              deleteTarget.id,
            )
            .then(() => {
              setDeleteTarget(null);
            });
        }}
      />

      {deleteList.isError && (
        <p className="mt-3 text-sm text-destructive">
          Não foi possível excluir a lista.
        </p>
      )}
    </PageContainer>
  );
}