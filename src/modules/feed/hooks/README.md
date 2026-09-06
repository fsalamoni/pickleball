# `feed/hooks/` — React Query (PLANEJADO)

Nenhum hook dispara com a flag `feed` desligada
(`V2Feed.flagOff.runtime.test.jsx` garante).

| Hook | Chave | Observação |
|---|---|---|
| `useFeedTimeline(tab)` | `['feed','timeline',tab,uid]` | paginado; chama `rankFeed` no cliente |
| `useFeedPost(id)` | `['feed','post',id]` | |
| `useFeedComments(postId, sort)` | `['feed','comments',postId,sort]` | paginado |
| `useFeedReaction(postId)` | mutação | otimista com rollback |
| `useFeedFollows()` | `['feed','follows',uid]` | merge de `follows` + `feed_follows` |
| `useFeedPreferences()` | `['feed','prefs',uid]` | 1 doc, `staleTime` longo |
| `useFeedHashtag(tag)` | `['feed','tag',tag]` | |
| `useAuthorIdentities()` | `['feed','identities',uid]` | resolve arenas/clubes/coach/loja |
| `useFeedStats(postId)` | `['feed','stats',postId]` | só para o autor |

⚠ **Não confundir** com `useFeed` do módulo `social/`, que continua
existindo e alimenta `/novidades` com a flag desligada.
