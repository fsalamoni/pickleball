import React, { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Camera, ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/core/lib/utils';
import { PhotoLightbox } from '@/components/ui/photo-lightbox';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { uploadImage, maxImageMb, ACCEPTED_IMAGE_ATTR } from '@/core/services/storageService';

/**
 * Upload de uma imagem com pré-visualização.
 *
 * Props:
 *  - value: URL atual (ou vazio)
 *  - onChange(url, meta): chamada ao concluir o upload (ou com '' ao remover)
 *  - folder: subpasta em uploads/{uid}/{folder}
 *  - shape: 'circle' | 'square'
 *  - label, hint: textos auxiliares
 *  - fallback: conteúdo exibido quando não há imagem (ex.: iniciais)
 *  - disabled
 */
export function ImageUpload({
  value,
  onChange,
  folder = 'misc',
  shape = 'square',
  label = 'Enviar imagem',
  hint,
  fallback = null,
  disabled = false,
  className,
}) {
  const { user } = useAuth();
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  const openPicker = () => {
    if (!busy && !disabled) inputRef.current?.click();
  };

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    setProgress(0);
    try {
      const meta = await uploadImage(file, { uid: user?.uid, folder, onProgress: setProgress });
      onChange?.(meta.url, meta);
      toast.success('Imagem enviada.');
    } catch (err) {
      toast.error(err.message || 'Falha ao enviar a imagem.');
    } finally {
      setBusy(false);
      setProgress(0);
    }
  };

  const isCircle = shape === 'circle';

  return (
    <div className={cn('flex items-center gap-4', className)}>
      {value ? (
        <PhotoLightbox
          src={value}
          alt={label}
          title={label}
          description="Use o botão Alterar para enviar outra imagem."
          trigger={(
            <button
              type="button"
              disabled={busy || disabled}
              aria-label={`${label} ampliada`}
              className={cn(
                'group relative flex shrink-0 items-center justify-center overflow-hidden border border-emerald-950/10 bg-secondary/40 text-slate-400 transition-colors hover:border-emerald-400/50',
                isCircle ? 'h-20 w-20 rounded-full' : 'h-24 w-24 rounded-xl',
                (busy || disabled) && 'cursor-not-allowed opacity-80',
              )}
            >
              <img src={value} alt="" className="h-full w-full object-cover" />
              {!disabled && (
                <span className="absolute inset-0 flex items-center justify-center bg-slate-950/0 text-white opacity-0 transition-opacity group-hover:bg-slate-950/40 group-hover:opacity-100">
                  {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
                </span>
              )}
            </button>
          )}
        />
      ) : (
        <button
          type="button"
          onClick={openPicker}
          disabled={busy || disabled}
          aria-label={label}
          className={cn(
            'group relative flex shrink-0 items-center justify-center overflow-hidden border border-emerald-950/10 bg-secondary/40 text-slate-400 transition-colors hover:border-emerald-400/50',
            isCircle ? 'h-20 w-20 rounded-full' : 'h-24 w-24 rounded-xl',
            (busy || disabled) && 'cursor-not-allowed opacity-80',
          )}
        >
          {fallback || <ImagePlus className="h-7 w-7" />}
          {!disabled && (
            <span className="absolute inset-0 flex items-center justify-center bg-slate-950/0 text-white opacity-0 transition-opacity group-hover:bg-slate-950/40 group-hover:opacity-100">
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
            </span>
          )}
        </button>
      )}

      <div className="min-w-0 space-y-1.5">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_IMAGE_ATTR}
          onChange={handleFile}
          className="hidden"
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={openPicker} disabled={busy || disabled}>
            {busy ? (
              <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Enviando… {progress}%</>
            ) : (
              <><Camera className="mr-1.5 h-4 w-4" /> {value ? 'Alterar' : label}</>
            )}
          </Button>
          {value && !busy && !disabled && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-red-500 hover:text-red-600"
              onClick={() => onChange?.('', null)}
            >
              <Trash2 className="mr-1.5 h-4 w-4" /> Remover
            </Button>
          )}
        </div>
        <p className="text-xs text-slate-500">{hint || `JPG, PNG ou WEBP até ${maxImageMb()} MB.`}</p>
      </div>
    </div>
  );
}
