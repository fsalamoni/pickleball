import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Trophy, Calendar } from 'lucide-react';
import { useUserCurrentSeason, useSeasonTop } from '@/modules/progression/hooks/useUserSeasonRanking';
import { useGamificationConfig } from '@/modules/progression/hooks/useGamificationConfig';

import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { daysRemainingInMonth } from '@/modules/progression/domain/seasons';
import TermHint from '@/v2/components/gamification/TermHint';
import { t, tn, fmtNumero, fmtData } from '@/core/i18n';

/**
 * SeasonBanner — banner da season atual.
 * Mostra o mês, quantos dias faltam, a sua posição, o top 3 PÚBLICO (com nome)
 * e os prêmios que o admin configurou. Some se o admin desligou o módulo.
 *
 * Gated por GAMIFICATION_V2.
 */
export default function SeasonBanner({ className }) {
  const gamificationOn = true;
  const { user } = useAuth();
  const { config, isModuleOn } = useGamificationConfig();
  const moduloOn = isModuleOn('hall_of_fame');
  const { season, seasonId } = useUserCurrentSeason(user?.uid, gamificationOn && moduloOn && !!user);
  const { data: top = [] } = useSeasonTop({ seasonId, limit: 3, enabled: gamificationOn && moduloOn });

  if (!gamificationOn || !moduloOn) return null;
  const currentMonth = fmtData(new Date(), { month: 'long', year: 'numeric' });
  const dias = daysRemainingInMonth();
  const p = config.season;

  return (
    <div
      data-testid="season-banner"
      data-dica="temporada"
      className={`flex flex-wrap items-center gap-3 rounded-3xl border border-purple-200 bg-gradient-to-r from-purple-50 to-amber-50 p-4 ${className || ''}`}
    >
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-purple-200 text-purple-800">
        <Trophy className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-purple-700">
          <Sparkles className="h-3 w-3" aria-hidden="true" /> {t('Temporada')} · {dias === 1 ? t('último dia') : tn(dias, 'faltam {n} dia', 'faltam {n} dias')}
          <TermHint term="temporada" className="h-5 w-5" />
        </p>
        <p className="mt-0.5 text-sm font-bold text-ink capitalize">{currentMonth}</p>
        {season && (
          <p className="mt-0.5 text-xs text-gray-600">
            {t('Você tem {xp} XP no mês · posição #{pos}', { xp: fmtNumero(season.xp), pos: season.position })}
            {season.prizeXp > 0 && t(' · prêmio previsto +{xp} XP', { xp: season.prizeXp })}
          </p>
        )}
      </div>

      <div className="flex flex-col items-end gap-1">
        <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">
          <Calendar className="h-3 w-3" aria-hidden="true" /> {t('Top 3')}
        </p>
        {top.slice(0, 3).map((linha) => (
          <p key={linha.uid} className="text-xs text-gray-700">
            #{linha.publicPosition ?? linha.position} · {linha.displayName || t(linha.tier || '')}
          </p>
        ))}
        {top.length === 0 && <p className="text-xs text-gray-500">{t('Ranking ainda em formação')}</p>}
      </div>

      <div className="flex w-full flex-wrap items-center justify-between gap-2 border-t border-purple-100 pt-2 text-[10px] text-gray-500">
        <span>
          {t('Prêmios: 1º {top1} XP · top 10% {top10} XP · participação {part} XP', { top1: p.prizeTop1, top10: p.prizeTop10Percent, part: p.prizeParticipation })}
        </span>
        <Link to="/hall-da-fama" className="font-bold text-ink hover:underline">{t('Ver o placar →')}</Link>
      </div>
    </div>
  );
}
