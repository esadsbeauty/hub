-- Company deletion in the tenant CRM is an atomic archive, never a tenant/organization deletion.
create or replace function public.archive_crm_company(target_company_id uuid) returns void
language plpgsql security definer set search_path=public as $$
declare tenant uuid:=public.current_organization_id();archived_at timestamptz:=now();
begin
 if tenant is null or not public.has_permission('crm.manage')then raise exception'crm_manage_required'using errcode='42501';end if;
 if not exists(select 1 from public.companies where id=target_company_id and organization_id=tenant and deleted_at is null)then raise exception'company_not_found'using errcode='P0002';end if;
 update public.tasks set status='cancelled',cancelled_at=coalesce(cancelled_at,archived_at),deleted_at=archived_at,updated_at=archived_at where organization_id=tenant and company_id=target_company_id and deleted_at is null;
 update public.notes set deleted_at=archived_at,updated_at=archived_at where organization_id=tenant and company_id=target_company_id and deleted_at is null;
 update public.opportunities set status='archived',deleted_at=archived_at,updated_at=archived_at where organization_id=tenant and company_id=target_company_id and deleted_at is null;
 update public.contacts set deleted_at=archived_at,updated_at=archived_at where organization_id=tenant and company_id=target_company_id and deleted_at is null;
 update public.companies set deleted_at=archived_at,updated_at=archived_at where organization_id=tenant and id=target_company_id;
 insert into public.activities(organization_id,company_id,user_id,type,title,description,metadata)values(tenant,target_company_id,auth.uid(),'company_updated','Empresa arquivada','Empresa, contatos e pendências foram arquivados com segurança',jsonb_build_object('archived_at',archived_at));
end$$;
revoke all on function public.archive_crm_company(uuid)from public,anon;
grant execute on function public.archive_crm_company(uuid)to authenticated;
