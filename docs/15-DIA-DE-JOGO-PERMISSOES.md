# 15 — Dia de jogo: quem pode organizar

> **Leia antes de mexer em qualquer botão de dia de jogo.** Este documento
> explica quem pode fazer o quê, onde essa decisão mora e por que algumas
> atribuições NÃO são delegáveis.

Data: 2026-09-06 · Módulo: `src/modules/games/` · Impacto no banco: **aditivo**
(dois campos opcionais, nenhuma coleção, índice ou regra removida).

---

## 1. O problema

Até aqui, um dia de jogo tinha um único operador possível: o criador. Só ele
sorteava, criava a próxima partida, substituía quem faltou, marcava alguém como
indisponível, vinculava dupla e mexia na lista de participantes. Na prática isso
trava o dia de jogo real: o criador chega atrasado, sai para jogar, fica sem
bateria — e o dia inteiro para.

O ajuste dá ao criador uma escolha explícita e um jeito de dividir o trabalho.

---

## 2. O modelo: dois níveis, não um

A tentação era ter só "admin". Não serve, porque existem ações que o Firestore
**não deixa** delegar (§5). Então são dois níveis:

| Nível | Função | Quem tem | O que pode |
|---|---|---|---|
| **Configurar** | `canConfigureGameDay(gd, uid)` | **só o criador** | editar, arquivar, escolher o modo, nomear/remover admin, publicar no ranking da plataforma |
| **Organizar** | `canManageGameDay(gd, uid, { participants })` | depende do modo | sortear, criar/cancelar partida, substituir jogador, indisponível, vincular dupla, incluir/excluir participante |

E dois modos de organizar, escolhidos na criação e na edição do dia de jogo:

| `manage_mode` | Rótulo na tela | Quem organiza |
|---|---|---|
| `owner_only` | "Só eu e quem eu autorizar" | criador + `admin_uids` |
| `participants` | "Qualquer participante inscrito" | criador + `admin_uids` + qualquer inscrito |

**O default é `owner_only`, inclusive quando o campo não existe.** É o que
garante que nenhum dos dias de jogo já criados mude de comportamento: sem o
campo, `gameDayManageMode()` devolve `owner_only`. Valor desconhecido no banco
(erro, versão futura, edição manual) também cai em `owner_only` — na dúvida,
fecha.

---

## 3. Onde isso mora

```
src/modules/games/domain/gameDayRoles.js        ⭐ fonte única da verdade (puro)
src/modules/games/domain/gameDayRoles.test.js      25 testes
src/modules/games/services/gameDayService.js       addGameDayAdmin / removeGameDayAdmin / setGameDayManageMode
src/modules/games/hooks/useGameDays.js             os 3 hooks correspondentes
src/v2/components/games/GameDayAdminsCard.jsx      painel "Organização" (só o criador vê)
src/v2/components/games/CreateGameDayDialog.jsx    escolha do modo na criação/edição
firestore.rules                                    isGameDayAdminOf / gameDayOpenToParticipants / canManageGameDayOf
tests/rules/gameDayRoles.rules.emulator.mjs        24 asserções contra as regras REAIS
src/v2/components/games/gameDayPermissions.runtime.test.jsx  13 testes de "não renderiza"
```

Nenhum componente decide permissão por conta própria. Se você precisar de uma
verificação nova, ela nasce em `gameDayRoles.js` com teste, e o componente
apenas chama.

---

## 4. Esconder, não desabilitar

Instrução explícita do produto: *"os comandos/funcionalidades não devem ser
visíveis para usuários que não tiverem atribuição para ativar eles"*.

Então botão que o usuário não pode acionar **não é renderizado** — não é
renderizado cinza, não é renderizado com tooltip. Quem não organiza vê a tela de
participante, que é uma tela completa por si só (ver os jogos, a ordem, o
ranking do dia), não uma tela mutilada.

Isso é verificado por teste de runtime, renderizando de verdade com quatro
perfis (criador, admin nomeado, participante em modo aberto, participante em
modo fechado) e afirmando a AUSÊNCIA dos comandos.

---

## 5. O que NÃO é delegável, e por quê

Publicar os resultados no ranking da plataforma escreve em `club_event_games`, e
a regra dessa coleção exige `isGameDayOwnerOf(event_id)` — o **dono**, não um
admin. Poderíamos afrouxar aquela regra; deliberadamente não afrouxamos, porque
ela protege o rating de todo mundo, não só daquele dia de jogo.

Consequência prática: o card de ranking continua aparecendo só para o criador.
Um admin não vê um botão que falharia no servidor.

Pelo mesmo raciocínio ficam com o criador: editar, arquivar, mudar o modo e
nomear/remover admin — do contrário um admin poderia se tornar dono.

---

## 6. As regras do Firestore

Aditivas: três helpers novos e ramos `||` novos. Nada existente foi reescrito ou
removido.

```
function isGameDayAdminOf(gdId)        // created_by == uid  OU  uid in admin_uids
function gameDayOpenToParticipants(gdId) // manage_mode == 'participants'
function canManageGameDayOf(gdId)      // admin  OU  (modo aberto E uid in member_uids)
```

O ponto delicado é o **update do próprio documento** `game_days/{id}`. Se ele
fosse liberado inteiro para quem organiza, um admin escreveria `created_by`,
`admin_uids` ou `manage_mode` — escalada de privilégio. Por isso o ramo novo é
limitado por campo:

```
|| (
  canManageGameDayOf(gdId)
  && request.resource.data.diff(resource.data).affectedKeys()
      .hasOnly(['member_uids', 'invited_uids', 'updated_at'])
)
```

`participants` e `games` (as subcoleções) ganharam `|| canManageGameDayOf(gdId)`
em create/update/delete.

### Prova

`tests/rules/gameDayRoles.rules.emulator.mjs` roda contra o emulador com as
regras reais:

```bash
npx firebase-tools emulators:exec --only firestore --project demo-picklerush \
  "node tests/rules/gameDayRoles.rules.emulator.mjs"
```

24/24 asserções. Cobre o caminho feliz (admin organiza; participante organiza em
modo aberto; estranho não organiza; dia de jogo antigo sem os campos continua
fechado) **e** as tentativas de escalada: admin tentando se auto-promover, mudar
o modo, virar dono, renomear, arquivar e publicar no ranking — todas negadas.

---

## 7. Impacto no banco

| Item | Mudança |
|---|---|
| Coleções | nenhuma nova |
| Índices | nenhum novo |
| Campos | `manage_mode` e `admin_uids` em `game_days`, **ambos opcionais** |
| Migração | **nenhuma** — a ausência dos campos já significa o comportamento antigo |
| Documentos existentes | zero escritas; ninguém precisa ser tocado |

Nomear admin escreve `admin_uids` (arrayUnion) e `member_uids` (arrayUnion) no
documento do dia de jogo, dispara notificação para o nomeado e grava
`audit_logs`. Remover tira só de `admin_uids` — quem foi nomeado continua
inscrito, porque tirar a atribuição não é o mesmo que expulsar do jogo.

---

## 8. Como testar na mão

1. Crie um dia de jogo. Em "Quem pode organizar as partidas", deixe
   "Só eu e quem eu autorizar".
2. Abra com outra conta inscrita: nenhum botão de sortear/criar/substituir.
3. Volte ao criador, card **Organização** → nomeie a outra conta.
4. A outra conta agora organiza — mas continua sem Editar, Arquivar,
   Organização e Ranking.
5. Troque o modo para "Qualquer participante inscrito": uma terceira conta
   inscrita passa a organizar sem ser nomeada.
6. Um dia de jogo antigo (criado antes desta versão) deve continuar fechado.
