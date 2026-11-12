/**
 * A ESTANTE de troféus de uma pessoa: os pódios de TORNEIO (e, na própria
 * estante, os de fora, declarados), com as contagens por metal. Dia de jogo
 * não é torneio e não tem medalha (docs/43 §1). Cada troféu abre o cartão (compartilhar, baixar,
 * imprimir). Na Minha área é a própria estante; no perfil público, a de quem
 * se visita — e ali os outros parabenizam.
 *
 * Fonte que não respondeu é dita ("ficou de fora"), nunca vira zero.
 */
import React, { lazy, Suspense, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Medal, Trophy, Share2, Route } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useCareerEvents } from '@/modules/career/hooks/useCareer';
import { useMyTournaments } from '@/modules/tournament/hooks/useTournament';
import { careerTrophies, careerTrophyCounts } from '@/modules/career/domain/timeline.js';
import { useTrophies } from '@/modules/trophies/hooks/useTrophies';
import { groupTrophies, trophyContextId, TROPHY_KIND } from '@/modules/trophies/domain/trophies.js';
import { dataPorExtenso } from '@/modules/trophies/domain/medalCard.js';
import { V2Badge, V2Button, V2ErrorState, V2FilterChip, V2Skeleton } from '@/v2/ui/primitives';
import { HomeEmpty, HomeAction } from '@/v2/components/home/personal/HomeSection';
import { cn } from '@/core/lib/utils';
import { METAL } from './MedalCard';
import CongratulateButton from './CongratulateButton';
import { t, fmtLista } from '@/core/i18n';

const MedalCardDialog = lazy(() => import('./MedalCardDialog'));

/** A aba dos torneios de fora (Carreira) — o mesmo valor do `kind` dos troféus declarados. */
export const ABA_FORA = 'fora';

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
          {/* `tema-claro`: a cor do metal vem em `style` e não troca no modo escuro. */}
          <span
            className="tema-claro flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-display text-lg font-black text-ink"
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
          {trofeu.subtitle}{trofeu.dateLabel || trofeu.date ? ` · ${trofeu.dateLabel || dataPorExtenso(trofeu.date)}` : ''}
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
export default function TrophyShelf({ uid, nome = '', mine = false, compacto = false, abaInicial = TROPHY_KIND.TOURNAMENT }) {
  const { user } = useAuth();
  const q = useTrophies(uid);
  const grupo = useMemo(() => groupTrophies(q.data || {}), [q.data]);
  // Carreira: os pódios DECLARADOS (torneios de fora), só na estante
  // da própria pessoa. Contagens próprias; o `destaque` segue só o verificado.
  const carreiraOn = useFeatureFlag(FEATURE_FLAG.ATHLETE_CAREER) && mine;
  const foraQ = useCareerEvents({ enabled: carreiraOn });
  // Os torneios em que joguei: o ligado pelo "É este" (selo oficial) NÃO gera troféu
  // em "Fora" — a colocação dele é a oficial, que já está na aba Torneios (`careerTrophies`).
  const meusQ = useMyTournaments({ enabled: carreiraOn });
  const meus = meusQ.isSuccess ? meusQ.data : undefined;
  const foraTodos = useMemo(() => {
    if (!carreiraOn || !foraQ.isSuccess) return [];
    return careerTrophies(foraQ.data, { myTournaments: meus, me: { uid, name: nome || t('Você') } });
  }, [carreiraOn, foraQ.isSuccess, foraQ.data, meus, uid, nome]);
  // Sem os torneios da plataforma em mãos não dá para saber se o ligado ("É este") é
  // oficial: ele fica de fora (e é dito), em vez de aparecer como Declarado E duplicado.
  const fora = useMemo(() => (meus ? foraTodos : foraTodos.filter((tr) => !tr.platformTournamentId)), [foraTodos, meus]);
  const ligadosSemConferir = foraTodos.length - fora.length;
  const foraConta = careerTrophyCounts(fora);
  const [aba, setAba] = useState(abaInicial);
  const [aberto, setAberto] = useState(null);
  const [expandido, setExpandido] = useState(false);

  if (q.isPending || (carreiraOn && (foraQ.isPending || meusQ.isPending))) return <V2Skeleton lines={4} />;
  if (q.isError) {
    return <V2ErrorState inline title={t('Não carregou os troféus')} description={t('Eles continuam lá — a conexão é que falhou.')} onRetry={() => q.refetch()} />;
  }

  const ehFora = aba === ABA_FORA && carreiraOn;
  const lista = ehFora ? fora : grupo.torneios;
  const vazioTotal = grupo.contagem.total === 0 && grupo.faltou.length === 0 && fora.length === 0 && !foraQ.isError && ligadosSemConferir === 0;
  const quem = mine ? t('Você') : (nome || t('Esta pessoa'));
  const recolhido = compacto && !(expandido && !mine);
  const registrarFora = carreiraOn ? <HomeAction to="/carreira?registrar=1">{t('Registrar torneio de fora')}</HomeAction> : null;

  return (
    <div className="space-y-4">
      {grupo.faltou.length > 0 && (
        <V2ErrorState inline title={t('Ficou de fora: {fontes}', { fontes: fmtLista(grupo.faltou) })} description={t('A estante está incompleta até a conexão voltar.')} onRetry={() => q.refetch()} />
      )}
      {vazioTotal ? (
        <HomeEmpty
          icon={Medal}
          actions={mine ? <><HomeAction to="/torneios">{t('Ver torneios abertos')}</HomeAction>{registrarFora}</> : null}
        >
          {mine
            ? t('Sua estante ainda está vazia. O primeiro pódio num torneio aparece aqui, com o cartão pronto para compartilhar.')
            : t('{quem} ainda não subiu ao pódio num torneio.', { quem })}
        </HomeEmpty>
      ) : (
        <>
          <Contagem contagem={ehFora ? foraConta : grupo.contagem} />
          <div className="flex flex-wrap gap-2" role="tablist" aria-label={t('Tipo de conquista')}>
            <V2FilterChip role="tab" aria-selected={!ehFora} active={!ehFora} onClick={() => setAba(TROPHY_KIND.TOURNAMENT)}>
              <Trophy className="mr-1.5 h-3.5 w-3.5" /> {t('Torneios')} ({grupo.contagem.total})
            </V2FilterChip>
            {carreiraOn && (
              <V2FilterChip role="tab" aria-selected={ehFora} active={ehFora} onClick={() => setAba(ABA_FORA)}>
                <Route className="mr-1.5 h-3.5 w-3.5" /> {t('Fora da plataforma')} ({foraQ.isError ? '—' : foraConta.total})
              </V2FilterChip>
            )}
          </div>
          {ehFora && (
            <p className="text-xs text-gray-500">{t('Declarados por você na Carreira. Não entram em ranking, rating nem XP.')}</p>
          )}
          {ehFora && ligadosSemConferir > 0 && (
            <V2ErrorState
              inline
              title={t('Não deu para conferir os torneios da plataforma')}
              description={t('Os pódios ligados a um torneio daqui ficaram de fora até a conexão voltar.')}
              onRetry={() => meusQ.refetch()}
            />
          )}
          {ehFora && foraQ.isError ? (
            <V2ErrorState inline title={t('Não carregaram os torneios de fora')} onRetry={() => foraQ.refetch()} />
          ) : lista.length === 0 ? (
            ehFora ? (
              // Com pódio ligado sem conferir, o vazio não é afirmado: o aviso acima já diz.
              ligadosSemConferir === 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-gray-500">{t('Você ainda não registrou pódio de torneio de fora.')}</p>
                  {registrarFora}
                </div>
              )
            ) : (
              <p className="text-sm text-gray-500">{t('Nenhum pódio de torneio ainda.')}</p>
            )
          ) : (
            <ul id={`estante-${uid}`} className={cn('grid gap-3', compacto ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3')}>
              {(recolhido ? lista.slice(0, 4) : lista).map((tr) => (
                <TrofeuCard key={tr.id} t={tr} onOpen={() => setAberto(tr)}>
                  {tr.declared && <V2Badge tone="neutral">{t('Declarado')}</V2Badge>}
                  {!mine && user?.uid !== uid && (
                    <CongratulateButton
                      className="w-full"
                      contextId={trophyContextId(tr)}
                      toUids={[uid]}
                      scope="tournament"
                      eventTitle={`${tr.title} · ${tr.subtitle}`}
                      placeLabel={tr.placeLabel}
                    />
                  )}
                  {tr.link && (
                    <V2Button asChild size="sm" variant="ghost" className="mt-1 w-full"><Link to={tr.link}>{tr.kind === ABA_FORA ? t('Abrir a ficha') : t('Ver o torneio')}</Link></V2Button>
                  )}
                </TrofeuCard>
              ))}
            </ul>
          )}
          {compacto && lista.length > 4 && (
            mine ? (
              <Link to="/perfil?secao=trofeus" className="text-sm font-semibold text-ink underline-offset-2 hover:underline">{t('Ver todos os {n}', { n: lista.length })}</Link>
            ) : (
              // Na estante de OUTRA pessoa não há página para ir: abre aqui mesmo (o botão fica, e o foco com ele).
              <V2Button type="button" size="sm" variant="ghost" aria-expanded={expandido} aria-controls={`estante-${uid}`} onClick={() => setExpandido((v) => !v)}>
                {expandido ? t('Mostrar menos') : t('Ver todos os {n}', { n: lista.length })}
              </V2Button>
            )
          )}
        </>
      )}

      {aberto && (
        <Suspense fallback={null}>
          <MedalCardDialog
            open
            onOpenChange={(v) => { if (!v) setAberto(null); }}
            places={[{ position: aberto.position, label: aberto.placeLabel, entries: [{ label: aberto.people.map((p) => p.name).join(' / '), people: aberto.people }] }]}
            event={{ title: aberto.title, subtitle: aberto.subtitle, date: aberto.date, dateLabel: aberto.dateLabel || null, city: aberto.city, state: aberto.state, kind: aberto.kind, declared: aberto.declared === true }}
            // O de fora não tem página pública: o cartão sai sem link nem QR.
            link={aberto.kind === ABA_FORA ? null : aberto.publicLink || aberto.link}
            initialPosition={aberto.position}
          />
        </Suspense>
      )}
    </div>
  );
}
