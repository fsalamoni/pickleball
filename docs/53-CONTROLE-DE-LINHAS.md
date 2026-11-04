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
construção). O cartão é o `LineCourtsBoard`, o MESMO quadro da página de linhas
do dia e da do torneio:

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
e as fotos das marcações ficam **no aparelho**. Imagem de atleta não sai do
celular (sem questão de LGPD sobre vídeo de terceiros).

## 5. Guia de uso por aparelho

O guia completo para quem usa está no Claude Doc "Guia do controle de linhas" e,
resumido, na Central de Ajuda (`controle-de-linhas`, atrás da flag) e dentro da
própria tela ("Como posicionar esta câmera", `PlacementGuide` + `DeviceTips`).

| aparelho | como entra | cuidado |
|---|---|---|
| celular/tablet | o próprio aparelho, câmera traseira, no Chrome (Android) ou Safari (iPhone) | horizontal, tripé, na tomada; a grande-angular (0,5×) aparece na lista — usar só se a quadra não couber |
| webcam USB | notebook; uma câmera por aba | 60 quadros/1080p; extensão USB ativa para chegar ao alto |
| câmera de ação | modo webcam por USB (GoPro Hero 8+, DJI Osmo Action 3+) ou HDMI + placa de captura | lente **linear** |
| câmera Wi-Fi/IP (RTSP) | ❌ direto no navegador; ✅ pelo OBS Studio ("Câmera virtual") ou go2rtc | software fora do PickleRush |
| Bluetooth | ❌ não transmite vídeo | — |

**Requisitos mínimos** (`domain/cameraCheck.js`, conferidos com o que a câmera
ENTREGOU): 30 quadros/s e 720p (abaixo disso a tela recusa analisar); o bom é
**60 quadros e 1080p**. O selo "cm por pixel" no ponto mais longe deve ficar
≤ 3. A bola anda 10–25 m/s: a 30 quadros ela salta até 80 cm entre duas fotos.

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
  a que só passou atrás de um corpo volta no rumo, `onCourse`), o quique seguinte pode ser o 2º, que não se julga (10.B.1):
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
  (brilho médio < 55) dá aviso. Nada novo no banco: "revisar" já existia.
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
