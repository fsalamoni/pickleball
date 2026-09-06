# 17.03 — Tipos de post, identidades e visibilidade

## 1. Tipos de post (`POST_TYPE`)

| Tipo | Quem pode | Conteúdo | Card |
|---|---|---|---|
| `text` | todos | ≤ 2000 chars, menções, hashtags, links | texto puro |
| `photo` | todos | 1-10 imagens + legenda | galeria/carrossel |
| `video` | todos (flag `feed_video`) | 1 vídeo ≤ 90s / 100MB + legenda + capa | player |
| `poll` | todos (flag `feed_polls`) | pergunta + 2-6 opções + prazo | enquete com barras |
| `link` | todos | URL + título/desc (fornecidos; preview automático é Fase 2) | card de link |
| `event` | arena, clube, professor, organizador, plataforma | vincula torneio / evento de clube / dia de jogo | card com data e CTA |
| `announcement` | arena, clube, professor, loja, plataforma | comunicado com destaque visual | card oficial |
| `listing` | quem tem o anúncio | vincula `market_listings` | card do anúncio + preço |
| `match_result` | atleta (opt-in) | resultado de jogo/dia de jogo | placar |
| `achievement` | atleta (opt-in) | conquista, subida de nível/rating | selo |
| `reshare` | todos (flag `feed_reshare`) | comentário + post original embutido | card aninhado |

Cada tipo tem: renderer próprio, validação própria no domínio, e um
conjunto de campos em `payload` (ver `04-DATA-MODEL`).

**Tipos derivados de sistema** (`match_result`, `achievement`, e os itens
de torneio/jogo aberto que hoje o `buildFeed` produz) entram no feed como
itens **virtuais** ou como posts reais criados por opt-in:

- `system` (virtual): torneios públicos e "procura-se jogo" continuam
  vindo do `social/domain/feed.js`, sem virar documento. Zero custo de
  escrita, zero migração.
- `match_result` / `achievement` (real): viram documento **só quando o
  atleta confirma** (jornada JF3).

## 2. Identidades de autor

```js
export const AUTHOR_TYPE = Object.freeze({
  ATHLETE:  'athlete',    // author_id = uid
  ARENA:    'arena',      // author_id = arenaId
  COACH:    'coach',      // author_id = uid do professor
  CLUB:     'club',       // author_id = clubId
  TOURNAMENT: 'tournament',// author_id = tournamentId
  STORE:    'store',      // author_id = storeId (market_sellers)
  PLATFORM: 'platform',   // author_id = 'main'
});
```

### Quem pode publicar como quem — `resolveAuthorOptions(user, ctx)`

Função **pura** que devolve as identidades disponíveis, a partir de dados
que o chamador já carregou:

| Identidade | Condição | Fonte da verdade |
|---|---|---|
| `athlete` | sempre (o próprio) | `users/{uid}` |
| `arena` | é gestor da arena | `arena_managers/{arenaId}_{uid}` |
| `coach` | tem perfil de professor | `coaches/{uid}` |
| `club` | é admin do clube | `club_members/{clubId}_{uid}.role == 'admin'` |
| `tournament` | é criador ou admin do torneio | `tournaments.creator_uid` / `tournament_admins` |
| `store` | opera o vendedor loja | `market_sellers.manager_uids` (docs/16) |
| `platform` | `role == 'platform_admin'` | `users/{uid}.role` |

**Nada de coleção nova de "páginas".** A identidade é derivada das
permissões que já existem. Isso é o que torna a feature aditiva de verdade:
quem perde o cargo de gestor da arena perde o direito de publicar por ela,
automaticamente, inclusive nas regras do Firestore.

O post guarda `author_type`, `author_id`, `actor_uid` (**quem realmente
apertou publicar** — auditoria) e um snapshot do nome/avatar da entidade.

### Snapshot vs. referência
O post guarda `author_name` e `author_avatar_url` **no momento da
publicação** (snapshot, para não fazer N leituras ao renderizar o feed).
Uma Cloud Function atualiza os snapshots quando a entidade muda de nome ou
foto (`onDocumentWritten` em `arenas`, `clubs`, `users`) — em lote e sem
pressa; a defasagem de minutos é aceitável.

## 3. Visibilidade

```js
export const VISIBILITY = Object.freeze({
  PUBLIC:    'public',     // todos os autenticados
  FOLLOWERS: 'followers',  // só quem segue o autor
  CLUB:      'club',       // só membros do clube indicado
  PRIVATE:   'private',    // só o autor (rascunho / arquivado)
});
```

Regras de leitura decorrentes (detalhe em `05-REGRAS-FIRESTORE`):
- `public`: qualquer autenticado.
- `followers`: o Firestore **não consegue** validar "segue" de forma barata
  numa query de lista. Solução: `audience_uids` não escala. **Decisão**:
  na Fase 1, `followers` é aplicado como **filtro de consulta no cliente**
  + regra que exige `exists(follows/{viewer}_{author})` na leitura
  individual. Posts `followers` **não aparecem** nas queries de lista
  públicas porque a query filtra `visibility == 'public'`. Quem segue vê
  pela query "posts dos meus seguidos" (que consulta por `author_key in
  [...]`, limitada a 30 por vez).
- `club`: query por `club_id` + regra `isClubMember(club_id)`.
- `private`: só `actor_uid`/autor.

## 4. Estado do post

```js
export const POST_STATUS = Object.freeze({
  DRAFT:     'draft',
  SCHEDULED: 'scheduled',
  PUBLISHED: 'published',
  LIMITED:   'limited',    // sob suspeita: fora do ranking, permalink ok
  HIDDEN:    'hidden',     // oculto pelo autor
  REMOVED:   'removed',    // removido pela moderação (terminal)
  ARCHIVED:  'archived',   // arquivado pelo autor
});
```

## 5. Reações

```js
export const REACTION = Object.freeze({
  LIKE:   'like',    // 👍  "curti"
  FIRE:   'fire',    // 🔥  "arrasou"
  CLAP:   'clap',    // 👏  "parabéns"
  BALL:   'ball',    // 🏓  "bora jogar"
  IDEA:   'idea',    // 💡  "boa dica"
});
```
5 reações, escolhidas para caber no esporte. Uma por pessoa por post
(troca a anterior). Id determinístico `{postId}_{uid}` → impossível duplicar.

Contadores agregados no post (`reaction_counts: {like: 12, fire: 3}`)
atualizados por `increment()` com regra restrita a esses campos.

## 6. Comentários

- Subcoleção `feed_posts/{postId}/comments/{commentId}` — mesmo padrão do
  fórum do clube (evita índice composto e valida pelo pai).
- 1 nível de resposta: `parent_comment_id` (null = raiz).
- ≤ 1000 chars, menções, 1 imagem opcional.
- Reações no comentário: subcoleção `reactions/{uid}` (só `like`).
- Ordenação: relevância (reações + respostas, com recência) ou recentes.
- Autor do post pode fixar 1 comentário (`pinned: true`).

## 7. Limites (anti-spam, configuráveis)

| Limite | Default |
|---|---|
| posts por hora (atleta) | 5 |
| posts por dia (atleta) | 20 |
| posts por dia (entidade) | 10 |
| comentários por minuto | 5 |
| menções por post | 10 |
| hashtags por post | 8 |
| fotos por post | 10 |
| duração de vídeo | 90s |
| tamanho de vídeo | 100 MB |
| caracteres no post | 2000 |
| caracteres no comentário | 1000 |
| enquete: opções | 2-6 |
| enquete: duração | 1-7 dias |

Aplicados: no domínio (validação), na UI (bloqueio + explicação), e por
contador em `user_rate_counters/{uid}` (docs/18) checado no service.
Regras do Firestore não fazem rate limit — isso precisa estar claro para
ninguém achar que está protegido onde não está.

## 8. Menções e hashtags

`parseMentionsAndTags(text)` — puro e testado:
- `@` seguido de `handle` (slug do perfil) → resolve contra `users`/`arenas`;
  não resolvido vira texto comum.
- `#` seguido de palavra (sem acento, minúscula, ≤ 30 chars) → `hashtags[]`
  denormalizado no post e agregado em `feed_hashtags`.
- Links viram `<a>` com `rel="noopener noreferrer"` e domínio visível.
- **Nada de HTML no texto.** Renderização é tokenizada, nunca
  `dangerouslySetInnerHTML`.
