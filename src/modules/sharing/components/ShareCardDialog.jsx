import React, { useEffect, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { Trophy, MapPin, Hash, Download, Copy, Check, MessageCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useClipboard } from '@/core/lib/useClipboard';
import { buildTournamentSharePayload } from '../domain/shareLinks.js';

/**
 * Diálogo de compartilhamento (UGC): mostra um card visual do torneio com QR
 * Code e link público, e oferece compartilhar (Web Share / WhatsApp), baixar a
 * imagem e copiar o link. Toda a geração ocorre no cliente.
 */
export default function ShareCardDialog({ tournament, open, onOpenChange }) {
  const cardRef = useRef(null);
  const { copy, copied } = useClipboard();
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [downloading, setDownloading] = useState(false);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const { url, text, whatsappUrl } = buildTournamentSharePayload({ origin, tournament });

  useEffect(() => {
    let active = true;
    if (!url) {
      setQrDataUrl('');
      return undefined;
    }
    QRCode.toDataURL(url, { margin: 1, width: 240 })
      .then((dataUrl) => {
        if (active) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (active) setQrDataUrl('');
      });
    return () => {
      active = false;
    };
  }, [url]);

  async function handleNativeShare() {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: tournament?.name || 'Torneio', text, url });
        return;
      } catch {
        // cancelado ou indisponível → segue para WhatsApp/copy
      }
    }
    if (whatsappUrl && typeof window !== 'undefined') {
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    } else {
      copy(url, 'Link copiado!');
    }
  }

  async function handleDownload() {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2, cacheBust: true });
      const link = document.createElement('a');
      const safeName = String(tournament?.name || 'torneio')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      link.download = `pickleholics-${safeName || 'torneio'}.png`;
      link.href = dataUrl;
      link.click();
      toast.success('Card gerado! Compartilhe nos stories ou no WhatsApp.');
    } catch {
      toast.error('Não foi possível gerar a imagem. Tente novamente.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Compartilhar torneio</DialogTitle>
          <DialogDescription>
            Gere um card para divulgar nos stories e no WhatsApp, ou copie o link público.
          </DialogDescription>
        </DialogHeader>

        {/* Card visual capturável */}
        <div
          ref={cardRef}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-800 p-5 text-white"
        >
          <div className="flex items-center gap-2 text-emerald-100">
            <Trophy className="h-5 w-5" />
            <span className="text-sm font-semibold tracking-wide">Pickleholics</span>
          </div>

          <h3 className="mt-3 text-xl font-bold leading-tight">
            {tournament?.name || 'Torneio de Pickleball'}
          </h3>

          <div className="mt-2 space-y-1 text-sm text-emerald-50">
            {(tournament?.city || tournament?.state) && (
              <div className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                {[tournament?.city, tournament?.state].filter(Boolean).join(' / ')}
              </div>
            )}
            {tournament?.invite_code && (
              <div className="flex items-center gap-1.5">
                <Hash className="h-4 w-4" />
                Código: <strong className="font-semibold">{tournament.invite_code}</strong>
              </div>
            )}
          </div>

          <div className="mt-4 flex items-end justify-between gap-3">
            <p className="text-xs text-emerald-100/90">
              Aponte a câmera para acompanhar o torneio ao vivo
            </p>
            {qrDataUrl && (
              <img
                src={qrDataUrl}
                alt="QR Code do torneio"
                className="h-20 w-20 shrink-0 rounded-md bg-white p-1"
              />
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2">
          <Button onClick={handleNativeShare} className="w-full">
            <MessageCircle className="h-4 w-4" />
            <span className="ml-1">Compartilhar</span>
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={handleDownload} disabled={downloading}>
              <Download className="h-4 w-4" />
              <span className="ml-1">{downloading ? 'Gerando…' : 'Baixar card'}</span>
            </Button>
            <Button variant="outline" onClick={() => copy(url, 'Link copiado!')}>
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              <span className="ml-1">Copiar link</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
