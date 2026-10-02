# Preparação da integração com Google Calendar

Esta entrega **não ativa OAuth nem sincronização**. A Agenda interna deve ser validada primeiro. Nenhuma credencial Google pode usar prefixo `VITE_` ou ser enviada ao navegador.

## Google Cloud Console

1. Criar ou selecionar um projeto em <https://console.cloud.google.com/>.
2. Habilitar **Google Calendar API** em APIs e serviços.
3. Configurar a tela de consentimento OAuth, domínio autorizado, e-mails de suporte e política de privacidade.
4. Criar um cliente OAuth 2.0 do tipo **Aplicativo da Web**.
5. Cadastrar somente origens reais da aplicação e, na etapa futura, uma URI de callback backend como `https://<project-ref>.supabase.co/functions/v1/google-calendar-oauth/callback`.
6. Durante testes externos, cadastrar explicitamente os usuários de teste. Para produção pública, concluir o processo de publicação/verificação exigido pelo Google.

Referências oficiais para a futura implementação:

- OAuth para aplicações web: <https://developers.google.com/identity/protocols/oauth2/web-server>
- Autorização da Calendar API: <https://developers.google.com/calendar/api/auth>
- Referência de eventos: <https://developers.google.com/calendar/api/v3/reference/events>
- Sincronização incremental: <https://developers.google.com/calendar/api/guides/sync>
- Push notifications: <https://developers.google.com/calendar/api/guides/push>

## Escopos mínimos propostos

- `https://www.googleapis.com/auth/calendar.events`: criar, atualizar e cancelar eventos.
- `https://www.googleapis.com/auth/calendar.calendarlist.readonly`: permitir a escolha de um calendário acessível.

Solicitar escopos adicionais somente quando um caso de uso aprovado exigir. O fluxo backend deverá solicitar acesso offline e tratar refresh tokens de forma criptografada.

## Secrets futuros no Supabase

Configurar apenas quando a Edge Function OAuth for implementada:

- `GOOGLE_CALENDAR_CLIENT_ID`
- `GOOGLE_CALENDAR_CLIENT_SECRET`
- `GOOGLE_CALENDAR_OAUTH_REDIRECT_URI`
- `GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY`
- `APP_PUBLIC_URL`

## Vercel / frontend

Não configurar `GOOGLE_CALENDAR_CLIENT_SECRET`, refresh token ou chave de criptografia na Vercel. O frontend futuro deverá receber somente uma URL de autorização temporária gerada pelo backend. As configurações públicas já existentes de URL do app e Supabase são suficientes para chamar a Edge Function autenticada.

## Fluxo futuro recomendado

1. Frontend solicita ao backend uma URL OAuth com `state` curto, assinado, expirável e vinculado ao usuário/tenant.
2. Callback backend valida `state`, troca o código, criptografa tokens e lista calendários.
3. Usuário escolhe o calendário.
4. Outbox idempotente envia criações, atualizações e cancelamentos ESADS → provider.
5. Webhook/push e sincronização incremental com `syncToken` atualizam provider → ESADS.
6. A identidade única `(organization_id, external_provider, external_calendar_id, external_event_id)` evita importações duplicadas.
7. `external_updated_at` e versões locais resolvem eventos fora de ordem; falhas permanecem em `external_sync_status='error'` para retry.

Antes dessa fase, validar política de retenção, criptografia de tokens, revogação da conexão, rotação de secrets e remoção dos dados importados.
