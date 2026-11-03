# linecall — controle de linhas por câmera

Flag `line_control`. De 1 a 5 câmeras (celulares, webcams, câmeras de ação)
filmam a quadra; cada aparelho marca o quique (dentro / fora / revisar) e a
falta de pé na cozinha no voleio, e a central junta o que todas viram. O vídeo
fica no aparelho; vão ao banco só a presença de cada câmera (`line_cams`) e as
marcações (`line_calls`), subcoleções de `game_days` — ou, no torneio, de
`tournament_line_courts/{torneio}_{quadra}` (`domain/tournamentLine.js`,
`services/tournamentLineService.js`, página `V2TournamentLineControl`; os
serviços recebem o anfitrião por `hostPath`).

- `domain/court.js` — medidas da quadra, os pontos de calibração (cantos e pontas da cozinha), margem e profundidade.
- `domain/cameraLayouts.js` — as posições (`fundo_a`, `rede_1`, `topo`, cantos…) e os 11 arranjos de 1 a 5 câmeras. **Ids gravados: nunca renomeie.**
- `domain/homography.js` — quadra ⇄ imagem (4 pontos tocados).
- `domain/lineCallEngine.js` — o motor quadro a quadro (modo imagem e modo de cima), com incerteza.
- `domain/fusion.js` — junta as marcações de várias câmeras por janela de tempo; quem está no ar.
- `domain/ballDetection.js` — bola por cor + movimento (trocável por um modelo TrackNet).
- `domain/cameraCheck.js` — a câmera entrega o mínimo? (30 q/s e 720p; bom: 60 e 1080p).
- `domain/replay.js` — anel de quadros e janela do replay; `domain/report.js` — resumo e CSV do jogo; `domain/calibrationCheck.js` — o 5º ponto (erro em cm); `domain/cameraHealth.js` — a câmera saiu do lugar / pouca luz; `domain/snapCorner.js` — "Grudar na linha" (canto externo do L branco); `domain/readiness.js` — "Pronto para começar?" da central; `domain/setupKits.js` — os quatro kits de montagem, o que o aparelho aguenta e a fonte da câmera (OBS, NDI, celular sem fio, captura).
- `domain/lineControlTargets.js` — "ligar em todos os meus jogos".
- `services/cameraService.js` — `getUserMedia`; `services/poseService.js` — MediaPipe Pose (Apache-2.0), import dinâmico.
- `services/lineCallSync.js` — presença da câmera e envio das marcações.
- `hooks/useLineCallSession.js` — uma câmera: abrir, calibrar (navegador, por posição), analisar, enviar.
- `hooks/useAnnounce.js` — toque na hora (`domain/alertTones.js` + `services/alertSound.js`), vibração e voz (preferências por pessoa).
- `hooks/useLineControlLive.js` — a central: câmeras no ar e lances juntados (tempo real).

Telas: `v2/components/games/GameDayLineControlCard.jsx` (no `GameDayModule`),
`v2/pages/V2LineControl.jsx` (`/dia-de-jogo/:id/linhas?modo=camera|central`) e
`v2/components/linecall/` (desenho da quadra, escolha do arranjo, guia de
posicionamento, estação da câmera, central, `CourtMark`, `LanceReplay`, `TelaoLineTicker` no telão do dia de jogo e `TournamentTelaoLines` no do torneio, uma por quadra). Ver `docs/53-CONTROLE-DE-LINHAS.md`.
