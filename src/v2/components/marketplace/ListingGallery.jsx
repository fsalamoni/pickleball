/**
 * MERCADO — a galeria do anúncio: foto grande (toque amplia), miniaturas e o
 * vídeo (enviado ou link do YouTube/Vimeo, sem cookie de rastreio). As setas
 * do teclado trocam a foto quando a galeria está em foco.
 */
import React, { useState } from 'react';
import { Box, ChevronLeft, ChevronRight, PlayCircle } from 'lucide-react';
import { cn } from '@/core/lib/utils';
import { parseVideoLink } from '@/modules/marketplace/domain/listing';
import { PhotoLightbox } from '@/components/ui/photo-lightbox';

export default function ListingGallery({ listing }) {
  const media = [...(listing.media || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const link = parseVideoLink(listing.video_link);
  const itens = [...media, ...(link ? [{ kind: 'link', ...link }] : [])];
  const [i, setI] = useState(0);
  const atual = itens[Math.min(i, itens.length - 1)];
  const passo = (d) => setI((x) => (x + d + itens.length) % itens.length);

  if (!itens.length) {
    return <div className="flex aspect-square items-center justify-center rounded-3xl bg-paper text-gray-300"><Box className="h-16 w-16" /></div>;
  }

  return (
    <div
      className="space-y-3"
      role="group"
      aria-roledescription="galeria"
      aria-label={`Fotos de ${listing.title}`}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') passo(1);
        if (e.key === 'ArrowLeft') passo(-1);
      }}
    >
      <div className="relative aspect-square overflow-hidden rounded-3xl bg-paper">
        {atual.kind === 'image' && (
          <PhotoLightbox
            src={atual.url}
            alt={atual.alt || listing.title}
            title={listing.title}
            trigger={(
              <button type="button" className="block h-full w-full cursor-zoom-in" aria-label="Ampliar a foto">
                <img src={atual.url} alt={atual.alt || listing.title} className="h-full w-full object-contain" />
              </button>
            )}
          />
        )}
        {atual.kind === 'video' && (
          <video src={atual.url} controls playsInline className="h-full w-full bg-black object-contain" />
        )}
        {atual.kind === 'link' && (
          <iframe
            src={atual.embed}
            title={`Vídeo de ${listing.title}`}
            className="h-full w-full"
            allow="encrypted-media; picture-in-picture; fullscreen"
            referrerPolicy="strict-origin-when-cross-origin"
            loading="lazy"
          />
        )}
        {itens.length > 1 && (
          <>
            <button type="button" onClick={() => passo(-1)} aria-label="Foto anterior" className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-paper-pure/90 text-ink shadow">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button type="button" onClick={() => passo(1)} aria-label="Próxima foto" className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-paper-pure/90 text-ink shadow">
              <ChevronRight className="h-5 w-5" />
            </button>
            <span className="absolute bottom-3 right-3 rounded-full bg-ink/80 px-3 py-1 text-xs font-bold text-white">{i + 1}/{itens.length}</span>
          </>
        )}
      </div>
      {itens.length > 1 && (
        <ul className="flex gap-2 overflow-x-auto pb-1">
          {itens.map((m, k) => (
            <li key={`${m.url || m.embed}-${k}`} className="shrink-0">
              <button
                type="button"
                onClick={() => setI(k)}
                aria-label={m.kind === 'image' ? `Foto ${k + 1}` : 'Vídeo'}
                aria-current={k === i ? 'true' : undefined}
                className={cn('relative h-16 w-16 overflow-hidden rounded-xl border-2 bg-paper', k === i ? 'border-ink' : 'border-transparent')}
              >
                {m.kind === 'image'
                  ? <img src={m.thumb_url || m.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                  : <span className="flex h-full w-full items-center justify-center text-ink"><PlayCircle className="h-7 w-7" /></span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
