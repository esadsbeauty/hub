-- Additive many-to-many categorization for Blog posts, preserving legacy associations.
create table public.blog_post_categories (
  post_id uuid not null references public.blog_posts(id) on delete cascade,
  category_id uuid not null references public.blog_categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(post_id,category_id)
);
create index blog_post_categories_category_idx on public.blog_post_categories(category_id,post_id);

insert into public.blog_post_categories(post_id,category_id)
select id,category_id from public.blog_posts where category_id is not null
on conflict do nothing;

alter table public.blog_post_categories enable row level security;
create policy blog_post_categories_public_read on public.blog_post_categories for select to anon,authenticated
using(exists(select 1 from public.blog_posts p join public.organizations o on o.id=p.organization_id where p.id=post_id and o.slug='esads-beauty' and p.status='published' and p.published_at<=now() and p.deleted_at is null));
create policy blog_post_categories_editor_read on public.blog_post_categories for select to authenticated
using(exists(select 1 from public.blog_posts p where p.id=post_id and p.organization_id=public.current_organization_id() and public.has_permission('blog.view')));
create policy blog_post_categories_editor_manage on public.blog_post_categories for all to authenticated
using(exists(select 1 from public.blog_posts p where p.id=post_id and p.organization_id=public.current_organization_id() and public.has_permission('blog.edit')))
with check(exists(select 1 from public.blog_posts p join public.blog_categories c on c.id=category_id where p.id=post_id and p.organization_id=public.current_organization_id() and c.organization_id=p.organization_id and public.has_permission('blog.edit')));
grant select on public.blog_post_categories to anon,authenticated;
grant insert,delete on public.blog_post_categories to authenticated;

drop policy if exists blog_categories_public_read on public.blog_categories;
create policy blog_categories_public_read on public.blog_categories for select to anon,authenticated
using(exists(select 1 from public.blog_post_categories pc join public.blog_posts p on p.id=pc.post_id join public.organizations o on o.id=p.organization_id where pc.category_id=blog_categories.id and o.slug='esads-beauty' and p.status='published' and p.published_at<=now() and p.deleted_at is null));

-- Atomic post + category association save. Categories remain mandatory.
drop function if exists public.save_blog_post(uuid,text,text,text,text,text,uuid,text,text);
create or replace function public.save_blog_post(post_id uuid,post_title text,post_slug text,post_excerpt text,post_content text,post_cover_image_path text,post_category_ids uuid[],post_seo_title text,post_seo_description text) returns uuid
language plpgsql security definer set search_path=public as $$
declare org_id uuid:=public.current_organization_id();saved_id uuid;category_count integer;
begin
 if auth.uid() is null or org_id is null then raise exception 'blog_session_required' using errcode='42501';end if;
 if post_id is null and not public.has_permission('blog.create') then raise exception 'blog_create_denied' using errcode='42501';end if;
 if post_id is not null and not public.has_permission('blog.edit') then raise exception 'blog_edit_denied' using errcode='42501';end if;
 if char_length(trim(coalesce(post_title,'')))<4 or public.blog_slug(coalesce(nullif(post_slug,''),post_title))='' then raise exception 'blog_fields_invalid' using errcode='23514';end if;
 select count(distinct c.id) into category_count from public.blog_categories c where c.organization_id=org_id and c.id=any(coalesce(post_category_ids,'{}'));
 if category_count=0 or category_count<>cardinality(array(select distinct unnest(coalesce(post_category_ids,'{}'::uuid[])))) then raise exception 'blog_category_invalid' using errcode='23503';end if;
 if post_id is null then
  insert into public.blog_posts(organization_id,title,slug,excerpt,content,cover_image_path,category_id,status,author_id,seo_title,seo_description)
  values(org_id,trim(post_title),public.blog_slug(coalesce(nullif(post_slug,''),post_title)),coalesce(post_excerpt,''),coalesce(post_content,''),nullif(post_cover_image_path,''),post_category_ids[1],'draft',auth.uid(),nullif(post_seo_title,''),nullif(post_seo_description,'')) returning id into saved_id;
 else
  update public.blog_posts set title=trim(post_title),slug=public.blog_slug(coalesce(nullif(post_slug,''),post_title)),excerpt=coalesce(post_excerpt,''),content=coalesce(post_content,''),cover_image_path=nullif(post_cover_image_path,''),category_id=post_category_ids[1],seo_title=nullif(post_seo_title,''),seo_description=nullif(post_seo_description,'') where id=post_id and organization_id=org_id and deleted_at is null returning id into saved_id;
  if saved_id is null then raise exception 'blog_post_not_found' using errcode='P0002';end if;
  with removed as(delete from public.blog_post_categories where blog_post_categories.post_id=saved_id returning post_id) select count(*) into category_count from removed;
 end if;
 insert into public.blog_post_categories(post_id,category_id) select saved_id,category_id from unnest(post_category_ids) category_id on conflict do nothing;
 return saved_id;
end$$;
revoke all on function public.save_blog_post(uuid,text,text,text,text,text,uuid[],text,text) from public,anon;
grant execute on function public.save_blog_post(uuid,text,text,text,text,text,uuid[],text,text) to authenticated;

create or replace function public.public_blog_posts(search_term text default null,category_slug text default null,page_offset integer default 0,page_limit integer default 9) returns jsonb language sql stable security definer set search_path=public as $$
with filtered as(select distinct p.id from public.blog_posts p join public.organizations o on o.id=p.organization_id and o.slug='esads-beauty' where p.status='published' and p.published_at<=now() and p.deleted_at is null and (nullif(trim(search_term),'') is null or p.title ilike '%'||trim(search_term)||'%' or p.excerpt ilike '%'||trim(search_term)||'%' or exists(select 1 from public.blog_post_categories pc join public.blog_categories c on c.id=pc.category_id where pc.post_id=p.id and c.name ilike '%'||trim(search_term)||'%')) and (nullif(trim(category_slug),'') is null or exists(select 1 from public.blog_post_categories pc join public.blog_categories c on c.id=pc.category_id where pc.post_id=p.id and c.slug=category_slug))), rows as(select p.id,p.title,p.slug,p.excerpt,p.content,p.cover_image_path,p.published_at,p.seo_title,p.seo_description,pr.name author_name,(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'slug',c.slug,'created_at',c.created_at,'updated_at',c.updated_at) order by c.name),'[]') from public.blog_post_categories pc join public.blog_categories c on c.id=pc.category_id where pc.post_id=p.id) categories,count(*)over() total_count from filtered f join public.blog_posts p on p.id=f.id join public.profiles pr on pr.id=p.author_id order by p.published_at desc,p.id offset greatest(page_offset,0) limit least(greatest(page_limit,1),24)) select jsonb_build_object('items',coalesce(jsonb_agg(to_jsonb(rows)-'total_count'),'[]'),'total',coalesce(max(total_count),0))from rows$$;
create or replace function public.public_blog_post(post_slug text) returns jsonb language sql stable security definer set search_path=public as $$ select to_jsonb(row)from(select p.id,p.title,p.slug,p.excerpt,p.content,p.cover_image_path,p.published_at,p.seo_title,p.seo_description,pr.name author_name,(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'slug',c.slug,'created_at',c.created_at,'updated_at',c.updated_at)order by c.name),'[]')from public.blog_post_categories pc join public.blog_categories c on c.id=pc.category_id where pc.post_id=p.id)categories from public.blog_posts p join public.organizations o on o.id=p.organization_id and o.slug='esads-beauty' join public.profiles pr on pr.id=p.author_id where p.slug=post_slug and p.status='published' and p.published_at<=now() and p.deleted_at is null limit 1)row$$;
notify pgrst,'reload schema';
