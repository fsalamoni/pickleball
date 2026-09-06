# 16.01 — Visão e escopo do Mercado

## 1. O problema real

Hoje, no pickleball brasileiro, a compra e venda acontece em **grupos de
WhatsApp e no Instagram**. Consequências que a comunidade já sente:

1. **Nada é encontrável.** Uma raquete anunciada some no scroll em 2 horas.
   Quem procura precisa perguntar "alguém tem uma Selkirk?" toda semana.
2. **Não existe reputação.** Comprar de um desconhecido é aposta. Não há
   histórico, avaliação, nem rastro de quem sumiu com o dinheiro.
3. **Arena e professor não têm vitrine.** A arena vende overgrip no balcão
   (PDV já existe na plataforma) mas não alcança quem não está lá. O
   professor vende pacote de aula por DM.
4. **A plataforma não captura valor da transação** que ela mesma origina:
   o atleta descobre o produto pelo torneio, pela arena, pelo colega — tudo
   dentro do PickleRush — e a venda vaza pra fora.
5. **A demanda é invisível.** Ninguém sabe que 40 pessoas procuram raquete
   de nível intermediário até R$ 800.

## 2. A proposta

Um marketplace **vertical no esporte e horizontal nos vendedores**: tudo de
pickleball, vendido por qualquer perfil da plataforma, com a confiança
vindo da identidade que a pessoa **já construiu** aqui (perfil, ranking,
clube, arena, histórico de jogos, conquistas).

O diferencial competitivo contra OLX/Mercado Livre/Instagram não é preço nem
logística — é **contexto**: o comprador vê que o vendedor é 4.2 no rating,
joga na Arena X, tem 300 partidas e 12 vendas com nota 4.9. Isso não existe
em lugar nenhum.

### Frase de posicionamento

> "O Mercado é onde a comunidade que já joga junta compra e vende junta."

## 3. Objetivos (o que precisa acontecer)

| # | Objetivo | Métrica | Meta 90 dias pós-lançamento |
|---|---|---|---|
| O1 | Dar vitrine à comunidade | anúncios ativos | 300 |
| O2 | Fazer a transação acontecer | pedidos concluídos/mês | 120 |
| O3 | Construir confiança | % pedidos com avaliação | > 60% |
| O4 | Trazer arena e professor | % anúncios de arena/prof./loja | > 35% |
| O5 | Reter | % compradores que voltam em 60d | > 25% |
| O6 | Não virar um problema | denúncias procedentes / anúncios | < 2% |
| O7 | Preparar monetização | GMV rastreado | R$ 150k acumulado |

## 4. Não-objetivos (escopo NEGATIVO — leia com atenção)

Estes itens estão **fora** e não devem ser implementados sem uma decisão nova:

- ❌ **Gateway de pagamento na Fase 1.** Nada de cartão, split, escrow,
  antecipação. Pagamento é **Pix manual + comprovante**, exatamente como já
  funciona em reserva de arena e PDV. Isso mantém o risco regulatório baixo
  e permite lançar rápido. Gateway é Fase 3 (§7).
- ❌ **Logística/frete calculado.** Nada de integração Correios/Melhor Envio,
  etiqueta, rastreio automático. Fase 1: retirada, combinado, ou envio com
  código de rastreio digitado à mão.
- ❌ **Estoque multi-depósito, variações complexas (SKU matrix).**
  Fase 1: variação simples (tamanho/cor) com estoque por variação.
- ❌ **Leilão.** Só preço fixo + oferta/contraproposta.
- ❌ **Vendedor internacional / multi-moeda.** Só BRL, só Brasil.
- ❌ **Nota fiscal / emissão.** A plataforma é intermediadora de anúncio; a
  obrigação fiscal é do vendedor. A plataforma só disponibiliza extrato.
- ❌ **Carrinho multi-vendedor.** Um pedido = um vendedor. Sempre.
- ❌ **Substituir o PDV da arena.** O PDV continua sendo a ferramenta de
  balcão. O Mercado é a vitrine externa. Ver `10-INTEGRACOES.md`.

## 5. Escopo POSITIVO da Fase 1 (o que entra)

### Ambiente público (comprador)
- Vitrine `/mercado` com destaques, categorias, "perto de você", recentes.
- Busca com filtros: categoria, subcategoria, atributos da categoria
  (marca, peso, condição...), faixa de preço, cidade/estado/raio, tipo de
  vendedor, forma de entrega, aceita oferta, nota do vendedor.
- Ordenação: relevância, mais recente, menor/maior preço, mais perto,
  melhor avaliado.
- Página do anúncio: galeria, descrição, atributos, entrega, políticas,
  vendedor (com contexto do PickleRush), anúncios relacionados, "quem viu
  também viu", denunciar, favoritar, compartilhar.
- Página pública do vendedor: catálogo, reputação, avaliações, políticas.
- Negociação: **fazer oferta** (com contraproposta) e **conversar** (chat
  contextual, reaproveitando o módulo `chat/`).
- Pedido: checkout de um vendedor, escolha de entrega, Pix manual, envio de
  comprovante, acompanhamento de status.
- Pós-venda: confirmar recebimento, avaliar, abrir disputa.
- "Minhas compras": pedidos, ofertas feitas, favoritos, buscas salvas,
  avaliações pendentes.
- **Procura-se** (`wanted`): o comprador publica o que quer comprar.

### Ambiente de gestão (vendedor)
- Onboarding de vendedor (aceite de termos, Pix, políticas, área de entrega).
- Painel com KPIs: visitas, favoritos, conversas, ofertas, pedidos, receita.
- CRUD de anúncio com rascunho, agendamento, duplicar, pausar, encerrar.
- Mídia: até 10 fotos por anúncio, com capa, ordem e recorte.
- Estoque e variações simples.
- Caixa de ofertas (aceitar / recusar / contrapropor / expirar).
- Kanban de pedidos com ações por etapa.
- Conferência de comprovante Pix.
- Entrega: retirada, combinado, envio com rastreio manual.
- Avaliações recebidas + resposta pública do vendedor.
- Financeiro: extrato, recebimentos, pedidos em aberto, exportar CSV.
- Configurações: políticas de troca/devolução, prazo de envio, modo férias.
- Analytics por anúncio: impressões, cliques, favoritos, conversão.

### Ambiente admin (plataforma)
- Configuração global (quem pode vender, limites, comissão, categorias,
  itens proibidos, moderação pré ou pós).
- Fila de moderação de anúncios + denúncias.
- Destaques (boost) — cortesia ou pago.
- Métricas de GMV, top vendedores, conversão, funil.
- Auditoria de tudo.

## 6. Princípios de desenho (herdados do CLAUDE.md, aplicados aqui)

1. **Tudo atrás de flag, default OFF.** `marketplace` é a flag mestra; sem
   ela a rota `/mercado` não existe, o item de menu não é renderizado e
   nenhuma coleção é lida.
2. **Aditividade absoluta.** Nenhuma coleção existente muda de shape.
   Nenhuma regra existente é afrouxada. Nenhum campo obrigatório novo.
3. **Regra de negócio em `domain/` puro e testado.** Preço, frete,
   máquina de estado do pedido, elegibilidade de venda, score de busca:
   tudo função pura com `.test.js`.
4. **Comando sem permissão não é renderizado** (lição do dia de jogo,
   `docs/15`). Botão desabilitado confunde; ausência é clara.
5. **pt-BR em tudo.**
6. **Auditoria em toda escrita relevante** (`auditService`).
7. **Nada de dado de contato exposto** antes do pedido: telefone e endereço
   só aparecem depois que o pedido é aceito (LGPD + anti-golpe).

## 7. Fases além da 1

| Fase | Nome | Conteúdo | Gatilho para começar |
|---|---|---|---|
| 1 | **Classificado com pedido** | tudo do §5, Pix manual | agora |
| 2 | **Confiança** | selo de verificado, escrow manual mediado pela plataforma, política de reembolso, disputa estruturada | > 100 pedidos/mês |
| 3 | **Pagamento de verdade** | gateway (Mercado Pago/Pagar.me) com split, comissão automática, cartão e parcelamento, antecipação | > 300 pedidos/mês E decisão societária sobre ser intermediador de pagamento |
| 4 | **Logística** | Melhor Envio/Correios, etiqueta, rastreio automático, frete calculado por CEP | > 40% dos pedidos com envio |
| 5 | **Lojista pro** | painel de loja, cupom, campanha, integração de estoque via CSV/API, assinatura mensal | > 10 lojas ativas |

## 8. Métricas de sucesso e instrumentação

Eventos a emitir via `analytics/` (o módulo já existe):

```
market_view_home, market_search{query,filters,results},
market_view_listing{listing_id,seller_type}, market_favorite,
market_contact_seller, market_offer_created{amount,list_price},
market_offer_accepted, market_checkout_started, market_order_placed{value},
market_payment_proof_sent, market_order_completed{value},
market_review_created{rating}, market_report_created{reason},
market_listing_created{type,category}, market_listing_published
```

Funil principal a acompanhar:
`view_listing → (contact | offer) → order_placed → paid → completed → review`

## 9. Critério de "pronto" da Onda U

O Mercado só é considerado entregue quando **todos** forem verdade:

- [ ] Um atleta consegue anunciar uma raquete usada com foto em < 3 min.
- [ ] Um comprador acha essa raquete filtrando por categoria + cidade.
- [ ] Comprador e vendedor negociam preço sem sair da plataforma.
- [ ] O pedido percorre `placed → paid → delivered → completed`.
- [ ] Os dois se avaliam e a nota aparece no perfil público do vendedor.
- [ ] Uma arena publica 5 produtos do PDV no Mercado sem redigitar nada.
- [ ] O admin desliga a flag e **nada** na plataforma quebra ou muda.
- [ ] Um anúncio denunciado chega na fila e o admin o remove com 2 cliques.
- [ ] `npm run lint` 0 erros, `npm run build` sem warning, todos os testes
      verdes, incluindo os novos (~180 do domínio + regras no emulador).
