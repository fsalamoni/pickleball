/**
 * O diálogo do cartão: escolher o degrau (ou o pódio inteiro), com ou sem
 * foto, ver a arte e levá-la para fora — compartilhar, baixar em PNG (3×),
 * imprimir ou salvar em PDF (a impressão do navegador, só com o cartão na
 * folha), copiar o link.
 *
 * Quem pode abrir: qualquer pessoa que vê o pódio — organização, medalhistas,
 * torcida. O cartão divulga o torneio, a arena e a plataforma, não só quem
 * ganhou.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toPng } from 'html-to-image';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { Check, Copy, Download, Printer, Share2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useClipboard } from '@/core/lib/useClipboard';
import { logger } from '@/core/lib/logger';
import { buildMedalCard, CARD_MODE } from '@/modules/trophies/domain/medalCard.js';
import { buildWhatsAppShareUrl } from '@/modules/sharing/domain/shareLinks.js';
import { V2Button, V2FilterChip, V2Toggle } from '@/v2/ui/primitives';
import MedalCard, { METAL } from './MedalCard';
import { t } from '@/core/i18n';

const PIXEL_TRANSPARENTE = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/**
 * @param {{
 *   open: boolean, onOpenChange: (v: boolean) => void,
 *   places: Array<object>, event: object, host?: object|null, link?: string|null,
 *   initialPosition?: 1|2|3, initialMode?: 'degrau'|'podio',
 * }} props
 */
export default function MedalCardDialog({ open, onOpenChange, places = [], event, host = null, link = null, initialPosition = 1, initialMode = CARD_MODE.PLACE }) {
  const cardRef = useRef(null);
  const printRef = useRef(null);
  const { copy, copied } = useClipboard();
  const [mode, setMode] = useState(initialMode);
  const [position, setPosition] = useState(initialPosition);
  const [showPhotos, setShowPhotos] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => { if (open) { setMode(initialMode); setPosition(initialPosition); } }, [open, initialMode, initialPosition]);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const card = useMemo(() => buildMedalCard({ mode, position, places, event, host, showPhotos, origin, link }), [mode, position, places, event, host, showPhotos, origin, link]);
  const temFotos = useMemo(() => places.some((p) => (p.entries || []).some((e) => (e.people || []).some((x) => x.photo_url))), [places]);
  const degraus = places.map((p) => p.position);

  useEffect(() => {
    let vivo = true;
    if (!card.url) { setQrDataUrl(''); return undefined; }
    QRCode.toDataURL(card.url, { margin: 1, width: 320, color: { dark: '#0B0F19', light: '#FFFFFF' } })
      .then((d) => { if (vivo) setQrDataUrl(d); })
      .catch(() => { if (vivo) setQrDataUrl(''); });
    return () => { vivo = false; };
  }, [card.url]);

  async function gerarPng() {
    const opts = { pixelRatio: 3, cacheBust: true, imagePlaceholder: PIXEL_TRANSPARENTE };
    try {
      return await toPng(cardRef.current, opts);
    } catch (err) {
      // Foto de outro domínio sem CORS derruba a captura inteira: a arte sai
      // sem as fotos, e a pessoa é avisada — melhor que nenhuma imagem.
      if (!card.showPhotos) throw err;
      logger.warn('Cartão: captura com fotos falhou, tentando sem', err);
      setShowPhotos(false);
      await new Promise((r) => setTimeout(r, 50));
      const png = await toPng(cardRef.current, opts);
      toast.message(t('As fotos não puderam entrar na imagem. O cartão saiu só com os nomes.'));
      return png;
    }
  }

  async function baixar() {
    if (!cardRef.current) return;
    setBusy('png');
    try {
      const dataUrl = await gerarPng();
      const a = document.createElement('a');
      a.download = card.fileName;
      a.href = dataUrl;
      a.click();
      toast.success(t('Cartão salvo. Poste nos stories ou mande no grupo.'));
    } catch {
      toast.error(t('Não foi possível gerar a imagem. Tente de novo.'));
    } finally { setBusy(''); }
  }

  async function compartilhar() {
    if (typeof navigator !== 'undefined' && navigator.share) {
      setBusy('share');
      try {
        let files;
        if (navigator.canShare && cardRef.current) {
          const dataUrl = await gerarPng();
          const blob = await (await fetch(dataUrl)).blob();
          const file = new File([blob], card.fileName, { type: 'image/png' });
          if (navigator.canShare({ files: [file] })) files = [file];
        }
        await navigator.share({ title: card.headline, text: card.shareText, ...(card.url ? { url: card.url } : {}), ...(files ? { files } : {}) });
        return;
      } catch (err) {
        if (err?.name === 'AbortError') return;
      } finally { setBusy(''); }
    }
    window.open(buildWhatsAppShareUrl([card.shareText, card.url].filter(Boolean).join(' ')), '_blank', 'noopener,noreferrer');
  }

  function imprimir() {
    if (typeof document === 'undefined') return;
    document.body.classList.add('imprimindo-cartao');
    const fim = () => { document.body.classList.remove('imprimindo-cartao'); window.removeEventListener('afterprint', fim); };
    window.addEventListener('afterprint', fim);
    // Um quadro para a cópia da folha pintar antes da impressão.
    requestAnimationFrame(() => { window.print(); setTimeout(fim, 2000); });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" sheet>
        <DialogHeader>
          <DialogTitle>{mode === CARD_MODE.PODIUM ? t('Cartão de pódio') : t('Cartão de campeões')}</DialogTitle>
          <DialogDescription>{t('Para os stories, o grupo, a parede da arena ou o PDF.')}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('O que vai no cartão')}>
          {degraus.map((p) => (
            <V2FilterChip key={p} active={mode === CARD_MODE.PLACE && position === p} onClick={() => { setMode(CARD_MODE.PLACE); setPosition(p); }}>
              <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full" style={{ background: METAL[p].cor }} aria-hidden="true" />
              {METAL[p].nome}
            </V2FilterChip>
          ))}
          {degraus.length > 1 && (
            <V2FilterChip active={mode === CARD_MODE.PODIUM} onClick={() => setMode(CARD_MODE.PODIUM)}>{t('Pódio inteiro')}</V2FilterChip>
          )}
        </div>
        {temFotos && (
          <V2Toggle id="cartao-fotos" checked={showPhotos} onChange={setShowPhotos} label={t('Com as fotos')} hint={t('Desligue para o cartão sair só com os nomes.')} />
        )}

        <div className="mx-auto w-full max-w-[360px] overflow-hidden rounded-3xl shadow-organic">
          <MedalCard ref={cardRef} className="tema-claro" card={card} qrDataUrl={qrDataUrl} />
        </div>

        <div className="grid grid-cols-1 gap-2">
          <V2Button variant="primary" onClick={compartilhar} disabled={Boolean(busy)}>
            <Share2 className="h-4 w-4" /> {busy === 'share' ? t('Preparando…') : t('Compartilhar')}
          </V2Button>
          <div className="grid grid-cols-3 gap-2">
            <V2Button variant="secondary" onClick={baixar} disabled={Boolean(busy)}>
              <Download className="h-4 w-4" /> {busy === 'png' ? t('Gerando…') : t('Imagem')}
            </V2Button>
            <V2Button variant="secondary" onClick={imprimir}>
              <Printer className="h-4 w-4" /> {t('Imprimir / PDF')}
            </V2Button>
            <V2Button variant="secondary" onClick={() => copy(card.url || card.shareText, t('Link copiado!'))}>
              {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />} Link
            </V2Button>
          </div>
          <p className="text-center text-xs text-gray-500">{t('Para o PDF, escolha “Salvar como PDF” na impressão.')}</p>
        </div>
      </DialogContent>

      {/* A cópia que vai para a folha: fora do diálogo (o Radix o esconde na
          impressão), visível SÓ no `@media print`. */}
      {open && typeof document !== 'undefined' && createPortal(
        <div className="cartao-folha-raiz hidden" aria-hidden="true">
          <MedalCard ref={printRef} className="tema-claro" card={card} qrDataUrl={qrDataUrl} />
        </div>,
        document.body,
      )}
    </Dialog>
  );
}
