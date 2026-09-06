# 17.10 — Integrações do Feed

## 1. `social/` — o que fica e o que muda

**Fica**: `follows` (atleta↔atleta), `player_goals`, busca global
(`V2Search`), e `domain/feed.js` com `buildFeed`/`filterFeedByFollowing`.

**Muda**: nada no shape. `buildFeed` passa a ser **chamado pelo módulo
`feed/`** como uma das fontes de candidatos (itens `system`). O `V2Community`
continua existindo e é usado quando a flag está desligada.

`mergeFollowSources(follows, feedFollows)` unifica as duas coleções de
follow em uma lista de `author_key` — função pura, testada, no módulo novo.

## 2. Torneios
- Organizador publica como o torneio (`author_type: 'tournament'`).
- Post `event` com CTA "Ver torneio" / "Inscrever-se".
- Torneio publicado, sorteio saiu, resultado da final → itens `system`
  (via `buildFeed`, sem escrever documento).
- Página do torneio ganha aba "Publicações" (posts com
  `context.kind == 'tournament'`).

## 3. Arenas
- Arena publica como a arena; quem reserva vira seguidor sugerido.
- Post com CTA "Reservar" → `/arenas/:id`.
- `V2ArenaDetail` ganha aba "Publicações".
- Quadra livre de última hora vira post rápido a partir do calendário.

## 4. Professores
- Professor publica dica/vídeo como o perfil de professor.
- CTA "Agendar aula".
- `V2CoachProfile` ganha aba "Publicações" — é o que transforma o perfil
  de professor de currículo estático em canal vivo.

## 5. Clubes
- Post com `visibility: 'club'` aparece só para membros.
- `club_posts` e `club_forum_threads` **continuam existindo** para o mural
  e o fórum interno. O Feed é a praça pública; o clube é a sala privada.
  Não fundir os dois — são contextos diferentes com expectativas de
  privacidade diferentes.
- `V2ClubDetail` ganha aba "Feed do clube" (posts do clube no feed).

## 6. Dia de jogo e resultados
- Fim de um dia de jogo → oferece post `match_result` com o ranking do dia
  (rascunho; publica com 1 toque).
- Resultado individual → post opt-in.
- O telão (`/dia-de-jogo/:id/telao`) pode mostrar um QR "publique no feed".

## 7. Gamificação
- Conquista, subida de tier, streak → post `achievement` opt-in.
- Conquistas novas do feed (só com `gamification_v2` ligada): "Primeira
  publicação", "100 reações recebidas", "Comentarista" — XP em categoria
  **social**, separada do XP esportivo. Não distorcer o ranking de jogo.

## 8. Mercado (docs/16) — a ponte
- Compartilhar anúncio → post `listing` (flag `feed_market_bridge`).
- Clique no card conta impressão em `market_listing_stats`.
- Loja/arena divulga promoção no feed apontando pra vitrine.
- Anúncio novo de vendedor seguido pode virar item de descoberta.

## 9. Chat
- Comentar não vira chat. Mas o card tem "Conversar" → abre o `chat/`
  com `context: { kind:'feed_post', id }`.
- Compartilhar post por mensagem direta.

## 10. Notificações e push
Reaproveita `notificationService`, `pushService` e `push_tokens`. O push do
feed é **sempre agrupado** e respeita janela de silêncio.

## 11. Busca global (`V2Search`)
Ganha seção "Publicações" (por texto e hashtag). Aditivo.

## 12. Perfil do atleta
`V2AthleteProfile` ganha aba "Publicações" + contagem de seguidores.
Aditivo; some com a flag.

## 13. Home (`V2Dashboard`)
Bloco "No feed agora" com os 3 melhores itens + atalho. Aditivo.

## 14. PWA / push / offline
- O feed é o melhor candidato a cache offline: guardar a última página
  renderizada no cache do SW e mostrar com aviso "conteúdo de X min atrás".
- Bump de `sw-vN.js` obrigatório no PR que mexer no SW
  (`docs/03-WORKFLOW.md` §7).

## 15. Legal
`legal/` ganha as **Diretrizes de Comunidade** (`community_guidelines`) —
documento próprio, versionado, aceito no primeiro post, e linkado em toda
tela de denúncia. Sem isso, a moderação não tem régua pública.
