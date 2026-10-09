/**
 * CourtDiagram — o diagrama de quadra de um item de treino, desenhado em SVG
 * a partir do DADO (`training/domain/diagram.js`), nunca de uma imagem.
 *
 * Coordenadas do domínio: quadra inteira em pé, 0–100 nos dois eixos (x na
 * largura de 20 pés, y no comprimento de 44 pés, rede em y = 50). A vista
 * (`inteira` | `meia` | `cozinha`) só recorta o desenho.
 *
 * `tema-claro` em volta do SVG: o diagrama é uma FIGURA — sai igual nos dois modos,
 * como uma foto da quadra. As cores do desenho não precisam acompanhar a tela.
 *
 * O mesmo componente serve à ficha (só leitura) e ao `DiagramEditor`, que passa
 * `svgRef`, `onCourtPointerDown`, `onElementPointerDown` e `selectedIndex` e usa
 * `courtPointFromEvent` para traduzir o toque em coordenadas da quadra.
 */
import React, { useId } from 'react';
import { cn } from '@/core/lib/utils';
import { COURT, VIEW_BOUNDS, describeDiagram, DIAGRAM_TAG_LABELS } from '@/modules/training/domain/diagram';

const SX = 2; // 20 pés → 200 unidades
const SY = 4.4; // 44 pés → 440 unidades
const M = 18; // margem fora das linhas

const px = (x) => x * SX;
const py = (y) => y * SY;

/** viewBox da vista pedida. */
export function courtViewBox(court = 'inteira') {
  const b = VIEW_BOUNDS[court] || VIEW_BOUNDS.inteira;
  return { x: -M, y: py(b.y0) - M, w: 200 + 2 * M, h: py(b.y1 - b.y0) + 2 * M };
}

/**
 * Converte um evento de ponteiro em coordenadas da quadra (0–100, uma casa).
 * @param {SVGSVGElement} svg
 * @param {{ clientX: number, clientY: number }} e
 * @returns {{ x: number, y: number }|null}
 */
export function courtPointFromEvent(svg, e) {
  if (!svg || typeof svg.createSVGPoint !== 'function') return null;
  const ctm = svg.getScreenCTM?.();
  if (!ctm) return null;
  const p = svg.createSVGPoint();
  p.x = e.clientX;
  p.y = e.clientY;
  const q = p.matrixTransform(ctm.inverse());
  const r = (v) => Math.round(Math.min(100, Math.max(0, v)) * 10) / 10;
  return { x: r(q.x / SX), y: r(q.y / SY) };
}

function Court({ markerBola, markerMov }) {
  const kt = py(COURT.kitchenTop);
  const kb = py(COURT.kitchenBottom);
  return (
    <g>
      <defs>
        <marker id={markerBola} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" className="fill-yellow-300" />
        </marker>
        <marker id={markerMov} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" className="fill-white" />
        </marker>
      </defs>
      <rect x={-M * 4} y={-M * 4} width={200 + M * 8} height={440 + M * 8} className="fill-emerald-700" />
      <rect x={0} y={0} width={200} height={440} className="fill-sky-700" />
      <rect x={0} y={kt} width={200} height={kb - kt} className="fill-sky-600" />
      <g className="stroke-white" strokeWidth="2" fill="none">
        <rect x={0} y={0} width={200} height={440} />
        <line x1={0} y1={kt} x2={200} y2={kt} />
        <line x1={0} y1={kb} x2={200} y2={kb} />
        <line x1={100} y1={0} x2={100} y2={kt} />
        <line x1={100} y1={kb} x2={100} y2={440} />
      </g>
      <line x1={-8} y1={220} x2={208} y2={220} className="stroke-gray-100" strokeWidth="4" />
      <line x1={-8} y1={220} x2={208} y2={220} className="stroke-gray-700" strokeWidth="1.5" strokeDasharray="3 3" />
    </g>
  );
}

function Element({ el, selected, markerBola, markerMov, onPointerDown }) {
  const common = {
    onPointerDown,
    style: onPointerDown ? { cursor: 'grab', touchAction: 'none' } : undefined,
  };
  const halo = selected ? <circle cx={px(el.x)} cy={py(el.y)} r={16} className="fill-none stroke-acid" strokeWidth="3" /> : null;
  switch (el.t) {
    case 'jogador': {
      const curto = el.label && el.label.length <= 2;
      return (
        <g {...common}>
          {halo}
          <circle cx={px(el.x)} cy={py(el.y)} r={10} className={cn('stroke-ink', el.team === 'b' ? 'fill-orange-400' : 'fill-acid')} strokeWidth="2" />
          {curto && (
            <text x={px(el.x)} y={py(el.y) + 4} textAnchor="middle" fontSize="11" fontWeight="700" className="fill-ink">{el.label}</text>
          )}
          {el.label && !curto && (
            <text x={px(el.x)} y={py(el.y) + 24} textAnchor="middle" fontSize="10" fontWeight="700" className="fill-white stroke-ink" strokeWidth="3" paintOrder="stroke">{el.label}</text>
          )}
        </g>
      );
    }
    case 'bola':
      return (
        <g {...common}>
          {halo}
          <circle cx={px(el.x)} cy={py(el.y)} r={5} className="fill-yellow-300 stroke-ink" strokeWidth="1.5" />
        </g>
      );
    case 'cone': {
      const x = px(el.x); const y = py(el.y);
      return (
        <g {...common}>
          {halo}
          <path d={`M${x},${y - 8} L${x + 7},${y + 6} L${x - 7},${y + 6} z`} className="fill-orange-500 stroke-ink" strokeWidth="1.5" />
        </g>
      );
    }
    case 'alvo':
      return (
        <g {...common}>
          {halo}
          <circle cx={px(el.x)} cy={py(el.y)} r={11} className="fill-red-500 stroke-white" strokeWidth="2" />
          <circle cx={px(el.x)} cy={py(el.y)} r={6} className="fill-white" />
          <circle cx={px(el.x)} cy={py(el.y)} r={3} className="fill-red-500" />
        </g>
      );
    case 'zona': {
      const x = Math.min(px(el.x), px(el.x2)); const y = Math.min(py(el.y), py(el.y2));
      const w = Math.abs(px(el.x2) - px(el.x)); const h = Math.abs(py(el.y2) - py(el.y));
      return (
        <g {...common}>
          <rect x={x} y={y} width={w} height={h} className={cn('fill-acid', selected ? 'stroke-acid' : 'stroke-white')} fillOpacity="0.35" strokeWidth="2" strokeDasharray="5 3" />
          {el.label && <text x={x + w / 2} y={y + h / 2 + 4} textAnchor="middle" fontSize="10" fontWeight="700" className="fill-white stroke-ink" strokeWidth="3" paintOrder="stroke">{el.label}</text>}
        </g>
      );
    }
    case 'seta': {
      const bola = el.style !== 'movimento';
      return (
        <g {...common}>
          {selected && <line x1={px(el.x)} y1={py(el.y)} x2={px(el.x2)} y2={py(el.y2)} className="stroke-acid" strokeWidth="8" strokeOpacity="0.5" />}
          <line
            x1={px(el.x)} y1={py(el.y)} x2={px(el.x2)} y2={py(el.y2)}
            className={bola ? 'stroke-yellow-300' : 'stroke-white'}
            strokeWidth={bola ? 2.5 : 2}
            strokeDasharray={bola ? undefined : '6 4'}
            markerEnd={`url(#${bola ? markerBola : markerMov})`}
          />
          {/* Área de toque maior que a linha, para o editor. */}
          {onPointerDown && <line x1={px(el.x)} y1={py(el.y)} x2={px(el.x2)} y2={py(el.y2)} stroke="transparent" strokeWidth="16" />}
          {el.label && (
            <text x={(px(el.x) + px(el.x2)) / 2} y={(py(el.y) + py(el.y2)) / 2 - 6} textAnchor="middle" fontSize="10" fontWeight="700" className="fill-white stroke-ink" strokeWidth="3" paintOrder="stroke">{el.label}</text>
          )}
        </g>
      );
    }
    case 'texto':
      return (
        <g {...common}>
          {selected && <circle cx={px(el.x)} cy={py(el.y) - 4} r={14} className="fill-none stroke-acid" strokeWidth="2" />}
          <text x={px(el.x)} y={py(el.y)} textAnchor="middle" fontSize="12" fontWeight="800" className="fill-white stroke-ink" strokeWidth="3" paintOrder="stroke">{el.label}</text>
        </g>
      );
    default:
      return null;
  }
}

const TAG_TONE = {
  certo: 'bg-emerald-100 text-emerald-800',
  errado: 'bg-red-100 text-red-800',
  neutro: 'bg-gray-100 text-gray-700',
};

/**
 * @param {{
 *   diagram: object,
 *   className?: string,
 *   caption?: boolean,
 *   svgRef?: React.Ref<SVGSVGElement>,
 *   selectedIndex?: number|null,
 *   onCourtPointerDown?: (e: React.PointerEvent) => void,
 *   onElementPointerDown?: (index: number, e: React.PointerEvent) => void,
 *   onPointerMove?: (e: React.PointerEvent) => void,
 *   onPointerUp?: (e: React.PointerEvent) => void,
 * }} props
 */
export default function CourtDiagram({
  diagram, className, caption = true, svgRef, selectedIndex = null,
  onCourtPointerDown, onElementPointerDown, onPointerMove, onPointerUp,
}) {
  const uid = useId().replace(/:/g, '');
  const court = diagram?.court || 'inteira';
  const vb = courtViewBox(court);
  const elements = diagram?.elements || [];
  const descricao = describeDiagram(diagram) || 'Quadra vazia.';
  const titleId = `cd-t-${uid}`;
  const markerBola = `cd-b-${uid}`;
  const markerMov = `cd-m-${uid}`;
  const tag = diagram?.tag || 'neutro';

  return (
    <figure className={className}>
      <div className="tema-claro">
      <svg
        ref={svgRef}
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        role="img"
        aria-labelledby={titleId}
        className="block h-auto w-full select-none overflow-hidden rounded-2xl"
        onPointerDown={onCourtPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={onCourtPointerDown ? { touchAction: 'none' } : undefined}
      >
        <title id={titleId}>{descricao}</title>
        <Court markerBola={markerBola} markerMov={markerMov} />
        {elements.map((el, i) => (
          <Element
            key={i}
            el={el}
            selected={selectedIndex === i}
            markerBola={markerBola}
            markerMov={markerMov}
            onPointerDown={onElementPointerDown ? (e) => { e.stopPropagation(); onElementPointerDown(i, e); } : undefined}
          />
        ))}
      </svg>
      </div>
      {caption && (diagram?.title || tag !== 'neutro') && (
        <figcaption className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-700">
          {tag !== 'neutro' && (
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-bold', TAG_TONE[tag])}>{DIAGRAM_TAG_LABELS[tag]}</span>
          )}
          {diagram?.title && <span className="font-semibold">{diagram.title}</span>}
        </figcaption>
      )}
    </figure>
  );
}
