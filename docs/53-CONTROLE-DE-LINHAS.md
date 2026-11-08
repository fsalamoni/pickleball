# 53 — Controle de linhas por câmera

> Flag `line_control` (default OFF, só o admin liga em Painel admin →
> Funcionalidades → Dia de jogo). Módulo `src/modules/linecall/`.
> Estado: **no navegador, QUADRA POR QUADRA, de 1 a 5 câmeras por quadra**
> (2026-11-03). As regras julgadas e onde cada uma vive no motor: §10. A
> pesquisa de origem está em https://claude.ai/artifact/1AR6uPgAbzy8A2CLs2v2sE.

## 1. O que faz — quadra por quadra

O controle de linhas é da **QUADRA**, em todo lugar onde um jogo nasce (dia de
jogo do atleta, da arena e do clube; torneio): cada quadra liga o seu e escolhe
o seu arranjo — uma quadra pode ter uma câmera e a do lado, cinco. A câmera
fica montada na quadra e os jogos passam por ela.

Com a flag ligada, quem **organiza** o dia — criador, gestor da arena, admin do
clube e o **administrador nomeado** (`canConfigureLineControl`,
`useGameDayRoles().podeConfigurarLinhas`; a regra é `lineOrgOf`) — vê o cartão
**Controle de linhas por câmera** dentro do `GameDayModule` (as três origens por
construção). É um `V2CollapsibleCard` como os demais cartões do dia (seção
`GAME_DAY_SECTION.LINE_CONTROL`, `gameday:line-control`, preferência por
pessoa): para quem organiza nasce **recolhido**, e o cabeçalho diz como está
("Quadra 1: 1 câmera(s) · Quadra 3: 5 câmera(s)" ou "Desligado nas 3
quadra(s)"); abrir é para mudar. Para quem só participa nasce aberto. Por
dentro, o `LineCourtsBoard`, o MESMO quadro da página de linhas do dia e da do
torneio:

- **as quadras do dia** (`gameDayLineCourts`, `domain/gameDayLine.js`): de 1 a
  `play_courts`, mais as quadras dos jogos já criados e as que já têm
  configuração — nenhuma some da lista enquanto tiver câmera ligada (máx. 99);
- em cada quadra: **liga/desliga** (vale com o jogo em andamento), o
  **arranjo** (de 1 a 5 câmeras, §2) e o que ele julga ("linhas, saque, cozinha
  e pé no saque" ou "linhas e saque (não julga pé)", `layoutJudges`);
- **Abrir câmera** e **Abrir central** → `/dia-de-jogo/:id/linhas?quadra=court-N&modo=camera|central`
  (`V2LineControl`), em outra aba; **Onde pôr as câmeras** abre a quadra com o
  guia de montagem;
- **Ligar em todas as quadras** / **Desligar todas**;
- **Copiar para os meus próximos dias de jogo** (`lineCourtCopyPlan`): os dias
  que a pessoa CRIOU, de hoje em diante, fora os arquivados — cada quadra
  recebe a configuração da quadra de mesmo número (sem configuração aqui ⇒
  desligada). Dia de outra pessoa é dela para decidir.

Quem não organiza vê o cartão só se alguma quadra estiver ligada, com a central
e — se participa do dia — a câmera (`canBeLineCamera`). Cada escrita é uma
quadra (`saveEach`, 8 por vez): a que falha não derruba as outras e a tela diz
quantas não foram salvas.

| marcação (`kind`) | resultado (`call`) | o que é |
|---|---|---|
| `bounce` — quique | **Dentro** · **Fora** (longa, lateral, curta na cozinha, área errada, rede) · **Revisar** | a bola contra as linhas, com a distância e a incerteza (± cm) |
| `volley` — voleio | **Falta: pé na cozinha** (no voleio, no impulso, sem ter saído da cozinha) · **Voleio sem falta** · **Revisar o pé** | o pé de quem voleou (11.A) |
| `serve_foot` — pé no saque | **Falta** (na linha de fundo, fora da lateral, fora da central, no ar) · **Saque sem falta de pé** · **Revisar** | o pé de quem saca, no instante da batida (7.A) |
| `two_bounce` — dois quiques | **Falta** (devolução ou 3ª bola sem quicar) · **Dois quiques respeitados** · **Revisar** | 10.A |

O **motivo** de cada marcação é gravado (`reason`, §4) e vira o texto da tela
(`callLabel`/`callDetail`, `callLabels.js`): "Fora: longa", "Saque curto: na
cozinha", "Pé 4 cm além da linha de fundo no saque (±2 cm)".

**Legado.** Antes do controle por quadra o liga/desliga ficava no próprio dia
(`game_days.line_control`/`line_control_layout`) e as câmeras em
`game_days/{id}/line_cams|line_calls`. Nada disso é lido mais (a flag nasce
desligada e só o admin a liga) e nada foi migrado — migração de dados é decisão
do dono: o dia que tinha o controle ligado aparece com todas as quadras
desligadas, e basta ligar a quadra. Os documentos antigos seguem no banco sem tela; a
exclusão de conta ainda os apaga.

## 2. Posições e arranjos (`domain/cameraLayouts.js`)

Todas as câmeras usam o **mesmo desenho** da quadra: lado A embaixo, lado B em
cima, lateral 1 à esquerda, lateral 2 à direita. Quem filma combina, no local,
qual ponta é o lado A. Cada posição sabe onde fica, a altura, para onde aponta,
**quais quatro pontos se marcam** na calibração e como o motor a lê:

| posição (id gravado) | onde | calibra por | modo | pé na cozinha |
|---|---|---|---|---|
| `fundo_a`, `fundo_b` | atrás da linha de fundo, no meio, 2–4 m para trás, 3–6 m de altura | cantos da quadra | imagem | vê bem o lado de lá (peso 0,6) |
| `rede_1`, `rede_2` | fora da quadra, no prolongamento da rede, 3–5 m da lateral, 1,5–2,5 m | as 4 pontas das linhas da cozinha | imagem | **a melhor** (peso 1) |
| `canto_a1` … `canto_b2` | fora do canto, 1–2 m, 2,5–4 m de altura | cantos da quadra | imagem | média (0,5) |
| `topo` | acima da rede, no centro, 7–9 m (4–5 m com grande-angular linear) | cantos da quadra | **de cima** | não julga (0) |

Os ids de posição e de arranjo vão para o banco (`line_cams.position`,
`line_courts.line_control_layout`): **nunca renomeie** (há teste travando).

Os **11 arranjos** (quem organiza escolhe, POR QUADRA; padrão `solo_fundo`):

| câmeras | arranjo | para quê |
|---|---|---|
| 1 | `solo_fundo` ⭐ | o jeito de começar |
| 1 | `solo_rede` | a melhor para pé na cozinha |
| 1 | `solo_topo` | onde a bola caiu; sem pé na cozinha |
| 2 | `fundo_rede` ⭐ | o fundo cuida das linhas, a lateral da cozinha |
| 2 | `dois_fundos` | cada fundo de perto |
| 2 | `topo_rede` | quadra coberta com teto alto |
| 3 | `fundos_topo` | três olhares para cada quique |
| 4 | `fundos_redes` ⭐ | cobertura completa com celulares |
| 4 | `cantos` | cada linha por dois ângulos |
| 5 | `fundos_redes_topo` | o máximo com aparelhos comuns |
| 5 | `cantos_topo` | cantos + o ponto do quique pelo alto |

**Por que a câmera de cima não é a principal.** De cima ela vê ONDE a bola
caiu com a mesma precisão nos dois fundos — mas não vê a altura da bola, então
o quique só aparece como a bola **desacelerando** no chão (no modo `overhead`
o motor trabalha em metros da quadra: batida = a direção se inverte; quique =
segue no mesmo sentido, perdendo ≥ 15% da velocidade). E precisa de 7–9 m para
a quadra inteira caber num celular comum, o que só existe em quadra coberta.
Os pés vistos de cima não se separam do corpo: ela **não julga** pé na cozinha
(o detector de pose nem é carregado). Por isso entra como complemento.

A referência comercial (PlayReplay, aprovado pela ITF e usado no PPA/MLP em
2026) usa **4 câmeras nos postes da rede**; a lateral da rede é, de fato, o
melhor ângulo para a cozinha. Lente grande-angular acima de ~90° (olho de
peixe) entorta as linhas e a homografia erra nas bordas: use o modo **linear**.

## 3. Várias câmeras juntas — a central (`domain/fusion.js`)

Cada aparelho roda o próprio motor e grava cada marcação nas `line_calls` da
SUA quadra. Não há sincronia de quadros (o navegador não consegue — isso
exigiria aplicativo nativo do tipo *recsync*); a **central** de cada quadra
junta as marcações das câmeras dela por **janela de tempo**:

- mesmo tipo de evento a até **700 ms** (quique) ou **350 ms** (lance de pé —
  voleio, pé no saque, dois quiques: num bate-rebate na cozinha dois voleios
  caem a menos de 0,7 s), no máximo uma marcação por posição;
- quique a até **1,5 m** um do outro; lance de pé do mesmo lado da rede;
- **veredito:** as câmeras confiantes (que não disseram "revisar") que
  concordam decidem; se discordam, **Revisar** com "as câmeras discordaram";
- no pé, votam só as câmeras da MELHOR posição presente: o "sem falta" do
  fundo pode ser o pé escondido atrás de outro jogador. No voleio pesa
  `footWeight` (a lateral da rede vê melhor); no pé no saque, `serveFootWeight`
  — e a câmera do fundo do OUTRO lado vale 40% disso (vê de longe, através da
  rede e dos jogadores);
- **dois quiques** só saem de uma câmera que viu a troca inteira, e outra
  câmera pode DESMENTIR: um quique visto do lado de quem bateu, até 2,5 s antes
  da batida, quer dizer que a bola quicou — o lance vira "revisar";
- a medida mostrada é a da melhor câmera (menor incerteza ÷ peso), e o motivo
  (`reason`) é o dela.

**Os relógios dos aparelhos** (`domain/clockSync.js`, no `useLineControlLive`).
Cada câmera marca `t_ms` e `seen_ms` no relógio DELA. 🐞 Antes a central
comparava essas horas direto: celular com o relógio errado alguns segundos
aparecia "fora do ar" estando no ar, o mesmo quique visto por duas câmeras
virava dois lances (janela de 0,35–0,7 s) e o telão não mostrava o lance.
Agora, sem nada novo gravado: o sinal de vida já leva a hora do aparelho
(`seen_ms`) e a do servidor (`updated_at`), então `updated_at − seen_ms` leva
o relógio da câmera ao do servidor, e `chegada − updated_at` (só de sinais que
mudaram depois da carga inicial, fora do cache) leva o do servidor ao da tela.
Vale a MENOR de até 8 amostras (como no NTP: o atraso da rede só soma). Sem
amostra, a diferença é zero — igual a antes. As listas devolvidas (`cams`,
`calls`) já vêm no relógio da tela, com o original em `seen_ms_raw`/`t_ms_raw`.
A câmera sem conta manda `client_ms` com a marcação e a função `lineGuest`
converte a hora do lance para a do servidor (o sinal dela já é gravado com a
hora do servidor). A hora do lance sai da hora de CAPTURA do quadro
(`requestVideoFrameCallback` → `captureTime`) quando o navegador conta, não da
hora em que o quadro foi processado.

**Câmera que para no meio do jogo é avisada** (`judgingPositions` /
`stoppedJudging`, `readiness.js`): a posição que julgava (no ar, calibrada,
analisando, no lugar) e deixou de julgar vira um aviso vermelho na central por
10 s — e a voz o diz, se estiver ligada. Lição de Wimbledon 2025: metade da
quadra ficou sem chamada por um game e ninguém foi avisado.

A presença de cada câmera é `…/line_cams/{uid}_{posição}`, renovada a cada
15 s (online = visto há ≤ 45 s) e apagada ao sair da tela. Se o aparelho
apaga, a bateria acaba ou a aba é fechada à força, o documento FICA: a central
passa a mostrá-lo fora do ar depois de 45 s, e ele sai quando a mesma conta
volta àquela posição ou com a exclusão da conta.

A tela da câmera **não cai num soluço da rede**: com o Wi-Fi fora um instante,
a releitura do dia ou das quadras falha e a tela segue com o que já tinha
(erro só quando não há dado nenhum — `V2LineControl.runtime.test.jsx`). As
quadras são lidas do SERVIDOR (`getDocsFromServer`): sem rede, a leitura comum
devolveria o que sobrou no cache, às vezes nada, e "nenhuma quadra" virava
"controle desligado" na câmera que estava filmando.
A central (`LineCentral`) mostra o arranjo, quem está em cada posição
(analisando / calibrada / falta calibrar / sem câmera, quadros/s), a
**manchete** em letras grandes e os lances anteriores; quem organiza pode
**Limpar marcações** (confirmação em dois toques).

**A manchete** (`pickHeadline`, `fusion.js`) é UMA regra para a câmera, a
central, o aviso, a tela que pisca e o telão: o lance mais GRAVE entre os que
caíram até `HEADLINE_WINDOW_MS` (o maior atraso do motor + 1 s) antes do mais
novo — falta ou fora sem decisão > revisar sem decisão > falta decidida >
dentro/sem falta; empate fica com o mais novo. 🐞 Antes valia só o mais novo
pela hora do lance: o pé no saque é marcado na hora da batida e sai junto com o
quique do saque, e a falta de impulso sai até 2 s depois do voleio — nenhum dos
dois virava "o último", e o "Saque: dentro" verde cobria a falta. No lote do
motor (o pé e o quique do saque saem no mesmo quadro) a manchete vai na frente
(`headlineFirst`). O aviso toca UMA vez por lance que CHEGOU
(`newArrivals`, pela chave das marcações — o id do lance muda quando uma
câmera atrasada entra na junção); o que já estava na tela ao abrir não toca, e
a tela que pisca não troca a falta pelo "dentro" que chegou depois. Trocar de
câmera no aparelho limpa os lances da anterior e recomeça a análise (o motor, o
replay e o lance pendente): o relógio do vídeo recomeça do zero, e um lance
velho seguiria de manchete.

## 4. O que é gravado

- **A quadra**: `game_days/{id}/line_courts/court-N` (o id é `court-` + o número
  da quadra, 1–99) — `line_control` (bool), `line_control_layout` (opcional, id
  do arranjo; ausente = `solo_fundo`), `updated_by`, `updated_at`. Sem
  documento, a quadra está desligada.
- **A câmera no ar**: `…/line_courts/court-N/line_cams/{uid}_{posição}` —
  `uid, name, position, layout, calibrated, analyzing, fps, seen_ms,
  updated_at` + opcionais `battery` (0–1), `charging`, `check_cm` (erro da
  conferência pelo 5º ponto).
- **A marcação**: `…/line_courts/court-N/line_calls/{auto}` — `uid, position,
  kind (bounce|volley|serve_foot|two_bounce), call (in|out|review|fault|clean),
  t_ms, margin_m, uncertainty_m, depth_m, x, y, created_at` + opcionais
  `serve: true` (quique de saque) e `reason` (≤ 12 letras: `long`, `wide`,
  `short`, `wrong_box`, `net`, `contact`, `momentum`, `reentry`, `unseen`,
  `baseline`, `sideline`, `centerline`, `airborne`, `return`, `third` — os ids
  são gravados, **nunca renomeie**). No pé no saque, `margin_m` positivo é pé
  legal e `depth_m = −margin_m` é quanto passou da linha. **Nunca imagem.**
  Quem organiza grava a **palavra final** no primeiro documento do lance:
  `decision` (`in|out` no quique, `fault|clean` nos lances de pé), `decided_by`
  (ele mesmo) e `decided_ms` — e nada mais; o que a câmera marcou não muda.

**Regra** (`firestore.rules`, dentro de `game_days`; emulador em
`tests/rules/lineControl.rules.test.js`). Quatro funções valem igual no dia de
jogo e no torneio: `lcCam` (formato da câmera, id `{uid}_{posição}`), `lcCall`
(formato da marcação, os quatro `kind`, o `reason`), `lcDec` (só a palavra
final, em nome próprio) e `lcCfg` (formato da quadra). No dia de jogo:

- **a quadra** lê quem lê o dia; grava quem organiza (`lineOrgOf`: criador,
  nomeado, gestor da arena, admin do clube, admin da plataforma), só com id
  `court-N` e só as quatro chaves;
- **câmera e marcação** (`lcGdCam`): só com `line_control == true` NAQUELA
  quadra, em nome próprio, e só quem está em `member_uids` ou organiza;
  marcação não se edita (só a decisão de quem organiza); apagar é do dono
  (câmera) ou de quem organiza.

A cláusula estreita do nomeado na regra do próprio `game_days` saiu: ele
configura a quadra pela regra de `line_courts`, sem tocar no documento do dia.
**Exclusão de conta** (`coletarLinhas`, `functions/accountDeletion.js`) apaga
as câmeras e marcações da pessoa em TODA quadra — do dia de jogo, do torneio e
do formato antigo, direto no dia — por **grupo de coleção**, pela `uid`. 🐞
Antes o pai era achado pelas listas do dia (membro, nomeado, jogo publicado) e
pela equipe do torneio: o gestor da arena que filmou um dia em que não é
membro, e quem saiu do dia depois de filmar, ficavam de fora — e a câmera
guarda o nome. A busca precisa do índice de GRUPO de `uid` em `line_cams` e
`line_calls` (`firestore.indexes.json` → `fieldOverrides`, que mantêm os
índices simples de sempre; guarda em `indicesCompostos.test.js`). Sem o índice
a consulta falha e a exclusão sai **parcial**, nunca "nada a apagar"; mais de
400 documentos numa coleção também (a próxima rodada apaga o resto).

Vídeo, calibração (por posição: `v2:view:<uid>:linhas:calibracao:<dia>:<posição>`)
e as fotos das marcações ficam **no aparelho**. A ÚNICA imagem que sai dele é a
foto da quadra para a calibração pela central (§5d): só a própria câmera e quem
organiza a leem, ela some a cada escrita de quem organiza e quando a câmera
sai, e entra na exclusão de conta.

- **A calibração pela central**: `…/line_courts/court-N/line_calib/{uid}_{posição}`
  (o id da câmera) — a câmera grava `uid, position, vw, vh` (tamanho do
  vídeo), `cur` (a calibração que ela tem), `snap` (JPEG em data URL, abaixo
  de 900 mil caracteres) + `snap_ms`, e `applied_ms`; quem organiza grava
  `calib` + `calib_ms` (pontos em pixels do VÍDEO), `snap_req_ms`, `run` +
  `run_ms` e `by` (ele mesmo). Regra `lcCal` (a câmera, em nome próprio,
  com o controle ligado na quadra) e `lcCalOrg` (quem organiza, só essas
  chaves e sempre apagando `snap`); ler e apagar, só a própria câmera e quem
  organiza. Exclusão de conta pelo grupo `line_calib.uid`.

## 5. Guia de uso por aparelho

O guia completo para quem usa está no Claude Doc "Guia do controle de linhas" e,
resumido, na Central de Ajuda (`controle-de-linhas`, atrás da flag) e dentro da
própria tela ("Como posicionar esta câmera", `PlacementGuide` + `DeviceTips`).

| aparelho | como entra | cuidado |
|---|---|---|
| celular/tablet | o próprio aparelho, câmera traseira, no Chrome (Android) ou Safari (iPhone) | horizontal, tripé, na tomada; a grande-angular (0,5×) aparece na lista — usar só se a quadra não couber |
| webcam USB | notebook; várias na mesma tela ("Mais uma câmera nesta tela") ou uma por aba, cada uma numa porta USB | 60 quadros/1080p; extensão USB ativa para chegar ao alto |
| câmera de ação | modo webcam por USB (GoPro Hero 8+, DJI Osmo Action 3+) ou HDMI + placa de captura | lente **linear** |
| câmera IP (RTSP) | ✅ "Câmera IP (ponte local)": go2rtc ou MediaMTX num computador da arena (§5b); ou OBS Studio ("Câmera virtual") | Chrome; Safari/iPhone ainda não |
| câmera Wi-Fi de consumo / de ação | ❌ o vídeo Wi-Fi só abre no app da marca | usar por cabo (USB/HDMI) |
| Bluetooth | ❌ não transmite vídeo | — |

**Próximo passo e diagnóstico** (`domain/stationCheck.js`): no topo da tela
da câmera um cartão diz a UMA coisa a fazer agora, na ordem da quadra
(abrir a câmera → trocar de câmera, se abaixo do mínimo → marcar os pontos →
conferir com o 5º ponto → começar a analisar; câmera que mexeu ou erro acima
de 6 cm = marcar de novo), com o botão que faz. Embaixo, um selo por item
(câmera, calibração, fundo longe, análise, detector de pés, luz, bateria,
ligação com a central: ok / falta / atenção / resolver) e quanto a análise
de um quadro leva NESTE aparelho (`frameMs`; acima de 33 ms ele não acompanha
30 quadros/s). Ids de `STATION_NEXT` são só de tela.

**Menos toques**: câmera aberta sem pontos já entra na marcação; e quem volta
a uma posição já calibrada, com a câmera permitida para o site
(`navigator.permissions`), tem a MESMA câmera reaberta sozinha
(`linhas:camera:ultima:<posição>`, no aparelho; a chave sem posição vale de
reserva) — falta só "Começar a analisar".

**Câmera fixa lembra a calibração** (`domain/fixedCalib.js`): ao ficar pronta,
a calibração é guardada também por POSIÇÃO e por CÂMERA
(`linhas:calibracao:fixa:<posição>:<dev:id | ip:endereço | padrao>`), com a
"foto" dos pedaços em volta dos pontos (`cameraHealth.cutPatch`, ~1,5 kB, no
aparelho). Num dia de jogo NOVO, a câmera reabre sozinha e os pedaços são
procurados na imagem de agora (`restoreDecision`): no lugar → a calibração
volta inteira (`same`); deslocados → não volta e pede marcar de novo
(`moved`); não achados (luz, gente na frente) → volta SEM o 5º ponto, que é
pedido de novo (`unsure`, e nada é regravado até ele confirmar); outra
resolução → não volta (`size`). A tela diz qual dos quatro aconteceu.

**Várias câmeras na mesma tela** (`LineControlScreen`, `?posicao=a,b`, até 4):
"Mais uma câmera nesta tela" acrescenta a próxima posição livre; cada uma tem
"Tirar desta tela". Só a primeira fala os lances (`announce`), para a voz não
sair dobrada; todas mandam para a central. "Abrir em outra aba" continua.

**Webcam** (`domain/webcamTuning.js`, `WebcamTuning`): quando a câmera deixa
(`getCapabilities().exposureMode` com `manual`), botões de obturador
Automático · 1/250 · 1/500 · 1/1000 (`applyConstraints`, `exposureTime` em
unidades de 100 µs); e o selo "Chegando N quadros/s" pelo que o navegador
ENTREGOU (`track.stats.deliveredFrames`, Chrome), avisando quando ela anuncia
60 e entrega 30 (falta de luz). O erro `NotReadableError` agora explica a
segunda webcam na mesma porta USB.

**A central sabe que a câmera mexeu ou ficou escura**: o sinal de vida leva
`alert: 'moved' | 'dark'` (só enquanto analisa; regra `lcCam` aceita o campo,
o servidor do convidado só aceita esses dois valores) e o "Pronto para
começar?" (`readinessCheck`) trava na câmera que saiu do lugar e avisa a escura.

**Desempenho do aparelho que filma** (medido no código, não em campo): a bola
desenhada na tela é atualizada a no máximo ~12 vezes por segundo
(`BALL_UI_MS`) — antes o estado mudava a cada quadro e a tela inteira (lista
de lances com fotos incluída) era redesenhada 30–60 vezes por segundo,
disputando o processador com a análise; a análise segue quadro a quadro. Os
canvases da análise e do desenho só mudam de tamanho quando o vídeo muda
(redimensionar realoca a memória, 8 MB em Full HD), e `findBallCandidates`
reaproveita a máscara e calcula a cor sem criar um objeto por pixel.

**Requisitos mínimos** (`domain/cameraCheck.js`, conferidos com o que a câmera
ENTREGOU): 30 quadros/s e 720p (abaixo disso a tela recusa analisar); o bom é
**60 quadros e 1080p**. O selo "cm por pixel" no ponto mais longe deve ficar
≤ 3. A bola anda 10–25 m/s: a 30 quadros ela salta até 80 cm entre duas fotos.

## 5b. Câmera IP pela ponte local (`domain/ipCamera.js`, `openIpCamera`)

O navegador não fala RTSP. Uma **ponte** num computador da arena — a
[go2rtc](https://github.com/AlexxIT/go2rtc) (MIT, um executável) ou a MediaMTX —
recebe o RTSP da câmera e o entrega por WebRTC. Na tela da câmera, a opção
**"Câmera IP (ponte local)"** pede o endereço da ponte; `openIpCamera` faz a
oferta WebRTC só de receber (`POST` com `application/sdp`: o
`/api/webrtc?src=<câmera>` da go2rtc ou o `/<caminho>/whep` da MediaMTX) e
devolve um `MediaStream` comum. Calibração, motor, central, telão e voz não
mudam. A pesquisa que levou a isso (quem já faz, caminhos descartados,
câmera a comprar): Claude Doc "Câmeras IP e Wi-Fi no controle de linhas".

- **Zero banco.** O endereço da ponte fica no aparelho
  (`v2:view:<uid>:linhas:camera-ip:ponte`). `parseBridgeUrl` recusa endereço
  `rtsp://` (é o da câmera, não o da ponte) e usuário/senha no endereço: a
  credencial da câmera mora só no `go2rtc.yaml`, no computador da arena.
- **Quadros de verdade.** O que aparece nos selos (quadros/s e resolução) vem
  das estatísticas da conexão (`inbound-rtp`: `framesPerSecond`,
  `frameWidth/Height`) depois de 1,5 s, não do anúncio da câmera.
- **Navegadores.** No mesmo computador (`localhost`) o Chrome e o Edge abrem
  direto. Ponte em outro computador da rede (`http://192.168…`): o Chrome pede
  a permissão "Acesso à rede local" (o `fetch` vai com `targetAddressSpace:
  'local'`). Safari/iPhone bloqueiam `http` local a partir de página `https`
  — fica para quando a ponte tiver HTTPS.
- **Erros** ditos na tela: `ip-unreachable` (ponte fora do ar, permissão
  negada ou navegador que bloqueia), `ip-refused` (a ponte não conhece a
  câmera), `ip-no-video` (conectou e o vídeo não veio em 10 s).

**A página comanda a ponte** (`domain/bridgeDiscovery.js`,
`services/bridgeService.js`, `BridgeFinder`). Na opção "Câmera IP", "Achar a
câmera pela ponte (ou ligar a ponte)" fala com a go2rtc pela API dela, sem a
pessoa editar arquivo:

- **Ponte fora do ar, neste computador: UM comando.** A tela mostra o comando
  do sistema (`bridgeInstallCommand`) com botão de copiar — no Windows
  `irm <site>/ponte/instalar.ps1 | iex` (PowerShell), no Mac/Linux/Raspberry
  `curl -fsSL <site>/ponte/instalar.sh | sh`. Os scripts moram em
  `public/ponte/` (servidos como `text/plain`, sem cache — `firebase.json`) e
  fazem tudo: baixam a go2rtc da página oficial, criam o `go2rtc.yaml` mínimo
  **só se ainda não existe** (rodar de novo atualiza a go2rtc sem perder as
  câmeras), deixam a ponte ligando sozinha (tarefa ao entrar, `launchd`,
  `systemd --user`; sem systemd ela liga agora e o script diz como deixar
  automática) e a ligam. Sem administrador; no Windows só a go2rtc da pasta da
  ponte é parada. `bridgeInstaller.test.js` confere que os scripts criam a
  MESMA ponte mínima da tela, baixam os mesmos arquivos e são só ASCII. Ponte
  em OUTRO computador da rede e quem prefere à mão ("Prefiro fazer à mão")
  seguem o passo a passo abaixo.
- **Ponte fora do ar, passo a passo**: o download certo da go2rtc para o sistema
  (`guessBridgeOs`, `BRIDGE_DOWNLOADS`, página de versões oficial), o arquivo
  MÍNIMO (`go2rtcBaseConfig`: só `api.listen` e `origin: '*'`, sem câmera) e o
  **"liga sozinha"** (`bridgeAutostart`): no Windows um `.cmd` que registra a
  tarefa "PickleRush ponte" ao entrar (`schtasks /SC ONLOGON`, sem
  administrador); no Mac um `launchd` (`app.picklerush.ponte`, tira a
  quarentena); no Linux/Raspberry um serviço `systemd --user`. A tela confere
  a ponte a cada 3 s e segue sozinha quando ela abre.
- **Ponte no ar** (`GET /api/streams`): as câmeras que ela já tem viram botões
  "Usar …"; **"Procurar câmeras na rede"** (`GET /api/onvif`, descoberta
  ONVIF da própria go2rtc) lista as câmeras com nome e IP; com usuário e senha
  (`withOnvifCredentials`) a ponte devolve os perfis (`GET /api/onvif?src=`), o
  PRINCIPAL entra com o nome da quadra e da posição (`freeStreamName`, sem
  repetir) por `PUT /api/streams?name=&src=` — que a go2rtc também grava no
  `go2rtc.yaml` — e a câmera abre. Antes, `GET /api/streams?src=` diz o
  formato: **H.265 é avisado** (o navegador não toca) com o que trocar no site
  da câmera.
- Câmera sem ONVIF: o assistente de marca/IP/senha abaixo, que com a ponte no
  ar ganha **"Mandar para a ponte e abrir"** (o mesmo `PUT`, sem baixar arquivo).
- **Segurança**: a senha passa só deste navegador para a ponte (no computador
  da arena) e nunca vai ao banco nem à preferência; a página **nunca lê
  `/api/config`** (é onde a go2rtc guarda as senhas). Todo pedido declara
  `targetAddressSpace` (`loopback` ou `local`, Chrome — Local Network Access).
  A ponte mínima escuta em `127.0.0.1`: ninguém da rede a alcança.
- A go2rtc não foi executada neste ambiente (a sandbox não roda binários
  baixados); os formatos foram lidos do código da go2rtc 1.9 e estão nos
  testes de `bridgeDiscovery.test.js`. Conferir em campo.

**Assistente da ponte** (`go2rtcConfig` em `domain/ipCamera.js`,
`IpBridgeWizard`): "Câmera sem ONVIF: preencher marca, IP e senha à mão" pede,
por câmera, nome, marca (Intelbras, Hikvision,
Dahua/Amcrest, Reolink, TP-Link Tapo, ou o caminho do manual), IP, porta,
usuário e senha, e se a ponte roda neste computador ou em outro da rede. A
tela baixa o `go2rtc.yaml` pronto e "Usar esta câmera aqui" preenche o
endereço da ponte. Tudo no navegador: a senha vai **só para o arquivo
baixado** (a preferência `linhas:camera-ip:assistente` guarda marca, IP e
nome, nunca a senha). O arquivo já leva o que a montagem à mão esquecia:
`api.origin: '*'` (sem ele a go2rtc recusa o pedido que vem da página do
PickleRush — CORS — e a tela dizia "a ponte não respondeu"), `listen:
127.0.0.1:1984` quando a ponte é no mesmo computador (a rede da arena não
alcança) e usuário/senha escapados no endereço RTSP (`@`, `:` e `/` na senha
quebravam o endereço).

Montagem mínima à mão (go2rtc no mesmo computador):

```yaml
# go2rtc.yaml, ao lado do executável
api:
  listen: '127.0.0.1:1984'   # outro computador da rede: ':1984'
  origin: '*'                # obrigatório: a página do PickleRush chama a ponte de outro endereço
streams:
  quadra1: 'rtsp://usuario:senha@192.168.0.30:554/stream1'   # o fluxo PRINCIPAL da câmera
```

1. Baixe a go2rtc da página de versões do projeto e rode-a com esse arquivo.
2. Abra `http://localhost:1984` e confira a câmera tocando lá.
3. No PickleRush, no Chrome desse computador: posição → "Câmera IP (ponte
   local)" → `http://localhost:1984/api/webrtc?src=quadra1` → Abrir câmera.
4. Mais câmeras: "Mais uma câmera nesta tela" (ou "Abrir em outra aba").

Câmera boa para isso: RTSP + ONVIF, **H.264** (não H.265) no fluxo
principal, 1080p a 50–60 quadros (conferir com `ffprobe`: há câmera que
anuncia 60 e entrega 30 por RTSP/TCP), obturador manual ≤ 1/1000 s, sem
WDR nem redução de ruído digital, PoE por cabo, lente fixa 2,8–4 mm, NTP.

**Ainda não feito** (próximas etapas): juntar as câmeras pela hora da
captura (`captureTime` do `requestVideoFrameCallback`, que o Chrome calcula
pelos relatórios RTCP) em vez da hora de chegada; HTTPS na ponte para
tablet/iPhone; e a caixa nativa na quadra (60–120 quadros, modelo treinado).

## 5c. Câmera sem conta pelo QR (`lineGuestService.js`, `functions/lineGuest.js`)

Na central, em cada posição sem câmera, "Chamar um aparelho" tem dois jeitos:
**Com conta** (o link de sempre: o aparelho entra com uma conta que pode ser
câmera) e, para quem organiza, **Sem conta**: escolhe a validade (3, 6 ou
12 h), toca em "Gerar QR sem conta", e qualquer celular que ler o QR vira a
câmera DAQUELA posição, sem login — o aparelho extra na beira da quadra é de
qualquer um. "Cancelar este QR" apaga o convite e a câmera é recusada no
próximo sinal.

- O token (24 bytes aleatórios) vai só no **fragmento** do link
  (`/linhas/convidado#h=<quadra>&t=<token>`), que o navegador não manda a
  servidor nenhum nem fica em registro de acesso. O banco guarda
  `{quadra}/line_invites/{sha256(token)}` com `position`, `exp_ms` e
  `created_at`; a regra (`lcInv`) só deixa quem organiza a quadra criar, ler e
  apagar, e a validade não passa de 12 h.
- A página `/linhas/convidado` (`V2LineGuestCamera`, fora do layout do app,
  sem login) pergunta à função `lineGuest` se o QR vale (`peek`) e abre a
  MESMA estação de câmera (`CameraStation` com `sink`): o sinal e as marcações
  vão pela função (`beat`, `call`, `leave`), que confere convite, quadra
  ligada e flag a cada chamada e grava só os campos de `lcCam`/`lcCall`, na
  posição do convite, com `uid: guest_{16 do hash}` e nome "Convidado".
- Vencido, cancelado, quadra desligada ou flag desligada: a tela diz "Este QR
  não vale mais" (a mesma resposta para tudo). A calibração fica no aparelho,
  como na câmera com conta — e quem organiza pode calibrar pela central (§5d).
- Nada de pessoa é gravado: não entra na exclusão de conta. As câmeras e
  marcações do convidado saem quando quem organiza limpa a quadra.

## 5d. Calibrar pela central, câmera por câmera (`useRemoteCalibration`, `RemoteCalibration`)

Câmera presa no alto de um poste, atrás do vidro ou longe da beira da quadra
não se calibra pela tela dela. Então quem organiza calibra **na central**, uma
câmera por vez: em cada câmera no ar, **"Calibrar daqui"** abre, embaixo do
quadro das câmeras, a MESMA marcação do aparelho que filma
(`CalibrationMarker`: área vigiada, os quatro pontos com zoom, lupa e ajuste
fino, "Grudar na linha", 5º ponto e teste com a bola) sobre uma **foto** da
quadra que a câmera mandou. Depois, **"Mandar e começar a analisar"** (ou
"Só mandar a calibração"). Na linha da câmera calibrada, **"Começar a
analisar" / "Pausar"** também saem da central. No aparelho que filma basta
abrir a câmera e deixar a página aberta (a dica do passo 2 diz isso); quando a
calibração chega, ele avisa "A central calibrou esta câmera às …".

- **A foto**: a câmera manda uma foto (maior lado até 1600 px, JPEG) quando
  abre ainda sem calibração e sempre que a central pede ("Pedir imagem nova";
  ao abrir "Calibrar daqui" com foto ausente ou de mais de 2 min, o pedido sai
  sozinho). Os pontos são marcados em pixels da FOTO e vão em pixels do VÍDEO
  (`snapScale`); a câmera ainda reescala pela resolução que tem na hora
  (`remoteCalibFor`). A tela começa pelo que a câmera já tem (`cur`).
- **Quem faz o quê** (`domain/remoteCalib.js`, `cameraTodo`): a câmera aplica
  a calibração com `calib_ms` mais novo que a última aplicada (guardada junto
  da calibração do aparelho, `remoteMs`), pausa a análise para trocar os
  pontos, responde `applied_ms` e a central mostra "A câmera aplicou" (e o
  erro do 5º ponto, que chega pelo sinal da câmera). `run` só começa com a
  calibração pronta e a câmera acima do mínimo — a mesma trava do botão.
- **Privacidade**: é a única imagem que sai do aparelho. Só a câmera e quem
  organiza leem; toda escrita de quem organiza APAGA a foto (a regra exige);
  a câmera apaga o documento ao sair da página; entra na exclusão de conta.
- **Câmera sem conta** (§5c): o mesmo, pela função `lineGuest` (ação
  `calib`): grava a foto (só JPEG, abaixo do teto) e devolve o que quem
  organiza mandou; o aparelho pergunta a cada 4 s. `leave` apaga a foto.

## 5a. Montagens — "Como você vai montar?" (`domain/setupKits.js`, `SetupGuide`)

A entrada do controle de linhas mostra quatro kits, com passo a passo, prós e
limites, os arranjos que combinam ("Usar: …" para quem organiza) e o que ESTE
aparelho aguenta (`deviceProfile`: celular/tablet = uma câmera; computador pelo
`hardwareConcurrency`/`deviceMemory` — desconhecido fica conservador, 1). A
escolha fica no navegador (`v2:view:<uid>:linhas:kit`), **zero banco**. Os ids
dos kits são `basico`, `celulares`, `computador`, `estudio` — nunca renomeie.

| kit | para quem | câmeras | ligação |
|---|---|---|---|
| Um celular | dia a dia | 1 | o próprio aparelho |
| Vários celulares | clube e arena | 2–5 | cada celular analisa e só envia as marcações |
| Computador com câmeras | torneio | 1–4 | USB / placa de captura HDMI, uma aba por câmera |
| Estúdio com OBS | profissional | 1–5 | câmeras sem fio (NDI, SRT, RTSP) ou com fio no OBS → câmera virtual |

- **Chamar um aparelho** (`CameraInvite`, na central): cada posição vazia tem
  QR + link `/dia-de-jogo/:id/linhas?quadra=court-N&modo=camera&posicao=…` (o
  `qrcode` entra por import dinâmico) — o link já leva à quadra certa. Quem
  abre precisa de conta que pode ser câmera (participante ou quem organiza; a
  regra `lcGdCam` confere). Celular separado entra com a conta de quem organiza
  ou com uma conta incluída como participante.
- **Várias câmeras num computador**: "Abrir outra câmera neste computador"
  abre outra aba (cada aba = uma posição, o motor por aba). Aba escondida
  analisa mais devagar.
- **Fonte da câmera** (`cameraSource`, pelo nome que o sistema dá): OBS, NDI,
  celular sem fio (DroidCam, Iriun, Camo…), placa de captura, câmera da frente —
  cada uma com a dica certa (`CAMERA_SOURCE_TIP`) no passo 1.
- **OBS**: uma câmera virtual por instância; para várias, uma saída virtual por
  câmera (plug-in de câmera virtual múltipla ou "Webcam Input" das ferramentas
  NDI) ou uma cópia do OBS por câmera. Vídeo do OBS em 1080p **60** (o padrão é
  30). Sem fio: roteador só das câmeras, 5 GHz, perto da quadra.
- **Aviso na hora** (`domain/alertTones.js` + `services/alertSound.js`, em
  `useAnnounce`): um TOQUE pelo Web Audio sai alguns milissegundos depois do
  lance, antes da voz (que leva 200–500 ms): fora = dois agudos, falta de pé =
  zumbido grave, revisar = um médio; o "dentro" e o "sem falta" não tocam. O
  toque nasce LIGADO (`<pref>:som`), a voz desligada; os dois por pessoa no
  navegador. A vibração sai sempre. Junto, `CallFlash` pinta a tela inteira na
  cor do lance com a palavra enorme (câmera analisando e central), sem
  bloquear o toque.
- **Só a falta grita** (`callSpoken`): a voz diz "Fora", "Curta", "Rede",
  "Falta na cozinha", "Pé no saque", "Dois quiques"; dentro e sem falta ficam
  calados. **No aparelho que filma, "revisar" fica calado** (`useAnnounce(…,
  { quietReview: true })`, no `CameraStation`): bola que não está claramente
  fora segue em jogo (8.D), e um aviso no meio do ponto faria os jogadores
  pararem. A central (com quem organiza) toca o "revisar", e o telão mostra
  "Lance em revisão" — a decisão volta para a quadra sem parar o ponto.
- **Pronto para começar?** (`domain/readiness.js`, no topo da central): sem
  câmera, sem calibrar ou em pausa **bloqueiam** (a posição não julga);
  menos de 24 q/s, bateria ≤ 20% fora do carregador e erro do 5º ponto acima
  de 6 cm só **avisam**.
- **Telão** (`TelaoLineTicker` + `telaoLineStatus` em `fusion.js`): no canto,
  UM aviso por quadra ligada, com o nome da quadra na frente — faixa fixa
  "Controle de linhas ativo · N câmera(s)" ou quais posições pararam; "Lance em
  revisão" enquanto a manchete é "revisar" sem decisão (até 90 s,
  `REVIEW_HOLD_MS`); o lance grande por 12 s. As quadras são relidas a cada
  30 s; o `game_days.line_control` antigo é ignorado.

## 6. Precisão — o que é viável e o que NÃO é

O motor nunca inventa: toda medida sai com incerteza, e quando a distância à
linha é menor que ela, ele diz **Revisar**.

- **Fora/dentro com margem — viável com uma câmera**; com duas ou mais a faixa
  de "revisar" encolhe (a melhor câmera mede, e a discordância vira revisar).
  A incerteza é POR EIXO: a câmera da rede tem a palavra nas linhas da cozinha,
  a de fundo na central e nas laterais (a melhor vista de uma linha corre ao
  longo dela, como o juiz de linha sentado no prolongamento).
- **Saque — viável.** O 1º quique do saque vale contra a área em diagonal; a
  cozinha inteira, com a linha, é CURTA; na linha de fundo, na lateral ou na
  central da área é dentro (7.E). Câmera de lado que não vê quem saca sabe de
  que lado saiu, mas não a diagonal: julga curta, longa e lateral, não "área
  errada".
- **Pé na cozinha no voleio — viável, com limites.** Só pé **apoiado** (parado
  por três quadros) e visível conta; pé no ar, escondido ou perto da linha
  dentro da incerteza → **Revisar o pé**. A lateral da rede é quem melhor vê.
  O impulso é observado até a pessoa parar de ir para a cozinha (parada ou
  andando de lado por `balanceS`) ou recuar — de 0,5 s a 2 s —, mesmo com a bola
  morta. Quem saiu da cozinha e está parado DENTRO da incerteza da linha não
  leva "falta de reentrada" certa: é revisar (11.A.3).
- **Pé no saque — viável com a câmera do fundo de quem saca.** No instante da
  batida, ao menos um pé apoiado atrás da linha de fundo, sem tocá-la, e entre
  os prolongamentos da lateral e da central. Os dois pés no ar → revisar.
- **O 1º quique escondido pela rede.** Da câmera de fundo, o chão logo depois
  da rede fica atrás dela. Quando há sinal de um quique ali desde o último lance
  (a quina com cara de quique atrás da fita, ou a bola sumida mais de 0,12 s
  na FAIXA DA REDE — descendo até a fita ou voltando rente a ela, `netBandM`;
  perdê-la no ar perto de quem bateu não conta; sumida mais de 0,25 s e de volta
  fora do rumo que levava — na mão, no bolso —, é bola nova e o buraco conta;
  a que só passou atrás de um corpo volta no rumo, `onCourse`. O rumo é uma
  reta na imagem: o lob escondido perto do alto da curva, ou a bola escondida
  logo na batida, pode não "voltar no rumo" — o "fora" longo dela sai
  **revisar**, nunca o contrário; medido, ~2% das bolas escondidas), o quique seguinte pode ser o 2º, que não se julga (10.B.1):
  "fora" vira **revisar**.
- **Entre um ponto e outro não há marcação (7.D.4).** A bola devolvida a quem
  vai sacar sai da mão de alguém atrás do fundo, como um saque. Depois de um
  ponto, o saque só vale na hora com a **formação** à vista (4.B, `serveFormation`):
  ninguém do lado de quem saca a menos de cozinha + 1 m da rede e quem recebe
  no fundo de lá, em diagonal. Com alguém do lado de quem saca perto da rede
  (pé à vista, ou só o punho caindo na sombra da rede), nada é marcado até a 3ª
  bola; sem ver ninguém (câmera de cima, detector carregando), ou sem ver quem
  recebe (a câmera da rede, que só pega o parceiro dele na cozinha), falta e
  fora no saque viram **revisar** e "dentro" não se diz, até a devolução. O
  saque de verdade logo depois (bola parada na mão de quem está atrás do fundo)
  recomeça o ponto. Limites: a câmera de cima (`solo_topo`) não vê quem recebe,
  então o 1º saque depois de cada ponto é sempre "revisar" quando sai; com o
  parceiro de quem saca colado na rede (formação de quem joga só do fundo não
  existe no pickleball, mas acontece no simples e no treino) o saque fica calado
  até a 3ª bola; e a devolução feita por quem está na formação ainda é julgada.
- **Dois quiques — só com a troca inteira à vista.** Se uma batida do outro
  lado passou sem ser vista, o motor deixa de julgar a regra até o próximo
  saque (sem a sequência não se sabe qual é a 2ª e qual a 3ª bola).
- **Bola exatamente na linha (milímetro, nível Hawk-Eye) — não é viável no
  navegador.** Exige câmeras sincronizadas a 240+ quadros e triangulação 3D.
- **Detecção da bola sem modelo treinado**: cor + movimento; perde a bola com
  sombra forte, contra luz ou atrás do jogador. O ganho real é um TrackNet
  (MIT) treinado com vídeo de pickleball — só `findBallCandidates` muda.
  Entre os candidatos, vence o mais perto de onde a bola DEVE estar pelo rumo
  dos dois últimos quadros (`predictNext`), aceitando também o que está perto
  de onde ela estava (no quique e na batida ela volta): camisa amarela ou bola
  da quadra vizinha perto da última posição não roubam mais o rastro.
- **Quem ganhou o ponto** não é marcado, nem o placar.
- **Nada disto foi testado em quadra.** As medidas vêm de testes sintéticos
  (`lineCallScenarios.test.js` sobre o simulador `testkit/courtSim.js`, que
  filma pontos inteiros com a projeção de câmeras reais); a primeira rodada
  real deve conferir `ENGINE_DEFAULTS` e o tom de cor da bola.

## 7. Como o motor decide (`domain/lineCallEngine.js`)

O cabeçalho de `lineCallEngine.js` é a explicação completa; em resumo:

- **O ponto, do saque ao fim.** O motor sabe em que parte do ponto está: o
  SAQUE é a batida de quem está atrás da linha de fundo com a bola perto dela;
  depois, em cada batida, só o 1º quique é julgado (contra a metade do OUTRO
  lado); o 2º quique encerra o ponto sem marcação; bola que cai do lado de quem
  bateu é REDE se cair logo; ponto encerrado não é julgado até o próximo
  saque; quique antes do saque nunca é marcação.
- **Quique ou batida.** As duas mudanças bruscas de direção da bola. Na câmera
  de lado, batida é a bola que volta para o lado de onde veio; na de fundo,
  altura e profundidade se misturam, e o motor ESPERA o lance seguinte
  (`resolveS`) para saber qual foi. Bola que cai ao pé de quem acabou de bater
  encerra o ponto SEM marcação: pode ter batido no corpo (10.C.3), e "fora"
  daria o ponto ao time errado.
- **Altura.** Com o tamanho da imagem o motor acha ONDE a câmera está
  (`estimateCamera`, `homography.js`) e corrige o que não está no chão — o
  centro da bola no quique e os pontos do pé —, que projetados no chão cairiam
  até 15 cm longe demais. E sabe o que a REDE esconde (`netHides`): da câmera
  de fundo, o chão da cozinha do outro lado não aparece.
- **Incerteza.** Toda medida sai com a incerteza em cada eixo (pixel no chão,
  instante do quique, calibração, correção de altura). Margem menor que a
  incerteza é REVISAR; revisar sem decisão vale DENTRO (8.D).
- Modo **overhead** (câmera de cima): o quique é o PULO da velocidade aparente
  para fora; a batida inverte o rumo ou parece parar (§2).

Ajustes em `ENGINE_DEFAULTS` — botões de calibração do mundo real.

## 7a. Confiança — o que a pessoa vê

- **Marcar com zoom, controles sobre a imagem** (`CalibrationView`,
  `zoomMath.js`): pinça com dois dedos (que também arrasta), roda do mouse e
  botões + e − (até 8×), mãozinha para arrastar com um dedo, tela cheia e
  "esconder os controles". O zoom é só da TELA (`translate + scale` em volta do
  vídeo e do desenho): os pontos ficam guardados em pixels do VÍDEO, então dar
  ou tirar zoom não mexe em ponto nenhum. O ponto é um anel com um pingo (a
  linha embaixo segue à vista) e o traço afina com o zoom. A dica fica numa
  faixa em cima, os botões da marcação embaixo, o zoom na lateral e o mapa
  pequeno no canto. Em janela estreita (celular em pé, < 560 px) a dica e os
  botões descem para logo abaixo da imagem e nela ficam só o zoom e a tela
  cheia.
- **Área vigiada** (`domain/zones.js`): cada câmera escolhe a quadra inteira
  ou uma parte — lado A/B inteiro, fundo A/B, as duas cozinhas, cozinha A/B.
  Com uma parte, a pessoa marca os quatro cantos DELA (o retângulo pintado
  mais próximo; para um lado ou uma cozinha entram `N1`/`N2`, onde a rede
  cruza a lateral) e o 5º ponto é o da parte (`TA`/`TB`/`KTA`/`KTB`). A câmera
  só marca o lance da área (`eventInZone`): o quique pelo ponto onde caiu
  (borda de fundo aberta para fora, as outras com 30 cm de folga), o pé na
  cozinha só se a área cobre aquela cozinha, o pé no saque só se ela chega
  àquela linha de fundo, e lance sem ponto conhecido fica. Fora da área ela
  fica calada — nada vai para a central. A área mora na calibração do aparelho
  (`calib.zone`, ausente = quadra inteira, igual a antes); zero banco. Os ids
  das áreas e dos pontos são contrato: nunca renomeie.
- **Calibração com prova**: lupa ao tocar (4×), "Ajustar os pontos" (arrastar),
  e o **5º ponto** (`domain/calibrationCheck.js`: o "T" da central com a
  cozinha) mede o erro em cm — até 3 ótimo, até 6 bom, acima refazer. O erro vai
  para a central (`check_cm`).
- **Testar com a bola**: tocar na bola parada mostra a quantos cm da linha a
  calibração a coloca (`nearestBoundary`, `court.js`).
- **Bola na linha é dentro**: a margem é medida até a borda da MARCA da bola
  (`contactPatchM`, 1 cm, em `ENGINE_DEFAULTS`).
- **Replay** (`domain/replay.js`, `LanceReplay`): fita de 3,5 s (`RING_S`: o
  maior atraso do motor, 2 s, mais o "antes" e folga) — os últimos 2,4 s a até
  60 quadros/s e os mais velhos a 30, no máximo 199 quadros na memória; cada
  marcação guarda de 1,2 s antes a 0,6 s depois (o voleio que só sai quando o
  impulso acaba ainda acha o seu "antes"), com o rastro da bola e a marca
  ampliada (`CourtMark`), câmera lenta até 0,1×, quadro a quadro (← → espaço).
  Só no aparelho, os 12 mais recentes.
- **Palavra final** de quem organiza na central (regra acima), **voz**
  ("Falar o lance", `useAnnounce`: fala + vibração, preferência por pessoa;
  só a falta é dita, §5a), **telão** (`TelaoLineTicker`, a manchete de cada
  quadra ligada por 12 s, só com a flag), **planilha** CSV da quadra
  (`domain/report.js`, com o motivo de cada lance), **bateria** e quadros/s
  por câmera com aviso.
- **A marca do lance** (`CourtMark`, no replay e na central): o quique de jogo
  mostra a linha mais perto; o de saque curto, de área errada e de rede mostra
  a linha do motivo; o pé no saque usa o desenho do pé, "além" ou "antes" da
  linha de fundo, da lateral ou da central. A tinta da linha fica do lado de
  quem é dono dela: no saque curto a linha da cozinha é FORA, e no pé no saque
  os prolongamentos da lateral e da central são legais — a margem é medida da
  borda certa, e a marca não põe a bola na linha quando ela passou dela.
- **Grudar na linha** (`domain/snapCorner.js`): leva os quatro cantos da QUADRA
  ao canto externo do "L" branco perto do toque (a linha é dentro, a quadra
  acaba na borda de fora). Janela de 14 px; sem branco suficiente, branco demais
  ou o L saindo da janela, o ponto não anda. As pontas da cozinha não mexem.
  Tem "Desfazer" e quem confere é o 5º ponto.
- **A câmera saiu do lugar?** (`domain/cameraHealth.js`): ao calibrar, guarda
  pedacinhos da imagem em volta de cada canto; a cada 1 s procura onde eles
  estão (±10 px). Com 2+ achados e deslocamento mediano ≥ 3 px, aviso em
  vermelho (voz e vibração) e **todo lance vira "Revisar"** com `moved: true`
  até marcar os pontos de novo. Canto coberto por alguém não decide. Pouca luz
  (brilho médio < 55) dá aviso. **Sol ou reflexo** (15% ou mais da imagem
  estourada, tom ≥ 250) também avisa, no aparelho e na central (`alert:
  'glare'`, só aviso, não trava): é o inimigo nº 1 fora de quadra coberta.
  Nada novo no banco: "revisar" já existia e `alert` já era livre na regra.
- Dois guias de dicas (`controle-de-linhas-camera`, `controle-de-linhas-central`,
  atrás da flag) apontam os botões reais (`data-dica="linhas-…"`).

## 8. Fora deste PR

1. Treinar um TrackNet com vídeo de pickleball (CVAT + SAM 2) e rodar com
   `onnxruntime-web`.
2. Software externo (câmeras sincronizadas) só se for preciso decidir a bola NA linha.

O repositório `pickleball-nivelamento` (questionário de nível) não tem nada de
câmera; a integração com ele não se aplica a esta funcionalidade.

## 9. Torneio — por quadra (`domain/tournamentLine.js`, `V2TournamentLineControl`)

No torneio o controle é da QUADRA, não da partida: a câmera fica montada na
quadra e as partidas passam por ela. `/torneios/:id/linhas` lista as quadras
do agendamento (`court-1`…, o maior `court_count` das modalidades, mais as
que já têm documento) no MESMO `LineCourtsBoard` do dia de jogo (liga/desliga,
arranjo, Ligar em todas as quadras — gravadas por `saveTournamentLineCourts`,
uma escrita por quadra) e `?quadra=court-N` abre a MESMA tela do dia de jogo
(`LineControlScreen`: arranjo, câmera, central, convite por QR). Quem não é da
equipe vê só as quadras ligadas. Na gestão do torneio, botão "Controle de
linhas" (só com a flag).

- **Quem liga e configura**: a equipe do torneio — criador, administrador do
  torneio (`tournament_admins`), gestor da arena sede e o admin da plataforma
  (`tLineOrg` na regra).
- **Quem é câmera**: só a equipe do torneio, em nome próprio, com a quadra
  ligada (`tLineCamOk`). Quem joga não filma pela própria conta — o aparelho da
  câmera entra com a conta de quem organiza. Qualquer conta logada acompanha a
  central.
- **Banco**: `tournament_line_courts/{torneio}_{quadra}` (`tournament_id`,
  `court_id`, `court_name`, `line_control`, `line_control_layout`,
  `updated_by`, `updated_at`) com as mesmas subcoleções `line_cams`/
  `line_calls`. Os serviços recebem o "anfitrião" (`hostPath`): id de dia de
  jogo ou o caminho da quadra. Na exclusão de conta, as câmeras e marcações da
  pessoa saem de toda quadra de torneio pela mesma busca por grupo de coleção
  do dia de jogo (`coletarLinhas`, §4) — inclusive de quem já saiu da equipe.
  A lista de quadras do torneio é uma igualdade só (zero índice composto).
- **Telão do torneio** (`/torneios/:id/telao`): `TournamentTelaoLines` (em
  `TelaoLineTicker.jsx`) põe no canto um aviso por quadra ligada — câmeras no
  ar, "Lance em revisão" e o último lance —, com o nome da quadra na frente.
  Relê as quadras a cada 30 s. A leitura pede conta logada: sem conta ou com
  falha, não aparece nada e o quadro dos jogos segue igual. 🐞 O quadro dos
  jogos dizia "Quadra Quadra 2" (o agendamento grava o NOME em `court` e o
  número em `court_index`) e não ordenava as partidas em andamento por quadra
  (`Number('Quadra 2')` é NaN): hoje `courtLabel` e `categorizeBoardMatches`
  leem `court_index`.
- Prova no emulador: `tests/rules/tournamentLineControl.rules.test.js`.

Evitar no produto: Ultralytics/YOLOv8+ (AGPL-3.0) e repositórios sem licença.

## 10. As regras do jogo e o que a câmera julga

As regras são as da **USA Pickleball 2026** (a CBP segue as mesmas); o número
entre parênteses é o da regra. O motor cita o número junto do código que a
aplica. "Revisar" é sempre a saída quando a câmera não tem certeza — e revisar
sem decisão vale **dentro / sem falta** (8.D: a dúvida é de quem recebe a
marcação).

| regra | o que diz | como o motor aplica | o que fica com quem organiza |
|---|---|---|---|
| Bola na linha (8.B, 8.C) | tocar a linha é dentro — exceto a linha da cozinha no saque | a margem vai até a BORDA da marca da bola (`contactPatchM`, 1 cm); só o ponto de contato com o chão conta (8.E) | bola na linha com precisão de milímetro |
| Fora (8.D) | quem não tem certeza diz dentro | margem menor que a incerteza ⇒ revisar; revisar sem decisão vale dentro | a palavra final, na central |
| Saque na área certa (7.E) | o saque passa a rede e cai na área em diagonal, além da cozinha; a cozinha e a linha dela são CURTA | o 1º quique do saque contra a área em diagonal (`wrong_box`) e a cozinha (`short`) | saque que toca quem recebe antes de quicar (7.E.5) |
| Quique antes do saque (7.D.4) | quicar a bola para sacar não é jogada | nunca é marcação | — |
| Pé no saque (7.A) | no instante da batida, ao menos um pé no chão atrás da linha de fundo, sem tocá-la, entre os prolongamentos da lateral e da central | `serve_foot`: `baseline`, `sideline`, `centerline`; os dois pés no ar (`airborne`) ⇒ revisar | o movimento do saque (braço, altura do contato) e o saque com quique |
| Dois quiques (10.A) | a devolução do saque e a 3ª bola têm de quicar | `two_bounce`: `return` / `third`, só com a troca inteira à vista; outra câmera desmente | — |
| Bola no corpo (10.C.3) | a bola que toca o jogador é falta DELE | bola que cai ao pé de quem bateu encerra o ponto SEM marcação | quem foi atingido |
| Pé na cozinha no voleio (11.A) | voleio com pé na cozinha ou na linha dela é falta | `volley` / `contact`: só pé APOIADO e visível | raquete, mão, roupa ou parceiro tocando a cozinha (11.A.1) |
| O impulso (11.A.2) | a falta vale se o impulso do voleio leva à cozinha, mesmo com a bola morta (9.B.1) | `momentum`: observa até a pessoa parar ou recuar (0,5–3 s) | — |
| Sair da cozinha (11.A.3) | quem estava na cozinha precisa firmar os dois pés fora antes de volear | `reentry` | — |
| Objeto na cozinha (10.J) | o que cai da pessoa na cozinha durante o voleio é falta | não é seguido | quem organiza |

**Por que "revisar" fica calado no aparelho que filma.** A câmera de quadra fica
no tripé ao lado dos jogadores: um "revisar" em voz alta no meio do ponto faria
todos pararem — e a bola que não está claramente fora segue em jogo (8.D). A
câmera só GRITA a falta; o revisar vai para a central e para o telão, e quem
organiza decide com o replay.

**Quem decide.** A câmera marca; a palavra final é de quem organiza (criador,
nomeado, gestor da arena, admin do clube; no torneio, a equipe do torneio), na
central da quadra, gravada no lance (`decision`). Nada muda sozinho no placar.
