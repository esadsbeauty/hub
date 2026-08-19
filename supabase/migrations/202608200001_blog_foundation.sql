-- Public blog and authenticated editorial CMS. Additive; no existing objects are removed.
create extension if not exists unaccent;

create table public.blog_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 80),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create table public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 4 and 180),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  excerpt text not null default '' check (char_length(excerpt) <= 500),
  content text not null default '',
  cover_image_path text,
  category_id uuid references public.blog_categories(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  author_id uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  published_at timestamptz,
  seo_title text check (seo_title is null or char_length(seo_title) <= 180),
  seo_description text check (seo_description is null or char_length(seo_description) <= 320),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (organization_id, slug),
  check (status <> 'published' or (published_at is not null and char_length(trim(content)) >= 80 and char_length(trim(excerpt)) >= 20))
);

create index blog_posts_publication_idx on public.blog_posts(status, published_at desc) where deleted_at is null;
create index blog_posts_category_idx on public.blog_posts(category_id, published_at desc) where deleted_at is null;

create or replace function public.blog_slug(value text) returns text
language sql immutable strict parallel safe set search_path=public as $$
  select trim(both '-' from regexp_replace(lower(unaccent(trim(value))), '[^a-z0-9]+', '-', 'g'))
$$;

create or replace function public.prepare_blog_post() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  new.slug := public.blog_slug(coalesce(nullif(new.slug,''),new.title));
  if tg_op='INSERT' then
    new.organization_id := public.current_organization_id();
    new.author_id := auth.uid();
  else
    new.organization_id := old.organization_id;
    new.author_id := old.author_id;
    if new.status is distinct from old.status and (new.status='published' or old.status='published')
      and not public.has_permission('blog.publish') then raise exception 'blog_publish_denied'; end if;
    if new.deleted_at is distinct from old.deleted_at and new.deleted_at is not null
      and not public.has_permission('blog.delete') then raise exception 'blog_delete_denied'; end if;
  end if;
  if new.status='published' and new.published_at is null then new.published_at:=now(); end if;
  if new.status<>'published' then new.published_at:=null; end if;
  new.updated_at:=now();
  return new;
end $$;

create trigger prepare_blog_post before insert or update on public.blog_posts
for each row execute function public.prepare_blog_post();
create trigger blog_categories_updated_at before update on public.blog_categories
for each row execute function public.set_updated_at();

insert into public.blog_categories(organization_id,name,slug)
select o.id,v.name,v.slug from public.organizations o cross join (values
  ('Estratégia comercial','estrategia-comercial'),('Gestão','gestao'),('Atendimento','atendimento')
) as v(name,slug) where o.slug='esads-beauty'
on conflict(organization_id,slug) do nothing;

alter table public.blog_categories enable row level security;
alter table public.blog_posts enable row level security;

-- Public visitors only see categories that currently contain a published ESADS Beauty article.
create policy blog_categories_public_read on public.blog_categories for select to anon,authenticated
using (exists (
  select 1 from public.blog_posts p join public.organizations o on o.id=p.organization_id
  where p.category_id=blog_categories.id and o.slug='esads-beauty' and p.status='published'
    and p.published_at<=now() and p.deleted_at is null
));
create policy blog_categories_editor_read on public.blog_categories for select to authenticated
using (organization_id=public.current_organization_id() and public.has_permission('blog.view'));
create policy blog_categories_editor_manage on public.blog_categories for all to authenticated
using (organization_id=public.current_organization_id() and public.has_permission('blog.edit'))
with check (organization_id=public.current_organization_id() and public.has_permission('blog.edit'));

-- This deliberately is not USING(true): anonymous visibility is constrained by publication state and tenant.
create policy blog_posts_public_read on public.blog_posts for select to anon,authenticated
using (status='published' and published_at<=now() and deleted_at is null and exists (
  select 1 from public.organizations o where o.id=blog_posts.organization_id and o.slug='esads-beauty'
));
create policy blog_posts_editor_read on public.blog_posts for select to authenticated
using (organization_id=public.current_organization_id() and public.has_permission('blog.view'));
create policy blog_posts_editor_insert on public.blog_posts for insert to authenticated
with check (organization_id=public.current_organization_id() and author_id=auth.uid() and public.has_permission('blog.create'));
create policy blog_posts_editor_update on public.blog_posts for update to authenticated
using (organization_id=public.current_organization_id() and public.has_permission('blog.edit'))
with check (organization_id=public.current_organization_id() and (
  (status='published' and public.has_permission('blog.publish')) or status<>'published'
));
-- No DELETE policy is created: deletion is always a permission-checked soft delete.

insert into public.permissions(key,name,description,module) values
 ('blog.view','Visualizar Blog','Acessar o CMS e previews internos','blog'),
 ('blog.create','Criar artigos','Criar rascunhos do blog','blog'),
 ('blog.edit','Editar artigos','Editar conteúdo e categorias','blog'),
 ('blog.publish','Publicar artigos','Publicar e retirar artigos do ar','blog'),
 ('blog.delete','Excluir artigos','Arquivar artigos por soft delete','blog')
on conflict(key) do update set name=excluded.name,description=excluded.description,module=excluded.module;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where p.key like 'blog.%' and (r.slug in ('owner','admin') or (r.slug='marketing' and p.key<>'blog.delete'))
on conflict do nothing;

create or replace function public.audit_blog_post() returns trigger
language plpgsql security definer set search_path=public as $$
declare action_name text;
begin
  action_name:=case
    when tg_op='INSERT' then 'blog_post_created'
    when new.deleted_at is distinct from old.deleted_at and new.deleted_at is not null then 'blog_post_deleted'
    when new.status='published' and old.status<>'published' then 'blog_post_published'
    when old.status='published' and new.status='draft' then 'blog_post_unpublished'
    when new.status='archived' and old.status<>'archived' then 'blog_post_archived'
    else 'blog_post_updated' end;
  insert into public.audit_logs(organization_id,user_id,action,entity_type,entity_id,module,old_values,new_values)
  values(coalesce(new.organization_id,old.organization_id),auth.uid(),action_name,'blog_post',coalesce(new.id,old.id),'blog',
    case when tg_op='INSERT' then '{}'::jsonb else to_jsonb(old) end,
    case when tg_op='DELETE' then '{}'::jsonb else to_jsonb(new) end);
  return coalesce(new,old);
end $$;
create trigger audit_blog_post after insert or update on public.blog_posts
for each row execute function public.audit_blog_post();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('blog','blog',true,5242880,array['image/jpeg','image/png','image/webp','image/avif'])
on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy blog_media_public_read on storage.objects for select to anon,authenticated using(bucket_id='blog');
create policy blog_media_editor_insert on storage.objects for insert to authenticated
with check(bucket_id='blog' and public.has_permission('blog.edit'));
create policy blog_media_editor_update on storage.objects for update to authenticated
using(bucket_id='blog' and public.has_permission('blog.edit')) with check(bucket_id='blog' and public.has_permission('blog.edit'));
create policy blog_media_editor_delete on storage.objects for delete to authenticated
using(bucket_id='blog' and public.has_permission('blog.delete'));

create or replace function public.public_blog_posts(search_term text default null, category_slug text default null, page_offset integer default 0, page_limit integer default 9)
returns jsonb language sql stable security definer set search_path=public as $$
  with rows as (
    select p.id,p.title,p.slug,p.excerpt,p.content,p.cover_image_path,p.published_at,p.seo_title,p.seo_description,
      c.id category_id,c.name category_name,c.slug category_slug,pr.name author_name,
      count(*) over() total_count
    from public.blog_posts p
    join public.organizations o on o.id=p.organization_id and o.slug='esads-beauty'
    left join public.blog_categories c on c.id=p.category_id
    join public.profiles pr on pr.id=p.author_id
    where p.status='published' and p.published_at<=now() and p.deleted_at is null
      and (nullif(trim(search_term),'') is null or p.title ilike '%'||trim(search_term)||'%' or p.excerpt ilike '%'||trim(search_term)||'%' or c.name ilike '%'||trim(search_term)||'%')
      and (nullif(trim(category_slug),'') is null or c.slug=category_slug)
    order by p.published_at desc,p.id
    offset greatest(page_offset,0) limit least(greatest(page_limit,1),24)
  ) select jsonb_build_object('items',coalesce(jsonb_agg(to_jsonb(rows)-'total_count'),'[]'::jsonb),'total',coalesce(max(total_count),0)) from rows
$$;

create or replace function public.public_blog_post(post_slug text)
returns jsonb language sql stable security definer set search_path=public as $$
  select to_jsonb(row) from (
    select p.id,p.title,p.slug,p.excerpt,p.content,p.cover_image_path,p.published_at,p.seo_title,p.seo_description,
      c.id category_id,c.name category_name,c.slug category_slug,pr.name author_name
    from public.blog_posts p
    join public.organizations o on o.id=p.organization_id and o.slug='esads-beauty'
    left join public.blog_categories c on c.id=p.category_id
    join public.profiles pr on pr.id=p.author_id
    where p.slug=post_slug and p.status='published' and p.published_at<=now() and p.deleted_at is null
    limit 1
  ) row
$$;
revoke all on function public.public_blog_posts(text,text,integer,integer) from public;
revoke all on function public.public_blog_post(text) from public;
grant execute on function public.public_blog_posts(text,text,integer,integer) to anon,authenticated;
grant execute on function public.public_blog_post(text) to anon,authenticated;
