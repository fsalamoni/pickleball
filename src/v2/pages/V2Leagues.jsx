/**
 * /ligas — a área das LIGAS, ao lado dos torneios e sem se misturar com eles,
 * no MESMO desenho da lista de torneios: a mesma barra de abas, a mesma faixa
 * de região, os mesmos cartões (`CompetitionCard`) e as encerradas guardadas
 * atrás de um botão. Duas abas: as ligas abertas a todos e as minhas (onde
 * jogo ou organizo) — `?aba=minhas` abre a segunda (link da gestão da liga).
 * Só aparece com alguma flag de ligas ligada (ou para o admin da plataforma).
 */
import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Archive, CalendarDays, Globe, Link2, ListOrdered, Plus, Trophy, Users } from 'lucide-react';
import { t } from '@/core/i18n';
import { V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Page, V2PageIntro, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { useRegionalList } from '@/core/lib/useMyRegion';
import { distanceLabel } from '@/core/domain/region';
import RegionBar, { RegionEmptyHint } from '@/v2/components/region/RegionBar';
import CompetitionCard from '@/v2/components/competition/CompetitionCard';
import { CompetitionTabs } from '@/v2/components/competition/CompetitionNav';
import { useMyLeagues, usePublicLeagues } from '@/modules/leagues/hooks/useLeagues';
import LeaguesGate from '@/v2/components/leagues/LeaguesGate';
import { formatMeta } from '@/modules/leagues/domain/leagueFormats';
import { LEAGUE_ORGANIZER_LABELS } from '@/modules/leagues/domain/leagueAccess';
import { LeagueStatusBadge, entryNoun, shortDate } from '@/v2/components/leagues/leagueUi';

// Rolando primeiro, depois as abertas, depois o resto (o mais novo antes).
const ORDEM = { running: 0, open: 1, draft: 2, finished: 3, cancelled: 4 };
const ordenar = (lista) => [...(lista || [])].sort((a, b) => (ORDEM[a.status] ?? 9) - (ORDEM[b.status] ?? 9)
  || String(b.season?.start_date || '').localeCompare(String(a.season?.start_date || '')));
const ENCERRADA = new Set(['finished', 'cancelled']);

export default function V2Leagues() {
  return <LeaguesGate><Ligas /></LeaguesGate>;
}

function Ligas() {
  const [params, setParams] = useSearchParams();
  const aba = params.get('aba') === 'minhas' ? 'mine' : 'public';
  const setAba = (v) => setParams(v === 'mine' ? { aba: 'minhas' } : {}, { replace: true });
  const publicas = usePublicLeagues();
  const minhas = useMyLeagues();
  const q = aba === 'mine' ? minhas : publicas;
  const [verEncerradas, setVerEncerradas] = useState(false);

  // Públicas: o que ainda vale fica na frente (e passa pela região); a
  // encerrada ou cancelada só aparece se a pessoa pedir. Minhas: tudo.
  const todasPublicas = useMemo(() => ordenar(publicas.data), [publicas.data]);
  const atuais = useMemo(() => todasPublicas.filter((l) => !ENCERRADA.has(l.status)), [todasPublicas]);
  const encerradas = useMemo(() => todasPublicas.filter((l) => ENCERRADA.has(l.status)), [todasPublicas]);
  const regional = useRegionalList(atuais, (l) => ({ city: l.city, state: l.state }));
  const meus = useMemo(() => ordenar(minhas.data), [minhas.data]);

  const lista = aba === 'mine' ? meus : regional.itens;
  const vazio = lista.length === 0 && !(aba === 'public' && regional.fora > 0);

  return (
    <V2Page>
      <V2PageIntro
        title={t('Ligas')}
        subtitle={t('Competição contínua: rodadas no calendário durante semanas ou meses, com classificação por pontos.')}
        action={(
          <div className="flex flex-wrap gap-2">
            {/* O torneio mora ao lado, no seu próprio módulo: só o atalho aqui. */}
            <V2Button asChild variant="ghost"><Link to="/torneios/criar"><Trophy className="h-4 w-4" aria-hidden="true" /> {t('Criar torneio')}</Link></V2Button>
            <V2Button asChild><Link to="/ligas/criar" data-dica="ligas-criar"><Plus className="h-4 w-4" aria-hidden="true" /> {t('Criar liga')}</Link></V2Button>
          </div>
        )}
      />

      <CompetitionTabs
        tabs={[{ value: 'public', label: t('Abertas a todos') }, { value: 'mine', label: t('Minhas ligas') }]}
        active={aba}
        onSelect={setAba}
        ariaLabel={t('Ligas abertas ou minhas')}
        dica="ligas-abas"
        className="mb-4"
      />

      {aba === 'public' && <RegionBar regional={regional} className="mb-6" nomeItens={['liga', 'ligas']} />}
      {!(aba === 'public' && regional.ativa) && <div className="mb-4" />}

      {q.isLoading || (aba === 'public' && regional.carregando) ? (
        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => <V2Skeleton key={i} className="h-56 rounded-4xl" />)}
        </div>
      ) : q.isError ? (
        <V2Surface>
          <V2ErrorState
            title={t('Não foi possível carregar as ligas')}
            description={t('A conexão falhou no meio do caminho. Nenhuma liga foi perdida.')}
            onRetry={() => q.refetch()}
          />
        </V2Surface>
      ) : vazio ? (
        <V2Surface>
          <V2EmptyState
            icon={ListOrdered}
            title={aba === 'mine' ? t('Você ainda não está em nenhuma liga') : t('Nenhuma liga aberta por enquanto')}
            description={aba === 'mine'
              ? t('Entre numa liga aberta ou crie a sua para jogar a temporada inteira.')
              : t('Assim que uma liga abrir as inscrições{v1}, ela aparece aqui.', { v1: regional.limita ? ` ${regional.frase}` : '' })}
            action={<V2Button asChild><Link to="/ligas/criar">{t('Criar liga')}</Link></V2Button>}
          />
        </V2Surface>
      ) : (
        <>
          <RegionEmptyHint regional={aba === 'public' ? regional : null} oque={t('Nenhuma liga aberta por enquanto')} className="mb-6" />
          {lista.length > 0 && (
            <div data-dica="ligas-lista" className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
              {lista.map((l) => (
                <LeagueCard
                  key={l.id}
                  league={l}
                  distancia={aba === 'public' && regional.ativa ? distanceLabel(regional.infoDe(l)?.km) : null}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Como nos torneios: a liga encerrada sai da frente, mas a tabela final
          continua a um toque. */}
      {aba === 'public' && !q.isLoading && !q.isError && encerradas.length > 0 && (
        <div className="mt-10">
          {verEncerradas ? (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <p className="text-2xs font-bold uppercase tracking-widest text-gray-500">{t('Encerradas ({n})', { n: encerradas.length })}</p>
                <V2Button type="button" variant="ghost" size="sm" onClick={() => setVerEncerradas(false)}>{t('Esconder encerradas')}</V2Button>
              </div>
              <div className="grid gap-6 opacity-80 lg:grid-cols-2 xl:grid-cols-3">
                {encerradas.map((l) => <LeagueCard key={l.id} league={l} />)}
              </div>
            </>
          ) : (
            <V2Button type="button" variant="secondary" size="sm" onClick={() => setVerEncerradas(true)}>
              <Archive className="h-4 w-4" aria-hidden="true" /> {t('Ver as {n} ligas encerradas', { n: encerradas.length })}
            </V2Button>
          )}
        </div>
      )}
    </V2Page>
  );
}

function LeagueCard({ league, distancia = null }) {
  const meta = formatMeta(league.format);
  const local = league.city ? `${league.city}${league.state ? ` / ${league.state}` : ''}` : t('Local a definir');
  const organizacao = `${t(LEAGUE_ORGANIZER_LABELS[league.organizer?.type] || '')}${league.organizer?.name ? ` · ${league.organizer.name}` : ''}`.trim();
  return (
    <CompetitionCard
      to={`/ligas/${league.id}`}
      icon={ListOrdered}
      title={league.name}
      status={<LeagueStatusBadge status={league.status} />}
      location={`${local}${distancia ? ` · ${distancia}` : ''}`}
      description={league.description}
      badges={(
        <>
          {meta && <V2Badge tone="neutral"><Trophy className="h-3 w-3" aria-hidden="true" /> {t(meta.label)}</V2Badge>}
          {league.season?.start_date && <V2Badge tone="neutral"><CalendarDays className="h-3 w-3" aria-hidden="true" /> {t('Desde {data}', { data: shortDate(league.season.start_date) })}</V2Badge>}
          <V2Badge tone="neutral">
            {league.visibility === 'unlisted' ? <Link2 className="h-3 w-3" aria-hidden="true" /> : <Globe className="h-3 w-3" aria-hidden="true" />}
            {' '}{league.visibility === 'unlisted' ? t('Só com o link') : t('Na lista de ligas')}
          </V2Badge>
          <V2Badge tone="neutral"><Users className="h-3 w-3" aria-hidden="true" /> {league.entries_count || 0} {entryNoun(league.format, true)}</V2Badge>
          {organizacao && <V2Badge tone="neutral">{organizacao}</V2Badge>}
        </>
      )}
      /* Como no torneio: com a inscrição aberta, o cartão diz o que dá para
         FAZER — é na divisão que fica o "Inscrever-se". */
      footer={league.status === 'open' && league.self_registration !== false
        ? t('Ver divisões e se inscrever')
        : t('Abrir liga')}
    />
  );
}
