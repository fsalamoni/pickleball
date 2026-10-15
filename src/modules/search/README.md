# search — paleta de comandos

Lógica pura do índice da **paleta de comandos** (plano de UX §5.4): responde a
"quero fazer X" e "quero ir para Y" sem a pessoa saber onde Y mora no menu.
**Zero banco, zero consulta** — só montagem de itens.

## Arquivos

- `domain/commandIndex.js` — `commandIndex(ctx)` devolve as **ações** (verbos
  por papel: reservar quadra, criar dia de jogo, entrar num jogo, treinos e
  Mercado atrás da respectiva flag, Central de cada arena que a pessoa gere,
  Painel admin) e as **telas** (hubs e abas do menu, já filtrados por papel
  pelo `useV2Nav`, com o mesmo rótulo do menu); `RECENTES_MAX` limita os
  recentes. Rótulos em `t()` (i18n).
- `domain/commandIndex.test.js` — testes do índice.

## Quem consome

- `src/v2/components/search/V2CommandPalette.jsx` (carregada com `lazy` pelo
  `V2Layout`). Atletas, torneios, arenas e clubes vêm de `searchAll`
  (`athletes/domain/globalSearch.js`, as consultas da página `/buscar`) e a
  ajuda de `searchHelp` (`help/domain/helpCenter.js`).
- Guarda de fonte: `src/core/guards/navV3.test.js`.

## Regra

Rotas das ações são escritas aqui à mão: ao renomear uma rota de `V2App.jsx`,
confira `commandIndex.js`. Telas **nunca** são listadas aqui — vêm da árvore `hubs`.
