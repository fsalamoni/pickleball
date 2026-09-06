# 17.11 — Plano de desenvolvimento do Feed (Onda V)

| PR | Nome | Entrega | Testes | Arquivos | Depende de |
|---|---|---|---|---|---|
| V0 | Fundação e domínio | flags, enums, ranking, identidades, menções, limites — **puro** | ~330 | 22 | — |
| V1 | Dados e acesso | regras, índices, services, hooks | ~45 (emulador) | 20 | V0 |
| V2 | Timeline e post | `/feed`, abas, card, permalink, cronológico | ~30 | 20 | V1 |
| V3 | Composer e mídia | composer, foto com compressão, rascunho, agendar | ~35 | 16 | V2 |
| V4 | Interação | reações, comentários, respostas, salvar, menções | ~40 | 14 | V3 |
| V5 | Identidades | publicar como arena/clube/professor/plataforma, painel da entidade | ~30 | 12 | V4 |
| V6 | Ranking e descoberta | "Para você", explicabilidade, Descobrir, hashtags, sugestões | ~35 | 12 | V4 |
| V7 | Vídeo e enquete | vídeo com limites, poster, player; enquete | ~28 | 10 | V3 |
| V8 | Moderação (docs/18) | denúncia, fila, bloqueio, silenciar, strikes, auto-limitação | ~45 | 18 | V4 |
| V9 | Admin, Functions, integrações | 6 abas admin, 11 Functions, notificações agrupadas, abas nos perfis, ponte com o Mercado, polimento | ~40 | 26 | V8 |
| | **Total** | | **~658** | **~170** | |

Esforço: **8 a 11 semanas** para uma pessoa; 5-6 com duas
(V6 e V7 são paralelizáveis após V4).

---

## V0 — Fundação e domínio
`feat/feed-fundacao`
- 8 flags novas (default OFF) + grupo em `featureFlagGroups.js`.
- `src/modules/feed/domain/` completo (17 arquivos de `07-RANKING §6`).
- `src/modules/feed/README.md`.

Aceite: ~330 testes verdes · nenhum import de React/Firebase em `domain/` ·
`rankFeed` determinístico (mesma entrada, mesma saída, sempre) ·
lint 0 · build limpo · **nada muda na UI**.

## V1 — Dados e acesso
`feat/feed-dados`
- `firestore.rules`: helpers + 12 blocos novos (aditivos).
- `firestore.indexes.json`: 21 índices novos.
- Services: `postService`, `commentService`, `reactionService`,
  `followService` (entidades), `saveService`, `hashtagService`,
  `preferenceService`, `statsService`, `pollService`.
- Hooks: `useFeed`, `useFeedPost`, `useFeedComments`, `useFeedReactions`,
  `useFeedFollows`, `useFeedPreferences`, `useFeedHashtag`,
  `useAuthorIdentities`, `useFeedStats`.

Aceite: 45 asserções no emulador verdes · diff das regras só acrescenta ·
`useFeed` do `social/` continua funcionando intocado.

## V2 — Timeline e post
`feat/feed-timeline`
- `/feed` com 4 abas (ranking ainda **cronológico** — o algoritmo entra no V6).
- `V2FeedPostCard` com renderers de `text`, `photo`, `system`.
- `/feed/p/:postId` permalink.
- Redirect `/novidades` → `/feed` com a flag ligada.
- Item no hub Comunidade + bottom nav (só com flag).
- Restauração de scroll, paginação, skeletons, vazios.

Aceite: primeira renderização com conteúdo < 1,5s (60 posts de teste) ·
voltar de um post mantém a posição · flag OFF: `/feed` 404 e `/novidades`
igual a hoje (runtime test) · zero layout shift medido.

## V3 — Composer e mídia
`feat/feed-composer`
- Composer completo (texto, fotos, visibilidade, contexto vinculado).
- `core/lib/imageProcessing.js` (resize, WebP, thumb, strip EXIF).
- Rascunho com autosave, agendamento, pré-visualização.
- `/feed/gerenciar` com as 4 abas.

Aceite: publicar foto no celular em < 30s (cronometrado) · foto de 4,5MB
vira ~180KB + thumb 28KB · **EXIF removido** (verificado com exiftool) ·
rascunho sobrevive a fechar o navegador.

## V4 — Interação
`feat/feed-interacao`
- Reações (5, com picker), comentários + 1 nível, salvar, menções,
  hashtags clicáveis, contadores.
- Autor modera os próprios comentários (ocultar, fixar, desativar).
- Notificações de reação/comentário/menção (já agrupadas).

Aceite: reagir é instantâneo (otimista, com rollback em erro) · comentar
em post com comentários desativados é impossível (regra + UI) · menção
notifica uma vez só · id determinístico impede reação dupla.

## V5 — Identidades
`feat/feed-identidades`
- Seletor de identidade no composer (só o que o usuário comanda).
- `/feed/a/:authorKey` — perfil de feed da entidade.
- `/feed/gerenciar/identidade/:authorKey` — painel da entidade.
- `feed_follows` + botão seguir em arena/clube/professor/loja.
- Abas "Publicações" nos perfis de arena, professor e clube.

Aceite: ex-gestor de arena não publica mais por ela (teste de regra) ·
`actor_uid` sempre registrado · seguir entidade aparece no feed.

## V6 — Ranking e descoberta
`feat/feed-ranking`
- `rankFeed` ligado na aba "Para você" (flag `feed_ranking`).
- Motivo visível em cada item.
- Aba "Descobrir": em alta, cidade, sugestões.
- `/feed/tag/:tag`, trending, silenciar, "não tenho interesse".

Aceite: aba "Seguindo" **continua cronológica pura** · nenhum autor ocupa
>2 dos 20 primeiros · ≥20% dos itens são de não-seguidos · todo item tem
motivo · desligar `feed_ranking` volta tudo a cronológico sem quebrar.

## V7 — Vídeo e enquete
`feat/feed-video-enquete`
- Vídeo: validação de duração/tamanho, extração de poster, player,
  autoplay condicional, contadores.
- `storage.rules`: bloco `feed_video` (aditivo, testado no emulador).
- Enquete: criar, votar, apurar, encerrar.

Aceite: vídeo de 2 min é recusado com mensagem clara · sem autoplay com
som, nunca · sem autoplay em `save-data` · enquete não aceita voto duplo
nem depois do prazo · custo de egress medido no beta.

## V8 — Moderação
`feat/feed-moderacao` — implementa **docs/18** (compartilhado com o Mercado)
- `content_reports`, `moderation_actions`, `content_strikes`,
  `user_blocks`, `user_mutes`, `user_rate_counters`.
- Diálogo de denúncia (post, comentário, usuário, anúncio).
- Fila de moderação no admin.
- Bloquear/silenciar com efeito em feed, comentários, chat e Mercado.
- Auto-limitação por denúncias; rate limits aplicados.
- Diretrizes de Comunidade no `legal/`.

Aceite: denunciar leva à fila e o admin remove com motivo em 2 cliques ·
bloqueio some das duas pontas em todos os lugares · 3 denunciantes
distintos limitam o post automaticamente e o autor é avisado · rate limit
trava o 6º post da hora com mensagem clara · tudo em `audit_logs`.

## V9 — Admin, Functions e integrações
`feat/feed-admin`
- 6 abas do painel admin + `platform_settings/feed`.
- 11 Cloud Functions.
- Notificações agrupadas + preferências.
- Ponte com o Mercado, busca global, Home, abas nos perfis, auto-share
  opt-in, cache offline do feed, bump do SW.
- Passada de UX/UI e acessibilidade.

Aceite: checklist do CLAUDE.md §7 inteiro · post agendado publica sozinho ·
40 reações viram 1 notificação · excluir post apaga a mídia do Storage ·
snapshots de autor atualizam ao renomear a arena.

---

## Ordem de ligação das flags

```
1. feed                          (dogfood interno, 1 semana)
2. + feed_identities             (3 arenas + 3 professores convidados)
3. + feed_polls, feed_reshare
4. + feed_ranking                (comparar engajamento com cronológico)
5. + feed_auto_share
6. + feed_market_bridge          (depende de `marketplace` ligada)
7. + feed_video                  (ÚLTIMO — medir custo antes)
```

`feed_video` por último **de propósito**: é o único item com risco
financeiro real e assimétrico.

## Riscos do plano

| Risco | Prob. | Mitigação |
|---|---|---|
| Feed vazio no lançamento | alta | fontes `system` já garantem conteúdo desde o dia 1; semear com 3 arenas e 5 professores publicando |
| Custo de vídeo | média | flag por último, limites duros, medir no beta, Fase 3 com Mux |
| Moderação sem gente | alta | auto-moderação + auto-limitação + fila priorizada; começar com tipos de post restritos |
| Notificação virar spam | alta | agrupamento obrigatório no V4, "novos posts" desligado por padrão |
| Ranking parecer injusto | média | explicabilidade obrigatória + aba cronológica sempre |
| Performance do feed | média | paginação, thumb, virtualização, medir p95 desde o V2 |
| Canibalizar o fórum do clube | baixa | contextos separados por design (público × privado) |
