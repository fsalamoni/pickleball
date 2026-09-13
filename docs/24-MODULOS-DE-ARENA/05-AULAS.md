# Onda 5a — Aulas

> **Módulos**: `classes` · `classes_catalog` · `classes_packages` ·
> `classes_marketplace`
> **Chave-mestra**: flag `arena_modules` (default OFF).
> **Banco**: zero coleção nova, zero índice novo, zero regra nova.

---

## 1. 🐞 A matrícula NUNCA funcionou

O defeito mais caro desta onda, e o mais invisível.

A regra do Firestore de `arena_class_bookings`:

```
allow create: if isAuthed() && request.resource.data.user_id == request.auth.uid;
```

E o serviço gravava:

```js
await setDoc(doc(db, COL_BOOKINGS, bookingId), {
  athlete_id: user.uid,     // ← e nenhum `user_id`
  …
});
```

Campo ausente vale `null`. `null` nunca é igual a um uid. **Toda matrícula em
aula foi recusada pelo Firestore desde o dia em que a funcionalidade foi
escrita** — e o erro chegava à tela como um `permission-denied` genérico, que
ninguém liga a um nome de campo.

Agora o serviço grava **os dois**: `user_id` (o campo que a regra lê, e que
por isso é o campo de verdade) e `athlete_id` (mantido porque é o nome usado
no resto do módulo de arena).

> ⚠️ **A lição vale para o projeto inteiro.** O nome do campo que a regra usa é
> **contrato**. Escrever um sinônimo não é questão de estilo: é a operação
> sendo recusada em silêncio, para sempre.

---

## 2. 🐞 A aula não ocupava a quadra

O catálogo prometia que a aula "deixa de ser combinada por fora e passa a
**ocupar a grade**". A aula tinha data e horário e **nenhuma quadra**: dava
para marcar aula às 19h e vender a mesma quadra às 19h.

Agora `arena_classes` tem `court_id` (opcional) e a aula vira bloqueio
**derivado** (`classBlocks` / `mergeClassBlocks`).

**Derivado e não gravado** — ao contrário da ordem de manutenção — porque
`arena_classes` é legível por qualquer conta autenticada: a tela do atleta
monta a verdade a partir da FONTE, e uma cópia que falhe não deixa o
calendário oferecendo uma quadra ocupada (o defeito da Onda AF).

Três recortes deliberados:

- **Aula sem quadra não bloqueia nada.** A arena pode registrar uma aula que
  acontece fora dela; fechar uma quadra por isso seria inventar ocupação.
- **Aula cancelada ou já dada devolve a quadra.**
- **Nome de aluno nunca entra no bloqueio**, que é público. O `notes` diz
  "Aula com o Rafa" — o professor explica o horário fechado; a lista de
  matriculados não é assunto de quem passa pelo calendário.

E criar uma aula agora **confere a quadra antes**: marcar aula em cima de uma
reserva confirmada é criar um conflito que só aparece no dia, com duas pessoas
na quadra.

---

## 3. A cadeia de bloqueios virou uma função só

Este é o refactor que a onda exigiu, e ele protege as próximas.

A composição das fontes estava repetida em **cinco lugares** — o calendário do
atleta, o da arena, o diálogo do dia, o serviço de reserva e o de vagas
abertas. Cada fonte nova era mais uma linha de merge em cada um dos cinco, e a
que ficasse para trás **não dava erro**: dava a quadra vendida duas vezes.

```js
// domínio: sabe COMPOR
mergeArenaBlocks({ gravados, diasDeJogo, vagasAbertas, aulas })

// serviço: sabe BUSCAR
await arenaOccupancy(arenaId, { exceptSlotId, exceptClassId })
```

Fonte nova entra **ali** e chega às cinco telas de uma vez. Cada fonte é
opcional: quem não a carregou passa `undefined` e o resultado é o mesmo de
antes — é isso que permite acrescentar sem mexer em quem chama.

A ordem de manutenção é a exceção que confirma a regra: ela grava a cópia em
vez de derivar (a ordem é privada da arena), então chega já dentro de
`gravados`.

---

## 4. 🐞 O professor era um nome solto

`arena_coaches` guardava nome, bio e foto — **nenhum vínculo com a conta da
pessoa**. O catálogo prometia ao professor "sua agenda na arena, com os alunos
e o histórico no mesmo lugar", e ele não tinha como ver nada.

Agora há `user_id` (opcional — a arena pode cadastrar quem ainda não tem
conta), e com ele a tela muda de dono:

| Quem | O que vê primeiro |
|---|---|
| **Atleta** | as aulas em que dá para se matricular, e as suas |
| **Professor** | a agenda DELE nesta arena, com os alunos de cada aula |
| **Arena** | a grade inteira, os professores e quem pagou |

A tela decide pelo que a pessoa **é** — não por um seletor que ela tenha de
encontrar. Vínculo em outra arena não a torna professora desta.

Também entrou `partner`: professor de fora paga comissão, o da casa não.

---

## 5. A comissão saiu do código

O serviço gravava `commission_pct: 50`, **ignorando** a configuração
`marketplace.commission_pct` do módulo (padrão 20). A arena configurava uma
coisa e o sistema gravava outra, com 30 pontos percentuais de diferença.

Agora `classSplit(price, { commissionPct, partner })` é domínio puro, a
configuração chega pelo `useArenaModuleConfig`, e **professor da casa não paga
comissão** — cobrar comissão de si mesma faria o relatório da arena mentir.

A divisão aparece só para quem recebe (arena e professor). Para o aluno é
ruído.

---

## 6. O que mais faltava

| O quê | Antes | Agora |
|---|---|---|
| Editar aula | não existia | com trava: não dá para reduzir vagas abaixo de quem já se matriculou |
| Cancelar aula | não existia | cancela, **avisa os matriculados** e devolve a quadra |
| Marcar como dada | não existia | conta a sessão para o professor |
| Desmarcar matrícula | não existia | devolve a vaga (`enrolled − 1`) |
| Registrar pagamento | não existia | por matrícula, com o "Recebi" que a arena usa |
| Editar professor | não existia | inclusive reativar quem foi desativado |
| Aula duplicada | permitida | `bookingId = classId_uid` + conferência explícita |

Sobre **cancelar em vez de apagar** a aula: as matrículas continuam existindo,
e o aluno precisa saber por que a aula sumiu da agenda dele. Uma aula que
desaparece sem aviso é o tipo de coisa que faz a pessoa não marcar de novo.

Sobre a **ordem das escritas** no cancelamento da matrícula: a matrícula é
apagada **antes** do decremento. Se o decremento falhar, sobra uma vaga
ocupada por ninguém — corrigível pela arena. Na ordem inversa a mesma vaga
poderia ser vendida duas vezes.

---

## 7. O que foi tocado

**Domínio** (`domain/classes.js`, +31 asserções): `classBlocks`,
`mergeClassBlocks`, `isClassOpen`, `classSeatsLeft`, `classSplit`,
`classPackagePrice`, `classPackageLeft`, `CLASS_FORMAT_META`,
`COACH_LEVEL_META`, `DEFAULT_ARENA_COMMISSION_PCT`; `normalizeClassInput` com
`coach_id`, `court_id`, `status` e a conferência de duração;
`normalizeCoachInput` com `user_id` e `partner`.

**Domínio novo** (`domain/arenaBlocks.js`, +7 asserções): `mergeArenaBlocks`.

**Serviço** (`services/classesService.js`): `user_id` na matrícula,
`updateArenaClass`, `cancelArenaClass`, `deleteArenaClass`,
`completeArenaClass`, `listClassBookings`, `listMyClassBookings`,
`cancelClassBooking`, `setClassBookingPaid`, `updateArenaCoach`,
`listCoachProfiles`, `listCoachClasses`, e a conferência de quadra ocupada.

**Serviço novo** (`services/arenaOccupancy.js`): a leitura das quatro fontes,
antes duplicada em dois arquivos.

**Tela** (`V2ArenaClasses.jsx`, reescrita, +20 asserções de runtime).

**Banco**: nada. Campos opcionais em `arena_classes` (`coach_id`,
`coach_name`, `court_id`, `status`, `cancel_reason`), `arena_coaches`
(`user_id`, `partner`) e `arena_class_bookings` (`user_id`, `coach_id`,
`status`, `arena_amount`, `coach_amount`).

---

## 8. O que NÃO pode regredir

1. **A matrícula grava `user_id`.** É o campo que a regra confere; sem ele
   nada é gravado.
2. **A aula com quadra ocupa a quadra**, e cancelada/dada devolve.
3. **O bloqueio de aula não carrega nome de aluno.**
4. **Fonte nova de ocupação entra em `mergeArenaBlocks`**, não em cada tela.
5. **A comissão vem da configuração do módulo**, e professor da casa não paga.
6. **Desmarcar devolve a vaga.**
7. **Reduzir vagas abaixo dos matriculados é recusado.**
8. **O professor é reconhecido pelo `user_id`** — é o que lhe dá a agenda.
