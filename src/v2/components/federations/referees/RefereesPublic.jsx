/**
 * O que o PÚBLICO vê da arbitragem (também sem conta), pela função
 * `federationRefereesPublic`: o quadro (só quem está ativo e aceitou
 * aparecer — nome, nível e cidade) e quem apita cada evento público (só
 * confirmados — nome e função). Nunca valor, nota, conflito nem
 * disponibilidade.
 */
import React from 'react';
import { Flag } from 'lucide-react';
import { useRefereesPublic } from '@/modules/federations/hooks/useReferees';
import { fedModuleOn } from '@/modules/federations/domain/federation';
import { V2Avatar, V2ErrorState, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';
import { funcao, periodo } from './refUi';

function Pessoas({ people }) {
  return <ul className="space-y-0.5 text-sm text-ink">{people.map((p) => <li key={`${p.name}${p.function}`}>{p.name} <span className="text-gray-500">· {funcao(p.function)}</span></li>)}</ul>;
}

/** Aba Competições da página da federação: o quadro e as escalas dos eventos públicos. */
export function FedRefereesBoard({ federation }) {
  const ligado = fedModuleOn(federation, 'referees');
  const q = useRefereesPublic(federation?.id, { enabled: ligado });
  if (!ligado) return null;
  const d = q.data;
  return (
    <section id="fed-arbitragem" aria-labelledby="fed-arbitragem-titulo" className="scroll-mt-4 space-y-3" data-dica="federacao-pub-arbitragem">
      <h2 id="fed-arbitragem-titulo" className="font-display text-xl font-bold text-ink">{t('Quadro de arbitragem')}</h2>
      {q.isError && <V2ErrorState inline title={t('Não carregou a arbitragem')} onRetry={() => q.refetch()} />}
      {q.isLoading && <V2Skeleton lines={3} />}
      {d && !d.available && <p className="text-sm text-gray-500">{t('A arbitragem desta federação ainda não está aberta ao público.')}</p>}
      {d?.available && (
        <>
          {d.board.length === 0
            ? <p className="text-sm text-gray-500">{t('Nenhum árbitro escolheu aparecer no quadro público.')}</p>
            : (
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {d.board.map((r) => (
                  <li key={`${r.name}${r.city}`}>
                    <V2Surface variant="compacto" className="flex items-center gap-3 p-3">
                      <V2Avatar photoUrl={r.photo_url} name={r.name} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-ink">{r.name}</p>
                        <p className="text-xs text-gray-500">{r.level_label}{r.city ? ` · ${r.city}${r.state ? `/${r.state}` : ''}` : ''}</p>
                      </div>
                    </V2Surface>
                  </li>
                ))}
              </ul>
            )}
          {d.crews.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">{t('Quem apita')}</h3>
              <ul className="grid gap-2 sm:grid-cols-2">
                {d.crews.map((c) => (
                  <li key={`${c.event.kind}${c.event.id}`}>
                    <V2Surface variant="compacto" className="space-y-1 p-3">
                      <p className="font-semibold text-ink">{c.event.name}</p>
                      <p className="text-xs text-gray-500">{periodo(c.event)}{c.event.city ? ` · ${c.event.city}` : ''}</p>
                      <Pessoas people={c.people} />
                    </V2Surface>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}

/**
 * No torneio chancelado: quem apita (só confirmados). Some calado quando não
 * há arbitragem a mostrar — o torneio não depende dela —, mas a falha é dita.
 */
export function TournamentRefereeCrew({ tournament, className = '' }) {
  const fedId = tournament?.federation_id;
  const chancelado = Boolean(fedId) && tournament?.federation_sanction?.status === 'approved' && tournament?.visibility === 'public';
  const q = useRefereesPublic(fedId, { tournamentId: tournament?.id, enabled: chancelado });
  if (!chancelado) return null;
  if (q.isError) return <div className={className}><V2ErrorState inline title={t('Não carregou a arbitragem do torneio')} onRetry={() => q.refetch()} /></div>;
  const crew = q.data?.available ? q.data.crew : [];
  if (!crew.length) return null;
  return (
    <V2Surface variant="compacto" as="section" aria-label={t('Arbitragem')} className={`space-y-2 p-4 ${className}`} data-dica="torneio-arbitragem">
      <h2 className="flex items-center gap-2 text-sm font-bold text-ink"><Flag className="h-4 w-4" aria-hidden="true" />{t('Arbitragem')}</h2>
      <Pessoas people={crew} />
    </V2Surface>
  );
}
