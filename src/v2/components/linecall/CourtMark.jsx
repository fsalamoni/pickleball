/**
 * CourtMark — a MARCA do lance vista de perto, como nas transmissões: um
 * pedaço do chão ampliado, a linha, a bola e a marca que ela deixou, e quanto
 * faltou ou sobrou. No voleio, o pé e a linha da cozinha.
 *
 * Desenha só o que o motor mediu (a margem com sinal e a incerteza); a linha
 * mais perto sai de `nearestBoundary` ou do motivo gravado (`reason`). No pé
 * do saque, a linha de fundo (ou a extensão da lateral ou da central).
 * Escala fixa: 1 unidade = 1 cm.
 */

import React from 'react';
import { BALL_RADIUS, COURT } from '@/modules/linecall/domain/court';
import { CALL_COLOR } from './callLabels';
import { cn } from '@/core/lib/utils';
import { t, tk } from '@/core/i18n';

const LINE_NAME = {
  fundo_a: tk('linha de fundo do lado A'),
  fundo_b: tk('linha de fundo do lado B'),
  lateral_1: tk('lateral do lado 1'),
  lateral_2: tk('lateral do lado 2'),
  // pelo motivo do lance (saque e rede)
  long: tk('linha de fundo'),
  wide: tk('linha lateral'),
  short: tk('linha da cozinha'),
  wrong_box: tk('linha central'),
  net: tk('rede'),
};

/** O pé no saque: o que fica de cada lado da linha que ele não pode pisar (7.A). */
const SERVE_SIDE = {
  baseline: { inside: tk('dentro da quadra'), outside: tk('atrás da linha'), line: tk('linha de fundo') },
  sideline: { inside: tk('além da lateral'), outside: tk('dentro da lateral'), line: tk('extensão da lateral') },
  centerline: { inside: tk('além da central'), outside: tk('do lado certo'), line: tk('extensão da linha central') },
};

/** Janela do desenho, em cm: 70 de largura, 44 de altura. */
const VW = 70;
const VH = 44;
const LINE_CM = COURT.LINE * 100;
const PATCH_CM = 1;

/**
 * @param {{ kind: 'bounce'|'volley'|'serve_foot', call: string, marginM?: number|null,
 *   uncertaintyM?: number|null, lineName?: string|null, reason?: string|null, className?: string }} props
 *   `marginM`: positiva DENTRO (no voleio, a profundidade do pé na cozinha,
 *   positiva dentro dela; no saque, o quanto o pé passou da linha).
 */
export default function CourtMark({ kind, call, marginM, uncertaintyM, lineName = null, reason = null, className }) {
  if (!Number.isFinite(marginM)) return null;
  const serve = kind === 'serve_foot' ? SERVE_SIDE[reason] || SERVE_SIDE.baseline : null;
  // O pé (voleio e saque) se desenha igual: a ponta que avança sobre a linha.
  const volley = kind === 'volley' || Boolean(serve);
  // A linha fica no meio, horizontal: acima dela é "fora" (no voleio, fora da
  // cozinha); abaixo, "dentro". y cresce para baixo.
  const lineTop = VH / 2 - LINE_CM / 2;
  // A borda externa da linha (o limite) é a de CIMA.
  const edge = lineTop;
  const m = Math.max(-VH / 2 + 4, Math.min(VH / 2 - 4, marginM * 100));
  const u = Math.max(0.5, (uncertaintyM || 0) * 100);
  const color = CALL_COLOR[call] || '#ca8a04';
  // No quique a margem é a da borda da marca: o centro fica `PATCH_CM` além.
  // No voleio, o ponto medido é a ponta do pé que avança para a cozinha.
  const cy = volley ? edge + m : edge + m + PATCH_CM;
  const tip = volley ? cy : cy - PATCH_CM;
  const cx = VW / 2;
  const insideLabel = serve ? t(serve.inside) : volley ? t('cozinha') : t('dentro');
  const outsideLabel = serve ? t(serve.outside) : volley ? t('fora da cozinha') : t('fora');
  const lineLabel = lineName ? LINE_NAME[lineName] : LINE_NAME[reason];
  const desc = serve
    ? t('No saque, o pé ficou {d} cm {w} da {l}, com incerteza de {u} cm.', {
      d: Math.round(Math.abs(marginM) * 100), w: marginM >= 0 ? t('além') : t('antes'), l: t(serve.line), u: Math.round(u),
    })
    : volley
    ? t('O pé ficou {d} cm {w} da linha da cozinha, com incerteza de {u} cm.', {
      d: Math.round(Math.abs(marginM) * 100), w: marginM >= 0 ? t('para dentro') : t('antes'), u: Math.round(u),
    })
    : t('A marca da bola ficou {d} cm {w} da {l}, com incerteza de {u} cm.', {
      d: Math.round(Math.abs(marginM) * 100), w: marginM >= 0 ? t('para dentro') : t('para fora'),
      l: lineLabel ? t(lineLabel) : t('linha'), u: Math.round(u),
    });

  return (
    <figure className={cn('space-y-1', className)}>
      <svg viewBox={`0 0 ${VW} ${VH}`} role="img" aria-label={desc} className="block w-full rounded-xl">
        {/* fora (em cima) e dentro (embaixo) */}
        <rect x="0" y="0" width={VW} height={edge} fill={volley ? '#1e3a5f' : '#0f2f4a'} />
        <rect x="0" y={edge} width={VW} height={VH - edge} fill={volley ? '#2f6f4f' : '#1d5f8a'} />
        <rect x="0" y={lineTop} width={VW} height={LINE_CM} fill="#f8fafc" />
        <text x="2" y="5" fontSize="3.2" fill="#e2e8f0">{outsideLabel}</text>
        <text x="2" y={VH - 2} fontSize="3.2" fill="#e2e8f0">{insideLabel}</text>
        {/* incerteza */}
        <circle cx={cx} cy={cy} r={u} fill="none" stroke={color} strokeWidth="0.4" strokeDasharray="1 1" />
        {volley ? (
          <ellipse cx={cx} cy={cy - 6} rx="4" ry="6" fill={color} fillOpacity="0.85" />
        ) : (
          <>
            <circle cx={cx} cy={cy} r={BALL_RADIUS * 100} fill="#d4f82e" fillOpacity="0.25" stroke="#d4f82e" strokeWidth="0.3" />
            <circle cx={cx} cy={cy} r={PATCH_CM} fill={color} />
          </>
        )}
        {/* a régua da margem */}
        <line x1={cx + 8} y1={edge} x2={cx + 8} y2={tip} stroke="#fff" strokeWidth="0.4" />
        <text x={cx + 10} y={(edge + tip) / 2 + 1.2} fontSize="3.6" fontWeight="700" fill="#fff">
          {`${Math.round(Math.abs(marginM) * 100)} cm`}
        </text>
      </svg>
      <figcaption className="text-xs text-gray-500">{desc}</figcaption>
    </figure>
  );
}
