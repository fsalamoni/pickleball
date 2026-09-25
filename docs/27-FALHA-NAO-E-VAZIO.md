# 27 — Falha não é lista vazia

> **Onda AV (2026-09-20).** Uma classe de defeito que atravessa a plataforma
> inteira, corrigida na arena em 2026-09-13 (Onda AE) e que nunca tinha chegado
> ao dia de jogo nem ao torneio.

---

## 1. O defeito, em duas linhas

O padrão do projeto é:

```js
const { data: gameDays = [] } = useMyGameDays();
```

Quando a consulta **falha**, `data` vem indefinido, cai no `[]`, e a tela
conclui que **não existe nada**. E aí ela **afirma** isso.

Lista vazia quase nunca é neutra: ela tem um significado próprio na tela, e
esse significado é uma frase que a plataforma diz ao usuário com toda a
confiança do mundo.

---

## 2. O que a plataforma estava dizendo

| Tela | O que dizia numa queda de rede | O que o usuário conclui |
|---|---|---|
| Meus dias de jogo | *"Nenhum dia de jogo ainda"* + botão **Criar** | "sumiu tudo" → cria um duplicado |
| Um dia de jogo | *"Dia de jogo não encontrado. Ele pode ter sido removido ou você não tem acesso."* | "me tiraram do grupo", na beira da quadra |
| Dia de jogo da arena | *"Ele pode ter sido arquivado, ou pertence a outra arena."* | procura um problema que não existe |
| Torneio | *"Torneio não encontrado. Verifique o link."* | confere um link que está certo |
| Modalidade | *"Modalidade não encontrada"* | "tiraram a minha categoria" |

Medido na auditoria: **28 das 30 telas** de dia de jogo e torneio não
distinguiam falha de vazio.

Quem lê uma afirmação dessas **não tenta de novo**. Acredita.

---

## 3. 🐞 O caso grave: o sorteio apagando o que não viu

Este não é cosmético.

`persistMatches` **apaga todos os jogos da fase** antes de gravar os novos — é
o que faz "re-sortear" funcionar, e a tela avisa disso. Só que o aviso era
decidido por `matches.length`:

```js
{matches.length > 0
  ? 'Os jogos atuais desta fase serão apagados e novos serão gerados.'
  : 'Serão gerados os jogos desta fase a partir das inscrições confirmadas.'}
```

Então, com `useMatches` **falhando**:

1. `matches = []`;
2. o botão vira **"Sortear"** em vez de "Re-sortear tudo";
3. o cabeçalho diz **"Nenhum jogo gerado ainda"**;
4. o diálogo diz que vai **gerar** — e **não menciona que apaga nada**;
5. o organizador confirma;
6. `persistMatches` **apaga os jogos já disputados** e grava outros.

Um resultado de torneio destruído por uma queda de rede, sem ninguém ter como
perceber.

### Como ficou

**Na tela** — comando sobre estado desconhecido **não é renderizado**. É a
mesma regra do dia de jogo (`docs/15`): comando sem atribuição não aparece,
nunca só desabilitado. No lugar das ações, o aviso da falha com botão.

**No serviço** — segunda tranca, `domain/drawSafety.js`:

```js
canDiscardStageMatches(matches, { acknowledged })
```

Só é **reconhecimento** quando a tela realmente **viu** os jogos
(`replacesKnownMatches: matches.length > 0`). Sem isso, o sorteio é **recusado**
se a fase tiver jogo **com resultado**, com o número na mensagem.

⚠️ **Só o jogo com RESULTADO é protegido.** Re-sortear uma fase que ainda não
começou não perde nada, e exigir confirmação ali treinaria a pessoa a clicar em
"sim" sem ler — o que faria a confirmação que IMPORTA passar despercebida.

> **Achado não alterado**: `advanceToNextPhase` regrava a fase seguinte, e
> avançar duas vezes já descartava o que estivesse lançado nela. Esse
> comportamento é anterior a esta onda e foi **preservado bit a bit**
> (`replacesKnownMatches: true` na chamada interna). Mudá-lo é decisão à parte.

---

## 4. A peça: `V2ErrorState`

O bloco de falha estava escrito **à mão em sete lugares** e não havia
primitivo. Agora há um, em `src/v2/ui/primitives.jsx`, com três regras:

1. **Nunca diz que o dado não existe.** Diz que não conseguiu carregar.
2. **Sempre oferece o caminho de volta** (`onRetry`) — a segunda tentativa
   quase sempre funciona.
3. **Não despeja o erro técnico** — `detail` é opcional e sai pequeno.

`inline` serve para uma **seção** que falhou dentro de uma tela que carregou:
ali um bloco de tela inteira roubaria a página de quem só perdeu um pedaço.

E `src/core/lib/queryState.js` responde à pergunta que as telas realmente
fazem — **posso afirmar que está vazio?** —, que só é verdade quando a consulta
terminou **e** não falhou.

---

## 4b. A classe fechada (Onda AW)

A primeira passada cobriu as sete telas onde a mentira era mais cara. A
segunda fechou o resto do dia de jogo e do torneio:

| Tela | O que afirmava numa falha |
|---|---|
| Resultados do torneio | *"Nenhum jogo gerado ainda"* — na aba de resultados, com os jogos acontecendo |
| Operação do torneio | *"Nenhuma modalidade cadastrada ainda"* |
| Convites abertos | *"Nenhum convite aberto"* |
| Dia de jogo (os três organizadores) | *"Nenhum participante ainda"* — com doze pessoas na quadra |

### 🐞 E o dia de jogo tinha a própria versão do sorteio cego

No torneio, sortear sobre estado desconhecido **apagava** jogos disputados. No
dia de jogo o estrago é outro, e mais silencioso: o **`orderBase`** do sorteio
sai dos jogos **já carregados**. Com a consulta falhando ele vale `0`, e a
rodada nova nasce com a **mesma numeração** das que já aconteceram — duas
"rodada 1" no mesmo dia, sem erro nenhum na tela.

A regra aplicada é a mesma: **comando sobre estado desconhecido não é
renderizado**. Nos três organizadores, `canManage` passou a depender de
`!falhouEstado`, e a seção de jogos esconde as ações quando a lista não chegou.

---

## 5. Ao mexer nesta área, cuidado com

1. **Não escreva `const { data = [] } = useX()` e conclua algo do vazio.** Se a
   tela vai AFIRMAR ("nenhum", "não encontrado", "ninguém inscrito"), ela
   precisa de `isError`.
2. **Não ofereça comando sobre estado desconhecido.** Principalmente comando
   que apaga.
3. **Não afirme ocupação/estado enquanto carrega.** Mês sem reserva carregada
   parece mês inteiro livre (lição da Onda AE).
4. **Não escreva o bloco de falha à mão.** Use `V2ErrorState`.
5. **Não tire o botão de tentar de novo.** Aviso sem saída é pior que aviso
   nenhum: a pessoa fecha o aplicativo.

`src/core/guards/falhaNaoEVazio.test.js` lê o código-fonte e reprova quem
regredir — o defeito é invisível a teste de comportamento, porque com a
consulta funcionando **cada tela está correta**.

---

## 6. De quebra: o dia de jogo diz o que ele é

O cabeçalho do dia de jogo mostrava título, origem, data e observações. **Nem o
formato** — e é o formato que decide se há placar, se há ranking do dia, se o
resultado pode ir para o ranking da plataforma e se dá para vincular uma dupla.

Pior: a **lista** de dias de jogo da arena já mostrava o formato num selo, e a
tela do **dia** não. A lista dizia mais que o detalhe.

`describeGameDayRules` (`modules/games/domain/gameDayRules.js`) traduz o dia nas
linhas que a tela mostra, e `GameDayRulesCard` fica dentro do **`GameDayModule`**
— assim as três origens (atleta, arena, clube) recebem o resumo **por
construção**, sem ninguém precisar lembrar de montá-lo em cada tela. Que é
exatamente como o clube ficou meses sem Play e sem telão.

Fechado, é uma linha. Aberto, cada linha explica o porquê — quem já conhece o
formato não precisa ler nada, e quem não conhece precisa de mais que um rótulo.

Ganhou também um predicado que só existia implícito no motor de sorteio:
`formatHonorsFixedPairs(format)` — **Mexicano e Rei da Quadra não honram dupla
vinculada**, e isso não é omissão: neles as duplas saem da classificação da
rodada, que é o que define os dois formatos.

---

## 7. Código morto removido

Nove componentes V1 de clube, **sem nenhum caminho a partir de `main.jsx`** e
fora do bundle: `ClubAdminTab`, `ClubFeedTab`, `ClubForumsTab`,
`ClubMembersTab`, `EventChat`, `EventDatesPanel`, `EventParticipantsPanel`,
`ForumPoll`, `ForumThreadView`.

Entre eles, `EventDatesPanel.jsx` — **gêmeo obsoleto** do `V2EventDatesPanel`
que a Onda AS modificou, e que **não conhece `game_day_id`**. Cópia morta de
tela viva é armadilha de divergência: é o caso do `V2GameDayOrganizer` (Onda
AS) e do `TournamentDrawTab` (Onda AU).

> Sobram três órfãos conhecidos, deixados de propósito:
> `tournament/services/courtService.js` e `clubs/hooks/useClubRankingAdmin.js`
> (descritos/ligados à arquitetura documentada) e `clubs/domain/clubRanking.js`
> (tem teste próprio e espelha `functions/clubRanking.js`).

---

## 8. As telas PÚBLICAS do torneio (Onda AZ)

As Ondas AV e AW fecharam a classe **dentro do aplicativo**. Ficaram de fora
quatro telas que nem sequer estão na árvore do V2 — são páginas V1 roteadas
direto em `src/App.jsx` — e são justamente as que chegam a **quem não tem
conta**:

| Tela | Rota | O que dizia quando a consulta falhava |
|---|---|---|
| Página pública do torneio | `/p/:tournamentId` | *"Torneio não encontrado. **Verifique o link recebido**."* |
| Versão para impressão | `/torneios/:id/imprimir` | *"Carregando…"* — **para sempre** |
| Telão do torneio | `/torneios/:id/telao` | quadro vazio, com "Atualiza automaticamente" pulsando |
| Página pública do clube | `/c/:clubId` | *"Clube não disponível publicamente. Entre na plataforma."* |

### 8.1 Por que estas são as piores da classe

Nas telas de dentro, quem lê a mentira tem conta, contexto e um caminho: fecha,
abre de novo, fala com o organizador. Aqui não.

**`/p/:id` culpa o link.** Quem recebeu o link não tem como saber que o
problema foi a rede — a frase acusa exatamente o que essa pessoa não pode
conferir. O desfecho previsível é ela cobrar do organizador um link que está
certo, e o organizador reenviar o mesmo link.

**`/c/:clubId` é pior ainda**: transformava uma falha de rede numa **afirmação
sobre a escolha do clube** ("não disponível publicamente") e oferecia, como
saída, **criar uma conta** — que não resolveria nada.

**A folha impressa é a mais cara de todas, porque o papel sobrevive à tela.**
Uma modalidade cuja consulta falhou simplesmente não sai na folha, e a folha vai
para a mesa da organização **parecendo completa**. Ninguém desconfia de uma
ausência. Por isso este é o único aviso da plataforma que **precisa ser
impresso junto** — `print:hidden` no texto do aviso devolveria o defeito (no
botão "Tentar de novo" está certo: não se clica no papel).

Sem os inscritos, `renderSide` cai no `id`: a folha sairia com **identificadores
do banco no lugar dos nomes** de quem vai jogar.

### 8.2 O telão do torneio tinha os quatro defeitos da Onda AX

Ele tem a mesma exposição do telão do dia de jogo — horas numa TV na beira da
quadra — e ficou de fora da AX **só por ser uma tela V1**. Ganhou as mesmas três
regras: `telaoConnectionState` (falha de ciclo não apaga o painel), aviso de
atraso com o pulso "ao vivo" parando de pulsar, e `useWakeLock`.

> ⚠️ **A lição é a de sempre nesta série**: a peça certa já existia, testada e
> em produção — e não chegou aqui porque a tela mora noutra pasta. Por isso o
> guarda passou a varrer os **dois** telões e as **duas** páginas públicas, em
> vez de confiar em quem lembrar.

### 8.3 De quebra: um relógio só

Os dois telões tinham cada um a sua cópia de `useRelogio`. Não é detalhe de
apresentação: é o **mesmo instante** que mostra a hora e mede há quanto tempo o
painel não atualiza. Duas cópias com tiques diferentes dariam **tolerâncias
diferentes para a mesma regra**, sem nada na tela denunciando. Virou
`src/core/lib/useRelogio.js`, com o guarda reprovando quem reintroduzir um
relógio local num telão.

### 8.4 Impacto no banco

**Zero.** Nenhuma coleção, campo, índice, regra, função ou migração.

---

## 9. A lista à mão virou VARREDURA (Onda BA)

### 9.1 O guarda tinha a mesma doença que veio tratar

As Ondas AV, AW e AZ declararam a classe fechada — três vezes. O guarda que
deveria garantir isso tinha uma **lista escrita à mão** de telas, e uma lista à
mão só sabe o que alguém lembrou de colocar nela. É exatamente o
*"confiar em quem lembrar"* que esta série documenta em todas as outras páginas.

Trocada a lista por uma **varredura automática** do escopo, apareceram, ainda
vivos:

| Tela | O que dizia numa falha | Por que importa |
|---|---|---|
| **Lista de torneios** | *"Nenhum torneio público no momento"* / *"Você ainda não tem torneios"* | é a **porta de entrada** da área; quem TEM torneios cria um duplicado |
| **Aba de modalidades** | *"Comece criando a primeira modalidade"* | convida a criar **modalidade duplicada**, com inscrições abertas |
| **Organizador LEGADO do clube** | *"Nenhum participante ainda"*, *"Nenhum jogo sorteado ainda"* | tem o **defeito de sorteio da Onda AW** ainda vivo (ver §9.2) |
| **Visão de equipes** | *"Nenhuma equipe inscrita"*, *"Confrontos ainda não sorteados"* | equipe já inscrita se inscreve de novo; organizador re-sorteia |
| **Histórico de participação** | *"Você ainda não participou de nenhum torneio"* | apaga o histórico da pessoa na cara dela |
| **Meus jogos** | *"Nenhum jogo agendado"* | alguém **não vai à quadra** |
| **Dia de jogo da arena (diálogo)** | *"Esta arena ainda não tem quadras cadastradas"* | manda cadastrar quadras **que já existem** |
| **Buscar parceiro (arena)** | *"Arena não encontrada"*, *"Nenhum match encontrado"* | mesma classe |
| **Buscas de atleta** (3 telas) | *"Nenhum atleta encontrado — preencha manualmente"* | cria **inscrição provisória / convidado** para quem **já tem conta** |

### 9.2 O defeito de sorteio da Onda AW estava vivo no caminho legado

`GameDayOrganizer` (clubes) é o organizador servido para **toda data de evento
anterior à Onda AS** — ele não foi migrado de propósito (ver
`docs/25-DIA-DE-JOGO-COMO-MODULO.md` §5). A Onda AW corrigiu os **três**
organizadores modulares e não tocou neste.

E o defeito é o mesmo: `orderBase` sai dos jogos **já carregados**. Com
`useEventGames` falhando, `allGames` cai no `[]`, `orderBase` vale 0, e a rodada
nova nasce com a **mesma numeração** das que já aconteceram — duas "rodada 1" no
mesmo dia, sem erro nenhum na tela. Agora `canDraw` depende de `!falhouJogos` e
as ações **não são renderizadas** sobre estado desconhecido.

### 9.3 Como a varredura funciona

`src/core/guards/afirmaVazio.js` (ferramenta de guarda — **não vai para o
navegador**, só o teste a importa):

- `afirmaVazio(src)` — a tela tem alguma frase que AFIRMA que algo não existe;
- `temConsulta(src)` — a tela busca algo (os hooks do próprio React ficam de
  fora: `useMemo` não pode falhar, e guarda que acusa inocente é guarda que
  alguém desliga);
- `sabeDistinguirFalha(src)` — existe `isError`, `status === 'error'` ou um
  estado de erro próprio (`setError`);
- `varrer(raiz, filtro)` — caminha o diretório; nada de `grep` por baixo.

O teste examina **quem existe no escopo**, não quem foi lembrado. A isenção
continua possível e passa a exigir **motivo escrito** — e há um teste conferindo
que todo caminho isento existe e que o motivo não é uma palavra solta.

> ⚠️ **Acrescentar caminho a `ISENTOS` é decisão de projeto, não atalho para o
> teste passar.** O critério é um só: se a frase leva alguém a AGIR — criar de
> novo, sortear de novo, não ir à quadra, preencher à mão —, ela não se isenta.
> Hoje são cinco, todas de duas famílias: **fotos** (vazio não induz nada) e
> **texto vindo por `props`** (quem consulta é a tela de cima).

### 9.4 Impacto no banco

**Zero.** Nenhuma coleção, campo, índice, regra, função ou migração.

---

## 10. Arena, professor e reservas (Onda BP, 2026-09-25)

### 10.1 A varredura parava na porta da arena

O escopo da §9 era dia de jogo e torneio — onde a classe tinha sido achada. A
arena, o professor e as reservas do atleta ficaram de fora **por construção**:
o filtro não os enxergava. Estendida a eles (111 arquivos), a mesma varredura
acusou **32**. Dois são isentos com motivo (as regras de preço chegam por
`props`); os outros **30** afirmavam vazio sobre consulta que podia ter
falhado.

E ali o custo é maior que no torneio, porque boa parte dessas telas oferece, ao
lado do vazio, um comando que **grava**.

### 10.2 🐞 O que regravaria por cima do que existe

São os casos mais caros: a pessoa não vê nada de errado, clica em "salvar" e
apaga o que estava gravado.

| Tela | O que acontecia com a leitura falhando |
|---|---|
| **Disponibilidade do professor** (`V2CoachAgenda`) | o editor abria **em branco**; "Salvar" gravava a semana vazia por cima da verdadeira — e os alunos deixavam de ver horários |
| **Perfil do professor** (`V2Coaches`) | o botão virava *"Sou professor"* e abria o formulário vazio; salvar regravava bio, valor e regiões |
| **Fechamento financeiro** (`V2ArenaFinanceTab`) | "Fechar período" e "Regerar" gravavam um **retrato** do mês feito com estoque vazio — um relatório salvo dizendo que a arena não vendeu nada |
| **Regras da arena** (`V2ArenaRulesTab`) | as regras são UMA lista no documento da arena; sem a arena na mão, a aba ficava em branco |

Nas quatro, o comando que grava **não é renderizado** enquanto o estado for
desconhecido, e a tela diz o porquê (*"salvar agora gravaria a agenda em
branco"*). As funções de gravar do financeiro também retornam cedo — a tela
esconde, a função confere de novo.

### 10.3 🐞 O que duplicaria o que existe

"Nenhum X ainda" ao lado de "Criar X" é convite a criar de novo algo que já
está lá:

- **quadras** (`V2CourtsTab`) — quadra duplicada, e o calendário contando duas;
- **janelas de horário** (`V2CourtSchedulesModal`) — janela duplicada vira
  horário oferecido duas vezes;
- **totem** (`V2ArenaKiosk`) — um segundo totem para a mesma recepção;
- **catálogo** (`V2ArenaCatalogBrowser`) — com "meus produtos" falhando, tudo
  parecia "não adotado", e adotar de novo duplicava o produto no estoque;
- **entradas e saídas do Mercado** (`V2ArenaMercadoTab`) — registrar de novo
  uma compra que já está lá;
- **pacotes e membros** (`V2ArenaAdminMembers`), **professores parceiros**
  (`V2ArenaCoaches`) e, do lado do professor, **pacotes**, **alunos**,
  **clínicas**, **conteúdo** e **arenas parceiras**.

Um caso sutil: nos **alunos do professor**, com a lista falhando, todo o
histórico de aulas aparecia como "fora do roster", e adicionar regravava como
**ativo** quem estava pausado.

### 10.4 🐞 O que afirmava uma coisa falsa

- **Minhas reservas** (`V2Bookings`): *"Você ainda não reservou"* — para quem
  tem jogo hoje à noite, a conclusão é que a reserva sumiu;
- **Página da arena** (`V2ArenaDetail`), módulos e onboarding: a arena
  "não encontrada" por uma queda de rede — quem recebeu o link desiste dela;
- **Pedido de reserva** (`BookingRequestDialog`): com reservas, quadras ou
  janelas falhando, todo horário parecia livre. O pedido continua possível (o
  serviço confere o conflito ao gravar e a arena confirma), mas agora um aviso
  diz que a disponibilidade **não foi conferida**, com "Conferir de novo";
- **Métricas** (`V2ArenaMetrics`): **R$ 0,00** de receita. Agora, reservas ou
  vendas falhando derrubam o painel para o estado de erro (sem elas os números
  não significam nada); uma parte secundária falhando (ocupação, avaliações,
  Mercado, aulas, pacotes, mensalidades, torneios) deixa os números saírem,
  com o aviso **"Ficou de fora: …"** — número incompleto sem aviso é o mesmo
  defeito;
- **Prontidão da arena** (`V2ArenaManage`) e aba de quadras: janelas que não
  carregaram viravam o alarme *"quadra sem horário de funcionamento"*, mandando
  o dono configurar o que já está configurado. O alarme só sai com quadras
  **e** janelas carregadas (`isSuccess`).

### 10.5 O guarda

`falhaNaoEVazio.test.js` ganhou um segundo `describe` com o escopo da arena,
do professor e das reservas — a mesma varredura, o mesmo `ISENTOS` com motivo
escrito. E há testes de renderização travando os casos de maior dano:
disponibilidade do professor (sem editor em branco), aba de quadras (sem
"Nova quadra"), totem (sem "Criar o totem"), membros e pacotes (sem incluir,
criar nem confirmar pedido) e métricas (erro no núcleo, aviso nas partes).

> ⚠️ O detector é por ARQUIVO: basta um `isError` em qualquer lugar para o
> arquivo passar. Ele pega quem esqueceu a classe inteira, não quem tratou uma
> consulta e esqueceu a vizinha. Ao escrever uma tela com várias consultas,
> trate **cada** uma que alimenta uma afirmação ou um comando.

### 10.6 Impacto no banco

**Zero.** Nenhuma coleção, campo, índice, regra, função ou migração. Nenhum
dado lido ou gravado de forma diferente — as mudanças decidem só o que a tela
mostra e quais comandos ela oferece.
