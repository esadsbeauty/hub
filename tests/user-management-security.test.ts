import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/202608180002_user_management_bootstrap.sql", "utf8");
const edge = readFileSync("supabase/functions/invite-user/index.ts", "utf8");
const appState = readFileSync("src/shared/state/app-state.tsx", "utf8");

describe("bootstrap seguro do primeiro Owner", () => {
  test("usa lock transacional e exige estado inicial sem membro ativo ou Owner", () => {
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("status='active'");
    expect(migration).toContain("r.slug='owner'");
    expect(migration).toContain("initial_owner_already_claimed");
  });

  test("RPC de claim não é exposta ao navegador", () => {
    expect(migration).toContain("revoke all on function public.claim_initial_owner(uuid,text) from public,anon,authenticated");
    expect(migration).toContain("grant execute on function public.claim_initial_owner(uuid,text) to service_role");
    expect(edge).toContain('Deno.env.get("INITIAL_OWNER_EMAIL")');
  });
});

describe("gestão segura de funcionários", () => {
  test("fluxo comum impede Owner e deriva organização pelo ator", () => {
    expect(migration).toContain("slug<>'owner'");
    expect(migration).toContain("actor_member.organization_id");
    expect(edge).not.toContain("payload.organizationId");
    expect(edge).not.toContain("payload.invitedBy");
  });

  test("convite, reenvio, cancelamento e ativação são auditados", () => {
    for (const action of ["user_invited", "invite_resent", "invite_cancelled", "user_activated", "user_suspended", "user_reactivated", "user_role_changed"]) {
      expect(migration).toContain(action);
    }
  });

  test("membership suspensa é revalidada mesmo com sessão existente", () => {
    expect(appState).toContain("30_000");
    expect(appState).toContain('visibilityState === "visible"');
    expect(migration).toContain("m.status='active'");
  });

  test("convite aponta para criação de senha e não cria senha administrativa", () => {
    expect(edge).toContain("/aceitar-convite");
    expect(edge).toContain("inviteUserByEmail");
    expect(edge).not.toContain("password:");
  });
});
