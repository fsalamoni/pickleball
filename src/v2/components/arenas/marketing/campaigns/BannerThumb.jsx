/**
 * A MINIATURA de um banner (Onda CC): o banner de verdade, desenhado na
 * largura de computador e REDUZIDO em escala.
 *
 * Desenhar o banner direto em 176 px não serve: o texto tem tamanho mínimo
 * (para ser legível no celular), então numa caixa tão pequena o título
 * transborda e é cortado no meio — a miniatura deixa de parecer o banner que
 * ela representa. Reduzindo o desenho inteiro, a miniatura é o banner, só
 * menor.
 *
 * É decorativa (`aria-hidden`): quem a usa (o botão do modelo, a linha da
 * campanha) já tem o nome acessível.
 */
import React from 'react';
import BannerArt from './BannerArt';

/** A largura em que o banner é desenhado antes de reduzir. */
const LARGURA_BASE = 640;

export default function BannerThumb({ banner, cta = '', arenaName = '', width = 176, className }) {
  const escala = width / LARGURA_BASE;
  return (
    <div
      aria-hidden
      className={className}
      style={{ width, height: width / 2, overflow: 'hidden', borderRadius: 12, position: 'relative' }}
    >
      <div style={{ width: LARGURA_BASE, transform: `scale(${escala})`, transformOrigin: 'top left', pointerEvents: 'none' }}>
        <BannerArt banner={banner} cta={cta} arenaName={arenaName} ratio="wide" className="rounded-none" />
      </div>
    </div>
  );
}
