const OFFICIAL_SITE_URL = "https://beauty.esads.com.br";
const PUBLIC_ROUTES = [
  { path: "/sistema", changefreq: "weekly", priority: "1.0" },
  { path: "/blog", changefreq: "daily", priority: "0.9" },
  { path: "/diagnostico", changefreq: "monthly", priority: "0.9" },
  { path: "/privacidade", changefreq: "yearly", priority: "0.3" },
  { path: "/termos", changefreq: "yearly", priority: "0.3" },
];

const xmlEscape = value => value.replace(/[<>&'\"]/g, character => ({ "<":"&lt;", ">":"&gt;", "&":"&amp;", "'":"&apos;", '\"':"&quot;" })[character]);

async function fetchPublishedBlogPosts(
  env = typeof process === "undefined" ? {} : process.env,
  fetcher = fetch,
  timeoutMs = 3_000,
) {
  const supabaseUrl = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
  const anonKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || "";
  if (!supabaseUrl || !anonKey) return [];
  const posts = [];
  // The RPC caps page_limit at 24. Matching that limit avoids silently stopping
  // after the first page while the shared deadline prevents a slow database from
  // exhausting the serverless invocation time.
  const pageSize = 24;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    for (let offset = 0; offset < 2_400; offset += pageSize) {
      const result = await fetcher(`${supabaseUrl}/rest/v1/rpc/public_blog_posts`, {
        method: "POST",
        headers: { apikey: anonKey, authorization: `Bearer ${anonKey}`, "content-type": "application/json" },
        body: JSON.stringify({ search_term: null, category_slug: null, page_offset: offset, page_limit: pageSize }),
        signal: controller.signal,
      });
      if (!result.ok) throw new Error(`public_blog_posts returned ${result.status}`);
      const value = await result.json();
      const page = Array.isArray(value?.items) ? value.items : [];
      posts.push(...page.filter(post => typeof post?.slug === "string" && Boolean(post.slug.trim())));
      const total = Number(value?.total);
      if (page.length < pageSize || (Number.isFinite(total) && posts.length >= total)) break;
    }
  } finally {
    clearTimeout(timer);
  }
  return posts;
}

function buildSitemap(posts = []) {
  const staticEntries = PUBLIC_ROUTES.map(route => `  <url><loc>${OFFICIAL_SITE_URL}${route.path}</loc><changefreq>${route.changefreq}</changefreq><priority>${route.priority}</priority></url>`);
  const seen = new Set();
  const articleEntries = posts.flatMap(post => {
    const slug = post.slug.trim();
    if (!slug || seen.has(slug)) return [];
    seen.add(slug);
    const lastmod = post.published_at && !Number.isNaN(Date.parse(post.published_at)) ? `<lastmod>${new Date(post.published_at).toISOString()}</lastmod>` : "";
    return [`  <url><loc>${OFFICIAL_SITE_URL}/blog/${xmlEscape(encodeURIComponent(slug))}</loc>${lastmod}<changefreq>monthly</changefreq><priority>0.7</priority></url>`];
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...staticEntries,...articleEntries].join("\n")}\n</urlset>\n`;
}

async function handler(request, response) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.statusCode = 405;
    response.setHeader("Allow", "GET, HEAD");
    return response.end();
  }
  let posts = [];
  try { posts = await fetchPublishedBlogPosts(); }
  catch (error) { console.error("[sitemap] Published posts could not be loaded", error instanceof Error ? error.message : "unknown error"); }
  const xml = buildSitemap(posts);
  response.statusCode = 200;
  response.setHeader("Content-Type", "application/xml; charset=utf-8");
  response.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=86400");
  return response.end(request.method === "HEAD" ? undefined : xml);
}

module.exports = handler;
module.exports.default = handler;
module.exports.OFFICIAL_SITE_URL = OFFICIAL_SITE_URL;
module.exports.fetchPublishedBlogPosts = fetchPublishedBlogPosts;
module.exports.buildSitemap = buildSitemap;
