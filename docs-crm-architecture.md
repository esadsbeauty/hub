# Fundação arquitetural do CRM

## Limites de domínio

- **Organization** é o tenant e delimita segurança, usuários e dados comerciais.
- **Company** representa uma organização prospectada ou cliente e não contém estado, etapa ou valor de negociação.
- **Contact** representa uma pessoa vinculada à empresa.
- **Opportunity** representa cada negociação e é a única entidade movimentada no pipeline.
- **Pipeline** e **PipelineStage** são dados configuráveis; nomes, ordem e probabilidade não são enums do frontend.
- **Task** centraliza follow-ups e futuras tarefas operacionais. A condição “atrasada” é calculada por prazo e status.
- **Activity** é o feed imutável e reutilizável de eventos de negócio.

## Segurança e evolução

Todas as entidades comerciais carregam `organization_id`. As políticas RLS consultam a organização do perfil autenticado, de modo que o isolamento não depende da interface. Exclusões comerciais são lógicas (`deleted_at`). O pipeline padrão é criado no provisionamento da organização, e mudanças de etapa geram atividades no banco e no repositório de preview.

O repositório mantém a UI separada do mecanismo de persistência. O modo local existe somente para desenvolvimento sem credenciais; o schema PostgreSQL é a fonte de verdade para produção.

## Experiência operacional

A Central da Empresa deriva o relacionamento a partir das oportunidades: negócio ganho identifica cliente, oportunidade aberta identifica negociação e ausência de ambos identifica prospect. O Kanban movimenta exclusivamente oportunidades e registra cada transição em `opportunity_stage_history` e `activities`. O valor ponderado permanece calculado (`value × probability`) e não é persistido.

As operações do frontend passam por um data source único. Com as variáveis do Supabase configuradas, o CRM usa PostgreSQL e as políticas RLS; sem credenciais, utiliza somente o repositório local de preview. Nenhum componente acessa o cliente Supabase diretamente. As query keys permanecem centralizadas para permitir consultas paginadas por entidade sem alterar a UI.

As migrations incrementais alinham o modelo operacional sem apagar registros: completam os campos de empresas e contatos, garantem um único contato principal ativo e registram automaticamente atividades de empresas, contatos, oportunidades, notas e tarefas. Novos perfis recebem o papel mínimo `member`; privilégios administrativos deixam de ser concedidos automaticamente no cadastro.

## Agenda, tarefas e timeline

`tasks` é a única fonte de planejamento operacional para follow-ups, ligações, WhatsApp, email, reuniões e tarefas genéricas. O vencimento usa `due_at TIMESTAMPTZ`; o banco persiste UTC e a interface converte para o fuso do navegador do usuário. “Atrasada” é uma condição calculada (`pending` e `due_at < now()`), nunca um status persistido.

`activities` registra apenas fatos já ocorridos e permanece append-only para o usuário autenticado. Os RPCs `complete_task`, `reschedule_task` e `cancel_task` mantêm alteração e auditoria na mesma transação; o trigger registra autor, entidade, prazo anterior e novo prazo. A agenda consulta somente o intervalo diário, semanal ou mensal visível e mantém chaves de cache específicas por intervalo.

## Fundação de pós-venda

- `companies` continua sendo a identidade cadastral; `customer_accounts` representa o relacionamento de cliente e é único por organização/empresa.
- O fechamento de uma oportunidade ativa o relacionamento de forma idempotente. Novas vendas da mesma empresa não duplicam a conta.
- `services` é o catálogo configurável; `customer_services` preserva o serviço e o preço negociado de cada contratação. O valor é comercial/contratual e não representa pagamento.
- `onboardings` descreve o processo, `onboarding_steps` descreve sua estrutura e `tasks` continua sendo a fonte de ações agendadas. O vínculo opcional é `onboarding_steps.task_id`.
- `contracts.value` é o valor total do acordo; `customer_services.agreed_price` é o preço por intervalo do serviço. Contratos históricos não são sobrescritos.
- A oportunidade atual ainda possui valor global. Vários itens por oportunidade exigirão `opportunity_items` quando houver regra de produto confirmada; a tabela não foi criada prematuramente.
