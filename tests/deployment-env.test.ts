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
    const result = run({ VERCEL: "1" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("VITE_SUPABASE_URL");
  });

  test("aceita URL HTTPS e chave pública sem imprimir valores", () => {
    const result = run({
      VERCEL: "1",
      VITE_SUPABASE_URL: "https://project.supabase.co",
      VITE_SUPABASE_ANON_KEY: "sb_publishable_example",
    });
    expect(result.status).toBe(0);
    expect(result.stdout + result.stderr).not.toContain("project.supabase.co");
    expect(result.stdout + result.stderr).not.toContain("sb_publishable_example");
  });

  test("não documenta service role como variável de frontend", () => {
    expect(readFileSync(".env.example", "utf8")).toBe(
      "VITE_SUPABASE_URL=\nVITE_SUPABASE_ANON_KEY=\n",
    );
  });
});
