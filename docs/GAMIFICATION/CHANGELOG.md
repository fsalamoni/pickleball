# Changelog · PickleRush Gamification V2

## [Não lançado] · Revisão pré-merge (auditoria completa da branch)

Revisão da branch inteira antes de integrar ao `main`. **Nada foi mergeado**
e a flag `gamification_v2` segue **default OFF**.

### Bloqueadores de produção (a feature não funcionaria)

1. **Três vocabulários paralelos de tier.** `tiers.js` gerava
   `Regular/Expert/Elite/Lenda`; o schema Zod e o `firestore.rules` só
   aceitavam `Competidor/Craque/Mestre/Lendário`. Qualquer atleta acima de
   **12.000 XP** tinha a gravação recusada (schema) e negada (regra).
   → `TIER_NAMES` em `tiers.js` virou fonte única; schema e regra derivam dela.
2. **Skill trees com formato e nomes divergentes.** O domínio produzia um
   MAPA com `tournament/social/arena/coach/club`; o schema exigia uma LISTA
   com `tournament/match/social/mentorship/consistency`. `setUserProgressionV2`
   falhava em **100% das chamadas** — a persistência nunca funcionou.
   → `toSkillTreeSnapshots`/`fromSkillTreeSnapshots` fazem a ponte;
   `SKILL_TREE_KEYS` virou fonte única.
3. **Famílias de conquista erradas no schema.** O schema aceitava
   `tournament/match/social/mentorship/consistency`; o catálogo usa
   `career/social/discovery/seasonal/community`. Só conquistas `social`
   conseguiam ser gravadas.
4. **Teto de nível 20 no schema.** A curva (idêntica à V1, sem teto) passa de
   20 com 105.000 XP; a partir daí a progressão parava de salvar. O teto virou
   limite de sanidade (200) e a curva V2 voltou a ser idêntica à V1.
5. **`resource.data` em regra de `create`.** Em `create` o `resource` é null,
   então a expressão derrubava a regra inteira: **rivais, mentorias e
   indicações nunca podiam ser criados**.
6. **Escritas cruzadas negadas pelas regras.** Dar kudo escreve no índice de
   quem recebe; entrar numa crew mexe no contador da crew; registrar indicação
   credita o código do indicador. Todas eram negadas — os fluxos falhavam
   sempre. → regras estreitas: só os campos daquele fluxo, +1 por vez.
7. **Leituras negadas pelas próprias regras.** Hall da Fama, `/conquistas/:uid`
   e o placar sazonal liam documentos de outros usuários sob regra "só o dono
   lê" — as páginas viriam vazias para todo mundo.
8. **Transações com leitura depois de escrita.** `recordReferralSignup` e
   `leaveCrew` faziam `tx.get` após `tx.set`/`tx.delete`; o Firestore aborta a
   transação inteira. Ambos falhariam 100% das vezes.
9. **`listUserSeasons` chamava `snap.data()`** num `QuerySnapshot` (que não tem
   `.data()`) → TypeError garantido.
10. **`currentSeasonId()` retornava `"2026-undefined"`** — usava `getSeason()`,
    que não devolve `month`. Todo o ranking sazonal apontava para essa chave.
    `getCurrentSeason()` passava um `Date` para `monthlySeasonRange(year, month)`.
11. **Índices compostos ausentes.** As consultas do Hall da Fama e do ranking
    sazonal falhariam em produção. → 3 índices adicionados.
12. **Código de convite gerado no navegador a cada render.** O atleta via um
    código diferente a cada carregamento, nunca gravado e sem dono — nenhuma
    indicação seria creditada. → passa a usar o código persistido
    (`useUserReferralCode` + `ReferralCard`).

### Comportamento e produto

13. **Missões viravam às 21h.** O dia usava `toISOString()` (UTC). Novo
    `missionDay.js` calcula dia/mês no fuso de **Brasília** (também para o cap
    diário de kudos e o mês de indicação).
14. **Toasts retroativos.** O listener marcava "já visto" com as listas ainda
    vazias, então celebrava tudo de novo a cada carregamento da página.
15. **`GamificationErrorBoundary` era código morto** — nunca envolveu rota
    alguma. Agora isola as 4 rotas; a mensagem crua do erro só aparece em dev.
16. **`/perfil` consultava dados de gamificação com a flag OFF.** O bloco virou
    `ProfileProgressionSection`, montado só com a flag ligada — coberto por teste.
17. **Toast de conquista nunca renderizado** (importado e não usado) → ligado
    no hub.
18. **`/conquistas/:uid` estampava o uid cru** como identidade do atleta. Agora
    mostra nome e avatar, com link para o perfil completo.
19. **Contagem fixa "83"** enquanto o catálogo tem 88 conquistas → passa a vir
    de `ACHIEVEMENTS_V2.length`.
20. **`teacher_*` somava na trilha "Torneiro"** — todo professor aparecia como
    torneiro. Movido para a trilha de aulas.
21. **`freezesUsed` limitado a 3** travava o save de quem repõe e usa de novo.

### Padrões do projeto

22. `tone="cyan"` e `tone="purple"` não existiam no `V2Badge` (caíam em cinza)
    → tons adicionados ao design system.
23. pt-BR: "grace", "freezes", "comeback", "skill trees", "Season", "Signup"
    traduzidos.
24. `console.warn/error` em service/hook/boundary → `core/lib/logger`.
25. Flag ausente de `featureFlagGroups.js`; descrição prometia sub-flags que
    não existem.
26. Auditoria (`audit_logs`) na única escrita cruzada com UI: kudo.
27. 48 avisos de lint a menos; imports e variáveis mortos removidos.
28. `retry: 2` na CI (esconde teste genuinamente instável) → `1`.
29. Documentação: **13 coleções** em `05-DATA-MODEL.md` (eram 0), rotas em
    `01-AI-CONTEXT.md`, `06-MODULES.md` e os dois READMEs de módulo.

### Testes acrescentados
- `gamificationRulesSync.test.js` — trava a sincronia domínio ↔ schema ↔
  `firestore.rules` na CI (é a regressão que causou os itens 1–4).
- `tests/rules/gamification.rules.emulator.mjs` — **51 asserções** contra o
  emulador real do Firestore.
- `seasonRankingService.test.js` (era o único service sem teste — e onde
  estavam os itens 9 e 10), `missionDay.test.js`,
  `V2Profile.gamificationFlag.runtime.test.jsx`.

**Estado: 2.486 testes verdes, 0 erro de lint, build e typecheck limpos.**


## [1.0.0] · 2026-09-02 — Implementação completa

### Adicionado

#### Domínio (14 novos arquivos)
- `progressionV2.js` — XP multi-fonte com 40+ fontes, caps diário/semanal/burst
- `tiers.js` — 9 tiers (Calouro→Imortal) com curva progressiva
- `skillTrees.js` — 5 árvores paralelas (tournament/match/social/mentorship/consistency)
- `streakProtection.js` — grace day, freeze, vacation mode, comeback bonus, milestones
- `xpLedger.js` — event validation + anti-farming
- `missions.js` — gerador diário/semanal/mensal (25 templates, Mulberry32 PRNG)
- `referrals.js` — códigos 8-char, recompensas, anti-farm
- `kudos.js` — universal, 7 target types, spam detection
- `socialBonds.js` — rivals, crews, mentorship
- `seasons.js` — 4 seasons/ano, hall da fama sazonal
- `gamificationEvents.js` — 29 eventos em snake_case
- `achievementsV2.js` — 83 conquistas (5 famílias × 5 raridades)
- `progressionV2Schema.js` — Zod schemas para Firestore
- (telemetry já vem da V1)

#### Componentes (9 novos)
- `TierBadge` — badge com cor/ícone por tier + crown no Imortal
- `SkillTreeBars` — 5 barras paralelas com progresso
- `ProgressionCardV2` — card unificado (tier + nível + streak + skills + próximo)
- `MissionList` — missões com 3 sizes + bonus claim
- `ReferralCard` — código + share + recompensas
- `KudosButton` — universal, optimistic, 3 sizes
- `AchievementCardV2` — raridade glow + family color + share
- `AchievementUnlockToast` — slide+fade (já existia)
- `MissionCompleteToast` — slide+fade
- `StreakShieldBadge` — grace + freeze + vacation + comeback

#### Hooks (6 novos)
- `useAchievementsV2` — combina stats/rating/matchDates
- `useUserProgressionV2` — observa doc materializado
- `useUserMissionsV2` — auto-cria doc do dia
- `useUserAchievementsV2` — observa unlocked
- `useStreakMetaV2` — grace + freeze + vacation
- `useGamificationTracker` — gtag/firebase.analytics instrumentação
- `useSyncProgressionV2` — materializa doc a partir do V1
- `useHallOfFame` — top 50
- `useCelebrationListener` — dispara toasts em eventos

#### Services Firestore (4 novos)
- `progressionV2Service` — get/set/watch com validação
- `missionService` — getOrCreate + progress + claim
- `achievementsV2Service` — list + unlock + share + notified
- `streakMetaService` — getOrCreate + enable/disable vacation + consume/add freeze
- `hallOfFameService` — query top 50

#### Páginas V2 (3 novas, todas gated)
- `/conquistas` — V2Achievements (catálogo 83)
- `/gamification` — V2GamificationHome (hub unificado)
- `/hall-da-fama` — V2HallOfFame (podium + ranking top 50)

#### Persistência
- 4 coleções Firestore novas: `user_progression_v2`, `user_missions`, `user_achievements_v2`, `user_streak_meta`
- 4 match blocks aditivos no `firestore.rules` (todas com leitura por owner+admin, escrita por owner+admin)
- Schema versioning (`schemaVersion: 1`) em todos os docs

#### Integração
- V2Profile mostra `ProgressionCardV2` quando flag ON
- Telemetria: 29 eventos com prefix `gamification_*`
- Tailwind keyframes: `slide-in-right`, `slide-out-right`

### Garantias
- **Zero impacto em V1** (1922 testes V1 continuam passando)
- **Zero alteração em `users/{uid}`**
- **Bundle size**: lazy imports — só carrega se você acessar a rota
- **Feature flag única**: `GAMIFICATION_V2` controla tudo
- **27 commits atômicos** com mensagens descritivas
- **+447 testes** Vitest (1922→2369)

### Como ativar

```bash
# 1. Merge via PR
git push -u origin feature/gamification
gh pr create --base main --head feature/gamification

# 2. Após merge, no /admin/console:
#    Ativar flag: GAMIFICATION_V2 = true

# 3. Rotas ficam disponíveis:
#    /conquistas      → 83 conquistas
#    /gamification    → Hub (missões + tier + achievements + skill trees + referral)
#    /hall-da-fama    → Top 50 público
```

### Métricas
- **+447 testes** (1922 → 2369)
- **27 commits atômicos**
- **14 domínios novos**
- **9 componentes novos**
- **6 hooks novos**
- **5 services novos**
- **3 páginas V2 novas**
- **4 coleções Firestore novas (todas com regras aditivas)**
- **1 feature flag master**
- **0 alteração em V1**
- **0 alteração em `users/{uid}`**
- **Lint clean, build green**
