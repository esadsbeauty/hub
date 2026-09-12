import { describe,expect,test } from "bun:test";
import { readFileSync } from "node:fs";
const migration=readFileSync("supabase/migrations/202609160001_user_profile_avatars.sql","utf8");
const hooks=readFileSync("src/modules/profile/hooks.ts","utf8");
const panel=readFileSync("src/modules/profile/ProfilePanel.tsx","utf8");
const avatar=readFileSync("src/shared/components/data-display/user-avatar.tsx","utf8");
const topbar=readFileSync("src/shared/components/layout/topbar.tsx","utf8");
const sidebar=readFileSync("src/shared/components/layout/sidebar.tsx","utf8");
const brand=readFileSync("src/shared/components/brand/brand-logo.tsx","utf8");

describe("user-owned profile avatar",()=>{
 test("reuses profiles with a Storage path and constrained avatar bucket",()=>{expect(migration).toContain("profiles add column if not exists avatar_path");expect(migration).toContain("'avatars','avatars',true,5242880");for(const mime of ["image/jpeg","image/png","image/webp"])expect(migration).toContain(mime);expect(migration).not.toContain("organizations add column");});
 test("only the authenticated user can mutate their folder and profile",()=>{expect(migration.match(/storage\.foldername\(name\)\)\[1\]=auth\.uid\(\)::text/g)?.length).toBe(5);expect(migration).toContain("where p.id=auth.uid()");expect(migration).toContain("where id=actor");expect(migration).toContain("next_avatar_path!~('^'||actor::text");expect(migration).not.toMatch(/service_role|using\s*\(true\)/i);});
 test("upload, replacement and removal validate and update one user cache",()=>{expect(hooks).toContain('new Map([["image/jpeg","jpg"],["image/png","png"],["image/webp","webp"]])');expect(hooks).toContain("file.size>5*1024*1024");expect(hooks).toContain("upsert:true");expect(hooks).toContain("remove([previousPath])");expect(hooks).toContain("remove([path])");expect(hooks).toContain('["current-user-profile",id]');expect(hooks).not.toContain("organizationId");});
 test("profile UX supports photo, read-only email and mobile-friendly input",()=>{for(const label of ["Enviar foto","Trocar foto","Remover foto","Salvar alterações"])expect(panel).toContain(label);expect(panel).toContain('accept="image/jpeg,image/png,image/webp"');expect(panel).toContain("readOnly disabled");});
 test("reusable avatar renders image or initials in topbar and sidebar",()=>{expect(avatar).toContain("object-cover");expect(avatar).toContain("initials(name,email)");expect(topbar).toContain("<UserAvatar");expect(sidebar).toContain("<UserAvatar");});
 test("platform identity stays global while tenant and avatar remain independent",()=>{expect(brand).toContain('alt="ESADS BEAUTY CRM"');expect(sidebar).toContain('title="ESADS BEAUTY CRM"');expect(topbar).toContain("<TenantSwitcher/>");expect(hooks).not.toMatch(/logo|tenant/i);for(const source of [migration,panel,hooks])expect(source).not.toMatch(/organization.*logo|logo.*organization/i);});
});
