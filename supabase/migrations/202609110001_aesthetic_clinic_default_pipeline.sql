-- New organizations receive the aesthetic-clinic commercial template.
-- Existing tenant pipelines and opportunities are intentionally untouched.
create or replace function public.create_default_pipeline(target_organization_id uuid)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  new_pipeline_id uuid;
begin
  insert into public.pipelines(organization_id,name,description,is_default)
  values(
    target_organization_id,
    'Pipeline Comercial · Clínica de Estética',
    'Atendimento, avaliação, proposta, agendamento e fechamento',
    true
  )
  returning id into new_pipeline_id;

  insert into public.pipeline_stages(
    pipeline_id,name,slug,position,probability,is_won,is_lost
  ) values
    (new_pipeline_id,'Novo Lead','novo_lead',0,10,false,false),
    (new_pipeline_id,'Primeiro Contato','primeiro_contato',1,20,false,false),
    (new_pipeline_id,'Qualificação','qualificacao',2,30,false,false),
    (new_pipeline_id,'Avaliação Agendada','avaliacao_agendada',3,45,false,false),
    (new_pipeline_id,'Avaliação Realizada','avaliacao_realizada',4,55,false,false),
    (new_pipeline_id,'Proposta Apresentada','proposta_apresentada',5,70,false,false),
    (new_pipeline_id,'Em Negociação','em_negociacao',6,80,false,false),
    (new_pipeline_id,'Procedimento Agendado','procedimento_agendado',7,90,false,false),
    (new_pipeline_id,'Cliente Fechado','cliente_fechado',8,100,true,false),
    (new_pipeline_id,'Não Compareceu','nao_compareceu',9,35,false,false),
    (new_pipeline_id,'Perdido','perdido',10,0,false,true);

  return new_pipeline_id;
end
$$;

-- Pipeline creation remains an internal bootstrap operation.
revoke all on function public.create_default_pipeline(uuid) from public,anon,authenticated;
