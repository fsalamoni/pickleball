# `achievements/` — Conquistas

Conquistas e medalhas. Duas gerações convivem: a V1 (`achievements.js`,
20 conquistas, sempre ativa) e a **V2** (`achievementsV2.js`), atrás da
flag `GAMIFICATION_V2`.

## Status
- **Domain**: `achievements.js` (V1), `achievementsV2.js` (V2 — módulo
  folha, sem imports, 5 famílias × 5 raridades)
- **Services**: `achievementsV2Service` (`user_achievements_v2`)
- **Hooks**: `useAchievements` (V1), `useAchievementsV2`,
  `useUserAchievementsV2`
- **Components**: `AchievementsCard` (V1), `AchievementCardV2`,
  `AchievementUnlockToast`
- **Páginas**: `/conquistas` (V2Achievements) e `/conquistas/:uid`
  (V2PublicAchievements) — ambas gated por `GAMIFICATION_V2`

## Famílias e raridades (V2)
- Famílias: `career`, `social`, `discovery`, `seasonal`, `community`
- Raridades: `common`, `uncommon`, `rare`, `epic`, `legendary`

**O total NUNCA é escrito à mão.** Use `ACHIEVEMENTS_V2.length` — o número
cravado no código (83) já ficou defasado do catálogo real e a interface
mostrava "X/83" enquanto existiam 88 conquistas.

`achievementsV2.js` é deliberadamente um módulo **sem imports**: o schema
de progressão importa as famílias daqui, e qualquer dependência de volta
para `progression/` criaria ciclo.

## Feature flag
- `GAMIFICATION_V2` (`gamification_v2`) — default OFF. Desligada, só a V1
  aparece (em "Meu desempenho").

## Onde achar mais
- `docs/06-MODULES.md` § achievements
- `docs/05-DATA-MODEL.md` § Gamificação V2
