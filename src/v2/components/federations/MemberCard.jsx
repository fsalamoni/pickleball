/**
 * A CARTEIRINHA digital do filiado (`buildMemberCard`): a arte, e o diálogo
 * com Compartilhar / Salvar PNG / Imprimir-PDF / copiar o código — a mesma
 * mecânica dos cartões de campeões (`MedalCardDialog`). O QR leva à
 * verificação pública `/f/verificar/<código>`, que qualquer pessoa abre sem
 * conta e vê o mínimo: nome, federação, categoria e validade.
 *
 * A arte fica em `tema-claro` de propósito: vira imagem (PNG) e papel.
 */
import React, { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toPng } from 'html-to-image';
import { toast } from 'sonner';
import { Download, Printer, Share2, ShieldCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { buildMemberCard } from '@/modules/federations/domain/card';
import { buildWhatsAppShareUrl } from '@/modules/sharing/domain/shareLinks';
import { logger } from '@/core/lib/logger';
import { V2Button } from '@/v2/ui/primitives';
import CopyCodeButton from '@/v2/ui/CopyCodeButton';
import { cn } from '@/core/lib/utils';
import { t } from '@/core/i18n';
import { useQrDataUrl } from './federationUi';

const PIXEL_TRANSPARENTE = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const FAIXA = { green: 'bg-green-500 text-white', amber: 'bg-amber-400 text-ink', red: 'bg-red-500 text-white', gray: 'bg-gray-300 text-ink' };

/** A arte da carteirinha (85,6 × 54 mm em proporção). */
export function MemberCard({ card, qrDataUrl, showPhoto = true, className }) {
  const f = card.federation;
  return (
    <div
      className={cn('tema-claro cartao-imprimivel relative aspect-[1.586] w-full overflow-hidden rounded-3xl bg-white text-gray-900 shadow-organic-sm', className)}
      role="img"
      aria-label={t('Carteirinha de {nome} na {federacao}, número {numero}, válida até {validade}', { nome: card.person.name, federacao: f.name, numero: card.number, validade: card.validUntilLabel })}
    >
      <div className="flex h-[34%] items-center gap-3 px-5" style={{ backgroundColor: f.color, color: f.ink }}>
        <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/20 font-display text-sm font-bold">
          {f.logo ? <img src={f.logo} alt="" className="h-full w-full object-cover" /> : f.acronym.slice(0, 4)}
        </span>
        <div className="min-w-0">
          <p className="truncate font-display text-base font-bold leading-tight sm:text-lg">{f.name}</p>
          <p className="truncate text-xs opacity-90">{[f.acronym, f.official ? t('Federação oficial') : null].filter(Boolean).join(' · ')}</p>
        </div>
      </div>
      <div className="flex h-[66%] gap-4 px-5 py-3">
        {showPhoto && card.person.photo ? (
          <img src={card.person.photo} alt="" className="h-16 w-16 shrink-0 rounded-2xl object-cover sm:h-20 sm:w-20" />
        ) : (
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gray-100 font-display text-xl font-bold text-gray-500 sm:h-20 sm:w-20">{card.person.name.slice(0, 1)}</span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base font-bold leading-tight sm:text-lg">{card.person.name}</p>
          <p className="text-xs text-gray-600">{card.kind} · {card.tier}{card.plan ? ` · ${card.plan}` : ''}</p>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 text-xs">
            <div><dt className="uppercase tracking-widest text-gray-500">{t('Número')}</dt><dd className="font-mono font-bold">{card.number}</dd></div>
            <div><dt className="uppercase tracking-widest text-gray-500">{t('Válida até')}</dt><dd className="font-bold">{card.validUntilLabel}</dd></div>
          </dl>
          <span className={cn('mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-bold', FAIXA[card.band.tone] || FAIXA.gray)}>{card.band.label}</span>
          {/* Só os nomes: logo de outro site quebraria o PNG (a imagem cruzada "suja" o desenho). */}
          {f.sponsors?.length > 0 && <p className="mt-1 truncate text-2xs text-gray-500">{t('Patrocínio: {nomes}', { nomes: f.sponsors.map((s) => s.name).join(' · ') })}</p>}
        </div>
        {qrDataUrl && (
          <div className="flex shrink-0 flex-col items-center justify-center gap-1">
            <img src={qrDataUrl} alt={t('QR de verificação')} className="h-16 w-16 rounded-md sm:h-20 sm:w-20" />
            <span className="font-mono text-xs tracking-wider text-gray-600">{card.code}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/** O diálogo da carteirinha, com as saídas. */
export default function MemberCardDialog({ open, onOpenChange, member, federation, plan = null }) {
  const cardRef = useRef(null);
  const [busy, setBusy] = useState('');
  const [showPhoto, setShowPhoto] = useState(true);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const card = useMemo(() => buildMemberCard({ member, federation, plan, origin }), [member, federation, plan, origin]);
  const qr = useQrDataUrl(card.verifyUrl);
  const fileName = `carteirinha-${card.federation.acronym || 'federacao'}-${card.number}.png`.toLowerCase();

  async function gerarPng() {
    const opts = { pixelRatio: 3, cacheBust: true, imagePlaceholder: PIXEL_TRANSPARENTE };
    try {
      return await toPng(cardRef.current, opts);
    } catch (err) {
      if (!showPhoto || !card.person.photo) throw err;
      logger.warn('Carteirinha: captura com foto falhou, tentando sem', err);
      setShowPhoto(false);
      await new Promise((r) => setTimeout(r, 50));
      const png = await toPng(cardRef.current, opts);
      toast.message(t('A foto não pôde entrar na imagem. A carteirinha saiu sem ela.'));
      return png;
    }
  }

  async function baixar() {
    if (!cardRef.current) return;
    setBusy('png');
    try {
      const a = document.createElement('a');
      a.download = fileName; a.href = await gerarPng(); a.click();
      toast.success(t('Carteirinha salva.'));
    } catch { toast.error(t('Não foi possível gerar a imagem. Tente de novo.')); } finally { setBusy(''); }
  }

  async function compartilhar() {
    const texto = t('Minha carteirinha da {federacao}: nº {numero}. Verifique em {url}', { federacao: card.federation.name, numero: card.number, url: card.verifyUrl });
    if (typeof navigator !== 'undefined' && navigator.share) {
      setBusy('share');
      try {
        let files;
        if (navigator.canShare && cardRef.current) {
          const blob = await (await fetch(await gerarPng())).blob();
          const file = new File([blob], fileName, { type: 'image/png' });
          if (navigator.canShare({ files: [file] })) files = [file];
        }
        await navigator.share({ title: card.federation.name, text: texto, url: card.verifyUrl, ...(files ? { files } : {}) });
        return;
      } catch (err) { if (err?.name === 'AbortError') return; } finally { setBusy(''); }
    }
    window.open(buildWhatsAppShareUrl(texto), '_blank', 'noopener,noreferrer');
  }

  function imprimir() {
    if (typeof document === 'undefined') return;
    document.body.classList.add('imprimindo-cartao');
    const fim = () => { document.body.classList.remove('imprimindo-cartao'); window.removeEventListener('afterprint', fim); };
    window.addEventListener('afterprint', fim);
    requestAnimationFrame(() => { window.print(); setTimeout(fim, 2000); });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" sheet>
        <DialogHeader>
          <DialogTitle>{t('Carteirinha digital')}</DialogTitle>
          <DialogDescription>{t('Mostre na quadra ou no torneio. O QR abre a verificação pública: nome, federação, categoria e validade — nada mais.')}</DialogDescription>
        </DialogHeader>
        <div ref={cardRef} className="tema-claro cartao-imprimivel">
          <MemberCard card={card} qrDataUrl={qr} showPhoto={showPhoto} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <V2Button type="button" size="sm" onClick={compartilhar} disabled={busy !== ''}><Share2 className="h-4 w-4" />{t('Compartilhar')}</V2Button>
          <V2Button type="button" size="sm" variant="secondary" onClick={baixar} disabled={busy !== ''}><Download className="h-4 w-4" />{busy === 'png' ? t('Gerando…') : t('Salvar PNG')}</V2Button>
          <V2Button type="button" size="sm" variant="secondary" onClick={imprimir}><Printer className="h-4 w-4" />{t('Imprimir / PDF')}</V2Button>
          {card.code && <CopyCodeButton code={card.code} size="sm" successMessage={t('Código da carteirinha copiado.')} />}
        </div>
        <p className="flex items-start gap-2 text-xs text-gray-500"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{t('O código muda quando a filiação é renovada ou suspensa: uma carteirinha antiga deixa de verificar.')}</p>
        {open && typeof document !== 'undefined' && createPortal(
          <div className="cartao-folha-raiz hidden" aria-hidden="true">
            <div className="cartao-imprimivel"><MemberCard card={card} qrDataUrl={qr} showPhoto={showPhoto} /></div>
          </div>,
          document.body,
        )}
      </DialogContent>
    </Dialog>
  );
}
