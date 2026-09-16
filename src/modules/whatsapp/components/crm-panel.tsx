import { useEffect, useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  CalendarClock,
  FileText,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/shared/components/feedback/toast";
import { useCrmActions, useCrmData } from "@/modules/crm/hooks";
import type { WhatsAppConversation } from "../types";
import { whatsappRepository } from "../repository";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const dateTime = (value?: string) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(value))
    : "Nenhum agendado";

const Field = ({
  label,
  value,
}: {
  label: string;
  value?: string;
}) => (
  <div>
    <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {label}
    </dt>
    <dd className="mt-1 break-words text-sm">{value || "Não vinculado"}</dd>
  </div>
);

const phoneDigits = (value?: string) => (value ?? "").replace(/\D/g, "");

const comparablePhones = (value?: string) => {
  const digits = phoneDigits(value);
  const values = new Set<string>();
  if (!digits) return values;

  values.add(digits);

  if (digits.startsWith("55") && digits.length > 11) {
    values.add(digits.slice(2));
  }

  if (digits.length >= 10) {
    values.add(digits.slice(-10));
  }

  if (digits.length >= 11) {
    values.add(digits.slice(-11));
  }

  return values;
};

const samePhone = (left?: string, right?: string) => {
  const a = comparablePhones(left);
  const b = comparablePhones(right);
  if (!a.size || !b.size) return false;
  return [...a].some((value) => b.has(value));
};

const statusLabel = (status?: string) => {
  if (status === "won") return "Ganha";
  if (status === "lost") return "Perdida";
  if (status === "archived") return "Arquivada";
  return "Em aberto";
};

export function CrmPanel({
  conversation,
  drawer,
  onClose,
}: {
  conversation?: WhatsAppConversation;
  drawer?: boolean;
  onClose?: () => void;
}) {
  const { data, isLoading } = useCrmData();
  const actions = useCrmActions();
  const { notify } = useToast();

  const contact = useMemo(() => {
    if (!conversation || !data) return undefined;

    if (conversation.contactId) {
      const linked = data.contacts.find(
        (item) => item.id === conversation.contactId && !item.deletedAt,
      );
      if (linked) return linked;
    }

    return data.contacts.find(
      (item) =>
        !item.deletedAt &&
        (samePhone(item.whatsapp, conversation.waId) ||
          samePhone(item.phone, conversation.waId)),
    );
  }, [conversation, data]);

  const company = useMemo(() => {
    if (!conversation || !data) return undefined;

    if (conversation.companyId) {
      const linked = data.companies.find(
        (item) => item.id === conversation.companyId && !item.deletedAt,
      );
      if (linked) return linked;
    }

    if (contact?.companyId) {
      const byContact = data.companies.find(
        (item) => item.id === contact.companyId && !item.deletedAt,
      );
      if (byContact) return byContact;
    }

    return data.companies.find(
      (item) =>
        !item.deletedAt &&
        (samePhone(item.whatsapp, conversation.waId) ||
          samePhone(item.phone, conversation.waId)),
    );
  }, [conversation, contact, data]);

  const opportunity = useMemo(() => {
    if (!conversation || !data) return undefined;

    if (conversation.opportunityId) {
      const linked = data.opportunities.find(
        (item) => item.id === conversation.opportunityId && !item.deletedAt,
      );
      if (linked) return linked;
    }

    if (!company) return undefined;

    return data.opportunities
      .filter((item) => item.companyId === company.id && !item.deletedAt)
      .sort((a, b) => {
        const aOpen = a.status === "open" ? 1 : 0;
        const bOpen = b.status === "open" ? 1 : 0;
        if (aOpen !== bOpen) return bOpen - aOpen;
        return b.updatedAt.localeCompare(a.updatedAt);
      })[0];
  }, [company, conversation, data]);

  const pipeline = opportunity
    ? data?.pipelines.find((item) => item.id === opportunity.pipelineId)
    : undefined;

  const stages = useMemo(
    () =>
      opportunity
        ? (data?.stages ?? [])
            .filter(
              (item) =>
                item.pipelineId === opportunity.pipelineId &&
                item.isActive !== false,
            )
            .sort((a, b) => a.position - b.position)
        : [],
    [data?.stages, opportunity],
  );

  const stage = opportunity
    ? stages.find((item) => item.id === opportunity.stageId)
    : undefined;

  const nextFollowUp = useMemo(() => {
    if (!company) return undefined;
    return (data?.tasks ?? [])
      .filter(
        (item) =>
          !item.deletedAt &&
          item.status === "pending" &&
          item.companyId === company.id &&
          (!opportunity || !item.opportunityId || item.opportunityId === opportunity.id),
      )
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0];
  }, [company, data?.tasks, opportunity]);

  const notes = useMemo(() => {
    if (!company) return [];
    return (data?.notes ?? [])
      .filter(
        (item) =>
          item.companyId === company.id &&
          (!opportunity || !item.opportunityId || item.opportunityId === opportunity.id),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 3);
  }, [company, data?.notes, opportunity]);

  useEffect(() => {
    if (!conversation) return;

    const companyId = company?.id;
    const contactId = contact?.id;
    const opportunityId = opportunity?.id;

    const needsLink =
      (!!companyId && companyId !== conversation.companyId) ||
      (!!contactId && contactId !== conversation.contactId) ||
      (!!opportunityId && opportunityId !== conversation.opportunityId);

    if (!needsLink) return;

    void whatsappRepository
      .linkCrmContext({
        organizationId: conversation.organizationId,
        conversationId: conversation.id,
        companyId,
        contactId,
        opportunityId,
      })
      .catch((error) => {
        console.error("[WhatsApp CRM auto-link]", error);
      });
  }, [company?.id, contact?.id, conversation, opportunity?.id]);

  const [value, setValue] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    setValue(opportunity ? String(opportunity.value ?? 0) : "");
    setNote("");
  }, [opportunity?.id, opportunity?.value]);

  if (!conversation) return null;

  const saveValue = async () => {
    if (!opportunity) return;
    const parsed = Number(value.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed < 0) {
      notify({ title: "Informe um valor válido." });
      return;
    }
    await actions.updateOpportunity.mutateAsync({
      id: opportunity.id,
      data: { value: parsed },
    });
    notify({ title: "Valor atualizado." });
  };

  const moveStage = async (stageId: string) => {
    if (!opportunity || stageId === opportunity.stageId) return;
    const target = stages.find((item) => item.id === stageId);
    if (!target) return;
    if (target.isWon || target.isLost) {
      notify({
        title: "Use a ação de ganho ou perda no CRM para encerrar a oportunidade.",
      });
      return;
    }
    await actions.moveOpportunity.mutateAsync({
      opportunityId: opportunity.id,
      stageId,
    });
    notify({ title: "Etapa atualizada." });
  };

  const addNote = async () => {
    const text = note.trim();
    if (!company || !text) return;
    await actions.addNote.mutateAsync({
      companyId: company.id,
      opportunityId: opportunity?.id,
      text,
    });
    setNote("");
    notify({ title: "Observação adicionada." });
  };

  return (
    <aside
      className={`${
        drawer
          ? "fixed inset-y-0 right-0 z-50 w-[min(88vw,22rem)] shadow-overlay xl:static xl:w-auto xl:shadow-none"
          : "hidden xl:block"
      } min-h-0 overflow-y-auto border-l bg-card p-5`}
      aria-label="Informações do CRM"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">CRM e contato</h2>
        {drawer && (
          <button
            onClick={onClose}
            className="premium-focus grid h-10 w-10 place-items-center rounded-xl xl:hidden"
            aria-label="Fechar informações"
          >
            <X />
          </button>
        )}
      </div>

      {isLoading ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Carregando dados do CRM…
        </p>
      ) : (
        <>
          <dl className="mt-6 space-y-5">
            <div className="flex gap-3">
              <UserRound className="shrink-0 text-champagne-dark" size={20} />
              <div className="min-w-0 space-y-3">
                <Field
                  label="Contato"
                  value={
                    contact?.name ||
                    conversation.contactDisplayName ||
                    conversation.contactName
                  }
                />
                <Field
                  label="Telefone / WhatsApp"
                  value={contact?.whatsapp || contact?.phone || conversation.waId}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <BriefcaseBusiness
                className="shrink-0 text-champagne-dark"
                size={20}
              />
              <div className="min-w-0 space-y-3">
                <Field
                  label="Empresa / Lead"
                  value={company?.fantasyName || conversation.companyName}
                />
                <Field
                  label="Oportunidade"
                  value={opportunity?.title || conversation.opportunityTitle}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <UsersRound className="shrink-0 text-champagne-dark" size={20} />
              <div className="min-w-0 space-y-3">
                <Field
                  label="Responsável"
                  value={
                    opportunity?.owner ||
                    conversation.assignedUserName ||
                    conversation.assignedUserId
                  }
                />
                <Field
                  label="Status"
                  value={
                    opportunity
                      ? statusLabel(opportunity.status)
                      : conversation.status === "open"
                        ? "Conversa aberta"
                        : "Conversa fechada"
                  }
                />
              </div>
            </div>
          </dl>

          {!opportunity ? (
            <div className="mt-6 rounded-xl border border-dashed p-4">
              <p className="text-sm font-semibold">Oportunidade não vinculada</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Não encontrei uma oportunidade do CRM associada a este telefone.
                Confira se o WhatsApp/telefone do lead está cadastrado no CRM.
              </p>
            </div>
          ) : (
            <>
              <section className="mt-6 space-y-4 border-t pt-5">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Pipeline
                  </label>
                  <p className="mt-1 text-sm">{pipeline?.name || "Pipeline"}</p>
                </div>

                <label className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Etapa
                  </span>
                  <select
                    value={opportunity.stageId}
                    disabled={opportunity.status !== "open" || actions.moveOpportunity.isPending}
                    onChange={(event) => void moveStage(event.target.value)}
                    className="h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  >
                    {stages.map((item) => (
                      <option
                        key={item.id}
                        value={item.id}
                        disabled={
                          (item.isWon || item.isLost) &&
                          item.id !== opportunity.stageId
                        }
                      >
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Valor
                  </label>
                  <div className="mt-2 flex gap-2">
                    <Input
                      inputMode="decimal"
                      value={value}
                      onChange={(event) => setValue(event.target.value)}
                      disabled={opportunity.status !== "open"}
                    />
                    <Button
                      variant="outline"
                      onClick={() => void saveValue()}
                      disabled={
                        opportunity.status !== "open" ||
                        actions.updateOpportunity.isPending
                      }
                    >
                      Salvar
                    </Button>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Atual: {currency.format(opportunity.value ?? 0)}
                  </p>
                </div>
              </section>

              <section className="mt-6 border-t pt-5">
                <div className="flex items-start gap-3">
                  <CalendarClock
                    className="mt-0.5 shrink-0 text-champagne-dark"
                    size={19}
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Próximo follow-up
                    </p>
                    <p className="mt-1 text-sm font-medium">
                      {nextFollowUp?.title || "Nenhum agendado"}
                    </p>
                    {nextFollowUp && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {dateTime(nextFollowUp.dueAt)}
                      </p>
                    )}
                  </div>
                </div>
              </section>

              <section className="mt-6 border-t pt-5">
                <div className="flex items-center gap-2">
                  <FileText className="text-champagne-dark" size={18} />
                  <h3 className="text-sm font-semibold">Observações</h3>
                </div>

                <Textarea
                  className="mt-3"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Adicionar observação sobre este lead…"
                  rows={3}
                />
                <Button
                  className="mt-2 w-full"
                  variant="outline"
                  disabled={!note.trim() || actions.addNote.isPending}
                  onClick={() => void addNote()}
                >
                  Adicionar observação
                </Button>

                <div className="mt-4 space-y-3">
                  {notes.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Nenhuma observação registrada.
                    </p>
                  ) : (
                    notes.map((item) => (
                      <div key={item.id} className="rounded-xl bg-muted/50 p-3">
                        <p className="whitespace-pre-wrap text-sm leading-5">
                          {item.text}
                        </p>
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          {item.author} · {dateTime(item.createdAt)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </>
          )}
        </>
      )}
    </aside>
  );
}
