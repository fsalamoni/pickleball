# 17.07 — Ranking, descoberta e anti-bolha

> Tudo aqui é **função pura em `feed/domain/ranking.js`**, com teste. O
> ranking nunca é "mágica do servidor": ele recebe candidatos e contexto e
> devolve ordem + explicação.

## 1. As quatro abas

| Aba | Como é montada | Ranqueada? |
|---|---|---|
| **Para você** | mistura de todas as fontes, ordenada por score | ✅ |
| **Seguindo** | só de quem sigo (pessoas + entidades), **cronológica pura** | ❌ nunca |
| **Descobrir** | em alta na semana, da minha cidade, autores sugeridos, hashtags | ✅ (outro peso) |
| **Oficial** | plataforma + arenas/clubes/professores que sigo, cronológica | ❌ |

A aba "Seguindo" ser cronológica pura **não é opcional**: é o contrato de
confiança com o usuário. Toda rede que tirou isso perdeu credibilidade.

## 2. Fontes de candidatos (Fase 1: consulta no cliente)

`collectCandidates(ctx)` dispara em paralelo, com limites pequenos:

| Fonte | Query | Limite |
|---|---|---|
| Seguidos | `author_key in [30 mais relevantes]`, `published_at desc` | 60 |
| Meu clube | `club_id == meuClube`, `published_at desc` | 20 |
| Minha cidade | `city == minhaCidade`, `visibility == public` | 20 |
| Oficiais | `author_type == 'platform'` + fixados | 5 |
| Em alta | `engagement_score desc`, últimas 72h | 20 |
| Sistema | `buildFeed()` do `social/` (torneios + procura-jogo) | 15 |
| Fixado | `feed_pinned/{global,city_X,club_Y}` | 3 |

Total: ~160 candidatos, deduplicados, para produzir 12-24 itens por página.
**Custo por sessão**: ~7 queries. Aceitável. Acima de 500 posts/dia, migrar
para `feed_timelines` (Fase 2) — o contrato de `rankFeed` não muda.

## 3. Score

```
score(post, ctx) =
    W_recency    · recency(post)          // 0.30
  + W_affinity   · affinity(post, ctx)    // 0.25
  + W_engagement · engagement(post)       // 0.20
  + W_context    · contextMatch(post,ctx) // 0.15
  + W_quality    · quality(post)          // 0.10
  + boosts
  − penalties
```

### Componentes

**`recency`** — decaimento exponencial com meia-vida configurável
(default 36h): `0.5 ^ (idadeHoras / half_life_hours)`.
Um post de 36h vale metade de um de agora. Depois de 5 dias é irrelevante.

**`affinity`** — o quanto essa fonte importa **para este usuário**:
```
+0.40 sigo o autor
+0.20 já reagi/comentei em posts dele nos últimos 30 dias (por interação)
+0.15 mesmo clube
+0.15 já joguei com essa pessoa (usa partner/oponente do histórico)
+0.10 mesma arena favorita
+0.10 fui mencionado
```
Somado e normalizado em [0,1].

**`engagement`** — `log(1 + reações + 2·comentários + 3·reposts) / log(1+K)`,
normalizado por idade (um post de 1h com 5 reações vale mais que um de 20h
com 8). Comentário pesa mais que reação; repost pesa mais que comentário.

**`contextMatch`** — mesma cidade (0.4), mesmo estado (0.2), post vinculado
a um torneio em que estou inscrito (0.6), a uma arena que reservo (0.4), a
um dia de jogo de que participei (0.5), a um anúncio da categoria que
favoritei (0.3).

**`quality`** — tem mídia (0.3), tem legenda com > 40 chars (0.2), tem
contexto vinculado (0.2), autor com histórico de bom engajamento (0.3).
Serve para não premiar post vazio.

**Boosts** (aditivos, sempre **sinalizados na UI**):
`+0.15` post oficial da plataforma · `+0.10` post fixado no escopo ·
`+0.10` autor novo com bom conteúdo (janela de descoberta de 7 dias) ·
`+0.05` tipo raro no feed do usuário (diversidade de formato).

**Penalidades**:
`−1.0` autor silenciado ou bloqueado (some) · `−1.0` post marcado como
"não tenho interesse" (some) · `−0.5` status `limited` (fora do ranking) ·
`−0.3` já visto nesta sessão · `−0.2` terceiro post seguido do mesmo autor.

### Diversidade (pós-processamento obrigatório)
Depois de ordenar, aplicar **intercalação**:
- máximo `diversity_max_per_author` (default 2) posts do mesmo autor nas
  primeiras 20 posições;
- nunca 3 posts do mesmo tipo em sequência;
- garantir ao menos 1 post `system` e 1 de descoberta a cada 10 itens.

Sem isso, um autor prolífico domina o feed de todo mundo em uma semana.

### Explicabilidade
`rankFeed` devolve, por item, `reason: { code, label }`:
```
'follow_author'    → "porque você segue Arena Pickle SP"
'past_interaction' → "porque você costuma interagir com Fernando"
'same_club'        → "do seu clube, Pickle Vila"
'same_city'        → "de São Paulo"
'trending'         → "em alta esta semana"
'official'         → "publicação oficial do PickleRush"
'tournament'       → "do Torneio de Verão, em que você está inscrito"
'system'           → "acontecendo na plataforma"
'pinned'           → "fixado"
```
O card mostra o `label`. Isso é requisito, não enfeite: um feed que a
pessoa entende é um feed em que ela confia.

## 4. Anti-bolha

- Cota de descoberta: **≥ 20%** dos itens do "Para você" vêm de autores
  que o usuário **não** segue.
- Autor novo (< 7 dias de primeiro post) ganha janela de exposição.
- Se o usuário só interage com um tipo, forçar ao menos 1 item de outro
  tipo a cada 10.
- "Não tenho interesse" afeta **aquele post e aquele autor por 30 dias**,
  não banimento permanente silencioso.

## 5. Descobrir

- **Em alta**: `feed_hashtags` por `trending_score` = `post_count_7d`
  ponderado por engajamento médio e novidade (uma tag que existe há anos
  não é "trending" por volume).
- **Perto de você**: posts públicos da cidade/estado, últimos 7 dias.
- **Autores sugeridos**: arenas onde o usuário já reservou, professores das
  suas arenas, clubes da cidade, atletas do mesmo clube ou nível parecido
  — sempre com o motivo visível.
- **Acontecendo agora**: torneios abertos, dias de jogo, quadras livres
  (reaproveitando as fontes que o `buildFeed` já conhece).

## 6. Arquivos de domínio

| Arquivo | Responsabilidade | Testes |
|---|---|---|
| `ranking.js` | score, boosts, penalidades, diversidade, `explain` | 46 |
| `candidates.js` | dedupe, merge de fontes, corte, janela temporal | 20 |
| `affinity.js` | afinidade a partir do histórico de interação | 18 |
| `trending.js` | score de hashtag, janela, mínimo de posts | 14 |
| `suggestions.js` | autores sugeridos + motivo | 16 |
| `visibility.js` | quem pode ver o quê (espelha as regras, no cliente) | 18 |
| `mentions.js` | parse de `@`, `#`, links, sanitização | 22 |
| `post.js` | normalizar/validar post por tipo | 34 |
| `postStatus.js` | máquina de estado do post | 16 |
| `comment.js` | validar comentário, 1 nível, ordenação | 20 |
| `reactions.js` | agregar, trocar, contar | 12 |
| `poll.js` | votar, apurar, encerrar, múltipla escolha | 18 |
| `identity.js` | `resolveAuthorOptions`, `authorKey`, snapshot | 22 |
| `follows.js` | `mergeFollowSources` (follows + feed_follows) | 14 |
| `preferences.js` | mute, não-interesse, auto-share | 16 |
| `limits.js` | rate limits, contagem, mensagens | 18 |
| `constants.js` | enums + labels | 6 |
| **Total** | | **~330** |

## 7. Quando migrar para fan-out (Fase 2)

Gatilhos (qualquer um):
- p95 de carregamento do feed > 1,5s;
- > 500 posts/dia;
- > 200 seguidos por usuário no percentil 90 (a query `in` de 30 deixa de
  representar).

Desenho: `onCreate` de `feed_posts` → Function escreve em
`feed_timelines/{seguidor}/items` (limitado a N seguidores por lote; para
autores com muitos seguidores, usar leitura mista: fan-out para os ativos +
consulta direta para os demais). `rankFeed` continua o mesmo, só muda a
origem dos candidatos.
