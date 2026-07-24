# `clubs/` — Clubes e comunidade

Clubes com associação por papel, mural, fórum (com enquetes), eventos e
game-day (com Mexicano + Rei da Quadra), ranking interno, página pública.

## Status
- **Páginas V2**: `V2Clubs`, `V2ClubDetail`, `V2EventDetail`, `V2CreateClub`,
  `V2ClubPublicPage` (Onda 8b)
- **Componentes**: `V2ClubAdmin`, `V2ClubEvents`, `V2ClubFeed`,
  `V2ClubForums`, `V2ClubMembers`, `V2EventChat`, `V2EventDatesPanel`,
  `V2EventParticipantsPanel`, `V2ForumPoll`, `V2ForumThreadView`,
  `V2GameDayOrganizer` (com Mexicano + Rei da Quadra), `V2ClubInternalRanking`
  (Onda 8), `V2ClubRecurringEvents` (Onda 8b), `V2ClubInviteLink` (Onda 8b)
- **Services**: `clubService`, `forumService`
- **Domain**: `clubRanking`, `forumPoll`, `gameDayDraw`, `mexicano`,
  `reinaQuadra`, `constants`
- **Tests**: 100+

## Schema
- `clubs/{id}` — `is_public` (Onda 8b), `public_slug`, `invite_link`,
  `recurring_rule`, `internal_ranking_config`
- `club_members/{clubId_uid}` (id determinista) — `role` ('admin'|'member')
- `club_join_requests/{clubId_uid}` (id determinista)
- `club_member_invites/{clubId_uid}` (id determinista)
- `club_posts`, `club_forum_threads`, `club_events`, `club_event_rsvps`,
  `event_invites`, `dates`, `date_rsvps`, `poll_votes`, `comments`

## Hooks
```js
import { useClubs, useClub } from '@/modules/clubs/hooks/useClubs';
import { useClubForum } from '@/modules/clubs/hooks/useClubForum';
import { useClubRanking } from '@/modules/clubs/hooks/useClubRanking';
import { useClubPublicPage } from '@/modules/clubs/hooks/useClubPublicPage';
```

## Feature flags
- `LINKED_CLUBS` — clubes vinculados
- `GAMEDAY_FORMATS` — Mexicano + Rei da Quadra
- `CLUB_INTERNAL_RANKING` — ranking interno (Onda 8)
- `CLUB_INVITE_LINK` — link de convite (Onda 8b)
- `CLUB_RECURRING_EVENTS` — eventos recorrentes (Onda 8b)
- `CLUB_PUBLIC_PAGE` — página pública (Onda 8b)

## Onde achar mais
- `docs/06-MODULES.md` § clubs
- `docs/09-UX-ANALYSIS/09-clubes-comunidade.md` (CLU-*)
