/**
 * CoachShareDialog — Card de compartilhamento do perfil público do professor.
 *
 * Espelha ArenaShareDialog (Wave B.3):
 * - QR Code apontando para /coaches/:id
 * - Botão de download como PNG
 * - Compartilhar via WhatsApp
 * - Copiar link
 *
 * Carregado sob demanda via React.lazy — não impacta o bundle principal.
 */

import React, { useEffect, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { Download, Copy, Check, MessageCircle } from 'lucide-react';
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

export default function CoachShareDialog({ coach, open, onOpenChange }) {
  const cardRef = useRef(null);
  const [qr, setQr] = useState('');
  const [busy, setBusy] = useState(false);
  const { copied, copy } = useClipboard();

  const url = typeof window !== 'undefined' ? `${window.location.origin}/coaches/${coach.id}` : '';
  const displayName = coach?.display_name || coach?.name || 'Professor';
  const region = Array.isArray(coach?.regions) && coach.regions.length > 0 ? coach.regions[0] : '';
  const text = `Conheça o professor ${displayName}${region ? ` (${region})` : ''} no Pickleholics: ${url}`;

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
      a.download = `professor-${displayName.replace(/\s+/g, '-').toLowerCase() || 'card'}.png`;
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
          <DialogTitle>Compartilhar perfil</DialogTitle>
          <DialogDescription>
            Mostre este professor para outros atletas.
          </DialogDescription>
        </DialogHeader>

        <div
          ref={cardRef}
          className="rounded-3xl border border-gray-100 bg-gradient-to-br from-paper to-white p-6 shadow-organic-sm"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ink text-2xl font-bold text-acid">
              {displayName[0] || '?'}
            </div>
            <div className="min-w-0">
              <p className="font-display text-lg font-bold text-ink">{displayName}</p>
              {region && (
                <p className="text-xs text-gray-500">{region}</p>
              )}
              {coach?.hourly_rate != null && (
                <p className="mt-1 text-xs font-bold text-green-700">
                  R$ {Number(coach.hourly_rate).toFixed(2)}/h
                </p>
              )}
            </div>
          </div>
          {qr && (
            <div className="mt-4 flex justify-center">
              <img src={qr} alt="QR Code do perfil" className="h-40 w-40 rounded-2xl border border-gray-100 bg-white p-2" />
            </div>
          )}
          <p className="mt-3 text-center text-[10px] uppercase tracking-widest text-gray-400">
            Pickleholics
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 rounded-2xl border border-gray-100 bg-paper px-3 py-2">
            <code className="flex-1 truncate text-xs text-gray-600">{url}</code>
            <Button size="sm" variant="ghost" onClick={() => copy(url)}>
              {copied ? <><Check className="h-3.5 w-3.5" /> Copiado</> : <><Copy className="h-3.5 w-3.5" /> Copiar</>}
            </Button>
          </div>
          <div className="flex gap-2">
            <Button asChild className="flex-1" variant="secondary">
              <a
                href={buildWhatsAppShareUrl(text)}
                target="_blank" rel="noreferrer"
                className="inline-flex items-center justify-center gap-1.5"
              >
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </a>
            </Button>
            <Button onClick={handleDownload} disabled={busy} className="flex-1">
              <Download className="h-4 w-4" /> {busy ? 'Gerando…' : 'Baixar PNG'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
