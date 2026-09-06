# `moderation/domain/` — lógica pura (PLANEJADO)

Especificação: `docs/FUTURO/CONFIANCA-E-MODERACAO/04-DATA-MODEL.md` § Domínio.

| Arquivo | Exporta (previsto) | Testes |
|---|---|---|
| `constants.js` | `REPORT_TARGET`, `REPORT_REASON`, `SEVERITY`, `MODERATION_ACTION` + labels pt-BR | 8 |
| `report.js` | `normalizeReport`, `severityFor`, `groupIdFor`, `validateReport` | 22 |
| `priority.js` | `priorityScore`, `distinctReporters`, `ageBoost` | 20 |
| `reporterWeight.js` | `reporterWeight` | 14 |
| `strikes.js` | `activeStrikeWeight`, `sanctionForWeight`, `isExpired` | 22 |
| `sanctions.js` | `effectsOf`, `isProportional`, `canRevert` | 18 |
| `blocks.js` | `isBlocked`, `filterBlocked`, `blockPairKey` | 16 |
| `mutes.js` | `isMuted`, `applyMutes`, `muteExpired` | 12 |
| `rateLimit.js` | `windowKey`, `checkLimit`, `limitMessage`, `nextReset` | 24 |
| `autoModeration.js` | `screenContent`, `matchBannedTerms`, `suspiciousLink`, `isDuplicate` | 26 |
| `coordination.js` | `detectCoordination` | 14 |
