-- Tenant-safe, transactional spreadsheet import reusing the manual lead creation RPC.
create or replace function public.import_crm_leads(import_rows jsonb)
returns jsonb
language plpgsql
security invoker
set search_path=public
as $$
declare
  tenant uuid:=public.current_organization_id();
  actor uuid:=auth.uid();
  item jsonb;
  created_company public.companies;
  created_opportunity public.opportunities;
  requested_owner uuid;
  digits text;
  comparable text;
  imported integer:=0;
  duplicates integer:=0;
  errors integer:=0;
  results jsonb:='[]'::jsonb;
begin
  if tenant is null or actor is null or not public.has_permission('crm.manage') then
    raise exception 'crm_manage_required' using errcode='42501';
  end if;
  if jsonb_typeof(import_rows)<>'array' or jsonb_array_length(import_rows)>1000 then
    raise exception 'invalid_import_rows' using errcode='22023';
  end if;

  -- Serialize imports for the active tenant so two files cannot create the same lead concurrently.
  perform pg_advisory_xact_lock(hashtextextended(tenant::text,0));

  for item in select value from jsonb_array_elements(import_rows)
  loop
    begin
      digits:=regexp_replace(coalesce(item->>'whatsapp',''),'\D','','g');
      if digits like '55%' and length(digits) in(12,13) then digits:=substr(digits,3);end if;
      if nullif(btrim(item->>'name'),'') is null or length(digits) not in(10,11) then
        errors:=errors+1;
        results:=results||jsonb_build_object('row',item->>'row','status','error');
        continue;
      end if;
      comparable:=case when length(digits)=10 and substr(digits,3,1) in('6','7','8','9') then substr(digits,1,2)||'9'||substr(digits,3) else digits end;

      if exists(
        select 1 from public.contacts c
        where c.organization_id=tenant and c.deleted_at is null
          and case
            when length(regexp_replace(c.whatsapp,'\D','','g'))=13 and regexp_replace(c.whatsapp,'\D','','g') like '55%' then substr(regexp_replace(c.whatsapp,'\D','','g'),3)
            when length(regexp_replace(c.whatsapp,'\D','','g'))=12 and regexp_replace(c.whatsapp,'\D','','g') like '55%' then substr(regexp_replace(c.whatsapp,'\D','','g'),3)
            else regexp_replace(c.whatsapp,'\D','','g')
          end in(digits,comparable,case when length(digits)=11 then substr(digits,1,2)||substr(digits,4) else digits end)
      ) or exists(
        select 1 from public.companies c
        where c.organization_id=tenant and c.deleted_at is null
          and case
            when length(regexp_replace(c.whatsapp,'\D','','g'))=13 and regexp_replace(c.whatsapp,'\D','','g') like '55%' then substr(regexp_replace(c.whatsapp,'\D','','g'),3)
            when length(regexp_replace(c.whatsapp,'\D','','g'))=12 and regexp_replace(c.whatsapp,'\D','','g') like '55%' then substr(regexp_replace(c.whatsapp,'\D','','g'),3)
            else regexp_replace(c.whatsapp,'\D','','g')
          end in(digits,comparable,case when length(digits)=11 then substr(digits,1,2)||substr(digits,4) else digits end)
      ) then
        duplicates:=duplicates+1;
        results:=results||jsonb_build_object('row',item->>'row','status','duplicate');
        continue;
      end if;

      requested_owner:=nullif(item->>'ownerId','')::uuid;
      if requested_owner is not null and not exists(
        select 1 from public.profiles p join public.organization_members m
          on m.organization_id=tenant and m.user_id=p.id and m.status='active'
        where p.id=requested_owner and p.organization_id=tenant
      ) then
        errors:=errors+1;
        results:=results||jsonb_build_object('row',item->>'row','status','error');
        continue;
      end if;

      created_company:=public.create_company_with_primary_contact(
        jsonb_build_object(
          'name',btrim(item->>'name'),'whatsapp',digits,'instagram',nullif(btrim(item->>'instagram'),''),
          'source',nullif(btrim(item->>'source'),''),'temperature','morno','priority','media','owner_id',coalesce(requested_owner,actor)
        ),
        jsonb_build_object('name',btrim(item->>'name'),'whatsapp',digits,'instagram',nullif(btrim(item->>'instagram'),''))
      );
      select * into created_opportunity from public.opportunities
        where organization_id=tenant and company_id=created_company.id order by created_at desc limit 1;

      if requested_owner is not null then
        update public.companies set owner_id=requested_owner where id=created_company.id and organization_id=tenant;
        update public.opportunities set owner_id=requested_owner where id=created_opportunity.id and organization_id=tenant;
      end if;
      if nullif(btrim(item->>'note'),'') is not null then
        insert into public.notes(organization_id,company_id,opportunity_id,created_by,body)
        values(tenant,created_company.id,created_opportunity.id,actor,btrim(item->>'note'));
      end if;
      imported:=imported+1;
      results:=results||jsonb_build_object('row',item->>'row','status','imported','companyId',created_company.id);
    exception when unique_violation then
      duplicates:=duplicates+1;
      results:=results||jsonb_build_object('row',item->>'row','status','duplicate');
    end;
  end loop;
  return jsonb_build_object('imported',imported,'duplicates',duplicates,'errors',errors,'results',results);
end$$;

revoke all on function public.import_crm_leads(jsonb) from public,anon;
grant execute on function public.import_crm_leads(jsonb) to authenticated;
notify pgrst,'reload schema';
