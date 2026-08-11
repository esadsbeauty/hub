import { describe, expect, test } from "bun:test";
import {
  calculateAnalytics,
  resolvePeriod,
} from "../src/modules/analytics/analytics-service";
import type { AnalyticsFilters } from "../src/modules/analytics/types";
import type { CrmData, Opportunity } from "../src/modules/crm/types";

const filters: AnalyticsFilters = {
  period: "custom",
  from: "2026-08-01",
  to: "2026-08-31",
};

function opportunity(
  values: Pick<Opportunity, "id" | "status" | "value"> & Partial<Opportunity>,
): Opportunity {
  return {
    organizationId: "org",
    companyId: "company",
    pipelineId: "pipeline",
    stageId: "stage",
    title: values.id,
    probability: 50,
    createdBy: "user",
    createdAt: "2026-08-01T12:00:00Z",
    updatedAt: "2026-08-01T12:00:00Z",
    stageEnteredAt: "2026-08-01T12:00:00Z",
    ...values,
  };
}

function fixture(opportunities: Opportunity[]): CrmData {
  return {
    organization: {
      id: "org",
      name: "ESADS Beauty",
      slug: "esads",
      timezone: "America/Sao_Paulo",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    },
    profile: {
      id: "user",
      organizationId: "org",
      name: "Admin",
      email: "admin@example.com",
      role: "admin",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    },
    profiles: [],
    companies: [],
    contacts: [],
    pipelines: [],
    stages: [
      {
        id: "stage",
        pipelineId: "pipeline",
        name: "Em conversa",
        slug: "in_conversation",
        position: 1,
        probability: 40,
        isWon: false,
        isLost: false,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ],
    opportunities,
    stageHistory: [],
    events: [],
    tasks: [],
    activities: [],
    files: [],
    notes: [],
  };
}

describe("analytics service", () => {
  test("calcula pipeline, forecast, vendas, perdas e métricas de fechamento", () => {
    const data = fixture([
      opportunity({
        id: "open",
        status: "open",
        value: 10_000,
        probability: 30,
        expectedCloseDate: "2026-08-20",
      }),
      opportunity({
        id: "won",
        status: "won",
        value: 4_000,
        wonAt: "2026-08-11T12:00:00Z",
        createdAt: "2026-08-01T12:00:00Z",
      }),
      opportunity({
        id: "lost",
        status: "lost",
        value: 1_000,
        lostAt: "2026-08-12T12:00:00Z",
        lostReason: "price",
      }),
    ]);
    const result = calculateAnalytics(data, filters);
    expect(result.pipeline.value).toBe(10_000);
    expect(result.weighted.value).toBe(3_000);
    expect(result.forecast.value).toBe(10_000);
    expect(result.forecast.weighted).toBe(3_000);
    expect(result.won.value).toBe(4_000);
    expect(result.lost.value).toBe(1_000);
    expect(result.winRate).toBe(0.5);
    expect(result.averageTicket).toBe(4_000);
    expect(result.averageCycleDays).toBe(10);
  });

  test("usa períodos equivalentes e mantém zero como resultado válido", () => {
    const data = fixture([
      opportunity({
        id: "previous-won",
        status: "won",
        value: 2_000,
        wonAt: "2026-07-15T12:00:00Z",
      }),
    ]);
    const result = calculateAnalytics(data, filters);
    expect(result.won.count).toBe(0);
    expect(result.winRate).toBeUndefined();
    expect(result.averageTicket).toBeUndefined();
    expect(result.previousWonValue).toBe(2_000);
  });

  test("aplica o timezone da organização aos limites diários", () => {
    const data = fixture([
      opportunity({
        id: "utc-boundary",
        status: "won",
        value: 900,
        wonAt: "2026-08-01T02:00:00Z",
      }),
    ]);
    const result = calculateAnalytics(data, filters);
    expect(result.won.count).toBe(0);
  });

  test("compara mês com o mês-calendário anterior", () => {
    const period = resolvePeriod(
      "month",
      "America/Sao_Paulo",
      undefined,
      undefined,
      new Date("2026-03-15T12:00:00Z"),
    );
    expect(period.from).toBe("2026-03-01");
    expect(period.to).toBe("2026-03-31");
    expect(period.previousFrom).toBe("2026-02-01");
    expect(period.previousTo).toBe("2026-02-28");
  });
});
