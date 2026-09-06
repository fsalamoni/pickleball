# 16.10 — Integrações do Mercado com o resto da plataforma

> O valor do Mercado vem justamente de estar **dentro** do PickleRush.
> Cada integração abaixo é aditiva e desligável.

## 1. PDV / estoque da arena (`marketplace_arena_sync`)

**Fonte da verdade**: `arena_inventory_products` / `arena_products`.
O Mercado **espelha**, nunca duplica.

```
arena_inventory_products/{id}          market_listings/{id}
  name, price, stock, category   ──▶   title, price_cents, quantity, category_slug
                                       source: { kind:'arena_product', id, sync:true }
```

- Aba nova "Mercado" em `/arenas/:id/gerir/pdv` com toggle por produto e
  ação em massa.
- `syncArenaProductToListing` (Cloud Function) mantém preço e estoque em dia.
- Venda no Mercado → cria `arena_sales` com `channel: 'marketplace'`
  (campo novo, opcional) e baixa o estoque pelo caminho já existente.
- Editar o anúncio espelhado no Mercado: bloqueado nos campos sincronizados
  (preço/estoque), liberado nos de vitrine (fotos, descrição, atributos).
- Desligar o toggle → anúncio vai para `paused`, não é apagado.

**O que NÃO fazer**: escrever em `arena_products` a partir do Mercado, ou
mover o PDV para dentro do Mercado. São produtos diferentes com donos
diferentes.

## 2. Catálogo padrão (`catalog_products`)

Já existe, com semente em código + contribuição das arenas + moderação do
admin. O Mercado usa como **dicionário de produtos**:
- typeahead no passo 2 do wizard (`ProductTypeahead` já existe — reusar);
- ao escolher, preenche marca, categoria e atributos;
- guarda `catalog_ref` no anúncio → permite "todos os anúncios desta
  raquete", comparação de preço e histórico ("média dos últimos 90 dias:
  R$ 640") — matador para confiança.
- Anúncio sem correspondência pode **sugerir** um item novo ao catálogo
  (mesmo fluxo de contribuição da arena, com dedupe).

## 3. Professor (`coaches/`)

- `coach_packages` vira anúncio `service` com um clique.
- Pedido concluído de pacote → crédito no `coach_students` do aluno
  (integração com `COACH_STUDENT_PROGRESS`).
- Clínica (`coach_clinics`) vira anúncio `experience` com vagas = estoque.
- O perfil público do professor ganha uma aba "À venda".

## 4. Clube (`clubs/`)

- Clube vende uniforme/kit; membros veem no `V2ClubDetail` uma aba "Loja".
- Anúncio com `visibility: 'club'` (Fase 2) — só membros veem.

## 5. Chat (`chat/`)

Campo `context` aditivo em `conversations` (ver `08-NEGOCIACAO §2`).
Zero mudança nas conversas existentes.

## 6. Notificações e push
27 tipos novos (`08-NEGOCIACAO §8`), preferências novas, push reaproveita
`pushService` + `push_tokens` (já existem, atrás de `push_notifications`).

## 7. Busca global (`V2Search`)
Ganha uma seção "Mercado" com os 5 melhores anúncios do termo. Aditivo:
a busca federada já mistura atletas/torneios/arenas/clubes.

## 8. Feed (docs/17) — a ponte mais valiosa
- Anúncio pode ser **compartilhado no Feed** (post `type: 'listing'`, com
  card rico); o botão fica no anúncio e no painel do vendedor.
- Post de anúncio no Feed conta como `impressions` no `market_listing_stats`.
- Arena/professor divulgam promoções no Feed apontando pra loja deles.
- Isso é o que faz o Mercado ter tráfego sem mídia paga.

## 9. Perfil do atleta (`V2AthleteProfile`)
Aba nova "À venda" (só se tiver anúncio ativo) + selo de vendedor com nota.
Aditivo, some com a flag.

## 10. Gamificação (`gamification_v2`)
Conquistas novas (só quando as duas flags estiverem ligadas):
"Primeira venda", "Vendedor 5 estrelas", "10 vendas", "Primeira compra",
"Reciclou equipamento" (vendeu usado). Nenhuma dá XP de jogo — categoria
própria, para não distorcer o ranking esportivo.

## 11. Nível unificado (`docs/13`)
Usado **só como contexto de confiança** no card do vendedor (exibição).
**Nunca** como fator de ranqueamento de anúncio — misturar habilidade
esportiva com relevância comercial é injusto e não se justifica.

## 12. Legal (`legal/`)
Documento novo `market_terms` no centro legal, com versionamento e
`legal_consents/{uid}_market_terms`. Bump de versão força novo aceite antes
de publicar ou comprar.

## 13. Observabilidade (`analytics/`, `observabilityService`)
Eventos do funil + captura de erro nas telas críticas (checkout, upload,
pagamento). Checkout que falha silenciosamente é o pior bug possível aqui.
