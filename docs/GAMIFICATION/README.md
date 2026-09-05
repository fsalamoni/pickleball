# 🎮 Gamificação — pasta de referência

> **Você chegou aqui para retomar a gamificação? Comece por este arquivo.**
> Tudo o que foi estudado, decidido, construído e deixado em aberto está nesta
> pasta. Não é preciso procurar em mais lugar nenhum.

---

## 0. Estado em uma linha

A **Gamificação V2 está em produção desde o PR #115**, atrás da flag
`gamification_v2` com **default OFF**. Com a flag desligada — que é o estado
atual — a plataforma se comporta exatamente como antes: nenhuma rota nova
aparece, nenhum documento é criado, nenhuma coleção é lida.

Ou seja: **o alicerce está pronto e ligado só quando você quiser.** O que falta
é o que o estudo chama de "camada de produto" — as mecânicas que dependem de
decisão editorial, de conteúdo e de calibragem, não de código de base.

---

## 1. Ordem de leitura (quando for retomar)

Leia nesta ordem. São ~45 minutos e evitam refazer o que já está feito.

| # | Arquivo | O que responde | Tempo |
|---|---|---|---|
| 1 | **[`01-ESTADO-ATUAL.md`](./01-ESTADO-ATUAL.md)** | O que EXISTE hoje no código, arquivo por arquivo, coleção por coleção | 10 min |
| 2 | **[`02-ESTUDO-VS-IMPLEMENTADO.md`](./02-ESTUDO-VS-IMPLEMENTADO.md)** | As 22 seções do estudo × o que virou código × o que falta | 15 min |
| 3 | **[`03-COMO-RETOMAR.md`](./03-COMO-RETOMAR.md)** | Passo a passo para ligar, validar e evoluir sem quebrar nada | 10 min |
| 4 | [`00-ROADMAP.md`](./00-ROADMAP.md) | O plano de fases/sprints como foi executado (histórico) | 5 min |
| 5 | [`CHANGELOG.md`](./CHANGELOG.md) | O que mudou em cada onda, incluindo a auditoria pré-merge | 5 min |
| 6 | [`90-ESTUDO-ORIGINAL.md`](./90-ESTUDO-ORIGINAL.md) | O estudo integral que originou tudo (2279 linhas — consulta, não leitura linear) | consulta |

**Se você só tem 5 minutos:** leia a §0 acima, depois o §1 de
`02-ESTUDO-VS-IMPLEMENTADO.md` (a tabela-resumo) e o §2 de `03-COMO-RETOMAR.md`
(como ligar a flag em ambiente de teste).

---

## 2. As três coisas que você precisa saber antes de tocar em qualquer coisa

1. **A flag `gamification_v2` é um interruptor real, não decorativo.** Ela
   protege tanto as rotas quanto os *hooks de escrita*. Ligar a flag para um
   usuário faz a plataforma começar a criar documentos de progressão para ele.
   Isso é aditivo e reversível (desligar para de escrever; nada existente é
   alterado), mas é uma decisão de produto, não de deploy.

2. **Nada da gamificação escreve em coleção antiga.** Toda a persistência vive
   em coleções próprias (`user_progression_v2`, `user_achievements_v2`,
   `user_missions`, `user_streak_meta`, `user_kudos`, `crews`, `crew_members`,
   `mentorships`, `user_referral_codes`, `user_referrals`, `season_rankings`).
   Nenhuma regra de segurança existente foi alterada para acomodá-las.

3. **O XP é derivado, não é uma moeda gravada.** O total de XP é recalculado a
   partir da atividade real do atleta (`xpTotal.js`), não incrementado a cada
   evento. Isso foi uma decisão consciente: não existe saldo para dessincronizar,
   e recontar um histórico antigo é uma questão de rodar a função de novo.
   Se algum dia a gamificação virar economia com gasto de XP, **essa decisão
   precisa ser revista antes de qualquer outra coisa** — está detalhada em
   `02-ESTUDO-VS-IMPLEMENTADO.md` §4.

---

## 3. Onde está o código

```
src/modules/progression/
├── domain/      # lógica pura, toda testada (xpTotal, tiers, missions,
│                #   skillTrees, streakProtection, seasons, socialBonds,
│                #   referrals, kudos, gamificationEvents, …)
├── services/    # I/O Firestore (progressionV2Service, missionService,
│                #   kudoService, socialBondService, referralService,
│                #   seasonRankingService, hallOfFameService, streakMetaService)
├── hooks/       # React Query (useUserProgressionV2, useUserMissionsV2, …)
└── components/  # cartões e painéis (TierBadge, MissionList, SkillTreeBars,
                 #   RivalsList, CrewsPanel, MentorshipsPanel, ReferralCard, …)

src/modules/achievements/domain/achievementsV2.js   # catálogo de 83 conquistas

src/v2/pages/
├── V2GamificationHome.jsx      # /gamification — hub
├── V2Achievements.jsx          # /conquistas
├── V2PublicAchievements.jsx    # conquistas de outro atleta
├── V2HallOfFame.jsx            # /hall-da-fama
├── V2SocialBonds.jsx           # rivais, crews, mentoria
└── V2ReferralLanding.jsx       # landing do convite

functions/seasonRanking.js      # recomputeSeasonRankingDaily (Cloud Function)
```

---

## 4. Testes que provam que está de pé

| Suíte | O que garante | Como rodar |
|---|---|---|
| `src/modules/progression/**/*.test.js` | Toda a lógica pura (XP, tiers, missões, streaks, temporadas) | `npx vitest run src/modules/progression` |
| `src/v2/pages/V2Profile.gamificationFlag.runtime.test.jsx` | Perfil não muda com a flag OFF | `npx vitest run V2Profile.gamificationFlag` |
| `src/v2/components/GamificationErrorBoundary.runtime.test.jsx` | Um erro na gamificação não derruba a página que a hospeda | `npx vitest run GamificationErrorBoundary` |
| `tests/rules/gamification.rules.emulator.mjs` | 54 asserções contra o emulador do Firestore com as regras reais | ver `03-COMO-RETOMAR.md` §4 |
| `tests/manual/gamification.smoke.mjs` | Fluxo completo no navegador contra os emuladores | ver `03-COMO-RETOMAR.md` §4 |

As duas últimas **não rodam no CI** (precisam do emulador). Rode-as antes de
qualquer mudança em `firestore.rules` ou em service de gamificação — foi a suíte
do emulador que encontrou o bug em que **nenhuma missão era criada**, porque o
Firestore mockado aceitava `undefined` e o real não.
