import React, { useEffect, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { MapPin, Download, Copy, Check, MessageCircle, Building } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useClipboard } from '@/core/lib/useClipboard';
import { buildWhatsAppShareUrl } from '@/modules/sharing/domain/shareLinks.js';
import { formatArenaAddress } from '../domain/arena.js';

/**
 * Card de compartilhamento da arena, com QR Code para a página pública.
 * Carregado sob demanda (as libs de imagem/QR entram no bundle só ao abrir).
 */
export default function ArenaShareDialog({ arena, open, onOpenChange }) {
  const cardRef = useRef(null);
  const [qr, setQr] = useState('');
  const [busy, setBusy] = useState(false);
  const { copied, copy } = useClipboard();

  const url = typeof window !== 'undefined' ? `${window.location.origin}/arenas/${arena.id}` : '';
  const text = `Conheça a arena ${arena.name}${arena.city ? ` (${arena.city})` : ''} no Pickleholics: ${url}`;

  useEffect(() => {
    if (!url) return;
    QRCode.toDataURL(url, { margin: 1, width: 240 })
      .then(setQr)
      .catch(() => setQr(''));
  }, [url]);

  async function handleDownload() {
    if (!cardRef.current) return;
    setBusy(true);
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2, cacheBust: true });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `arena-${arena.name?.replace(/\s+/g, '-').toLowerCase() || 'card'}.png`;
      a.click();
    } catch (err) {
      toast.error('Não foi possível gerar a imagem.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Compartilhar arena</DialogTitle>
          <DialogDescription>Baixe o card, copie o link ou envie pelo WhatsApp.</DialogDescription>
        </DialogHeader>

        <div ref={cardRef} className="overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-600 to-emerald-800 p-5 text-white">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-50/80">
            <Building className="h-4 w-4" /> Arena · Pickleholics
          </div>
          {arena.cover_url ? (
            <img src={arena.cover_url} alt="" className="mt-3 h-32 w-full rounded-xl object-cover" />
          ) : null}
          <h3 className="mt-3 text-2xl font-bold leading-tight">{arena.name}</h3>
          {formatArenaAddress(arena) && (
            <p className="mt-1 flex items-center gap-1 text-sm text-emerald-50/85">
              <MapPin className="h-3.5 w-3.5" /> {formatArenaAddress(arena)}
            </p>
          )}
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-xs text-emerald-50/80">Aponte a câmera para reservar e ver os horários.</p>
            {qr && <img src={qr} alt="QR" className="h-20 w-20 rounded-lg bg-white p-1" />}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Button variant="outline" onClick={() => copy(url)}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            <span className="ml-1 hidden sm:inline">{copied ? 'Copiado' : 'Link'}</span>
          </Button>
          <Button variant="outline" asChild>
            <a href={buildWhatsAppShareUrl(text)} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4" /> <span className="ml-1 hidden sm:inline">WhatsApp</span>
            </a>
          </Button>
          <Button onClick={handleDownload} disabled={busy}>
            <Download className="h-4 w-4" /> <span className="ml-1 hidden sm:inline">{busy ? '...' : 'Baixar'}</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
