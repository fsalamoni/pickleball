# 48 — Permissões por perfil

> Conferido contra `firestore.rules` (4.396 linhas), `storage.rules`,
> `functions/index.js`, `src/core/lib/FirebaseAuthContext.jsx` e os hooks de
> papéis, em 2026-10-15. **A regra do Firestore é a defesa; a tela é
> conveniência** (princípio 10 do `CLAUDE.md`): esconder um botão não protege
> nada, e o que a regra permite a mais do que a tela oferece é permitido de
> verdade. Este documento diz, para cada perfil, o que o **servidor** garante
> e o que só a **tela** decide.
>
> Complementam este: [`15-DIA-DE-JOGO-PERMISSOES.md`](./15-DIA-DE-JOGO-PERMISSOES.md),
> [`20-SEGURANCA-E-PRIVACIDADE/04-CONTROLE-DE-ACESSO.md`](./20-SEGURANCA-E-PRIVACIDADE/04-CONTROLE-DE-ACESSO.md),
> [`17-ACESSOS-E-PODERES.md`](./20-SEGURANCA-E-PRIVACIDADE/17-ACESSOS-E-PODERES.md),
> [`18-CADASTROS-ADMIN.md`](./20-SEGURANCA-E-PRIVACIDADE/18-CADASTROS-ADMIN.md) e
> [`47-BACKEND-CLOUD-FUNCTIONS.md`](./47-BACKEND-CLOUD-FUNCTIONS.md).

## 1. Onde uma permissão pode ser aplicada

| Camada | Garantia | Exemplo |
|---|---|---|
| **`firestore.rules`** | Servidor. Vale para qualquer cliente, inclusive um que ignore a nossa tela | `allow write: if false` em `player_ratings` |
| **`storage.rules`** | Servidor, para arquivos | `uploads/{uid}/private/**` só do dono |
| **Cloud Function** | Servidor, com o Admin SDK (ignora as regras) — a função **confere o ator sozinha** | `adminDeleteAccounts` exige platform admin e, para executar, o e-mail do dono |
| **Só UI** | Nenhuma. Decide o que aparece | `useGameDayRoles`, `isCoach` no menu, `viewAsUser` |

Regra de leitura rápida: se a coluna "Onde é aplicado" diz **só UI**, o
servidor aceita a escrita de qualquer conta que passe pelas regras mais frouxas
do recurso.

## 2. Os perfis e como cada um é reconhecido

Um mesmo usuário acumula perfis (é atleta, organiza um dia de jogo e administra
um clube). Não há "tipo de conta" único; o papel nasce de **um documento** que
as regras consultam.

| Perfil | O que o define (fonte) | Helper da regra | Helper na tela |
|---|---|---|---|
| **Visitante (sem conta)** | `request.auth == null` | — | rotas públicas em `src/App.jsx` (`/p/:id`, `/torneios/:id/imprimir`, `/torneios/:id/telao`, `/c/:clubId`) |
| **Atleta (conta logada)** | `request.auth != null` | `isAuthed()`, `isOwner(uid)` | `useAuth()` |
| **Organizador de dia de jogo (criador)** | `game_days.created_by == uid` | `isGameDayOwnerOf(gdId)` | `isGameDayCreator` / `useGameDayRoles().ehCriador` |
| **Administrador nomeado do dia** | `uid in game_days.admin_uids` (o criador o nomeia) | `isGameDayAdminOf(gdId)` | `gameDayAdminUids`, `useGameDayRoles().ehAdmin` |
| **Participante de dia aberto** | `uid in member_uids` **e** `manage_mode == 'participants'` | `canManageGameDayOf(gdId)` | `canManageGameDay(..., { participants })` |
| **Admin de torneio** | documento `tournament_admins/{tid}_{uid}` (`role` `owner` ou `admin`); o criador (`tournaments.creator_uid`) ganha o `owner` ao criar | `isTournamentAdmin(tid)`, `isTournamentCreator(tid)` | `useIsTournamentAdmin(tid)` |
| **Membro de clube** | documento `club_members/{clubId}_{uid}` | `isClubMember(clubId)` | `useMyMembership(clubId)` |
| **Equipe de federação** (flag `federations`) | documento `federation_staff/{fedId}_{uid}` com o cargo e a cópia `perms` (cargos da federação em `staff_roles` ou os 8 de modelo; o presidente nasce admin master na aprovação; mandato vencido não dá poder, salvo ao último admin master) | `fedPerms(fedId)`, `fedHas(fedId, perm)`; o admin da plataforma só com `fedPlat(fedId)` | `useMyFederationRole(fedId)` |
| **Filiado de federação** | documento `federation_members/{fedId}_{uid}` (só o servidor cria) | `resource.data.user_id == uid` | `useMyMembership(fedId)` |
| **Admin de clube** | o mesmo documento com `role == 'admin'` (`CLUB_ROLE.ADMIN`); o criador do clube (`clubs.created_by`) é registrado como admin | `isClubAdmin(clubId)`, `isClubCreator(clubId)` | `membership.role === CLUB_ROLE.ADMIN` |
| **Gestor de arena** | documento `arena_managers/{arenaId}_{uid}` (`role` `owner` ou `manager`) | `isArenaManager(arenaId)` | `useMyManagedArenas()` |
| **Dono da arena** | `arenas.owner_id` + `arena_managers.role == 'owner'` | (`allow delete` do `arenas`, trava de `owner_id`) | — |
| **Professor** | existir `coaches/{uid}` (o próprio cria) | `isCoachUser(uid)` | `useCoach(uid)` → `isCoach` (só se a flag de aulas estiver ligada, `V2Layout.jsx`) |
| **Professor da casa (arena)** | `arena_coaches.user_id == uid` (só a arena escreve) | consulta em `arena_class_bookings` | `useMyCoachProfiles()` |
| **Aluno de professor** | `coach_students/{coach}_{aluno}.status == 'active'` | `hasActiveStudent`, `isActiveStudentOf` | — |
| **Equipe da arena (recepção, plantão)** | **não é um perfil de acesso**: `arena_settings.staff` é uma lista de nome/função/turno **sem conta** e sem telefone/e-mail (`staffOnDuty`) | — | `arenas/domain/operations.js` |
| **Vendedor do Mercado** | operar a chave do vendedor: `athlete_{uid}`, `coach_{uid}` (exige `coaches/{uid}`), `store_{uid}` (nasce `pending` até o admin aprovar) ou `arena_{arenaId}` (gestor da arena) | `isMarketOperator(key)` | — |
| **Admin da plataforma** | `users/{uid}.role == 'platform_admin'` (lido pela regra a cada checagem) | `isPlatformAdmin()` | `useAuth().isPlatformAdmin` |
| **Dono da plataforma** | e-mail **verificado** do token = `fsalamoni@gmail.com` | `isPlatformOwnerEmail()` | `isOwnerEmail` (`src/core/config/owners.js`) |

Detalhes que costumam surpreender:

- **`isPlatformAdmin()` custa uma leitura de `users/{uid}`** por checagem. A
  Cloud Function aceita também o custom claim `platform_admin`
  (`isPlatformAdminUser` em `functions/index.js`); as regras, **não** — só o
  documento.
- **Ninguém se promove.** Criar `users/{uid}` só nasce `role: 'user'` (exceto o
  e-mail do dono) e o dono do documento não escreve `role` nem
  `can_create_pools`. A única escrita de `role` pelo cliente é a **revogação**
  pelo dono, e só para `'user'` (assimétrica de propósito).
- **`can_create_pools` é legado**: as regras não o consultam (qualquer conta
  logada cria torneio — ver §4) e nenhuma tela o usa para esconder algo
  (`canCreatePools` só existe no contexto de autenticação e na aba de acessos
  do admin).
- **`viewAsUser` é só tela**: `isPlatformAdmin` do contexto fica `false`
  enquanto o admin "vê como usuário", mas **o servidor continua tratando-o
  como admin** (`isRealPlatformAdmin` não muda).
- **Conta suspensa/bloqueada**: `users.account_status` é escrito **só pelo
  servidor** (`adminSetAccountStatus`); a regra recusa o titular e o admin pelo
  cliente. O login é desligado no Firebase Auth e `FirebaseAuthContext` desloga
  a sessão aberta com o motivo.
- **Equipe da arena** com acesso de verdade é, na prática, **gestor**
  (`arena_managers`): não existe nível intermediário "recepcionista" nas
  regras. O totem e a chegada contornam isso com campos na reserva (§4).

## 3. Legenda da matriz

`✔` pode · `✖` não pode · `◐` parcial (ver nota) · `—` não se aplica.
Colunas: **Vis** visitante · **Atl** atleta logado · **OrgDJ** criador do dia de
jogo · **AdmDJ** administrador nomeado · **AdmT** admin de torneio · **AdmC**
admin de clube · **MemC** membro de clube · **GesA** gestor de arena · **Prof**
professor · **Vend** vendedor do Mercado · **Plat** admin da plataforma.
"Onde" = onde a regra é aplicada.

## 4. Matriz por recurso

### 4.1 Leitura aberta e o que exige login

| Recurso | Vis | Atl | Onde | Observação |
|---|---|---|---|---|
| Flags e configurações (`platform_settings/*`) | ✔ ler | ✔ ler | rules | escrita só `Plat` (`isPlatformAdmin()`) |
| Rankings (`player_ratings`, `player_skill_ratings`, `doubles_rankings`, `rating_history`, `skill_rating_history`, `club_internal_*`) | ✔ ler | ✔ ler | rules | **escrita `✖` para todos, inclusive `Plat`** (`allow write: if false`); só a Cloud Function escreve |
| Torneios não arquivados, modalidades, **inscrições**, jogos | ✔ ler | ✔ ler | rules | inscrição pública = nomes; o e-mail mora em `tournament_registrations/{rid}/private` |
| Arenas, gestores, quadras, janelas, módulos ligados, vagas abertas, bloqueios | ✔ ler | ✔ ler | rules | `arena_managers` e `arenas` são públicos para leitura |
| Professores (`coaches`), validações de nível, clínicas, pacotes, disponibilidade | ✔ ler | ✔ ler | rules | — |
| Resultados publicados de dia de jogo (`club_event_games`) | ✔ ler | ✔ ler | rules | faz parte do ranking oficial |
| Clubes | ◐ só `is_public` | ✔ | rules | demais clubes: `isAuthed()` |
| Qualquer **escrita** | ✖ | — | rules | não há `allow write/create/update/delete: if true` |

Tudo o mais exige conta. O visitante só vê o que o `firestore.rules` abre com
`allow read: if true`; as telas públicas V1 (`/p/:id`, impressão, telão do
torneio, `/c/:clubId`) existem para isso.

### 4.2 Conta e dados pessoais

| Ação | Atl (titular) | Plat | Onde |
|---|---|---|---|
| Ler `users/{uid}` | ✔ o próprio | ✔ todos | rules (`isOwner` / `isPlatformAdmin`) |
| Editar o próprio perfil | ✔ exceto `role`, `can_create_pools`, `hidden*`, `account_status*`, `phone_verified_*` | — | rules |
| Confirmar o celular (`phone_verified_number`) | ◐ só pelo código de 6 números | ✖ pelo cliente | **Cloud Function** `messagingUser` (+ rules recusam o cliente — senão mandaria mensagem paga para o número de outra pessoa) |
| Escolher canais de aviso (`notification_channels`) | ✔ o próprio | — | rules (campo do dono) |
| Corrigir cadastro de outro | ✖ | ◐ lista **fechada** de campos (nome, nascimento, telefone, cidade…); **nunca** `role`, privacidade (`*_public`, `directory_listed`) nem `email` | rules (`hasOnly`) + `adminUserEdit.js` na tela |
| Ocultar atleta (moderação) | ✖ | ✔ (`hidden*`) | rules |
| Suspender / bloquear / reativar | ✖ | ✔ via função | **Cloud Function** `adminSetAccountStatus` (+ rules recusam o cliente) |
| Revelar contato mascarado | ✖ | ✔ via função, com motivo; fica em `admin_access_logs` (só `Plat` lê; o titular não é avisado) | **Cloud Function** `adminSupportReveal` |
| Excluir cadastro / unificar histórico | ✖ | ◐ prévia: qualquer `Plat`; **executar: só o dono** (e-mail verificado) | **Cloud Function** `adminDeleteAccounts`, `adminMergeAccountHistory` |
| Ler `audit_logs` | ✖ | ✔ | rules (`create`: qualquer logado, mas `actor_id == uid`; nunca `update/delete`) |
| Promover alguém a admin | ✖ | ✖ | **só no console do Firebase** (nenhum caminho de cliente concede `role`) |
| Revogar o poder de outra conta | ✖ | ◐ **só o dono** (e-mail do token), resultado obrigatoriamente `role: 'user'` | rules |
| Envios ao DUPR (`dupr_submissions`) | ✔ lê os das partidas em que jogou ou que organizou | ✔ lê tudo; aprova, tenta de novo, apaga no DUPR e destrava pelo servidor | **Cloud Function** `duprIntegration` (`submissions_*`, confere `isPlatformAdmin`) + rules (leitura admin / `uids` / `organizer_uid`, escrita `false`) |
| Piloto do DUPR (`dupr_pilot_players`, `dupr_pilot_matches`) | ✘ | ✔ lê; cria jogadores e envia partidas de teste (UAT) pelo servidor | **Cloud Function** `duprIntegration` (`pilot_*`, confere `isPlatformAdmin`) + rules (leitura só admin, escrita `false`) |
| Conta DUPR (flag `dupr_official_sync`; no piloto, `dupr_policy.audience = admins`, só o admin da plataforma) | ✔ conecta/desconecta a própria; lê o próprio `dupr_links`. O selo `dupr_verified` e, com ele, o ID e o rating **só o servidor escreve** | ✔ lê `dupr_links` | **Cloud Function** `duprIntegration` + rules (`duprSeloIntacto`; `dupr_link_tokens` e `dupr_ids` fechados) |
| Diretório público do atleta (`athlete_profiles`) | ✔ o próprio escreve; qualquer logado lê. Telefone, e-mail e endereço só com a marca `*_public` no espelho **e** no `users/{uid}` | ✔ (contato só com a marca no espelho) | rules (`hidden*` só o admin; `contatosDoDonoPermitidos` / `contatosMarcados`) |
| Arquivos em `uploads/{uid}/**` | ✔ só o próprio grava (< 25 MB); `get` por qualquer logado; `list` só o dono | — | storage.rules |
| `uploads/{uid}/private/**` | ✔ só o dono lê/grava | ✖ | storage.rules (nem o admin) |
| `treino/{uid}/*`, `mercado/{uid}/*` | ✔ dono grava (tipo e tamanho conferidos, sem sobrescrever); `get` por logado | ✖ | storage.rules (comprovante `comprovante-*` do Mercado: o dono não apaga) |

### 4.3 Dia de jogo (`game_days`) — detalhe em [`15`](./15-DIA-DE-JOGO-PERMISSOES.md)

| Ação | Atl | OrgDJ | AdmDJ | Participante (dia aberto) | GesA (dia da arena) | AdmC (dia do clube) | Plat | Onde |
|---|---|---|---|---|---|---|---|---|
| Criar dia | ✔ (`created_by == uid`) | — | — | — | ◐ só com `arena_id` de arena que gere | ◐ só com `club_id` de clube de que é **membro** | ✔ | rules |
| Ver dia | ◐ público, ou membro/criador, ou membro do clube dono | ✔ | ✔ | ✔ | ✔* | ✔ (membro) | ✔ | rules |
| Entrar / sair sozinho | ✔ em dia público; membro do clube em dia do clube | — | — | — | — | — | — | rules (a lista nova tem de ser a antiga ±exatamente a própria pessoa) |
| Operar partidas e participantes (sortear, criar jogo, lançar placar, substituir…) | ✖ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | rules (`canManageGameDayOf`) + `canManageGameDay` na tela |
| Configurar (editar, arquivar, modo de gestão, nomear admin) | ✖ | ✔ | ✖ | ✖ | ✔ | ✔ | ✔ | rules + `canConfigureGameDay` |
| Editar **grupos do Play** | ✖ | ✔ | ✔ (só `format == 'play'`, só chaves `play_groups`, `play_groups_policy`, `updated_at`; lista ≤ 10) | ✖ | ✔ | ✔ | ✔ | rules (cláusula estreita) + `canEditPlayGroups` |
| **Publicar no ranking** (`club_event_games`) | ✖ | ✔ | **✖** | ✖ | ✔ (`isArenaGameDayManagerOf`) | ✔ (`isClubAdmin(club_id)`, ou criador do evento do clube) | ✔ | rules (`create/update/delete`); a tela só mostra o card ao `podeConfigurar` |
| Apagar o dia | ✖ | ✔ | ✖ | ✖ | ✔ | ✔ | ✔ | rules |

\* `canAccessGameDay` para um gestor de arena que não é criador nem membro depende de o dia ser público; todo dia de arena nasce público.

**Onde a regra é mais larga que a tela (Play).** Em `participants` (update) e
`games` (create/update/delete) a regra inclui `isPlayGameDayMember(gdId)`:
**qualquer membro de um dia no formato `play` opera a fila e os jogos, mesmo
com `manage_mode == 'owner_only'`**. A tela (`canManageGameDay`) segue o modo
de gestão e esconde os comandos; o servidor não. É herança do Play
colaborativo, anterior ao modo de gestão. Se quiser um Play realmente
restrito, é preciso mudar a regra — não adianta só esconder o botão.

O que **não** é delegável (e a tela não mostra): `created_by`, `admin_uids`,
`manage_mode`, `arena_id`, `club_id` — o `update` do administrador/participante
é limitado a `member_uids`, `invited_uids`, `updated_at`.

Evento de clube **legado** (`club_events/{id}/participants` e `games`): qualquer
**membro do clube** (`isEventClubMember`) cria/edita/apaga; não há trava de
organizador. Datas novas nascem como `game_days` (doc
[`25`](./25-DIA-DE-JOGO-COMO-MODULO.md)).

### 4.4 Torneio

| Ação | Atl | Criador | AdmT | Plat | Onde |
|---|---|---|---|---|---|
| Criar torneio | ✔ qualquer conta (`creator_uid == uid`); com `arena_id` de arena que **não** gere, nasce `arena_confirmed: false` | — | — | ✔ | rules (`tournamentArenaOk`). Nada exige `can_create_pools` |
| Editar torneio | ✖ | ✔ | ✔ (não troca `creator_uid`) | ✔ | rules |
| Arquivar / desarquivar | ✖ | ✔ (só se `status == 'cancelled'`) | **✖** | ✔ | rules |
| Apagar torneio | ✖ | ✔ | ✖ | ✔ | rules |
| Ver torneio arquivado | ✖ | ✔ | ◐ não (a leitura só libera criador e `Plat`) | ✔ | rules |
| Modalidades, jogos, grupos (criar/editar/apagar) | ✖ | ✔ (é admin) | ✔ | ✔ | rules |
| Inscrever-se | ✔ (`created_by == uid`, nasce na fila/`pending_payment`; `confirmed` só sem taxa; sem `seed`) | — | ✔ inscreve qualquer um | ✔ | rules |
| Confirmar inscrição, cabeça de chave, apagar inscrição | ✖ | ✔ | ✔ | ✔ | rules |
| Check-in / desistir da própria inscrição | ◐ só **quem criou** a inscrição | — | ✔ | ✔ | rules (`created_by`) — o botão só aparece para quem pode (`selfCheckInState`) |
| Ler contato privado da inscrição | ◐ titular, dupla, quem criou | ✔ (organizador) | ✔ | ✔ | rules (`private/`) |
| Ligar jogador provisório a uma conta | ✖ | ✔ | ✔ | ✔ | **Cloud Function** `tournamentLinkRegistrationAccount` (admin do torneio ou `Plat`) |
| Nomear / remover outro admin | ✖ | ✔ | ◐ a regra deixa **qualquer** admin criar, alterar e apagar documentos de `tournament_admins`, sem distinguir `owner` | ✔ | rules (`allow update, delete: isTournamentAdmin`) |
| Espelhar confronto de equipes em `club_event_games` | ✖ | ✔ | ✔ | ✔ | rules (`source == 'team_confrontation'`) |

### 4.5 Clube

| Ação | Atl | MemC | AdmC | Criador do clube | Plat | Onde |
|---|---|---|---|---|---|---|
| Criar clube | ✔ (`created_by == uid`) | — | — | — | ✔ | rules |
| Ler clube | ◐ `isAuthed()` ou `is_public` | ✔ | ✔ | ✔ | ✔ | rules |
| Entrar como membro | ◐ só com **convite pendente** (`club_member_invites`) ou **código** válido (`club_code_joins`), ou sendo o criador | — | ✔ adiciona qualquer um | ✔ | ✔ | rules (`club_members` create) |
| Pedir ingresso | ✔ (`club_join_requests`, `status == 'pending'`, não-membro) | — | ✔ aprova/recusa | — | ✔ | rules |
| Editar clube, convidar, gerir membros | ✖ | ✖ | ✔ | — | ✔ | rules (`isClubAdmin`) |
| Apagar clube | ✖ | ✖ | ✖ | ✔ | ✔ | rules (`created_by`) |
| Sair do clube | — | ✔ apaga a própria associação | ✔ | — | ✔ | rules |
| Criar evento do clube | — | ✔ (`created_by == uid`) | ✔ | — | — | rules |
| Editar evento | — | ◐ evento **não privado**: qualquer membro edita; privado: criador, admin, convidado | ✔ | — | ✔ | rules (`club_events` update) |
| Dia de jogo do clube (módulo) | — | ✔ lê e entra/sai | ✔ organiza e publica | — | ✔ | rules (`isClubGameDayManagerOf`, `isClubGameDayMemberOf`) |
| Recalcular o ranking interno do clube | ✖ | ✖ | ✔ via função | — | ✔ (todos os clubes) | **Cloud Function** `recomputeOneClubInternalRanking` / `recomputeAllClubInternalRankings` |

### 4.6 Arena

| Ação | Atl | GesA (`manager`) | Dono (`owner`) | Plat | Onde |
|---|---|---|---|---|---|
| Criar arena | ✔ (`owner_id == uid`) | — | — | ✔ | rules |
| Registrar-se como dono em `arena_managers` | ✔ só o `owner_id` gravado na arena | — | — | ✔ | rules |
| Editar arena | ✖ | ✔ (não troca `owner_id`) | ✔ | ✔ | rules |
| Apagar arena | ✖ | ✖ | ✔ | ✔ | rules |
| Adicionar / remover gestor | ✖ | ✔ (não remove o vínculo do dono) | ✔ | ✔ | rules (`arena_managers`) |
| Quadras, janelas, bloqueios, módulos, vagas abertas, aulas, professores da casa, checklists, manutenção, estoque, cupons, campanhas | ✖ | ✔ | ✔ | ✔ | rules (`isArenaManager(arena_id)`) |
| `arena_settings` (inclui equipe, `coupon_costs`, marca interna) | ✖ nem ler | ✔ | ✔ | ✔ | rules (leitura só gestor/`Plat`) |
| Pedir reserva | ✔ só **pede** (`requested`; `confirmed` só se `allow_instant_booking`), sem preço acordado nem pagamento | ✔ cria reserva manual (`athlete_id` pode ser nulo) | ✔ | ✔ | rules (`bookingClientUpdateOk`) |
| Confirmar, precificar, marcar pagamento, decidir indicação | ✖ | ✔ | ✔ | ✔ | rules |
| Ler reservas | ◐ as próprias, as em que participa, a de que é professor, ou reserva **aberta** (`open_join`) | ✔ todas da arena | ✔ | ✔ | rules |
| Chegada (check-in) na reserva | ✔ o titular | ✔ | ✔ | ✔ | rules: o mesmo `update` da reserva (zero regra nova); totem: só gestor escreve `arena_devices` |
| Entrar/sair do jogo aberto | ✔ **só a si mesmo** (`openSlotSelfJoinLeave`: contagem = lista, nunca acima das vagas) | ✔ | ✔ | ✔ | rules |
| Fila de espera | ✔ entrar (em nome próprio, no fim) e responder à própria chamada; ler a fila | ✔ tudo | ✔ | ✔ | rules; **quem chama o próximo é a Cloud Function** (`promoverProximo`) |
| Matricular-se em aula | ✔ (`user_id == uid`, `paid == false`) | ✔ cancela/remarca/marca pago | ✔ | ✔ | rules (`arena_class_bookings`) |
| Ler matrículas da aula | ◐ as próprias | ✔ | ✔ | ✔ | rules — o **professor da casa** (`arena_coaches.user_id`) lê as da aula dele, consultando por `coach_id` |
| Membro/carteira/pacote | ✖ escreve; ◐ lê o próprio | ✔ | ✔ | ✔ | rules (`arena_members`, `arena_wallets`: o atleta **pede**, a arena credita) |
| Vender pelo app (loja da arena) | ◐ compra; cria o próprio pagamento (`payer_id == uid`) | ✔ entrega/baixa estoque | ✔ | ✔ | rules (`arena_sales`, `arena_payments`) |

**Equipe da arena sem conta de gestor**: não há como dar a alguém "só a
recepção". Quem opera o balcão é gestor (acesso a tudo da arena, inclusive
`arena_settings`). A lista de plantão em `arena_settings.staff` é informativa.

**Módulos de arena (três camadas)**: a plataforma libera
(`platform_settings/arena_modules`, só `Plat` escreve), a arena ativa
(`arena_module_states`, gestor ou `Plat`) e a tela esconde o que está desligado
(`useArenaModules`, `ArenaModuleGuard`). A segunda e a terceira camadas **não
bloqueiam escrita** nas coleções do módulo: é conveniência de tela; o bloqueio de
quadra (reserva × bloqueio) não depende de flag.

### 4.7 Professor e aluno

| Ação | Atl | Prof (dono do perfil) | Aluno ativo | Plat | Onde |
|---|---|---|---|---|---|
| Criar/editar o próprio perfil `coaches/{uid}` | ✔ só o próprio uid | ✔ | — | ✔ | rules |
| Apagar perfil de professor | ✖ | ✖ | — | ✔ | rules |
| Pedir aula (`coach_lessons`) | ✔ como aluno (`isLessonStudentRequest`: solicitada, sem preço, cupom pendente) e cancelar a própria | ✔ cria/edita/apaga | ✔ | ✔ | rules |
| Ler aula | ◐ a própria | ✔ | ✔ | ✔ | rules |
| Horários ocupados (`coach_busy_slots`) | ✔ ler (público, sem aluno) | ✔ ler; ✖ escreve (só o servidor) | ✔ ler | ✔ ler | rules + servidor |
| Lista de espera (`coach_waitlist`) | ✔ entra (id `{coach}_{uid}`), edita só as preferências, sai | ✔ lê a própria e remove; ✖ cria | — | ✔ | rules (`isCoachWaitlistPrefs`); aviso só pelo servidor |
| Vínculo (`coach_students`) | ✖ cria | ✔ cria/convida (id `{coach}_{aluno}`), encerra | ✔ só **aceita** o convite (`invited` → `active`) ou encerra | ✔ | rules |
| Notas privadas do aluno (`coach_student_notes`) | ✖ | ✔ | ✖ | ✔ | rules |
| Selo de nível (`coach_level_validations`) | ✔ ler (público) | ✔ grava sobre **outra** pessoa, id `{coach}_{aluno}` | — | ✔ | rules |
| Treino/drill "só para alunos" | ✖ | ✔ autor | ✔ lê | ✔ | rules (`isActiveStudentOf`) |
| Cupons/campanhas de professor | ✖ | ✔ só se `coaches/{uid}` existe; o emissor não muda | — | ✔ | rules (`promo_*`, `isPromoIssuer`) |
| Aparecer como "Ensino" no menu | — | ◐ só **UI**: `isCoach` (flag de aulas + perfil) | — | — | `V2Layout.jsx` |

Centro de Treino (resumo): leitura do item = autor, público **aprovado** e não
oculto, compartilhado com você, "alunos" com vínculo ativo, ou `Plat`; criação
validada por formato/autoria/revisão; só o admin modera. Detalhe em
[`40-CENTRO-DE-TREINO.md`](./40-CENTRO-DE-TREINO.md).

### 4.8 Mercado (flag `marketplace`)

| Ação | Atl (comprador) | Vend (opera a chave) | Plat | Onde |
|---|---|---|---|---|
| Ler anúncio | ✔ `active`/`sold_out` | ✔ todos os seus | ✔ | rules |
| Abrir vendedor | ✔ `athlete_{uid}`; `coach_{uid}` exige `coaches/{uid}`; `arena_*` exige ser gestor; `store_{uid}` nasce **pendente** | ✔ | ✔ aprova | rules (flag ligada) |
| Criar/editar anúncio | ✖ | ✔ (campos de confiança travados: moderação, vendas, reputação, `source`) | ✔ | rules (`marketListingLocked`) |
| Ler/gravar Pix, telefone, CNPJ (`market_sellers/*/private/data`) | ✖ | ✔ | ✔ | rules |
| Pedido, oferta, avaliação, disputa — **escrever** | ✖ | ✖ | ✖ | rules: `allow write: if false`; **só a Cloud Function** (§8 do doc 47) |
| Ler pedido | ✔ o próprio | ✔ da sua chave | ✔ | rules |
| Ler endereço de entrega | ✔ o próprio | ◐ só depois do aceite (`shipping_visible`) | ✔ | rules |
| Aceitar/recusar/enviar/entregar | ✖ | ✔ (servidor confere o papel por ação) | — | **Cloud Function** `marketOrderAction` |
| Confirmar recebimento, abrir disputa | ✔ comprador | ✖ | — | **Cloud Function** |
| Resolver disputa / cancelar por admin | ✖ | ✖ | ✔ | **Cloud Function** (papel `admin`) |
| Comprar de si mesmo | ✖ | ✖ | — | **Cloud Function** `marketPlaceOrders` |
| Responder avaliação revelada | ✖ | ✔ (só `reply`) | — | rules |
| Denunciar anúncio | ✔ (um por pessoa; não de si mesmo) | ✖ | ✔ trata | rules |
| Qualquer escrita com o Mercado desligado | ✖ | ✖ | ◐ | rules (`marketOn()`) e funções (`enabled`) |

### 4.8a Federações (flag `federations`) — detalhe em [`50`](./50-FEDERACAO.md)

| Ação | Visitante | Atl (conta) | Filiado (o próprio) | Equipe | Plat | Onde |
|---|---|---|---|---|---|---|
| Ler federação aprovada **e publicada** e planos | ✔ | ✔ | ✔ | ✔ | ✔ | rules (`fedPublic`) |
| Ler federação aprovada e ainda **oculta** (planos, notícias, atos e eventos públicos, cursos, clubes filiados) | ✖ | ✖ | ✔ filiado ativo | ✔ qualquer permissão | ✔ (o documento; o resto com acesso justificado) | rules (`fedSees`) |
| Publicar / tirar do ar | ✖ | ✖ | ✖ | ✔ `admin`, só aprovada | ✔ com acesso justificado | rules (`published` booleano) |
| Pedidos de fora com a federação oculta (filiação, transferência, clube/arena, chancela, cupom, campanha, loja, agenda assinável) | ✖ | ✖ | ✖ | ✖ (a equipe segue estruturando) | ✖ | rules (`fedPublic`) + **Cloud Functions** (`publicada`) |
| Ler federação pendente/recusada/suspensa | ✖ | ◐ só quem pediu | — | ✔ `admin` | ✔ | rules |
| Pedir a abertura | ✖ | ✔ (`status: 'pending'`, selos falsos, sem campos travados) | — | — | — | rules (flag ligada) |
| Ler/gravar CNPJ, razão social (`private/data`) | ✖ | ◐ quem pediu, enquanto pendente | ✖ | ✔ `admin` | ✔ | rules |
| Aprovar, recusar, suspender, selos "Verificada"/"Oficial" | ✖ | ✖ | ✖ | ✖ | ✔ | **Cloud Function** `federationReview` |
| Editar página, Pix, marca, módulos | ✖ | ✖ | ✖ | ✔ `admin` (nunca `fedLocked()`; nome/sigla/endereço/nível revalidados); `finance` só o Pix (`payment`) | ✔ | rules |
| Ler a equipe da federação | ✖ | ◐ federação aprovada | ✔ | ✔ | ✔ | rules (a diretoria é pública na página; anônimo não lê) |
| Criar/editar plano | ✖ | ✖ | ✖ | ✔ `admin` ou `finance` (federação aprovada) | ✔ | rules; apagar só Plat |
| Montar cargos, mexer em admin master, passar a administração | ✖ | ✖ | ✖ | ✔ admin master | ✔ com acesso justificado | **Cloud Function** `federationStaff` |
| Nomear, prorrogar mandato, tirar da equipe | ✖ | ✖ | ✖ | ✔ admin master; `staff` só em cargo não master, nunca em si, só com permissões que tem | ✔ com acesso justificado | **Cloud Function** `federationStaff` (nunca fica sem admin master) |
| Sair da equipe | — | — | — | ✔ o próprio (o último admin master não) | — | **Cloud Function** `federationStaff` |
| Entrar na Central de uma federação (escrever, ler CPF/sanções) | ✖ | ✖ | ✖ | — | ◐ com motivo e prazo (1–8 h), registrado em `admin_access_logs` | **Cloud Function** `federationAdminAccess` + rules `fedPlat` |
| Ler documento do acervo publicado e público | ✔ | ✔ | ✔ | ✔ | ✔ | rules |
| Ler documento do acervo "só filiados" | ✖ | ✖ | ◐ filiação `active` | ✔ qualquer cargo | ◐ com acesso justificado | rules + `file` da **Cloud Function** `federationAcervo` (arquivo restrito ≤ 9 MB) |
| Ler documento do acervo "só a equipe" | ✖ | ✖ | ✖ | ✔ qualquer cargo | ◐ com acesso justificado | rules |
| Ler rascunho ou documento retirado do ar | ✖ | ✖ | ✖ | ✔ `docs`/`admin` | ◐ com acesso justificado | rules |
| Criar/editar/apagar rascunho, publicar, retificar, mudar visibilidade | ✖ | ✖ | ✖ | ✔ `docs`/`admin` | ◐ com acesso justificado | **Cloud Function** `federationAcervo` (rules `write: if false`; `doc_numbers` em `fedLocked()`) |
| Retirar documento do ar | ✖ | ✖ | ✖ | ✔ `admin` (motivo ≥ 20 letras) | ◐ com acesso justificado | **Cloud Function** `federationAcervo` |
| Enviar arquivo de rascunho do acervo | ✖ | ✔ só à própria pasta `federacao-acervo/{uid}/` (tipo e teto) | — | — | — | storage.rules (o servidor só aceita do próprio uid) |
| Seguir / deixar de seguir o acervo e o calendário (aviso de ato novo e de evento marcado, remarcado, adiado ou cancelado) | ✖ | ✔ só a si mesmo, com o acervo ou o calendário ligado | ✔ | ✔ | — | rules `federation_followers`; o aviso sai das **Cloud Functions** `federationAcervo` e `federationAgenda` só para quem pode ler o ato ou o evento |
| Ler evento do calendário público (e assinar a agenda .ics) | ✔ | ✔ | ✔ | ✔ | ✔ | rules `federation_events`; o ICS é da função `federationAgendaFeed` (só eventos públicos e torneios chancelados) |
| Ler evento do calendário "só filiados" | ✖ | ✖ | ◐ filiação `active` | ✔ qualquer cargo | ◐ com acesso justificado | rules |
| Ler evento do calendário "só a equipe" | ✖ | ✖ | ✖ | ✔ qualquer cargo | ◐ com acesso justificado | rules |
| Marcar, editar, adiar, cancelar evento; apagar o nunca divulgado | ✖ | ✖ | ✖ | ✔ `docs`/`admin` (todos); `competitions` só a agenda esportiva | ◐ com acesso justificado | **Cloud Function** `federationAgenda` (rules `write: if false`; motivo obrigatório ao mexer no que já foi divulgado) |
| Convocar reunião/assembleia (pauta, edital, quórum) e registrar ou corrigir o resultado | ✖ | ✖ | ✖ | ✔ `docs`/`admin` | ◐ com acesso justificado | **Cloud Function** `federationAgenda` (`convene`/`record`; motivo ao mudar o divulgado; a leitura segue a visibilidade do evento) |
| Ler orçamento e prestação de contas **publicados** (módulo `accounts`) | ✔ | ✔ | ✔ | ✔ | ✔ | rules `federation_budgets`/`federation_account_reports` (`pub == true` + `fedSees` + módulo ligado) |
| Ler orçamento em rascunho, lançamentos e prestação em andamento | ✖ | ✖ | ✖ | ✔ `finance`/`fiscal`/`admin` | ◐ com acesso justificado | rules (`fedAcc`); `federation_ledger` nunca é público |
| Montar o orçamento, lançar/estornar, importar o extrato bancário, preparar, enviar e publicar a prestação de contas | ✖ | ✖ | ✖ | ✔ `finance`/`admin` | ◐ com acesso justificado | **Cloud Function** `federationAccounts` (rules `write: if false`; período com prestação enviada fechado) |
| Dar o parecer do conselho fiscal | ✖ | ✖ | ✖ | ✔ `fiscal` (o `admin` também, registrado como dele) | ◐ com acesso justificado | **Cloud Function** `federationAccounts` (`opinion`) |
| Ler as cobranças da federação para conferir as contas | ✖ | ✖ | ◐ só as próprias | ✔ `finance`/`members`/`admin`/`fiscal`; `competitions` só a taxa de chancela (`origin: 'sanction'`) | ◐ com acesso justificado | rules `federation_charges` (`fedAny`) |
| Enviar anexo de lançamento ou demonstração | ✖ | ✔ só à própria pasta `federacao-contas/{uid}/` (PDF/imagem ≤ 9 MB) | — | — | — | storage.rules (o servidor só aceita do próprio uid) |
| Ler comentários de documento publicado ou evento | ◐ se o alvo é público | ◐ se pode ler o alvo | ◐ se pode ler o alvo | ✔ qualquer cargo (ocultos só `docs`/`admin`) | ◐ com acesso justificado | **Cloud Function** `federationCommentsList` (a mesma régua da leitura do alvo; sem uid); rules `federation_comments`: só o autor lê direto |
| Comentar, denunciar comentário de outra pessoa, apagar o próprio | ✖ | ◐ se pode ler o alvo e os comentários estão abertos | ◐ idem | ◐ idem | — | **Cloud Function** `federationComments` (texto 3–1.000, 30 s entre comentários, 10 por dia; 3 denúncias ocultam); rules `write: if false` |
| Responder oficialmente, ocultar com motivo, reabrir, abrir/fechar/consulta pública, ver a fila | ✖ | ✖ | ✖ | ✔ `docs`/`admin` | ◐ com acesso justificado | **Cloud Function** `federationComments` (auditado); `federation_comment_reports`: ninguém lê nem grava |
| Ver o quadro público de arbitragem e quem apita os eventos públicos (nome, nível, cidade, função — nunca valor, nota ou conflito) | ✔ | ✔ | ✔ | ✔ | ✔ | **Cloud Function** `federationRefereesPublic` (federação oculta: só equipe e filiado ativo) |
| Definir o nível oficial e decidir o pedido de revisão; registrar e acompanhar ocorrência do seguro (`docs/50` §30) | ✖ | ◐ pede revisão do próprio nível, muda as próprias autorizações e registra ocorrência sua (ou do dependente) | ◐ idem | ✔ `members`/`competitions` (apólice: `admin`) | ◐ com acesso justificado | **Cloud Function** `federationRegularity`; `docs_state`/`docs_block`/`official_level`/`consents` só o servidor grava |
| Ler ocorrência do seguro | ✖ | ◐ a própria, a do dependente e a que registrou | ◐ idem | ◐ `members`/`competitions`/`admin` (o financeiro, não) | ◐ com acesso justificado | rules `federation_incidents` (`write: if false`) |
| Ler o próprio cadastro no quadro e as próprias escalas (diária, avaliação, súmula) | ✖ | ◐ o árbitro, só os seus | ◐ idem | ✔ `courses`/`admin`: todos | ◐ com acesso justificado | rules `federation_referees`/`federation_assignments` (`write: if false`); as notas (`private/staff`) só a equipe |
| Responder à convocação (com conflito de interesse), enviar súmula, marcar disponibilidade e aparecer no quadro público | ✖ | ◐ o árbitro, nas próprias escalas | ◐ idem | — | — | **Cloud Function** `federationReferees` (`respond`/`report`/`self`; a equipe do evento só com `crew_visible`) |
| Quadro, escalar, substituir, cancelar, fechar evento, avaliar, pagar diárias, regras e níveis | ✖ | ✖ | ✖ | ✔ `courses`/`admin` | ◐ com acesso justificado | **Cloud Function** `federationReferees` (módulo `referees` ligado) |
| Avaliar a equipe de arbitragem do evento como avaliador escalado; pedir promoção de nível | ✖ | ◐ o avaliador confirmado, só a equipe do próprio evento (nunca a si mesmo nem sobrescrevendo outra pessoa); o árbitro ativo pede a própria promoção com os requisitos cumpridos | ◐ idem | ✔ `courses`/`admin` promovem ou recusam com motivo | ◐ com acesso justificado | **Cloud Function** `federationReferees` (`evaluate`, `evaluator_crew`, `promotion_request`, `promotion_decline`; `docs/50` §40) |
| Ler eleição publicada e as chapas aceitas | ◐ se a federação está publicada e o módulo ligado | ◐ idem | ✔ | ✔ | ◐ com acesso justificado | rules `federation_elections`/`federation_candidacies` (`public == true` + `fedSees`); rascunho só o admin e a comissão |
| Criar, publicar, cancelar eleição; nomear a comissão; levar os eleitos à governança | ✖ | ✖ | ✖ | ✔ `admin` | ◐ com acesso justificado | **Cloud Function** `federationElections` (rules `write: if false`) |
| Conduzir a eleição (aceitar/indeferir chapa, julgar impugnação, abrir/encerrar votação, presencial, apurar, publicar o resultado) | ✖ | ✖ | ◐ se está na comissão eleitoral | ◐ `admin` só sem comissão | ◐ com acesso justificado | **Cloud Function** `federationElections`; leitura do colégio e das chapas em análise pela regra `fedElRun` |
| Registrar/retirar chapa, apoiar, impugnar, defender, votar | ✖ | ✖ | ◐ filiação ativa (votar: estar no colégio congelado) | — | — | **Cloud Function** `federationElections`; o voto é secreto: `federation_ballots` sem uid, `read, write: if false` |
| Pedir filiação, renovar, cancelar | ✖ | ✔ (a própria) | ✔ | — | — | **Cloud Function** `federationMembership` |
| Aprovar/recusar/suspender/reintegrar filiação | ✖ | ✖ | ✖ | ✔ `members` | ✔ | **Cloud Function** `federationMembership` |
| Convidar pessoas da plataforma para filiar / cancelar convite | ✖ | ✖ | ✖ | ✔ `members` (federação publicada) | ✔ | **Cloud Function** `federationMembership` (`invite`, `invite_cancel`); rules `federation_invites` `write: if false` |
| Ver / recusar o próprio convite (aceitar = pedir no plano dele, sem aprovação) | ✖ | ✔ (o próprio) | ✔ | ✔ ver: `members`/`admin` | ✔ | rules `federation_invites` (leitura); **Cloud Function** `federationMembership` (`invite_decline`, `request`) |
| Ler filiação | ✖ | ✖ | ✔ a própria (também o `get` dela ainda inexistente, pelo id `{fed}_{uid}`) | ✔ `admin`/`members`/`finance`/`discipline` | ✔ | rules (**nunca pública**) |
| Mudar preferências da filiação (selo, diretório, foto) | ✖ | ✖ | ✔ só esses campos | ✖ | — | rules |
| Criar cobrança | ✖ | ✖ | ✖ | ✖ | ✖ | rules `if false`; só o servidor |
| Declarar "Já paguei" | ✖ | ✖ | ✔ (`open|declared` → `declared`, nota ≤ 300) | ✖ | — | rules |
| Confirmar/cancelar cobrança | ✖ | ✖ | ✖ | ✔ `finance` | ✔ | **Cloud Function** `federationChargeConfirm` |
| Ler índice de carteirinha | ✖ | ✖ | ✖ | ✖ | ✖ | rules `if false` |
| Verificar carteirinha pelo código | ✔ | ✔ | ✔ | ✔ | ✔ | **Cloud Function** `federationVerify` (sem login; devolve o mínimo) |
| Pedir filiação do clube/arena à federação (módulo `affiliations` ligado) | ✖ | ✔ admin do clube / gestor da arena (`fedOrgManager`), só `pending` | — | — | ✔ | rules (`fedModuleOn`) |
| Aprovar/recusar/suspender filiação de clube/arena | ✖ | ✖ | ✖ | ✔ `members` ou `admin` | ✔ | rules (só `status`/`review`; nunca num convite) |
| Convidar clube/arena a se filiar / cancelar o convite | ✖ | ✖ | ✖ | ✔ `members` ou `admin`, federação pública, só `invited` com `requested_by` nulo | ✔ | rules (`fedModuleOn`, `fedPublic`) |
| Aceitar ou recusar o convite da federação | ✖ | ✔ admin do clube / gestor da arena (`fedOrgManager`); aceitar = `approved` com `requested_by` = si | — | — | ✔ | rules (só `status`/`requested_by`/`accepted_at_ms`) |
| Retirar pedido / desfiliar clube ou arena | ✖ | ✔ quem gere a organização | — | ✔ `admin` | ✔ | rules |
| Ler filiação de clube/arena | ◐ só aprovada | ◐ aprovada; a própria organização | — | ✔ `admin`/`members` | ✔ | rules |
| Pedir a chancela do torneio (módulo `tournaments`) | ✖ | ✔ admin do torneio, só `pending` com `requested_by` = ele e **sem** as chaves que o servidor confere (diretor, prazo, taxa — `docs/50` §31.7) | — | — | ✔ | rules (`tournamentFederationOk`); a conferência é do gatilho `federationSanctionSync` |
| Checklist e relatório do torneio chancelado (`docs/50` §31.3) | ✖ | ◐ o diretor e quem organiza aquele torneio | — | ✔ `competitions`/`admin` (lê e grava; o financeiro não lê) | ◐ com acesso justificado | **Cloud Function** `federationCompetition`; rules `federation_tournament_reports` (`write: if false`) |
| Convidar para a final do circuito e cancelar convite com motivo | ✖ | ✖ | ✖ | ✔ `competitions`/`admin` | ◐ com acesso justificado | **Cloud Function** `federationCompetition` (`final_send`/`final_cancel`) |
| Ver e responder o próprio convite para a final | ✖ | ◐ o atleta convidado, dentro do prazo | ◐ idem | ✔ `competitions`/`admin` leem todos | ◐ com acesso justificado | rules `federation_final_invites` (`write: if false`); `final_answer` |
| Montar, publicar, fechar e cancelar a convocação da seleção; convocar a dedo; conferir documentos de viagem (`docs/50` §32.1) | ✖ | ✖ | ✖ | ✔ `competitions`/`admin` | ◐ com acesso justificado | **Cloud Function** `federationSelection`; rules `federation_callups`/`federation_callup_members` (`write: if false`) |
| Custos da delegação | ✖ | ✖ | ✖ | ✔ `competitions` edita; só `finance`/`admin` marcam o pagamento (que vira despesa) | ◐ com acesso justificado | **Cloud Function** `federationSelection` (`callup_costs`) |
| Ler o convite da convocação (documentos, uniforme, anotação) | ✖ | ◐ o próprio convocado | ◐ idem | ✔ `competitions`/`admin` — o financeiro **não** | ◐ com acesso justificado | rules `federation_callup_members` |
| Ver a convocação publicada e a delegação (só nome e categoria) | ✔ federação pública | ✔ | ✔ | ✔ (o rascunho: `competitions`/`finance`/`admin`) | ✔ | rules `federation_callups` (`fedSees`) |
| Abrir, decidir, publicar o resultado, julgar recurso e encerrar o edital (`docs/50` §32.2) | ✖ | ✖ | ✖ | ✔ `competitions`/`admin` | ◐ com acesso justificado | **Cloud Function** `federationSelection`; rules `federation_grants` (`write: if false`) |
| Inscrever-se, desistir e recorrer no edital | ✖ | ◐ conta logada (só filiado em dia se `members_only`), arquivos só da própria pasta | ✔ | — | — | **Cloud Function** `federationSelection` (`grant_apply`/`grant_withdraw`/`grant_appeal`) |
| Ler a inscrição no edital e abrir os arquivos | ✖ | ◐ a própria | ◐ idem | ✔ `competitions`/`finance`/`admin` leem; arquivos só `competitions`/`admin`, auditado | ◐ com acesso justificado | rules `federation_grant_applications`; arquivos por `federationDocument` (`applicationId`) |
| Registrar o pagamento do edital | ✖ | ✖ | ✖ | ✔ `finance`/`admin` | ◐ com acesso justificado | **Cloud Function** `federationSelection` (`grant_pay`) |
| Pedir a licença de professor e a renovação; esconder o selo (`docs/50` §33.1) | ✖ | ◐ o próprio professor | ✔ | — | — | **Cloud Function** `federationCoaching` (`license_apply`/`license_prefs`) |
| Níveis da licença; conceder, recusar, suspender, reativar e cassar | ✖ | ✖ | ✖ | ✔ `courses`/`admin` (nunca a própria licença; dispensa só de credencial/horas, com motivo) | ◐ com acesso justificado | **Cloud Function** `federationCoaching`; rules `federation_coach_licenses` (`write: if false`) |
| Ver o selo "Professor credenciado" | ✔ | ✔ | ✔ | ✔ | ✔ | rules `federation_coach_badges` (`read: if true`, `write: if false`) |
| Enviar a certidão de antecedentes (`docs/50` §33.2) | ✖ | ◐ a própria pessoa, arquivo da própria pasta | ✔ | — | — | **Cloud Function** `federationCoaching` (`sg_submit`) |
| Regras da proteção, abrir e conferir/revogar a certidão, ver quem trabalha com menores | ✖ | ◐ a pessoa lê o próprio registro | ◐ idem | ✔ só `safeguarding` (presidência, diretoria e admin master têm); arquivo auditado e apagado na decisão | ◐ com acesso justificado | **Cloud Function** `federationCoaching`; rules `federation_safeguarding` |
| Denunciar risco a criança ou adolescente (ouvidoria, `minor_protection`) | ✔ | ✔ (pode ser anônima) | ✔ | — | — | rules `federation_reports` (só com `safeguarding` ligado) |
| Ler e tratar a denúncia de proteção de menor (`docs/50` §33.3) | ✖ | ◐ o autor identificado acompanha | ◐ idem | ✔ só `safeguarding` — a disciplina e o `admin` sem a permissão **não** | ◐ com acesso justificado | rules `federation_reports` (`fedRepStaff`) |
| Cadastrar contrato de patrocínio, marcar parcela recebida/desfazer e contrapartida entregue (`docs/50` §34.4) | ✖ | ✖ | ✖ | ✔ `finance`/`admin` (cancelar e apagar só `admin`); `fiscal` só lê | ◐ com acesso justificado | **Cloud Function** `federationManagement`; rules `federation_sponsor_contracts` (`write: if false`) |
| Cadastrar bem, emprestar, registrar devolução e dar baixa no patrimônio (`docs/50` §34.5) | ✖ | ✖ | ✖ | ✔ `finance`/`competitions`/`admin` (apagar só `admin`); `fiscal` só lê | ◐ com acesso justificado | **Cloud Function** `federationManagement`; rules `federation_assets` (`write: if false`) |
| Ver a lista de equipamentos homologados e a antidopagem da federação (`docs/50` §36) | ✔ (até sem conta, federação pública e módulo ligado) | ✔ | ✔ | ✔ | ✔ | rules `federation_equipment` (`fedSees` + `fedModuleOn`); `federations.antidoping` é campo do documento público |
| Cadastrar equipamento, mudar a situação, apagar (`docs/50` §36.1) | ✖ | ✖ | ✖ | ✔ `competitions`/`admin` (apagar só `admin`) | ◐ com acesso justificado | **Cloud Function** `federationIntegrity`; rules `federation_equipment` (`write: if false`) |
| Anexar, editar e apagar certidões da federação; abrir o arquivo (`docs/50` §37.1) | ✖ | ✖ | ✖ | ✔ `finance`/`admin` (apagar só `admin`); `fiscal` lê e abre o arquivo | ◐ com acesso justificado | **Cloud Function** `federationInstitutional`; rules `federation_certificates` (`write: if false`, leitura `fedAcc`) |
| Projetos da Lei de Incentivo: criar, registrar e estornar aporte, mudar a etapa, apagar (`docs/50` §37.4) | ✖ | ✖ | ✖ | ✔ `finance`/`admin` (apagar só `admin`, sem aporte); `fiscal` lê | ◐ com acesso justificado | **Cloud Function** `federationInstitutional`; rules `federation_incentive_projects` (`write: if false`, leitura `fedAcc`) |
| Embaixador regional: candidatar-se, aceitar o código, mandar relatório, deixar o mandato; nomear, editar, recusar, encerrar (`docs/50` §38.1) | ✖ | ✔ o filiado em dia, para si | ✖ | ✔ `members`/`admin` decidem (ninguém se nomeia; proteção de menores conferida) | ◐ com acesso justificado | **Cloud Function** `federationDevelopment`; rules `federation_ambassadors` (`write: if false`); `federations.ambassadors_public` em `fedLocked()`; `ambassador_rules` o admin grava |
| Selo de clube certificado: pedir, renovar, retirar; conferir, conceder, recusar, cassar; abrir as evidências (`docs/50` §38.2) | ✖ | ✔ quem gere o clube/arena filiado pede e vê | ✖ | ✔ `members`/`admin` decidem (quem gere a organização não decide o próprio) | ◐ com acesso justificado | **Cloud Function** `federationDevelopment`; rules `federation_club_seals` (`write: if false`); `federation_affiliations.seal` só o servidor (o create recusa `seal`); `club_seal` o admin grava |
| Edital de sede: criar, publicar, estender, selecionar, dar nota, publicar o resultado, cancelar; candidatar-se e mandar proposta (`docs/50` §39.1) | ✖ (lê o edital publicado) | ✔ quem gere o clube/arena filiado manda carta e proposta e vê a própria candidatura | ✖ | ✔ `competitions`/`admin` (quem gere a organização não avalia a dela; notas só a equipe lê) | ◐ com acesso justificado | **Cloud Function** `federationHosting`; rules `federation_host_bids`, `federation_host_entries`, `federation_host_scores` (`write: if false`; leitura `fedSees`/`fedOrgManager`/`fedComp`) |
| Copa das Federações: criar, abrir, estender, encerrar, cancelar, aprovar ou devolver elenco (confederação); montar, mandar e retirar o elenco (estadual) (`docs/50` §39.2) | ✖ (lê a Copa e os elencos aprovados) | ✔ o atleta lê o elenco em que está | ✖ | ✔ `competitions`/`admin` da confederação decidem; da estadual montam o elenco com os próprios filiados em dia | ◐ com acesso justificado | **Cloud Function** `federationHosting`; rules `federation_cups`, `federation_cup_teams` (`write: if false`) |
| Pix com baixa automática: ligar/trocar/desligar o provedor (Mercado Pago, Asaas) com a chave da conta da federação; gerar o Pix da cobrança e conferir o pagamento (`docs/50` §43) | ✖ (o provedor avisa pelo webhook com token) | ◐ quem paga gera o Pix da PRÓPRIA cobrança e pede a conferência | ✖ | ✔ `finance`/`admin` configuram e conferem; ninguém lê a chave depois de salva (a tela vê só o fim) | ◐ com acesso justificado | **Cloud Function** `federationPayments` + `federationPixHook`; `federation_secrets` sem regra (nega tudo); `payment_gateway` em `fedLocked()`; `gateway` fora da lista do pagador em `federation_charges` |
| Carteirinha no Apple/Google Wallet: configurar as credenciais da plataforma; pedir os links "Adicionar à carteira" (`docs/50` §44) | ✖ (o iPhone fala com o serviço web pelo token do passe) | ◐ o titular ou o responsável pede os links da PRÓPRIA filiação | ✖ | ✖ | ✔ configura as credenciais; ninguém lê a chave depois de salva | **Cloud Function** `federationWallet` + `federationWalletHook`; `platform_secrets` e `federation_wallet_devices` sem leitura pelo navegador |
| Seguro: aceitar o termo na filiação e na renovação; pedir, retirar, emitir, recusar e cancelar o certificado de seguro para eventos (`docs/50` §42) | ✖ (confere o certificado pelo QR, sem conta) | ◐ o filiado aceita o próprio termo (ou o responsável); quem gere o clube/arena filiado pede e retira o certificado | ✖ | ✔ `members`/`admin` emitem, recusam e cancelam (nunca para a organização que também gerem; o financeiro não lê) | ◐ com acesso justificado | **Cloud Function** `federationInsurance` (+ `federationMembership`); rules `federation_insurance_certificates` (`write: if false`; leitura `fedOrgManager` ou `fedAny(['members','admin'])`); `insurance_term` fora da lista do filiado |
| Pickleball adaptado: categorias, pedido de classificação com laudo, decidir, cancelar, abrir o laudo, conferir os inscritos da modalidade adaptada (`docs/50` §41) | ✖ (vê só as categorias na página pública) | ◐ o filiado em dia pede, desiste e abre o próprio laudo; quem organiza o torneio chancelado confere a situação dos inscritos, sem o laudo | ✖ | ✔ `competitions`/`admin` (quem pediu não decide o próprio pedido; cada abertura de laudo é auditada) | ◐ com acesso justificado | **Cloud Function** `federationAdapted`; rules `federation_adapted_classifications` (`write: if false`; leitura do titular e `fedAny(['competitions','admin'])`), `adapted_classes` em `fedLocked()`; Storage `federacao-laudos/` fechado |
| Dossiê do art. 36 e relatório anual de proteção da infância (`docs/50` §37.2–37.3) | ✖ | ✖ | ✖ | ✔ quem vê a Conformidade / a Proteção de menores | ◐ com acesso justificado | zero banco (usa as leituras que a Central já faz) |
| Editar o texto e os links da antidopagem (`docs/50` §36.2) | ✖ | ✖ | ✖ | ✔ `admin` | ◐ com acesso justificado | rules `federations` (update do admin, campo fora de `fedLocked()`) |
| Relatório anual e planilhas (CSV) da federação (`docs/50` §34.2–34.3) | ✖ | ✖ | ✖ | ✔ relatório: `admin`; planilhas: quem já lê a lista (filiados, resultados, ranking, patrimônio) | ◐ com acesso justificado | zero banco: usa só as leituras da Central |
| Marcar/desmarcar uma federação como confederação (`docs/50` §35) | ✖ | ✖ | ✖ | ✖ | ✔ (não marca filiada a outra; não desmarca quem tem filiadas) | **Cloud Function** `federationReview`; rules: `confederation`/`national_body`/`national_config` em `fedLocked()` |
| Pedir, convidar, aceitar, recusar, sair e desligar o vínculo com a confederação; regras da rede (§35.1, §35.4) | ✖ | ✖ | ✖ | ✔ só `admin` de cada lado; qualquer cargo das duas lê o vínculo | ◐ com acesso justificado | **Cloud Function** `federationNational`; rules `federation_national_links` (`write: if false`) |
| Lançar, declarar, confirmar, reabrir e dispensar a anuidade da rede (§35.4) | ✖ | ✖ | ✖ | ✔ `finance`/`admin` (lançar, confirmar, reabrir e dispensar: a confederação; declarar: a estadual); `fiscal` só lê | ◐ com acesso justificado | **Cloud Function** `federationNational`; rules `federation_dues` (`write: if false`, leitura `fedAcc` dos dois lados) |
| Marcar/desfazer repasse da cobrança dividida ao clube e à confederação (`docs/50` §46) | ✖ | ✖ | ✖ | ✔ `finance`/`admin` da federação que recebeu (desfazer com motivo); `fiscal` e a confederação só leem | ◐ com acesso justificado | **Cloud Function** `federationSplit`; rules `federation_repasses` (`write: if false`, leitura `fedAcc` dos dois lados) |
| Trocar para plano mais caro pagando a diferença (`docs/50` §46) | ✖ | ✖ | ✔ o dono da filiação ativa | ✖ | ✖ | **Cloud Function** `federationMembership` (`upgrade`); a troca vale só na confirmação do pagamento |
| Homologar/negar transferência entre estaduais da mesma confederação (§35.3) | ✖ | ✖ | ◐ o dono lê | ✔ `members`/`admin` da confederação; silêncio no prazo = homologada | ◐ com acesso justificado | **Cloud Function** `federationTransfer` (`homologate`/`deny`); rules `federation_transfers` (`homologation_by`) |
| Aprovar/recusar/revogar chancela (categoria, origem "Realizado pela", só filiados) | ✖ | ✖ | ✖ | ✔ `competitions` (só `federation_sanction`) | ✔ | rules |
| Criar torneio DA federação (`/torneios/criar?federacao=`) | ✖ | ✖ | ✖ | ✔ `competitions`: cria como organizador, pede (`pending`) e aprova com `origin: 'federation'` — os dois caminhos acima, sem regra nova (`tests/rules/federationPr2.rules.test.js`) | ✔ | rules |
| Inscrever-se em torneio "só filiados" | ✖ | ◐ só com filiação `active` em dia — a do parceiro também (`fedMemberOk`) | ✔ | — | — | rules (`tournamentMembershipOk`); o admin do torneio inscreve qualquer pessoa |
| Enviar/reenviar resultado de categoria ao ranking oficial | ✖ | ✔ admin do torneio chancelado por essa federação (`fedSanctionedBy`), só com a temporada aberta e o `tier` IGUAL ao da chancela no envio e no reenvio (o organizador não troca a categoria por conta própria) | — | — | ✔ (temporada aberta) | rules (`fedSeasonOpen`) |
| Recusar/readmitir resultado | ✖ | ✖ | ✖ | ✔ `competitions`, só com a temporada aberta | ✔ (temporada aberta) | rules (`fedSeasonOpen`) |
| Mexer em resultado de temporada FECHADA (depois de 31/01 do ano seguinte) | ✖ | ✖ | ✖ | ✖ | ✖ | rules (`fedSeasonOpen`); servidor e tela também recusam |
| Ler resultados, lançamentos de pontos e ranking oficiais | ✔ | ✔ | ✔ | ✔ | ✔ | rules (públicos) |
| Gravar o ranking oficial e os lançamentos de pontos (`federation_points`) | ✖ | ✖ | ✖ | ✖ | ✖ | rules `if false`; gatilhos `federationRankingRecompute`/`federationRankingConfig` |
| Mudar a tabela de pontos (`ranking_config`) | ✖ | ✖ | ✖ | ✔ `competitions` (só essa chave) | ✔ | rules |
| Regras da federação (`rules`: CPF, prazos de transferência, declaração pelo filiado) — PR 3/6 | ✖ | ✖ | ✖ | ✔ `admin` | ✔ | rules |
| Ver os Indicadores da Central — PR 6 | ✖ | ✖ | ✖ | ✔ `members` (bloco de filiados) e/ou `finance` (bloco do dinheiro) | ✔ | tela (sem leitura nova: as mesmas de Filiados e Financeiro, já presas pela regra) |
| Emitir declaração de vínculo (filiação em dia, sem suspensão) — PR 6 | ✖ | ✖ | ✔ o dono/responsável, se `rules.member_declarations` (padrão sim) | ✔ `members` (sempre) | ✔ | tela (nada é gravado; a autenticidade é a verificação pública) |
| Ler CPF, nascimento e responsável (`federation_members/…/private/data`) | ✖ | ✖ | ✔ o dono (`fedMemberOwner`: o próprio ou o responsável do dependente) | ✔ `members`/`admin` (revelar o CPF: motivo + `audit_logs`) | ✔ | rules; **gravar só o servidor** (`write: if false`) |
| Filiar um dependente (menor de 12), pagar e mudar as preferências dele | ✖ | ✔ o responsável (`guardian_uid`) | — | — | — | **Cloud Function** `federationMembership`; rules (`fedMemberOwner`) |
| Enviar documento exigido pelo plano | ✖ | ✖ | ✔ o dono, só `pending`, caminho `federacao/{uid}/…` | ✖ | — | rules + `storage.rules` (só o dono lê a pasta) |
| Filiar o CLUBE ou a ARENA por plano, pagar, renovar, cancelar e enviar os documentos da entidade (Etapa 2) | ✖ | ◐ só quem gere a entidade (admin do clube ou gestor da arena); cobrança e avisos vão ao representante | ✔ os gestores da entidade leem a filiação e a lista de documentos (`fedMemberOwner` → `fedOrgManager`) | ✔ `members` aprova/suspende; `finance` confirma | ✔ | **Cloud Function** `federationMembership` (`request` com `org`, `represent`); rules |
| Passar a representar a entidade filiada (`represent`) | ✖ | ◐ outro gestor da mesma entidade; as cobranças em aberto passam a ele | — | — | — | **Cloud Function** `federationMembership` |
| Decidir ou apagar o espelho `federation_affiliations` de uma filiação por plano (`member_id`) | ✖ | ✖ | ✖ | ✖ (decide-se na filiação) | ✔ (admin da plataforma pelo `fedPlat`) | rules; só o servidor grava o espelho |
| Editar o catálogo de tipos de filiação (`platform_settings/federations`) | ✖ | ✖ | ✖ | ✖ | ✔ | rules de `platform_settings` (leitura pública) |
| Ver o arquivo enviado / aceitar ou recusar o documento | ✖ | ✖ | ✔ o dono (o arquivo) | ✔ `members`/`admin` (arquivo pela **Cloud Function** `federationDocument`; decisão só `status`/`review`) | ✔ | function + rules |
| Anexar o comprovante ao "Já paguei" (`declared_proof`) | ✖ | ✖ | ✔ o pagador, só arquivo da própria pasta `federacao/{uid}/…` (PDF/JPG/PNG/WebP); pode re-declarar para anexar | ✖ | — | rules (`federation_charges`) + `storage.rules` |
| Abrir o comprovante de uma cobrança | ✖ | ✖ | ✔ o pagador | ✔ `finance`/`members`/`fiscal`/`admin` (**Cloud Function** `federationDocument` com `chargeId`; registro `federation_charge_proof_view`) | ✔ | function |
| Ver cada parte da PASTA do filiado na Central (Etapa 3) | ✖ | ✖ | — | ◐ cada parte com a permissão da coleção: cobranças `finance`/`members`/`fiscal`; documentos e dados reservados `members`; cursos `courses` (inscrições também `finance`); arbitragem `courses` com o módulo; sanções `discipline`; pontos qualquer pessoa da equipe (são públicos). Sem a permissão a tela não consulta e diz quem vê | ✔ | rules das coleções (a pasta não tem regra própria) |
| Pedir/cancelar transferência de clube ou federação | ✖ | ✖ | ✔ o dono (filiação viva, carência) | — | — | **Cloud Function** `federationTransfer` |
| Aprovar/recusar transferência | ✖ | ✖ | ✖ | ✔ `members` da federação **atual** (a de destino só lê) | ✔ | **Cloud Function** `federationTransfer`; silêncio no prazo = liberada pela varredura |
| Importar filiados (lista com e-mail) | ✖ | ✖ | ✖ | ✔ `members` | ✔ | **Cloud Function** `federationImportMembers`; `federation_imports` só a equipe lê |
| Convidar quem estava na importação sem conta, ao criar a conta | ✖ | ✖ | ✖ | ✖ | ✖ | **Cloud Function** `federationImportInvite` (gatilho); aceitar é da própria pessoa (`federationMembership`) |
| Criar/editar curso (módulo `courses`) | ✖ | ✖ | ✖ | ✔ `courses` ou `admin` (`federation_id`/`enrolled_count` intocáveis) | ✔ | rules (`fedModuleOn`); apagar `admin` sem inscritos ou Plat |
| Ler curso | ◐ não `draft` | ◐ não `draft` | ◐ não `draft` | ✔ `courses`/`admin` | ✔ | rules |
| Inscrever-se / cancelar inscrição em curso | ✖ | ✔ (filiação ativa se o curso exige) | ✔ | — | — | **Cloud Function** `federationCourse` |
| Aprovar/reprovar inscrito; emitir credencial | ✖ | ✖ | ✖ | ✔ `courses` | ✔ | **Cloud Function** `federationCourse` |
| Ler credencial | ◐ só pública e válida | ◐ só pública e válida | ✔ a própria | ✔ `courses`/`admin` | ✔ | rules |
| Tornar a credencial pública/privada | ✖ | ✖ | ✔ só `public`/`public_photo` | ✖ | — | rules |
| Revogar credencial | ✖ | ✖ | ✖ | ✔ `courses`/`admin` (só `status`/`review`) | ✔ | rules |
| Aplicar sanção, decidir recurso, encerrar (módulo `discipline`) | ✖ | ✖ | ✖ | ✔ `discipline` | ✔ | **Cloud Function** `federationDiscipline` |
| Recorrer de sanção (uma vez) | ✖ | ✖ | ✔ o dono | — | — | **Cloud Function** `federationDiscipline` |
| Ler sanção | ✖ | ✖ | ✔ o dono | ✔ `discipline`/`admin` | ✔ | rules (**nunca pública**; o ranking não desconta) |
| Inscrever-se em torneio "só filiados" com suspensão em vigor | ✖ | ✖ (`discipline_until_ms` ≥ agora) | ✖ | — | — | rules (`tournamentMembershipOk`) |
| Abrir manifestação na ouvidoria (identificada ou anônima) | ✖ | ✔ (módulo `discipline` ligado; anônima ⇒ sem `reporter_uid`; nunca `notes`/`handled_by`) | ✔ | — | — | rules |
| Consultar manifestação pelo protocolo | ✖ | ◐ a própria, ou qualquer anônima (`get`) | ✔ | ✔ `discipline`/`admin` | ✔ | rules |
| Responder/encerrar manifestação | ✖ | ✖ | ✖ | ✔ `discipline`/`admin` (só `status`/`notes`/`handled_by`) | ✔ | rules; apagar só Plat |
| Ler notícia da federação (módulo `news`) — PR 4 | ◐ publicada e pública | ◐ publicada e pública; "só filiados" com filiação **ativa** | ✔ publicada | ✔ `comms`/`admin` (rascunhos, agendadas e a lista inteira) | ✔ | rules (`fedMemberActive`) |
| Escrever/apagar notícia (inclusive agendar: `scheduled` exige `publish_at_ms`) | ✖ | ✖ | ✖ | ✔ `comms`/`admin` (sem `notified_*`, sem trocar a federação) | ✔ | rules (`fedModuleOn`) |
| Publicar a notícia agendada na hora (e avisar, se pedido) | ✖ | ✖ | ✖ | ✖ | ✖ | **Cloud Function** `federationNewsPublish` (varredura a cada 15 min) |
| Avisar os filiados de uma notícia | ✖ | ✖ | ✖ | ✔ `comms`/`admin`, uma vez por notícia | ✔ | **Cloud Function** `federationNews` |
| Patrocinadores (`sponsors`, ≤ 12) e governança (`governance`) | ✖ | ✖ | ✖ | ✔ `admin` | ✔ | rules (`federations`) |
| Cupom/campanha com a federação como emissora (módulo `promos`) | ✖ | ✖ | ✖ | ✔ `comms`/`admin` (o emissor não muda) | ✔ | rules (`isPromoIssuer`); a campanha da federação não manda aviso |
| Abrir/operar a loja oficial no Mercado (`market_sellers/federation_{id}`, módulo `store`) | ✖ | ✖ | ✖ | ✔ `admin`/`finance` (nasce `active`, sem selo) | ✔ | rules (`isMarketOperator`); servidor `operatorUids` com a mesma resposta |
| Qualquer escrita com a flag desligada | ✖ | ✖ | ✖ | ✖ | ✖ (apagar documento/resultado também exige a flag) | rules (`fedOn()`) e funções (`flagLigada`, inclusive `federationReview` e `federationVerify`) |
| Qualquer permissão de equipe em qualquer federação | ✖ | ✖ | ✖ | — | ✔ (`fedHas` inclui o admin da plataforma; guarda `federacaoPermissoes.test.js`) | rules |

### 4.9 Plataforma (admin e dono)

| Ação | Plat | Dono | Onde |
|---|---|---|---|
| Ligar/desligar flags e configurar a plataforma | ✔ | ✔ | rules (`platform_settings`) |
| Painel `/admin/painel` | ✔ | ✔ | **só UI** (`AdminRoute`/`isPlatformAdmin`), e as regras de cada coleção |
| Escrever ranking/rating pelo cliente | ✖ | ✖ | rules (`allow write: if false`) |
| Escrever `season_rankings` pelo cliente | ✔ pelas regras (`isPlatformAdmin`) | ✔ | rules; na prática quem escreve é a função diária |
| Excluir contas / unificar históricos (**executar**) | ✖ | ✔ | **Cloud Function** (e-mail do dono verificado) |
| Suspender / bloquear / revelar contato | ✔ | ✔ | **Cloud Function** |
| Restaurar o próprio `role` (bootstrap) | — | ✔ | rules (`isOwner && isPlatformOwnerEmail`) e `FirebaseAuthContext` |
| Revogar o poder de outra conta | ✖ | ✔ | rules |
| Comunicações: chaves dos provedores, domínio, testes, registro de envios | ✔ via função | ✔ | **Cloud Function** `messagingAdmin`; `platform_secrets` é `read, write: if false` (nem o admin lê pelo cliente — o painel vê só "configurada") |
| Aviso em massa com e-mail/WhatsApp/SMS (`broadcast`) | ✔ | ✔ | rules (`broadcast` só de `isPlatformAdmin()`) + servidor confere de novo |
| Promover a admin | ✖ | ✖ | só console |

Quase toda coleção tem um ramo `|| isPlatformAdmin()` (383 ocorrências no
arquivo): o admin da plataforma é um superusuário **da leitura e da maioria das
escritas**, com as exceções acima (ranking, concessão de `role`, campos
privados de usuário, passos que exigem o dono).

## 5. Como a UI decide (e por que não basta)

| Pergunta da tela | Hook / função | Fonte | Garante? |
|---|---|---|---|
| Sou admin da plataforma? | `useAuth().isPlatformAdmin` (`role == 'platform_admin'` **e** não está em `viewAsUser`) | `users/{uid}` carregado no login | ✖ só tela; a regra relê o documento |
| Sou o dono? | `isOwnerEmail(user.email)` | constante em `src/core/config/owners.js` | ✖ só tela; a regra usa o e-mail do **token** |
| Administro este torneio? | `useIsTournamentAdmin(tournamentId)` | `getDoc(tournament_admins/{tid}_{uid})` | ✖; a regra aceita também criador e `Plat` |
| Sou do clube / admin do clube? | `useMyMembership(clubId)` | `club_members/{clubId}_{uid}` | ✖ |
| Quais arenas eu gerencio? | `useMyManagedArenas()` | `arena_managers` | ✖ (chave React Query compartilhada com o `V2Layout`) |
| O que posso fazer neste dia de jogo? | `useGameDayRoles(gameDay, participants)` → `ehCriador`, `ehGestorDaArena`, `ehAdminDoClube`, `ehAdmin`, `podeGerenciar`, `podeConfigurar`, `podeEditarGrupos` | `gameDayRoles.js` (puro) + os dois hooks acima | ✖ — "o que a TELA mostra; quem recusa de verdade é a regra" (cabeçalho do hook) |
| Sou professor? | `useCoach(uid)` → `isCoach` | `coaches/{uid}` | ✖ |
| A arena ligou este módulo? | `useArenaModules(arenaId)` | `platform_settings/arena_modules` + `arena_module_states` | ✖ — esconde, não bloqueia |
| A funcionalidade está ligada? | `useFeatureFlag(key)` (`core/lib/FeatureFlagsContext`) | `platform_settings/global` | ✖ (exceto Mercado, onde `marketOn()` está na regra) |
| Grupos do Play | `usePlayGroups` / `usePlayGroupsContext` | flag + dia | ✖ |

Princípios que seguem daí:

1. **Comando sem permissão não é renderizado** (nunca só desabilitado) — mas o
   teste de segurança é sempre a regra: `tests/rules/*.test.js` (emulador) prova
   cada recusa. Teste de consulta com uma conta que **não** é admin:
   `isPlatformAdmin()` na regra esconde consulta mal filtrada.
2. **Consulta de coleção restrita filtra pelo campo que a regra confere**
   (`arena_id` para a arena, `user_id` para o dono, `coach_id` para o professor).
3. **O nome do campo que a regra usa é contrato** (`user_id` na matrícula,
   `created_by` na inscrição, `arena_id`/`club_id` no dia de jogo).
4. **Dado pessoal em coleção de leitura ampla é proibido**; e-mail/telefone ficam
   em subcoleções `private` ou em `users`.

## 6. Mapa de provas (onde cada garantia é testada)

| Tema | Teste |
|---|---|
| Dia de jogo, papéis e escalada | `tests/rules/gameDayRoles.rules.emulator.mjs`, `gameDaySingles.rules.test.js`, `playGroups.rules.test.js`, `openMatchGameDay.rules.test.js`, `accessEscalation.rules.test.js` |
| Dia de jogo futuro (arena/clube) | `publicGameDaysAhead.rules.test.js`, `clubGameDaysAhead.rules.test.js`, `houseRanking.rules.test.js` |
| Torneio e inscrição | `registrations.rules.test.js`, `securitySweep.rules.test.js`, `misc.rules.test.js` |
| Arena (documentos `{arena}_{uid}`, fila, módulos) | `arenaUserDocs.rules.test.js`, `matchmaking.rules.test.js`, `arenaModules.rules.test.js`, `couponsReferrals.rules.test.js`, `campaignBanners.rules.test.js`, `couponArt.rules.test.js` |
| Usuário, poder e auditoria | `users.rules.test.js`, `auditlogs.rules.test.js`, `adminAccessLogs.rules.test.js` |
| Avisos por e-mail e celular (origem do aviso, segredos, celular confirmado) | `messaging.rules.test.js` |
| Contato no perfil público só com permissão | `athleteContacts.rules.test.js` |
| Professor | `coachLessons.rules.test.js`, `promoMarketing.rules.test.js` |
| Gamificação | `gamificationV2.rules.test.js`, `gamification.rules.emulator.mjs` |
| Treino | `training.rules.test.js` |
| Mercado | `marketplace.rules.test.js`, `marketplace.functions.test.js` |
| Storage | `storage.rules.test.js` |
| Rodar tudo | `npm run test:rules` (emulador de Firestore + Storage) |

## 7. O que não está coberto por regra (atenção ao evoluir)

- **Quem cria torneio / pool**: qualquer conta logada (as regras não consultam
  `can_create_pools`).
- **Admin de torneio promove/remove admin** sem distinguir o dono do torneio.
- **Play**: qualquer membro opera a fila mesmo em `owner_only` (§4.3).
- **Recepção da arena** sem conta de gestor: não existe papel intermediário.
- **Evento de clube legado**: qualquer membro edita participantes e jogos.
- **Módulo de arena desligado** e **flags de funcionalidade** controlam a tela,
  não a escrita (a exceção é o Mercado).
- **`viewAsUser`** não reduz poder no servidor.
