# `feed/services/` — I/O Firestore (PLANEJADO)

| Arquivo | Responsabilidade |
|---|---|
| `postService.js` | CRUD de `feed_posts`, publicar, agendar, arquivar, remover, denormalizar hashtags/menções |
| `commentService.js` | subcoleção `comments`, respostas, ocultar, fixar |
| `reactionService.js` | `feed_reactions` (id determinístico) + contadores otimistas |
| `feedFollowService.js` | `feed_follows` (entidades) + merge com `follows` legado |
| `saveService.js` | `feed_saves` |
| `hashtagService.js` | `feed_hashtags`, contadores, bloqueio |
| `pollService.js` | `feed_poll_votes`, apuração |
| `feedPreferenceService.js` | `feed_preferences` (mutes, auto-share, autoplay) |
| `feedStatsService.js` | `feed_post_stats`, `feed_author_stats` |
| `feedSettingsService.js` | `platform_settings/feed` |

Fontes de candidatos (`collectCandidates`) ficam em `postService.js`, e
incluem uma chamada a `buildFeed` de `social/domain/feed.js` para os itens
`system` — **sem** duplicar aquela lógica.
