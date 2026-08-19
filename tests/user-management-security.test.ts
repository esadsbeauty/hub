import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const lifecycleMigration = readFileSync("supabase/migrations/202608180002_user_management_bootstrap.sql", "utf8");
const bootstrapMigration = readFileSync("supabase/migrations/202608190002_harden_initial_owner_eligibility.sql", "utf8");
const registrationMigration = readFileSync("supabase/migrations/202608190003_public_registration_access_requests.sql", "utf8");
const ownerPage = readFileSync("src/modules/settings/InitialOwnerPage.tsx", "utf8");
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
    expect(bootstrapMigration).toContain("order by created_at,id limit 1");
    expect(bootstrapMigration).toContain("initial_owner_reserved_for_initial_auth_user");
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

  test("distingue schema ausente de um usuário realmente sem autorização", () => {
    expect(ownerPage).toContain("Configuração do banco pendente");
    expect(ownerPage).toContain("bootstrap.isError");
    expect(ownerPage).toContain("Acesso pendente");
  });
});

describe("cadastro público controlado", () => {
  test("decide Owner no banco com identidade autenticada e lock transacional", () => {
    expect(registrationMigration).toContain("current_user_id uuid:=auth.uid()");
    expect(registrationMigration).toContain("pg_advisory_xact_lock");
    expect(registrationMigration).toContain("order by created_at,id limit 1");
    expect(registrationMigration).toContain("r.slug='owner'");
    expect(registrationMigration).toContain("function public.complete_registration()");
  });
  test("cadastros posteriores ficam pending e sem tenant ativo", () => {
    expect(registrationMigration).toContain("'pending'");
    expect(registrationMigration).toContain("user_access_requested");
    expect(appState).toContain('value.status === "active" ? value.permissions : []');
  });
  test("aprovação rejeita Owner e exige users.manage", () => {
    expect(registrationMigration).toContain("approve_access_request");
    expect(registrationMigration).toContain("slug<>'owner'");
    expect(registrationMigration).toContain("has_permission('users.manage')");
    expect(registrationMigration).toContain("user_approved");
    expect(registrationMigration).toContain("user_rejected");
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
