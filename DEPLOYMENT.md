# Deploy na Vercel

O rollout definitivo do banco, inventário completo das migrations e checklist pós-`db push` estão em [`SUPABASE_DEPLOYMENT.md`](./SUPABASE_DEPLOYMENT.md).

## Modos da aplicação

A aplicação possui uma única seleção central de infraestrutura:

```text
VITE_APP_MODE=local     # Development ou Vercel Preview
VITE_APP_MODE=supabase  # autenticação e banco reais
```

Para destravar um **Preview**, configure apenas `VITE_APP_MODE=local` no escopo Preview e gere um novo deployment. Esse modo fornece o Owner local `Admin ESADS Beauty`, ignora readiness, membership e bootstrap do banco, e utiliza os repositories locais de CRM, Clientes, Financeiro e Marketing. Agenda, Dashboard e Relatórios continuam usando os hooks do CRM e, portanto, refletem os dados locais.

A sessão fica em `sessionStorage`. Os dados de domínio ficam no namespace `esads-hub-local-v1:*` do `localStorage`; dados legados são lidos sem serem apagados. Nada é sincronizado automaticamente com o Supabase. O badge **Modo local** identifica essa condição no Hub.

Production falha fechado: `VITE_APP_MODE=local` bloqueia o prebuild quando `VERCEL_ENV` não é `preview`. Use `VITE_APP_MODE=supabase` em Production. A decisão não utiliza hostname; se `esadsbeauty.vercel.app` estiver associado a Preview, é o escopo da variável e `VERCEL_ENV` que controlam o modo.

### Bifurcação de inicialização

`src/main.tsx` lê o modo antes de montar autenticação ou autorização e carrega apenas uma das árvores:

```text
local    → LocalAuthProvider → LocalAppStateProvider → App
supabase → SupabaseAuthProvider → SupabaseAppStateProvider → App
```

Por isso, no modo local não são registrados listeners do Supabase Auth, não é executada a RPC `current_authorization` e a consulta de bootstrap permanece desabilitada. O console do navegador registra somente `{ appMode, isLocalMode }`, sem URLs, chaves ou sessões.

## Variáveis obrigatórias

No modo Supabase, o frontend usa estas variáveis públicas, incorporadas pelo Vite durante o build:

```text
VITE_SITE_URL
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Em Production, configure `VITE_SITE_URL=https://esadsbeauty.vercel.app`. Essa URL central é usada por cadastro e recuperação de senha; em desenvolvimento, quando ela estiver vazia, a aplicação usa a origem atual do navegador. Use a **Project URL** e a chave pública **anon/publishable** do projeto Supabase. Nunca configure `SUPABASE_SERVICE_ROLE_KEY`, access tokens ou refresh tokens no frontend.

## Configuração

1. Na Vercel, abra **Project Settings → Environment Variables**.
2. Cadastre as três variáveis sem aspas, espaços ou quebras de linha.
3. Marque **Production**, **Preview** e **Development** conforme o ambiente que deverá autenticar.
4. Salve e execute um novo deployment. Variáveis Vite são resolvidas durante o build; alterar o painel não modifica um bundle já publicado.
5. No Supabase, em **Authentication → URL Configuration**, configure **Site URL** como `https://esadsbeauty.vercel.app` e autorize `https://esadsbeauty.vercel.app`, `https://esadsbeauty.vercel.app/login` e `https://esadsbeauty.vercel.app/aceitar-convite` em **Redirect URLs**. Adicione URLs de Preview somente quando o ambiente realmente precisar autenticar.

Se o Supabase receber um redirect não autorizado, ele pode recorrer à **Site URL** configurada no painel. Portanto, um `redirect_to=http://localhost:3000` pode vir tanto do bundle antigo quanto de uma Site URL antiga no Supabase: atualize os dois locais e gere um novo deployment Vercel.

Repita o cadastro para cada escopo necessário. Uma variável configurada somente em **Production** não estará disponível em deployments de **Preview**. Para Preview Supabase, use a URL pública daquele deployment em `VITE_SITE_URL` e autorize-a no Supabase; para Preview local, a variável pode permanecer vazia. Depois de alterar qualquer variável, gere um novo deployment, pois o Vite incorpora os valores no bundle durante o build.

Branches que não são a branch de produção — incluindo branches `codex/...` — normalmente geram deployments com `VERCEL_ENV=preview`. Para elas, as três variáveis precisam estar explicitamente habilitadas no escopo **Preview** quando o modo Supabase for utilizado.

Durante builds Vercel, o `prebuild` registra somente informações não sensíveis: modo, presença da URL pública, presença da URL Supabase, presença da chave pública e `VERCEL_ENV`. O resultado esperado para uma branch de preview é:

```text
[deployment-env] {"appMode":"supabase","hasSiteUrl":true,"hasSupabaseUrl":true,"hasSupabaseAnonKey":true,"vercelEnv":"preview"}
```

Os valores da URL e da chave nunca são impressos.

## Obtenção dos valores

No painel do Supabase, abra **Project Settings → API**:

- copie **Project URL** para `VITE_SUPABASE_URL`;
- copie a chave **Publishable** ou a chave legada **anon/public** para `VITE_SUPABASE_ANON_KEY`;
- nunca copie a chave **Secret** nem a chave legada **service_role**.

O validador aceita chaves `sb_publishable_...` e JWTs legados cujo papel seja `anon`. Um JWT com papel `service_role` bloqueia o deployment mesmo que tenha formato sintaticamente válido.

O `prebuild` exige essas variáveis no modo Supabase. Em Preview local, elas não são necessárias porque nenhuma chamada Supabase é iniciada.

## Checklist pós-deploy

- A tela de login não mostra o alerta de serviço indisponível.
- Credenciais válidas entram; senha incorreta e email inexistente não entram.
- A sessão persiste após atualizar a página.
- Recuperação de senha retorna para uma URL autorizada.
- Cadastro confirmado retorna para `VITE_SITE_URL`, nunca para localhost em Production.
- Logout remove a sessão e limpa os caches da aplicação.
- O bundle não contém `service_role` nem credenciais privadas.

Se a autenticação funcionar, mas a aplicação mostrar acesso pendente, confirme separadamente que o usuário possui `profile`, membership ativa, organização e papel. Não contorne esse estado criando autenticação local.

## Limites da configuração no repositório

Os valores reais não pertencem ao Git e não podem ser definidos por `vercel.json`. Eles devem ser cadastrados no projeto correto por alguém com acesso ao painel ou por uma automação autenticada da Vercel. O repositório consegue validar a presença e o tipo das variáveis, mas não consegue inventar ou recuperar credenciais ausentes.

## Diagnóstico seguro

Em desenvolvimento, a aplicação registra apenas se a configuração está ausente ou inválida. Nunca imprime URL, chave ou conteúdo de sessão. Em produção, o usuário recebe somente a mensagem segura de indisponibilidade.

## Gestão de usuários pela Edge Function

A função `invite-user` executa convites, reenvios e cancelamentos. Configure no ambiente seguro das Edge Functions:

```text
APP_ORIGIN=https://esadsbeauty.vercel.app
```

`APP_ORIGIN` define a única origem aceita e o redirect de criação de senha. Em Production, mantenha seu valor igual à origem de `VITE_SITE_URL`. Use sempre o domínio principal de produção, nunca um Preview temporário.

O bootstrap inicial é executado diretamente por uma RPC autenticada. Aplique **todas** as migrations em ordem, incluindo `202608190001_self_service_initial_owner.sql` e `202608190002_harden_initial_owner_eligibility.sql`; se a RPC não existir, a interface mostra explicitamente que a configuração do banco está pendente em vez de classificar o usuário como sem autorização.

Enquanto não existir Owner ativo, o bootstrap é reservado de forma determinística ao usuário mais antigo de `auth.users` (ordenado por `created_at` e `id`). Assim, registros Auth adicionais não bloqueiam o usuário principal, mas o segundo usuário também não pode reivindicar a organização. O claim usa `auth.uid()`, lock transacional e uma segunda verificação de Owner no banco; nenhum email, usuário ou organização é aceito livremente do frontend.

`SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` são consumidas somente dentro da Edge Function. A chave privilegiada nunca deve receber prefixo `VITE_`, ser enviada à Vercel como variável do frontend ou aparecer em logs.

Após aplicar migrations, publique a função novamente e autorize no Supabase Auth:

- **Site URL:** domínio principal do Hub;
- **Redirect URL:** `https://esadsbeauty.vercel.app/aceitar-convite`;
- redirects de recuperação de senha realmente utilizados.
