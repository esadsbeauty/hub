-- Production hardening for the Blog rollout. This migration is idempotent and
-- repairs permissions and Storage policies when the first rollout happened
-- before roles or the bucket were available remotely.

insert into public.permissions(key,name,description,module) values
 ('blog.view','Visualizar Blog','Acessar o CMS e previews internos','blog'),
 ('blog.create','Criar artigos','Criar rascunhos do blog','blog'),
 ('blog.edit','Editar artigos','Editar conteúdo e imagens','blog'),
 ('blog.publish','Publicar artigos','Publicar e retirar artigos do ar','blog'),
 ('blog.delete','Excluir artigos','Remover artigos por soft delete','blog')
on conflict(key) do update set name=excluded.name,description=excluded.description,module=excluded.module;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where p.key like 'blog.%'
  and (r.slug in ('owner','admin') or (r.slug='marketing' and p.key<>'blog.delete'))
on conflict do nothing;

grant select on public.blog_categories, public.blog_posts to anon, authenticated;
grant insert, update on public.blog_categories, public.blog_posts to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('blog','blog',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set
  public=true,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists blog_media_public_read on storage.objects;
drop policy if exists blog_media_editor_insert on storage.objects;
drop policy if exists blog_media_editor_update on storage.objects;
drop policy if exists blog_media_editor_delete on storage.objects;

create policy blog_media_public_read on storage.objects for select to anon,authenticated
using(bucket_id='blog');
create policy blog_media_editor_insert on storage.objects for insert to authenticated
with check(bucket_id='blog' and auth.uid() is not null and public.has_permission('blog.edit'));
create policy blog_media_editor_update on storage.objects for update to authenticated
using(bucket_id='blog' and auth.uid() is not null and public.has_permission('blog.edit'))
with check(bucket_id='blog' and auth.uid() is not null and public.has_permission('blog.edit'));
create policy blog_media_editor_delete on storage.objects for delete to authenticated
using(bucket_id='blog' and auth.uid() is not null and public.has_permission('blog.delete'));

notify pgrst, 'reload schema';
