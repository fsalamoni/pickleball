/**
 * Os PONTOS DE DICA na tela: uma bolinha pulsando no canto de cada botão que
 * tem dica — só com as dicas ligadas, só para botões que estão À VISTA.
 *
 * - O ponto já visto para de pulsar e fica mais discreto (continua lá: quem
 *   esqueceu pode tocar de novo).
 * - Com um diálogo aberto, os pontos se recolhem (o diálogo é o assunto).
 * - Ponto de botão escondido debaixo do topo fixo, ou fora da área de
 *   rolagem, não aparece — um ponto flutuando sobre o cabeçalho confunde mais
 *   do que ajuda.
 * - Acompanha a rolagem e as mudanças da tela sem pesar: mede num quadro de
 *   animação e, de resto, a cada segundo.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { cn } from '@/core/lib/utils';
import { MAX_PONTOS_POR_TELA } from '@/modules/help/domain/pontosDeDica';
import { dialogoDe, elementoVisivel, haDialogoAberto } from './alvoNaTela';

const TAMANHO = 28;
const escapar = (s) => (typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(s) : s);

/** A área em que o ponto pode aparecer: a de rolagem do elemento, ou a janela. */
function areaVisivel(el) {
  const main = document.getElementById('conteudo-principal');
  if (main && main.contains(el)) {
    const r = main.getBoundingClientRect();
    return { top: r.top, left: r.left, right: r.right, bottom: r.bottom };
  }
  return { top: 0, left: 0, right: window.innerWidth, bottom: window.innerHeight };
}

/** Onde desenhar cada ponto agora. */
function medirPontos(pontos) {
  if (haDialogoAberto()) return [];
  const saida = [];
  for (const p of pontos) {
    if (saida.length >= MAX_PONTOS_POR_TELA) break;
    const els = document.querySelectorAll(`[data-dica="${escapar(p.target)}"]`);
    const el = [...els].find((e) => !dialogoDe(e) && elementoVisivel(e));
    if (!el) continue;
    const r = el.getBoundingClientRect();
    const area = areaVisivel(el);
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    if (cy < area.top || cy > area.bottom || cx < area.left || cx > area.right) continue;
    saida.push({
      ...p,
      x: Math.round(Math.min(Math.max(r.right - TAMANHO / 2 - 2, 4), window.innerWidth - TAMANHO - 4)),
      y: Math.round(Math.max(r.top - TAMANHO / 2 + 2, area.top + 2)),
    });
  }
  return saida;
}

export default function PontosNaTela({ pontos, vistos, onAbrir }) {
  const [posicoes, setPosicoes] = useState([]);
  const ids = useMemo(() => pontos.map((p) => p.id).join('|'), [pontos]);

  useEffect(() => {
    let quadro = null;
    const medir = () => {
      quadro = null;
      const nova = medirPontos(pontos);
      setPosicoes((antes) => {
        const igual = antes.length === nova.length && antes.every((a, i) => a.id === nova[i].id && a.x === nova[i].x && a.y === nova[i].y);
        return igual ? antes : nova;
      });
    };
    const agendar = () => { if (quadro == null) quadro = requestAnimationFrame(medir); };
    medir();
    const intervalo = setInterval(medir, 1000);
    const obs = typeof MutationObserver !== 'undefined' ? new MutationObserver(agendar) : null;
    obs?.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('scroll', agendar, true);
    window.addEventListener('resize', agendar);
    return () => {
      clearInterval(intervalo);
      obs?.disconnect();
      if (quadro != null) cancelAnimationFrame(quadro);
      window.removeEventListener('scroll', agendar, true);
      window.removeEventListener('resize', agendar);
    };
  }, [ids]); // eslint-disable-line react-hooks/exhaustive-deps

  if (posicoes.length === 0) return null;
  const visto = new Set(vistos);

  return (
    <div aria-label="Dicas desta tela" role="group" className="pointer-events-none fixed inset-0 z-[35]">
      {posicoes.map((p) => {
        const jaViu = visto.has(p.id);
        return (
          <button
            key={p.id}
            type="button"
            data-ponto-dica={p.id}
            onClick={() => onAbrir(p.id)}
            aria-label={`Dica: ${p.title}`}
            title={`Dica: ${p.title}`}
            className="pointer-events-auto absolute flex items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acid/50"
            style={{ left: p.x, top: p.y, width: TAMANHO, height: TAMANHO }}
          >
            {!jaViu && (
              <span className="absolute h-3.5 w-3.5 rounded-full bg-acid motion-safe:animate-dica-anel" aria-hidden="true" />
            )}
            <span
              className={cn(
                'relative rounded-full border-2 border-[#0b0f14] bg-acid shadow-md transition-transform hover:scale-110',
                jaViu ? 'h-2.5 w-2.5 opacity-70' : 'h-3.5 w-3.5',
              )}
              aria-hidden="true"
            />
          </button>
        );
      })}
    </div>
  );
}
