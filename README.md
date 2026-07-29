# ESADS Beauty Hub Interno

Plataforma SaaS interna criada com React, TypeScript, Vite, Tailwind CSS, shadcn/ui-style primitives, Supabase, PostgreSQL, React Query, React Hook Form, Zod e Lucide.

## Fundação arquitetural

- `src/shared/components`: biblioteca interna reutilizável para layout, feedback, tabelas, filtros, métricas, overlays e navegação.
- `src/shared/state`: estado global de organização, tema, sessão operacional, preferências e permissões.
- `src/shared/permissions`: RBAC preparado para Administrador, Gestor, Consultor, Financeiro, Marketing e Operacional, com controle por módulo, página, ação, botão e recurso.
- `src/modules`: features independentes; novos módulos devem ser adicionados aqui sem reestruturar a aplicação.
- `src/layouts/AppLayout`: layout global obrigatório com sidebar, topbar, breadcrumb, busca global, notificações, perfil, ações rápidas, conteúdo e footer.

## CRM Enterprise

O CRM é o módulo principal e contém empresas, contatos, timeline, follow-ups, agenda comercial, arquivos, observações, tags, pipeline Kanban com drag-and-drop nativo, filtros, busca e Central da Empresa 360°.

## Execução

1. Copie `.env.example` para `.env` e configure Supabase.
2. Rode a migration em `supabase/migrations`.
3. Execute `npm install` e `npm run dev`.

Sem variáveis Supabase, o app libera um modo preview local com `localStorage`; autenticação real usa Supabase Auth.
