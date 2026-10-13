import { useQuery } from "@tanstack/react-query";
import { ClipboardCheck, Download, ExternalLink } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/shared/components/feedback/states";
import { PageContainer } from "@/shared/components/layout/page-container";
import { PageHeader } from "@/shared/components/layout/page-header";

import {
  listDiagnosticSubmissions,
  type DiagnosticAdminRow,
} from "../admin-repository";
import { categoryContent } from "../content";
import { diagnosticQuestions } from "../questions";
import type { DiagnosticSubmission } from "../types";

const date = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

function toSubmission(item: DiagnosticAdminRow): DiagnosticSubmission {
  const ordered = Object.entries(item.categoryScores).sort(
    ([, a], [, b]) => a - b,
  );

  const recommendations = ordered
    .slice(0, 3)
    .map(
      ([key]) =>
        categoryContent[key as keyof typeof categoryContent].recommendation,
    );

  return {
    token: item.token,
    lead: {
      name: item.name,
      whatsapp: item.whatsapp,
      instagram: item.instagram,
    },
    answers: item.answers,
    result: {
      totalScore: item.totalScore,
      level: item.resultLevel,
      businessStage: item.businessStage,
      categoryScores: item.categoryScores,
      primaryBottleneck: item.primaryBottleneck,
      strongestArea: item.strongestArea,
      primaryNeed: item.primaryNeed,
      recommendations,
    },
    createdAt: item.createdAt,
  };
}

export function DiagnosticAdminPage() {
  const query = useQuery({
    queryKey: ["diagnostics", "admin"],
    queryFn: listDiagnosticSubmissions,
  });

  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState("");

  const download = async (item: DiagnosticAdminRow) => {
    setDownloadError("");
    setDownloadingId(item.id);

    try {
      const { downloadDiagnosticPdf } = await import(
        "../pdf/generate-diagnostic-pdf"
      );

      downloadDiagnosticPdf(toSubmission(item));
    } catch (error) {
      console.error(error);
      setDownloadError("Não foi possível gerar o diagnóstico.");
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Marketing"
        title="Diagnósticos"
        description="Todas as análises concluídas, com ou sem cadastro ou contato pelo WhatsApp."
        actions={
          <Link
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border px-4 font-semibold"
            to="/diagnostico"
            target="_blank"
          >
            Abrir diagnóstico público
            <ExternalLink size={18} />
          </Link>
        }
      />

      {query.isLoading && (
        <div className="grid gap-4">
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </div>
      )}

      {query.isError && (
        <Card>
          <CardContent>
            <p role="alert">
              Não foi possível carregar os diagnósticos. Tente atualizar a
              página.
            </p>
          </CardContent>
        </Card>
      )}

      {downloadError && (
        <Card>
          <CardContent className="py-4">
            <p role="alert" className="text-danger">
              {downloadError}
            </p>
          </CardContent>
        </Card>
      )}

      {query.data?.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <ClipboardCheck
              className="mx-auto text-muted-foreground"
              size={34}
            />
            <h2 className="mt-4 text-xl font-semibold">
              Nenhum diagnóstico recebido
            </h2>
            <p className="mt-2 text-muted-foreground">
              Os novos resultados aparecerão aqui automaticamente.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {query.data?.map((item) => (
          <Card key={item.id}>
            <CardContent className="grid gap-5 p-5 md:grid-cols-[1.4fr_.7fr_1fr_auto] md:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-semibold">
                    {item.businessName}
                  </h2>
                  <Badge>{item.totalScore}/100</Badge>
                </div>

                <p className="mt-1 text-base text-muted-foreground">
                  {item.whatsapp ? `${item.name} · ${item.whatsapp}` : "Participante sem identificação"}
                </p>

                <p className="text-sm text-muted-foreground">
                  {item.email ? `${item.email} · ` : ""}
                  {item.instagram ? `@${item.instagram}` : "Respostas salvas mesmo sem formulário"}
                </p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Resultado</p>
                <b>{item.resultLevel}</b>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">
                  Principal atenção
                </p>

                <b>
                  {categoryContent[item.primaryBottleneck]?.label ??
                    item.primaryBottleneck}
                </b>

                <p className="mt-1 text-sm text-muted-foreground">
                  {item.primaryNeed}
                </p>
              </div>

              <div className="flex flex-col gap-3 md:items-end">
                <time
                  className="text-sm text-muted-foreground"
                  dateTime={item.completedAt}
                >
                  {date.format(new Date(item.completedAt))}
                </time>

                <details className="w-full md:text-right"><summary className="cursor-pointer text-sm font-semibold">Ver respostas</summary><div className="mt-2 min-w-64 space-y-2 rounded-xl border bg-muted/30 p-3 text-left">{diagnosticQuestions.map(question=><p key={question.key} className="text-xs"><strong>{question.title}</strong><span className="mt-1 block text-muted-foreground">{question.options.find(option=>option.key===item.answers[question.key])?.label ?? "Não informado"}</span></p>)}</div></details>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  disabled={downloadingId === item.id}
                  onClick={() => void download(item)}
                >
                  <Download size={17} />
                  {downloadingId === item.id
                    ? "Preparando..."
                    : "Baixar diagnóstico"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </PageContainer>
  );
}