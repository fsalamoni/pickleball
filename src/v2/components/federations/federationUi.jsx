/**
 * Peças compartilhadas das telas de federação (flag `federations`).
 *
 * - `FederationGate`: a porta — flag desligada ⇒ volta ao início (como `MarketGate`).
 * - `FedLogo` / `FedBadges`: a marca da federação (cor + sigla) e os selos
 *   (Oficial, Verificada, nível) — a MESMA leitura em todas as telas.
 * - `MemberStatusBadge` / `ChargeStatusBadge`: o estado da filiação e da cobrança.
 * - `useQrDataUrl`: o QR (carteirinha, Pix) por `qrcode`, como nos cartões.
 */
import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import QRCode from 'qrcode';
import { BadgeCheck, Landmark } from 'lucide-react';
import { useFeatureFlags } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { instanteDoDiaEmMs } from '@/core/domain/instant';
import { normalizeHex, readableInk, BRAND_DEFAULT_COLOR } from '@/modules/arenas/domain/whiteLabel';
import {
  CHARGE_STATUS, CHARGE_STATUS_LABELS, FEDERATION_LEVEL_LABELS, MEMBER_STATUS, MEMBER_STATUS_LABELS,
} from '@/modules/federations/domain/constants';
import { V2Badge, V2Page, V2Skeleton } from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';
import { fmtData, t } from '@/core/i18n';

export const fedPath = (f) => `/federacoes/${f?.id || ''}`;
export const fedManagePath = (f, aba) => `/federacoes/${f?.id || ''}/gerir${aba ? `?aba=${aba}` : ''}`;
export const fedPublicPath = (f) => `/f/${f?.slug || ''}`;

/** Flag desligada ⇒ a tela não existe: volta ao início, sem erro. */
export function FederationGate({ children }) {
  const { flags, isLoading } = useFeatureFlags();
  if (isLoading) return <V2Page className="space-y-4"><V2Skeleton className="h-12" /><V2Skeleton className="h-64" /></V2Page>;
  if (!flags?.[FEATURE_FLAG.FEDERATIONS]) return <Navigate to="/" replace />;
  return children;
}

/** Data curta de um valor do banco (Timestamp, ms ou ISO). */
export function quando(valor) {
  const ms = instanteDoDiaEmMs(valor); // "2026-10-12" é o dia LOCAL, não meia-noite UTC
  return ms ? fmtData(new Date(ms), { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
}

const TAMANHOS = { sm: 'h-9 w-9 text-xs rounded-xl', md: 'h-12 w-12 text-sm rounded-2xl', lg: 'h-16 w-16 text-base rounded-3xl', xl: 'h-24 w-24 text-xl rounded-[1.75rem]' };

/** A marca: o logo quando há, senão a sigla sobre a cor da federação (texto por contraste). */
export function FedLogo({ federation, size = 'md', className }) {
  const color = normalizeHex(federation?.branding?.color) || BRAND_DEFAULT_COLOR;
  const ink = readableInk(color);
  const logo = federation?.branding?.logo_url;
  return (
    <span
      className={cn('flex shrink-0 items-center justify-center overflow-hidden font-display font-bold shadow-sm', TAMANHOS[size] || TAMANHOS.md, className)}
      style={{ backgroundColor: color, color: ink }}
      aria-hidden="true"
    >
      {logo ? <img src={logo} alt="" className="h-full w-full object-cover" /> : (federation?.acronym || 'FED').slice(0, 4)}
    </span>
  );
}

/** Oficial · Verificada · Estadual (UF). Só mostra o que é verdade. */
export function FedBadges({ federation, className }) {
  if (!federation) return null;
  const nivel = t(FEDERATION_LEVEL_LABELS[federation.level] || FEDERATION_LEVEL_LABELS.state);
  return (
    <span className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {federation.official && <V2Badge tone="ink"><Landmark className="mr-1 h-3 w-3" aria-hidden="true" />{t('Oficial')}</V2Badge>}
      {federation.verified && <V2Badge tone="blue"><BadgeCheck className="mr-1 h-3 w-3" aria-hidden="true" />{t('Verificada')}</V2Badge>}
      <V2Badge tone="neutral">{federation.state ? `${nivel} · ${federation.state}` : nivel}</V2Badge>
    </span>
  );
}

const TOM_FILIACAO = {
  [MEMBER_STATUS.ACTIVE]: 'green', [MEMBER_STATUS.PENDING]: 'amber', [MEMBER_STATUS.AWAITING_PAYMENT]: 'amber',
  [MEMBER_STATUS.EXPIRED]: 'red', [MEMBER_STATUS.SUSPENDED]: 'red', [MEMBER_STATUS.CANCELLED]: 'neutral', [MEMBER_STATUS.REJECTED]: 'neutral',
};
export function MemberStatusBadge({ status, label }) {
  return <V2Badge tone={TOM_FILIACAO[status] || 'neutral'}>{label || t(MEMBER_STATUS_LABELS[status] || '')}</V2Badge>;
}

const TOM_COBRANCA = { [CHARGE_STATUS.OPEN]: 'amber', [CHARGE_STATUS.DECLARED]: 'blue', [CHARGE_STATUS.PAID]: 'green', [CHARGE_STATUS.CANCELLED]: 'neutral' };
export function ChargeStatusBadge({ status }) {
  return <V2Badge tone={TOM_COBRANCA[status] || 'neutral'}>{t(CHARGE_STATUS_LABELS[status] || '')}</V2Badge>;
}

/** O QR de um texto (URL, Pix). Vazio enquanto não há texto ou se a geração falhar. */
export function useQrDataUrl(texto, { width = 320 } = {}) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let vivo = true;
    if (!texto) { setUrl(''); return undefined; }
    QRCode.toDataURL(texto, { margin: 1, width, color: { dark: '#0B0F19', light: '#FFFFFF' } })
      .then((d) => { if (vivo) setUrl(d); })
      .catch(() => { if (vivo) setUrl(''); });
    return () => { vivo = false; };
  }, [texto, width]);
  return url;
}
