import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/202609110001_aesthetic_clinic_default_pipeline.sql", "utf8");
const desktop = readFileSync("src/modules/crm/CrmPage.tsx", "utf8");
const mobile = readFileSync("src/modules/crm/components/mobile-crm-view.tsx", "utf8");

describe("aesthetic clinic default pipeline", () => {
  test("changes only the bootstrap template for future organizations", () => {
    expect(migration).toContain("create or replace function public.create_default_pipeline");
    expect(migration).not.toMatch(/update public\.(pipelines|pipeline_stages|opportunities)/i);
    expect(migration).not.toMatch(/delete\s+from/i);
  });

  test("defines the operational stages in order", () => {
    const stages = ["Novo Lead","Primeiro Contato","Qualificação","Avaliação Agendada","Avaliação Realizada","Proposta Apresentada","Em Negociação","Procedimento Agendado","Cliente Fechado","Não Compareceu","Perdido"];
    stages.forEach((stage, position) => {
      expect(migration).toContain(`'${stage}'`);
      expect(migration.indexOf(`'${stage}'`)).toBeGreaterThan(position ? migration.indexOf(`'${stages[position - 1]}'`) : 0);
    });
  });

  test("keeps no-show open and preserves explicit won/lost semantics", () => {
    expect(migration).toContain("'Cliente Fechado','cliente_fechado',8,100,true,false");
    expect(migration).toContain("'Não Compareceu','nao_compareceu',9,35,false,false");
    expect(migration).toContain("'Perdido','perdido',10,0,false,true");
  });

  test("opportunity cards prioritize commercial context", () => {
    for (const source of [desktop, mobile]) {
      expect(source).toContain("Interesse:");
      expect(source).toContain("currency.format(item.value)");
      expect(source).toContain("Próxima ação:");
      expect(source).toContain("formatDateTime(task.dueAt)");
      expect(source).toContain("TemperatureBadge");
      expect(source).toContain("PriorityBadge");
    }
  });
});
