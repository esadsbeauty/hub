import type { IncomingMessage, ServerResponse } from "node:http";

export const OFFICIAL_SITE_URL = "https://beauty.esads.com.br";
const PUBLIC_ROUTES = [
  { path: "/sistema", changefreq: "weekly", priority: "1.0" },
  { path: "/blog", changefreq: "daily", priority: "0.9" },
  { path: "/diagnostico", changefreq: "monthly", priority: "0.9" },
  { path: "/privacidade", changefreq: "yearly", priority: "0.3" },
  { path: "/termos", changefreq: "yearly", priority: "0.3" },
] as const;

type PublishedPost = { slug: string; published_at?: string | null };
type PublicPostsResponse = { items?: PublishedPost[]; total?: number };

const xmlEscape = (value: string) => value.replace(/[<>&'\"]/g, character => ({ "<":"&lt;", ">":"&gt;", "&":"&amp;", "'":"&apos;", '\"':"&quot;" })[character]!);

export async function fetchPublishedBlogPosts(
  env: NodeJS.ProcessEnv = process.env,
  fetcher: typeof fetch = fetch,
) {
  const supabaseUrl = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
  const anonKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || "";
  if (!supabaseUrl || !anonKey) return [];
  const posts: PublishedPost[] = [];
  const pageSize = 100;
  for (let offset = 0; offset < 10_000; offset += pageSize) {
    const result = await fetcher(`${supabaseUrl}/rest/v1/rpc/public_blog_posts`, {
      method: "POST",
      headers: { apikey: anonKey, authorization: `Bearer ${anonKey}`, "content-type": "application/json" },
      body: JSON.stringify({ search_term: null, category_slug: null, page_offset: offset, page_limit: pageSize }),
    });
    if (!result.ok) throw new Error(`public_blog_posts returned ${result.status}`);
    const value = await result.json() as PublicPostsResponse;
    const page = value.items ?? [];
    posts.push(...page.filter(post => Boolean(post.slug)));
    if (page.length < pageSize || posts.length >= Number(value.total ?? 0)) break;
  }
  return posts;
}

export function buildSitemap(posts: PublishedPost[] = []) {
  const staticEntries = PUBLIC_ROUTES.map(route => `  <url><loc>${OFFICIAL_SITE_URL}${route.path}</loc><changefreq>${route.changefreq}</changefreq><priority>${route.priority}</priority></url>`);
  const seen = new Set<string>();
  const articleEntries = posts.flatMap(post => {
    const slug = post.slug.trim();
    if (!slug || seen.has(slug)) return [];
    seen.add(slug);
    const lastmod = post.published_at && !Number.isNaN(Date.parse(post.published_at)) ? `<lastmod>${new Date(post.published_at).toISOString()}</lastmod>` : "";
    return [`  <url><loc>${OFFICIAL_SITE_URL}/blog/${xmlEscape(encodeURIComponent(slug))}</loc>${lastmod}<changefreq>monthly</changefreq><priority>0.7</priority></url>`];
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...staticEntries,...articleEntries].join("\n")}\n</urlset>\n`;
}

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.statusCode = 405;
    response.setHeader("Allow", "GET, HEAD");
    return response.end();
  }
  let posts: PublishedPost[] = [];
  try { posts = await fetchPublishedBlogPosts(); }
  catch (error) { console.error("[sitemap] Published posts could not be loaded", error instanceof Error ? error.message : "unknown error"); }
  const xml = buildSitemap(posts);
  response.statusCode = 200;
  response.setHeader("Content-Type", "application/xml; charset=utf-8");
  response.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=86400");
  return response.end(request.method === "HEAD" ? undefined : xml);
}
