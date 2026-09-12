# Integração Asaas (provider-neutral)

## Escopo

A primeira implementação entrega cobrança avulsa por Pix. Cartão e recorrência externa foram deliberadamente adiados para não manipular PAN, CVV ou ampliar o escopo PCI. O ciclo da assinatura continua sendo controlado pelo domínio interno.

## Configuração local/staging

Configure somente como secrets das Supabase Edge Functions:

- `PAYMENT_PROVIDER=asaas`
- `ASAAS_API_KEY`: chave do ambiente Asaas usado
- `ASAAS_BASE_URL=https://api-sandbox.asaas.com/v3` para sandbox
- `ASAAS_WEBHOOK_TOKEN`: token forte configurado também no webhook do Asaas
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`: secrets padrão do backend
- `APP_ORIGIN`: origem exata do frontend

Produção pode usar outro `ASAAS_BASE_URL`, sem alteração no domínio. Nunca crie variáveis `VITE_ASAAS_*`.

## Recursos HTTP usados

- `POST /customers`: criação do customer externo.
- `GET /payments?externalReference=...`: reconciliação idempotente antes de emitir novamente.
- `POST /payments`: cobrança avulsa com `billingType=PIX`.
- `GET /payments/{id}`: sincronização da cobrança.
- `GET /payments/{id}/pixQrCode`: QR Code e Pix Copia e Cola gerados pelo provider.
- `DELETE /payments/{id}`: disponível no adapter, ainda não exposto na UI.

Referências oficiais para revisão antes do deploy:

- https://docs.asaas.com/reference/criar-novo-cliente
- https://docs.asaas.com/reference/criar-nova-cobranca
- https://docs.asaas.com/reference/obter-qr-code-para-pagamentos-via-pix
- https://docs.asaas.com/docs/webhooks

## Webhook

A função `asaas-webhook` tem verificação JWT desativada porque o chamador é o provider, mas exige que o header `asaas-access-token` corresponda ao secret `ASAAS_WEBHOOK_TOKEN` antes de ler/processar o JSON.

Eventos processados:

- `PAYMENT_CREATED`
- `PAYMENT_RECEIVED`
- `PAYMENT_CONFIRMED`
- `PAYMENT_OVERDUE`
- `PAYMENT_REFUNDED`
- `PAYMENT_DELETED`

Configure no painel Asaas a URL da Edge Function e o mesmo token forte. Use sandbox, gere uma cobrança Pix, reenvie cada webhook e confirme a idempotência antes de habilitar produção.

## Deploy manual (após revisão)

1. Aplicar `202609030001_provider_neutral_billing_integration.sql` em staging.
2. Definir os secrets acima sem commitar valores.
3. Publicar `create-billing-charge` com JWT habilitado.
4. Publicar `asaas-webhook` e configurar o token no painel Asaas.
5. Testar customer, cobrança, QR Pix, evento duplicado, valor divergente, overdue, refund e falha/retry.
6. Somente depois repetir a configuração com base URL e chave de produção.
