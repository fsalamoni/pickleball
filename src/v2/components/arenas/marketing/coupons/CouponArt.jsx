/**
 * O TÍQUETE do cupom (Onda CD) — o mesmo na página da arena, na tela inicial,
 * na lista da Central e na pré-visualização do editor.
 *
 * Parte principal: o que o cupom dá (em branco na arte, vale o benefício do
 * próprio cupom). Canhoto, do outro lado do picote: o CÓDIGO — sempre o de
 * verdade, montado aqui, nunca desenhado numa imagem. Com `copyable`, o
 * código do canhoto é o botão de copiar.
 *
 * O tíquete responde à própria largura (container query): largo, o canhoto
 * fica ao lado; estreito (carrossel, celular), ele desce e vira uma faixa —
 * um canhoto de 90 px espremido ao lado cortaria o código.
 */
import React from 'react';
import { ImageIcon } from 'lucide-react';
import {
  COUPON_ART_SOURCE, COUPON_ART_STYLE, couponArtOf, couponArtTexts, stubInk,
} from '@/modules/arenas/domain/couponArt';
import { contrastRatio } from '@/modules/arenas/domain/bannerArt';
import { cn } from '@/core/lib/utils';
import CopyCodeButton from '@/v2/ui/CopyCodeButton';

const FONTE = {
  kicker: 'clamp(10px, 2.6cqw, 13px)',
  title: 'clamp(18px, 6cqw, 34px)',
  subtitle: 'clamp(11px, 2.9cqw, 15px)',
  rodape: 'clamp(10px, 2.4cqw, 12px)',
};

/** Estreito: o canhoto desce. É container query — a largura do TÍQUETE. */
const ESTREITO = '[@container(max-width:430px)]';

/** O desenho de fundo de cada estilo — enfeite, nunca informação. */
function Padrao({ style, accent, fg }) {
  if (style === COUPON_ART_STYLE.QUADRA) {
    // As linhas da quadra: o contorno e a linha da "cozinha" à direita —
    // longe do título, para o enfeite nunca atravessar o que se lê.
    return (
      <div aria-hidden className="pointer-events-none absolute inset-2.5 rounded-md border-2 opacity-25" style={{ borderColor: fg }}>
        <div className="absolute inset-y-0 right-[18%] border-l-2" style={{ borderColor: fg }} />
      </div>
    );
  }
  if (style === COUPON_ART_STYLE.FESTA) {
    return (
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-30"
        style={{ backgroundImage: `radial-gradient(${accent} 1.5px, transparent 1.6px)`, backgroundSize: '14px 14px' }} />
    );
  }
  if (style === COUPON_ART_STYLE.NEON) {
    return (
      <div aria-hidden className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full opacity-30 blur-[50px]"
        style={{ background: accent }} />
    );
  }
  if (style === COUPON_ART_STYLE.SOL) {
    return (
      <div aria-hidden className="pointer-events-none absolute -bottom-16 -left-10 h-44 w-44 rounded-full opacity-40"
        style={{ background: `radial-gradient(circle, ${accent} 0%, transparent 70%)` }} />
    );
  }
  return (
    <div aria-hidden className="pointer-events-none absolute inset-2 rounded-lg border opacity-30"
      style={{ borderColor: fg }} />
  );
}

/**
 * @param {{
 *   code: string, benefit?: string, description?: string, kicker?: string,
 *   footer?: string, arenaName?: string,
 *   coupon?: object, art?: object|null,
 *   copyable?: boolean, copyMessage?: string, notch?: string, className?: string,
 * }} props
 *   `coupon` (com `art`) OU `art` direto (a pré-visualização do editor).
 *   `notch` é a cor do fundo por trás do tíquete (os dois "furos" do picote).
 */
export default function CouponArt({
  code, benefit = '', description = '', kicker = '', footer = '', arenaName = '',
  coupon = null, art, copyable = false, copyMessage, notch = 'bg-paper', className,
}) {
  const a = couponArtOf(coupon, art);
  const imagem = a.source === COUPON_ART_SOURCE.UPLOAD && a.image_url;
  const d = a.design || {};
  const t = couponArtTexts(d, { benefit, description, kicker });
  const bg = imagem ? '#0b0b0c' : d.bg;
  const fg = imagem ? '#ffffff' : d.fg;
  const accent = d.accent || '#0f766e';
  const tinta = stubInk(accent);
  const rodape = [arenaName, footer].filter(Boolean).join(' · ');
  // A chamada vai na cor de destaque — a não ser que ela suma no fundo (o
  // creme do Sol sobre o laranja): aí vai na cor do texto.
  const corDaChamada = contrastRatio(accent, bg) >= 3 ? accent : fg;

  return (
    <div className={cn('w-full', className)} style={{ containerType: 'inline-size' }}>
      <div className={cn('relative flex w-full overflow-hidden rounded-2xl shadow-sm', `${ESTREITO}:flex-col`)}>
        {/* A parte principal */}
        <div className="relative min-w-0 flex-1 overflow-hidden" style={{ background: bg, color: fg }}>
          {imagem ? (
            <img src={a.image_url} alt={a.alt || t.title} className="block aspect-[2/1] h-full w-full object-cover" loading="lazy" />
          ) : a.source === COUPON_ART_SOURCE.UPLOAD ? (
            <div className="flex aspect-[2/1] items-center justify-center opacity-60"><ImageIcon className="h-8 w-8" aria-hidden /></div>
          ) : (
            <>
              <Padrao style={d.style} accent={accent} fg={fg} />
              <div className="relative flex h-full min-h-[7.5rem] flex-col justify-center gap-1 p-[clamp(14px,4.5cqw,26px)]">
                {t.kicker && (
                  <p className="font-bold uppercase tracking-widest" style={{ fontSize: FONTE.kicker, color: corDaChamada }}>
                    {t.kicker}
                  </p>
                )}
                <p className="line-clamp-2 font-display font-black leading-[1.05]" style={{ fontSize: FONTE.title }}>{t.title}</p>
                {t.subtitle && (
                  <p className="line-clamp-2 opacity-90" style={{ fontSize: FONTE.subtitle, lineHeight: 1.3 }}>{t.subtitle}</p>
                )}
                {rodape && (
                  <p className="mt-1 truncate font-semibold opacity-75" style={{ fontSize: FONTE.rodape }}>{rodape}</p>
                )}
              </div>
            </>
          )}
        </div>

        {/* O canhoto: o código, do outro lado do picote */}
        <div
          className={cn(
            'relative flex w-[30%] min-w-[118px] max-w-[200px] shrink-0 flex-col items-center justify-center gap-1 border-l-2 border-dashed px-3 py-4 text-center',
            `${ESTREITO}:w-full ${ESTREITO}:max-w-none ${ESTREITO}:flex-row ${ESTREITO}:justify-between ${ESTREITO}:border-l-0 ${ESTREITO}:border-t-2 ${ESTREITO}:py-2.5`,
          )}
          style={{ background: accent, color: tinta, borderColor: tinta === '#ffffff' ? 'rgba(255,255,255,.55)' : 'rgba(11,11,12,.35)' }}
        >
          {/* Os dois furos do picote */}
          <span aria-hidden className={cn('absolute -left-[9px] -top-[9px] h-4 w-4 rounded-full', notch, `${ESTREITO}:-left-[9px] ${ESTREITO}:-top-[9px]`)} />
          <span aria-hidden className={cn('absolute -bottom-[9px] -left-[9px] h-4 w-4 rounded-full', notch, `${ESTREITO}:-right-[9px] ${ESTREITO}:bottom-auto ${ESTREITO}:left-auto ${ESTREITO}:-top-[9px]`)} />
          <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Código</span>
          {copyable ? (
            <CopyCodeButton code={code} size="sm" tone="clear" className="max-w-full" successMessage={copyMessage} />
          ) : (
            <span className="max-w-full break-all font-display text-sm font-black tracking-widest">{code || '—'}</span>
          )}
        </div>
      </div>
    </div>
  );
}
