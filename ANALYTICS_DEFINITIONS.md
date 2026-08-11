# Definições analíticas do CRM

## Princípios

- **Venda ganha não é recebimento:** `status = won` representa fechamento comercial. Faturamento, receita e pagamento pertencem ao futuro módulo Financeiro.
- **Timezone:** timestamps são persistidos em UTC e convertidos para `organizations.timezone` antes de aplicar períodos por dia. Datas sem horário, como `expected_close_date`, já representam uma data civil.
- **Moeda:** valores de banco usam `numeric`; os agregados não são persistidos e a interface formata em BRL.
- **Filtros:** pipeline, responsável e origem são aplicados antes dos cálculos. Registros com `deleted_at` são sempre excluídos.

## Indicadores

| Nome                  | Definição e fórmula                                                                                                         | Fonte                              | Data de referência                       |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ---------------------------------------- |
| Pipeline aberto       | `SUM(value)` para oportunidades `open`                                                                                      | `opportunities`                    | Estado atual; período não altera estoque |
| Pipeline ponderado    | `SUM(value × probability / 100)` para oportunidades `open`; probabilidade válida da oportunidade, com fallback para a etapa | `opportunities`, `pipeline_stages` | Estado atual                             |
| Pipeline gerado       | `SUM(value)` das oportunidades criadas no período                                                                           | `opportunities`                    | `created_at`                             |
| Vendas ganhas         | `SUM(value)` para oportunidades `won` encerradas no período                                                                 | `opportunities`                    | `won_at`                                 |
| Negócios perdidos     | Quantidade e `SUM(value)` para oportunidades `lost` no período                                                              | `opportunities`                    | `lost_at`                                |
| Win rate              | `won / (won + lost)`; abertas não entram no denominador                                                                     | `opportunities`                    | `won_at` e `lost_at`                     |
| Ticket médio          | Valor das vendas ganhas dividido pela quantidade de ganhos                                                                  | `opportunities`                    | `won_at`                                 |
| Ciclo médio           | Média em dias de `won_at - created_at` para vendas ganhas                                                                   | `opportunities`                    | `won_at`                                 |
| Forecast bruto        | `SUM(value)` das oportunidades abertas com fechamento previsto no período                                                   | `opportunities`                    | `expected_close_date`                    |
| Forecast ponderado    | `SUM(value × probability / 100)` do forecast bruto                                                                          | `opportunities`, `pipeline_stages` | `expected_close_date`                    |
| Follow-ups atrasados  | Follow-ups `pending` com `due_at < now()`                                                                                   | `tasks`                            | `due_at`                                 |
| Sem próximo passo     | Oportunidade aberta sem task futura pendente vinculada                                                                      | `opportunities`, `tasks`           | `due_at`                                 |
| Aging médio por etapa | Média entre entrada na etapa e próxima mudança, somente quando ambas existem                                                | `opportunity_stage_history`        | `changed_at` da entrada                  |
| Conversão de etapa    | Entre as oportunidades únicas que entraram na etapa no período, percentual que possui uma mudança posterior registrada      | `opportunity_stage_history`        | `changed_at` da entrada                  |

## Dados incompletos e limitações

- Oportunidades sem valor continuam nas quantidades, mas aparecem em “Qualidade do CRM”; sua ausência de valor não é ocultada.
- Oportunidades abertas sem `expected_close_date` não entram no forecast e são apresentadas explicitamente.
- Não existe `pipeline_stages.expected_days`; portanto, o sistema apresenta aging objetivo, mas não classifica automaticamente uma oportunidade como parada.
- Forecast histórico não pode ser reconstruído perfeitamente sem snapshots. Uma futura comparação “forecast inicial × realizado” poderá justificar `forecast_snapshots`, mas nenhuma tabela especulativa é criada nesta etapa.
