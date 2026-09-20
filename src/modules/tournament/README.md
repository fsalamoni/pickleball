# `tournament/` — Núcleo: torneios e modalidades

> ⭐ **Onda AT — formatos, grupos e chaves com qualquer número de inscritos.**
> Existe um padrão bom (regulamento USA Pickleball + práticas dos circuitos) e
> **o admin do torneio pode trocar tudo**. Domínios novos:
> `tiebreak.js` (desempate oficial com confronto direto — fonte ÚNICA),
> `crossGroup.js` (comparar grupos de tamanhos diferentes por aproveitamento +
> repescagem), `groupPlan.js` (em quantos grupos dividir N inscritos) e
> `directEntry.js` (quem pula fases e entra direto mais à frente).
> Ver `docs/26-TORNEIO-FORMATOS-E-REGRAS.md`.


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
  constants, archiveValidation, bracketLayout, tiebreak, crossGroup,
  groupPlan, directEntry, phaseRules, phaseAdvancePreview,
  registrationEntrant)

### ⚠️ A aba de sorteio tem DOIS ramos

`V2TournamentDrawTab` escolhe por `stages.length`: **uma** fase vai para o
`ModalityDrawBlock` (no próprio arquivo) e **várias** fases vão para o
`MultiPhaseDrawBlock`. Ferramenta acrescentada num ramo só **não dá erro** —
dá metade dos organizadores sem ela. Foi o que aconteceu com a entrada direta,
montada justamente no ramo onde ela não renderiza (`fases.length < 2 ⇒ null`).
`src/core/guards/torneioRegras.test.js` lê o código-fonte e reprova quem montar
`StageExplanation` ou `DirectEntryPanel` em apenas um dos dois.

### ⚠️ A próxima fase é montada num lugar só

`previewPhaseAdvance` (`domain/phaseAdvancePreview.js`) é chamada **pela tela**
(para mostrar quem passa antes do clique) e **pelo serviço** (para gravar). O
que se anuncia é o que acontece. Nunca chame `buildNextPhaseEntrants` direto
fora dali — há guarda de fonte.
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

## Contato do inscrito (P0-02)

`tournament_registrations` é **lido sem login** — o quadro do torneio, a
impressão de grupos e o telão dependem disso. Por isso o e-mail **não mora no
documento**:

| Onde | O quê | Quem lê |
|---|---|---|
| `tournament_registrations/{rid}` | nome, nível, status, seed | qualquer um, sem login |
| `tournament_registrations/{rid}/private/contact` | e-mail dos dois jogadores | titular, dupla, quem criou, organizador, admin |
| `provisional_claims/{rid}_a\|b` | prova de inscrição provisória | só o dono do e-mail (pelo TOKEN) |

**Nunca leia `reg.player_a_email` direto** — esse campo só existe em inscrição
legada. Use `resolveRegistrationContact(reg, contact)` (domínio puro) ou
`registrationContactService` (I/O). Enquanto houver documento antigo, os dois
caem no campo público sozinhos.

O *claim* do login procura em **duas fontes**: a consulta antiga por
`player_a_email_lc` (legado) e `provisional_claims` (novo). A regra do
Firestore aceita as duas provas de posse, então a correção não derrubou quem
já estava inscrito.

---

## ⚠️ Falha de consulta não é lista vazia

`const { data = [] } = useX()` devolve `[]` quando a consulta **falha**, e a
tela conclui que não existe nada. No torneio isso virava afirmação em lugares
caros: *"Nenhum torneio público no momento"* na **lista** (a porta de entrada
da área), *"Comece criando a primeira modalidade"* na aba de modalidades —
convidando a criar uma modalidade **duplicada**, com inscrições —, *"Torneio
não encontrado. Verifique o link recebido"* na página **pública**, que chega a
quem não tem conta e acusa justamente o que essa pessoa não pode conferir.

Se a tela vai **afirmar** algo a partir do vazio, ela precisa de `isError` e de
`<V2ErrorState onRetry={refetch} />`.

⚠️ O guarda é uma **varredura** (`core/guards/afirmaVazio.js` +
`falhaNaoEVazio.test.js`): examina quem EXISTE no escopo, não quem alguém
lembrou de cadastrar numa lista. A isenção exige **motivo escrito**, e o
critério é um só — se a frase leva alguém a AGIR (criar de novo, sortear de
novo, preencher à mão), ela não se isenta.

E o caso mais caro da classe mora na **versão para impressão**: o papel
sobrevive à tela. Modalidade que não carregou não sai na folha, e a folha vai
para a mesa da organização parecendo completa. Por isso aquele aviso é o único
da plataforma que **precisa ser impresso junto**.

Ver `docs/27-FALHA-NAO-E-VAZIO.md`.
