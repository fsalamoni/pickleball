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
| **Clube (novo)** | data de evento de clube do tipo dia de jogo | o MESMO `game_days`, com `club_id` |
| **Clube (legado)** | datas criadas ANTES da Onda AS | `club_events/{id}/{participants,games}` |

A partir da **Onda AS** existe uma casa só para o que é criado: toda data nova
de evento de clube nasce como um `game_days`. O legado **não foi migrado** e
não vai ser: a data anterior não tem `game_day_id` e segue servida pelo
organizador de sempre, lendo e escrevendo exatamente onde sempre leu e
escreveu. O legado encolhe sozinho, sem que ninguém precise converter nada.

---

## 2. O que a origem PODE mudar (e só isso)

Três coisas, e todas têm a ver com o local:

1. **Onde se grava.** Cada origem tem o seu serviço e a sua coleção.
2. **Quem organiza.** É sempre `useGameDayRoles`, que soma os caminhos da
   origem: criador, administrador nomeado, **gestor da ARENA** (dia com
   `arena_id`) e **administrador do CLUBE** (dia com `club_id`). Os donos são
   diferentes, os caminhos são diferentes — a pergunta é a mesma.
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

## 5. O clube vira módulo (Onda AS)

A Onda AR fechou o SORTEIO; sobrava o resto. O clube não tinha Play, nem
Americano aprimorado, nem telão, nem tutorial — e a tabela de honestidade da
versão anterior deste documento já apontava o caminho: *o evento de clube passar
a CRIAR um `game_days`*. É o que a Onda AS fez, **para o futuro**.

### 5.1. A pergunta que separa o novo do legado

Uma só, e é `isModularEventDate(date)`:

```
club_events/{eventId}/dates/{dateId}.game_day_id
  · preenchido → MÓDULO: o dia de jogo é `game_days/{game_day_id}`
  · ausente    → LEGADO: o organizador de sempre, intocado
```

`ClubGameDayTab` é quem faz a pergunta, e é o ÚNICO lugar que a faz. O painel
das datas não escolhe — ele delega. Duas decisões em dois lugares divergem, que
é o defeito que esta família de ondas vem corrigindo.

### 5.2. O que o clube ganhou de graça

Nada disso precisou de código novo: são as mesmas telas do atleta e da arena.

| Recurso | Antes | Agora |
|---|---|---|
| Americano, Mexicano, Rei da Quadra | ✅ | ✅ |
| **Play** (fila, pausa, entra/sai a qualquer hora) | ❌ | ✅ |
| **Americano aprimorado** (partida a partida com placar) | ❌ | ✅ |
| **Telão** (`/dia-de-jogo/:id/telao`) | ❌ | ✅ |
| **Tutorial em tela** do formato | ❌ | ✅ |
| **Administradores nomeados** | ❌ | ✅ |
| Ranking do dia, publicação no ranking/rating/DUPR | ✅ | ✅ |
| Dupla vinculada | ✅ | ✅ |

### 5.3. O que o LOCAL acrescenta

O clube tem duas coisas que as outras origens não têm, e elas continuam sendo
do clube:

- **RSVP por data.** A aba de jogos oferece inserir, com um toque, quem
  confirmou presença naquela data e ainda não está no dia de jogo. Sem esse
  atalho o módulo seria um retrocesso para quem usa RSVP.
- **Chat do evento e a lista de membros.** Ficam no evento, como sempre.

E o membro do clube **entra e sai sozinho** do dia de jogo — era o que a regra
do evento legado já permitia, e sem isso ele dependeria de alguém lembrar de
importá-lo.

### 5.4. Quem manda no quê

| Campo | Quem manda |
|---|---|
| título, data, hora, local, observação | a **DATA do evento** (a aba Participação); o dia de jogo é sincronizado |
| formato e número de quadras | a aba **Organização de jogos**, enquanto não houver partidas |
| existência (criar/arquivar) | a **DATA do evento** |

Por isso `/dia-de-jogo/:id` **não** oferece Editar nem Arquivar num dia de jogo
de clube — oferece "Gerir no clube". É a mesma decisão do dia de jogo de arena,
e pela mesma razão: arquivar por lá deixaria a data do clube apontando para um
dia de jogo que sumiu.

Trocar o formato **depois da primeira partida** não é edição, é perda: o Play
não guarda placar, o Mexicano deriva as rodadas da classificação e o Rei da
Quadra, do resultado anterior. A tela trava e **explica**, em vez de só
desabilitar.

### 5.5. Permissões

| Quem | Vê | Conduz as partidas | Configura |
|---|---|---|---|
| Quem agendou a data (criador) | ✅ | ✅ | ✅ |
| **Administrador do clube** | ✅ | ✅ | ✅ |
| Membro do clube inscrito no dia | ✅ | ✅ (o clube nasce com gestão ABERTA) | ❌ |
| Membro do clube não inscrito | ✅ | ❌ | ❌ |
| Quem não é do clube | ❌ | ❌ | ❌ |

O dia de jogo de clube nasce **`manage_mode: 'participants'`** de propósito: no
evento legado qualquer membro mexia em participantes e jogos, e nascer restrito
seria tirar da comunidade algo que ela já tinha.

No `firestore.rules`, isso é `isClubGameDayManagerOf` (administrador do clube) e
`isClubGameDayMemberOf` (leitura e auto-inscrição do membro) — as duas guardadas
por `'club_id' in gameDayData(gdId)`, então **sem `club_id` são sempre falsas** e
nenhum dia de jogo já existente muda de comportamento. 85 asserções no emulador
(`tests/rules/gameDayRoles.rules.emulator.mjs`) provam os dois lados: o que
passou a funcionar e o que continua barrado.

---

## 6. Banco de dados

**Zero coleção, zero índice, zero migração.** Só campos opcionais e duas
condições aditivas na regra.

| Onde | Campo | Quando existe |
|---|---|---|
| `club_events/{id}/participants` | `partner_id` | quando alguém vincula uma dupla (Onda AR) |
| `club_events/{id}/dates/{id}` | `game_day_id` | nas datas criadas a partir da Onda AS |
| `game_days/{id}` | `club_id`, `club_name`, `club_event_id` | nos dias de jogo de clube |

`club_events/{id}/{participants,dates}` não tem lista fechada de campos na
regra (`allow create, update, delete: if isEventClubMember(eventId)`), então os
dois primeiros não exigiram nada. Em `game_days`, as condições novas são
`isClubGameDayManagerOf` e `isClubGameDayMemberOf`, ambas guardadas por
`'club_id' in gameDayData(gdId)`.

**Nada já publicado é lido, reescrito ou movido.** Uma data sem `game_day_id`
continua sendo o legado, com os mesmos documentos nos mesmos lugares.

O espelho do ranking ganhou uma preferência: num dia de jogo de clube,
`club_id` é o clube DONO, não o clube inferido pelos atletas
(`buildGameDayMatch`). São duas razões — é o clube certo (a partida aconteceu
no evento dele) e é o campo que `isClubAdmin(club_id)` confere na regra de
`club_event_games`, sem o qual só quem agendou a data conseguiria publicar.

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
5. **Não monte o miolo do dia de jogo por fora.** A escolha da visão por
   formato e as ferramentas do dia (tutorial, telão) vivem em
   `GameDayModule` — `V2GameDays`, `V2ArenaGameDays` e `ClubGameDayTab` passam
   por ele. Há guarda de fonte. Foi assim que o clube ficou sem Play e sem
   telão por meses: quatro cópias do mesmo `? :`, e uma delas parou no tempo.
6. **Não converta o legado do clube.** Uma data sem `game_day_id` é um dia de
   jogo já jogado e, muitas vezes, já publicado no ranking. Migrar é
   reescrever histórico; deixar como está não custa nada, porque as duas casas
   convivem pela pergunta do §5.1.
7. **Não exponha `CreateGameDayDialog` num dia de jogo de clube.** Ele grava a
   `visibility` junto, e um dia de clube que vira público passa a ser legível
   (e auto-inscrevível) por qualquer conta da plataforma.

---

## 8. As CONFIGURAÇÕES também são do módulo (Onda BB)

### 8.1. O defeito: três origens, três configurações

A Onda AS unificou o **miolo** (a visão por formato, o tutorial, o telão) e
deixou de fora o que vem antes dele: **o que dá para mudar no dia de jogo**.
Isso continuou sendo montado origem a origem, e as três divergiram — a mesma
doença, um andar acima:

| | atleta | arena | clube |
|---|---|---|---|
| Formato | diálogo | diálogo | cartão próprio, à mão |
| Quadras | diálogo, **só** Play/Americano aprimorado | derivado das quadras reservadas | cartão próprio, **só** Play/Americano aprimorado |
| **Quem organiza as partidas** | diálogo | diálogo | **não existia** |

Consequências, medidas em tela:

- **O clube não tinha como dizer quem conduz o dia.** Ele nasce
  `manage_mode: 'participants'` de propósito (o evento legado era assim), e não
  havia nenhum lugar para fechar. Um clube que quisesse o sorteio só com a
  organização simplesmente não podia.
- **E não achava o número de quadras.** Uma data de clube nasce em
  **Americano**, que é formato de GRADE — e nos formatos de grade o campo não
  aparecia em configuração nenhuma, em nenhuma origem. O número existia só como
  um campo de texto **transitório dentro do diálogo de sorteio**: redigitado a
  cada sorteio, invisível no resto da tela e nunca gravado.

### 8.2. A correção: `GameDaySettingsCard`, dentro do módulo

As três configurações que **não dependem da origem** — formato, quadras e quem
organiza — viraram uma peça só, montada **dentro do `GameDayModule`**. Chegam ao
atleta, à arena e ao clube **por construção**, que é o antídoto desta família de
defeito: com tudo funcionando, a origem que ficou para trás é indistinguível da
que está completa.

Quem vê o cartão é decidido por `podeConfigurar`, que já soma criador, gestor da
arena e **administrador do clube** — então o admin que não agendou a data
configura o dia, como a regra do Firestore já permitia.

**Uma origem, uma diferença**: na **arena** as quadras são de leitura. Lá elas
não são um número solto — são as quadras e horários efetivamente **reservados no
calendário**, que fecham a grade para reserva. Um campo livre ali desencontraria
a contagem do dia das quadras realmente bloqueadas; o cartão mostra o número e
aponta onde se muda.

### 8.3. Um campo, um dono

Os diálogos de **criação** seguem oferecendo os três — é quando a escolha é
feita. O que eles deixaram de oferecer é a **edição**: dois lugares editando o
mesmo campo divergem, e foi exatamente assim que o clube ficou para trás. O
diálogo do atleta, na edição, diz onde eles foram parar.

> ⚠️ `src/core/guards/diaDeJogoUniforme.test.js` reprova quem montar
> `GameDaySettingsCard` por fora do módulo, ou reintroduzir formato/quadras na
> edição dos diálogos.

### 8.4. As quadras passaram a ser propriedade DO DIA

Nos formatos de grade, o diálogo de sorteio agora é **semeado** por
`gameDay.play_courts` — o número deixou de ser redigitado a cada sorteio.

> ⚠️ Só a partir de **dois**, e a razão não é estética: `play_courts` nasce
> valendo 1 em toda criação, inclusive nos formatos de grade, onde o campo nunca
> significou nada. Tratar esse `1` como escolha transformaria **todo Americano
> já existente** num dia de uma quadra só — o valor 1 é indistinguível de "não
> configurado". Quem quiser mesmo uma quadra digita, como sempre.

### 8.5. A porta estreita do legado

A data anterior à Onda AS continua no organizador de sempre, e **nada é
migrado** — as duas casas guardam em lugares diferentes, e converter uma data
que já tem gente ou jogo esconderia esses documentos da tela (seguiriam no
banco, intactos, mas invisíveis), sendo que um dia já publicado costuma estar no
ranking de quem jogou.

Só que existe um caso em que **não há nada para mover**: a data ainda **vazia**.
Aí converter não é migrar, é escolher a casa antes de entrar nela — e é o que
deixa uma data agendada meses atrás receber Play, Americano aprimorado, telão,
tutorial, administradores nomeados e as configurações do dia.

- A pergunta é domínio puro: `canUpgradeLegacyDate({ dateId, participants, games })`,
  com as contagens **recortadas por `date_id`** (um evento semanal tem dezenas de
  datas no mesmo `club_events/{id}`; olhar o evento inteiro reprovaria uma data
  vazia por causa de outra já jogada).
- Consulta **falhando** não conta como vazio: estado desconhecido não habilita a
  conversão.
- Quando não dá, a tela **diz o motivo** em vez de esconder o botão.
- A escrita tem porta própria (`setEventDateGameDay`) e **não** passa por
  `updateEventDate`: a lista fechada de campos daquela função é uma proteção —
  é ela que garante que a edição corriqueira de uma data nunca troque, de
  tabela, a casa que serve aquele dia de jogo.

### 8.6. Impacto no banco

**Zero.** Nenhuma coleção, campo, índice, regra, função ou migração. A conversão
grava um `game_days` novo e preenche o `game_day_id` que a data já tinha
previsto desde a Onda AS.

---

## 9. Um cartão só, que ABRE (Onda BC)

A §8 juntou as configurações **entre as origens**. Faltava juntá-las **dentro da
própria tela** — e ali o estado era pior do que parecia.

### 9.1. 🐞 "Quem organiza as partidas" existia em DOIS cartões

O cartão *Organização* (`GameDayAdminsCard`) já trazia o modo de gestão desde a
Onda T, montado por cada um dos três organizadores. Ao criar o cartão de
configurações, o mesmo campo passou a existir também lá — **dois escritores no
mesmo campo**, um por `useSetGameDayManageMode` e outro por um patch genérico.

> ⚠️ Correção de registro: a §8 afirma que o clube "não tinha nenhum lugar" para
> dizer quem conduz o dia. Não é exato — ele tinha, dentro de *Organização*. O
> que o clube realmente não tinha era o **número de quadras nos formatos de
> grade** e um lugar óbvio para as configurações. A duplicação do modo de gestão
> foi introduzida pela própria §8 e é corrigida aqui.

### 9.2. E a configuração estava repartida em três lugares

| o que | onde estava |
|---|---|
| formato, quadras | cartão *Configurações* |
| quem organiza, organizadores | cartão *Organização* |
| nome, data, local, visibilidade | atrás do botão **Editar** → modal |

Três lugares para responder uma pergunta só: *como este dia funciona?*

### 9.3. Agora: `GameDaySettingsCard`, três seções, montado pelo módulo

1. **Como se joga** — formato e quadras
2. **Quem organiza as partidas** — modo de gestão **e** a lista de organizadores
   (nomear/remover), que era o cartão *Organização*
3. **Nome, data e local** — editável **onde esta origem manda**: no atleta,
   aqui; na arena e no clube, uma linha dizendo onde (com link), porque lá quem
   manda são as quadras reservadas e a DATA do evento

`GameDayAdminsCard.jsx` **deixou de existir**, e com ele as três montagens
`{ehCriador && <GameDayAdminsCard …>}` — uma por organizador. O módulo monta o
cartão **uma vez**; quem pode vê-lo é decidido lá dentro (`podeConfigurar`).

**E é um cartão que ABRE, não um modal.** `CreateGameDayDialog` passou a só
CRIAR: o botão **Editar** saiu do cabeçalho do dia de jogo do atleta.
Configurar é parte de organizar o dia, não um desvio para outra tela. **Arquivar
continua no cabeçalho** — é o único ato que TIRA o dia da tela, e não é
configuração.

O cartão nasce **recolhido**, com um resumo que conta o essencial
(*"Americano aprimorado · 2 quadras · Aberto a todos"*): aberto por padrão, ele
empurraria participantes e quadras para baixo justamente de quem está
conduzindo o dia.

### 9.4. 🐞 O espaçamento mudava a cada cartão

`GameDayModule` devolvia um **fragmento**. Junte: o cartão de regras carregava
um `mb-4` próprio, o de configurações não tinha margem nenhuma e o organizador
trazia o seu `space-y` por dentro — então o intervalo entre cartões mudava a
cada cartão. E mudava por ORIGEM: o clube envolvia tudo num `space-y` dele por
fora (somando ao `mb-4`), o atleta não envolvia em nada (o cartão de
configurações encostava no organizador) e a arena deixava o painel de *Vagas*
colado no cartão seguinte.

Agora **o container é do módulo** e os cartões não se espaçam sozinhos — um
ritmo só, nas três telas. `gameDayModule.runtime.test.jsx` renderiza o módulo e
reprova qualquer filho que volte a carregar margem vertical própria; é
invisível a teste de comportamento, porque uma tela desalinhada renderiza igual
a uma alinhada.

### 9.5. A quadra diz o que FAZER

*"Faltam 4 jogador(es) disponível(is)"* está correto e não ajuda: num dia recém
criado, o que trava a quadra não é a quadra — é não haver ninguém. Quem
organiza lê aquilo como limite do sistema e vai procurar uma configuração que
não existe (foi assim que "a quantidade de quadras não libera as quadras"
chegou como relato). Com o dia vazio, a seção de quadras agora **diz o que
fazer**, e a mensagem por quadra distingue *"sem atletas no dia ainda"* de
*"ninguém livre agora"*.

### 9.6. Impacto no banco

**Zero.** Nenhuma coleção, campo, índice, regra, função ou migração.
