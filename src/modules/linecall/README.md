# linecall — controle de linhas por câmera

Flag `line_control`. **Quadra por quadra**: cada quadra de um dia de jogo ou de
um torneio liga o seu controle e escolhe o seu arranjo, de 1 a 5 câmeras
(celulares, webcams, câmeras de ação). Cada aparelho marca o quique (dentro /
fora — longa, lateral, curta, área errada, rede — / revisar), o pé na cozinha no
voleio, o pé no saque e os dois quiques; a central da quadra junta o que as
câmeras dela viram. O vídeo fica no aparelho; vão ao banco só a configuração da
quadra, a presença de cada câmera (`line_cams`), as marcações (`line_calls`) e,
para calibrar pela central, uma foto da quadra que só a câmera e quem organiza
veem e que some a cada envio (`line_calib`, docs/53 §5d):

- dia de jogo: `game_days/{id}/line_courts/court-N` (`domain/gameDayLine.js`,
  `services/gameDayLineService.js`, `hooks/useGameDayLineCourts.js`);
- torneio: `tournament_line_courts/{torneio}_{quadra}` (`domain/tournamentLine.js`,
  `services/tournamentLineService.js`, `hooks/useTournamentLineCourts.js`).

Os serviços de câmera e de marcação recebem o anfitrião por `hostPath` (o
caminho da quadra). As regras do jogo julgadas, com o número da regra: docs/53 §10.

- `domain/court.js` — medidas da quadra, os pontos de calibração (cantos e pontas da cozinha), margem da bola e do pé, a área de saque, o que a rede esconde.
- `domain/cameraLayouts.js` — as posições (`fundo_a`, `rede_1`, `topo`, cantos…), os pesos de cada uma (pé na cozinha, pé no saque) e os 11 arranjos de 1 a 5 câmeras; `layoutJudges` diz se o arranjo julga pé. **Ids gravados: nunca renomeie.**
- `domain/homography.js` — quadra ⇄ imagem (4 pontos tocados), onde a câmera está (`estimateCamera`) e a correção de altura.
- `domain/lineCallEngine.js` — o motor quadro a quadro (modo imagem e modo de cima): o ponto do saque ao fim, quique × batida, incerteza por eixo, impulso, o 1º quique escondido pela rede e a formação de saque depois de um ponto (`serveFormation`: a bola devolvida a quem vai sacar não é saque). Os `kind` e `reason` são gravados: nunca renomeie.
- `domain/fusion.js` — junta as marcações das câmeras de uma quadra por janela de tempo; quem está no ar; o estado do telão; a manchete (`pickHeadline`, a mesma regra na câmera, na central, no aviso e no telão) e o que chegou (`newArrivals`).
- `domain/gameDayLine.js` — as quadras do dia, o anfitrião e a página de cada uma, quem pode ser câmera, "Copiar para os meus próximos dias de jogo".
- `domain/ballDetection.js` — bola por cor + movimento (trocável por um modelo TrackNet).
- `domain/cameraCheck.js` — a câmera entrega o mínimo? (30 q/s e 720p; bom: 60 e 1080p).
- `domain/replay.js` — fita de quadros por tempo (3,5 s, memória limitada) e janela do replay; `domain/report.js` — resumo e CSV da quadra; `domain/calibrationCheck.js` — o 5º ponto (erro em cm); `domain/cameraHealth.js` — a câmera saiu do lugar / pouca luz; `domain/snapCorner.js` — "Grudar na linha" (canto externo do L branco); `domain/readiness.js` — "Pronto para começar?" da central; `domain/stationCheck.js` — o próximo passo e o diagnóstico de UMA câmera, no aparelho que filma; `domain/setupKits.js` — os quatro kits de montagem, o que o aparelho aguenta e a fonte da câmera (OBS, NDI, celular sem fio, captura).
- `domain/zones.js` — a área que cada câmera vigia (quadra inteira, um lado, um fundo, as cozinhas, uma cozinha): os quatro cantos tocados, o 5º ponto e `eventInZone` (fora da área a câmera fica calada). Guardada só na calibração do aparelho. A tela de marcação é `CalibrationView` (zoom com pontos presos em pixels do vídeo, controles sobre a imagem, tela cheia; conta em `zoomMath.js`).
- `domain/testkit/courtSim.js` — o simulador que filma pontos inteiros com a projeção de câmeras reais (só testes).
- `services/cameraService.js` — `getUserMedia`, e `openIpCamera` (câmera IP pela ponte local go2rtc/MediaMTX, WebRTC só de receber; regra do endereço e o assistente que gera o `go2rtc.yaml` (`go2rtcConfig`, `IpBridgeWizard`; a senha só vai para o arquivo baixado) em `domain/ipCamera.js`, zero banco — docs/53 §5b); `services/poseService.js` — MediaPipe Pose (Apache-2.0), import dinâmico.
- Câmera IP e webcam simples (docs/53 §5 e §5b): `domain/bridgeDiscovery.js` + `services/bridgeService.js` + `BridgeFinder` — a página comanda a go2rtc (acha a ponte, baixa a ponte mínima e o "liga sozinha" `bridgeAutostart`, descobre câmeras ONVIF, cadastra por `PUT /api/streams`, avisa H.265; nunca lê `/api/config`); `domain/fixedCalib.js` — a câmera fixa lembra a calibração por posição e câmera e confere na imagem de agora se ela mexeu; `domain/webcamTuning.js` + `WebcamTuning` — obturador manual e quadros entregues; várias câmeras na mesma tela (`?posicao=a,b`); o sinal de vida leva `alert` (mexeu/escura) para o "Pronto para começar?".
- `services/lineGuestService.js` — a câmera SEM CONTA pelo QR (docs/53 §5c): o convite `line_invites/{sha256(token)}` (token só no fragmento do link), a página `/linhas/convidado` e o `guestSink` que manda sinal e marcações pela função `lineGuest` (`functions/lineGuest.js`).
- `services/lineCallSync.js` — presença da câmera e envio das marcações; `services/saveEach.js` — várias quadras de uma vez, a que falhar não derruba as outras.
- `hooks/useLineCallSession.js` — uma câmera: abrir, calibrar (navegador, por posição), analisar, enviar; e a calibração que chega da central.
- `hooks/useCalibration.js` — a conta da marcação (pontos, área, "Grudar na linha", 5º ponto, cor da bola) sobre um vídeo OU uma foto; `hooks/useRemoteCalibration.js` — a central calibrando uma câmera pela foto dela. `domain/remoteCalib.js` — escala foto ⇄ vídeo, limpeza e o que a câmera faz com o documento; `services/lineCalibService.js` — `{quadra}/line_calib/{camId}` (docs/53 §5d). A tela da marcação é `CalibrationMarker`, a MESMA no aparelho que filma e na central (`RemoteCalibration`).
- `hooks/useAnnounce.js` — toque na hora (`domain/alertTones.js` + `services/alertSound.js`), vibração e voz (preferências por pessoa); só a falta é dita, e no aparelho que filma o "revisar" fica calado.
- `hooks/useLineControlLive.js` — a central: câmeras no ar e lances juntados (tempo real).

Telas: `v2/components/games/GameDayLineControlCard.jsx` (no `GameDayModule`, colapsável como os demais cartões do dia),
`v2/pages/V2LineControl.jsx` (`/dia-de-jogo/:id/linhas`, `?quadra=court-N&modo=camera|central`),
`v2/pages/V2TournamentLineControl.jsx` (`/torneios/:id/linhas`) e
`v2/components/linecall/` (`LineCourtsBoard` — o quadro das quadras, o mesmo
nos três lugares —, desenho da quadra, escolha do arranjo, guia de
posicionamento, estação da câmera, central, `CourtMark`, `LanceReplay`,
`callLabels`, e `TelaoLineTicker`/`TournamentTelaoLines` nos telões, um aviso
por quadra ligada). Ver `docs/53-CONTROLE-DE-LINHAS.md`.
