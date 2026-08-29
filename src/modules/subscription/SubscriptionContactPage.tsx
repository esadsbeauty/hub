import { Card,CardContent } from "@/components/ui/card";
import { supportWhatsappUrl } from "@/config/contact";
import { PageContainer } from "@/shared/components/layout/page-container";
import { PageHeader } from "@/shared/components/layout/page-header";
import { useSubscriptionAccess } from "./hooks";
export function SubscriptionContactPage(){const access=useSubscriptionAccess();return <PageContainer><PageHeader title="Regularizar assinatura" description="Nesta fase, a regularização é confirmada manualmente pela equipe ESADS Beauty."/><Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Status atual</p><p className="mt-1 text-xl font-semibold">{access.data?.status==="past_due"?"Pagamento pendente":access.data?.status??"Carregando..."}</p><a className="mt-6 inline-flex min-h-12 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground" href={supportWhatsappUrl("Olá! Quero regularizar minha assinatura do ESADS Beauty.")} target="_blank" rel="noreferrer">Falar com atendimento</a></CardContent></Card></PageContainer>;}
