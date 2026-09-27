/**
 * O DESTAQUE de uma dica na tela: o foco em volta do botão real, a SETA
 * apontando para ele e o cartão com o texto — o mesmo desenho para o passo de
 * um guia e para o ponto de dica aberto.
 *
 * Onde cada peça vai sai de `posicionarDestaque` (geometria pura, testada).
 * Aqui só se mede a tela e o cartão, e se desenha.
 *
 * ## Dentro de um diálogo
 *
 * Um diálogo do Radix (o formulário de criar dia de jogo, a confirmação da
 * reserva) prende o foco, esconde o resto da página do leitor de tela e fecha
 * quando se clica fora dele. Um cartão desenhado por cima, fora do diálogo,
 * não receberia clique nem foco — e clicar nele FECHARIA o formulário que o
 * guia está ensinando a preencher. Então, quando o alvo está num diálogo do
 * Radix, o cartão entra NO PRÓPRIO diálogo, preso ao rodapé (sticky), e o
 * foco e a seta continuam por cima, só desenhados (não tocam em nada). O
 * diálogo já escurece o fundo; aqui não se escurece de novo.
 *
 * O escurecimento e a seta são `aria-hidden` e não recebem clique: o botão
 * destacado continua clicável — é para a pessoa clicar nele de verdade.
 */
import React, { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/core/lib/utils';
import { posicionarDestaque, retanguloDoFoco, retanguloVisivel } from '@/modules/help/domain/dicasPosicao';
import { dialogoDe } from './alvoNaTela';

/** Largura do cartão na tela grande. */
const LARGURA_CARTAO = 360;

function useJanela() {
  const [tela, setTela] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useLayoutEffect(() => {
    const aoMudar = () => setTela({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', aoMudar);
    return () => window.removeEventListener('resize', aoMudar);
  }, []);
  return tela;
}

const ROTACAO = { baixo: 0, cima: 180, esquerda: 90, direita: -90 };

/** A seta: desenhada apontando para baixo e girada para o lado do alvo. */
export function SetaDica({ x, y, aponta }) {
  return (
    <div
      className="absolute h-8 w-8 transition-[top,left] duration-200 motion-reduce:transition-none"
      style={{ left: x, top: y, transform: `rotate(${ROTACAO[aponta] ?? 0}deg)` }}
    >
      <svg viewBox="0 0 32 32" className="h-8 w-8 text-acid drop-shadow-md motion-safe:animate-dica-seta" aria-hidden="true">
        <path
          d="M16 30 L3.5 16.5 H11 V2.5 H21 V16.5 H28.5 Z"
          fill="currentColor"
          stroke="#0b0f14"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

/** O foco em volta do alvo, com (ou sem) o resto da tela escurecido. */
function Foco({ foco, escurecer }) {
  return (
    <div
      className="absolute rounded-2xl transition-all duration-200 motion-reduce:transition-none"
      style={{
        top: foco.top,
        left: foco.left,
        width: foco.width,
        height: foco.height,
        boxShadow: escurecer ? '0 0 0 200vmax rgba(7, 10, 14, 0.52)' : undefined,
      }}
    >
      <div className="absolute inset-0 rounded-2xl ring-4 ring-acid" />
      <div className="absolute -inset-1.5 rounded-[1.1rem] ring-2 ring-acid/40 motion-safe:animate-pulse" />
    </div>
  );
}

/**
 * @param {object} props
 * @param {Element|null} props.el o alvo (ou `null`: cartão no centro, sem seta)
 * @param {object|null} props.rect o retângulo do alvo
 * @param {React.ReactNode} props.children o conteúdo do cartão
 * @param {string} props.tituloId id do título, para o `aria-labelledby`
 * @param {React.Ref} [props.cartaoRef]
 * @param {string} [props.chave] muda a cada passo (reinicia a animação de entrada)
 */
export default function Destaque({ el, rect, children, tituloId, cartaoRef, chave }) {
  const tela = useJanela();
  const localRef = useRef(null);
  const ref = cartaoRef || localRef;
  const [tamanho, setTamanho] = useState({ w: LARGURA_CARTAO, h: 200 });

  const dialogo = el ? dialogoDe(el) : null;
  // Só o diálogo do Radix prende foco e fecha com clique fora; os diálogos
  // feitos à mão (o do dia no calendário) aceitam o cartão por cima.
  const dialogoRadix = dialogo && dialogo.hasAttribute('data-state') ? dialogo : null;

  useLayoutEffect(() => {
    const no = ref.current;
    if (!no || dialogoRadix) return;
    const r = no.getBoundingClientRect();
    if (Math.abs(r.width - tamanho.w) > 1 || Math.abs(r.height - tamanho.h) > 1) {
      setTamanho({ w: r.width, h: r.height });
    }
  });

  const alvoVisivel = rect && retanguloVisivel(rect, tela) ? rect : null;

  if (dialogoRadix) {
    const foco = alvoVisivel ? retanguloDoFoco(alvoVisivel, tela) : null;
    const setaY = foco ? Math.max(8, foco.top - 40) : 0;
    return (
      <>
        {createPortal(
          <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[60]">
            {foco && <Foco foco={foco} escurecer={false} />}
            {foco && <SetaDica x={Math.round(foco.left + foco.width / 2 - 16)} y={setaY} aponta="baixo" />}
          </div>,
          document.body,
        )}
        {createPortal(
          <div
            ref={ref}
            key={chave}
            role="dialog"
            aria-modal="false"
            aria-labelledby={tituloId}
            data-dica-faixa=""
            // Clique e foco aqui dentro não podem "vazar" para o diálogo como
            // se fossem de fora (ele fecharia o formulário).
            onPointerDown={(e) => e.stopPropagation()}
            onFocus={(e) => e.stopPropagation()}
            className="sticky bottom-0 z-10 rounded-3xl border-2 border-acid bg-paper-pure p-4 shadow-xl motion-safe:animate-dica-entrada"
            style={{ pointerEvents: 'auto' }}
          >
            {children}
          </div>,
          dialogoRadix,
        )}
      </>
    );
  }

  const pos = posicionarDestaque({ alvo: alvoVisivel, cartao: tamanho, tela });
  const largura = Math.min(LARGURA_CARTAO, tela.w - 24);

  return createPortal(
    <>
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[60]">
        {pos.foco ? <Foco foco={pos.foco} escurecer /> : <div className="absolute inset-0 bg-[rgba(7,10,14,0.35)]" />}
        {pos.seta && <SetaDica x={pos.seta.x} y={pos.seta.y} aponta={pos.seta.aponta} />}
      </div>
      <div
        ref={ref}
        key={chave}
        role="dialog"
        aria-modal="false"
        aria-labelledby={tituloId}
        className={cn(
          'fixed z-[61] rounded-3xl border border-gray-100 bg-paper-pure p-4 shadow-2xl motion-safe:animate-dica-entrada sm:p-5',
          'transition-[top,left] duration-200 motion-reduce:transition-none',
        )}
        style={{ left: pos.cartao.x, top: pos.cartao.y, width: largura, pointerEvents: 'auto' }}
      >
        {children}
      </div>
    </>,
    document.body,
  );
}
