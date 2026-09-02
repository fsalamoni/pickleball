import React, { useMemo, useState } from 'react';
import { Copy, Check, MessageCircle, Share2 } from 'lucide-react';
import { cn } from '@/core/lib/utils';
import { V2Badge, V2Button, V2Surface } from '@/v2/ui/primitives';
import {
  buildReferralUrl,
  buildReferralShareText,
  generateReferralCode,
  REFERRAL_REWARDS,
} from '../domain/referrals.js';

/**
 * ReferralCard — card visual de convite com código + URL + share.
 *
 * @param {{
 *   user?: { uid: string, platform_name?: string },
 *   code?: string,           // código do user (se já tem); senão, gera
 *   origin?: string,         // ex.: window.location.origin
 *   referralsCount?: number, // quantos referrals ativos
 *   onCopy?: (code) => void,
 *   onShare?: (payload) => void,
 *   className?: string,
 * }} props
 */
export default function ReferralCard({
  user = null,
  code = null,
  origin = '',
  referralsCount = 0,
  onCopy,
  onShare,
  className,
}) {
  // Se não tem código, gera um (em produção, virá do Firestore).
  const finalCode = useMemo(() => code || generateReferralCode(), [code]);
  const url = useMemo(() => buildReferralUrl(origin, finalCode), [origin, finalCode]);
  const text = useMemo(
    () => buildReferralShareText(finalCode, url, { userName: user?.platform_name }),
    [finalCode, url, user?.platform_name],
  );

  const [copied, setCopied] = useState(false);

  function handleCopy() {
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      // fallback simples
      if (typeof window !== 'undefined') {
        const ta = document.createElement('textarea');
        ta.value = url;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch (e) { /* ignore */ }
        document.body.removeChild(ta);
      }
    } else {
      navigator.clipboard.writeText(url).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    onCopy?.(finalCode);
  }

  function handleShare() {
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({ title: 'PickleRush', text, url }).catch(() => {});
    } else {
      // fallback: abrir WhatsApp
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
      if (typeof window !== 'undefined') window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    }
    onShare?.({ code: finalCode, url, text });
  }

  return (
    <V2Surface data-testid="referral-card" className={className}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-display text-lg font-bold text-ink">
            <Share2 className="h-4 w-4" /> Convide amigos
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            Cada amigo que entra pelo seu código rende XP para vocês dois.
          </p>
        </div>
        {referralsCount > 0 && (
          <V2Badge tone="green">{referralsCount} ativo{referralsCount === 1 ? '' : 's'}</V2Badge>
        )}
      </div>

      {/* Code display */}
      <div className="mt-4 flex items-center gap-2 rounded-2xl border border-dashed border-gray-300 bg-paper p-3">
        <span data-testid="referral-code" className="flex-1 font-mono text-2xl font-bold tracking-widest text-ink">
          {finalCode.slice(0, 4)} {finalCode.slice(4)}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copiar código de convite"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-paper-pure text-gray-600 transition-colors hover:bg-gray-100 hover:text-ink"
        >
          {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>

      {/* URL display */}
      {url && (
        <p className="mt-2 break-all rounded-2xl bg-paper p-2 text-xs text-gray-500" data-testid="referral-url">
          {url}
        </p>
      )}

      {/* Botão principal */}
      <div className="mt-4">
        <V2Button onClick={handleShare} className="w-full">
          <MessageCircle className="h-4 w-4" /> Compartilhar convite
        </V2Button>
      </div>

      {/* Recompensas */}
      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-gray-100 pt-4">
        {Object.values(REFERRAL_REWARDS).map((r, i) => (
          <div key={i} className="rounded-2xl bg-paper p-2 text-center">
            <p className="text-base font-bold text-amber-600 tabular-nums">+{r.referrerXp}</p>
            <p className="mt-0.5 text-[10px] text-gray-500">
              {i === 0 && 'Signup'}
              {i === 1 && '5+ jogos'}
              {i === 2 && '1 torneio'}
            </p>
          </div>
        ))}
      </div>
    </V2Surface>
  );
}
