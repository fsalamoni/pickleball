/**
 * CourtDiagram — a quadra vista de cima, com as posições de câmera do arranjo
 * e (na calibração) o ponto que a pessoa tem de tocar agora.
 *
 * É o mapa comum de todos os aparelhos: lado A embaixo, lado B em cima, lado
 * 1 à esquerda (as coordenadas de `court.js`). As cores são fixas de
 * propósito — é uma ilustração, igual no modo claro e no escuro.
 */

import React from 'react';
import { COURT, COURT_POINTS, courtSegments } from '@/modules/linecall/domain/court';
import { CAMERA_POSITIONS } from '@/modules/linecall/domain/cameraLayouts';
import { t } from '@/core/i18n';

const { WIDTH: W, LENGTH: L, NET_Y: N, KITCHEN: K } = COURT;
const PAD = 4;
const sx = (x) => x + PAD;
const sy = (y) => L + PAD - y; // lado A embaixo

const COR = {
  piso: '#1d6fa5', cozinha: '#155a87', linha: '#ffffff', rede: '#e2e8f0',
  cam: '#0b0f19', camAtiva: '#d4f82e', camOcupada: '#16a34a', alvo: '#d4f82e', texto: '#0b0f19',
};

function Camera({ p, state, n }) {
  const x = sx(p.spot.x);
  const y = sy(p.spot.y);
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
  const ang = (Math.atan2(sy(N) - y, sx(W / 2) - x) * 180) / Math.PI;
  return (
    <g transform={`translate(${x} ${y}) rotate(${ang})`}>
      <rect x={-1.1} y={-0.8} width={1.7} height={1.6} rx={0.3} fill={fill} />
      <path d="M0.6 -0.5 L1.4 -0.9 L1.4 0.9 L0.6 0.5 Z" fill={fill} />
      <text x={-0.25} y={0.42} textAnchor="middle" fontSize={1.1} fontWeight={800} fill={ink} transform={`rotate(${-ang} -0.25 0)`}>{n}</text>
    </g>
  );
}

/**
 * @param {{ positions?: string[], active?: string|null, taken?: string[],
 *   points?: string[], current?: string|null, done?: string[], zone?: {id:string,y0:number,y1:number}|null,
 *   className?: string, label?: string }} props  `zone`: a área vigiada (o resto fica escurecido)
 */
export default function CourtDiagram({
  positions = [], active = null, taken = [], points = [], current = null, done = [], zone = null, className, label,
}) {
  return (
    <svg
      viewBox={`0 0 ${W + PAD * 2} ${L + PAD * 2}`}
      role="img"
      aria-label={label || t('Desenho da quadra com as posições das câmeras')}
      className={className}
    >
      <rect x={sx(0)} y={sy(L)} width={W} height={L} fill={COR.piso} />
      <rect x={sx(0)} y={sy(N + K)} width={W} height={K * 2} fill={COR.cozinha} />
      {courtSegments().map(([a, b], i) => (
         
        <line key={i} x1={sx(a.x)} y1={sy(a.y)} x2={sx(b.x)} y2={sy(b.y)} stroke={COR.linha} strokeWidth={0.09} />
      ))}
      <line x1={sx(-0.4)} y1={sy(N)} x2={sx(W + 0.4)} y2={sy(N)} stroke={COR.rede} strokeWidth={0.22} />
      <text x={sx(W / 2)} y={sy(-1.25)} textAnchor="middle" fontSize={0.95} fontWeight={700} fill="currentColor">{t('Lado A')}</text>
      <text x={sx(W / 2)} y={sy(L + 0.55)} textAnchor="middle" fontSize={0.95} fontWeight={700} fill="currentColor">{t('Lado B')}</text>
      <text x={sx(-0.6)} y={sy(L * 0.25)} textAnchor="middle" fontSize={0.8} fill="currentColor" transform={`rotate(-90 ${sx(-0.6)} ${sy(L * 0.25)})`}>{t('Lado 1')}</text>
      <text x={sx(W + 0.6)} y={sy(L * 0.25)} textAnchor="middle" fontSize={0.8} fill="currentColor" transform={`rotate(90 ${sx(W + 0.6)} ${sy(L * 0.25)})`}>{t('Lado 2')}</text>

      {zone && zone.id !== 'full' && (
        <g>
          {zone.y0 > 0 && <rect x={sx(0)} y={sy(zone.y0)} width={W} height={zone.y0} fill="#0b0f19" opacity={0.55} />}
          {zone.y1 < L && <rect x={sx(0)} y={sy(L)} width={W} height={L - zone.y1} fill="#0b0f19" opacity={0.55} />}
          <rect x={sx(0)} y={sy(zone.y1)} width={W} height={zone.y1 - zone.y0} fill="none" stroke={COR.alvo} strokeWidth={0.22} />
        </g>
      )}

      {points.map((id) => {
        const p = COURT_POINTS[id];
        if (!p) return null;
        const now = id === current;
        const ok = done.includes(id);
        return (
          <g key={id}>
            {now && <circle cx={sx(p.x)} cy={sy(p.y)} r={1.1} fill="none" stroke={COR.alvo} strokeWidth={0.25} className="motion-safe:animate-pulse" />}
            <circle cx={sx(p.x)} cy={sy(p.y)} r={0.45} fill={now ? COR.alvo : ok ? COR.camOcupada : '#ffffff'} stroke={COR.texto} strokeWidth={0.08} />
          </g>
        );
      })}

      {positions.map((id, i) => {
        const p = CAMERA_POSITIONS[id];
        if (!p) return null;
        const state = id === active ? 'active' : taken.includes(id) ? 'taken' : 'free';
        return <Camera key={id} p={p} state={state} n={i + 1} />;
      })}
    </svg>
  );
}
