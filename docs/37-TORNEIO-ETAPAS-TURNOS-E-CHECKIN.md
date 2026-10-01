# 37 — Torneio: meu torneio no início, check-in que não trava, 2 turnos e o Americano aprimorado em etapas

> Uma onda sobre torneios, a partir de três relatos do dono. O formato novo
> nasce atrás da flag `tournament_americano_etapas` (padrão OFF); o resto vale
> para todos. **Banco: nenhuma coleção, índice ou regra.** O formato novo usa
> um campo opcional dentro da configuração da fase (`stages[].etapa_count`,
> como os outros campos da fase — Onda AT), e a etapa de cada jogo mora no
> NOME DO GRUPO que o jogo sempre teve.

## O pedido

*"Acabei de criar um torneio e abri as inscrições. Para mim, ele não aparece na
seção torneios do meu início. Ele deveria aparecer como meu torneio (organizado
por mim) e com minha inscrição."*

*"Se fizer check-in dá erro na modalidade, é como se o participante não
estivesse inscrito… o check-in não precisa ser obrigatório, mas quando for
feito, não deve estragar nenhuma funcionalidade."*

*"Eu deveria poder criar modalidades com 2 turnos e também… americano em grupos
que depois se unem e formam outros grupos, mas a soma de pontos não se perde…
Crie um nome para esse tipo de modalidade, americano aprimorado em etapas."*

## 1. 🐞 O torneio que eu criei e em que me inscrevi sumia do meu início

`listMyTournaments` devolve um papel por torneio (`my_role`), e organizar vence
jogar: quem criou o torneio e se inscreveu nele tinha `my_role: 'owner'`. A
seção Torneios do início só olhava `my_role === 'player'` — então o torneio
**sumia de "Você está inscrito" e aparecia em "Inscrições abertas" com
"inscreva-se"**, como se a pessoa ainda não estivesse.

Agora `listMyTournaments` calcula também — nada gravado — se a pessoa **joga**
(`is_player`, a partir das inscrições dela que não foram canceladas) e com que
status (`my_registration_status`). A seção Torneios abre com **"Seus
torneios"**: o que a pessoa joga e o que organiza, numa lista só, sem repetir,
com o papel no subtítulo ("Você organiza e joga", "Check-in feito",
"Pagamento pendente"…). Quem só organiza vai direto à gestão. "Inscrições
abertas" não repete os torneios da pessoa, e enquanto os torneios dela
carregam a lista espera — senão o próprio torneio piscaria como "inscreva-se".

Código: `modules/home/domain/homeTournaments.js` (`jogoNoTorneio`,
`organizoOTorneio`, `myTournamentsForHome`, `meuPapelTexto`),
`tournament/domain/participation.js` (`summarizeMyRegistrations`),
`v2/components/home/personal/HomeTournamentsSection.jsx`.

## 2. 🐞 O check-in de quem foi inscrito por outra pessoa dava "permissão negada"

Reproduzido no emulador: a organização inscreve a atleta (ou a dupla inscreve a
dupla), o torneio começa, a atleta toca em **"Fazer check-in"** e recebe
`PERMISSION_DENIED`. A regra de `tournament_registrations` só deixa **quem criou
a inscrição** alterá-la (além da organização), e a tela oferecia o botão também
ao jogador vinculado. Para a atleta, a mensagem crua parecia dizer que ela não
estava inscrita.

A regra não foi afrouxada. O botão agora só aparece para quem pode
(`selfCheckInState`), e quem foi inscrito por outra pessoa lê *"Check-in com
quem fez a inscrição ou na mesa da organização"*. O serviço recusa dizendo o
motivo, em português. O check-in feito pela organização passou a avisar quando
dá certo e quando falha (antes falhava calado), e o selo de status da
inscrição usava uma propriedade que o componente não conhece — ficava sempre
cinza.

### O check-in não muda nada além de dizer que a pessoa chegou

Uma inscrição com check-in feito joga exatamente como uma confirmada sem
check-in: sorteio, fases, vagas fictícias, contagens. A pergunta "esta inscrição
joga?" estava escrita à mão em **nove** lugares (`CONFIRMED || CHECKED_IN`), e a
contagem da aba de inscrições só somava o check-in atrás de uma condição.
Virou **uma** função, `isActiveRegistration` (`tournament/domain/checkin.js`),
e um guarda (`src/core/guards/checkinNaoTrava.test.js`) reprova quem comparar
com "confirmada" à mão fora dos dois lugares em que isso significa "ainda sem
check-in".

E a ajuda estava errada: dizia que o check-in *"é como o torneio sabe quem
apareceu, antes de sortear"*. Não é — o sorteio inclui toda inscrição
confirmada. Corrigido no artigo e no tutorial: o check-in é opcional; quem não
veio sai pela inscrição (cancelar), não pela falta de check-in.

## 3. 🐞 "2 turnos" não valia em modalidade de várias fases nem no Americano

O editor de fases já tinha **Turnos** (ida e volta, Onda AT), mas:

- numa modalidade com **mais de uma fase**, o sorteio (`buildPhaseDraw`) não
  repassava o turno ao motor — sorteava sempre só a ida;
- no **Americano**, o motor ignorava o turno nos dois caminhos.

Agora os dois respeitam. No Americano, o returno (`withReturnLeg`) repete a
programação com os lados trocados: cada dupla joga junta duas vezes e cada um
enfrenta cada outro 4 vezes. A explicação da fase (pontos corridos e Americano)
passou a contar os turnos — antes dizia metade dos jogos. O controle se chama
"1 turno / 2 turnos (ida e volta)", com a ajuda própria de cada formato, e há
artigo novo na central: **"Dois turnos (ida e volta)"**.

## 4. ⭐ Americano aprimorado em etapas (`americano_etapas`)

Inscrição **individual**. Os atletas jogam em **etapas**; em cada etapa, um
**Americano em grupos** (de 4 por padrão: 3 jogos para cada um). Terminada a
etapa, os grupos são **refeitos**, misturando quem ainda não se encontrou. A
classificação é **uma só**, somando todas as etapas — o campeão é quem foi
melhor no total.

O exemplo do pedido, que é teste: **8 atletas, grupos de 4, 3 etapas** → 9 jogos
para cada um. Na etapa 2 cada grupo leva dois de cada grupo da etapa 1; na
etapa 3, os pares que seguiram juntos encontram os dois que ainda faltavam — e
todos terminam tendo jogado com e contra todos (28 de 28 pares).

### A mistura

A pergunta é *quem não se encontrou ainda*, e ela não depende de resultado —
por isso é reprodutível pela semente e pode ser **prevista antes do sorteio**
(a explicação da fase mostra a previsão de encontros inéditos).

- **Prioridade 1 — encontros inéditos.** Cada vez que um par se junta de novo
  custa caro. Como o total de "lugares de par" de cada etapa é fixo, minimizar
  os reencontros é maximizar os pares inéditos.
- **Prioridade 2 — espalhar as repetições** (custo quadrático): juntar pela 3ª
  vez custa mais que juntar dois pares diferentes pela 2ª.
- **Antes das duas — jogos iguais.** Com grupos de tamanhos diferentes (9 = 5 +
  4), quem cai no maior joga um jogo a mais; a mistura reveza quem fica no maior
  para os totais saírem iguais (ou com diferença de 1).

A busca olha as **etapas que faltam juntas** (`planEtapas`): planejar etapa por
etapa é guloso e se encurrala. Busca local por trocas + perturbações,
determinística e com esforço limitado. Medido: 16 atletas em grupos de 4, 5
etapas → **cada par se encontra exatamente uma vez** (120 de 120 — a solução
perfeita, que a versão gulosa não achava: 112). A previsão da tela roda em até
~80 ms com 64 atletas.

### Grupos que o Americano aceita

O Americano só fecha (cada dupla exatamente uma vez) com 4, 5, 8, 9, 12, 13…
atletas. O tamanho escolhido é 4, 5, 8 ou 9, e os grupos de cada etapa saem dos
tamanhos que fecham, o mais perto do escolhido (`etapaGroupSizes`). 6, 7 e 11
atletas não fecham com grupos de 4/5 — a tela diz o número que fecharia ("Com
10 ou 12 atletas, fecha").

### Como funciona na plataforma

- **Configurar** — Modalidades → fase → "Americano aprimorado em etapas" (só com
  a flag; a fase que já está nele continua com ele no seletor). Campos: número
  de etapas (1–12, padrão 3), atletas por grupo, turnos. A fase é sempre em
  grupos (`division_mode: 'max_per_group'`) — nunca "grupo único", porque a
  rotina que limpa marcas de grupo das fases de grupo único apagaria a etapa dos
  jogos (`matchesWithStaleSingleGroup` também ignora o formato, por garantia).
- **Sortear** — gera a **etapa 1** (`firstEtapaDraw`), nos dois caminhos
  (modalidade de uma fase e de várias).
- **Avançar** — o botão vira **"Gerar etapa 2 de 3"** e só aparece quando a
  etapa atual terminou; o serviço é o avanço de rodada de sempre
  (`advanceStage` → `computeStageAdvance` → `nextEtapa`), no mesmo contrato do
  Mexicano e do suíço. Quem saiu da modalidade (inscrição cancelada ou
  desistência) não entra nos grupos novos.
- **Situação** — a tela de sorteio diz em que pé está ("Etapa 1 de 3 em
  andamento: faltam 6 jogos para gerar a etapa 2").
- **Classificação** — **uma tabela**, somando todas as etapas, com a ordem de
  desempate da fase (o organizador pode trocar para aproveitamento nas regras
  avançadas). Nenhum grupo é gravado em `tournament_groups` para esse formato.
- **Fase seguinte** — opcional (ex.: chave com os 4 melhores). Só pode ser
  gerada **depois da última etapa** (botão e serviço), e a prévia de quem passa
  avisa que é parcial enquanto houver etapa por jogar.
- **Conclusão** — a modalidade só está concluída quando a última etapa pedida
  foi jogada (`isModalityComplete`).
- **Não aparecem** no formato os comandos que desmontariam as etapas: "Editar
  grupos" e "Re-sortear jogos (manter grupos)".

### Sem campo novo nos jogos

A etapa mora no nome do grupo (`group: "Etapa 2 · Grupo A"`, `etapaOfMatch`), e
as rodadas seguem numeradas em sequência de uma etapa para a outra (a etapa 2
começa depois da última rodada da 1). A configuração ganha `etapa_count`
dentro de `stages[]` — e **só** nas fases desse formato (`normalizePhase` não
acrescenta o campo às outras).

Código: `tournament/domain/americanoEtapas.js` (motor, previsão, explicação,
textos), `americanoEtapasConfig.js` (os números da fase, sem o motor, para
`phases.js` não arrastar o Americano), e as integrações em `phases.js`,
`phaseDraw.js`, `progression.js`, `tournamentCompletion.js`,
`phaseAdvancePreview.js`, `formatExplain.js`, `phaseRules.js`,
`drawService.js`, `phaseService.js`, `matchService.js`, `rankingService.js`,
`PhasesEditor`, `PhaseAdvancedRules`, `StageExplanation`, `NextPhasePreview`,
`MultiPhaseDrawBlock`, `V2TournamentDrawTab`, `V2FormatsGuide` e
`performance/domain/playerStats.js` (o formato é jogado em duplas).

## 5. O que mais mudou junto

- **🐞 A tabela de classificação ignorava a ordem de desempate da fase.** O
  organizador podia trocar a ordem (Onda AT) e ela decidia quem **avançava**,
  mas a tabela da tela usava sempre a ordem padrão — a classificação exibida
  podia ser diferente da que valeu. Agora `computeModalityRankingStructured`
  usa a ordem da fase.
- **🐞 "Re-sortear jogos restantes" renumerava as rodadas a partir de 1.** Em
  chave, dupla eliminação, suíço e Mexicano o número da rodada é a estrutura: o
  avanço achava que a rodada atual tinha acabado e gerava a seguinte por cima.
  Nesses formatos o comando não aparece (e o serviço recusa); no Americano em
  etapas as rodadas seguem depois das já jogadas.
- **O status da partida** aparecia cru ("scheduled") nas tabelas de sorteio —
  agora "Agendado", "Encerrado"…
- **Ajuda** — artigos novos "Dois turnos (ida e volta)" e "Americano aprimorado
  em etapas" (só com a flag); o de inscrição explica o check-in como opcional; o
  tutorial do torneio diz onde fica o turno e o que o check-in faz.

## 6. O que NÃO mudou (e por quê)

- **A regra de `tournament_registrations` não foi aberta** para o jogador
  vinculado fazer o próprio check-in. Seria mexer em regra de banco; a tela
  diz o caminho (quem fez a inscrição, ou a mesa da organização).
- **O Americano em etapas não vale para duplas fixas nem para equipes**: é uma
  rotação de parceiros, como o Americano. O sorteio recusa com o motivo.
- **Não há modelo pronto ("preset")** do formato no editor: os modelos não
  conhecem flag, e um modelo mostraria o formato com a flag desligada.

## Testes

`americanoEtapas.test.js` (o exemplo do pedido, a mistura, a justiça, o avanço,
a previsão, a flag), `checkin.test.js`, `participation.test.js`,
`homeTournaments.test.js`, `V2PersonalHome.runtime.test.jsx`,
`phaseDraw.test.js`, `draw.test.js`, `formatExplain.test.js`,
`phaseRules.test.js`, `rankingService.test.js`, `helpCenter.test.js` e o guarda
`src/core/guards/checkinNaoTrava.test.js`. Verificado no navegador, no
emulador: o check-in da atleta inscrita pela organização, o início da
organizadora inscrita, e as etapas de ponta a ponta (sorteio → etapas 2 e 3 →
classificação única → chave com os 4 melhores).
