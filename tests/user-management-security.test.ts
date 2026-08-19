import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const lifecycleMigration = readFileSync("supabase/migrations/202608180002_user_management_bootstrap.sql", "utf8");
const bootstrapMigration = readFileSync("supabase/migrations/202608190001_self_service_initial_owner.sql", "utf8");
const edge = readFileSync("supabase/functions/invite-user/index.ts", "utf8");
const appState = readFileSync("src/shared/state/app-state.tsx", "utf8");

describe("bootstrap seguro do primeiro Owner", () => {
  test("deriva o usuário autenticado e repara profile e membership existentes", () => {
    expect(bootstrapMigration).toContain("current_user_id uuid:=auth.uid()");
    expect(bootstrapMigration).toContain("insert into public.profiles");
    expect(bootstrapMigration).toContain("on conflict(id) do update");
    expect(bootstrapMigration).toContain("insert into public.organization_members");
    expect(bootstrapMigration).toContain("on conflict(organization_id,user_id) do update");
  });

  test("usa lock transacional e fecha o bootstrap depois do primeiro Owner", () => {
    expect(bootstrapMigration).toContain("pg_advisory_xact_lock");
    expect(bootstrapMigration).toContain("initial_owner_already_claimed");
    expect(bootstrapMigration).toContain("auth_user_count<>1");
    expect(bootstrapMigration).toContain("r.slug='owner'");
  });

  test("permite o claim somente a usuário autenticado e não recebe user id do frontend", () => {
    expect(bootstrapMigration).toContain("grant execute on function public.claim_initial_owner(text) to authenticated");
    expect(bootstrapMigration).toContain("revoke all on function public.claim_initial_owner(text) from public,anon");
    expect(bootstrapMigration).not.toContain("claim_initial_owner(target_user_id");
    expect(edge).not.toContain("INITIAL_OWNER_EMAIL");
  });

  test("Owner recebe todo o catálogo de permissões", () => {
    expect(bootstrapMigration).toContain("insert into public.role_permissions");
    expect(bootstrapMigration).toContain("select owner_role_id,id from public.permissions");
  });
});

describe("gestão segura de funcionários", () => {
  test("fluxo comum impede Owner e deriva organização pelo ator", () => {
    expect(lifecycleMigration).toContain("slug<>'owner'");
    expect(lifecycleMigration).toContain("actor_member.organization_id");
    expect(edge).not.toContain("payload.organizationId");
    expect(edge).not.toContain("payload.invitedBy");
  });

  test("convite, reenvio, cancelamento e ativação são auditados", () => {
    for (const action of ["user_invited", "invite_resent", "invite_cancelled", "user_activated", "user_suspended", "user_reactivated", "user_role_changed"]) {
      expect(lifecycleMigration).toContain(action);
    }
    expect(bootstrapMigration).toContain("initial_owner_claimed");
  });

  test("membership suspensa é revalidada mesmo com sessão existente", () => {
    expect(appState).toContain("30_000");
    expect(appState).toContain('visibilityState === "visible"');
    expect(lifecycleMigration).toContain("m.status='active'");
  });

  test("convite aponta para criação de senha e não cria senha administrativa", () => {
    expect(edge).toContain("/aceitar-convite");
    expect(edge).toContain("inviteUserByEmail");
    expect(edge).not.toContain("password:");
  });
});
