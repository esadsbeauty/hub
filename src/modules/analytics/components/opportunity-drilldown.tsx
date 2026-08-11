import { useNavigate } from "react-router-dom";
import { Modal } from "@/shared/components/overlays/modal";
import type { Company, Opportunity } from "@/modules/crm/types";
import { currency, formatDateTime } from "@/modules/crm/utils/formatters";

export type Drilldown = { title: string; opportunities: Opportunity[] };
export function OpportunityDrilldown({
  drilldown,
  companies,
  onClose,
}: {
  drilldown?: Drilldown;
  companies: Company[];
  onClose: () => void;
}) {
  const navigate = useNavigate();
  return (
    <Modal
      open={Boolean(drilldown)}
      title={drilldown?.title ?? "Detalhamento"}
      onClose={onClose}
    >
      <div className="space-y-2">
        {drilldown?.opportunities.map((item) => {
          const company = companies.find(
            (value) => value.id === item.companyId,
          );
          return (
            <button
              key={item.id}
              className="grid w-full gap-2 rounded-xl border p-4 text-left hover:bg-muted md:grid-cols-[1fr_1fr_auto]"
              onClick={() => navigate(`/crm/companies/${item.companyId}`)}
            >
              <div>
                <b>{item.title}</b>
                <p className="text-xs text-muted-foreground">
                  {company?.fantasyName ?? "Empresa"}
                </p>
              </div>
              <div className="text-sm">
                <p>{item.owner ?? "Sem responsável"}</p>
                <p className="text-xs text-muted-foreground">
                  Criada em {formatDateTime(item.createdAt)}
                </p>
              </div>
              <b>{currency.format(item.value)}</b>
            </button>
          );
        })}
        {!drilldown?.opportunities.length && (
          <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Nenhum registro compõe este indicador.
          </p>
        )}
      </div>
    </Modal>
  );
}
