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
| **Equipe de federação** (flag `federations`) | documento `federation_staff/{fedId}_{uid}` com `role` (8 papéis → permissões `admin`, `members`, `finance`, …; o presidente nasce na aprovação da federação) | `fedRole(fedId)`, `fedHas(fedId, perm)` | `useMyFederationRole(fedId)` |
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
| Ler federação aprovada e planos | ✔ | ✔ | ✔ | ✔ | ✔ | rules |
| Ler federação pendente/recusada/suspensa | ✖ | ◐ só quem pediu | — | ✔ `admin` | ✔ | rules |
| Pedir a abertura | ✖ | ✔ (`status: 'pending'`, selos falsos, sem campos travados) | — | — | — | rules (flag ligada) |
| Ler/gravar CNPJ, razão social (`private/data`) | ✖ | ◐ quem pediu, enquanto pendente | ✖ | ✔ `admin` | ✔ | rules |
| Aprovar, recusar, suspender, selos "Verificada"/"Oficial" | ✖ | ✖ | ✖ | ✖ | ✔ | **Cloud Function** `federationReview` |
| Editar página, Pix, marca, módulos | ✖ | ✖ | ✖ | ✔ `admin` (nunca `fedLocked()`) | ✔ | rules |
| Criar/editar plano | ✖ | ✖ | ✖ | ✔ `admin` ou `finance` (federação aprovada) | ✔ | rules; apagar só Plat |
| Nomear/trocar papel na equipe | ✖ | ✖ | ✖ | ✔ `admin`; `president` só por presidente; o presidente não se rebaixa | ✔ | rules |
| Sair da equipe | — | — | — | ✔ o próprio (menos o presidente) | ✔ | rules |
| Pedir filiação, renovar, cancelar | ✖ | ✔ (a própria) | ✔ | — | — | **Cloud Function** `federationMembership` |
| Aprovar/recusar/suspender/reintegrar filiação | ✖ | ✖ | ✖ | ✔ `members` | ✔ | **Cloud Function** `federationMembership` |
| Ler filiação | ✖ | ✖ | ✔ a própria | ✔ `admin`/`members`/`finance` | ✔ | rules (**nunca pública**) |
| Mudar preferências da filiação (selo, diretório, foto) | ✖ | ✖ | ✔ só esses campos | ✖ | — | rules |
| Criar cobrança | ✖ | ✖ | ✖ | ✖ | ✖ | rules `if false`; só o servidor |
| Declarar "Já paguei" | ✖ | ✖ | ✔ (`open|declared` → `declared`, nota ≤ 300) | ✖ | — | rules |
| Confirmar/cancelar cobrança | ✖ | ✖ | ✖ | ✔ `finance` | ✔ | **Cloud Function** `federationChargeConfirm` |
| Ler índice de carteirinha | ✖ | ✖ | ✖ | ✖ | ✖ | rules `if false` |
| Verificar carteirinha pelo código | ✔ | ✔ | ✔ | ✔ | ✔ | **Cloud Function** `federationVerify` (sem login; devolve o mínimo) |
| Qualquer escrita com a flag desligada | ✖ | ✖ | ✖ | ✖ | ◐ | rules (`fedOn()`) e funções (`flagLigada`) |

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
