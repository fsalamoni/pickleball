/**
 * Meu desempenho → "Fora da plataforma (declarado por você)" (flag
 * `athlete_career`, docs/54 §5): os torneios de fora jogados, os pódios e os
 * títulos DECLARADOS, à parte dos seis cartões verificados — que continuam
 * como estão.
 *
 * O interruptor "Incluir declarados" (`?declarados=1`, padrão desligado) mostra
 * a soma verificado + declarado, em outra cor e com o selo, dizendo de onde vem
 * cada parte: o declarado nunca se mistura calado com o verificado. O
 * aproveitamento não muda (o torneio de fora não tem jogos registrados). Nada
 * daqui entra em ranking, rating nem XP.
 */
import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Route } from 'lucide-react';
import { useCareerEvents } from '@/modules/career/hooks/useCareer';
import { SEAL, careerPerformanceSummary } from '@/modules/career/domain/timeline.js';
import { V2Button, V2ErrorState, V2Skeleton, V2Surface, V2Toggle } from '@/v2/ui/primitives';
import { SealBadge } from './careerUi';
import { t, tn } from '@/core/i18n';

function Numero({ label, valor }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-3">
      <p className="font-display text-2xl font-black tabular-nums text-ink">{valor}</p>
      <p className="text-xs font-semibold text-gray-600">{label}</p>
    </div>
  );
}

/**
 * @param {{ verified: { tournaments: number, podiums: number, titles: number }|null }} props
 *   `verified` nulo = os números daqui não carregaram (a soma não é feita).
 */
export default function CareerPerformanceBlock({ verified }) {
  const [params, setParams] = useSearchParams();
  const incluir = params.get('declarados') === '1';
  const q = useCareerEvents();
  const r = q.isSuccess ? careerPerformanceSummary(q.data) : null;

  const alternar = (v) => {
    const p = new URLSearchParams(params);
    if (v) p.set('declarados', '1'); else p.delete('declarados');
    setParams(p, { replace: true });
  };

  return (
    <V2Surface className="mt-8" data-dica="desempenho-fora">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex flex-wrap items-center gap-2 font-display text-lg font-bold text-ink">
            {t('Fora da plataforma')} <SealBadge seal={SEAL.DECLARED} />
          </h2>
          <p className="mt-1 text-sm text-gray-600">{t('Declarado por você, na Minha carreira. Não entra em ranking, rating nem XP.')}</p>
        </div>
        <V2Button asChild size="sm" variant="secondary"><Link to="/carreira"><Route className="h-4 w-4" /> {t('Abrir a Minha carreira')}</Link></V2Button>
      </div>

      {q.isPending ? (
        <V2Skeleton lines={2} className="mt-4" />
      ) : q.isError ? (
        <V2ErrorState inline className="mt-4" title={t('Não carregaram os seus torneios de fora')} description={t('Os números daqui de cima não mudam.')} onRetry={() => q.refetch()} />
      ) : r.tournaments === 0 && r.linked > 0 ? (
        <p className="mt-4 text-sm text-gray-600">{tn(r.linked, '{n} torneio ligado a um do PickleRush já está nos números daqui.', '{n} torneios ligados a um do PickleRush já estão nos números daqui.')}</p>
      ) : r.tournaments === 0 ? (
        <p className="mt-4 text-sm text-gray-600">
          {t('Nenhum torneio de fora registrado.')}{' '}
          <Link to="/carreira?registrar=1" className="font-semibold text-ink underline underline-offset-2">{t('Registrar torneio')}</Link>
        </p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <Numero label={t('Torneios')} valor={r.tournaments} />
            <Numero label={t('Pódios')} valor={r.podiums} />
            <Numero label={t('Títulos')} valor={r.titles} />
          </div>
          {r.linked > 0 && (
            <p className="mt-2 text-xs text-gray-500">{tn(r.linked, '{n} torneio ligado a um do PickleRush já está nos números daqui.', '{n} torneios ligados a um do PickleRush já estão nos números daqui.')}</p>
          )}
          <div className="mt-4">
            <V2Toggle
              id="desempenho-incluir-declarados"
              checked={incluir}
              onChange={alternar}
              label={t('Incluir declarados')}
              hint={t('Mostra a soma com os torneios de fora, à parte e com o selo. O aproveitamento continua só com os jogos daqui.')}
            />
          </div>
          {incluir && (
            verified ? (
              <ul className="mt-3 grid gap-2 sm:grid-cols-3" aria-label={t('Com os declarados')}>
                {[
                  [t('Torneios'), verified.tournaments, r.tournaments],
                  [t('Pódios'), verified.podiums, r.podiums],
                  [t('Títulos'), verified.titles, r.titles],
                ].map(([rotulo, daqui, fora]) => (
                  <li key={rotulo} className="rounded-2xl border border-dashed border-amber-300 p-3">
                    <p className="text-xs font-semibold text-gray-600">{rotulo} · {t('com os declarados')}</p>
                    <p className="font-display text-xl font-black tabular-nums text-ink">{daqui + fora}</p>
                    <p className="text-xs text-gray-500">{t('{daqui} daqui + {fora} declarados', { daqui, fora })}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-gray-600">{t('Os números daqui não carregaram; a soma aparece quando eles chegarem.')}</p>
            )
          )}
        </>
      )}
    </V2Surface>
  );
}
