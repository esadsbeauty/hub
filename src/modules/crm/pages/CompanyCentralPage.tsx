import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Edit, NotebookPen, Plus, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, Skeleton } from "@/shared/components/feedback/states";
import { PageContainer } from "@/shared/components/layout/page-container";
import { Tabs } from "@/shared/components/navigation/tabs";
import { Modal } from "@/shared/components/overlays/modal";
import { useToast } from "@/shared/components/feedback/toast";
import { useCrmActions, useCrmData } from "../hooks";
import { CompanyForm } from "../components/company-form";
import {
  ActivityQuickForm,
  ContactQuickForm,
  FollowUpQuickForm,
} from "../components/simple-forms";
import { OpportunityForm } from "../components/opportunity-form";
import { OpportunityDetails } from "../components/opportunity-details";
import {
  CompanyBadges,
  CompanyContacts,
  CompanyOpportunities,
  CompanyOverview,
  CompanyTasks,
  CompanyTimeline,
} from "../components/company-sections";
import type { CompanyContact, Opportunity } from "../types";
import { formatDateTime } from "../utils/formatters";
import { CustomerWorkspace } from "@/modules/customers/components/customer-workspace";
import { CustomerFinancePanel } from "@/modules/finance/CustomerFinancePanel";
import { crmTerminology, useBusinessMode } from "../business-mode";
type Tab = "overview" | "customer" | "finance" | "opportunities" | "activities" | "contacts" | "tasks";
const tabs: { value: Tab; label: string }[] = [
  { value: "overview", label: "Visão geral" },
  { value: "customer", label: "Pós-venda" },
  { value: "finance", label: "Financeiro" },
  { value: "opportunities", label: "Oportunidades" },
  { value: "activities", label: "Atividades" },
  { value: "contacts", label: "Contatos" },
  { value: "tasks", label: "Tarefas" },
];
export function CompanyCentralPage() {
  const { id = "" } = useParams();
  const businessMode=useBusinessMode().data??"b2b",b2c=businessMode==="b2c",terms=crmTerminology(businessMode);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data, isLoading } = useCrmData();
  const actions = useCrmActions();
  const { notify } = useToast();
  const [tab, setTab] = useState<Tab>(() => searchParams.get("customer") === "1" ? "customer" : "overview");
  const [modal, setModal] = useState<
    | "edit"
    | "contact"
    | "opportunity"
    | "followup"
    | "interaction"
    | "note"
    | null
  >(null);
  const [note, setNote] = useState("");
  const [selected, setSelected] = useState<Opportunity>();
  const [editingOpportunity, setEditingOpportunity] = useState<Opportunity>();
  const [editingContact, setEditingContact] = useState<CompanyContact>();
  const [deletingContact, setDeletingContact] = useState<CompanyContact>();
  const [deletingCompany, setDeletingCompany] = useState(false);
  const company = data?.companies.find(
    (item) => item.id === id && !item.deletedAt,
  );
  const related = useMemo(
    () => ({
      contacts: (data?.contacts ?? []).filter(
        (item) => item.companyId === id && !item.deletedAt,
      ),
      opportunities: (data?.opportunities ?? []).filter(
        (item) => item.companyId === id && !item.deletedAt,
      ),
      events: (data?.events ?? []).filter((item) => item.companyId === id),
      tasks: (data?.tasks ?? []).filter(
        (item) => item.companyId === id && !item.deletedAt,
      ),
      notes: (data?.notes ?? []).filter((item) => item.companyId === id),
    }),
    [data, id],
  );
  if (isLoading)
    return (
      <PageContainer>
        <div className="space-y-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-12" />
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </PageContainer>
    );
  if (!company || !data)
    return (
      <PageContainer>
        <EmptyState
          title={`${terms.company} não encontrado${b2c?"":"a"}`}
          action={
            <Button onClick={() => navigate("/crm")}>Voltar ao CRM</Button>
          }
        />
      </PageContainer>
    );
  const hasWon = related.opportunities.some((item) => item.status === "won");
  const hasOpen = related.opportunities.some((item) => item.status === "open");
  const relationship =
    company.lifecycleStage === "inactive"
      ? "Inativa"
      : hasWon
        ? "Cliente"
        : hasOpen
          ? "Em negociação"
          : "Prospect";
  const lastActivity = [...related.events].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  )[0];
  const openOpportunityModal = (opportunity?: Opportunity) => {
    setEditingOpportunity(opportunity);
    setModal("opportunity");
  };
  const success = (title: string) =>
    notify({ title, description: "As informações do CRM foram atualizadas." });
  return (
    <PageContainer>
      <button
        className="mb-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        onClick={() => navigate("/crm")}
      >
        <ArrowLeft size={15} /> Voltar ao CRM
      </button>
      <Card className="glass mb-6">
        <CardContent className="p-6">
          <div className="flex flex-col justify-between gap-5 lg:flex-row">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.22em] text-champagne-dark">
                {b2c?"Central do Lead":"Central da empresa"}
              </p>
              <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">
                {company.fantasyName}
              </h1>
              <div className="mt-3">
                <CompanyBadges relationship={relationship} company={company} />
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {company.city ?? "Cidade não informada"}
                {company.state ? ` / ${company.state}` : ""} ·{" "}
                {company.leadSource ?? "Origem não informada"} · Responsável:{" "}
                {company.owner ?? "Administrador"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Última atividade:{" "}
                {lastActivity
                  ? formatDateTime(lastActivity.createdAt)
                  : "Nenhuma"}
              </p>
            </div>
            <div className="flex flex-wrap content-start gap-2">
              <Button variant="outline" onClick={() => setModal("edit")}>
                <Edit size={15} /> {terms.editCompany}
              </Button>
              <Button onClick={() => openOpportunityModal()}>
                <Plus size={15} /> Nova oportunidade
              </Button>
              <Button variant="outline" onClick={() => setModal("followup")}>
                Novo follow-up
              </Button>
              <Button variant="outline" onClick={() => setModal("note")}>
                <NotebookPen size={15} /> Nova nota
              </Button>
              <Button variant="outline" onClick={() => setModal("interaction")}>
                Registrar interação
              </Button>
              {!b2c&&<Button variant="ghost" onClick={() => setModal("contact")}>
                <UserPlus size={15} /> Contato
              </Button>}
              <Button className="text-destructive hover:text-destructive" variant="ghost" onClick={() => setDeletingCompany(true)}>
                <Trash2 size={15} /> Excluir {terms.company.toLowerCase()}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      <Tabs tabs={b2c?tabs.filter(item=>item.value!=="contacts"):tabs} value={tab} onChange={setTab} />
      <div className="mt-5">
        {tab === "overview" && (
          <CompanyOverview
            businessMode={businessMode}
            company={company}
            contacts={related.contacts}
            opportunities={related.opportunities}
            tasks={related.tasks}
            events={related.events}
            notes={related.notes}
          />
        )}{" "}
        {tab === "customer" && <CustomerWorkspace companyId={id} />}{" "}
        {tab === "finance" && <CustomerFinancePanel companyId={id} />}{" "}
        {tab === "opportunities" && (
          <CompanyOpportunities
            opportunities={related.opportunities}
            pipelines={data.pipelines}
            stages={data.stages}
            onOpen={setSelected}
          />
        )}{" "}
        {tab === "activities" && (
          <CompanyTimeline
            events={related.events}
            onAddNote={() => setModal("note")}
          />
        )}{" "}
        {tab === "contacts" && (
          <CompanyContacts
            contacts={related.contacts}
            onEdit={(contact) => {
              setEditingContact(contact);
              setModal("contact");
            }}
            onSetPrimary={(contact) =>
              actions.updateContact.mutate(
                { id: contact.id, data: { isPrimary: true } },
                { onSuccess: () => success("Contato principal atualizado") },
              )
            }
            onDelete={setDeletingContact}
          />
        )}{" "}
        {tab === "tasks" && (
          <CompanyTasks
            tasks={related.tasks}
            onComplete={(taskId) =>
              actions.completeTask.mutate(taskId, {
                onSuccess: () => success("Tarefa concluída"),
              })
            }
            onReschedule={(task) =>
              actions.rescheduleTask.mutate(
                {
                  id: task.id,
                  dueAt: new Date(
                    new Date(task.dueAt).getTime() + 86_400_000,
                  ).toISOString(),
                },
                {
                  onSuccess: () =>
                    success("Tarefa reagendada para o próximo dia"),
                },
              )
            }
            onCancel={(taskId) =>
              actions.cancelTask.mutate(taskId, {
                onSuccess: () => success("Tarefa cancelada"),
              })
            }
          />
        )}
      </div>
      <Modal
        open={modal === "edit"}
        title={terms.editCompany}
        onClose={() => setModal(null)}
      >
        <CompanyForm
          businessMode={businessMode}
          company={company}
          profiles={data.profiles}
          onCancel={() => setModal(null)}
          onSubmit={async (form) => {
            await actions.updateCompany.mutateAsync({ id, data: form });
            setModal(null);
            success(`${terms.company} atualizado${b2c?"":"a"}`);
          }}
        />
      </Modal>
      <Modal
        open={modal === "contact"}
        title={editingContact ? "Editar contato" : "Adicionar contato"}
        onClose={() => {
          setModal(null);
          setEditingContact(undefined);
        }}
      >
        <ContactQuickForm
          contact={editingContact}
          onSubmit={async (form) => {
            editingContact
              ? await actions.updateContact.mutateAsync({
                  id: editingContact.id,
                  data: form,
                })
              : await actions.createContact.mutateAsync({
                  companyId: id,
                  data: form,
                });
            setModal(null);
            setEditingContact(undefined);
            success(
              editingContact ? "Contato atualizado" : "Contato adicionado",
            );
          }}
        />
      </Modal>
      <Modal
        open={modal === "followup"}
        title="Criar follow-up"
        onClose={() => setModal(null)}
      >
        <FollowUpQuickForm
          onSubmit={async (form) => {
            await actions.createFollowUp.mutateAsync({
              companyId: id,
              data: form,
              opportunityId: selected?.id,
            });
            setModal(null);
            setSelected(undefined);
            success("Follow-up criado");
          }}
        />
      </Modal>
      <Modal
        open={modal === "interaction"}
        title="Registrar interação"
        onClose={() => setModal(null)}
      >
        <ActivityQuickForm
          onSubmit={async (form) => {
            await actions.createActivity.mutateAsync({
              companyId: id,
              data: form,
            });
            setModal(null);
            success("Interação registrada");
          }}
        />
      </Modal>
      <Modal
        open={modal === "note"}
        title="Nova nota"
        onClose={() => setModal(null)}
      >
        <Textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Registre uma informação relevante..."
        />
        <Button
          className="mt-3"
          disabled={!note.trim()}
          onClick={async () => {
            await actions.addNote.mutateAsync({
              companyId: id,
              text: note.trim(),
              opportunityId: selected?.id,
            });
            setNote("");
            setModal(null);
            setSelected(undefined);
            success("Nota adicionada");
          }}
        >
          Salvar nota
        </Button>
      </Modal>
      <Modal
        open={modal === "opportunity"}
        title={editingOpportunity ? "Editar oportunidade" : "Nova oportunidade"}
        onClose={() => setModal(null)}
      >
        <OpportunityForm
          companyId={id}
          opportunity={editingOpportunity}
          companies={data.companies.filter((item) => !item.deletedAt)}
          pipelines={data.pipelines}
          stages={data.stages}
          onCancel={() => setModal(null)}
          onSubmit={async (form) => {
            editingOpportunity
              ? await actions.updateOpportunity.mutateAsync({
                  id: editingOpportunity.id,
                  data: form,
                })
              : await actions.createOpportunity.mutateAsync(form);
            setModal(null);
            setEditingOpportunity(undefined);
            success(
              editingOpportunity
                ? "Oportunidade atualizada"
                : "Oportunidade criada",
            );
          }}
        />
      </Modal>
      <OpportunityDetails
        businessMode={businessMode}
        opportunity={selected}
        company={company}
        contact={related.contacts.find(item=>item.isPrimary&&!item.deletedAt)??related.contacts.find(item=>!item.deletedAt)}
        pipeline={data.pipelines.find(
          (item) => item.id === selected?.pipelineId,
        )}
        stages={data.stages}
        activities={related.events.filter(
          (event) => event.opportunityId === selected?.id,
        )}
        nextTask={
          related.tasks
            .filter(
              (item) =>
                item.opportunityId === selected?.id &&
                item.status === "pending" &&
                item.type === "follow_up",
            )
            .sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0]
        }
        open={Boolean(selected)}
        onClose={() => setSelected(undefined)}
        onMove={(stageId) =>
          selected &&
          actions.moveOpportunity.mutate(
            { opportunityId: selected.id, stageId },
            { onSuccess: () => success("Etapa atualizada") },
          )
        }
        onEdit={() => {
          openOpportunityModal(selected);
          setSelected(undefined);
        }}
        onSaveValue={async (value) => {
          if (!selected) return;
          const updated = await actions.updateOpportunity.mutateAsync({
            id: selected.id,
            data: { value },
          });
          setSelected(updated);
          success("Valor da oportunidade atualizado");
        }}
        onDuplicate={() =>
          selected &&
          actions.duplicateOpportunity.mutate(selected.id, {
            onSuccess: () => success("Oportunidade duplicada"),
          })
        }
        onArchive={() =>
          selected &&
          actions.archiveOpportunity.mutate(selected.id, {
            onSuccess: () => {
              setSelected(undefined);
              success("Oportunidade arquivada");
            },
          })
        }
        onWon={() =>
          selected &&
          actions.markOpportunityWon.mutate(selected.id, {
            onSuccess: () => {
              setSelected(undefined);
              success("Negócio marcado como ganho");
            },
          })
        }
        onAddFollowUp={() => setModal("followup")}
        onEditContact={() => { const contact=related.contacts.find(item=>item.isPrimary&&!item.deletedAt)??related.contacts.find(item=>!item.deletedAt); if(contact){setEditingContact(contact);setModal("contact");} }}
        onSaveNote={async(text)=>{if(!selected)return;await actions.addNote.mutateAsync({companyId:id,text,opportunityId:selected.id});success("Observação adicionada")}}
        onCompleteNextTask={()=>{const task=related.tasks.filter(item=>item.opportunityId===selected?.id&&item.status==="pending").sort((a,b)=>a.dueAt.localeCompare(b.dueAt))[0];if(task)actions.completeTask.mutate(task.id,{onSuccess:()=>success("Próxima ação concluída")})}}
        onRescheduleNextTask={(dueAt)=>{const task=related.tasks.filter(item=>item.opportunityId===selected?.id&&item.status==="pending").sort((a,b)=>a.dueAt.localeCompare(b.dueAt))[0];if(task)actions.rescheduleTask.mutate({id:task.id,dueAt},{onSuccess:()=>success("Próxima ação reagendada")})}}
        onLost={(form) =>
          selected &&
          actions.markOpportunityLost.mutate(
            { id: selected.id, data: form },
            {
              onSuccess: () => {
                setSelected(undefined);
                success("Negócio marcado como perdido");
              },
            },
          )
        }
      />
      <ConfirmDialog
        open={deletingCompany}
        title={`Excluir empresa “${company.fantasyName}”?`}
        description="A empresa será arquivada junto com contatos, oportunidades e pendências. O histórico será preservado."
        confirmLabel="Excluir empresa"
        onCancel={() => setDeletingCompany(false)}
        onConfirm={() => {
          actions.deleteCompany.mutate(company.id, {
            onSuccess: () => {
              setDeletingCompany(false);
              notify({ title: "Empresa arquivada com segurança." });
              navigate("/crm");
            },
          });
        }}
      />
      <ConfirmDialog
        open={Boolean(deletingContact)}
        title={`Arquivar ${deletingContact?.name ?? "contato"}?`}
        onCancel={() => setDeletingContact(undefined)}
        onConfirm={() => {
          if (deletingContact)
            actions.deleteContact.mutate(deletingContact.id, {
              onSuccess: () => success("Contato arquivado"),
            });
          setDeletingContact(undefined);
        }}
      />
    </PageContainer>
  );
}
