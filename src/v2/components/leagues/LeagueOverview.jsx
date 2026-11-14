/**
 * A VISÃO GERAL da liga, no MESMO desenho da visão geral do torneio: o cartão
 * escuro do panorama (divisões, inscrições, acesso, temporada, local, como se
 * joga), o cartão do critério de classificação (a regra da tabela e os
 * critérios de desempate — os MESMOS da tabela, saídos da configuração da
 * liga) e as divisões em cards como as modalidades, com as vagas, a minha
 * inscrição e o "Inscrever-se", que abre o diálogo. As peças visuais são as
 * de `v2/components/competition/CompetitionOverview`.
 */
import React, { useMemo, useState } from 'react';
import { CalendarDays, Globe, Info, Layers, Link2, ListOrdered, MapPin, Plus, Sparkles, Trophy, Users } from 'lucide-react';
import { t } from '@/core/i18n';
import { cn } from '@/core/lib/utils';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { describeTiebreakOrder } from '@/core/domain/tiebreak';
import { V2Badge, V2Button, V2ErrorState, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import {
  CapacityBar, CriteriaCard, InfoSurface, RankingRule, SummaryTile, ruleOrder,
} from '@/v2/components/competition/CompetitionOverview';
import { formatMeta } from '@/modules/leagues/domain/leagueFormats';
import { currentRound, normalizeSeason, roundCalendar } from '@/modules/leagues/domain/leagueSeason';
import { STANDINGS_MODE_LABELS, leagueTiebreakOrder, matchWinner } from '@/modules/leagues/domain/leagueResults';
import { hojeLocal } from '@/modules/home/domain/freshness';
import { isLadderFormat, ladderTiebreakOrder } from '@/modules/leagues/domain/leagueLadder';
import LeagueRegisterDialog, { LeaveLeagueButton, selfRegistrationOpen } from './LeagueRegister';
import { divisionSummary, entryNoun, shortDate } from './leagueUi';

export default function LeagueOverview({ league, divisions, entries, matches, onGo }) {
  const { user } = useAuth();
  const [inscreverEm, setInscreverEm] = useState(null);
  const meta = formatMeta(league.format);
  const season = normalizeSeason(league.season);
  const escada = isLadderFormat(league.format);
  // Na escada o calendário é de SESSÕES (`session`); `round` é a volta dentro da quadra.
  const rodadas = useMemo(() => Math.max(0, ...(matches.data || []).filter((m) => m.phase !== 'playoff').map((m) => (escada ? m.session : m.round) || 0)), [matches.data, escada]);
  const rotulo = (n) => (escada ? t('Sessão {n}', { n }) : t('Rodada {n}', { n }));
  const calendario = useMemo(() => roundCalendar(season, rodadas || 5), [season, rodadas]);
  const agora = rodadas ? currentRound(calendario, hojeLocal()) : null;
  const ativos = useMemo(() => (entries.data || []).filter((e) => e.status === 'active'), [entries.data]);
  const pts = league.standings || {};
  const publica = league.visibility !== 'unlisted';
  const carregou = divisions.isSuccess && entries.isSuccess;

  const local = [league.city && `${league.city}${league.state ? ` / ${league.state}` : ''}`, league.location].filter(Boolean).join(' · ');
  const proxima = agora
    ? `${rotulo(agora.round)}${agora.date ? ` · ${shortDate(agora.date)}` : ''}${agora.deadline ? ` · ${t('Prazo até {data}', { data: shortDate(agora.deadline) })}` : ''}`
    : escada
      ? (rodadas ? t('As sessões previstas já passaram.') : t('A organização monta as quadras de cada sessão com quem vier.'))
      : (rodadas ? t('As rodadas desta temporada já passaram.') : t('As rodadas aparecem quando a organização gerar o calendário.'));
  const pontuacao = escada
    ? t('A classificação é a posição na escada: a cada sessão o 1º de cada quadra sobe e o último desce.')
    : pts.mode === 'win_pct'
      ? t(STANDINGS_MODE_LABELS.win_pct)
      : t('Vitória {v} · derrota {d} · W.O. {w}', { v: pts.win ?? 3, d: pts.loss ?? 1, w: pts.wo_loss ?? 0 });

  // Os critérios do cartão são os MESMOS que a tabela usa (configuração da liga).
  const criterios = describeTiebreakOrder(escada ? ladderTiebreakOrder(pts.tiebreak_order) : leagueTiebreakOrder(pts.tiebreak_order));
  const primeira = escada
    ? { title: t('Posição na escada'), description: t('A cada sessão o 1º de cada quadra sobe e o último desce; quem falta fica no lugar.') }
    : pts.mode === 'win_pct'
      ? { title: t('Aproveitamento'), description: t('A tabela parte da porcentagem de vitórias: quem jogou menos não sai em desvantagem.') }
      : { title: t('Pontos na tabela'), description: t('Vitória {v} · derrota {d} · W.O. {w}. A tabela parte da soma dos pontos.', { v: pts.win ?? 3, d: pts.loss ?? 1, w: pts.wo_loss ?? 0 }) };

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr,0.9fr]">
        <V2Surface className="bg-mesh shadow-glow">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold text-acid">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> {t('Visão geral da liga')}
          </div>
          <h3 className="mt-5 font-display text-3xl font-bold text-white">{t('Tudo o que atletas e organização precisam ler primeiro')}</h3>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-white/70 sm:text-base">
            {t('Temporada, local, regra da tabela e as divisões da liga.')}
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <SummaryTile icon={Layers} label={t('Divisões')} value={carregou ? (divisions.data || []).length : '—'} description={t('cada uma com a sua tabela')} />
            <SummaryTile icon={Users} label={t('Inscrições ativas')} value={carregou ? ativos.length : '—'} description={t('{quem} jogando a temporada', { quem: entryNoun(league.format, true) })} />
            <SummaryTile
              icon={publica ? Globe : Link2}
              label={t('Acesso')}
              value={publica ? t('Na lista de ligas') : t('Só com o link')}
              description={publica ? t('qualquer atleta encontra a liga e pode se inscrever') : t('a liga não aparece na lista; entra quem recebe o link')}
            />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <InfoSurface icon={CalendarDays} title={agora ? t('Agora na temporada') : t('Temporada')} description={proxima}>
              {calendario.length > 0 && (
                <ol className="mt-3 space-y-1 text-sm">
                  {calendario.slice(0, 6).map((r) => (
                    <li key={r.round} className="flex justify-between gap-2 text-white/60">
                      <span>{rotulo(r.round)}</span>
                      <span className="font-semibold text-white">{r.date ? shortDate(r.date) : t('a definir')}</span>
                    </li>
                  ))}
                </ol>
              )}
            </InfoSurface>
            <InfoSurface icon={MapPin} title={t('Local dos jogos')} description={local || t('Quadra ou clube ainda não informado.')} />
            <InfoSurface icon={Info} title={t('Como se joga')} description={meta ? t(meta.how) : '—'} />
            <InfoSurface icon={Trophy} title={t('Pontuação')} description={pontuacao} />
          </div>

          {league.description && (
            <div className="mt-4 whitespace-pre-line rounded-3xl border border-white/10 bg-white/5 p-5 text-sm leading-7 text-white/80 backdrop-blur-sm">
              {league.description}
            </div>
          )}
        </V2Surface>

        <CriteriaCard
          dica="liga-criterio"
          title={escada ? t('Como a escada anda.') : t('Como a tabela é calculada.')}
          description={escada
            ? t('Dentro de cada quadra da sessão, a ordem segue os critérios abaixo. Vale para todas as divisões da liga.')
            : t('A mesma regra vale em todas as divisões da liga, e é a que a tabela usa.')}
        >
          <div className="mt-6 space-y-3">
            <RankingRule order={ruleOrder(0)} title={primeira.title} description={primeira.description} />
            {criterios.map((c, i) => (
              <RankingRule key={c.key} order={ruleOrder(i + 1)} title={t(c.label)} description={t(c.help)} />
            ))}
          </div>
          <p className="mt-5 text-xs leading-5 text-white/50">
            {t('Os jogos da liga contam no ranking da plataforma e vão ao DUPR com as regras dos torneios: valem do lançamento do placar, e só quando todos os atletas têm conta.')}
          </p>
        </CriteriaCard>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="font-display text-xs font-bold uppercase tracking-widest text-gray-500">{t('Divisões')}</div>
            <h3 className="mt-2 font-display text-2xl font-bold text-ink">{t('Escolha a sua divisão ou o que acompanhar')}</h3>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
              {t('Cada divisão tem a sua tabela: só se enfrenta quem está na mesma divisão.')}
            </p>
          </div>
          <V2Button type="button" variant="ghost" size="sm" onClick={() => onGo('classificacao')}>
            <ListOrdered className="h-4 w-4" aria-hidden="true" /> {escada ? t('Ver a escada') : t('Ver a classificação')}
          </V2Button>
        </div>

        {divisions.isError || entries.isError ? (
          <V2Surface><V2ErrorState inline title={t('Não carregaram as divisões')} onRetry={() => { divisions.refetch(); entries.refetch(); }} /></V2Surface>
        ) : !carregou ? (
          <div className="grid gap-4 lg:grid-cols-2"><V2Skeleton className="h-56 rounded-4xl" /><V2Skeleton className="h-56 rounded-4xl" /></div>
        ) : !(divisions.data || []).length ? (
          <V2Surface className="text-center">
            <p className="py-6 text-sm text-gray-500">{t('A organização ainda não criou as divisões desta liga.')}</p>
          </V2Surface>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {divisions.data.map((d) => (
              <DivisionCard
                key={d.id}
                league={league}
                division={d}
                active={ativos.filter((e) => e.division_id === d.id)}
                matches={(matches.data || []).filter((m) => m.division_id === d.id)}
                uid={user?.uid}
                onRegister={() => setInscreverEm(d.id)}
                onOpen={() => onGo('classificacao')}
              />
            ))}
          </div>
        )}

        {league.status === 'open' && league.self_registration === false && (
          <p className="rounded-2xl bg-paper p-4 text-sm text-gray-500">{t('Nesta liga quem inscreve é a organização. Fale com ela para entrar.')}</p>
        )}
      </section>

      {inscreverEm && (
        <LeagueRegisterDialog
          open
          league={league}
          divisions={divisions.data}
          entries={entries.data}
          divisionId={inscreverEm}
          onClose={() => setInscreverEm(null)}
        />
      )}
    </div>
  );
}

function DivisionCard({ league, division, active, matches, uid, onRegister, onOpen }) {
  const minha = active.find((e) => (e.player_uids || []).includes(uid)) || null;
  const max = Number(division.max_entries) || 0;
  const cheia = max > 0 && active.length >= max;
  const aberta = selfRegistrationOpen(league);
  const comPlacar = matches.filter((m) => matchWinner(m)).length;
  const quem = entryNoun(league.format, true);
  const motivo = league.status === 'draft'
    ? t('Rascunho: inscrições ainda fechadas')
    : league.status === 'open'
      ? t('Quem inscreve é a organização')
      : t('Inscrições encerradas');

  return (
    <V2Surface className={cn('flex h-full flex-col p-5 sm:p-6', minha && 'border-acid/40 bg-acid/5')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-display text-xl font-bold text-ink">{division.name}</h4>
            {minha && <V2Badge tone="green">{t('Você está inscrito')}</V2Badge>}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <V2Badge tone="neutral">{divisionSummary(division)}</V2Badge>
          </div>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-ink text-acid">
          <Layers className="h-4.5 w-4.5" aria-hidden="true" />
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <V2Surface variant="plano">
          <div className="text-2xs font-bold uppercase tracking-widest text-gray-500">{t('Capacidade')}</div>
          <div className="mt-2 text-sm font-medium text-ink">
            {max ? t('{n} de {max} {quem}', { n: active.length, max, quem }) : t('{n} {quem}', { n: active.length, quem })}
          </div>
          <div className="mt-3">
            {max ? <CapacityBar value={active.length} max={max} full={cheia} /> : (
              <div className="rounded-2xl border border-dashed border-acid/40 bg-acid/10 px-3 py-2 text-2xs text-ink">
                {t('Vagas abertas sem limite definido para esta divisão.')}
              </div>
            )}
          </div>
        </V2Surface>
        <V2Surface variant="plano">
          <div className="text-2xs font-bold uppercase tracking-widest text-gray-500">{t('Jogos')}</div>
          <div className="mt-2 text-sm font-medium text-ink">
            {matches.length ? t('{n} de {total} com placar', { n: comPlacar, total: matches.length }) : t('Ainda sem jogos')}
          </div>
          <p className="mt-3 text-xs leading-5 text-gray-500">
            {matches.length ? t('A tabela da divisão se atualiza a cada placar lançado.') : t('Os jogos aparecem quando a organização gerar as rodadas.')}
          </p>
        </V2Surface>
      </div>

      {minha && (minha.players || []).length > 0 && (
        <p className="mt-4 text-sm text-gray-600">{(minha.players || []).map((p) => p.name).join(' · ')}</p>
      )}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
        <V2Button type="button" variant="ghost" size="sm" onClick={onOpen}>
          <Info className="h-4 w-4" aria-hidden="true" /> {t('Ver a tabela')}
        </V2Button>
        <div className="flex flex-wrap items-center gap-2">
          {minha ? (
            <LeaveLeagueButton league={league} entry={minha} />
          ) : aberta ? (
            <V2Button type="button" size="sm" onClick={onRegister} disabled={cheia} data-dica="liga-inscrever">
              <Plus className="h-4 w-4" aria-hidden="true" /> {cheia ? t('Divisão completa') : t('Inscrever-se')}
            </V2Button>
          ) : (
            <V2Badge tone="neutral">{motivo}</V2Badge>
          )}
        </div>
      </div>
    </V2Surface>
  );
}
