# `v2/components/feed/` — UI do Feed (PLANEJADO)

28 componentes previstos. Lista completa em
`docs/FUTURO/FEED/06-UX-ROTAS-E-TELAS.md` §4.

Lembretes:
- `V2FeedPostText` tokeniza menção/hashtag/link — **nunca**
  `dangerouslySetInnerHTML`;
- toda mídia com `aspect-ratio` reservado a partir de `width/height`;
- vídeo: poster no card, sem autoplay com som, sem autoplay em `save-data`;
- `V2FeedList` precisa restaurar a posição do scroll ao voltar de um post;
- skeleton com o mesmo layout do card final.
