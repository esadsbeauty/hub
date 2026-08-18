# ESADS Beauty — Beauty Premium Minimal SaaS

## Princípios

Clareza antes de decoração; profundidade por interação; bordas apenas quando separam ou indicam foco. O produto usa uma única família operacional e champagne apenas como assinatura.

## Cores

- `background`: off-white quente `#FAF9F7`.
- `sidebar`: carvão `#0B0B0B`.
- `card`: branco.
- `foreground`: carvão suave.
- `muted`: cinza quente para contexto.
- `champagne`: `#C7A86B`, reservado a seleção, marca e foco.
- Estados usam verde, âmbar e vermelho discretos definidos por tokens semânticos.

## Tipografia

Manrope, pesos 400–700. Títulos de página usam 28px/600; seções 18px/600; conteúdo 14px/400–500; números importantes 700 no máximo. Conteúdo operacional não usa serifas.

## Espaçamento, raio e sombra

Escala: 4, 8, 12, 16, 24, 32, 40 e 48px. Controles usam raio de 12px, cards 18px e overlays 24px. Cards não recebem borda por padrão e usam `shadow-soft`; `shadow-overlay` fica restrita a menus, drawers e modais.

## Componentes

- **PageHeader:** título curto, descrição opcional e uma área de ações; eyebrow é excepcional.
- **Card:** superfície branca leve. Divisores internos substituem grids de bordas.
- **MetricCard:** label, número e contexto curto; definição técnica fica em `title`/tooltip.
- **Buttons:** primary escuro, outline para secundária, ghost para ações discretas e champagne somente em destaques especiais.
- **Inputs:** 40px, label externa, borda funcional e foco champagne acessível.
- **Badges:** retângulos suaves, apenas para estado ou prioridade relevante.
- **Tables:** header discreto, separadores sutis, hover leve e overflow horizontal no mobile.
- **Tabs:** navegação linear com indicador champagne; não são pills agrupadas.
- **Modals/Drawers:** título direto, conteúdo curto, ação principal e secundária.
- **Empty states:** uma frase clara e uma ação opcional; sem ilustrações pesadas.

## Layout responsivo

Sidebar fixa em desktop/notebook e menu escuro no mobile. Conteúdo possui máximo de 1440px. KPIs usam quatro colunas em desktop, duas em tablet e uma no mobile. Tabelas e Kanban preservam capacidade com scroll horizontal.
