# 17.12 — Testes e qualidade do Feed

## 1. Pirâmide
```
       E2E (Playwright)            9 cenários
    Runtime (Vitest + RTL)        ~50 testes
  Regras (emulador)                45 asserções
Domínio puro (Vitest)             ~330 testes
```
Alvo: **~658 testes novos**.

## 2. Domínio — casos que não podem faltar

| Arquivo | Casos críticos |
|---|---|
| `ranking.js` | determinismo (mesma entrada → mesma saída); empate estável; decaimento correto; diversidade respeitada; silenciado/bloqueado somem; boost sinalizado; `explain` coerente com o score; lista vazia |
| `affinity.js` | sem histórico; histórico só de um autor; normalização em [0,1] |
| `mentions.js` | `@` inexistente vira texto; e-mail não vira menção; `#` com acento normaliza; link com `javascript:` é descartado; **nenhuma saída com HTML** |
| `post.js` | cada tipo com payload válido e inválido; texto acima do limite; 11 fotos; vídeo + foto juntos (proibido); enquete com 1 opção; visibilidade `club` sem `club_id` |
| `postStatus.js` | matriz completa de transições × papel |
| `identity.js` | cada tipo de autor com e sem permissão; `authorKey` bem formado; plataforma só para admin |
| `follows.js` | merge sem duplicar; `follows` legado + `feed_follows`; lista vazia |
| `limits.js` | 6º post da hora; 21º do dia; janela deslizante; entidade × atleta |
| `poll.js` | voto duplo; voto após prazo; múltipla escolha; apuração com 0 votos |
| `visibility.js` | espelha as regras: seguidor, membro de clube, autor, admin |

**Regra de ouro do ranking**: se `rankFeed` não for determinístico, não é
testável, e um feed não testável quebra em produção sem ninguém perceber.
Injetar `now` como parâmetro (nunca `Date.now()` dentro da função).

## 3. Regras (emulador)
`tests/rules/feed.rules.test.js` — as 45 asserções de `05-REGRAS §5`.
Imperdíveis:
- post `followers` invisível para quem não segue;
- publicar como arena sem ser gestor é negado;
- publicar como plataforma sem ser admin é negado;
- `actor_uid` forjado é negado;
- contadores editáveis, campos de moderação não;
- comentar em post com comentários desativados é negado;
- reagir por outro uid é negado.

## 4. Runtime
`V2Feed.runtime.test.jsx` · `V2FeedComposer.runtime.test.jsx` ·
`V2FeedPostCard.runtime.test.jsx` (um caso por tipo de post) ·
`V2FeedComments.runtime.test.jsx` ·
`V2Feed.flagOff.runtime.test.jsx` (**obrigatório em todo PR a partir do V2**:
flag OFF → `/feed` não renderiza, `/novidades` intacto, nenhum hook dispara).

## 5. E2E (Playwright)

| # | Cenário |
|---|---|
| EF1 | Publicar foto com legenda, menção e hashtag; ver no feed |
| EF2 | Reagir, comentar, responder, salvar |
| EF3 | Publicar como arena e o seguidor ver na aba Oficial |
| EF4 | Denunciar post → admin remover → sumir do feed |
| EF5 | Bloquear usuário → sumir do feed, dos comentários e do chat |
| EF6 | Enquete: votar, ver resultado, tentar votar de novo |
| EF7 | Vídeo: enviar, ver poster, tocar, recusar vídeo longo |
| EF8 | Agendar post e ele publicar (emulador com relógio adiantado) |
| EF9 | Flag OFF: `/feed` some e `/novidades` funciona como hoje |

## 6. Testes de performance (novos para o projeto)

O feed é a primeira tela do PickleRush com risco real de performance.
Medir em CI (Playwright + `performance.measure`):
- **LCP** do `/feed` < 2,0s em 4G simulado;
- **CLS** < 0,05 (mídia com `aspect-ratio` reservado);
- tempo de `rankFeed` sobre 200 candidatos < 30ms;
- memória estável após 10 páginas de scroll (sem vazamento de listeners).

## 7. Checklist por PR (além do CLAUDE.md §7)
- [ ] Nenhum `dangerouslySetInnerHTML`.
- [ ] Nenhuma URL de usuário renderizada sem sanitização.
- [ ] EXIF removido em toda imagem enviada.
- [ ] Toda mídia com `alt`.
- [ ] Toda mídia com `aspect-ratio` reservado.
- [ ] Nenhum autoplay com som.
- [ ] Toda notificação nova é agrupável.
- [ ] Toda ação de moderação grava motivo em `audit_logs`.
- [ ] `rankFeed` recebe `now` por parâmetro.
- [ ] Runtime test de flag OFF presente.

## 8. Dados de teste
`scripts/seed-feed.mjs`: 12 autores (todos os tipos), 200 posts cobrindo os
11 tipos, 800 reações, 300 comentários com respostas, 30 hashtags, 5
denúncias em estados diferentes, 3 posts limitados, 2 removidos.
