# 17.04 — Modelo de dados do Feed

> 13 coleções novas com prefixo `feed_` + 4 compartilhadas em docs/18.
> Nenhuma coleção existente muda de shape. `follows` e `club_posts`
> permanecem intocados.

| # | Coleção | Id | Volume/ano | Dono |
|---|---|---|---|---|
| 1 | `feed_posts` | auto | ~60k | autor |
| 2 | `feed_posts/{id}/comments` | auto | ~200k | autor do comentário |
| 3 | `feed_posts/{id}/comments/{cid}/reactions` | `{uid}` | ~100k | usuário |
| 4 | `feed_reactions` | `{postId}_{uid}` | ~400k | usuário |
| 5 | `feed_poll_votes` | `{postId}_{uid}` | ~30k | usuário |
| 6 | `feed_saves` | `{uid}_{postId}` | ~50k | usuário |
| 7 | `feed_follows` | `{uid}_{type}_{id}` | ~40k | usuário |
| 8 | `feed_hashtags` | `{tag}` | ~3k | sistema |
| 9 | `feed_post_stats` | `{postId}` | ~60k | sistema |
| 10 | `feed_author_stats` | `{authorKey}` | ~10k | sistema |
| 11 | `feed_preferences` | `{uid}` | ~5k | usuário |
| 12 | `feed_pinned` | `{scope}` | ~20 | admin |
| 13 | `feed_timelines/{uid}/items` | auto | Fase 2 | sistema |

---

## 1. `feed_posts/{id}` ⭐

```js
{
  // --- autoria ----------------------------------------------------------
  author_type: 'arena',              // AUTHOR_TYPE
  author_id: 'arena123',
  author_key: 'arena_arena123',      // `${type}_${id}` — chave de query
  author_name: 'Arena Pickle SP',    // snapshot
  author_avatar_url: '',             // snapshot
  author_verified: false,
  actor_uid: 'Kx7CC0...',            // QUEM publicou de fato (auditoria)

  // --- conteúdo ---------------------------------------------------------
  type: 'photo',                     // POST_TYPE
  text: 'Que domingo! 🏓',           // ≤ 2000
  media: [
    { url:'', path:'', thumb_url:'', width:1080, height:1080,
      kind:'image'|'video', alt:'', duration_s:null, order:0 },
  ],                                  // ≤ 10 imagens ou 1 vídeo
  payload: { /* específico do tipo — ver §2 */ },

  hashtags: ['torneiodeverao','arenapicklesp'],   // ≤ 8, normalizadas
  mentions: [{ type:'athlete', id:'uid', name:'', handle:'' }],  // ≤ 10
  link: { url:'', title:'', description:'', image_url:'', domain:'' },

  // --- contexto (o que amarra o post à plataforma) ---------------------
  context: { kind:'tournament'|'game_day'|'arena'|'club'|'listing'|'coach'|null,
             id:'', label:'' },
  club_id: null,                     // só quando visibility == 'club'
  city: 'São Paulo', state: 'SP',    // do autor, para "Descobrir"

  // --- publicação -------------------------------------------------------
  visibility: 'public',              // VISIBILITY
  status: 'published',               // POST_STATUS
  scheduled_for: null,
  published_at: <ts>,
  edited_at: null, edit_count: 0,
  pinned_by_author: false,
  comments_enabled: true,
  comments_restricted: false,        // só seguidores comentam

  // --- repost -----------------------------------------------------------
  reshare_of: null,                  // id do post raiz
  reshare_snapshot: null,            // cópia mínima para exibir se sumir

  // --- contadores (denormalizados; o detalhado vai em feed_post_stats) --
  reaction_counts: { like:0, fire:0, clap:0, ball:0, idea:0 },
  reaction_total: 0,
  comment_count: 0,
  reshare_count: 0,
  save_count: 0,

  // --- ranking (campos lidos pelo domínio, escritos pelo sistema) -------
  engagement_score: 0,               // recalculado por Function
  last_activity_ms: 1757000000000,   // reação/comentário mais recente

  // --- moderação --------------------------------------------------------
  moderation_status: 'auto_approved',
  report_count: 0,
  limited_at: null, limited_reason: '',
  removed_at: null, removed_by: null, removed_reason: '',

  created_at, updated_at,
}
```

### Notas
- `author_key` é o que permite a query "posts de quem eu sigo" com
  `where('author_key','in',[...30])`.
- `last_activity_ms` em número (não Timestamp) segue o padrão já usado em
  `club_forum_threads`.
- `media[].thumb_url` é **obrigatório** — o card nunca carrega a imagem
  cheia (custo, ver `08-MIDIA`).

## 2. `payload` por tipo

```js
poll:  { question:'', options:[{id,label,votes:0}], ends_at:<ts>,
         multi:false, total_votes:0 }
event: { kind:'tournament'|'club_event'|'game_day', ref_id:'', title:'',
         starts_at:<ts>, city:'', cta_label:'Ver evento', cta_url:'' }
listing:{ listing_id:'', title:'', price_cents:0, cover_url:'',
          seller_key:'', condition:'' }
match_result:{ source:'game_day'|'tournament', ref_id:'',
               teams:[{names:[],score:0}], winner_index:0, format:'' }
achievement: { kind:'rating_up'|'level_up'|'achievement'|'streak',
               label:'', from:'3.5', to:'4.0', icon:'' }
announcement:{ tone:'info'|'promo'|'warning', cta_label:'', cta_url:'' }
video: { duration_s:45, poster_url:'', mime:'video/mp4' }
```

## 3. `feed_posts/{postId}/comments/{commentId}`
```js
{ post_id, author_type:'athlete', author_id, author_key,
  author_name, author_avatar_url, actor_uid,
  text:'',                       // ≤ 1000
  media: [],                     // ≤ 1 imagem
  mentions: [],
  parent_comment_id: null,       // 1 nível de resposta
  reply_count: 0, reaction_count: 0,
  pinned: false,
  status:'published'|'hidden'|'removed',
  report_count: 0,
  created_at, updated_at, edited_at }
```

## 4. `feed_reactions/{postId}_{uid}`
```js
{ post_id, user_id, author_key, type:'fire', created_at }
```
Id determinístico → uma reação por pessoa, impossível duplicar.
Permite "quem reagiu" e alimentar afinidade no ranking.

## 5. `feed_poll_votes/{postId}_{uid}`
```js
{ post_id, user_id, option_ids:['a'], created_at }
```

## 6. `feed_saves/{uid}_{postId}`
```js
{ user_id, post_id, author_key, created_at }
```

## 7. `feed_follows/{uid}_{type}_{id}` ⭐
Follow de **entidades** (arena, clube, professor, loja, torneio,
plataforma). Follow atleta↔atleta continua em `follows` (intocado).
```js
{ follower_uid, target_type:'arena', target_id:'arena123',
  target_key:'arena_arena123', target_name:'', target_avatar_url:'',
  notify: true,                  // avisar de cada post?
  created_at }
```
O feed lê **as duas** coleções e unifica em `author_key`:
`follows/{a}_{b}` → `athlete_{b}`; `feed_follows` → `target_key`.
Função pura `mergeFollowSources(follows, feedFollows)` — testada.

## 8. `feed_hashtags/{tag}`
```js
{ tag:'torneiodeverao', label:'#torneiodeverao',
  post_count:0, post_count_7d:0, last_used_at,
  trending_score:0, blocked:false, blocked_reason:'',
  created_at, updated_at }
```

## 9. `feed_post_stats/{postId}`
```js
{ post_id, author_key,
  impressions:0, views:0, unique_views:0,
  profile_clicks:0, link_clicks:0, cta_clicks:0,
  video_plays:0, video_completions:0,
  follows_attributed:0,
  by_day:{ '2026-09-06': { impressions:120, views:80 } },  // 30d rolling
  updated_at }
```

## 10. `feed_author_stats/{authorKey}`
```js
{ author_key, author_type, posts_count, followers_count,
  reactions_received, comments_received, avg_engagement_rate,
  best_post_id, last_post_at, updated_at }
```

## 11. `feed_preferences/{uid}`
```js
{ user_id,
  auto_share: { match_result:false, achievement:false,
                rating_up:false, tournament_join:false },
  default_visibility: 'public',
  muted_authors: ['athlete_uid1'],      // ≤ 200
  muted_hashtags: ['spam'],             // ≤ 100
  not_interested: ['postId1'],          // ≤ 500, rolling
  feed_tab_default: 'for_you',
  autoplay_video: true,
  reduce_motion: false,
  updated_at }
```
`muted_*` e `not_interested` ficam **no doc do usuário** (leitura barata,
1 doc) e são aplicados no **cliente**, dentro do ranking puro.

## 12. `feed_pinned/{scope}`
```js
// scope: 'global' | 'city_SP' | 'club_{id}'
{ scope, post_id, starts_at, ends_at, note, set_by, created_at }
```

## 13. `feed_timelines/{uid}/items/{itemId}` — **Fase 2**
Fan-out no servidor. Documentado agora para o schema já nascer certo:
```js
{ post_id, author_key, score, reason, created_ms, seen:false }
```
Só implementar quando o feed calculado no cliente não der conta
(> 500 posts/dia ou latência acima de 1,5s).

## 14. `platform_settings/feed`
```js
{
  allowed_types_by_author: {
    athlete: ['text','photo','video','poll','link','listing',
              'match_result','achievement','reshare'],
    arena:   ['text','photo','video','poll','link','event',
              'announcement','listing','reshare'],
    coach:   ['text','photo','video','poll','link','event',
              'announcement','listing','reshare'],
    club:    ['text','photo','video','poll','event','announcement','reshare'],
    tournament: ['text','photo','event','announcement'],
    store:   ['text','photo','video','link','announcement','listing'],
    platform:['text','photo','video','poll','link','event','announcement'],
  },
  limits: { post_per_hour:5, post_per_day:20, entity_post_per_day:10,
            comment_per_minute:5, media_per_post:10,
            video_seconds:90, video_mb:100, text_chars:2000,
            comment_chars:1000, mentions:10, hashtags:8 },
  moderation: { mode:'post', banned_terms:[], blocked_hashtags:[],
                auto_limit_report_threshold:3, auto_limit_window_hours:24 },
  ranking: { enabled:true, half_life_hours:36, affinity_weight:0.3,
             engagement_weight:0.25, diversity_max_per_author:2,
             official_boost:0.15 },
  discovery: { trending_window_days:7, min_posts_for_trending:3 },
  auto_share_defaults: { match_result:false, achievement:false },
  updated_at, updated_by,
}
```

---

## Índices compostos (`firestore.indexes.json`)

```jsonc
// timeline pública / descobrir
feed_posts: [status ASC, visibility ASC, published_at DESC]
feed_posts: [status ASC, visibility ASC, state ASC, city ASC, published_at DESC]
feed_posts: [status ASC, visibility ASC, type ASC, published_at DESC]
feed_posts: [status ASC, visibility ASC, engagement_score DESC, published_at DESC]
feed_posts: [status ASC, hashtags ARRAY, published_at DESC]
// seguindo (author_key IN [...])
feed_posts: [status ASC, author_key ASC, published_at DESC]
// perfil / gestão do autor
feed_posts: [author_key ASC, status ASC, published_at DESC]
feed_posts: [actor_uid ASC, status ASC, created_at DESC]
// clube
feed_posts: [status ASC, club_id ASC, published_at DESC]
// agendamento e moderação (cron)
feed_posts: [status ASC, scheduled_for ASC]
feed_posts: [moderation_status ASC, report_count DESC, created_at ASC]
feed_posts: [status ASC, report_count DESC]
// comentários (collectionGroup, para a fila de moderação)
comments (COLLECTION_GROUP): [status ASC, created_at DESC]
comments: [post_id ASC, parent_comment_id ASC, created_at ASC]
comments: [post_id ASC, reaction_count DESC, created_at DESC]
// reações / salvos / follows
feed_reactions: [post_id ASC, created_at DESC]
feed_reactions: [user_id ASC, created_at DESC]
feed_saves: [user_id ASC, created_at DESC]
feed_follows: [follower_uid ASC, created_at DESC]
feed_follows: [target_key ASC, created_at DESC]
// hashtags
feed_hashtags: [blocked ASC, trending_score DESC]
```
**~21 índices novos.**

## Custo estimado (3.000 MAU, 200 posts/dia)

| Item | Volume/mês | Custo |
|---|---|---|
| Leituras do feed (60 posts × 20 sessões × 3k users) | ~3,6M | US$ 2,16 |
| Leituras de comentários/reações | ~1,2M | US$ 0,72 |
| Escritas (posts, reações, comentários, contadores) | ~600k | US$ 1,08 |
| Storage de fotos (6k posts × 3 fotos × 200KB) | 3,6 GB/mês acumulando | US$ 0,10/mês |
| Storage de vídeo (600 vídeos × 30MB) | 18 GB/mês acumulando | US$ 0,47/mês |
| **Egress de imagem** (thumbs 40KB × 3,6M) | ~144 GB | **US$ 17** |
| **Egress de vídeo** ⚠ | ~500 GB | **US$ 60** |
| **Total** | | **~US$ 82/mês** |

**O vídeo é o item que pode fugir do controle.** Ver `08-MIDIA` §6 para as
mitigações obrigatórias (limite duro de duração, sem autoplay em dados
móveis, poster estático no card, player só ao tocar).
