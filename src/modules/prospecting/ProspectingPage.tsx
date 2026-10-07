import { ListPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageContainer } from "@/shared/components/layout/page-container";
import { PageHeader } from "@/shared/components/layout/page-header";

export function ProspectingPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Prospecção"
        description="Organize listas e acompanhe novas oportunidades comerciais."
        actions={<Button disabled title="Disponível em breve"><ListPlus size={17} /> Nova lista</Button>}
      />
      <Card>
        <CardContent className="grid min-h-72 place-items-center px-6 py-12 text-center">
          <div>
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-champagne-soft text-champagne-dark"><ListPlus size={23} /></span>
            <h2 className="mt-4 text-xl font-semibold tracking-[-.03em]">Nenhuma lista criada ainda</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">Quando você criar uma lista de prospecção, ela aparecerá aqui.</p>
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
