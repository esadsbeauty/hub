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
    expect(result.stderr).toContain("ambiente preview");
    expect(result.stdout).toContain('"hasSupabaseUrl":false');
    expect(result.stdout).toContain('"hasSupabaseAnonKey":false');
    expect(result.stdout).toContain('"vercelEnv":"preview"');
  });

  test("aceita URL HTTPS e chave pública sem imprimir valores", () => {
    const result = run({
      VERCEL: "1",
      VERCEL_ENV: "preview",
      VITE_SUPABASE_URL: "https://project.supabase.co",
      VITE_SUPABASE_ANON_KEY: "sb_publishable_example",
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('"hasSupabaseUrl":true');
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
      VITE_SUPABASE_URL: "https://project.supabase.co",
      VITE_SUPABASE_ANON_KEY: secretKey,
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("configuração pública do Supabase é inválida");
    expect(result.stderr).not.toContain(secretKey);
  });

  test("não documenta service role como variável de frontend", () => {
    expect(readFileSync(".env.example", "utf8")).toBe(
      "VITE_SUPABASE_URL=\nVITE_SUPABASE_ANON_KEY=\n",
    );
  });
});
