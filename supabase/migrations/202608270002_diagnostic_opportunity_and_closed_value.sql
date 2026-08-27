-- Close-won flow records the official opportunity value atomically with customer activation.
drop function if exists public.activate_customer_from_won_opportunity(uuid);
create or replace function public.activate_customer_from_won_opportunity(target_opportunity_id uuid,closed_value numeric) returns public.customer_accounts language plpgsql security invoker set search_path=public as $$
declare o public.opportunities;account public.customer_accounts;won_stage public.pipeline_stages;
begin
 if closed_value is null or closed_value<=0 then raise exception 'closed_value_required' using errcode='23514';end if;
 select * into o from public.opportunities where id=target_opportunity_id and organization_id=public.current_organization_id() for update;
 if o.id is null then raise exception 'opportunity_not_found';end if;
 select * into won_stage from public.pipeline_stages where pipeline_id=o.pipeline_id and is_won order by position,id limit 1;
 if won_stage.id is null then raise exception 'won_stage_not_found';end if;
 update public.opportunities set value=round(closed_value,2),stage_id=won_stage.id,probability=100,status='won',won_at=coalesce(won_at,now()),lost_at=null,updated_at=now() where id=o.id returning * into o;
 update public.companies set lifecycle_stage='customer',updated_at=now() where id=o.company_id;
 insert into public.customer_accounts(organization_id,company_id,status,client_since,owner_id,success_owner_id,source_opportunity_id) values(o.organization_id,o.company_id,'onboarding',coalesce(o.won_at,now()),o.owner_id,o.owner_id,o.id) on conflict(organization_id,company_id)do update set status=case when customer_accounts.status in('cancelled','inactive')then'onboarding'else customer_accounts.status end,cancelled_at=null,source_opportunity_id=o.id,updated_at=now() returning*into account;
 insert into public.activities(organization_id,company_id,opportunity_id,user_id,type,title,description,metadata) select o.organization_id,o.company_id,o.id,auth.uid(),'customer_created','Relacionamento de cliente ativado','A venda ganhou continuidade no pós-venda',jsonb_build_object('customer_account_id',account.id,'closed_value',o.value) where not exists(select 1 from public.activities where opportunity_id=o.id and type='customer_created');
 return account;
end$$;
revoke all on function public.activate_customer_from_won_opportunity(uuid,numeric) from public,anon;
grant execute on function public.activate_customer_from_won_opportunity(uuid,numeric) to authenticated;

-- A diagnostic reuses the contact/company by WhatsApp but always creates one opportunity for this new submission.
create or replace function public.create_diagnostic_crm(target_organization uuid,target_actor uuid,lead_data jsonb)returns jsonb language plpgsql security definer set search_path=public as $$
declare normalized_whatsapp text:=regexp_replace(coalesce(lead_data->>'whatsapp',''),'\D','','g');company public.companies;contact public.contacts;pipeline public.pipelines;stage public.pipeline_stages;opportunity public.opportunities;
begin
 select c.* into company from public.companies c where c.organization_id=target_organization and c.deleted_at is null and (regexp_replace(coalesce(c.whatsapp,''),'\D','','g')=normalized_whatsapp or exists(select 1 from public.contacts ct where ct.company_id=c.id and ct.organization_id=target_organization and ct.deleted_at is null and regexp_replace(coalesce(ct.whatsapp,''),'\D','','g')=normalized_whatsapp)) order by c.created_at limit 1 for update;
 if company.id is null then
  insert into public.companies(organization_id,name,whatsapp,instagram,responsible_name,source,notes,owner_id,created_by)values(target_organization,trim(lead_data->>'name'),normalized_whatsapp,nullif(lead_data->>'instagram',''),trim(lead_data->>'name'),'Diagnóstico ESADS Beauty',nullif(lead_data->>'notes',''),target_actor,target_actor)returning*into company;
 else
  update public.companies set responsible_name=coalesce(responsible_name,trim(lead_data->>'name')),instagram=coalesce(nullif(instagram,''),nullif(lead_data->>'instagram','')),updated_at=now()where id=company.id returning*into company;
 end if;
 select c.* into contact from public.contacts c where c.organization_id=target_organization and c.company_id=company.id and c.deleted_at is null and regexp_replace(coalesce(c.whatsapp,''),'\D','','g')=normalized_whatsapp order by c.is_primary desc,c.created_at limit 1;
 if contact.id is null then insert into public.contacts(organization_id,company_id,name,whatsapp,instagram,is_primary,is_commercial)values(target_organization,company.id,trim(lead_data->>'name'),normalized_whatsapp,nullif(lead_data->>'instagram',''),true,true)returning*into contact;end if;
 select*into pipeline from public.pipelines where organization_id=target_organization and is_default=true order by created_at,id limit 1;
 if pipeline.id is null then select*into pipeline from public.pipelines where organization_id=target_organization order by created_at,id limit 1;end if;
 select*into stage from public.pipeline_stages where pipeline_id=pipeline.id and not is_won and not is_lost order by position,id limit 1;
 if pipeline.id is null or stage.id is null then raise exception 'diagnostic_pipeline_not_configured' using errcode='P0002';end if;
 insert into public.opportunities(organization_id,company_id,pipeline_id,stage_id,title,value,probability,owner_id,status,source,created_by)values(target_organization,company.id,pipeline.id,stage.id,trim(lead_data->>'name'),0,stage.probability,coalesce(company.owner_id,target_actor),'open','Diagnóstico ESADS Beauty',target_actor)returning*into opportunity;
 return jsonb_build_object('company_id',company.id,'contact_id',contact.id,'opportunity_id',opportunity.id);
end$$;
revoke all on function public.create_diagnostic_crm(uuid,uuid,jsonb)from public,anon,authenticated;

create or replace function public.submit_public_diagnostic(submission_data jsonb)returns jsonb language plpgsql security definer set search_path=public as $$
declare org uuid;actor uuid;submission uuid;token uuid;answers jsonb;answer text;score_sum integer:=0;total integer;level text;stage text;need text;bottleneck text;strongest text;category_scores jsonb:='{}';crm jsonb;category text;question text;idem uuid;
begin
 if coalesce(submission_data->>'website','')<>'' then raise exception 'invalid_submission' using errcode='22023';end if;
 if length(trim(coalesce(submission_data->>'name','')))<2 or length(regexp_replace(coalesce(submission_data->>'whatsapp',''),'\D','','g'))<10 or length(regexp_replace(coalesce(submission_data->>'instagram',''),'[^a-zA-Z0-9._]','','g'))<2 then raise exception 'invalid_contact' using errcode='22023';end if;
 idem:=(submission_data->>'idempotency_key')::uuid;perform pg_advisory_xact_lock(hashtextextended(idem::text,0));answers:=submission_data->'answers';
 select id into org from public.organizations where slug='esads-beauty' limit 1;select p.id into actor from public.profiles p join public.organization_members m on m.user_id=p.id and m.organization_id=org and m.status='active' join public.roles r on r.id=m.role_id where p.organization_id=org and r.slug in('owner','admin')order by case r.slug when'owner'then 0 else 1 end,m.created_at limit 1;
 if org is null or actor is null then raise exception 'diagnostic_destination_not_configured' using errcode='P0002';end if;
 select public_token into token from public.diagnostic_submissions where organization_id=org and idempotency_key=idem;if token is not null then return jsonb_build_object('token',token);end if;
 if exists(select 1 from public.diagnostic_submissions where organization_id=org and(whatsapp=regexp_replace(submission_data->>'whatsapp','\D','','g'))and created_at>now()-interval'60 seconds')then raise exception 'rate_limited' using errcode='42900';end if;
 foreach question in array array['acquisition','service','organization','follow_up','metrics','demand','business_stage','marketing','financial_clarity','primary_need']loop answer:=answers->>question;if answer not in('a','b','c','d')then raise exception 'incomplete_answers' using errcode='22023';end if;end loop;
 foreach category in array array['acquisition','service','organization','follow_up','metrics','demand','marketing','financial_clarity']loop answer:=answers->>category;total:=case answer when'a'then 0 when'b'then 33 when'c'then 67 else 100 end;category_scores:=category_scores||jsonb_build_object(category,total);score_sum:=score_sum+total;end loop;
 total:=round(score_sum/8.0);level:=case when total<=30 then'Começando a construir a base'when total<=50 then'Fase de estruturação'when total<=70 then'Negócio em desenvolvimento'when total<=85 then'Negócio em crescimento'else'Base bem estruturada'end;
 stage:=case answers->>'business_stage'when'a'then'Começando'when'b'then'Em desenvolvimento'when'c'then'Em crescimento'else'Em estruturação'end;need:=case answers->>'primary_need'when'a'then'Conseguir mais clientes'when'b'then'Transformar mais conversas em agendamentos'when'c'then'Organizar contatos e rotina'else'Ganhar estabilidade e faturar mais'end;
 select key into bottleneck from jsonb_each_text(category_scores)order by value::integer,case key when'acquisition'then 1 when'service'then 2 when'organization'then 3 when'follow_up'then 4 when'metrics'then 5 when'demand'then 6 when'marketing'then 7 else 8 end limit 1;select key into strongest from jsonb_each_text(category_scores)order by value::integer desc,case key when'financial_clarity'then 1 when'marketing'then 2 when'demand'then 3 when'metrics'then 4 when'follow_up'then 5 when'organization'then 6 when'service'then 7 else 8 end limit 1;
 crm:=public.create_diagnostic_crm(org,actor,jsonb_build_object('name',trim(submission_data->>'name'),'whatsapp',regexp_replace(submission_data->>'whatsapp','\D','','g'),'instagram',regexp_replace(lower(submission_data->>'instagram'),'[^a-z0-9._]','','g'),'notes',format('Diagnóstico concluído · Score %s/100 · %s · Necessidade: %s · Gargalo: %s',total,level,need,bottleneck)));
 insert into public.diagnostic_submissions(organization_id,company_id,contact_id,opportunity_id,idempotency_key,name,business_name,whatsapp,email,instagram,total_score,result_level,business_stage,primary_need,primary_bottleneck,strongest_area,category_scores,utm_source,utm_medium,utm_campaign,utm_content,utm_term,referrer,landing_url,started_at)
 values(org,(crm->>'company_id')::uuid,(crm->>'contact_id')::uuid,(crm->>'opportunity_id')::uuid,idem,trim(submission_data->>'name'),trim(submission_data->>'name'),regexp_replace(submission_data->>'whatsapp','\D','','g'),null,regexp_replace(lower(submission_data->>'instagram'),'[^a-z0-9._]','','g'),total,level,stage,need,bottleneck,strongest,category_scores,submission_data#>>'{attribution,utmSource}',submission_data#>>'{attribution,utmMedium}',submission_data#>>'{attribution,utmCampaign}',submission_data#>>'{attribution,utmContent}',submission_data#>>'{attribution,utmTerm}',submission_data#>>'{attribution,referrer}',submission_data#>>'{attribution,landingUrl}',coalesce((submission_data->>'started_at')::timestamptz,now()))returning id,public_token into submission,token;
 foreach question in array array['acquisition','service','organization','follow_up','metrics','demand','business_stage','marketing','financial_clarity','primary_need']loop answer:=answers->>question;insert into public.diagnostic_answers(submission_id,question_key,answer_key,score,category)values(submission,question,answer,case when question in('business_stage','primary_need')then 0 else ascii(answer)-96 end,question);end loop;
 insert into public.lead_acquisitions(organization_id,company_id,contact_id,opportunity_id,source_id,provider,utm_source,utm_medium,utm_campaign,utm_content,utm_term,landing_page,referrer,captured_at,is_first_touch,is_last_touch,metadata,created_by)
 values(org,(crm->>'company_id')::uuid,(crm->>'contact_id')::uuid,(crm->>'opportunity_id')::uuid,(select id from public.marketing_sources where organization_id=org and slug in('quiz-diagnostico-do-negocio','diagnostico')order by created_at limit 1),'diagnostic',submission_data#>>'{attribution,utmSource}',submission_data#>>'{attribution,utmMedium}',submission_data#>>'{attribution,utmCampaign}',submission_data#>>'{attribution,utmContent}',submission_data#>>'{attribution,utmTerm}',submission_data#>>'{attribution,landingUrl}',submission_data#>>'{attribution,referrer}',now(),true,true,jsonb_build_object('diagnostic_submission_id',submission,'score',total,'level',level),actor);
 insert into public.activities(organization_id,company_id,opportunity_id,user_id,type,title,description,metadata)values(org,(crm->>'company_id')::uuid,(crm->>'opportunity_id')::uuid,actor,'diagnostic_completed','Diagnóstico do negócio concluído',format('Score %s/100 · %s',total,level),jsonb_build_object('submission_id',submission,'score',total,'level',level,'primary_need',need,'bottleneck',bottleneck));
 return jsonb_build_object('token',token);
end$$;
revoke all on function public.submit_public_diagnostic(jsonb)from public;grant execute on function public.submit_public_diagnostic(jsonb)to anon,authenticated;


notify pgrst,'reload schema';
