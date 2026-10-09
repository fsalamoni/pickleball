/**
 * O editor de diagramas da quadra: até `MAX_DIAGRAMS` quadros, cada um com
 * vista, marca (diagrama / certo / errado) e título. Escolhe-se a ferramenta
 * e TOCA-SE na quadra para pôr (seta e zona: toque no início e no fim);
 * arrastar move. Tudo também sem arrastar (WCAG 2.5.7): a lista de elementos
 * seleciona, os botões de seta movem, "Pôr no meio da quadra" põe pelo teclado.
 * O desenho é o `CourtDiagram` da ficha — o editor mostra o que vai sair.
 */
import React, { useRef, useState } from 'react';
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Plus, Trash2, Undo2,
} from 'lucide-react';
import { cn } from '@/core/lib/utils';
import {
  ARROW_STYLES, ARROW_STYLE_LABELS, COURT_VIEWS, COURT_VIEW_LABELS, DIAGRAM_TAGS, DIAGRAM_TAG_LABELS,
  MAX_DIAGRAMS, MAX_ELEMENTS,
} from '@/modules/training/domain/diagram';
import CourtDiagram, { courtPointFromEvent } from '@/v2/components/training/CourtDiagram';
import { V2Button, V2Field, V2Input, V2Select } from '@/v2/ui/primitives';
import { IconBtn } from './editorFields';
import { removeAt, replaceAt } from './editorForm';
import {
  NUDGE, TOOLS, TWO_TAP, blankDiagram, buildElement, defaultElement, elementName, popHistory, pushHistory,
  translateElement,
} from './diagramEditing';

const COM_ROTULO = new Set(['jogador', 'texto', 'zona', 'seta']);

export default function DiagramEditor({ value = [], onChange }) {
  const diagrams = Array.isArray(value) ? value : [];
  const [atual, setAtual] = useState(0);
  const [tool, setTool] = useState('jogador_a');
  const [pendente, setPendente] = useState(null);
  const [sel, setSel] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [arrastando, setArrastando] = useState(null);
  const svgRef = useRef(null);
  const drag = useRef(null);

  const idx = Math.min(atual, Math.max(0, diagrams.length - 1));
  const quadro = diagrams[idx] || null;
  const elementos = quadro?.elements || [];
  const cheio = elementos.length >= MAX_ELEMENTS;
  const escolhido = sel !== null ? elementos[sel] : null;

  /** Toda mudança passa por aqui: guarda o retrato anterior para desfazer. */
  const mudar = (next) => {
    setHistorico((h) => pushHistory(h, diagrams));
    onChange(next);
  };
  const mudarQuadro = (patch) => mudar(replaceAt(diagrams, idx, { ...quadro, ...patch }));
  const mudarElementos = (els) => mudarQuadro({ elements: els });

  const por = (el) => {
    if (!el || cheio) return;
    mudarElementos([...elementos, el]);
    setSel(elementos.length);
  };

  const trocarFerramenta = (id) => { setTool(id); setPendente(null); };

  const tocarEm = (ponto) => {
    if (!ponto || tool === 'selecionar') { setSel(null); return; }
    if (TWO_TAP.has(tool)) {
      if (!pendente) { setPendente(ponto); return; }
      const el = buildElement(tool, ponto, { elements: elementos, start: pendente });
      setPendente(null);
      por(el);
      return;
    }
    por(buildElement(tool, ponto, { elements: elementos }));
  };

  const aoTocarQuadra = (e) => tocarEm(courtPointFromEvent(svgRef.current, e));

  const aoTocarElemento = (i, e) => {
    const ponto = courtPointFromEvent(svgRef.current, e);
    if (TWO_TAP.has(tool) && pendente) { tocarEm(ponto); return; }
    setSel(i);
    if (!ponto) return;
    drag.current = { index: i, inicio: ponto, original: elementos[i], moveu: false };
    try { svgRef.current?.setPointerCapture?.(e.pointerId); } catch { /* sem captura: o arrasto segue pelo svg */ }
  };

  const aoMover = (e) => {
    const d = drag.current;
    if (!d) return;
    const ponto = courtPointFromEvent(svgRef.current, e);
    if (!ponto) return;
    d.moveu = true;
    d.el = translateElement(d.original, ponto.x - d.inicio.x, ponto.y - d.inicio.y);
    setArrastando({ index: d.index, el: d.el });
  };

  const aoSoltar = () => {
    const d = drag.current;
    drag.current = null;
    if (d?.moveu && d.el) mudarElementos(replaceAt(elementos, d.index, d.el));
    setArrastando(null);
  };

  const desfazer = () => {
    const r = popHistory(historico);
    if (r.snapshot === null) return;
    setHistorico(r.stack);
    onChange(r.snapshot);
    setSel(null);
    setPendente(null);
  };

  const novoQuadro = () => {
    if (diagrams.length >= MAX_DIAGRAMS) return;
    mudar([...diagrams, blankDiagram()]);
    setAtual(diagrams.length);
    setSel(null);
  };

  const apagarQuadro = () => {
    mudar(removeAt(diagrams, idx));
    setAtual(Math.max(0, idx - 1));
    setSel(null);
  };

  const mudarEscolhido = (patch) => mudarElementos(replaceAt(elementos, sel, { ...escolhido, ...patch }));
  const empurrar = (dx, dy) => mudarElementos(replaceAt(elementos, sel, translateElement(escolhido, dx, dy)));

  const visto = quadro && arrastando
    ? { ...quadro, elements: replaceAt(elementos, arrastando.index, arrastando.el) }
    : quadro;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {diagrams.map((d, i) => (
          <button
            key={i}
            type="button"
            aria-pressed={i === idx}
            onClick={() => { setAtual(i); setSel(null); setPendente(null); }}
            className={cn(
              'min-h-[44px] rounded-full border px-4 text-sm font-bold transition-colors',
              i === idx ? 'border-ink bg-ink text-white' : 'border-gray-200 bg-paper-pure text-gray-600 hover:border-ink',
            )}
          >
            Quadro {i + 1}{d.tag && d.tag !== 'neutro' ? ` · ${DIAGRAM_TAG_LABELS[d.tag]}` : ''}
          </button>
        ))}
        <V2Button type="button" variant="ghost" size="sm" onClick={novoQuadro} disabled={diagrams.length >= MAX_DIAGRAMS}>
          <Plus className="h-4 w-4" aria-hidden="true" /> {diagrams.length ? 'Novo quadro' : 'Desenhar um quadro'}
        </V2Button>
        {historico.length > 0 && (
          <V2Button type="button" variant="ghost" size="sm" onClick={desfazer}>
            <Undo2 className="h-4 w-4" aria-hidden="true" /> Desfazer
          </V2Button>
        )}
        <span className="text-xs text-gray-400">{diagrams.length} de {MAX_DIAGRAMS}</span>
      </div>

      {quadro && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-3">
            <div role="toolbar" aria-label="Ferramentas do diagrama" className="flex flex-wrap gap-2">
              {TOOLS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={tool === t.id}
                  onClick={() => trocarFerramenta(t.id)}
                  className={cn(
                    'min-h-[44px] rounded-full border px-3 text-xs font-bold transition-colors',
                    tool === t.id ? 'border-transparent bg-acid text-ink' : 'border-gray-200 bg-paper-pure text-gray-600 hover:border-ink',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <p role="status" className="text-xs text-gray-500">
              {cheio
                ? `Este quadro chegou a ${MAX_ELEMENTS} elementos. Apague algum ou use outro quadro.`
                : tool === 'selecionar'
                  ? 'Toque num elemento para escolher; arraste para mover.'
                  : TWO_TAP.has(tool)
                    ? (pendente ? 'Agora toque onde termina.' : 'Toque onde começa e, depois, onde termina.')
                    : 'Toque na quadra para pôr. Arraste um elemento para mover.'}
            </p>
            <div className="mx-auto max-w-sm">
              <CourtDiagram
                diagram={visto}
                caption={false}
                svgRef={svgRef}
                selectedIndex={sel}
                onCourtPointerDown={aoTocarQuadra}
                onElementPointerDown={aoTocarElemento}
                onPointerMove={aoMover}
                onPointerUp={aoSoltar}
              />
            </div>
            {tool !== 'selecionar' && (
              <V2Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={cheio}
                onClick={() => { setPendente(null); por(defaultElement(tool, quadro.court, elementos)); }}
              >
                Pôr no meio da quadra: {TOOLS.find((t) => t.id === tool)?.label}
              </V2Button>
            )}
          </div>

          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <V2Field label="Vista" htmlFor={`diag-${idx}-vista`}>
                <V2Select
                  id={`diag-${idx}-vista`}
                  value={quadro.court || 'inteira'}
                  onChange={(e) => mudarQuadro({ court: e.target.value })}
                  options={COURT_VIEWS.map((v) => ({ value: v, label: COURT_VIEW_LABELS[v] }))}
                />
              </V2Field>
              <V2Field label="Marca" htmlFor={`diag-${idx}-marca`}>
                <V2Select
                  id={`diag-${idx}-marca`}
                  value={quadro.tag || 'neutro'}
                  onChange={(e) => mudarQuadro({ tag: e.target.value })}
                  options={DIAGRAM_TAGS.map((v) => ({ value: v, label: DIAGRAM_TAG_LABELS[v] }))}
                />
              </V2Field>
              <V2Field label="Título do quadro" htmlFor={`diag-${idx}-titulo`} className="sm:col-span-2">
                <V2Input
                  id={`diag-${idx}-titulo`}
                  maxLength={80}
                  value={quadro.title || ''}
                  onChange={(e) => mudarQuadro({ title: e.target.value })}
                  placeholder="Ex.: Saída da cozinha em dupla"
                />
              </V2Field>
            </div>

            {elementos.length > 0 ? (
              <div>
                <p className="mb-2 text-sm font-semibold text-ink">Elementos ({elementos.length} de {MAX_ELEMENTS})</p>
                <ul className="max-h-48 space-y-1 overflow-y-auto">
                  {elementos.map((el, i) => (
                    <li key={i}>
                      <button
                        type="button"
                        aria-pressed={sel === i}
                        onClick={() => setSel(sel === i ? null : i)}
                        className={cn(
                          'w-full rounded-2xl px-3 py-2 text-left text-xs transition-colors',
                          sel === i ? 'bg-acid/20 font-bold text-ink' : 'text-gray-600 hover:bg-gray-50',
                        )}
                      >
                        {elementName(el)}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-xs text-gray-500">Quadro vazio não é salvo: ponha ao menos um elemento.</p>
            )}

            {escolhido && (
              <div className="space-y-3 rounded-3xl border border-gray-100 bg-paper p-4">
                <p className="text-sm font-bold text-ink">{elementName(escolhido)}</p>
                {COM_ROTULO.has(escolhido.t) && (
                  <V2Field
                    label={escolhido.t === 'texto' ? 'Texto' : 'Rótulo'}
                    htmlFor={`diag-${idx}-rotulo`}
                    hint={escolhido.t === 'texto' ? 'Até 12 letras. Texto vazio some ao salvar.' : 'Até 12 letras.'}
                  >
                    <V2Input
                      id={`diag-${idx}-rotulo`}
                      maxLength={12}
                      value={escolhido.label || ''}
                      onChange={(e) => mudarEscolhido({ label: e.target.value })}
                    />
                  </V2Field>
                )}
                {escolhido.t === 'jogador' && (
                  <V2Field label="Time" htmlFor={`diag-${idx}-time`}>
                    <V2Select
                      id={`diag-${idx}-time`}
                      value={escolhido.team === 'b' ? 'b' : 'a'}
                      onChange={(e) => mudarEscolhido({ team: e.target.value })}
                      options={[{ value: 'a', label: 'Time A' }, { value: 'b', label: 'Time B' }]}
                    />
                  </V2Field>
                )}
                {escolhido.t === 'seta' && (
                  <V2Field label="Tipo de seta" htmlFor={`diag-${idx}-seta`}>
                    <V2Select
                      id={`diag-${idx}-seta`}
                      value={escolhido.style || 'bola'}
                      onChange={(e) => mudarEscolhido({ style: e.target.value })}
                      options={ARROW_STYLES.map((v) => ({ value: v, label: ARROW_STYLE_LABELS[v] }))}
                    />
                  </V2Field>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <IconBtn label="Mover para cima" onClick={() => empurrar(0, -NUDGE)}><ArrowUp className="h-4 w-4" aria-hidden="true" /></IconBtn>
                  <IconBtn label="Mover para baixo" onClick={() => empurrar(0, NUDGE)}><ArrowDown className="h-4 w-4" aria-hidden="true" /></IconBtn>
                  <IconBtn label="Mover para a esquerda" onClick={() => empurrar(-NUDGE, 0)}><ArrowLeft className="h-4 w-4" aria-hidden="true" /></IconBtn>
                  <IconBtn label="Mover para a direita" onClick={() => empurrar(NUDGE, 0)}><ArrowRight className="h-4 w-4" aria-hidden="true" /></IconBtn>
                  <IconBtn
                    label="Apagar elemento"
                    onClick={() => { mudarElementos(removeAt(elementos, sel)); setSel(null); }}
                    className="text-red-600"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </IconBtn>
                </div>
              </div>
            )}

            <V2Button type="button" variant="ghost" size="sm" onClick={apagarQuadro}>
              <Trash2 className="h-4 w-4" aria-hidden="true" /> Apagar este quadro
            </V2Button>
          </div>
        </div>
      )}
    </div>
  );
}
