import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const script = "scripts/validate-deployment-env.mjs";
const run = (env: Record<string, string>) => spawnSync(process.execPath, [script], {
  env: { PATH: process.env.PATH ?? "", ...env },
  encoding: "utf8",
});

describe("configuração de deployment", () => {
  test("bloqueia build Vercel sem variáveis obrigatórias", () => {
    const result = run({ VERCEL: "1", VERCEL_ENV: "preview" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("VITE_SUPABASE_URL");
    expect(result.stderr).toContain("VITE_SITE_URL");
    expect(result.stdout).toContain('"hasSiteUrl":false');
    expect(result.stdout).toContain('"hasSupabaseUrl":false');
    expect(result.stdout).toContain('"hasSupabaseAnonKey":false');
    expect(result.stdout).toContain('"vercelEnv":"preview"');
  });

  test("bloqueia modo local também em Preview", () => {
    const result = run({ VERCEL: "1", VERCEL_ENV: "preview", VITE_APP_MODE: "local" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Preview e Production devem usar VITE_APP_MODE=supabase");
  });

  test("bloqueia modo local em Production", () => {
    const result = run({ VERCEL: "1", VERCEL_ENV: "production", VITE_APP_MODE: "local" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Preview e Production devem usar VITE_APP_MODE=supabase");
  });

  test("aceita URL HTTPS e chave pública sem imprimir valores", () => {
    const result = run({
      VERCEL: "1",
      VERCEL_ENV: "preview",
      VITE_SITE_URL: "https://esadsbeauty.vercel.app",
      VITE_SUPABASE_URL: "https://project.supabase.co",
      VITE_SUPABASE_ANON_KEY: "sb_publishable_example",
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('"hasSupabaseUrl":true');
    expect(result.stdout).toContain('"hasSiteUrl":true');
    expect(result.stdout).toContain('"hasSupabaseAnonKey":true');
    expect(result.stdout).toContain('"vercelEnv":"preview"');
    expect(result.stdout + result.stderr).not.toContain("project.supabase.co");
    expect(result.stdout + result.stderr).not.toContain("sb_publishable_example");
  });

  test("rejeita JWT service_role mesmo que possua formato eyJ", () => {
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url");
    const secretKey = `${header}.${payload}.signature`;
    const result = run({
      VERCEL: "1",
      VERCEL_ENV: "preview",
      VITE_SITE_URL: "https://esadsbeauty.vercel.app",
      VITE_SUPABASE_URL: "https://project.supabase.co",
      VITE_SUPABASE_ANON_KEY: secretKey,
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("configuração pública do Supabase é inválida");
    expect(result.stderr).not.toContain(secretKey);
  });

  test("rejeita localhost como redirect público no modo Supabase", () => {
    const result = run({
      VERCEL: "1",
      VERCEL_ENV: "production",
      VITE_SITE_URL: "http://localhost:3000",
      VITE_SUPABASE_URL: "https://project.supabase.co",
      VITE_SUPABASE_ANON_KEY: "sb_publishable_example",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("URL HTTPS pública, nunca localhost");
  });

  test("não documenta service role como variável de frontend", () => {
    const example = readFileSync(".env.example", "utf8");
    expect(example).toContain("VITE_APP_MODE=supabase");
    expect(example).toContain("VITE_SITE_URL=\n");
    expect(example).not.toContain("SERVICE_ROLE");
  });

  test("audita a sequência completa sem operações destrutivas de dados", () => {
    const result = spawnSync(process.execPath, ["scripts/audit-supabase-migrations.mjs"], { encoding: "utf8" });
    expect(result.status).toBe(0);
    const audit = JSON.parse(result.stdout) as { migrations: number; ordered: string[]; destructive: string[] };
    expect(audit.migrations).toBe(20);
    expect(audit.ordered[0]).toBe("202607290001_initial_crm.sql");
    expect(audit.ordered.at(-1)).toBe("202608210002_diagnostic_admin_access.sql");
    expect(audit.destructive).toEqual([]);
  });
});
