/**
 * Mídia da ficha: imagem, vídeo do YouTube/Vimeo e vídeo enviado.
 *
 * O vídeo de fora entra por FACHADA: só a miniatura e um botão. O `iframe`
 * (youtube-nocookie / player.vimeo) só é montado depois do toque — nada de
 * rastreio nem 1 MB de player para quem só passou pela ficha. O endereço do
 * player sai de `parseVideoUrl` (o id validado), nunca do texto gravado.
 *
 * O player fica escuro nos dois modos (`tema-claro` mantém o `bg-ink` escuro):
 * é uma tela de vídeo, não uma superfície da página.
 */
import React, { useState } from 'react';
import { CircleCheck, CircleX, ImageOff, Play } from 'lucide-react';
import { cn } from '@/core/lib/utils';
import { MEDIA_TAG_LABELS, formatTimeSeconds, parseVideoUrl } from '@/modules/training/domain/media';

/** "Certo"/"Errado" com ícone e palavra — nunca só a cor. */
export function TagChip({ tag, className }) {
  if (tag !== 'certo' && tag !== 'errado') return null;
  const certo = tag === 'certo';
  const Icon = certo ? CircleCheck : CircleX;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold',
        certo ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800',
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" /> {MEDIA_TAG_LABELS[tag]}
    </span>
  );
}

function trechoTexto(start, end) {
  if (start && end) return `Trecho ${formatTimeSeconds(start)}–${formatTimeSeconds(end)}`;
  if (start) return `A partir de ${formatTimeSeconds(start)}`;
  return '';
}

function VideoFacade({ video, caption }) {
  const [tocando, setTocando] = useState(false);
  const nome = caption || 'vídeo do item';
  // O fim do trecho no Vimeo não tem parâmetro: fica no texto ao lado.
  return (
    <div className="tema-claro">
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-ink">
        {tocando ? (
          <iframe
            src={video.embedUrl}
            title={`Vídeo: ${nome}`}
            className="absolute inset-0 h-full w-full"
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <button
            type="button"
            data-dica="treino-item-video"
            aria-label={`Reproduzir vídeo: ${nome}`}
            onClick={() => setTocando(true)}
            className="group absolute inset-0 flex h-full w-full items-center justify-center focus:outline-none focus-visible:ring-4 focus-visible:ring-acid"
          >
            {video.thumbUrl && (
              <img src={video.thumbUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-80" />
            )}
            <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-acid text-ink shadow-lg transition-transform group-hover:scale-105">
              <Play className="ml-1 h-7 w-7 fill-current" aria-hidden="true" />
            </span>
            <span className="absolute bottom-2 left-2 rounded-full bg-ink/80 px-2 py-0.5 text-xs font-semibold text-white">
              {video.provider === 'vimeo' ? 'Vimeo' : 'YouTube'}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

function ImageTile({ media }) {
  const [falhou, setFalhou] = useState(false);
  if (falhou) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-200 text-sm text-gray-500">
        <ImageOff className="h-5 w-5" aria-hidden="true" />
        Não foi possível carregar a imagem.
      </div>
    );
  }
  return (
    <img
      src={media.url}
      alt={media.caption || 'Imagem do item'}
      loading="lazy"
      onError={() => setFalhou(true)}
      className="block w-full rounded-2xl border border-gray-100 object-contain"
    />
  );
}

/** Uma mídia com legenda e o rótulo certo/errado. */
export function MediaTile({ media, className }) {
  let corpo = null;
  let trecho = '';
  if (media.type === 'image') {
    corpo = <ImageTile media={media} />;
  } else {
    const video = parseVideoUrl(media.url, { start: media.start, end: media.end });
    if (!video) return null;
    trecho = trechoTexto(video.start, video.end);
    if (video.embedUrl) {
      corpo = <VideoFacade video={video} caption={media.caption} />;
    } else {
      const frag = video.start || video.end ? `#t=${video.start || 0}${video.end ? `,${video.end}` : ''}` : '';
      corpo = (
        <div className="tema-claro">
          <video
            controls
            preload="none"
            playsInline
            src={`${video.url}${frag}`}
            aria-label={media.caption ? `Vídeo: ${media.caption}` : 'Vídeo do item'}
            className="block aspect-video w-full rounded-2xl bg-ink"
          />
        </div>
      );
    }
  }
  return (
    <figure className={cn('min-w-0', className)}>
      {corpo}
      {(media.caption || trecho || media.tag === 'certo' || media.tag === 'errado') && (
        <figcaption className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-600">
          <TagChip tag={media.tag} />
          {media.caption && <span className="font-medium">{media.caption}</span>}
          {trecho && <span className="text-xs text-gray-400">{trecho}</span>}
        </figcaption>
      )}
    </figure>
  );
}

export function MediaGallery({ media = [], className }) {
  if (!media.length) return null;
  return (
    <div className={cn('grid gap-4', media.length > 1 && 'sm:grid-cols-2', className)}>
      {media.map((m, i) => <MediaTile key={`${m.url}-${i}`} media={m} />)}
    </div>
  );
}
