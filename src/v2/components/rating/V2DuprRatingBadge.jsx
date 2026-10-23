import React from 'react';
import { BadgeCheck, Sparkles } from 'lucide-react';
import { useDuprRatingForUid } from '@/modules/rating/hooks/useDuprRating';
import { useDuprMirror, useDuprMode } from '@/modules/rating/hooks/useDuprMode';
import { cn } from '@/core/lib/utils';
import { t } from '@/core/i18n';

function fmt(rating) {
  const n = Number(rating);
  return Number.isFinite(n) ? n.toFixed(3) : '—';
}

const SELO = 'inline-flex items-center gap-2 rounded-2xl border border-acid/40 bg-acid/15 px-4 py-2 text-sm font-semibold text-ink';

/**
 * Selo do rating de um atleta — apenas EXIBE (não é link). Com o DUPR oficial
 * valendo para quem vê (`useDuprMode`), mostra o rating do DUPR, e só de quem
 * conectou a conta; senão, o "Nível 2.0–8.0" próprio da plataforma. Some sem
 * rating.
 *
 * @param {{ uid: string, className?: string }} props
 */
export default function V2DuprRatingBadge({ uid, className }) {
  const { ownRatingOff } = useDuprMode();
  return ownRatingOff
    ? <OfficialBadge uid={uid} className={className} />
    : <OwnBadge uid={uid} className={className} />;
}

function OfficialBadge({ uid, className }) {
  const { data } = useDuprMirror(uid);
  if (!uid || !data?.verified) return null;
  const parts = [];
  if (Number.isFinite(Number(data.doubles)) && data.doubles != null) parts.push(`D ${fmt(data.doubles)}`);
  if (Number.isFinite(Number(data.singles)) && data.singles != null) parts.push(`S ${fmt(data.singles)}`);
  return (
    <span title={t('Rating oficial do DUPR (conta conectada)')} className={cn(SELO, className)}>
      <BadgeCheck className="h-4 w-4 text-acid" />
      {t('DUPR')} · {parts.length ? parts.join(' · ') : t('sem rating ainda')}
    </span>
  );
}

function OwnBadge({ uid, className }) {
  const { data } = useDuprRatingForUid(uid, true);

  if (!uid || !data) return null;
  const dGames = data.doubles_games || 0;
  const sGames = data.singles_games || 0;
  if (dGames === 0 && sGames === 0) return null;

  const parts = [];
  if (dGames > 0) parts.push(`D ${fmt(data.doubles_rating)}`);
  if (sGames > 0) parts.push(`S ${fmt(data.singles_rating)}`);

  return (
    <span title={t('Nível de habilidade (escala 2.0–8.0)')} className={cn(SELO, className)}>
      <Sparkles className="h-4 w-4 text-acid" />
      {t('Nível 2.0–8.0')} · {parts.join(' · ')}
    </span>
  );
}
