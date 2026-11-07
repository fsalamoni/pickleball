# 56 — Torneio: rascunho, publicação e prazos das inscrições

> Pedido do dono em 2026-11-07. O torneio nasce **rascunho** (só a equipe vê),
> é **publicado** quando a equipe decide, e as inscrições **abrem e encerram
> sozinhas** na data e hora marcadas. O pagamento fica à vista da abertura até
> o **prazo para pagamento** (igual ou depois do encerramento).

## 1. Os estados

| Status | Quem vê | Inscrição pela própria pessoa |
|---|---|---|
| `draft` (Rascunho) | criador, `tournament_admins` do torneio, admin da plataforma | não |
| `published` (Inscrições em breve) | todos | não — até `registration_opens_ms` |
| `registrations_open` | todos | sim, até `registration_closes_ms` (se houver) |
| `registrations_closed` | todos | não |
| `in_progress` / `finished` / `cancelled` | todos | não |

A equipe do torneio inscreve pessoas **sempre** (é o caminho do organizador na
regra, não o da própria pessoa). Arquivado segue como antes: só o criador, os
administradores e o admin da plataforma abrem.

`VISIBLE_TOURNAMENT_STATUSES` (`tournament/domain/constants.js`) é a lista que
toda consulta de lista leva (`where('status', 'in', …)`) — ver §4.

## 2. Os campos (todos opcionais, aditivos)

Em `tournaments/{id}`:

- `registration_opens_ms` — abertura (ms). Em branco: abre ao publicar.
- `registration_closes_ms` — encerramento (ms). Em branco: só à mão.
- `payment_deadline_ms` — prazo para pagamento (ms), **≥ encerramento**. Em
  branco na tela vira o encerramento (`withPaymentDefault`).
- `registration_deadline` — o **dia** do encerramento (`AAAA-MM-DD`), mantido
  em sincronia para quem lê o formato antigo (início, agenda, carreira).
- `published_at`, `schedule_change` (`open`|`close`), `schedule_changed_ms`,
  `registrations_open_notified` — gravados pela publicação e pelo servidor.

Torneio antigo, sem os campos: nada muda — status manual como sempre, pagamento
à vista até cancelar. Nada foi migrado (produção tinha zero rascunhos).

## 3. A conta (uma só, com cópia no servidor)

`tournament/domain/registrationWindow.js`:

- `effectiveTournamentStatus(t, agora)` — o status como a TELA deve mostrar
  entre duas passadas do servidor (publicado com a abertura vencida = aberto;
  aberto com o encerramento vencido = encerrado).
- `registrationWindow` / `isRegistrationOpen` / `registrationBlockReason` — se
  a pessoa pode se inscrever e, se não, o porquê.
- `isPaymentOpen` — o botão de pagar e o Pix da própria inscrição.
- `statusFromSchedule` — o status que as datas mandam (usado ao salvar as datas).
- `statusPatchForManualChange` — abrir/encerrar à mão acerta a data junto
  (abrir puxa a abertura para agora; encerrar grava o encerramento agora;
  reabrir com o encerramento vencido é recusado com o motivo).
- `publishOutcome`, `scheduleProblems`, `localInputToMs`/`msToLocalInput`/`msToLocalDate`.

`dueScheduleChange` tem cópia em `functions/tournamentSchedule.js`, com teste
de **paridade** (`functions/tournamentSchedule.test.js`).

## 4. A regra (`firestore.rules`, bloco `tournaments`)

- `allow get`: admin da plataforma, criador, `isTournamentAdmin(tid)` ou
  (não arquivado **e** status ≠ `draft`).
- `allow list`: admin, `od().status != 'draft'` ou `od().creator_uid == me()`.
  ⚠️ **Na lista, use o campo direto, nunca `og()`**: `resource.data.get(k, d)`
  sobre um campo que a consulta não restringe devolve o padrão e a regra
  "prova" qualquer documento — o emulador mostrou rascunho vazando para quem
  não tem conta. Por isso toda consulta de lista sem ser do admin leva o filtro
  de status (`listPublicTournaments`, `listArenaTournaments`,
  `getTournamentByInviteCode`, clube, federação); sem ele a regra recusa a
  consulta inteira. Igualdade + `in` não pede índice composto.
- Auto-inscrição (`tournament_registrations` create, caminho da própria
  pessoa): `tRegOpen(tid)` — status `registrations_open`, ou `published` com a
  abertura vencida, e antes do encerramento, pelo relógio do servidor
  (`request.time`). Provado em `tests/rules/tournamentPublication.rules.test.js`.

## 5. O servidor (`functions/tournamentSchedule.js`)

- `tournamentScheduleWorker` (a cada 5 min): vira `published → registrations_open`
  e `registrations_open → registrations_closed` pela data, gravando
  `schedule_change` e `schedule_changed_ms`. Só toca esses status; encerrado à
  mão sem data fica encerrado.
- `tournamentScheduleNotify` (gatilho de update em `tournaments`): quando um
  torneio **público** abre, avisa a comunidade uma vez (`tournament_open`,
  marca `registrations_open_notified` antes); quando a virada foi pela data,
  avisa o criador e os administradores. O cliente não manda mais o aviso à
  comunidade.

## 6. As telas

- **Criar torneio** (`V2CreateTournament`): Início/Fim e, logo abaixo, os três
  campos de data e hora (`RegistrationScheduleFields`, `data-dica="torneio-prazos"`),
  com a explicação de que nasce rascunho.
- **Configurações → Datas operacionais** (`TournamentAdminTab`): os mesmos
  campos; salvar acerta o status pelas datas. **Status da operação**: em
  rascunho, a faixa de publicar (`PublishTournamentBanner`, `data-dica="torneio-publicar"`);
  publicado, "Abrir inscrições agora" / "Encerrar inscrições agora" (o abrir
  trava com o encerramento vencido, dizendo como reabrir), "Voltar para
  rascunho" (só sem inscrição ativa, `unpublishTournament`) e Cancelar.
- **Página do torneio** (`V2Tournament`): a faixa de publicar para a equipe,
  o status efetivo, "Inscrições até" com hora e a linha dos prazos
  (`RegistrationWindowNote`); rascunho de outra pessoa (`permission-denied`)
  diz "ainda não está disponível" em vez de pedir para tentar de novo. A
  página pública `/p/:id` faz o mesmo.
- **Inscrição e pagamento**: `ModalityCard` (visão geral), a aba Inscrições e a
  página da modalidade trocam o botão pelo motivo (`registrationBlockReason`)
  fora da janela; o botão de pagar só aparece com `isPaymentOpen`. Os serviços
  `createRegistration` e `registerTeam` conferem de novo (a pessoa recebe o
  motivo, não "permissão negada").
- A arena da sede é avisada ao **publicar** (antes era ao criar).

## 7. O que não pode regredir

1. Rascunho não aparece em lista nenhuma para quem não é da equipe, e a lista
   da regra usa campo direto (§4).
2. Consulta nova de lista de torneios leva `where('status', 'in', VISIBLE_TOURNAMENT_STATUSES)`.
3. Prazo de pagamento ≥ encerramento > abertura (`scheduleProblems`, na criação
   e ao salvar).
4. A virada pela data é do SERVIDOR; a tela só mostra o status efetivo.
5. A equipe do torneio inscreve fora da janela; a pessoa, não (regra + serviço).
