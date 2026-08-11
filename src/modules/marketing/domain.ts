import type { CrmData, Opportunity } from "@/modules/crm/types";
import type { CustomerData } from "@/modules/customers/types";
import type { AttributionModel, LeadAcquisition, MarketingData } from "./types";

export const ratio = (numerator: number, denominator: number) => denominator > 0 ? numerator / denominator : null;

export function attributionForCompany(records: LeadAcquisition[], companyId: string, model: AttributionModel, before?: string) {
  const eligible = records
    .filter((item) => item.companyId === companyId && (!before || item.capturedAt <= before))
    .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
  return model === "first_touch" ? eligible[0] : eligible.at(-1);
}

export function acquisitionForOpportunity(records: LeadAcquisition[], opportunity: Opportunity, model: AttributionModel) {
  const direct = records.filter((item) => item.opportunityId === opportunity.id).sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
  if (direct.length) return model === "first_touch" ? direct[0] : direct.at(-1);
  return attributionForCompany(records, opportunity.companyId, model, opportunity.createdAt);
}

export function marketingMetrics(marketing: MarketingData, crm: CrmData, customers: CustomerData | undefined, model: AttributionModel, from: string, to: string, campaignId?: string) {
  const spendRows = marketing.spend.filter((item) => item.date >= from && item.date <= to && (!campaignId || item.campaignId === campaignId));
  const spend = spendRows.reduce((sum, item) => sum + item.amount, 0);

  // A lead is a distinct CRM company with an acquisition captured in the period.
  // This intentionally does not depend on company.createdAt: returning companies may create new touchpoints.
  const periodTouches = marketing.acquisitions.filter((item) => item.capturedAt.slice(0, 10) >= from && item.capturedAt.slice(0, 10) <= to);
  const attributedCompanies = new Set<string>();
  for (const companyId of new Set(periodTouches.map((item) => item.companyId))) {
    const conversionBoundary = `${to}T23:59:59.999Z`;
    const acquisition = attributionForCompany(marketing.acquisitions, companyId, model, conversionBoundary);
    if (acquisition && (!campaignId || acquisition.campaignId === campaignId)) attributedCompanies.add(companyId);
  }

  const opportunities = crm.opportunities
    .filter((item) => item.createdAt.slice(0, 10) >= from && item.createdAt.slice(0, 10) <= to)
    .filter((item) => {
      const acquisition = acquisitionForOpportunity(marketing.acquisitions, item, model);
      return acquisition && (!campaignId || acquisition.campaignId === campaignId);
    });
  const won = opportunities.filter((item) => item.status === "won");
  const lost = opportunities.filter((item) => item.status === "lost");
  const pipeline = opportunities.reduce((sum, item) => sum + item.value, 0);
  const wonValue = won.reduce((sum, item) => sum + item.value, 0);
  const customerCompanyIds = new Set((customers?.accounts ?? []).filter((item) => item.clientSince.slice(0, 10) >= from && item.clientSince.slice(0, 10) <= to).map((item) => item.companyId));
  const clients = [...attributedCompanies].filter((id) => customerCompanyIds.has(id)).length;
  const impressions = spendRows.reduce((sum, item) => sum + item.impressions, 0);
  const clicks = spendRows.reduce((sum, item) => sum + item.clicks, 0);

  return {
    spend, leads: attributedCompanies.size, opportunities: opportunities.length, wins: won.length, clients, pipeline, wonValue, impressions, clicks,
    cpl: ratio(spend, attributedCompanies.size), cpo: ratio(spend, opportunities.length), mediaCac: ratio(spend, clients), commercialRoas: ratio(wonValue, spend),
    winRate: ratio(won.length, won.length + lost.length), averageTicket: ratio(wonValue, won.length), cpc: ratio(spend, clicks), cpm: impressions > 0 ? (spend / impressions) * 1000 : null,
    ctr: ratio(clicks, impressions), clickToLead: ratio(attributedCompanies.size, clicks), leadToOpportunity: ratio(opportunities.length, attributedCompanies.size), opportunityToWin: ratio(won.length, opportunities.length),
  };
}
