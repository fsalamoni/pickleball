# 01 — Estado atual da gamificação (o que EXISTE no código)

> Foto do que está em produção. Se um item não está aqui, não foi construído.
> Última verificação: 2026-09-04, sobre `main`.

---

## 1. A flag

| Item | Valor |
|---|---|
| Chave | `gamification_v2` |
| Constante | `FEATURE_FLAG.GAMIFICATION_V2` (`src/core/featureFlags.js`) |
| Default | **OFF** |
| Onde muda | `/admin/console` → grupo de gamificação, ou `platform_settings/global.feature_flags` |
| O que protege | as rotas novas **e** os hooks que escrevem progressão |

Com a flag OFF: as rotas respondem com o estado "em construção", nenhum hook de
gamificação dispara leitura ou escrita, e nenhuma tela existente muda de layout.
Isso foi verificado tela a tela (8/8) e por contagem de documentos criados (zero).

---

## 2. Coleções Firestore (13, todas novas)

Nenhuma coleção pré-existente foi alterada. Nenhuma regra antiga foi tocada.

| Coleção | Chave do documento | Conteúdo | Quem escreve |
|---|---|---|---|
| `user_progression_v2` | `{uid}` | XP total, tier, skill trees, streak | o próprio atleta (sync) |
| `user_achievements_v2` | `{uid}_{achievementId}` | conquista desbloqueada | o próprio atleta |
| `user_missions` | `{uid}_{YYYY-MM-DD}_{missionId}` | missão do dia e progresso | o próprio atleta |
| `user_streak_meta` | `{uid}` | escudos de streak e uso | o próprio atleta |
| `user_kudos` | auto | kudo enviado (de → para, jogo) | quem envia |
| `user_kudos_index` | `{uid}` | contadores agregados de kudos | quem envia |
| `crews` | auto | grupo social | dono da crew |
| `crew_members` | `{crewId}_{uid}` | associação | dono / o próprio |
| `mentorships` | auto | par mentor/aprendiz | as duas partes |
| `user_referral_codes` | `{uid}` | código de convite do atleta | o próprio atleta |
| `user_referrals` | `{novoUid}` | quem convidou quem | o convidado (na 1ª sessão) |
| `season_rankings` | `{seasonId}_{uid}` | posição na temporada | **só a Cloud Function** |
| `arena_referrals` | auto | convite originado de arena | arena / atleta |

**Índices compostos**: 4 novos em `firestore.indexes.json`, todos para as
coleções acima. Nenhum índice existente foi alterado.

---

## 3. O que está pronto e funcionando

### 3.1 Progressão (XP, níveis, tiers)
- **XP derivado da atividade real** (`domain/xpTotal.js`): torneios jogados,
  dias de jogo, conquistas, missões, streak. Recalculado, nunca incrementado.
- **Curva de nível idêntica à V1** (`progressionV2.js`) — um atleta antigo não
  perde nem ganha nível ao ligar a flag. `MAX_LEVEL_V2 = 200` é só um limite de
  sanidade de persistência, não um teto da curva.
- **Tiers com nome** (`tiers.js`) — `TIER_NAMES` é a fonte única; o schema zod e
  as regras do Firestore derivam dela. (Antes existiam três vocabulários de tier
  em paralelo; foi unificado na auditoria pré-merge.)
- **Skill trees** (`skillTrees.js`) — 5 trilhas derivadas da atividade.

### 3.2 Conquistas
- **Catálogo de 83 conquistas** em `achievements/domain/achievementsV2.js`,
  organizadas por `ACHIEVEMENT_FAMILY` (o schema deriva daí, não duplica).
- Sincronização por hook (`useSyncAchievementsV2`), desbloqueio idempotente.
- Telas: `/conquistas` (própria) e a versão pública de outro atleta.

### 3.3 Missões
- Geração diária determinística (`missions.js` + `missionDay.js`), com métricas
  reais (`missionMetrics.js`) lidas da atividade do atleta.
- Rótulos em pt-BR (`missionLabel()`) e **validação pelo schema zod antes de
  gravar** — foi exatamente a ausência disso que fazia nenhuma missão ser criada.

### 3.4 Streak com proteção
- `streakProtection.js` + `user_streak_meta`: escudos que preservam a sequência.

### 3.5 Social
- **Rivais, crews e mentoria**: domínio (`socialBonds.js`), service, hooks e a
  tela `/vinculos` (`V2SocialBonds.jsx`) com os três painéis.
- **Kudos**: `kudos.js` + `KudosButton` + índice agregado.

### 3.6 Convites (referral)
- Código por atleta (`useUserReferralCode`), captura na primeira sessão
  (`referralCapture.js`), landing dedicada (`V2ReferralLanding.jsx`).

### 3.7 Temporadas
- `seasons.js` + **Cloud Function `recomputeSeasonRankingDaily`**
  (`functions/seasonRanking.js`), que materializa `season_rankings`.
- `/hall-da-fama` mostra o top 50 público.

### 3.8 Robustez
- `GamificationErrorBoundary` isola a gamificação: um erro dentro dela não
  derruba a tela que a hospeda.
- Suíte de regras contra o emulador (54 asserções) e smoke test de navegador.

---

## 4. O que NÃO existe (resumo; detalhe em `02-ESTUDO-VS-IMPLEMENTADO.md`)

- Economia de XP com **gasto** (loja, cosméticos, resgates).
- Match reviews (avaliação pós-jogo entre atletas).
- Painel "review da semana" com jornada emocional.
- Onboarding gamificado (primeiros 7 dias roteirizados).
- Painel de engajamento do professor e health score de arena.
- Leaderboards internos de clube com temporada própria.
- Telemetria de funil da gamificação.
- Eventos ao vivo / temporadas temáticas com conteúdo editorial.
