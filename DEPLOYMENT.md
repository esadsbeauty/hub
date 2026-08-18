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

O `prebuild` bloqueia deployments Vercel quando uma variável obrigatória estiver ausente. Localmente, a ausência apenas emite um aviso e a aplicação mantém o acesso bloqueado, sem autenticação simulada.

## Checklist pós-deploy

- A tela de login não mostra o alerta de serviço indisponível.
- Credenciais válidas entram; senha incorreta e email inexistente não entram.
- A sessão persiste após atualizar a página.
- Recuperação de senha retorna para uma URL autorizada.
- Logout remove a sessão e limpa os caches da aplicação.
- O bundle não contém `service_role` nem credenciais privadas.

## Diagnóstico seguro

Em desenvolvimento, a aplicação registra apenas se a configuração está ausente ou inválida. Nunca imprime URL, chave ou conteúdo de sessão. Em produção, o usuário recebe somente a mensagem segura de indisponibilidade.
