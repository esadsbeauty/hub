# Definições financeiras gerenciais

- **Venda ganha:** evento comercial. Não cria caixa, receita reconhecida ou cobrança automaticamente.
- **Contrato/serviço:** informação contratual. Só origina títulos após ação explícita de configuração financeira.
- **Competência:** primeiro dia do mês econômico (`competence_date`). Base da DRE gerencial.
- **Vencimento:** data civil em que a obrigação deve ser liquidada (`due_date`). Base da projeção e inadimplência.
- **Caixa realizado:** transactions não estornadas, agrupadas por `occurred_at` no timezone da organização.
- **Saldo do título:** `net_amount - SUM(payment_allocations vinculadas a transactions não estornadas)`.
- **Valor líquido:** `original_amount - discount_amount + interest_amount + penalty_amount`.
- **Inadimplência:** recebível não cancelado, saldo positivo e vencimento anterior à data atual.
- **DRE gerencial:** títulos por competência e `financial_categories.dre_group`; não substitui contabilidade fiscal.
- **MRR:** recorrências de recebimento ativas normalizadas para mês; não representa caixa recebido.
- **Saldo da conta:** saldo inicial + entradas realizadas - saídas realizadas. Transferências não alteram resultado.
- **Recorrência:** materializa títulos com chave única `rule_id:YYYY-MM`; reprocessar o mesmo período não duplica cobranças.
