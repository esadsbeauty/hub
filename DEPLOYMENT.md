# Deploy na Vercel

## Variáveis obrigatórias

O frontend usa exclusivamente estas variáveis públicas, incorporadas pelo Vite durante o build:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Use a **Project URL** e a chave pública **anon/publishable** do projeto Supabase. Nunca configure `SUPABASE_SERVICE_ROLE_KEY`, access tokens ou refresh tokens no frontend.

## Configuração

1. Na Vercel, abra **Project Settings → Environment Variables**.
2. Cadastre as duas variáveis sem aspas, espaços ou quebras de linha.
3. Marque **Production**, **Preview** e **Development** conforme o ambiente que deverá autenticar.
4. Salve e execute um novo deployment. Variáveis Vite são resolvidas durante o build; alterar o painel não modifica um bundle já publicado.
5. No Supabase, em **Authentication → URL Configuration**, mantenha a URL de produção e os redirects de preview autorizados para os fluxos de recuperação de senha.

Repita o cadastro para cada escopo necessário. Uma variável configurada somente em **Production** não estará disponível em deployments de **Preview**. Depois de alterar qualquer variável, gere um novo deployment, pois o Vite incorpora os valores no bundle durante o build.

Branches que não são a branch de produção — incluindo branches `codex/...` — normalmente geram deployments com `VERCEL_ENV=preview`. Para elas, as duas variáveis precisam estar explicitamente habilitadas no escopo **Preview**.

Durante builds Vercel, o `prebuild` registra somente três informações não sensíveis: presença da URL, presença da chave pública e `VERCEL_ENV`. O resultado esperado para uma branch de preview é:

```text
[deployment-env] {"hasSupabaseUrl":true,"hasSupabaseAnonKey":true,"vercelEnv":"preview"}
```

Os valores da URL e da chave nunca são impressos.

## Obtenção dos valores

No painel do Supabase, abra **Project Settings → API**:

- copie **Project URL** para `VITE_SUPABASE_URL`;
- copie a chave **Publishable** ou a chave legada **anon/public** para `VITE_SUPABASE_ANON_KEY`;
- nunca copie a chave **Secret** nem a chave legada **service_role**.

O validador aceita chaves `sb_publishable_...` e JWTs legados cujo papel seja `anon`. Um JWT com papel `service_role` bloqueia o deployment mesmo que tenha formato sintaticamente válido.

O `prebuild` bloqueia deployments Vercel quando uma variável obrigatória estiver ausente. Localmente, a ausência apenas emite um aviso e a aplicação mantém o acesso bloqueado, sem autenticação simulada.

## Checklist pós-deploy

- A tela de login não mostra o alerta de serviço indisponível.
- Credenciais válidas entram; senha incorreta e email inexistente não entram.
- A sessão persiste após atualizar a página.
- Recuperação de senha retorna para uma URL autorizada.
- Logout remove a sessão e limpa os caches da aplicação.
- O bundle não contém `service_role` nem credenciais privadas.

Se a autenticação funcionar, mas a aplicação mostrar acesso pendente, confirme separadamente que o usuário possui `profile`, membership ativa, organização e papel. Não contorne esse estado criando autenticação local.

## Limites da configuração no repositório

Os valores reais não pertencem ao Git e não podem ser definidos por `vercel.json`. Eles devem ser cadastrados no projeto correto por alguém com acesso ao painel ou por uma automação autenticada da Vercel. O repositório consegue validar a presença e o tipo das variáveis, mas não consegue inventar ou recuperar credenciais ausentes.

## Diagnóstico seguro

Em desenvolvimento, a aplicação registra apenas se a configuração está ausente ou inválida. Nunca imprime URL, chave ou conteúdo de sessão. Em produção, o usuário recebe somente a mensagem segura de indisponibilidade.
