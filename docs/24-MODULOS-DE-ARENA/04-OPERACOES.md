# Onda 4 — Operações

> **Módulos**: `operations` · `operations_checklist` · `operations_maintenance`
> · `operations_inventory` · `operations_staff`
> **Chave-mestra**: flag `arena_modules` (default OFF).
> **Banco**: zero coleção nova, zero índice novo, zero regra nova.

---

## 1. O que existia e o que não funcionava

| # | Defeito | Sintoma para quem usa |
|---|---|---|
| 1 | **O checklist não era uma rotina** | Criado uma vez, marcado para sempre. O fechamento cumprido na segunda continuava "concluído" na terça — a arena não tinha como responder *hoje a abertura foi feita?*. |
| 2 | **A manutenção não fechava a quadra** | O catálogo prometia "pode fechar a quadra no calendário". A ordem não tinha quadra nem data: era um bilhete. Trocar o piso da quadra 2 na quinta não impedia ninguém de reservar a quadra 2 na quinta. |
| 3 | **O alerta de estoque não chegava a lugar nenhum** | 242 linhas de domínio testado (`stockStatus`, `expiryStatus`) e o aviso de "acabando" só existia dentro da aba Mercado, que ninguém abre de manhã. |
| 4 | **A equipe não existia** | `operations_staff` era `READY` no catálogo e não tinha **uma linha de código**. |
| 5 | **A tela não respondia à pergunta do dia** | Duas listas cruas, uma abaixo da outra. Quem abre este console está de pé, atrás do balcão. |

---

## 2. O checklist virou rotina do dia

### O modelo

Um checklist recorrente tem um **dia corrente** (`run_date`). Quando esse dia
não é hoje, os itens marcados pertencem a **outro dia** e não valem como
cumpridos — é isso que `checklistRunState(checklist, todayISO)` devolve, e é a
correção do defeito central.

A virada acontece ao **abrir a tela**: `useRollChecklistDay` limpa os itens,
grava `run_date` de hoje e empurra o dia anterior para `history`. Uma função
agendada faria a mesma coisa e custaria uma Cloud Function para um problema
que a tela resolve — quem abre esta página é alguém da arena, na hora em que
a rotina importa.

```
history: [ { date, progress, done, total }, … ]   ← teto de 30 entradas
```

**Por que 30 e não "para sempre".** Documento do Firestore tem teto de 1 MB, e
um registro que cresce sem limite um dia deixa de salvar — em silêncio, que é
o pior jeito de falhar.

**Por que o checklist novo não entra no histórico com 0%.** Um dia que nunca
existiu mentiria no relatório.

### O que isso dá à arena

O histórico transforma o checklist numa **prova**: "a abertura de sábado foi
cumprida, 8 de 8". Na tela ele aparece como os últimos sete dias, em faixas
coloridas.

### `recurring: false`

Nem toda lista é rotina. Desmarcado, o checklist vira uma lista de tarefas
comum: o que foi marcado fica marcado e não há "dia" nenhum.

---

## 3. A manutenção fecha a quadra — e devolve

### A ordem ganhou o que faltava

`court_id` (vazio = a arena inteira), `blocks_court`, `starts_on`/`ends_on`,
`start_time`/`end_time`. **Todos opcionais**: ordem sem `blocks_court` continua
sendo o bilhete de antes, que é o que se quer para "comprar lâmpadas".

Uma trava importante: marcar "fechar" **sem data é erro**, não bloqueio de data
nenhuma. Um bloqueio silencioso de zero dias pareceria ter funcionado.

### Cópia gravada, não bloco derivado — e por quê

O dia de jogo **deriva** os bloqueios da fonte (`gameDayBlocks`); a manutenção
**grava** a cópia. A diferença não é inconsistência:

| | Dia de jogo | Ordem de manutenção |
|---|---|---|
| Regra de leitura | `allow read: if true` | `allow read: if isArenaManager(...)` |
| O atleta consegue ler a fonte? | Sim | **Não, e não deve** |
| Como o calendário público sabe | Derivando da fonte | Da cópia em `arena_unavailabilities` |

"Trocar a fechadura do vestiário feminino" não é assunto de quem vai jogar. O
bloqueio público diz só **"Manutenção programada"** — há teste garantindo que
o título e a descrição da ordem nunca entram no payload.

### O ciclo completo

```
criar ordem  → syncMaintenanceBlocks  → grava N bloqueios (1 por dia)
editar       → syncMaintenanceBlocks  → apaga os antigos, grava os novos
concluir     → syncMaintenanceBlocks  → apaga tudo  (a quadra volta à venda)
cancelar     → idem
apagar       → apaga os bloqueios ANTES de apagar a ordem
```

`maintenanceBlockPayloads` devolve lista vazia para ordem que não está mais
aberta — é o que faz "concluir" devolver a quadra sem código extra.
**Manutenção que termina e deixa a quadra fechada é prejuízo silencioso.**

Só documentos marcados com `maintenance_id` são tocados: um bloqueio que a
arena criou à mão nunca é apagado por engano.

E a recusa da reserva ficou específica: *"A quadra está em manutenção neste
horário. É temporário — escolha outro horário ou outro dia."* Sem o "é
temporário" a pessoa desiste da arena, não do horário.

---

## 4. O estoque: o alerta viaja até onde a arena olha

O serviço, os hooks e a aba Mercado já existiam (Onda J). O que faltava era o
alerta **sair de lá**. Agora o console de operação calcula, a cada abertura:

```
quantidade = entradas − saídas          (não há campo `quantity` no produto)
estoque    = stockStatus(qtd, min_stock)     out | low | ok
validade   = expiryStatus(expiry_date)       expired | soon | ok
```

…e lista **só o que precisa de atenção**, ordenado do mais crítico. O estoque
completo continua no mercado da arena, com o link ao lado. Um painel que
mostra tudo não é um alerta.

---

## 5. A equipe

`arena_settings.staff` — campo opcional numa coleção que **só o gestor lê e
escreve**. Não é coleção nova de propósito: uma lista de até 40 pessoas cabe
folgada num documento, e coleção nova custaria regra nova.

**Sem e-mail, sem telefone, sem documento** (princípio 10). Para responder
"quem estava aqui quando aquilo aconteceu" bastam nome, função e turno. Quem
trabalha na arena e tem conta na plataforma pode ser vinculado por `user_id` —
e aí o contato já existe no lugar certo, que é o perfil da pessoa. Há teste
garantindo que campos de contato são descartados mesmo quando enviados.

`staffOnDuty(staff, 'HH:MM')` responde **por hora**, não por dia: é a pergunta
real.

---

## 6. A tela: o dia primeiro

O topo é **Hoje** — itens de rotina pendentes, ordens abertas (com destaque
para as urgentes), produtos acabando e quem está de plantão. Quando não há
nada, uma linha: *"Nada pendente. A rotina do dia está em dia."* Quatro
cartões verdes dizendo que está tudo bem ocupam a tela e não informam nada.

---

## 7. O que foi tocado

### Domínio (puro, testado — 52 asserções novas)

`domain/operations.js`: `checklistRunState`, `startChecklistDay`,
`checklistsPendingToday`, `CHECKLIST_HISTORY_MAX`, `CHECKLIST_KIND_META`,
`isMaintenanceOpen`, `maintenanceDates`, `maintenanceBlockPayloads`,
`MAINTENANCE_MAX_DAYS`, `MAINTENANCE_STATUS_META`,
`MAINTENANCE_PRIORITY_META`, `STAFF_ROLE(+_META)`, `STAFF_SHIFT(+_META)`,
`normalizeStaffMember`, `staffOnDuty`, `staffByRole`; e
`normalizeMaintenanceInput` com quadra e janela.

`domain/booking_conflict.js`: a recusa por manutenção tem texto próprio.

### Serviço

`services/operationsService.js`: `syncMaintenanceBlocks`, `updateMaintenance`,
`deleteMaintenance`, `rollChecklistDay`, `updateChecklist`, `deleteChecklist`,
`getArenaStaff`, `saveArenaStaff`; `createMaintenance` e
`updateMaintenanceStatus` passaram a sincronizar o calendário.

### Hooks

`useRollChecklistDay`, `useUpdateChecklist`, `useDeleteChecklist`,
`useUpdateMaintenance`, `useDeleteMaintenance`, `useArenaStaff`,
`useSaveArenaStaff`. Toda mutação de manutenção invalida **também** o
calendário (`arenaKeys.bloqueiosDaArena`, um prefixo novo — cada recorte de
datas é uma consulta diferente, e invalidar só o mês corrente deixaria os
outros mostrando a quadra à venda).

### Tela

`V2ArenaOperations.jsx`, reescrita (27 asserções de runtime).

### Banco

**Nada.** Campos opcionais: em `arena_checklists` (`recurring`, `run_date`,
`history`, `active`), em `arena_maintenance_orders` (`court_id`,
`blocks_court`, `starts_on`, `ends_on`, `start_time`, `end_time`), em
`arena_settings` (`staff`) e em `arena_unavailabilities` (`maintenance_id`,
que acompanha o `source: 'maintenance'`).

---

## 8. O que NÃO pode regredir

1. **Checkmark de ontem não vale hoje.** `checklistRunState` é a única fonte do
   estado do dia; ler `checklist.items` direto na tela reintroduz o defeito.
2. **A virada é idempotente.** `startChecklistDay` devolve `null` quando já é
   hoje; rodar duas vezes não pode apagar o que a equipe marcou.
3. **O histórico tem teto.** Sem ele o documento cresce até parar de salvar.
4. **Concluir ou cancelar a ordem devolve a quadra.** Sem isso a manutenção
   fecha o horário para sempre.
5. **O motivo da ordem nunca entra no bloqueio público.**
6. **Marcar "fechar" sem data é erro**, não bloqueio de nada.
7. **`syncMaintenanceBlocks` só toca documentos com `maintenance_id`.**
8. **A equipe não guarda contato.**
9. **Mutação de manutenção invalida o calendário inteiro da arena**, não só um
   recorte de datas.
