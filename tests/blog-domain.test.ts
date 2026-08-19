import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { blogSlug, readingMinutes } from "../src/modules/blog/types";

describe("fundação pública do blog", () => {
  test("gera slug seguro e tempo de leitura determinístico", () => {
    expect(blogSlug("Como melhorar o Atendimento da Clínica? ")).toBe("como-melhorar-o-atendimento-da-clinica");
    expect(readingMinutes(Array.from({ length: 211 }, () => "palavra").join(" "))).toBe(2);
    expect(readingMinutes("")).toBe(1);
  });

  test("separa rotas públicas antes dos providers autenticados", () => {
    const main = readFileSync("src/main.tsx", "utf8");
    const root = readFileSync("src/app/public-app-root.tsx", "utf8");
    expect(main).toContain('const isPublicRoute = /^\\/blog');
    expect(main).toContain('isPublicRoute ? import("./app/public-app-root")');
    expect(root).toContain('path="/blog"');
    expect(root).toContain('path="/blog/:slug"');
    expect(root).not.toContain("AuthProvider");
    expect(root).not.toContain("ProtectedRoute");
  });

  test("conteúdo editorial não renderiza HTML arbitrário", () => {
    const renderer = readFileSync("src/modules/blog/components/blog-content.tsx", "utf8");
    expect(renderer).not.toContain("dangerouslySetInnerHTML");
    expect(renderer).toContain("<h2");
    expect(renderer).toContain("<blockquote");
  });

  test("RLS pública expõe somente publicação válida e gestão exige permissões", () => {
    const migration = readFileSync("supabase/migrations/202608200001_blog_foundation.sql", "utf8");
    expect(migration).toContain("status='published' and published_at<=now() and deleted_at is null");
    expect(migration).toContain("public.has_permission('blog.publish')");
    expect(migration).toContain("public.has_permission('blog.delete')");
    expect(migration).not.toMatch(/blog_posts_public_read[\s\S]{0,100}using\s*\(true\)/i);
    expect(migration).not.toContain("create policy blog_posts_editor_delete");
  });

  test("CMS usa repository, React Query e SEO centralizado", () => {
    const cms = readFileSync("src/modules/blog/pages/BlogCmsPage.tsx", "utf8");
    const hooks = readFileSync("src/modules/blog/hooks.ts", "utf8");
    const seo = readFileSync("src/modules/blog/components/seo-head.tsx", "utf8");
    expect(cms).toContain("Salvar rascunho");
    expect(cms).toContain("SEO Preview");
    expect(hooks).toContain("useQuery");
    expect(hooks).toContain("useMutation");
    expect(seo).toContain('import { siteUrl }');
    expect(seo).toContain('og:type');
  });

  test("deployment público possui fallback SPA e Storage remoto endurecido", () => {
    const vercel = JSON.parse(readFileSync("vercel.json", "utf8")) as { rewrites: { source: string; destination: string }[] };
    const hardening = readFileSync("supabase/migrations/202608200002_blog_production_hardening.sql", "utf8");
    const repository = readFileSync("src/modules/blog/supabase-repository.ts", "utf8");
    const cms = readFileSync("src/modules/blog/pages/BlogCmsPage.tsx", "utf8");
    expect(vercel.rewrites[0]?.destination).toBe("/index.html");
    expect(hardening).toContain("values('blog','blog',true,5242880");
    expect(hardening).toContain("blog_media_editor_insert");
    expect(hardening).toContain("public.has_permission('blog.edit')");
    expect(repository).toContain("auth.getSession()");
    expect(repository).toContain('path=`covers/${crypto.randomUUID()}.${extension}`');
    expect(cms).toContain("Ver artigo público");
  });
});
