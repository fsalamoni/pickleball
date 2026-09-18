# Dia de jogo como MÓDULO — a mesma ferramenta em toda origem

> Leia junto: `docs/16-DIA-DE-JOGO-RODIZIO.md` (Play),
> `docs/17-DIA-DE-JOGO-AMERICANO-APRIMORADO.md` (americano_live),
> `docs/22-DIA-DE-JOGO-DA-ARENA.md` (arena) e `docs/18-RANKINGS.md` (o que
> conta para o ranking).

---

## 1. O problema, em uma frase

O dia de jogo nasce em **três lugares** e, por anos, cada lugar foi ganhando
recursos no seu ritmo — sem que nada na tela dissesse à pessoa que ela estava
usando uma versão mais pobre da mesma ferramenta.

| Origem | Onde é criado | Armazenamento |
|---|---|---|
| **Atleta** | `/dia-de-jogo` | `game_days/{id}` (+ `participants`, `games`) |
| **Arena** | `/arenas/:id/gerir/dia-de-jogo` | o MESMO `game_days`, com `arena_id` |
| **Clube** | evento de clube do tipo dia de jogo | `club_events/{id}/{participants,games}` |

O armazenamento é diferente por motivo histórico, e mudá-lo seria migração de
dados. **As regras não têm por que ser diferentes** — e é isso que este
documento trava.

---

## 2. O que a origem PODE mudar (e só isso)

Três coisas, e todas têm a ver com o local:

1. **Onde se grava.** Cada origem tem o seu serviço e a sua coleção.
2. **Quem organiza.** No atleta/arena é `useGameDayRoles` (criador,
   administrador nomeado, gestor da arena); no clube é ser membro/moderador do
   clube. São modelos de permissão diferentes porque os donos são diferentes.
3. **O que o local acrescenta.** Só a arena fecha quadra no calendário; só o
   clube tem chat de evento e RSVP por data. Isso é o local, não o dia de jogo.

**Todo o resto é o mesmo**, por construção — ver §3.

---

## 3. O sorteio: uma fonte só

`buildGameDayDraw` (`src/modules/games/services/gameDayDrawPlanner.js`) é a
única função que sorteia dia de jogo de grade. Recebe formato, participantes e
jogos existentes; devolve os jogos a gravar. Quem chama só sabe gravar.

Com isso, valem igual em TODA origem:

- os **três formatos** de grade (Americano, Mexicano, Rei da Quadra);
- o **nível unificado** 2.0–8.0 no equilíbrio (best-effort: falhou, sorteia sem);
- o **sorteio aditivo** (jogo com resultado nunca é descartado; rodada nova é
  numerada depois da última);
- as **duplas vinculadas** (§4);
- o `user_id` embutido em cada lado, que é o que faz o jogo contar no ranking
  mesmo que o participante saia do dia depois.

> 🐞 **A divergência que isto fechou.** O painel do clube e o do atleta tinham
> duas cópias do mesmo `handleDraw`. O do atleta ganhou Mexicano e Rei da
> Quadra; o do clube ficou só no Americano — e nada na tela avisava. Quem
> organizava pelo clube simplesmente não sabia que os outros formatos existiam.

`src/core/guards/diaDeJogoUniforme.test.js` lê o código-fonte e reprova quem
chamar `generateGameDayGames`, `generateMexicanoSchedule` ou
`kingOfCourtFirstRound` por fora da fonte única. É um guarda de FONTE porque o
defeito é invisível a teste de comportamento: cada tela, isolada, funciona.

---

## 4. Dupla vinculada: onde vale, onde não vale, e por quê

Vincular uma dupla é uma decisão do organizador sobre **com quem** aquelas duas
pessoas jogam. Ela **atravessa** os demais critérios do sorteio: as outras
regras decidem apenas entre as formações que respeitam o vínculo.

| Formato | Honra o vínculo? | Por quê |
|---|---|---|
| **Play** | ✅ | a dupla entra junta na fila (`assignPlayTeams`) |
| **Americano aprimorado** | ✅ | `fixedPairsWithin` → `pairFourBalanced` |
| **Americano (grade)** | ✅ | `fixedPairs` → `generateGameDayGames` |
| **Mexicano** | ❌ | as duplas saem da CLASSIFICAÇÃO de cada rodada |
| **Rei da Quadra** | ❌ | as duplas saem do RESULTADO da rodada anterior |

Nos dois últimos, prender uma dupla não seria respeitar o vínculo: seria deixar
de ser Mexicano. Por isso a tela **avisa** (`fixedPairsIgnored`) em vez de
ignorar calada — o silêncio é o que faz a pessoa achar que o sistema errou.

### Os três momentos em que o vínculo tem de valer

Este é o ponto que causou dois defeitos reais, um em cada motor:

| Momento | Quem decide (grade) | Quem decide (americano_live) |
|---|---|---|
| **Quem joga a rodada** | `recortarComDuplas` | a fila (`respectsFixedPairs`) |
| **Em que grupo de 4** | `ordenarComDuplas` | `respectsFixedPairs` |
| **De que LADO** | `bestPairingOfFour(forcedPairs)` | `pairFourBalanced(fixedPairs)` |

Garantir só o terceiro deixa a dupla em quadras diferentes. Garantir só os dois
primeiros põe os dois na mesma partida, **um contra o outro** — que foi
exatamente o defeito relatado no Americano aprimorado. Ao mexer em qualquer
motor de sorteio, confira os TRÊS.

O vínculo é **mútuo por definição**: `partner_id` gravado de um lado só é dado
pela metade, e prenderia alguém a quem não o escolheu. `mutualFixedPairs`
descarta esses. E a **parceria vinculada não é cobrada como repetição** — se
fosse, o custo do grupo cresceria a cada partida e a dupla acabaria evitada.

---

## 5. O que ainda é diferente, e o que isso custaria

Honestidade sobre o que NÃO foi unificado nesta onda:

| Recurso | Atleta | Arena | Clube | O que falta |
|---|---|---|---|---|
| Sorteio (formatos, nível, aditivo, duplas) | ✅ | ✅ | ✅ | — |
| Play / Americano aprimorado | ✅ | ✅ | ❌ | o clube só tem grade; trazer os dois exige a fila de participação sobre o armazenamento do clube |
| Telão (`/dia-de-jogo/:id/telao`) | ✅ | ✅ | ❌ | a rota lê `game_days`; o clube precisaria de um adaptador de origem |
| Tutorial em tela | ✅ | ✅ | ❌ | uma linha, mas o conteúdo fala em telas que o clube não tem |
| Administradores nomeados | ✅ | ✅ | n/a | o clube usa o papel do clube, de propósito |

O caminho natural para fechar o resto é o mesmo que a Onda AM usou no torneio
interno: **o evento de clube passar a CRIAR um `game_days`** em vez de ter o
seu próprio armazenamento. Aí não sobra nada para unificar — mas é migração de
dados de uma funcionalidade em uso, e não cabia numa onda cuja regra era não
mexer no banco.

---

## 6. Banco de dados

**Nada de estrutura.** Nenhuma coleção, índice, regra, função ou migração.

O único campo novo é `partner_id` em `club_events/{id}/participants` — campo
**opcional**, escrito só quando alguém vincula uma dupla, na mesma coleção e
sob a mesma regra que já existia (`allow create, update, delete: if
isEventClubMember(eventId)`, sem lista fechada de campos). Participante que
nunca vinculou dupla não tem o campo e se comporta exatamente como antes. É o
mesmo nome e o mesmo significado que o campo já tinha em `game_days`.

---

## 7. Ao mexer nesta área, cuidado com

1. **Não escreva um segundo `handleDraw`.** Acrescentar formato ou critério é
   dentro de `buildGameDayDraw`; assim vale nas três telas de uma vez. Há
   guarda de fonte.
2. **Não implemente dupla vinculada pela metade.** São TRÊS momentos (§4).
3. **Não ignore o vínculo em silêncio** num formato que não o honra — avise.
4. **Não unifique o armazenamento sem migração pensada.** As três origens
   gravam em lugares diferentes, e cada uma tem regra própria no
   `firestore.rules`.
5. **Não presuma que o clube tem o que o atleta tem.** Veja a tabela do §5
   antes de prometer um recurso na tela do clube.
