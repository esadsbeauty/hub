# Definições de Marketing Analytics

- **Lead:** company com um touchpoint de aquisição conhecido; não é venda nem nova entidade duplicada.
- **First Touch:** primeiro `lead_acquisition` conhecido da company. Nunca é sobrescrito.
- **Last Touch:** último touchpoint elegível anterior à criação da opportunity; não altera o First Touch.
- **Spend:** investimento diário registrado ou sincronizado. Conversões externas não equivalem a vendas CRM.
- **CPL:** spend / leads atribuídos. Sem leads, a métrica é não aplicável.
- **CPO:** spend / opportunities atribuídas. Sem opportunities, a métrica é não aplicável.
- **CAC de mídia:** spend / novos customer accounts atribuídos. Não inclui equipe, software ou overhead.
- **ROAS Comercial:** valor de opportunities won atribuídas / spend. Não representa caixa ou receita recebida.
- **Win Rate:** won / (won + lost) das opportunities atribuídas.
- **UTMs:** valores originais, preservados sem normalização automática.
- **Não atribuído:** ausência explícita de evidência; nunca é redistribuída silenciosamente.
- **Integrações:** credenciais pertencem a backend secrets/Vault. O banco público guarda apenas estado e IDs externos.

## Captura e idempotência

- Lead é uma `company` distinta com touchpoint capturado no período; um novo evento não duplica a empresa.
- First Touch é o primeiro evento conhecido e imutável; Last Touch é o evento elegível mais recente antes da conversão.
- Webhooks devem informar `provider` + `external_event_id`; a combinação é idempotente por organização.
- Credenciais de plataformas não fazem parte deste modelo e devem permanecer em Secrets/Vault no backend.
