/**
 * A VISÃO GERAL da liga: como se joga, a temporada (próxima rodada), as
 * divisões com as vagas, a descrição e a minha inscrição / o formulário.
 */
import React, { useMemo } from 'react';
import { CalendarDays, Info, Users } from 'lucide-react';
import { t } from '@/core/i18n';
import { V2Button, V2ErrorState, V2SectionHeader, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { formatMeta } from '@/modules/leagues/domain/leagueFormats';
import { currentRound, normalizeSeason, roundCalendar } from '@/modules/leagues/domain/leagueSeason';
import { STANDINGS_MODE_LABELS } from '@/modules/leagues/domain/leagueResults';
import { hojeLocal } from '@/modules/home/domain/freshness';
import { isLadderFormat } from '@/modules/leagues/domain/leagueLadder';
import LeagueRegister from './LeagueRegister';
import { divisionSummary, entryNoun, shortDate } from './leagueUi';

export default function LeagueOverview({ league, divisions, entries, matches, onGo }) {
  const meta = formatMeta(league.format);
  const season = normalizeSeason(league.season);
  const escada = isLadderFormat(league.format);
  // Na escada o calendário é de SESSÕES (`session`); `round` é a volta dentro da quadra.
  const rodadas = useMemo(() => Math.max(0, ...(matches.data || []).filter((m) => m.phase !== 'playoff').map((m) => (escada ? m.session : m.round) || 0)), [matches.data, escada]);
  const rotulo = (n) => (escada ? t('Sessão {n}', { n }) : t('Rodada {n}', { n }));
  const calendario = useMemo(() => roundCalendar(season, rodadas || 5), [season, rodadas]);
  const agora = rodadas ? currentRound(calendario, hojeLocal()) : null;
  const ativosPorDiv = useMemo(() => {
    const m = new Map();
    (entries.data || []).filter((e) => e.status === 'active').forEach((e) => m.set(e.division_id, (m.get(e.division_id) || 0) + 1));
    return m;
  }, [entries.data]);
  const pts = league.standings || {};

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
      <div className="space-y-6">
        {divisions.isError || entries.isError ? (
          <V2Surface><V2ErrorState inline title={t('Não carregaram as divisões')} onRetry={() => { divisions.refetch(); entries.refetch(); }} /></V2Surface>
        ) : divisions.isLoading || entries.isLoading ? (
          <V2Skeleton className="h-40" />
        ) : (
          <LeagueRegister league={league} divisions={divisions} entries={entries} />
        )}

        <V2Surface className="space-y-4">
          <V2SectionHeader eyebrow={t('Divisões')} title={t('Quem enfrenta quem')} description={t('Cada divisão tem a sua tabela: só se enfrenta quem está na mesma divisão.')} />
          {divisions.isSuccess && entries.isSuccess && (
            <ul className="divide-y divide-gray-100">
              {(divisions.data || []).map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{d.name}</p>
                    <p className="text-sm text-gray-500">{divisionSummary(d)}</p>
                  </div>
                  <span className="flex items-center gap-1.5 text-sm text-gray-500">
                    <Users className="h-4 w-4" aria-hidden="true" />
                    {d.max_entries ? t('{n} de {max}', { n: ativosPorDiv.get(d.id) || 0, max: d.max_entries }) : (ativosPorDiv.get(d.id) || 0)} {entryNoun(league.format, true)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <V2Button type="button" variant="ghost" size="sm" onClick={() => onGo('classificacao')}>{escada ? t('Ver a escada') : t('Ver a classificação')}</V2Button>
        </V2Surface>

        {league.description && (
          <V2Surface>
            <V2SectionHeader eyebrow={t('Sobre a liga')} title={t('Da organização')} />
            <p className="mt-3 whitespace-pre-line text-sm leading-7 text-gray-600">{league.description}</p>
          </V2Surface>
        )}
      </div>

      <div className="space-y-6">
        <V2Surface className="space-y-3">
          <p className="flex items-center gap-2 text-2xs font-bold uppercase tracking-widest text-gray-500"><CalendarDays className="h-3.5 w-3.5" aria-hidden="true" /> {t('Temporada')}</p>
          {agora ? (
            <p className="font-display text-xl font-bold text-ink">
              {rotulo(agora.round)}{agora.date ? ` · ${shortDate(agora.date)}` : ''}
              {agora.deadline && <span className="block text-sm font-normal text-gray-500">{t('Prazo até {data}', { data: shortDate(agora.deadline) })}</span>}
            </p>
          ) : (
            <p className="text-sm text-gray-500">{escada
              ? (rodadas ? t('As sessões previstas já passaram.') : t('A organização monta as quadras de cada sessão com quem vier.'))
              : (rodadas ? t('As rodadas desta temporada já passaram.') : t('As rodadas aparecem quando a organização gerar o calendário.'))}</p>
          )}
          <ol className="space-y-1 text-sm">
            {calendario.slice(0, 8).map((r) => (
              <li key={r.round} className="flex justify-between gap-2 text-gray-600">
                <span>{rotulo(r.round)}</span>
                <span className="font-semibold text-ink">{r.date ? shortDate(r.date) : t('a definir')}</span>
              </li>
            ))}
          </ol>
          {rodadas > 0 && <V2Button type="button" variant="ghost" size="sm" onClick={() => onGo('rodadas')}>{t('Ver os jogos')}</V2Button>}
        </V2Surface>

        <V2Surface className="space-y-3">
          <p className="flex items-center gap-2 text-2xs font-bold uppercase tracking-widest text-gray-500"><Info className="h-3.5 w-3.5" aria-hidden="true" /> {t('Como funciona')}</p>
          {meta && <p className="text-sm leading-6 text-gray-600">{t(meta.how)}</p>}
          {escada ? (
            <p className="text-sm leading-6 text-gray-600">{t('A classificação é a posição na escada: a cada sessão o 1º de cada quadra sobe e o último desce.')}</p>
          ) : (
            <p className="text-sm leading-6 text-gray-600">{t(STANDINGS_MODE_LABELS[pts.mode === 'win_pct' ? 'win_pct' : 'points'])}</p>
          )}
          {!escada && pts.mode !== 'win_pct' && (
            <p className="text-sm text-gray-600">{t('Vitória {v} · derrota {d} · W.O. {w}', { v: pts.win ?? 3, d: pts.loss ?? 1, w: pts.wo_loss ?? 0 })}</p>
          )}
          <p className="text-xs leading-5 text-gray-500">{t('Os jogos da liga ainda não contam no ranking da plataforma nem no DUPR.')}</p>
        </V2Surface>
      </div>
    </div>
  );
}
