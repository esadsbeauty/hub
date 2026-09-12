import { useEffect, useState } from "react";
import { Check, ChevronRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageContainer } from "@/shared/components/layout/page-container";
import { PageHeader } from "@/shared/components/layout/page-header";
import { useOnboarding, useOnboardingActions } from "./hooks";
import { onboardingProgress, type OnboardingSection } from "./types";

export function OnboardingPage() {
  const onboarding = useOnboarding(); const actions = useOnboardingActions(); const navigate = useNavigate();
  const [active, setActive] = useState<OnboardingSection | "pipeline" | "lead">("company"); const [error, setError] = useState("");
  useEffect(() => { if (onboarding.data && !onboarding.data.state.introSeenAt) actions.complete.mutate("intro_seen"); }, [onboarding.data?.state.introSeenAt]);
  if (!onboarding.data) return <PageContainer><p className="text-muted-foreground">{onboarding.isError ? "Não foi possível carregar o onboarding." : "Preparando sua conta..."}</p></PageContainer>;
  const data = onboarding.data; const progress = onboardingProgress(data.state);
  const save = async (section: OnboardingSection, values: Record<string, string>) => { setError(""); try { await actions.update.mutateAsync({ section, data: values }); } catch (reason) { setError((reason as Error).message); } };
  const steps = [
    { key: "company" as const, label: "Dados da empresa", done: data.state.companyProfileCompleted },
    { key: "owner" as const, label: "Dados do responsável", done: data.state.ownerProfileCompleted },
    { key: "whatsapp" as const, label: "WhatsApp da empresa", done: data.state.whatsappCompleted },
    { key: "pipeline" as const, label: "Conhecer o pipeline", done: data.state.pipelineIntroCompleted },
    { key: "lead" as const, label: "Criar o primeiro lead", done: data.state.firstLeadCompleted },
  ];
  return <PageContainer>
    <PageHeader eyebrow="Primeiros passos" title="Configure sua conta" description="Avance no seu ritmo. Você pode voltar a este checklist pelo Dashboard." actions={<Button variant="ghost" onClick={() => navigate("/")}>Fazer depois</Button>}/>
    <Card><CardContent className="pt-6"><div className="flex items-end justify-between"><div><b>{progress.completed} de {progress.total} concluídos</b><p className="text-sm text-muted-foreground">Sua operação está {progress.percentage}% configurada.</p></div><strong className="text-2xl">{progress.percentage}%</strong></div><div aria-label={`${progress.percentage}% concluído`} className="mt-4 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress.percentage}%` }}/></div></CardContent></Card>
    <div className="grid gap-5 lg:grid-cols-[.65fr_1.35fr]">
      <Card><CardContent className="space-y-2 pt-6">{steps.map((step) => <button key={step.key} onClick={() => setActive(step.key)} className={`flex min-h-14 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold ${active === step.key ? "bg-champagne-soft" : "hover:bg-muted"}`}><span className={`grid h-7 w-7 place-items-center rounded-full ${step.done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{step.done ? <Check size={15}/> : steps.indexOf(step)+1}</span><span className="flex-1">{step.label}</span><ChevronRight size={16}/></button>)}</CardContent></Card>
      <Card><CardHeader><CardTitle>{steps.find((step) => step.key === active)?.label}</CardTitle></CardHeader><CardContent>{active === "company" && <CompanyStep data={data.organization} saving={actions.update.isPending} save={(values) => save("company", values)}/>} {active === "owner" && <OwnerStep data={data.owner} saving={actions.update.isPending} save={(values) => save("owner", values)}/>} {active === "whatsapp" && <WhatsappStep value={data.organization.whatsapp ?? ""} saving={actions.update.isPending} save={(value) => save("whatsapp", { whatsapp: value })}/>} {active === "pipeline" && <div><p className="text-muted-foreground">Este é o seu funil comercial. Cada lead avança por estas etapas até o fechamento.</p><div className="mt-5 flex flex-wrap gap-2">{data.pipeline.stages.map((stage) => <Badge key={stage.id}>{stage.name}</Badge>)}</div><div className="mt-6 flex flex-wrap gap-2"><Button disabled={actions.complete.isPending || data.state.pipelineIntroCompleted} onClick={() => actions.complete.mutate("pipeline_intro")}>{data.state.pipelineIntroCompleted ? "Pipeline conhecido" : "Entendi meu pipeline"}</Button><Button variant="outline" onClick={() => navigate("/crm")}>Ver meu CRM</Button></div></div>} {active === "lead" && <div><p className="text-muted-foreground">Vamos cadastrar seu primeiro lead usando o mesmo fluxo seguro do CRM?</p>{data.state.firstLeadCompleted ? <p className="mt-5 font-semibold text-emerald-700">Seu primeiro lead já está no CRM.</p> : <Button className="mt-5" onClick={() => navigate("/crm?new=company&quick=1&onboarding=1")}>Cadastrar primeiro lead</Button>}</div>} {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}</CardContent></Card>
    </div>
    {data.state.completedAt && <Card className="border border-emerald-200 bg-emerald-50"><CardContent className="pt-6"><h2 className="text-lg font-semibold">Tudo pronto!</h2><p className="mt-1 text-sm text-emerald-900">Sua conta está configurada para começar a organizar seus leads.</p><Link className="mt-4 inline-flex font-semibold" to="/">Ir para o Dashboard</Link></CardContent></Card>}
  </PageContainer>;
}

function CompanyStep({ data, saving, save }: { data: { name: string; city?: string; state?: string; instagram?: string }; saving: boolean; save: (data: Record<string,string>) => void }) { const [form,setForm]=useState({name:data.name,city:data.city??"",state:data.state??"",instagram:data.instagram??""});return <StepForm saving={saving} submit={()=>save(form)}><Field label="Nome da empresa"><Input required value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})}/></Field><Field label="Cidade"><Input value={form.city} onChange={(e)=>setForm({...form,city:e.target.value})}/></Field><Field label="Estado"><Input maxLength={2} value={form.state} onChange={(e)=>setForm({...form,state:e.target.value.toUpperCase()})}/></Field><Field label="Instagram (opcional)"><Input value={form.instagram} onChange={(e)=>setForm({...form,instagram:e.target.value})}/></Field></StepForm>; }
function OwnerStep({ data, saving, save }: { data: { name:string;email:string;whatsapp?:string };saving:boolean;save:(data:Record<string,string>)=>void }) { const[form,setForm]=useState({name:data.name,whatsapp:data.whatsapp??""});return <StepForm saving={saving} submit={()=>save(form)}><Field label="Nome"><Input required value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})}/></Field><Field label="E-mail"><Input readOnly value={data.email}/></Field><Field label="WhatsApp"><Input value={form.whatsapp} onChange={(e)=>setForm({...form,whatsapp:e.target.value})}/></Field></StepForm>; }
function WhatsappStep({value,saving,save}:{value:string;saving:boolean;save:(value:string)=>void}){const[input,setInput]=useState(value);return <StepForm saving={saving} submit={()=>save(input)}><Field label="WhatsApp da empresa"><Input required type="tel" value={input} onChange={(e)=>setInput(e.target.value)}/></Field></StepForm>;}
function StepForm({children,saving,submit}:{children:React.ReactNode;saving:boolean;submit:()=>void}){return <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e)=>{e.preventDefault();submit();}}>{children}<div className="sm:col-span-2"><Button disabled={saving}>{saving?"Salvando...":"Salvar e concluir etapa"}</Button></div></form>;}
function Field({label,children}:{label:string;children:React.ReactNode}){return <div className="space-y-2"><Label>{label}</Label>{children}</div>;}
