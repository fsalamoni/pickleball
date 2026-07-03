import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/core/lib/utils';

export function PhotoLightbox({
  src,
  alt = '',
  trigger,
  title,
  description,
  imageClassName,
  contentClassName,
}) {
  if (!src || !trigger) return trigger || null;

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        className={cn(
          'max-w-5xl border-white/10 bg-ink/95 p-3 text-white shadow-[0_28px_80px_-28px_rgba(15,23,42,0.75)]',
          contentClassName,
        )}
      >
        {(title || description) && (
          <DialogHeader className="pr-8 text-left">
            {title ? <DialogTitle className="text-white">{title}</DialogTitle> : null}
            {description ? <DialogDescription className="text-gray-300">{description}</DialogDescription> : null}
          </DialogHeader>
        )}
        <div className="flex max-h-[82vh] items-center justify-center overflow-hidden rounded-[1.5rem] bg-black/30 p-2">
          <img src={src} alt={alt} className={cn('max-h-[78vh] max-w-full rounded-[1rem] object-contain', imageClassName)} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ZoomableImage({
  src,
  alt = '',
  className,
  imgClassName,
  title,
  description,
}) {
  if (!src) return null;

  return (
    <PhotoLightbox
      src={src}
      alt={alt}
      title={title}
      description={description}
      trigger={(
        <button type="button" className={cn('block w-full cursor-zoom-in text-left', className)} aria-label="Ampliar imagem">
          <img src={src} alt={alt} className={cn('w-full object-cover', imgClassName)} />
        </button>
      )}
    />
  );
}

export default PhotoLightbox;