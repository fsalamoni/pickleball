/**
 * A LINHA DO TEMPO PESSOAL do torneio (flag `tournament_personal_view`,
 * docs/55): as abas "Minha participação" e "Acompanhar" e a faixa
 * "Seu próximo jogo" do topo da página do torneio.
 *
 * Os jogos de todas as categorias numa lista só, por dia e horário, com a
 * fase, a quadra, o placar e — na chave — o próximo confronto possível. A
 * conta é `buildPersonalTimeline` (domínio puro); os dados são os do quadro
 * do torneio (leitura pública), e os jogos se atualizam sozinhos.
 *
 * Quem a pessoa acompanha fica na URL (`?pessoas=`, dá para mandar o link) e
 * no navegador, por conta e por torneio — zero banco.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CalendarClock, ChevronRight, Clock, GitBranch, MapPin, Medal, Radio, Trophy, Users,
} from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useMeInTournament, useTournamentTimelineData } from '@/modules/tournament/hooks/usePersonalTimeline';
import { buildPersonalTimeline, registrationShortLabel } from '@/modules/tournament/domain/personalTimeline';
import { PODIUM_PLACE } from '@/modules/tournament/domain/podium';
import { REGISTRATION_STATUS, REGISTRATION_STATUS_LABELS } from '@/modules/tournament/domain/constants';
import { isActiveRegistration } from '@/modules/tournament/domain/checkin';
import { normalizePhases } from '@/modules/tournament/domain/phases';
import { isKnockoutStage } from '@/modules/tournament/domain/bracketLayout';
import { readViewPreference, writeViewPreference } from '@/core/lib/viewPreference';
import {
  V2Avatar, V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Skeleton, V2Surface,
} from '@/v2/ui/primitives';
import PersonPicker from '@/v2/components/people/PersonPicker';
import V2BracketTree from './V2BracketTree';
import V2Collapsible from './V2Collapsible';
import { cn } from '@/core/lib/utils';
import { fmtData, t, tn } from '@/core/i18n';

const MAX_ACOMPANHADOS = 10;

/* ------------------------------------------------------------------ */
/* Formatação                                                          */
/* ------------------------------------------------------------------ */

const hora = (ms) => fmtData(new Date(ms), { hour: '2-digit', minute: '2-digit' });

function tituloDoDia(dia) {
  if (dia.at == null) return t('Sem horário definido');
  const d = new Date(dia.at);
  const hoje = new Date();
  const zero = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((zero(d) - zero(hoje)) / 86400000);
  const data = fmtData(d, {
    weekday: 'long', day: 'numeric', month: 'long',
    // O ano só quando não é o corrente ("5 de janeiro" de outro ano engana).
    ...(d.getFullYear() !== hoje.getFullYear() ? { year: 'numeric' } : {}),
  });
  if (diff === 0) return t('Hoje · {data}', { data });
  if (diff === 1) return t('Amanhã · {data}', { data });
  if (diff === -1) return t('Ontem · {data}', { data });
  return data.charAt(0).toUpperCase() + data.slice(1);
}

function colocacaoTexto(position) {
  if (!position) return null;
  if (PODIUM_PLACE[position]) return PODIUM_PLACE[position].um;
  return t('{n}º lugar', { n: position });
}

const placarTexto = (score) => score.map((g) => `${g.a}-${g.b}`).join(' · ');

/* ------------------------------------------------------------------ */
/* Um jogo                                                             */
/* ------------------------------------------------------------------ */

function Resultado({ item }) {
  if (item.live) {
    return (
      <V2Badge tone="acid">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink" aria-hidden /> {t('Em quadra')}
      </V2Badge>
    );
  }
  if (item.bye) return <V2Badge tone="neutral">{t('Passa direto')}</V2Badge>;
  if (item.outcome === 'won') return <V2Badge tone="green">{item.walkover ? t('Vitória por W.O.') : t('Vitória')}</V2Badge>;
  if (item.outcome === 'lost') return <V2Badge tone="red">{item.walkover ? t('Derrota por W.O.') : t('Derrota')}</V2Badge>;
  if (item.winnerSide) return <V2Badge tone="neutral">{t('Encerrado')}</V2Badge>;
  if (item.next) return <V2Badge tone="ink">{t('Próximo')}</V2Badge>;
  return <V2Badge tone="neutral">{t('Agendado')}</V2Badge>;
}

function Lado({ lado, venceu }) {
  return (
    <span className={cn(
      'block min-w-0 truncate',
      lado.tracked ? 'font-bold text-ink' : 'font-medium text-gray-600',
      venceu && 'text-green-700',
    )}
    >
      {venceu && <Trophy className="mr-1 inline h-3.5 w-3.5" aria-label={t('Vencedor')} />}
      {lado.label || t('A definir')}
    </span>
  );
}

function JogoItem({ item, pessoasPorId, mostrarPessoas }) {
  const quem = mostrarPessoas ? item.personIds.map((id) => pessoasPorId.get(id)).filter(Boolean) : [];
  return (
    <li
      className={cn(
        'flex gap-3 rounded-2xl border bg-paper-pure p-3 sm:gap-4 sm:p-4',
        item.next || item.live ? 'border-acid ring-2 ring-acid/30' : 'border-gray-100',
      )}
      aria-current={item.next ? 'true' : undefined}
    >
      <div className="w-14 shrink-0 text-center sm:w-16">
        <div className="font-display text-lg font-bold tabular-nums text-ink">{item.at != null ? hora(item.at) : '—'}</div>
        {item.court && <div className="mt-0.5 truncate text-2xs font-semibold uppercase tracking-wide text-gray-500" title={item.court}>{item.court}</div>}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs font-bold uppercase tracking-widest text-gray-500">
          <span className="text-ink">{item.modalityName}</span>
          <span aria-hidden>·</span>
          <span>{item.roundLabel}</span>
          {item.phaseLabel && <span className="normal-case tracking-normal text-gray-500">({item.phaseLabel})</span>}
        </div>
        {item.bye ? (
          <p className="mt-1.5 text-sm text-gray-600">
            {t('{quem} passa direto para a próxima rodada.', { quem: (item.sideA.ids.length ? item.sideA : item.sideB).label })}
          </p>
        ) : (
          <div className="mt-1.5 grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-0.5 text-sm">
            <Lado lado={item.sideA} venceu={item.winnerSide === 'a'} />
            <span className="row-span-2 text-right font-display text-sm font-bold tabular-nums text-ink">
              {item.score.length ? placarTexto(item.score) : <span className="text-xs font-semibold text-gray-500">{t('vs')}</span>}
            </span>
            <Lado lado={item.sideB} venceu={item.winnerSide === 'b'} />
          </div>
        )}
        {quem.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {quem.map((p) => (
              <span key={p.id} className="inline-flex items-center gap-1.5 rounded-full bg-paper px-2 py-0.5 text-xs font-semibold text-ink">
                <V2Avatar name={p.name} photoUrl={p.photo_url} size="xs" /> {p.name.split(' ')[0]}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="shrink-0 self-start"><Resultado item={item} /></div>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* As inscrições (uma por categoria) e a chave                          */
/* ------------------------------------------------------------------ */

function InscricaoCard({ entry, tournament, data, pessoa, mostrarPessoa }) {
  const [verChave, setVerChave] = useState(false);
  const regId = String(entry.registration.id);
  const fases = normalizePhases(entry.modality?.stages);
  // A fase de chave mais adiantada em que a inscrição aparece.
  const chave = useMemo(() => {
    for (let si = fases.length - 1; si >= 0; si -= 1) {
      const lista = data.matches.filter((m) => m.modality_id === entry.modality?.id && (m.stage_index ?? 0) === si);
      const aparece = lista.some((m) => (m.side_a_ids || []).map(String).includes(regId) || (m.side_b_ids || []).map(String).includes(regId));
      if (aparece && isKnockoutStage(fases[si], lista)) return { si, lista, fase: fases[si] };
    }
    return null;
  }, [data.matches, entry.modality, fases, regId]);
  const labelById = useMemo(() => new Map(data.registrations.map((r) => [String(r.id), registrationShortLabel(r)])), [data.registrations]);
  const colocacao = entry.complete ? colocacaoTexto(entry.position) : null;
  const statusFora = entry.status && !isActiveRegistration({ status: entry.status });

  return (
    <li className="rounded-2xl border border-gray-100 bg-paper-pure p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-base font-bold text-ink">{entry.modalityName}</p>
          <p className="truncate text-sm text-gray-600">
            {mostrarPessoa && pessoa ? `${pessoa.name} · ` : ''}{entry.label}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {colocacao && <V2Badge tone={entry.position <= 3 ? 'acid' : 'neutral'}><Medal className="h-3.5 w-3.5" aria-hidden /> {colocacao}</V2Badge>}
          {statusFora && <V2Badge tone="amber">{REGISTRATION_STATUS_LABELS[entry.status] || entry.status}</V2Badge>}
          {entry.registration.status === REGISTRATION_STATUS.CHECKED_IN && <V2Badge tone="green">{REGISTRATION_STATUS_LABELS[entry.status]}</V2Badge>}
        </div>
      </div>
      <p className="mt-2 text-xs text-gray-500">
        {entry.total === 0
          ? t('Os jogos aparecem aqui assim que o sorteio sair.')
          : [
            tn(entry.total, '{n} jogo', '{n} jogos'),
            tn(entry.won, '{n} vitória', '{n} vitórias'),
            tn(entry.lost, '{n} derrota', '{n} derrotas'),
          ].join(' · ')}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {chave && (
          <V2Button type="button" size="sm" variant={verChave ? 'secondary' : 'ghost'} onClick={() => setVerChave((v) => !v)} aria-expanded={verChave}>
            <GitBranch className="h-4 w-4" /> {verChave ? t('Esconder a chave') : t('Ver a chave')}
          </V2Button>
        )}
        {entry.modality && (
          <Link to={`/torneios/${tournament.id}/modalidades/${entry.modality.id}`} className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm font-semibold text-ink hover:underline">
            {t('Abrir a categoria')} <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        )}
      </div>
      {chave && verChave && (
        <div className="mt-3">
          <V2BracketTree
            matches={chave.lista}
            labelById={labelById}
            thirdPlace={Boolean(chave.fase?.third_place)}
            double={chave.fase?.type === 'double_knockout'}
            destaque={new Set([regId])}
          />
        </div>
      )}
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* A linha do tempo (uma ou várias pessoas)                             */
/* ------------------------------------------------------------------ */

function LinhaDoTempo({ tournament, data, pessoas, minha = false }) {
  const tl = useMemo(() => buildPersonalTimeline({
    people: pessoas,
    registrations: data.registrations,
    matches: data.matches,
    modalities: data.modalities,
    tournament,
  }), [pessoas, data.registrations, data.matches, data.modalities, tournament]);
  const pessoasPorId = useMemo(() => new Map(pessoas.map((p) => [p.id, p])), [pessoas]);
  const varias = pessoas.length > 1;
  // Acompanhando outra pessoa, o card da categoria diz de quem é.
  const comNome = !minha;

  return (
    <div className="space-y-6">
      {tl.stats.total > 0 && (
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            [t('Jogos'), tl.stats.total],
            [t('Por jogar'), tl.stats.upcoming],
            [t('Vitórias'), tl.stats.won],
            [t('Derrotas'), tl.stats.lost],
          ].map(([rotulo, valor]) => (
            <div key={rotulo} className="rounded-2xl border border-gray-100 bg-paper-pure p-3 text-center">
              <dt className="text-2xs font-bold uppercase tracking-widest text-gray-500">{rotulo}</dt>
              <dd className="font-display text-2xl font-bold tabular-nums text-ink">{valor}</dd>
            </div>
          ))}
        </dl>
      )}

      <section aria-labelledby="tl-inscricoes" className="space-y-3">
        <h2 id="tl-inscricoes" className="flex items-center gap-2 font-display text-lg font-bold text-ink">
          <Users className="h-5 w-5" aria-hidden /> {minha ? t('Suas categorias') : t('Inscrições')}
        </h2>
        <ul className="grid gap-3 md:grid-cols-2">
          {tl.entries.map((e) => (
            <InscricaoCard key={e.key} entry={e} tournament={tournament} data={data} pessoa={pessoasPorId.get(e.personId)} mostrarPessoa={comNome} />
          ))}
        </ul>
      </section>

      {tl.projections.length > 0 && (
        <section aria-labelledby="tl-proximos" className="space-y-3">
          <h2 id="tl-proximos" className="flex items-center gap-2 font-display text-lg font-bold text-ink">
            <GitBranch className="h-5 w-5" aria-hidden /> {t('O que vem pela frente')}
          </h2>
          <ul className="space-y-2">
            {tl.projections.map((p) => (
              <li key={p.key} className="flex items-start gap-3 rounded-2xl border border-dashed border-gray-300 bg-paper p-3 text-sm">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-acid" aria-hidden>
                  {p.kind === 'champion' ? <Trophy className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-2xs font-bold uppercase tracking-widest text-gray-500">
                    {p.modalityName} · {p.roundLabel}{varias ? ` · ${p.label}` : ''}
                  </span>
                  <span className="block text-ink">{p.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="tl-jogos" className="space-y-4">
        <h2 id="tl-jogos" className="flex items-center gap-2 font-display text-lg font-bold text-ink">
          <CalendarClock className="h-5 w-5" aria-hidden /> {t('Jogos, por dia e horário')}
        </h2>
        {tl.items.length === 0 ? (
          <p className="rounded-2xl border border-gray-100 bg-paper p-4 text-sm text-gray-600">
            {t('Os jogos aparecem aqui assim que o sorteio sair, com dia, horário e quadra quando a organização marcar.')}
          </p>
        ) : tl.days.map((dia) => (
          <div key={dia.key} className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
              <Clock className="h-4 w-4 text-gray-500" aria-hidden /> {tituloDoDia(dia)}
            </h3>
            {dia.at == null && (
              <p className="text-xs text-gray-500">{t('A organização ainda não marcou o horário destes jogos. Eles estão na ordem da chave.')}</p>
            )}
            <ul className="space-y-2">
              {dia.items.map((i) => <JogoItem key={i.id} item={i} pessoasPorId={pessoasPorId} mostrarPessoas={varias} />)}
            </ul>
          </div>
        ))}
        <p className="flex items-center gap-1.5 text-xs text-gray-500">
          <Radio className="h-3.5 w-3.5" aria-hidden /> {t('Atualiza sozinho enquanto a página está aberta.')}
        </p>
      </section>
    </div>
  );
}

function Carregando() {
  return (
    <div className="space-y-3">
      <V2Skeleton className="h-24 rounded-2xl" />
      <V2Skeleton className="h-20 rounded-2xl" />
      <V2Skeleton className="h-20 rounded-2xl" />
    </div>
  );
}

function Falhou({ onRetry }) {
  return (
    <V2Surface>
      <V2ErrorState
        title={t('Não foi possível carregar os jogos')}
        description={t('Eles continuam lá — a conexão é que falhou.')}
        onRetry={onRetry}
      />
    </V2Surface>
  );
}

/* ------------------------------------------------------------------ */
/* As abas                                                             */
/* ------------------------------------------------------------------ */

export function V2MyParticipation({ tournament, onGoOverview }) {
  const data = useMeInTournament(tournament.id);
  if (data.isLoading) return <Carregando />;
  if (data.isError) return <Falhou onRetry={data.refetch} />;
  if (!data.eu) {
    return (
      <V2Surface>
        <V2EmptyState
          icon={Users}
          title={t('Você não está inscrito neste torneio')}
          description={t('Quando você se inscrever, os seus jogos de todas as categorias aparecem aqui, em ordem de horário.')}
          action={onGoOverview ? <V2Button type="button" onClick={onGoOverview}>{t('Ver as categorias e se inscrever')}</V2Button> : null}
        />
      </V2Surface>
    );
  }
  return <LinhaDoTempo tournament={tournament} data={data} pessoas={[data.eu]} minha />;
}

const prefAcompanhar = (tournamentId) => `torneio:${tournamentId}:acompanhar`;

export function V2FollowPlayers({ tournament }) {
  const { user } = useAuth();
  const data = useTournamentTimelineData(tournament.id);
  const [params, setParams] = useSearchParams();
  const daUrl = params.get('pessoas');

  // Sem `?pessoas=` na URL, volta a última escolha desta conta neste torneio.
  useEffect(() => {
    if (daUrl !== null) return;
    const salvo = readViewPreference(user?.uid, prefAcompanhar(tournament.id));
    if (salvo) setParams((p) => { const n = new URLSearchParams(p); n.set('pessoas', salvo); return n; }, { replace: true });
  }, [daUrl, setParams, tournament.id, user?.uid]);

  const ids = useMemo(() => (daUrl ? daUrl.split(',').filter(Boolean) : []), [daUrl]);
  const porId = useMemo(() => new Map(data.people.map((p) => [p.id, p])), [data.people]);
  const escolhidos = useMemo(() => ids.map((id) => porId.get(id)).filter(Boolean), [ids, porId]);
  const sumiram = data.peopleReady ? ids.length - escolhidos.length : 0;

  const mudar = (lista) => {
    const valor = lista.slice(0, MAX_ACOMPANHADOS).map((p) => p.id).join(',');
    writeViewPreference(user?.uid, prefAcompanhar(tournament.id), valor || null);
    setParams((p) => {
      const n = new URLSearchParams(p);
      if (valor) n.set('pessoas', valor); else n.delete('pessoas');
      return n;
    }, { replace: true });
  };

  if (data.isLoading) return <Carregando />;
  if (data.isError) return <Falhou onRetry={data.refetch} />;

  const seletor = (
    <PersonPicker
      id="acompanhar-inscritos"
      multiple
      max={MAX_ACOMPANHADOS}
      pessoas={data.people}
      selecionados={escolhidos}
      onChange={mudar}
      ocultar={user?.uid ? [user.uid] : []}
      detalhe={(p) => p.modalityNames.join(' · ')}
      rotulo={t('Inscritos neste torneio')}
      placeholder={t('Buscar pelo nome entre os inscritos')}
      vazio={t('Ninguém com esse nome entre os inscritos deste torneio.')}
    />
  );

  return (
    <div className="space-y-6">
      {/* Remonta ao passar de "ninguém" para "alguém": com gente escolhida, o
          seletor nasce recolhido e a linha do tempo fica à vista. */}
      <V2Collapsible
        key={escolhidos.length ? 'com' : 'sem'}
        defaultOpen={escolhidos.length === 0}
        persistId={escolhidos.length ? `torneio:${tournament.id}:acompanhar-seletor` : undefined}
        title={<span className="inline-flex items-center gap-2"><Users className="h-4 w-4 text-ink" /> {t('Quem você quer acompanhar')}</span>}
        subtitle={escolhidos.length
          ? escolhidos.map((p) => p.name).join(', ')
          : t('Escolha um ou mais inscritos (até {max}). Só aparecem pessoas inscritas neste torneio.', { max: MAX_ACOMPANHADOS })}
      >
        <div className="px-5 pb-5">{seletor}</div>
      </V2Collapsible>
      {sumiram > 0 && (
        <p role="status" className="text-xs text-amber-700">{tn(sumiram, '{n} pessoa do link não está mais inscrita neste torneio.', '{n} pessoas do link não estão mais inscritas neste torneio.')}</p>
      )}

      {escolhidos.length === 0 ? (
        <p className="rounded-2xl border border-gray-100 bg-paper p-4 text-sm text-gray-600">
          {t('Os jogos de quem você escolher aparecem aqui juntos, em ordem de horário — bom para acompanhar a sua dupla, os seus alunos ou a família.')}
        </p>
      ) : (
        <LinhaDoTempo tournament={tournament} data={data} pessoas={escolhidos} />
      )}
    </div>
  );
}

/**
 * A faixa "Seu próximo jogo", no topo da página do torneio, para quem está
 * inscrito. Some quando não há jogo por vir (o torneio acabou ou não sorteou).
 */
export function MyNextMatchStrip({ tournament, onOpen }) {
  const data = useMeInTournament(tournament.id);
  const tl = useMemo(() => (data.eu ? buildPersonalTimeline({
    people: [data.eu], registrations: data.registrations, matches: data.matches, modalities: data.modalities, tournament,
  }) : null), [data.eu, data.registrations, data.matches, data.modalities, tournament]);
  if (data.isError || !tl?.next) return null;
  const n = tl.next;
  const adversario = n.perspective === 'a' ? n.sideB.label : n.sideA.label;
  return (
    <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-acid/40 bg-acid/10 p-4" role="status">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-acid" aria-hidden>
        {n.live ? <Radio className="h-5 w-5" /> : <CalendarClock className="h-5 w-5" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-2xs font-bold uppercase tracking-widest text-gray-600">{n.live ? t('Seu jogo está em quadra') : t('Seu próximo jogo')}</p>
        <p className="text-sm font-semibold text-ink">
          {[
            n.at != null ? tituloDoDia({ at: n.at }).split(' · ')[0] + ` ${hora(n.at)}` : t('Horário a definir'),
            n.modalityName,
            n.roundLabel,
          ].join(' · ')}
        </p>
        <p className="truncate text-sm text-gray-600">
          {n.court && <><MapPin className="mr-1 inline h-3.5 w-3.5" aria-hidden />{n.court} · </>}
          {t('contra {quem}', { quem: adversario || t('A definir') })}
        </p>
      </div>
      <V2Button type="button" size="sm" variant="secondary" onClick={onOpen}>{t('Minha participação')}</V2Button>
    </div>
  );
}
