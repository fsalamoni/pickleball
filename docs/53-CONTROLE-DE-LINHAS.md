# 53 — Controle de linhas por câmera

> Flag `line_control` (default OFF, só o admin liga em Painel admin →
> Funcionalidades → Dia de jogo). Módulo `src/modules/linecall/`.
> Estado: **no navegador, de 1 a 5 câmeras** (2026-11-03). A pesquisa de
> origem está em https://claude.ai/artifact/1AR6uPgAbzy8A2CLs2v2sE.

## 1. O que faz

Com a flag ligada, quem **organiza** o jogo — criador, gestor da arena, admin do
clube e o **administrador nomeado** do jogo (`canConfigureLineControl`,
`useGameDayRoles().podeConfigurarLinhas`; a regra tem uma cláusula estreita para
o nomeado: só `line_control`/`line_control_layout`) — vê o cartão **Controle de
linhas por câmera** dentro do `GameDayModule` (as três origens por construção):

- liga/desliga **neste jogo** — vale com o jogo em andamento;
- **Ligar em todos os meus jogos** / **Desligar em todos** — os dias que a
  pessoa criou, de hoje em diante (`lineControlTargets`), num lote só;
- **Abrir câmera** e **Abrir central** → `/dia-de-jogo/:id/linhas?modo=camera|central`
  (`V2LineControl`), em outra aba. Com o controle ligado, os dois botões
  aparecem para **todos** que veem o dia; ser câmera exige participar ou
  organizar (a regra confere).

| evento | resultado |
|---|---|
| quique | **Dentro** · **Fora** · **Revisar** — com a distância à linha e a incerteza (± cm) |
| voleio | **Falta: pé na cozinha** · **Voleio sem falta** · **Revisar o pé** |

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
`game_days.line_control_layout`): **nunca renomeie** (há teste travando).

Os **11 arranjos** (quem organiza escolhe; padrão `solo_fundo`):

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

Cada aparelho roda o próprio motor e grava cada marcação em
`game_days/{id}/line_calls`. Não há sincronia de quadros (o navegador não
consegue — isso exigiria aplicativo nativo do tipo *recsync*); a **central**
junta as marcações por **janela de tempo**:

- mesmo tipo de evento a até **700 ms**, no máximo uma marcação por posição;
- quique a até **1,5 m** um do outro; voleio do mesmo lado da quadra;
- **veredito:** as câmeras confiantes (que não disseram "revisar") que
  concordam decidem; se discordam, **Revisar** com "as câmeras discordaram";
- no voleio, votam só as câmeras com o maior peso de pé presentes;
- a medida mostrada é a da melhor câmera (menor incerteza ÷ peso).

A presença de cada câmera é `game_days/{id}/line_cams/{uid}_{posição}`,
renovada a cada 15 s (online = visto há ≤ 45 s) e apagada ao sair da tela.
A central (`LineCentral`) mostra o arranjo, quem está em cada posição
(analisando / calibrada / falta calibrar / sem câmera, quadros/s), o último
lance em letras grandes e os anteriores; quem organiza pode **Limpar
marcações** (confirmação em dois toques).

## 4. O que é gravado

- `game_days.line_control` (opcional) e `game_days.line_control_layout`
  (opcional, id do arranjo; ausente = `solo_fundo`).
- `game_days/{id}/line_cams/{uid}_{posição}`: `uid, name, position, layout,
  calibrated, analyzing, fps, seen_ms, updated_at` + opcionais `battery`
  (0–1), `charging`, `check_cm` (erro da conferência pelo 5º ponto).
- `game_days/{id}/line_calls/{auto}`: `uid, position, kind (bounce|volley),
  call (in|out|review|fault|clean), t_ms, margin_m, uncertainty_m, depth_m, x,
  y, created_at` + opcional `serve: true` (quique de saque). **Nunca imagem.**
  Quem organiza grava a **palavra final** no primeiro documento do lance:
  `decision` (`in|out` no quique, `fault|clean` no voleio), `decided_by` (ele
  mesmo) e `decided_ms` — e nada mais; o que a câmera marcou não muda.

**Regra** (`firestore.rules`, dentro de `game_days`; `lineCamOk`/`lineOrgOf`;
emulador em `tests/rules/lineControl.rules.test.js`): lê quem lê o dia; grava
só com `line_control == true` naquele dia, em nome próprio, e só quem está em
`member_uids`, é administrador nomeado ou organiza; marcação não se edita (só a decisão de quem organiza, acima);
apagar é do dono (câmera) ou de quem organiza. **Exclusão de conta** apaga as
câmeras e marcações da pessoa (`coletarDiasDeJogo`, `functions/accountDeletion.js`).

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
  QR + link `/dia-de-jogo/:id/linhas?modo=camera&posicao=…` (o `qrcode` entra
  por import dinâmico). Quem abre precisa de conta que pode ser câmera
  (participante ou quem organiza) — a regra `lineCamOk` não mudou. Celular
  separado entra com a conta de quem organiza ou com uma conta incluída como
  participante.
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
  zumbido grave, revisar = um médio; o "dentro" não toca. O toque nasce LIGADO
  (`<pref>:som`), a voz desligada; os dois por pessoa no navegador. A vibração
  sai sempre. Junto, `CallFlash` pinta a tela inteira na cor do lance com a
  palavra enorme (câmera analisando e central), sem bloquear o toque.
- **Pronto para começar?** (`domain/readiness.js`, no topo da central): sem
  câmera, sem calibrar ou em pausa **bloqueiam** (a posição não julga);
  menos de 24 q/s, bateria ≤ 20% fora do carregador e erro do 5º ponto acima
  de 6 cm só **avisam**.
- **Telão** (`TelaoLineTicker` + `telaoLineStatus` em `fusion.js`): faixa fixa
  "Controle de linhas ativo · N câmera(s)" ou quais posições pararam; "Lance em
  revisão" enquanto o último lance é "revisar" sem decisão (até 90 s,
  `REVIEW_HOLD_MS`); o lance grande por 12 s.

## 6. Precisão — o que é viável e o que NÃO é

O motor nunca inventa: toda medida sai com incerteza, e quando a distância à
linha é menor que ela, ele diz **Revisar**.

- **Fora/dentro com margem — viável com uma câmera**; com duas ou mais a faixa
  de "revisar" encolhe (a melhor câmera mede, e a discordância vira revisar).
- **Pé na cozinha no voleio — viável, com limites.** Só pé **apoiado** conta;
  pé no ar, escondido ou a ±7 cm da linha → **Revisar o pé**. A lateral da
  rede é quem melhor vê.
- **Bola exatamente na linha (milímetro, nível Hawk-Eye) — não é viável no
  navegador.** Exige câmeras sincronizadas a 240+ quadros e triangulação 3D.
- **Detecção da bola sem modelo treinado**: cor + movimento; perde a bola com
  sombra forte, contra luz ou atrás do jogador. O ganho real é um TrackNet
  (MIT) treinado com vídeo de pickleball — só `findBallCandidates` muda.
- **Saque**: com o detector de pés, a primeira batida do ponto é o saque e o
  primeiro quique é julgado pela área de saque em diagonal (linha da cozinha =
  fora; linha central = dentro). Sem pés, é julgado como bola comum.
- **Quem ganhou o ponto** não é marcado.
- **Nada disto foi testado em quadra.** As medidas vêm de testes sintéticos;
  a primeira rodada real deve conferir `ENGINE_DEFAULTS` e o tom de cor da bola.

## 7. Como o motor decide (`domain/lineCallEngine.js`)

Modo **imagem**: quique e batida são as mudanças bruscas de direção na imagem;
colada a um punho (≤ 90 px) é batida; descendo → subindo é quique; o ponto é a
interseção das duas trajetórias, levado ao chão pela homografia. Modo
**overhead**: o mesmo em metros da quadra, pela desaceleração (§2). Batida sem
quique desde a anterior = **voleio**, com o ponto dos pés de quem bateu.
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
- **Replay** (`domain/replay.js`, `LanceReplay`): anel de quadros de 2,4 s; cada
  marcação guarda de 1,2 s antes a 0,6 s depois, com o rastro da bola e a marca
  ampliada (`CourtMark`), câmera lenta até 0,1×, quadro a quadro (← → espaço).
  Só no aparelho, os 12 mais recentes.
- **Palavra final** de quem organiza na central (regra acima), **voz**
  ("Falar o lance", `useAnnounce`: fala + vibração, preferência por pessoa),
  **telão** (`TelaoLineTicker`, o último lance por 12 s, só com a flag e o
  controle ligado no dia), **planilha** CSV do jogo (`domain/report.js`),
  **bateria** e quadros/s por câmera com aviso.
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
que já têm documento) e `?quadra=court-N` abre a MESMA tela do dia de jogo
(`LineControlScreen`: arranjo, câmera, central, convite por QR). Na gestão do
torneio, botão "Controle de linhas" (só com a flag).

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
  pessoa nas quadras dos torneios que ela administra são apagadas
  (`coletarLinhasDeTorneio`). Zero índice (uma igualdade).
- **Telão do torneio** (`/torneios/:id/telao`): `TournamentTelaoLines` (em
  `TelaoLineTicker.jsx`) põe no canto um aviso por quadra ligada — câmeras no
  ar, "Lance em revisão" e o último lance —, com o nome da quadra na frente.
  Relê as quadras a cada 30 s. A leitura pede conta logada: sem conta ou com
  falha, não aparece nada e o quadro dos jogos segue igual.
- Prova no emulador: `tests/rules/tournamentLineControl.rules.test.js`.

Evitar no produto: Ultralytics/YOLOv8+ (AGPL-3.0) e repositórios sem licença.
