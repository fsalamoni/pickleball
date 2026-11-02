# linecall — controle de linhas por câmera

Flag `line_control`. Uma câmera filma a quadra e o navegador marca o quique
(dentro / fora / revisar) e a falta de pé na cozinha no voleio. Tudo roda no
aparelho; o único dado gravado é `game_days.line_control`.

- `domain/homography.js` — quadra ⇄ imagem (4 cantos tocados).
- `domain/court.js` — medidas da quadra, margem até a linha, profundidade na cozinha.
- `domain/lineCallEngine.js` — o motor quadro a quadro (quique, batida, voleio, pé apoiado), com incerteza.
- `domain/ballDetection.js` — bola por cor + movimento (trocável por um modelo TrackNet).
- `domain/cameraCheck.js` — a câmera entrega o mínimo? (30 q/s e 720p; bom: 60 e 1080p).
- `domain/lineControlTargets.js` — "ligar em todos os meus jogos".
- `services/cameraService.js` — `getUserMedia`; `services/poseService.js` — MediaPipe Pose (Apache-2.0), import dinâmico.
- `hooks/useLineCallSession.js` — câmera, calibração (navegador), análise, marcações.

Telas: `v2/components/games/GameDayLineControlCard.jsx` (no `GameDayModule`) e
`v2/pages/V2LineControl.jsx` (`/dia-de-jogo/:id/linhas`). Ver
`docs/53-CONTROLE-DE-LINHAS.md`.
