/**
 * A ESTANTE de troféus de uma pessoa: torneios e dias de jogo, separados, com
 * as contagens por metal. Cada troféu abre o cartão (compartilhar, baixar,
 * imprimir). Na Minha área é a própria estante; no perfil público, a de quem
 * se visita — e ali os outros parabenizam.
 *
 * Fonte que não respondeu é dita ("ficou de fora"), nunca vira zero.
 */
import React, { lazy, Suspense, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Medal, Trophy, Swords, Share2 } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useTrophies } from '@/modules/trophies/hooks/useTrophies';
import { groupTrophies, trophyContextId, TROPHY_KIND } from '@/modules/trophies/domain/trophies.js';
import { dataPorExtenso } from '@/modules/trophies/domain/medalCard.js';
import { V2Button, V2ErrorState, V2FilterChip, V2Skeleton } from '@/v2/ui/primitives';
import { HomeEmpty, HomeAction } from '@/v2/components/home/personal/HomeSection';
import { cn } from '@/core/lib/utils';
import { METAL } from './MedalCard';
import CongratulateButton from './CongratulateButton';
import { t, fmtLista } from '@/core/i18n';

const MedalCardDialog = lazy(() => import('./MedalCardDialog'));

function Contagem({ contagem }) {
  return (
    <div className="flex flex-wrap gap-2" aria-label={t('Medalhas por metal')}>
      {[1, 2, 3].map((pos) => {
        const n = contagem[['', 'ouro', 'prata', 'bronze'][pos]];
        return (
          <span key={pos} className="inline-flex items-center gap-1.5 rounded-full border border-gray-100 bg-paper-pure px-3 py-1 text-sm font-bold text-ink">
            <span className="inline-block h-3 w-3 rounded-full" style={{ background: METAL[pos].cor }} aria-hidden="true" />
            {n} <span className="font-semibold text-gray-500">{METAL[pos].nome}</span>
          </span>
        );
      })}
    </div>
  );
}

/** Um troféu na estante: o medalhão do metal, o evento, a data. */
function TrofeuCard({ t: trofeu, onOpen, children }) {
  const metal = METAL[trofeu.position];
  return (
    <li className="group relative flex flex-col overflow-hidden rounded-3xl border border-gray-100 bg-paper-pure shadow-organic-sm">
      <button
        type="button"
        onClick={onOpen}
        className="flex flex-1 flex-col items-start gap-3 p-4 text-left transition-colors hover:bg-paper focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acid/30"
        aria-label={t('Abrir o cartão: {lugar} em {evento}', { lugar: trofeu.placeLabel, evento: trofeu.title })}
      >
        <span className="flex items-center gap-3">
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-display text-lg font-black text-ink"
            style={{ background: metal.cor, boxShadow: `0 0 0 3px #fff, 0 0 0 5px ${metal.cor}` }}
            aria-hidden="true"
          >
            {trofeu.position}º
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-bold uppercase tracking-wider text-gray-500">{trofeu.placeLabel}{trofeu.shared ? ` · ${t('dividido')}` : ''}</span>
            <span className="block truncate font-display text-base font-bold leading-tight text-ink">{trofeu.title}</span>
          </span>
        </span>
        <span className="text-sm text-gray-500">
          {trofeu.subtitle}{trofeu.date ? ` · ${dataPorExtenso(trofeu.date)}` : ''}
          {trofeu.record ? ` · ${t('{v} de {n} jogos', { v: trofeu.record.won, n: trofeu.record.played })}` : ''}
        </span>
        <span className="mt-auto inline-flex items-center gap-1 text-xs font-bold text-ink"><Share2 className="h-3.5 w-3.5" /> {t('Ver o cartão')}</span>
      </button>
      {children && <div className="border-t border-gray-100 p-3">{children}</div>}
    </li>
  );
}

/**
 * @param {{ uid: string, nome?: string, mine?: boolean, compacto?: boolean }} props
 */
export default function TrophyShelf({ uid, nome = '', mine = false, compacto = false }) {
  const { user } = useAuth();
  const q = useTrophies(uid);
  const grupo = useMemo(() => groupTrophies(q.data || {}), [q.data]);
  const [aba, setAba] = useState(TROPHY_KIND.TOURNAMENT);
  const [aberto, setAberto] = useState(null);

  if (q.isPending) return <V2Skeleton lines={4} />;
  if (q.isError) {
    return <V2ErrorState inline title={t('Não carregou os troféus')} description={t('Eles continuam lá — a conexão é que falhou.')} onRetry={() => q.refetch()} />;
  }

  const lista = aba === TROPHY_KIND.TOURNAMENT ? grupo.torneios : grupo.diasDeJogo;
  const vazioTotal = grupo.contagem.total === 0 && grupo.faltou.length === 0;
  const quem = mine ? t('Você') : (nome || t('Esta pessoa'));

  return (
    <div className="space-y-4">
      {grupo.faltou.length > 0 && (
        <V2ErrorState inline title={t('Ficou de fora: {fontes}', { fontes: fmtLista(grupo.faltou) })} description={t('A estante está incompleta até a conexão voltar.')} onRetry={() => q.refetch()} />
      )}
      {vazioTotal ? (
        <HomeEmpty
          icon={Medal}
          actions={mine ? <HomeAction to="/torneios">{t('Ver torneios abertos')}</HomeAction> : null}
        >
          {mine
            ? t('Sua estante ainda está vazia. O primeiro pódio num torneio ou num dia de jogo publicado aparece aqui, com o cartão pronto para compartilhar.')
            : t('{quem} ainda não subiu ao pódio num torneio ou dia de jogo publicado.', { quem })}
        </HomeEmpty>
      ) : (
        <>
          <Contagem contagem={grupo.contagem} />
          <div className="flex flex-wrap gap-2" role="tablist" aria-label={t('Tipo de conquista')}>
            <V2FilterChip role="tab" aria-selected={aba === TROPHY_KIND.TOURNAMENT} active={aba === TROPHY_KIND.TOURNAMENT} onClick={() => setAba(TROPHY_KIND.TOURNAMENT)}>
              <Trophy className="mr-1.5 h-3.5 w-3.5" /> Torneios ({grupo.contagem.torneios.total})
            </V2FilterChip>
            <V2FilterChip role="tab" aria-selected={aba === TROPHY_KIND.GAME_DAY} active={aba === TROPHY_KIND.GAME_DAY} onClick={() => setAba(TROPHY_KIND.GAME_DAY)}>
              <Swords className="mr-1.5 h-3.5 w-3.5" /> Dias de jogo ({grupo.contagem.diasDeJogo.total})
            </V2FilterChip>
          </div>
          {lista.length === 0 ? (
            <p className="text-sm text-gray-500">
              {aba === TROPHY_KIND.TOURNAMENT ? t('Nenhum pódio de torneio ainda.') : t('Nenhum pódio de dia de jogo publicado ainda.')}
            </p>
          ) : (
            <ul className={cn('grid gap-3', compacto ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3')}>
              {(compacto ? lista.slice(0, 4) : lista).map((tr) => (
                <TrofeuCard key={tr.id} t={tr} onOpen={() => setAberto(tr)}>
                  {!mine && user?.uid !== uid && (
                    <CongratulateButton
                      className="w-full"
                      contextId={trophyContextId(tr)}
                      toUids={[uid]}
                      scope={tr.kind === TROPHY_KIND.TOURNAMENT ? 'tournament' : 'universal'}
                      eventTitle={`${tr.title} · ${tr.subtitle}`}
                      placeLabel={tr.placeLabel}
                    />
                  )}
                  {tr.link && (
                    <V2Button asChild size="sm" variant="ghost" className="mt-1 w-full"><Link to={tr.link}>{tr.kind === TROPHY_KIND.TOURNAMENT ? t('Ver o torneio') : t('Ver o dia de jogo')}</Link></V2Button>
                  )}
                </TrofeuCard>
              ))}
            </ul>
          )}
          {compacto && lista.length > 4 && (
            <Link to="/perfil?secao=trofeus" className="text-sm font-semibold text-ink underline-offset-2 hover:underline">Ver todos os {lista.length}</Link>
          )}
        </>
      )}

      {aberto && (
        <Suspense fallback={null}>
          <MedalCardDialog
            open
            onOpenChange={(v) => { if (!v) setAberto(null); }}
            places={[{ position: aberto.position, label: aberto.placeLabel, entries: [{ label: aberto.people.map((p) => p.name).join(' / '), people: aberto.people }] }]}
            event={{ title: aberto.title, subtitle: aberto.subtitle, date: aberto.date, city: aberto.city, state: aberto.state, kind: aberto.kind }}
            link={aberto.publicLink || aberto.link}
            initialPosition={aberto.position}
          />
        </Suspense>
      )}
    </div>
  );
}
