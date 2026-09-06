# `moderation/` — Confiança e moderação (infra compartilhada)

> **Status: 📐 PLANEJADO — pasta estruturada, nenhum código escrito.**
> Desenho completo em `docs/FUTURO/CONFIANCA-E-MODERACAO/`.

## O que é

Camada transversal de denúncia, fila de moderação, bloqueio, silenciar,
strikes e rate limits. **Usada pelo Mercado (`marketplace/`) e pelo Feed
(`feed/`)** — existe para os dois não implementarem a mesma coisa duas vezes.

**Nenhuma das duas features vai a público sem esta camada.**

## Estrutura

```
moderation/
├── domain/        11 arquivos puros + .test.js  (~196 testes)
├── services/      reportService, actionService, blockService,
│                  strikeService, rateLimitService
├── hooks/         useReports, useModerationQueue, useBlocks,
│                  useMutes, useStrikes, useRateLimit
├── components/    ReportDialog (compartilhado), BlockButton,
│                  MuteMenuItem, StrikeBanner
└── README.md
```
Fila do admin em `src/v2/components/admin/AdminModerationQueue.jsx`.

## Flag

`content_moderation` (default OFF) — uma só. Não faz sentido ter denúncia
sem fila.

## Coleções (7)

`content_reports` · `moderation_actions` · `content_strikes` ·
`user_blocks` · `user_mutes` · `user_rate_counters` ·
`moderation_queue_stats`

Schema, regras e índices: `docs/FUTURO/CONFIANCA-E-MODERACAO/04-DATA-MODEL.md`.

## Regras que não se negocia

1. Denúncia **nunca** é apagada, por ninguém.
2. `moderation_actions` é trilha imutável (só `reverted` é editável).
3. Motivo **obrigatório** em toda ação que não seja "manter".
4. Anonimato do denunciante perante o denunciado.
5. O sancionado **lê** a ação que sofreu (transparência + recurso).
6. Auto-limitação conta **denunciantes distintos ponderados**, nunca
   denúncias brutas.
7. Sanção é **proporcional** e escalonada; pular etapas só nos casos
   críticos (menor, ameaça, nudez não consentida, golpe comprovado).
8. Strike expira em 180 dias e tem direito de recurso.
9. Rate limit é aplicado no **service** (as regras do Firestore não fazem
   rate limit — e isso está documentado, não escondido).
10. Bloqueio tem efeito em feed, comentários, chat e Mercado — em todos.

## Onde achar mais
- `docs/FUTURO/CONFIANCA-E-MODERACAO/` — 6 documentos
- `docs/FUTURO/MERCADO/` · `docs/FUTURO/FEED/` — os dois consumidores
