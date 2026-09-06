# `feed/domain/` — lógica pura (PLANEJADO)

Regras: sem React, sem Firebase, **`now` sempre por parâmetro** (o ranking
precisa ser determinístico para ser testável), `.test.js` obrigatório.
Especificação: `docs/FUTURO/FEED/07-RANKING-E-DESCOBERTA.md` §6.

| Arquivo | Exporta (previsto) | Testes |
|---|---|---|
| `constants.js` | `POST_TYPE`, `AUTHOR_TYPE`, `VISIBILITY`, `POST_STATUS`, `REACTION` + labels | 6 |
| `ranking.js` | `rankFeed`, `scorePost`, `applyDiversity`, `explainItem` | 46 |
| `candidates.js` | `mergeCandidates`, `dedupe`, `windowFilter` | 20 |
| `affinity.js` | `computeAffinity`, `interactionHistoryScore` | 18 |
| `trending.js` | `trendingScore`, `rankHashtags` | 14 |
| `suggestions.js` | `suggestAuthors`, `suggestionReason` | 16 |
| `visibility.js` | `canView`, `visibleTo`, `filterByAudience` | 18 |
| `mentions.js` | `parseMentionsAndTags`, `tokenizeText`, `sanitizeUrl` | 22 |
| `post.js` | `normalizePostInput`, `validatePost`, `validatePayload` (por tipo) | 34 |
| `postStatus.js` | `canTransitionPost`, `nextPostActions` | 16 |
| `comment.js` | `normalizeComment`, `rankComments`, `canReply` | 20 |
| `reactions.js` | `applyReaction`, `aggregateReactions` | 12 |
| `poll.js` | `castVote`, `tallyPoll`, `isPollClosed` | 18 |
| `identity.js` | `resolveAuthorOptions`, `buildAuthorKey`, `authorSnapshot` | 22 |
| `follows.js` | `mergeFollowSources`, `topFollowedKeys` | 14 |
| `preferences.js` | `applyMutes`, `applyNotInterested`, `autoShareEnabled` | 16 |
| `limits.js` | `checkPostLimit`, `checkCommentLimit`, `limitMessage` | 18 |
