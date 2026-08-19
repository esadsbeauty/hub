# Blog architecture

## Routes and runtime boundary

- `/blog` and `/blog/:slug` are handled by `PublicAppRoot`, selected in `main.tsx` before any Auth, bootstrap, organization or permission provider mounts.
- `/marketing/blog` remains inside the authenticated Hub and requires `blog.view`.
- The public layout is reusable by future home, diagnostic and landing-page routes.

## Data model and publication

Migration `202608200001_blog_foundation.sql` adds organization-aware `blog_categories` and `blog_posts`. Posts use `draft`, `published` and `archived`; deletion is a permission-checked `deleted_at` update. A database trigger normalizes slugs, derives tenant/author from the authenticated context, fills `published_at`, validates publish/delete transitions and prevents clients from choosing tenant or author.

Content is stored as a constrained plain-text markup format, not arbitrary HTML. The React renderer supports paragraphs, H2/H3, lists, emphasis, links and quotes while escaping all input by default. New articles always start as drafts and require manual save/publication.

## RLS and permissions

Anonymous reads explicitly require a published, non-deleted, already-due post belonging to `esads-beauty`. Safe public RPCs return only the fields needed by the editorial pages and the author's display name. Drafts and archived posts remain available only through authenticated editorial policies.

Permissions are `blog.view`, `blog.create`, `blog.edit`, `blog.publish` and `blog.delete`. Owner/Admin receive all; Marketing receives view/create/edit/publish. PostgreSQL, not just the UI, enforces publication and soft deletion.

## Storage

The dedicated public `blog` bucket accepts JPEG, PNG and WebP up to 5 MB. Public read is limited to that bucket. Upload/update require `blog.edit`; removal requires `blog.delete`. The CMS validates size and MIME type before upload. Cover images use lazy loading in listings and explicit dimensions/aspect ratios.
Migration `202608200002_blog_production_hardening.sql` reconciles the bucket and role grants on remote environments, restricts new uploads to JPEG, PNG and WebP, and recreates the four Storage policies idempotently. Upload paths are generated as `covers/<uuid>.<safe-extension>` and never depend on the original filename.

## Vercel routing and environments

`vercel.json` rewrites application routes to `index.html` while leaving built assets untouched. This is required for direct navigation and refresh on `/blog/:slug` and `/marketing/blog`. Preview must use Supabase mode when it is intended to validate remote articles and Storage; local mode deliberately uses an isolated browser repository.

## SEO

The SPA updates title, description, canonical, robots, Open Graph and Twitter metadata per route using the central `VITE_SITE_URL`. `robots.txt` and a base sitemap are shipped. Because this remains a client-rendered Vite SPA, crawlers that do not execute JavaScript will only see the static `index.html` metadata, and the checked-in sitemap cannot enumerate database rows at build time.

Before a full acquisition launch, add a deployment-time prerender/serverless sitemap process that reads published slugs with a public read-only client and emits HTML plus sitemap entries. This is intentionally documented rather than represented as SSR today.

## Acquisition path

The article CTA currently links to the valid Hub login. It does not create CRM leads. A future `/diagnostico` can replace the CTA and explicitly submit consented quiz results into the CRM without changing the blog model.
