# Segurança e Governança — Definições

## Decisões arquiteturais

- **Autenticação:** Supabase Auth permanece como fonte de identidade, sessão, refresh e recuperação de senha.
- **Membership:** `organization_members` é a fonte de vínculo e status. `profiles.organization_id` e `profiles.role` permanecem temporariamente para compatibilidade e não autorizam operações.
- **Autorização:** permissões de negócio são associadas a roles; frontend usa a mesma nomenclatura consultada pelo banco.
- **Escopo atual:** organização. Escopos por owner/equipe ficam preparados para evolução posterior.
- **Suspensão:** remove acesso ao tornar `current_organization_id()` nulo, sem apagar profile, ownership ou histórico.
- **Auditoria:** `audit_logs` é append-only para clientes. Senhas, tokens, secrets, service-role e CVV são removidos pelo helper central.
- **Financeiro:** leitura, gestão e estorno são permissões distintas e verificadas no PostgreSQL.
- **Convites:** nenhum convite fictício é executado pelo browser. O envio de email deve ser implementado em Edge Function/backend com JWT, rate limit e secret server-side.
- **Secrets:** o frontend aceita somente URL e anon key públicas do Supabase. Tokens de integrações pertencem a Secrets/Vault.

## Cadastro público controlado

- O frontend envia ao Supabase Auth somente nome, email e senha; função, organização e status nunca são escolhidos pelo cliente.
- `complete_registration()` usa `auth.uid()` e advisory lock transacional. Sem Owner ativo, exatamente um usuário recebe `owner/active`; os demais permanecem `pending` com role estrutural sem permissões efetivas.
- Membership `pending` não resolve `current_organization_id()` e, portanto, não atravessa as policies dos dados comerciais.
- Aprovação exige `users.manage`, rejeita a role Owner e registra `user_approved` e `user_role_assigned`; recusa registra `user_rejected`.

## Papéis padrão

Administrador, Gestor, Comercial, Operacional, Financeiro, Marketing e Leitura. A coluna enum legada em `profiles` não é removida nesta migration.
