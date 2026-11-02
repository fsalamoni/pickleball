# 53 — Controle de linhas por câmera

> Flag `line_control` (default OFF, só o admin liga em Painel admin →
> Funcionalidades → Dia de jogo). Módulo `src/modules/linecall/`.
> Estado: **MVP no navegador** (2026-11-02). A pesquisa de origem está em
> https://claude.ai/artifact/1AR6uPgAbzy8A2CLs2v2sE.

## 1. O que faz

Com a flag ligada, quem **configura** um dia de jogo (criador, gestor da arena,
admin do clube — `useGameDayRoles().podeConfigurar`) vê o cartão **Controle de
linhas por câmera** dentro do `GameDayModule` (as três origens por construção):

- liga/desliga **neste jogo** — vale com o jogo em andamento, não depende de
  status nem de partida;
- **Ligar em todos os meus jogos** / **Desligar em todos** — os dias que a
  pessoa criou, de hoje em diante (`lineControlTargets`), num lote só
  (`setGameDaysLineControl`);
- **Abrir câmera** → `/dia-de-jogo/:id/linhas` (`V2LineControl`), em outra
  aba, no aparelho que filma.

Na tela da câmera: escolher a câmera → **marcar os quatro cantos** da quadra
(fundo de lá esq./dir., fundo de cá dir./esq.) → conferir as linhas desenhadas
por cima → **ensinar a cor da bola** (toque nela) → **Começar a analisar**. Cada
marcação aparece com a foto do momento:

| evento | resultado |
|---|---|
| quique | **Dentro** · **Fora** · **Revisar** — com a distância à linha e a incerteza (± cm) |
| voleio | **Falta: pé na cozinha** · **Voleio sem falta** · **Revisar o pé** |

Para quem não configura, o cartão só aparece (como aviso) se o controle está
ligado.

## 2. O que é gravado

**Só** `game_days.line_control` (opcional, `true|false`). Zero coleção, zero
índice, zero regra nova: a regra de `game_days` já deixa criador, gestor da
arena/clube e admin editar o documento. Vídeo, calibração (cantos + cor da
bola, `v2:view:<uid>:linhas:calibracao:<gameDayId>`) e marcações ficam **no
aparelho** — nada é gravado nem enviado. Imagem de atleta não sai do celular,
o que também evita a questão de LGPD sobre vídeo de terceiros.

## 3. O que roda no navegador e o que não roda

| peça | onde roda | origem |
|---|---|---|
| câmera | navegador (`getUserMedia`) | nativo |
| homografia quadra ⇄ imagem | navegador, JS puro (`domain/homography.js`) | o cálculo do `cv2.getPerspectiveTransform` (OpenCV), reescrito em 60 linhas em vez de 8 MB de OpenCV.js |
| bola | navegador, cor + movimento (`domain/ballDetection.js`) | visão clássica |
| pés e punhos | navegador, WebAssembly/GPU | **MediaPipe Pose Landmarker** (Google, Apache-2.0), `@mediapipe/tasks-vision` 1.2.0; motor do jsDelivr e modelo `pose_landmarker_lite` do repositório oficial, versões fixas em `services/poseService.js`, carregados só ao analisar |
| decisão | navegador, puro (`domain/lineCallEngine.js`) | próprio, testado |

**Conexão da câmera:**

- ✅ câmera do próprio celular/tablet (o aparelho no tripé é a câmera);
- ✅ webcam USB (UVC) num notebook/computador;
- ✅ câmera de ação/filmadora por **placa de captura HDMI→USB** (aparece como webcam);
- ✅ câmera virtual (OBS) — é por ela que uma câmera IP entra;
- ❌ **câmera Wi-Fi/IP (RTSP) direto no navegador: não existe.** O navegador
  não abre RTSP. Precisa de um programa de ponte no computador: **OBS** (câmera
  virtual) ou **go2rtc** (MIT, RTSP → WebRTC). É software externo, fora do
  PickleRush.
- ❌ **Bluetooth não transmite vídeo** com a taxa necessária.

**Requisitos mínimos** (`domain/cameraCheck.js`, conferidos com o que a câmera
ENTREGOU): 30 quadros/s e 720p (abaixo disso a tela recusa analisar); o bom é
**60 quadros e 1080p**. Fixa num tripé, alta (3–6 m), atrás do fundo, vendo os
quatro cantos; o selo "cm por pixel" no fundo de lá deve ficar ≤ 3. A bola anda
10–25 m/s: a 30 quadros ela salta até 80 cm entre duas fotos, a 60 até 40 cm.
Os navegadores raramente entregam mais de 60 quadros, mesmo de câmera de 120.

## 4. Precisão — o que é viável e o que NÃO é

O motor nunca inventa: toda medida sai com incerteza (pixel naquele ponto do
chão, meio quadro de deslocamento da bola, erro dos toques de calibração), e
quando a distância à linha é menor que a incerteza ele diz **Revisar**.

- **Fora/dentro com margem — viável com uma câmera.** A 60 quadros e 1080p, a
  faixa de "revisar" fica em poucos centímetros em volta da linha — é a bola
  NA linha, que o dono definiu como irrelevante em si. Fora dela a decisão é
  clara.
- **Pé na cozinha no voleio — viável, com limites.** O detector de pose dá
  calcanhar e ponta do pé; o motor segue os pés de quem bateu por 1 s (o
  impulso) e só conta pé **apoiado** (parado entre quadros). Pé no ar, pé
  escondido atrás de outro jogador, ou a ±7 cm da linha → **Revisar o pé**. A
  câmera precisa ver os pés de quem está na rede (a de fundo vê bem o lado de
  cá; para o lado de lá, uma segunda câmera na lateral, na altura da cozinha).
- **Bola exatamente na linha (precisão de milímetro, nível ITF/Hawk-Eye) — NÃO
  é viável no navegador com uma câmera.** Exige 4–8 câmeras sincronizadas,
  240+ quadros, triangulação 3D e um computador dedicado. Se um dia for
  preciso, é software externo (ver §6).
- **Detecção da bola sem modelo treinado.** Cor + movimento funciona com bola
  de cor viva e fundo que não seja da mesma cor; perde a bola com sombra
  forte, contra luz, ou quando ela some atrás do jogador. O ganho real de
  robustez é um modelo do tipo **TrackNetV3 / WASB-SBDT / TrackNetV4** (MIT)
  treinado com vídeo de pickleball: não há modelo público pronto para
  pickleball, então isso exige gravar e anotar 20–40 mil quadros. O motor de
  decisão não muda — só `findBallCandidates` é trocada.
- **Saque** (bola na cozinha no saque, quadra de saque diagonal) e **quem
  ganhou o ponto** não são marcados: o motor não sabe o placar nem quem saca.

## 5. Como o motor decide (`domain/lineCallEngine.js`)

Quique e batida são as duas **mudanças bruscas** da direção da bola na imagem
(a gravidade muda devagar). Colada a um punho (≤ 90 px) é batida; a outra, se a
bola descia e passa a subir, é quique. O ponto do quique é a interseção da
trajetória de antes com a de depois (abaixo de um quadro), levado ao chão pela
homografia. Batida sem quique desde a anterior = **voleio** (a primeira da
jogada é o saque). Todos os ajustes estão em `ENGINE_DEFAULTS` — são botões de
calibração do mundo real, não constantes.

## 6. Próximos passos (fora deste PR)

1. Gravar e anotar vídeo de pickleball (CVAT + SAM 2) e treinar um TrackNet
   para trocar o detector de bola; exportar em ONNX e rodar com
   `onnxruntime-web` (WebGPU).
2. Segunda câmera na lateral da cozinha (outro aparelho na mesma página).
3. Torneio: o mesmo cartão nas partidas de torneio.
4. Mostrar a última marcação no telão (exigiria gravar o evento no banco).
5. Software externo (Python + OpenCV + câmeras sincronizadas) só se for
   preciso decidir a bola NA linha.

Evitar no produto: Ultralytics/YOLOv8+ (AGPL-3.0) e repositórios sem licença.
