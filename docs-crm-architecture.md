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
