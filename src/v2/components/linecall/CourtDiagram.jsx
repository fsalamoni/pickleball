/**
 * CourtDiagram — a quadra vista de cima, com as posições de câmera do arranjo
 * e (na calibração) os pontos que a pessoa toca, numerados na ordem do toque.
 *
 * É o mapa comum de todos os aparelhos: lado A embaixo, lado B em cima, lado
 * 1 à esquerda (as coordenadas de `court.js`). Com `view` (o id de uma
 * posição) o desenho GIRA para ficar como aquela câmera vê a quadra, com ela
 * embaixo: a lateral da rede vê a quadra deitada, o fundo B de ponta-cabeça.
 * Os textos ficam sempre de pé. As cores são fixas de propósito — é uma
 * ilustração, igual no modo claro e no escuro.
 */

import React from 'react';
import { COURT, COURT_POINTS, courtSegments } from '@/modules/linecall/domain/court';
import { CAMERA_POSITIONS, cameraViewRotation } from '@/modules/linecall/domain/cameraLayouts';
import { t } from '@/core/i18n';

const { WIDTH: W, LENGTH: L, NET_Y: N, KITCHEN: K } = COURT;
const PAD = 4;

/**
 * Do chão (metros) para o desenho, girado pelo `rot`: 0 = lado A embaixo e
 * lado 1 à esquerda; 180 = de ponta-cabeça; -90 = deitada com o lado 1
 * embaixo (lateral 1); 90 = deitada com o lado 2 embaixo (lateral 2).
 */
function diagramProjection(rot = 0) {
  const deitada = rot === 90 || rot === -90;
  const to = (x, y) => {
    const by = L - y; // lado A embaixo
    if (rot === 180) return [W - x + PAD, y + PAD];
    if (rot === -90) return [by + PAD, W - x + PAD];
    if (rot === 90) return [y + PAD, x + PAD];
    return [x + PAD, by + PAD];
  };
  return { w: (deitada ? L : W) + PAD * 2, h: (deitada ? W : L) + PAD * 2, to, deitada };
}

const COR = {
  piso: '#1d6fa5', cozinha: '#155a87', linha: '#ffffff', rede: '#e2e8f0',
  cam: '#0b0f19', camAtiva: '#d4f82e', camOcupada: '#16a34a', alvo: '#d4f82e', texto: '#0b0f19',
};

function Camera({ p, state, n, to }) {
  const [x, y] = to(p.spot.x, p.spot.y);
  const ativa = state === 'active';
  const fill = ativa ? COR.camAtiva : state === 'taken' ? COR.camOcupada : COR.cam;
  const ink = ativa ? COR.texto : '#ffffff';
  // A câmera aponta para o centro da quadra (a de cima, para baixo: um círculo).
  if (p.id === 'topo') {
    return (
      <g>
        <circle cx={x} cy={y} r={1.15} fill={fill} stroke="#ffffff" strokeWidth={0.15} />
        <text x={x} y={y + 0.42} textAnchor="middle" fontSize={1.1} fontWeight={800} fill={ink}>{n}</text>
      </g>
    );
  }
  const [cx, cy] = to(W / 2, N);
  const ang = (Math.atan2(cy - y, cx - x) * 180) / Math.PI;
  return (
    <g transform={`translate(${x} ${y}) rotate(${ang})`}>
      <rect x={-1.1} y={-0.8} width={1.7} height={1.6} rx={0.3} fill={fill} />
      <path d="M0.6 -0.5 L1.4 -0.9 L1.4 0.9 L0.6 0.5 Z" fill={fill} />
      <text x={-0.25} y={0.42} textAnchor="middle" fontSize={1.1} fontWeight={800} fill={ink} transform={`rotate(${-ang} -0.25 0)`}>{n}</text>
    </g>
  );
}

/** Um retângulo do chão (de lateral a lateral, `y0`–`y1`) como polígono no desenho. */
const band = (to, y0, y1) => [[0, y0], [W, y0], [W, y1], [0, y1]].map(([x, y]) => to(x, y).join(',')).join(' ');

/**
 * @param {{ positions?: string[], active?: string|null, taken?: string[],
 *   points?: string[], current?: string|null, done?: string[], zone?: {id:string,y0:number,y1:number}|null,
 *   view?: string|null, numbered?: boolean, className?: string, label?: string }} props
 *   `zone`: a área vigiada (o resto fica escurecido); `view`: girar para o olhar desta posição;
 *   `numbered`: o número de cada ponto (a ordem do toque) ao lado dele
 */
export default function CourtDiagram({
  positions = [], active = null, taken = [], points = [], current = null, done = [], zone = null, marks = [],
  view = null, numbered = false, className, label,
}) {
  const { w, h, to, deitada } = diagramProjection(view ? cameraViewRotation(view) : 0);
  const at = (x, y) => to(x, y);
  // Os nomes dos lados, do lado de fora da quadra. Deitada, todos de pé: os
  // fundos ganham a folga do lado e as laterais ficam perto do fundo, longe
  // dos pontos da cozinha e da câmera.
  const [ax, ay] = at(W / 2, deitada ? -2.1 : -1.1);
  const [bx, by] = at(W / 2, L + (deitada ? 2.1 : 1.1));
  const [l1x, l1y] = at(-1.1, deitada ? L * 0.12 : L * 0.25);
  const [l2x, l2y] = at(W + 1.1, deitada ? L * 0.12 : L * 0.25);
  const sideText = (x, y, txt, key, rotate = 0) => (
    <text key={key} x={x} y={y + 0.33} textAnchor="middle" fontSize={0.95} fontWeight={700} fill="currentColor" transform={rotate ? `rotate(${rotate} ${x} ${y})` : undefined}>{txt}</text>
  );
  // No desenho em pé, as laterais vão de lado (como sempre foram).
  const sideRot = (x) => (x < w / 2 ? -90 : 90);
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={label || t('Desenho da quadra com as posições das câmeras')}
      className={className}
    >
      <polygon points={band(at, 0, L)} fill={COR.piso} />
      <polygon points={band(at, N - K, N + K)} fill={COR.cozinha} />
      {courtSegments().map(([a, b], i) => {
        const [x1, y1] = at(a.x, a.y);
        const [x2, y2] = at(b.x, b.y);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={COR.linha} strokeWidth={0.09} />;
      })}
      {(() => {
        const [x1, y1] = at(-0.4, N);
        const [x2, y2] = at(W + 0.4, N);
        return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={COR.rede} strokeWidth={0.22} />;
      })()}
      {sideText(ax, ay, t('Lado A'), 'a')}
      {sideText(bx, by, t('Lado B'), 'b')}
      {sideText(l1x, l1y, t('Lado 1'), 'l1', deitada ? 0 : sideRot(l1x))}
      {sideText(l2x, l2y, t('Lado 2'), 'l2', deitada ? 0 : sideRot(l2x))}

      {zone && zone.id !== 'full' && (
        <g>
          {zone.y0 > 0 && <polygon points={band(at, 0, zone.y0)} fill="#0b0f19" opacity={0.55} />}
          {zone.y1 < L && <polygon points={band(at, zone.y1, L)} fill="#0b0f19" opacity={0.55} />}
          <polygon points={band(at, zone.y0, zone.y1)} fill="none" stroke={COR.alvo} strokeWidth={0.22} />
        </g>
      )}

      {marks.map((m) => {
        const [x, y] = at(m.x, m.y);
        return m.serve
          ? <rect key={m.id} x={x - 0.22} y={y - 0.22} width={0.44} height={0.44} fill={m.color} stroke="#0b0f19" strokeWidth={0.05} />
          : <circle key={m.id} cx={x} cy={y} r={0.22} fill={m.color} stroke="#0b0f19" strokeWidth={0.05} />;
      })}

      {points.map((id, i) => {
        const p = COURT_POINTS[id];
        if (!p) return null;
        const [x, y] = at(p.x, p.y);
        const now = id === current;
        const ok = done.includes(id);
        // O número fica para FORA da quadra, longe do centro.
        const [cx, cy] = at(W / 2, N);
        const d = Math.hypot(x - cx, y - cy) || 1;
        const nx = x + ((x - cx) / d) * 1.3;
        const ny = y + ((y - cy) / d) * 1.3;
        return (
          <g key={id}>
            {now && <circle cx={x} cy={y} r={1.1} fill="none" stroke={COR.alvo} strokeWidth={0.25} className="motion-safe:animate-pulse" />}
            <circle cx={x} cy={y} r={0.45} fill={now ? COR.alvo : ok ? COR.camOcupada : '#ffffff'} stroke={COR.texto} strokeWidth={0.08} />
            {numbered && <text x={nx} y={ny + 0.4} textAnchor="middle" fontSize={1.1} fontWeight={800} fill={now ? COR.alvo : 'currentColor'}>{i + 1}</text>}
          </g>
        );
      })}

      {positions.map((id, i) => {
        const p = CAMERA_POSITIONS[id];
        if (!p) return null;
        const state = id === active ? 'active' : taken.includes(id) ? 'taken' : 'free';
        return <Camera key={id} p={p} state={state} n={i + 1} to={at} />;
      })}
    </svg>
  );
}
