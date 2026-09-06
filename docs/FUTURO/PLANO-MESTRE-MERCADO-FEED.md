# 19 — PLANO MESTRE: Mercado + Feed + Moderação

> **Status: 📐 PLANEJADO — nada implementado.**
> Cronograma consolidado das três ondas, com dependências, paralelismo,
> ordem de flags e critérios de parada.
>
> Detalhes em `docs/FUTURO/MERCADO/`, `docs/FUTURO/FEED/` e
> `docs/FUTURO/CONFIANCA-E-MODERACAO/`.

## 1. As três ondas

| Onda | Nome | PRs | Testes | Arquivos | Esforço (1 dev) |
|---|---|---|---|---|---|
| **U** | Mercado | U0-U9 (10) | ~599 | ~212 | 9-12 semanas |
| **V** | Feed | V0-V9 (10) | ~658 | ~170 | 8-11 semanas |
| **M** | Moderação | M1 (1) | ~233 | ~34 | 2-3 semanas |
| | **Total** | **21 PRs** | **~1.490** | **~416** | **19-26 semanas** |

Com dois desenvolvedores em paralelo: **11-14 semanas**.

### Impacto agregado na plataforma

| Métrica | Hoje | Depois | Delta |
|---|---|---|---|
| Módulos | 20 | 23 | +3 (`marketplace`, `feed`, `moderation`) |
| Páginas V2 | 78 | 102 | +24 |
| Coleções Firestore | 121 | 157 | +36 |
| Índices compostos | 32 | 96 | +64 |
| Feature flags ativas | 15 | 32 | +17 |
| Cloud Functions | 10 | 37 | +27 |
| Testes Vitest | 2.867 | ~4.357 | +1.490 |
| Rotas V2 | ~90 | ~121 | +31 |
| Custo Firebase/mês (3k MAU) | ~US$ 5 | ~US$ 65-130 | +US$ 60-125 |

**Isto é uma expansão grande.** Não é um sprint; é um semestre de produto.
O plano é feito para poder parar em qualquer PR com a plataforma inteira e
funcional.

## 2. Dependências

```
        ┌─────────────────────────────────────────────┐
        │              U0 · Domínio Mercado           │
        └───────────────────┬─────────────────────────┘
                            ▼
        ┌─────────────────────────────────────────────┐
        │              U1 · Dados e regras            │
        └───────┬─────────────────────────┬───────────┘
                ▼                         ▼
        ┌───────────────┐         ┌───────────────┐
        │ U2 · Vitrine  │         │ V0 · Domínio  │  ← pode começar
        │ U3 · Anúncio  │         │      Feed     │     em paralelo
        └───────┬───────┘         └───────┬───────┘
                ▼                         ▼
        ┌───────────────┐         ┌───────────────┐
        │ U4 · Vendedor │         │ V1 · Dados    │
        │ U5 · Negoc.   │         │ V2 · Timeline │
        │ U6 · Pedidos  │         │ V3 · Composer │
        └───────┬───────┘         │ V4 · Interação│
                │                 └───────┬───────┘
                │                         ▼
                │                 ┌───────────────┐
                └────────────────▶│  M1 · MODERAÇÃO│ ◀── bloqueia o
                                  └───────┬───────┘     lançamento público
                                          ▼             das DUAS
        ┌─────────────────────────────────────────────┐
        │ U7 Reputação · U8 Admin  │ V5 Identidades   │
        │ U9 Integrações           │ V6 Ranking       │
        │                          │ V7 Vídeo         │
        │                          │ V9 Admin         │
        └─────────────────────────────────────────────┘
                            ▼
                   Onda W · Convergência
```

**Regra dura**: nem Mercado nem Feed vão a público sem **M1**.

## 3. Cronograma recomendado (2 desenvolvedores)

| Semana | Dev A (Mercado) | Dev B (Feed) |
|---|---|---|
| 1-2 | U0 domínio | V0 domínio |
| 3-4 | U1 dados/regras | V1 dados/regras |
| 5-6 | U2 vitrine · U3 anúncio | V2 timeline |
| 7-8 | U4 vendedor | V3 composer/mídia |
| 9 | U5 negociação | V4 interação |
| 10-11 | U6 pedidos | **M1 moderação** |
| 12 | U7 reputação | V5 identidades |
| 13 | U8 admin+functions | V6 ranking |
| 14 | U9 integrações | V7 vídeo · V9 admin |
| 15 | **Onda W — convergência, beta fechado** | |
| 16-18 | **Beta com 3 arenas + 30 atletas · medir · corrigir** | |
| 19 | **Abertura gradual** | |

## 4. Ordem de ligação das flags (produção)

```
Etapa 0 (dogfood, só admin)
  marketplace · feed
Etapa 1 (convidados: 5 vendedores, 3 arenas, 3 professores)
  + content_moderation ⚠ OBRIGATÓRIA A PARTIR DAQUI
  + marketplace_offers · feed_identities
Etapa 2 (beta fechado, 2 semanas)
  + marketplace_orders · feed_polls · feed_reshare
Etapa 3
  + marketplace_reviews · feed_ranking · feed_auto_share
Etapa 4
  + marketplace_shipping · marketplace_wanted · marketplace_arena_sync
  + feed_market_bridge
Etapa 5 (último, medindo custo)
  + feed_video · marketplace_promotions
```

Critério para avançar: zero bug crítico aberto · funil sem queda
inexplicada · custo dentro do previsto · fila de moderação sob controle.

## 5. Onda W — Convergência (pós U9 + V9)

| Item | O que é |
|---|---|
| W1 | Compartilhar anúncio no Feed (ponte completa) |
| W2 | Busca global inclui anúncios e publicações |
| W3 | Abas "Publicações" e "À venda" nos perfis de atleta, arena, professor e clube |
| W4 | Home unificada: "No feed agora" + "Novidades no Mercado" |
| W5 | Notificações unificadas e agrupadas, com preferências por grupo |
| W6 | Push (PWA) para feed e mercado |
| W7 | Cache offline do feed no service worker (bump `sw-vN`) |
| W8 | SEO/OG das páginas públicas (**só se a decisão de exposição pública for tomada**) |
| W9 | Conquistas de gamificação social e comercial |
| W10 | Passada final de UX/UI, acessibilidade e microcopy |

## 6. O que pode ser cortado se o tempo apertar

Em ordem de corte (do mais dispensável ao menos):

1. `marketplace_promotions` — destaque pago. Não há demanda ainda.
2. `feed_video` — o feed funciona muito bem só com foto.
3. `marketplace_wanted` — "procura-se" é ótimo, mas não é o núcleo.
4. `feed_reshare` — repost pode vir depois.
5. `marketplace_shipping` — começar só com retirada e combinar.
6. `feed_ranking` — lançar cronológico e ligar o ranking depois (na verdade
   isto é **recomendado**, não um corte).
7. U9/V9 integrações mais finas (analytics por anúncio, painel da entidade).

**O que NÃO pode ser cortado, em hipótese alguma:**
- M1 (moderação) — é o que separa produto de passivo.
- Compressão de imagem (U3/V3) — é o que separa custo previsível de conta cara.
- Testes de regras — é o que separa dados protegidos de vazamento.
- Runtime test de flag OFF — é o que garante que nada quebra o que existe.

## 7. Riscos do programa (não das ondas)

| # | Risco | Mitigação |
|---|---|---|
| PR1 | Ambos ficam pela metade e nada vai ao ar | Ordem por PR entregável; cada PR sozinho é reversível e útil |
| PR2 | Custo do Firebase surpreende | Medir a cada etapa de flag; alertas de budget; vídeo por último |
| PR3 | Moderação vira trabalho de gente em tempo integral | Rate limits apertados no começo; auto-moderação; abrir devagar |
| PR4 | O núcleo esportivo (torneios, arenas, dia de jogo) fica sem manutenção | Reservar 20% do tempo para o núcleo em todas as semanas |
| PR5 | Marketplace e Feed vazios se lançados juntos e vazios | Semear conteúdo antes; lançar o Feed primeiro (dá tráfego ao Mercado) |
| PR6 | Complexidade sobe demais para uma pessoa manter | Documentação (estes docs), domínio puro testado, aditividade estrita |

### Recomendação de sequência, se for para escolher uma só

**Comece pelo Feed.** Razões:
1. Custo menor e risco legal menor (sem dinheiro envolvido).
2. Gera o hábito diário que a plataforma ainda não tem.
3. Cria o tráfego que o Mercado vai precisar para não nascer deserto.
4. A infraestrutura de moderação nasce ali e o Mercado herda pronta.
5. Feed vazio ainda tem conteúdo (as fontes `system` já existem); Mercado
   vazio é uma prateleira vazia.

## 8. Como retomar este plano

1. Leia `CLAUDE.md` §2 (princípios) — eles valem para tudo aqui.
2. Leia o `00-INDEX.md` da onda que vai tocar.
3. Leia o `11-PLANO-DE-DESENVOLVIMENTO.md` da onda e escolha o próximo PR.
4. Leia o `README.md` do módulo em `src/modules/{marketplace,feed,moderation}/`.
5. Crie o worktree, o branch, e siga o checklist de entrega do CLAUDE.md §7.
6. Ao concluir um PR, marque-o no `11-PLANO` da onda e atualize as métricas
   do CLAUDE.md §10.
