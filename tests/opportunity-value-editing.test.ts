import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { formatOpportunityValueInput, parseOpportunityValueInput } from "../src/modules/crm/utils/opportunity-value";

const details = readFileSync("src/modules/crm/components/opportunity-details.tsx", "utf8");
const page = readFileSync("src/modules/crm/CrmPage.tsx", "utf8");
const repository = readFileSync("src/modules/crm/supabase-repository.ts", "utf8");

describe("opportunity proposal value", () => {
  test("formats and parses BRL input", () => {
    expect(formatOpportunityValueInput(1234.56)).toContain("1.234,56");
    expect(parseOpportunityValueInput("R$ 1.234,56")).toBe(1234.56);
    expect(parseOpportunityValueInput("")).toBe(0);
  });

  test("detail saves through the existing opportunity update flow", () => {
    expect(details).toContain("Valor da proposta");
    expect(details).toContain("props.onSaveValue(proposalValue)");
    expect(page).toContain("actions.updateOpportunity.mutateAsync");
    expect(page).toContain("setSelected(updated)");
    expect(repository).toContain("value: input.value");
  });
});
