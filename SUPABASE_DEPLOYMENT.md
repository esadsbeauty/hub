# Supabase production rollout

## Migration inventory

The repository contains 14 ordered migrations. They must be applied as one history; never apply the first migration in isolation.

| Order | Migration | Scope and dependencies | Classification |
|---:|---|---|---|
| 1 | `202607290001_initial_crm.sql` | Creates organizations, profiles, companies, contacts, pipelines/stages, opportunities, activities, tasks and notes; adds tenant RLS, updated-at/activity triggers, ESADS Beauty and the default pipeline. | Foundational/current; organization-aware, not a `companies.user_id` model. |
| 2 | `202608110001_opportunity_stage_history.sql` | Adds structured loss fields and stage history; replaces the stage-change function/policy. Depends on CRM core. | Additive evolution. |
| 3 | `202608110002_crm_operational_alignment.sql` | Adds operational company/contact fields, contact/note/task/company activity functions and triggers, atomic company creation and lifecycle synchronization. | Additive evolution. |
| 4 | `202608110003_operational_execution.sql` | Normalizes task priority, renames `due_date` to `due_at`, adds meeting fields and task actions. | Data-preserving type/name migration; review existing task values in dry-run. |
| 5 | `202608110004_customer_success_foundation.sql` | Creates customer accounts, services, subscriptions, onboardings, steps, contracts and contract services with tenant RLS and activity triggers. | Additive domain. |
| 6 | `202608110005_financial_management.sql` | Creates accounts, categories, cost centers, recurrence, receivables/payables, transactions and allocations with tenant RLS and audit activity. | Additive domain. |
| 7 | `202608110006_marketing_attribution.sql` | Creates sources, campaigns, ad groups/ads, acquisitions, spend and connections; seeds only structural sources. | Additive domain. |
| 8 | `202608110007_marketing_attribution_hardening.sql` | Adds first/last-touch constraints and safe acquisition RPC. | Hardening. |
| 9 | `202608110008_governance_rbac_audit.sql` | Creates permissions, roles, role permissions, memberships and audit logs; seeds structural RBAC; replaces tenant resolution with active membership and hardens Finance/Marketing RLS. | Governance foundation. |
| 10 | `202608180001_real_auth_owner.sql` | Adds Owner, grants every permission, updates governance snapshot and protects Owner membership. | RBAC hardening. |
| 11 | `202608180002_user_management_bootstrap.sql` | Adds initial Owner and member invitation lifecycle RPCs. Superseded in part by orders 12–13. | Legacy API transition; required in sequence. |
| 12 | `202608190001_self_service_initial_owner.sql` | Removes the arbitrary-user Owner claim and introduces authenticated bootstrap status/claim using `auth.uid()`. | Security replacement. |
| 13 | `202608190002_harden_initial_owner_eligibility.sql` | Reserves bootstrap to the earliest Auth user, locks concurrent claims, backfills profile/membership and grants Owner permissions. | Current bootstrap implementation. |
| 14 | `202608190003_public_registration_access_requests.sql` | Adds controlled public registration, atomic first-Owner resolution, pending memberships and audited approval/rejection without exposing role or organization choices to the client. | Current registration lifecycle. |

There is no `seed.sql`: structural seeds are idempotent statements inside migrations. No commercial demo data is inserted. The checked-in history contains no migration whose final company security model is `auth.uid() = companies.user_id`; the foundational schema already uses `organization_id`, `created_by` and `owner_id`.

## Non-destructive remote procedure

1. Install and authenticate the official Supabase CLI outside the browser application.
2. Verify the intended project name, ref and host in the Supabase dashboard.
3. Run `supabase link --project-ref <confirmed-ref>` without committing `.temp` or credentials.
4. Run `supabase migration list --linked` and retain the output as deployment evidence.
5. Run `npm run db:audit`.
6. Run `npm run db:dry-run` and inspect every pending migration. The history intentionally replaces policies, triggers, constraints and one obsolete function; it contains no table/database drop, truncate, bulk delete or dropped column.
7. Only after the dry-run is reviewed, run `npm run db:push`.
8. Run `supabase migration list --linked` again and verify the schema/RLS through the SQL editor or a read-only database connection.

Never use `db reset`, `migration repair`, manual history insertion or remote truncation for this rollout.

## Required post-push verification

- `ESADS Beauty` / `esads-beauty` exists once, with one default pipeline and ten ordered stages.
- `owner`, the standard roles, permissions and role-permission mappings exist.
- The existing Auth user uses **Finalizar configuração**; `claim_initial_owner(text)` backfills its profile and active Owner membership atomically.
- `current_authorization()` returns the organization, `owner`, `active` and the complete permission list.
- RLS is enabled on every private business table and resolves tenant scope through an active `organization_members` row.
- The `invite-user` Edge Function is deployed with `APP_ORIGIN`; administrative keys remain only in its server environment.
- Vercel Production uses `VITE_APP_MODE=supabase`, a public/publishable key, and no `service_role` variable.
- Verify login, logout, refresh, CRM persistence, cross-device visibility and same-organization collaboration with real sessions before declaring rollout complete.
