# `feed/` — Feed (rede social do PickleRush)

> **Status: 📐 PLANEJADO — pasta estruturada, nenhum código escrito.**
> Desenho completo em `docs/FUTURO/FEED/`. Leia `docs/FUTURO/FEED/00-INDEX.md`
> antes de escrever a primeira linha.

## O que é

Rede social vertical de pickleball, com dois ambientes:
- **público (leitor)**: timeline (Para você · Seguindo · Descobrir ·
  Oficial), post, comentários, reações, hashtags, perfis, descoberta;
- **gestão (autor)**: composer, rascunhos, agendamento, identidades,
  métricas por post, moderação dos próprios comentários, painel da entidade.

Publicam: atletas, arenas, professores, clubes, torneios, lojas e a
plataforma.

## ⚠ Relação com `social/` e `/novidades`

`social/` **continua existindo** com follows, metas e busca global. Seu
`domain/feed.js` (`buildFeed`) vira **uma das fontes** deste módulo (itens
`system`), sem mudar de shape.

`/novidades` redireciona para `/feed` **só** com a flag `feed` ligada; com
a flag desligada, segue exatamente como está hoje.

## Estrutura

```
feed/
├── domain/        17 arquivos puros + .test.js  (~330 testes)
├── services/      9 services
├── hooks/         9 hooks React Query
├── components/    componentes específicos do módulo
└── README.md
```
Páginas em `src/v2/pages/V2Feed*.jsx`; UI em `src/v2/components/feed/`.

## Flags (todas default OFF)

`feed` (mestra) · `feed_video` · `feed_polls` · `feed_reshare` ·
`feed_identities` · `feed_ranking` · `feed_auto_share` ·
`feed_market_bridge`

## Coleções (13)

`feed_posts` (+ subcoleções `comments` e `comments/{id}/reactions`) ·
`feed_reactions` · `feed_poll_votes` · `feed_saves` · `feed_follows` ·
`feed_hashtags` · `feed_post_stats` · `feed_author_stats` ·
`feed_preferences` · `feed_pinned` · `feed_timelines` (Fase 2) ·
`platform_settings/feed`

Denúncias, bloqueio e strikes ficam no módulo `moderation/`.

Schema completo: `docs/FUTURO/FEED/04-DATA-MODEL.md`.

## Rotas (12)

`/feed` · `/feed/p/:postId` · `/feed/tag/:tag` · `/feed/descobrir` ·
`/feed/salvos` · `/feed/a/:authorKey` · `/feed/publicar` ·
`/feed/gerenciar` · `/feed/gerenciar/:postId` ·
`/feed/gerenciar/identidade/:authorKey` · `/feed/configuracoes` ·
`/novidades` (redirect com a flag ligada)

## Regras que não se negocia

1. `rankFeed` é **puro e determinístico** — recebe `now` por parâmetro,
   nunca chama `Date.now()` dentro.
2. Aba "Seguindo" é **cronológica pura**, sempre. Sem exceção.
3. Todo item do "Para você" carrega um **motivo legível**.
4. Post automático (resultado, conquista) é **sempre opt-in**, criado como
   rascunho, publicado com um toque do usuário.
5. **EXIF removido** de toda imagem enviada (GPS!).
6. Toda mídia com `aspect-ratio` reservado → zero layout shift.
7. Nenhum `dangerouslySetInnerHTML` — texto é tokenizado.
8. Notificação de interação é **sempre agrupada**.
9. Identidade de autor é **derivada** das permissões existentes
   (`arena_managers`, `club_members`, `coaches`) — sem coleção de "páginas".
10. `actor_uid` (quem apertou publicar) sempre registrado.

## Onde achar mais
- `docs/FUTURO/FEED/` — 14 documentos
- `docs/FUTURO/CONFIANCA-E-MODERACAO/`
- `docs/FUTURO/PLANO-MESTRE-MERCADO-FEED.md`
