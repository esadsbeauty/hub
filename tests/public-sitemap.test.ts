import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import sitemapHandler, { buildSitemap, fetchPublishedBlogPosts, OFFICIAL_SITE_URL } from "../api/sitemap";

const robots = readFileSync("public/robots.txt", "utf8");
const seo = readFileSync("src/modules/blog/components/seo-head.tsx", "utf8");
const vercel = readFileSync("vercel.json", "utf8");

describe("public sitemap and canonical domain", () => {
  test("uses only the official domain and valid XML envelope", () => {
    const xml = buildSitemap([{ slug: "vendas-na-estetica", published_at: "2026-09-01T12:00:00Z" }]);
    expect(xml).toStartWith('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toEndWith("</urlset>\n");
    expect(xml).toContain(`${OFFICIAL_SITE_URL}/blog/vendas-na-estetica`);
    expect(xml).not.toContain(["esadsbeauty","vercel","app"].join("."));
  });

  test("includes indexable public routes and excludes private routes", () => {
    const xml = buildSitemap();
    for (const route of ["/sistema","/blog","/diagnostico","/privacidade","/termos"])
      expect(xml).toContain(`${OFFICIAL_SITE_URL}${route}</loc>`);
    for (const route of ["/login","/crm","/agenda","/clientes","/configuracoes","/plataforma"])
      expect(xml).not.toContain(`${OFFICIAL_SITE_URL}${route}</loc>`);
  });

  test("loads published blog slugs through the existing public RPC", async () => {
    const calls: string[] = [];
    const posts = await fetchPublishedBlogPosts(
      { SUPABASE_URL: "https://project.supabase.co", SUPABASE_ANON_KEY: "public-key" },
      (async (url, init) => {
        calls.push(String(url));
        expect(init?.body).toContain('"page_limit":100');
        return new Response(JSON.stringify({ items: [{ slug: "artigo-publicado", published_at: null }], total: 1 }), { status: 200 });
      }) as typeof fetch,
    );
    expect(posts).toEqual([{ slug: "artigo-publicado", published_at: null }]);
    expect(calls).toEqual(["https://project.supabase.co/rest/v1/rpc/public_blog_posts"]);
  });

  test("robots, Vercel rewrite and public canonicals use the official URL", () => {
    expect(robots).toContain(`Sitemap: ${OFFICIAL_SITE_URL}/sitemap.xml`);
    expect(vercel).toContain('"source": "/sitemap.xml"');
    expect(vercel).toContain('"destination": "/api/sitemap"');
    expect(seo).toContain("officialPublicSiteUrl");
  });

  test("HTTP handler returns 200 and XML content", async () => {
    const headers = new Map<string,string>();
    let statusCode = 0, body = "";
    await sitemapHandler(
      { method: "GET" } as never,
      { setHeader:(name:string,value:string)=>headers.set(name,value),end:(value?:string)=>{body=value??""},get statusCode(){return statusCode},set statusCode(value:number){statusCode=value} } as never,
    );
    expect(statusCode).toBe(200);
    expect(headers.get("Content-Type")).toBe("application/xml; charset=utf-8");
    expect(body).toContain("<urlset");
    expect(body).toContain(`${OFFICIAL_SITE_URL}/blog`);
  });
});
