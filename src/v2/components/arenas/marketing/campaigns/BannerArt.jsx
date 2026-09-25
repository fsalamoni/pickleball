/**
 * O DESENHO de um banner de campanha (Onda CC) — o mesmo na página da arena,
 * na tela inicial, na página da campanha e na pré-visualização do editor.
 *
 * O texto escala pela largura do PRÓPRIO banner (unidade `cqw`, com o banner
 * como container), não pela da tela: o mesmo banner aparece largo na página
 * da arena e estreito no carrossel da tela inicial, e fonte presa à tela
 * ficaria enorme num e miúda no outro. Navegador sem `cqw` ignora o estilo e
 * fica com o tamanho da classe — legível do mesmo jeito.
 *
 * Proporção: 2:1 no computador e 16:9 no celular (`ratio="auto"`), ou fixa
 * (`wide` / `phone`) na pré-visualização do editor, que mostra os dois.
 */
import React from 'react';
import { ImageIcon } from 'lucide-react';
import { normalizeHex, readableInk } from '@/modules/arenas/domain/whiteLabel';
import { ART_LAYOUT } from '@/modules/arenas/domain/bannerArt';
import { BANNER_SOURCE } from '@/modules/arenas/domain/campaignBanner';
import { cn } from '@/core/lib/utils';

const RATIO = {
  auto: 'aspect-[16/9] sm:aspect-[2/1]',
  wide: 'aspect-[2/1]',
  phone: 'aspect-[16/9]',
};

/** Tamanhos que acompanham a largura do banner (cqw), com piso e teto. */
const FONTE = {
  kicker: 'clamp(10px, 2.3cqw, 15px)',
  title: 'clamp(17px, 5.8cqw, 46px)',
  subtitle: 'clamp(11px, 2.5cqw, 18px)',
  cta: 'clamp(11px, 2.3cqw, 16px)',
  oferta: 'clamp(24px, 9cqw, 88px)',
  tituloOferta: 'clamp(15px, 4.4cqw, 38px)',
  data: 'clamp(15px, 5cqw, 40px)',
  espaco: 'clamp(12px, 4.6cqw, 40px)',
};

/**
 * Banner ESTREITO (o do celular, o do carrossel): o texto de apoio cabe numa
 * linha só. É uma container query — responde à largura do banner, não da tela.
 */
const ESTREITO_1_LINHA = '[@container(max-width:520px)]:line-clamp-1';
const ESTREITO_SOME = '[@container(max-width:520px)]:hidden';

/** Uma cor um pouco mais escura, para o degradê do Chamado. */
function escurece(hex, fator = 0.28) {
  const h = normalizeHex(hex) || '#0b0b0c';
  const c = [1, 3, 5].map((i) => Math.round(parseInt(h.slice(i, i + 2), 16) * (1 - fator)));
  return `#${c.map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

function Chamada({ d }) {
  if (!d.kicker) return null;
  return (
    <p className="font-bold uppercase tracking-widest" style={{ fontSize: FONTE.kicker, color: d.accent }}>
      {d.kicker}
    </p>
  );
}

function Titulo({ d, className, fontSize = FONTE.title }) {
  return (
    <p className={cn('line-clamp-3 font-display font-black leading-[1.05]', className)} style={{ fontSize }}>
      {d.title || 'Título do banner'}
    </p>
  );
}

function Texto({ d, className }) {
  if (!d.subtitle) return null;
  return (
    <p className={cn('line-clamp-2 opacity-90', ESTREITO_1_LINHA, className)} style={{ fontSize: FONTE.subtitle, lineHeight: 1.3 }}>
      {d.subtitle}
    </p>
  );
}

function Rodape({ d, cta, arenaName }) {
  if (!cta && !arenaName) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {cta && (
        <span
          className="inline-flex items-center whitespace-nowrap rounded-full font-bold"
          style={{
            fontSize: FONTE.cta,
            backgroundColor: d.accent,
            color: readableInk(d.accent),
            padding: '0.55em 1.2em',
          }}
        >
          {cta}
        </span>
      )}
      {arenaName && (
        <span className="truncate font-semibold opacity-75" style={{ fontSize: FONTE.kicker }}>{arenaName}</span>
      )}
    </div>
  );
}

function Destaque({ d, cta, arenaName }) {
  return (
    <>
      <div className="pointer-events-none absolute -right-[8%] -top-[30%] h-[90%] w-[45%] rounded-full opacity-30 blur-[60px]"
        style={{ backgroundColor: d.accent }} />
      <div className="relative flex h-full flex-col justify-between">
        <div className="space-y-[0.4em]">
          <Chamada d={d} />
          <Titulo d={d} className="max-w-[85%]" />
          <Texto d={d} className="max-w-[80%]" />
        </div>
        <Rodape d={d} cta={cta} arenaName={arenaName} />
      </div>
    </>
  );
}

function Oferta({ d, cta, arenaName }) {
  return (
    <div className="relative flex h-full items-center gap-[4cqw]">
      <p className="max-w-[42%] shrink-0 break-words font-display font-black leading-[0.92] tracking-tight" style={{ fontSize: FONTE.oferta }}>
        {d.highlight || '%'}
      </p>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-[0.45em] overflow-hidden">
        <Chamada d={d} />
        <Titulo d={d} fontSize={FONTE.tituloOferta} />
        <Texto d={d} />
        <Rodape d={d} cta={cta} arenaName={arenaName} />
      </div>
    </div>
  );
}

function Evento({ d, cta, arenaName }) {
  const [dia, ...resto] = String(d.highlight || '').split(/\s+/);
  return (
    <div className="relative flex h-full items-center gap-[4cqw]">
      <div
        className="flex shrink-0 flex-col items-center justify-center rounded-[1.1em] text-center font-display font-black leading-none"
        style={{
          fontSize: FONTE.data,
          backgroundColor: d.accent,
          color: readableInk(d.accent),
          width: '4.2em',
          height: '4.2em',
        }}
      >
        <span>{dia || '—'}</span>
        {resto.length > 0 && <span style={{ fontSize: '0.55em' }} className="mt-[0.15em] tracking-widest">{resto.join(' ')}</span>}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-[0.5em] overflow-hidden">
        <Chamada d={d} />
        <Titulo d={d} />
        <Texto d={d} />
        <Rodape d={d} cta={cta} arenaName={arenaName} />
      </div>
    </div>
  );
}

function Vitrine({ d, cta, arenaName }) {
  return (
    <div className="relative flex h-full gap-[4cqw]">
      <div className="flex min-w-0 flex-[1.3] flex-col justify-between">
        <div className="space-y-[0.4em]">
          <Chamada d={d} />
          <Titulo d={d} />
          <Texto d={d} />
        </div>
        <Rodape d={d} cta={cta} arenaName={arenaName} />
      </div>
      <div className="relative flex-1 overflow-hidden rounded-[1.2em]" style={{ backgroundColor: `${d.accent}22` }}>
        {d.image_url ? (
          <img src={d.image_url} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center" style={{ color: d.accent }}>
            <ImageIcon className="h-1/4 w-1/4 opacity-60" aria-hidden />
          </div>
        )}
      </div>
    </div>
  );
}

function Chamado({ d, cta, arenaName }) {
  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-[0.5em] overflow-hidden text-center">
      <Chamada d={d} />
      <Titulo d={d} className="max-w-[90%]" />
      <Texto d={d} className="max-w-[80%]" />
      {cta && <div className="mt-[0.2em]"><Rodape d={d} cta={cta} /></div>}
      {arenaName && <span className={cn('font-semibold opacity-75', ESTREITO_SOME)} style={{ fontSize: FONTE.kicker }}>{arenaName}</span>}
    </div>
  );
}

const LAYOUTS = {
  [ART_LAYOUT.DESTAQUE]: Destaque,
  [ART_LAYOUT.OFERTA]: Oferta,
  [ART_LAYOUT.EVENTO]: Evento,
  [ART_LAYOUT.VITRINE]: Vitrine,
  [ART_LAYOUT.CHAMADO]: Chamado,
};

/**
 * @param {{
 *   banner: { source: 'design'|'upload', design?: object, image_url?: string, alt?: string },
 *   cta?: string, arenaName?: string, ratio?: 'auto'|'wide'|'phone', className?: string,
 *   safeArea?: boolean,
 * }} props
 */
export default function BannerArt({ banner, cta = '', arenaName = '', ratio = 'auto', className, safeArea = false }) {
  const base = cn('relative w-full overflow-hidden rounded-3xl', RATIO[ratio] || RATIO.auto, className);

  if (banner?.source === BANNER_SOURCE.UPLOAD) {
    return (
      <div className={cn(base, 'bg-gray-100')}>
        {banner.image_url && (
          <img src={banner.image_url} alt={banner.alt || ''} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
        )}
        {safeArea && (
          <div className="pointer-events-none absolute inset-y-[15%] inset-x-[10%] rounded-lg border-2 border-dashed border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.25)]">
            <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white">área segura</span>
          </div>
        )}
      </div>
    );
  }

  const d = banner?.design || {};
  const Layout = LAYOUTS[d.layout] || Destaque;
  const fundo = d.layout === ART_LAYOUT.CHAMADO
    ? `linear-gradient(135deg, ${d.bg} 0%, ${escurece(d.bg)} 100%)`
    : d.bg;
  return (
    <div className={base} style={{ background: fundo, color: d.fg, containerType: 'inline-size' }}>
      <div className="absolute inset-0" style={{ padding: FONTE.espaco }}>
        <Layout d={d} cta={cta} arenaName={arenaName} />
      </div>
    </div>
  );
}
