# `tournament/` — Núcleo: torneios e modalidades

> **Pilar principal da plataforma.** Torneios de ponta a ponta: criação,
> modalidades, inscrições, sorteio, agendamento por quadra, jogos, ranking
> ao vivo, admins compartilhados, visão pública, impressão, telão e
> courtside scoring.

## Status

- **Páginas V2**: `V2Tournaments`, `V2Tournament`, `V2CreateTournament`,
  `V2JoinTournament`, `V2ModalityPage`, `V2FormatsGuide`, `V2TournamentTVMode`,
  `V2CourtsideScoring`, `V2TournamentWizard` (Onda 5b)
- **Componentes V2**: `V2TournamentDrawTab`, `V2TournamentModalitiesTab`,
  `V2TournamentRegistrationsTab`, `V2MatchesBlock`, `V2RankingBlock`,
  `V2OverviewBlock`, `V2Gallery`, `V2TournamentAdminPanel`,
  `V2ParticipationHistoryCard`, `V2ModalityInfoContent`, `V2Collapsible`,
  `V2TournamentOpsDashboard`, `V2BracketTree` (Onda 4b)
- **Services**: `tournamentService`, `modalityService`, `registrationService`,
  `participationService`, `matchService`, `drawService`, `rankingService`,
  `courtService`, `tournamentAnnouncementService`, `tournamentPhotoService`
- **Domain**: 25+ arquivos puros testados (scoring, draw, progression,
  doubleElimination, swiss, mexicano, reinaQuadra, schedule, ranking,
  capacity, eligibility, participation, formatExplain, whistTables,
  constants, archiveValidation, bracketLayout)
- **Hooks**: `useTournament`, `useTournamentAnnouncements`,
  `useTournamentPhotos`, `useTournamentOps`, `useTournamentWizard`
- **Tests**: 200+ (scoring, draw, ranking são os mais densos)

## Schema (Firestore)

### `tournaments/{id}`
- `name`, `description`, `owner_id`, `status` (draft/open/running/finished/cancelled)
- `public: bool` (visível em `/p/:id`)
- `arena_id` (opcional, Sprint 4 ARE-14)
- `archived`, `archived_at`, `archived_by`
- `templates: bool` (Onda 5)
- `wizard_draft: object` (Onda 5b)

### `tournament_modalities/{id}`
- `tournament_id`, formato (single/doubles/americana/whist), nível,
  categoria, capacidade, taxa, config de fase

### `tournament_admins/{tournamentId_uid}` (id determinista)
- Admin compartilhado do torneio

### `tournament_registrations/{id}`
- Inscrição: modality_id, jogadores, level, check-in, status, taxa

### `tournament_matches/{id}`
- Jogo: modalidade, fase/rodada, duplas, placar, status, quadra, horário

### `tournament_groups/{id}`
- Grupos da fase de grupos

### `tournament_rankings/{id}` (materializado)
- Ranking por formato

### `tournament_courts/{id}`
- Quadras do torneio

### `tournament_announcements/{id}` (Onda 9b)
- Avisos em destaque no torneio

### `tournament_photos/{id}`
- Galeria de fotos

Regras: `firestore.rules` — match por coleção.

## Fluxo típico

1. Criar torneio → `createTournament` (status=draft)
2. Adicionar modalidades → `addModality`
3. Abrir inscrições (`status=open`) → notifica comunidade se `public`
4. Inscrições/check-in → `registerPlayer`, `checkinPlayer`
5. Sortear → `drawService` + `domain/draw.js` (seed reproduzível)
6. Agendar quadras → `courtService` + `domain/scheduling.js`
7. Registrar resultados → `matchService.updateScore` → atualiza ranking
8. Ranking recalculado → `rankingService` + `domain/ranking.js`
9. Cloud Function `recomputeRankingOnTournamentChange` atualiza nacional

## Hooks expostos

```js
import { useTournament } from '@/modules/tournament/hooks/useTournament';
import { useTournamentAnnouncements } from '@/modules/tournament/hooks/useTournamentAnnouncements';
import { useTournamentWizard } from '@/modules/tournament/hooks/useTournamentWizard';
```

## Onde achar mais

- `docs/06-MODULES.md` § tournament
- `docs/01-AI-CONTEXT.md` §5 (rotas)
- `docs/09-UX-ANALYSIS/05-organizador-criacao-gestao.md` (ORG-*)
- `docs/09-UX-ANALYSIS/06-organizador-dia-de-jogo.md` (DIA-*)
