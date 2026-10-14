/**
 * Compartilhar com IMAGEM: o cartão (anúncio, loja ou vale-presente) vira PNG
 * para os stories e o grupo, com o link e um QR. Mesmo caminho do cartão de
 * campeões (`MedalCardDialog`): `toPng` sobre um elemento `tema-claro` — a
 * imagem sai clara mesmo no modo escuro. Foto de outro domínio sem CORS
 * derruba a captura: aí o cartão sai sem a foto, e a pessoa é avisada.
 */
import React, { forwardRef, useEffect, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { Check, Copy, Download, Gift, Share2, Store, TicketPercent } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useClipboard } from '@/core/lib/useClipboard';
import { buildWhatsAppShareUrl } from '@/modules/sharing/domain/shareLinks.js';
import { formatBRL, discountPercent } from '@/modules/marketplace/domain/money';
import { V2Button } from '@/v2/ui/primitives';

const PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

function useQr(url) {
  const [qr, setQr] = useState('');
  useEffect(() => {
    let vivo = true;
    if (!url) { setQr(''); return undefined; }
    QRCode.toDataURL(url, { margin: 1, width: 240, color: { dark: '#0B0F19', light: '#FFFFFF' } })
      .then((d) => { if (vivo) setQr(d); }).catch(() => { if (vivo) setQr(''); });
    return () => { vivo = false; };
  }, [url]);
  return qr;
}

/** O cartão de um anúncio, de uma loja ou de um cupom (1080 × 1350 depois do 3×). */
const EYEBROW = { store: 'Loja no Mercado PickleRush', coupon: 'Cupom no Mercado PickleRush' };
const ICONE = { store: Store, coupon: TicketPercent };
export const MarketShareCard = forwardRef(function MarketShareCard({ kind = 'listing', image, title, subtitle, priceCents, compareAtCents, highlight, code, qr, showImage = true }, ref) {
  const Icone = ICONE[kind] || Gift;
  const pct = discountPercent(priceCents, compareAtCents);
  return (
    <div ref={ref} className="tema-claro mx-auto flex w-[360px] flex-col overflow-hidden rounded-3xl bg-ink text-white" style={{ aspectRatio: '4 / 5' }}>
      <div className="relative flex-1 bg-paper">
        {showImage && image
          ? <img src={image} alt="" crossOrigin="anonymous" className="h-full w-full object-cover" />
          : <div className="flex h-full items-center justify-center text-ink"><Icone className="h-20 w-20" /></div>}
        {code && (
          <span className="absolute inset-x-6 bottom-6 rounded-2xl border-2 border-dashed border-ink bg-acid px-4 py-3 text-center font-display text-3xl font-bold tracking-widest text-ink">{code}</span>
        )}
        {pct > 0 && <span className="absolute left-4 top-4 rounded-full bg-acid px-3 py-1 font-display text-sm font-bold text-ink">−{pct}%</span>}
        {highlight && <span className="absolute bottom-4 left-4 rounded-full bg-paper-pure px-3 py-1 text-xs font-bold text-ink">{highlight}</span>}
      </div>
      <div className="flex items-end gap-3 p-5">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-widest text-acid">{EYEBROW[kind] || 'Mercado PickleRush'}</p>
          <p className="mt-1 line-clamp-2 font-display text-xl font-bold leading-tight">{title}</p>
          {subtitle && <p className="mt-1 line-clamp-1 text-sm text-white/80">{subtitle}</p>}
          {priceCents > 0 && (
            <p className="mt-2 font-display text-2xl font-bold">
              {compareAtCents > priceCents && <span className="mr-2 text-base font-medium text-white/70 line-through">{formatBRL(compareAtCents)}</span>}
              {formatBRL(priceCents)}
            </p>
          )}
        </div>
        {qr && <img src={qr} alt="" className="h-20 w-20 shrink-0 rounded-xl bg-white p-1" />}
      </div>
    </div>
  );
});

/**
 * @param {{ open, onOpenChange, title: string, description?: string, url: string,
 *   shareText: string, fileName: string,
 *   renderCard: (p: { ref: object, qr: string, showImage: boolean }) => React.ReactNode }} props
 */
export default function ShareImageDialog({ open, onOpenChange, title, description, url, shareText, fileName, renderCard }) {
  const ref = useRef(null);
  const qr = useQr(open ? url : '');
  const [showImage, setShowImage] = useState(true);
  const [busy, setBusy] = useState('');
  const { copy, copied } = useClipboard();

  async function gerar() {
    const opts = { pixelRatio: 3, cacheBust: true, imagePlaceholder: PIXEL };
    try {
      return await toPng(ref.current, opts);
    } catch (err) {
      if (!showImage) throw err;
      setShowImage(false);
      await new Promise((r) => setTimeout(r, 50));
      const png = await toPng(ref.current, opts);
      toast.message('A foto não pôde entrar na imagem. O cartão saiu sem ela.');
      return png;
    }
  }

  async function baixar() {
    if (!ref.current) return;
    setBusy('png');
    try {
      const a = document.createElement('a');
      a.download = fileName;
      a.href = await gerar();
      a.click();
      toast.success('Imagem salva. Poste nos stories ou mande no grupo.');
    } catch {
      toast.error('Não foi possível gerar a imagem. Tente de novo.');
    } finally { setBusy(''); }
  }

  async function compartilhar() {
    if (typeof navigator !== 'undefined' && navigator.share) {
      setBusy('share');
      try {
        let files;
        if (navigator.canShare && ref.current) {
          const blob = await (await fetch(await gerar())).blob();
          const file = new File([blob], fileName, { type: 'image/png' });
          if (navigator.canShare({ files: [file] })) files = [file];
        }
        await navigator.share({ title, text: shareText, url, ...(files ? { files } : {}) });
        return;
      } catch (err) {
        if (err?.name === 'AbortError') return;
      } finally { setBusy(''); }
    }
    window.open(buildWhatsAppShareUrl(`${shareText} ${url}`), '_blank', 'noopener,noreferrer');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" sheet>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description || 'Uma imagem para os stories e o grupo, com o link junto.'}</DialogDescription>
        </DialogHeader>
        {renderCard({ ref, qr, showImage })}
        <div className="grid grid-cols-3 gap-2">
          <V2Button type="button" onClick={compartilhar} disabled={!!busy}><Share2 className="h-4 w-4" /> {busy === 'share' ? '…' : 'Enviar'}</V2Button>
          <V2Button type="button" variant="ghost" onClick={baixar} disabled={!!busy}><Download className="h-4 w-4" /> {busy === 'png' ? '…' : 'Imagem'}</V2Button>
          <V2Button type="button" variant="ghost" onClick={() => copy(url, 'Link copiado.')}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} Link</V2Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
