import React, { useRef, useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { Download, FileText, ImagePlus, Loader2, Paperclip, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/core/lib/utils';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import {
  uploadAttachment,
  deleteAttachment,
  downloadAttachment,
  formatBytes,
  maxFileMb,
  ACCEPTED_FILE_ATTR,
} from '@/core/services/storageService';

/**
 * Primitivas reutilizáveis para anexos (imagens e documentos) em chat e fóruns.
 *  - useAttachmentUploader: gerencia o upload e a lista de anexos pendentes.
 *  - AttachmentAddButton: botão + input file oculto.
 *  - PendingAttachmentList: pré-visualização dos anexos antes de enviar.
 *  - AttachmentGallery: exibição (somente leitura) com download.
 */

const DEFAULT_MAX = 10;

export function useAttachmentUploader({ folder = 'attachments', max = DEFAULT_MAX } = {}) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [uploading, setUploading] = useState(false);
  // Ref espelha `items` para o cálculo de "restantes" sem recriar o callback.
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const pick = useCallback(
    async (fileList) => {
      const files = Array.from(fileList || []);
      if (files.length === 0) return;
      const remaining = max - itemsRef.current.length;
      if (remaining <= 0) {
        toast.error(`Máximo de ${max} anexos.`);
        return;
      }
      setUploading(true);
      try {
        for (const file of files.slice(0, remaining)) {
          try {
            const meta = await uploadAttachment(file, { uid: user?.uid, folder });
            setItems((prev) => [...prev, meta]);
          } catch (err) {
            toast.error(err.message || `Falha ao enviar ${file.name}.`);
          }
        }
      } finally {
        setUploading(false);
      }
    },
    [max, user?.uid, folder],
  );

  const remove = useCallback((path) => {
    setItems((prev) => prev.filter((it) => it.path !== path));
    deleteAttachment(path); // best-effort: remove do Storage o que não será enviado
  }, []);

  const reset = useCallback(() => setItems([]), []);

  return { items, uploading, pick, remove, reset, setItems };
}

export function AttachmentAddButton({
  onFiles,
  uploading = false,
  disabled = false,
  multiple = true,
  accept = ACCEPTED_FILE_ATTR,
  label = 'Anexar',
  variant = 'outline',
  size = 'sm',
  iconOnly = false,
  className,
}) {
  const inputRef = useRef(null);
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={(e) => {
          const list = e.target.files;
          e.target.value = '';
          onFiles?.(list);
        }}
        className="hidden"
      />
      <Button
        type="button"
        variant={variant}
        size={iconOnly ? 'icon' : size}
        className={className}
        onClick={() => inputRef.current?.click()}
        disabled={disabled || uploading}
        title={label}
      >
        {uploading ? (
          <Loader2 className={cn('h-4 w-4 animate-spin', !iconOnly && 'mr-1.5')} />
        ) : (
          <Paperclip className={cn('h-4 w-4', !iconOnly && 'mr-1.5')} />
        )}
        {!iconOnly && (uploading ? 'Enviando…' : label)}
      </Button>
    </>
  );
}

export function PendingAttachmentList({ items = [], onRemove, className }) {
  if (items.length === 0) return null;
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {items.map((item) => (
        <div
          key={item.path}
          className="group relative flex items-center gap-2 overflow-hidden rounded-lg border border-emerald-950/10 bg-secondary/40"
        >
          {item.kind === 'image' ? (
            <img src={item.url} alt="" className="h-16 w-16 object-cover" />
          ) : (
            <div className="flex h-16 w-44 items-center gap-2 px-3">
              <FileText className="h-6 w-6 shrink-0 text-emerald-700" />
              <div className="min-w-0">
                <div className="truncate text-xs font-medium text-slate-800">{item.name}</div>
                <div className="text-[11px] text-slate-500">{formatBytes(item.size)}</div>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => onRemove?.(item.path)}
            aria-label="Remover anexo"
            className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-950/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}

export function AttachmentGallery({ attachments = [], className }) {
  const list = Array.isArray(attachments) ? attachments.filter((a) => a && a.url) : [];
  if (list.length === 0) return null;
  const images = list.filter((a) => a.kind === 'image');
  const files = list.filter((a) => a.kind !== 'image');

  return (
    <div className={cn('space-y-2', className)}>
      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {images.map((image) => (
            <div key={image.path || image.url} className="group relative overflow-hidden rounded-lg border border-emerald-950/10">
              <a href={image.url} target="_blank" rel="noopener noreferrer">
                <img src={image.url} alt={image.name || ''} loading="lazy" className="h-32 w-full object-cover transition-transform group-hover:scale-[1.02]" />
              </a>
              <button
                type="button"
                onClick={() => downloadAttachment(image.url, image.name)}
                aria-label="Baixar imagem"
                className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-slate-950/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <Download className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((file) => (
            <button
              key={file.path || file.url}
              type="button"
              onClick={() => downloadAttachment(file.url, file.name)}
              className="flex max-w-full items-center gap-2 rounded-lg border border-emerald-950/10 bg-secondary/40 px-3 py-2 text-left transition-colors hover:border-emerald-400/50 hover:bg-emerald-50"
            >
              <FileText className="h-5 w-5 shrink-0 text-emerald-700" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-slate-800">{file.name || 'Arquivo'}</span>
                {file.size ? <span className="block text-[11px] text-slate-500">{formatBytes(file.size)}</span> : null}
              </span>
              <Download className="ml-1 h-4 w-4 shrink-0 text-slate-400" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export { ImagePlus };
