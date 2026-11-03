# 53 — Controle de linhas por câmera

> Flag `line_control` (default OFF, só o admin liga em Painel admin →
> Funcionalidades → Dia de jogo). Módulo `src/modules/linecall/`.
> Estado: **no navegador, de 1 a 5 câmeras** (2026-11-03). A pesquisa de
> origem está em https://claude.ai/artifact/1AR6uPgAbzy8A2CLs2v2sE.

## 1. O que faz

Com a flag ligada, quem **configura** um dia de jogo (criador, gestor da arena,
admin do clube — `useGameDayRoles().podeConfigurar`) vê o cartão **Controle de
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
  calibrated, analyzing, fps, seen_ms, updated_at`.
- `game_days/{id}/line_calls/{auto}`: `uid, position, kind (bounce|volley),
  call (in|out|review|fault|clean), t_ms, margin_m, uncertainty_m, depth_m, x,
  y, created_at`. **Nunca imagem.**

**Regra** (`firestore.rules`, dentro de `game_days`; `lineCamOk`/`lineOrgOf`;
emulador em `tests/rules/lineControl.rules.test.js`): lê quem lê o dia; grava
só com `line_control == true` naquele dia, em nome próprio, e só quem está em
`member_uids`, é administrador nomeado ou organiza; marcação não se edita;
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
- **Saque e quem ganhou o ponto** não são marcados.

## 7. Como o motor decide (`domain/lineCallEngine.js`)

Modo **imagem**: quique e batida são as mudanças bruscas de direção na imagem;
colada a um punho (≤ 90 px) é batida; descendo → subindo é quique; o ponto é a
interseção das duas trajetórias, levado ao chão pela homografia. Modo
**overhead**: o mesmo em metros da quadra, pela desaceleração (§2). Batida sem
quique desde a anterior = **voleio**, com o ponto dos pés de quem bateu.
Ajustes em `ENGINE_DEFAULTS` — botões de calibração do mundo real.

## 8. Fora deste PR

1. Treinar um TrackNet com vídeo de pickleball (CVAT + SAM 2) e rodar com
   `onnxruntime-web`.
2. Torneio: o mesmo cartão nas partidas de torneio.
3. Última marcação no telão (os dados já estão em `line_calls`).
4. Software externo (câmeras sincronizadas) só se for preciso decidir a bola NA linha.

O repositório `pickleball-nivelamento` (questionário de nível) não tem nada de
câmera; a integração com ele não se aplica a esta funcionalidade.

Evitar no produto: Ultralytics/YOLOv8+ (AGPL-3.0) e repositórios sem licença.
