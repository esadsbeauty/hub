import { useQuery } from "@tanstack/react-query";
import { ClipboardCheck, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/shared/components/feedback/states";
import { PageContainer } from "@/shared/components/layout/page-container";
import { PageHeader } from "@/shared/components/layout/page-header";
import { listDiagnosticSubmissions } from "../admin-repository";
import { categoryContent } from "../content";

const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export function DiagnosticAdminPage() {
  const query = useQuery({ queryKey: ["diagnostics", "admin"], queryFn: listDiagnosticSubmissions });
  return <PageContainer>
    <PageHeader eyebrow="Marketing" title="Diagnósticos" description="Leads e resultados recebidos pelo Diagnóstico do Negócio." actions={<Link className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border px-4 font-semibold" to="/diagnostico" target="_blank">Abrir diagnóstico público <ExternalLink size={18}/></Link>}/>
    {query.isLoading && <div className="grid gap-4"><Skeleton className="h-36"/><Skeleton className="h-36"/></div>}
    {query.isError && <Card><CardContent><p role="alert">Não foi possível carregar os diagnósticos. Tente atualizar a página.</p></CardContent></Card>}
    {query.data?.length === 0 && <Card><CardContent className="py-12 text-center"><ClipboardCheck className="mx-auto text-muted-foreground" size={34}/><h2 className="mt-4 text-xl font-semibold">Nenhum diagnóstico recebido</h2><p className="mt-2 text-muted-foreground">Os novos resultados aparecerão aqui automaticamente.</p></CardContent></Card>}
    <div className="grid gap-4">{query.data?.map((item) => <Card key={item.id}><CardContent className="grid gap-5 p-5 md:grid-cols-[1.4fr_.7fr_1fr_auto] md:items-center">
      <div><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-semibold">{item.businessName}</h2><Badge>{item.totalScore}/100</Badge></div><p className="mt-1 text-base text-muted-foreground">{item.name} · {item.whatsapp}</p><p className="text-sm text-muted-foreground">{item.email} · @{item.instagram}</p></div>
      <div><p className="text-sm text-muted-foreground">Resultado</p><b>{item.resultLevel}</b></div>
      <div><p className="text-sm text-muted-foreground">Principal atenção</p><b>{categoryContent[item.primaryBottleneck as keyof typeof categoryContent]?.label ?? item.primaryBottleneck}</b><p className="mt-1 text-sm text-muted-foreground">{item.primaryNeed}</p></div>
      <time className="text-sm text-muted-foreground" dateTime={item.completedAt}>{date.format(new Date(item.completedAt))}</time>
    </CardContent></Card>)}</div>
  </PageContainer>;
}
