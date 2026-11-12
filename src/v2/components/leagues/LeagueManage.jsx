/**
 * GERIR a liga (só quem organiza): situação, dados, temporada, divisões,
 * inscrições, rodadas e a equipe. Cada salvar é uma ação da função `leagues`,
 * que confere de novo quem pode. A seção aberta mora na URL (`?secao=`).
 */
import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertTriangle, CalendarDays, Flag, Layers, ListChecks, Plus, Settings, Shuffle, Trash2, UserPlus, Users } from 'lucide-react';
import { t, tk } from '@/core/i18n';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { BR_UFS } from '@/core/domain/ufs';
import {
  V2Badge, V2Button, V2Field, V2Input, V2SectionHeader, V2Select, V2Skeleton, V2Surface, V2Textarea, V2Toggle, V2ErrorState,
} from '@/v2/ui/primitives';
import { V2SubTabs } from '@/v2/ui/V2SectionNav';
import PersonPicker from '@/v2/components/people/PersonPicker';
import { useAllAthletes } from '@/modules/athletes/hooks/useAthletes';
import { useLeagueAction } from '@/modules/leagues/hooks/useLeagues';
import { LEAGUE_STATUS_NEXT, formatMeta } from '@/modules/leagues/domain/leagueFormats';
import { normalizeSeason, roundsFor } from '@/modules/leagues/domain/leagueSeason';
import { ELIGIBILITY_REASON_LABELS, divisionEligibility } from '@/modules/leagues/domain/leagueDivisions';
import DivisionFields, { emptyDivision } from './DivisionFields';
import SeasonFields from './SeasonFields';
import PointsFields from './PointsFields';
import LeagueSessionPanel from './LeagueSessionPanel';
import { isLadderFormat } from '@/modules/leagues/domain/leagueLadder';
import { LeagueStatusBadge, divisionSummary, entryNoun, personUid } from './leagueUi';

const SECOES = [
  { value: 'situacao', label: tk('Situação'), icon: Flag },
  { value: 'dados', label: tk('Dados'), icon: Settings },
  { value: 'temporada', label: tk('Temporada'), icon: CalendarDays },
  { value: 'divisoes', label: tk('Divisões'), icon: Layers },
  { value: 'inscricoes', label: tk('Inscrições'), icon: ListChecks },
  { value: 'rodadas', label: tk('Rodadas'), icon: Shuffle },
  { value: 'equipe', label: tk('Organização'), icon: Users },
];

// O botão de cada mudança de situação (a ordem segue LEAGUE_STATUS_NEXT).
const ACAO_DE_STATUS = {
  'draft>open': { label: tk('Abrir as inscrições'), hint: tk('A liga aparece para os atletas e eles podem se inscrever.') },
  'open>draft': { label: tk('Voltar a rascunho'), hint: tk('Só sem inscritos. A liga some da lista.') },
  'open>running': { label: tk('Começar a temporada'), hint: tk('Fecha as inscrições. Gere as rodadas de cada divisão.') },
  'running>open': { label: tk('Reabrir as inscrições'), hint: tk('Para entrar mais gente antes de gerar as rodadas.') },
  'running>finished': { label: tk('Encerrar a temporada'), hint: tk('A classificação fica como está e os placares travam.') },
  'finished>running': { label: tk('Reabrir a temporada'), hint: tk('Para corrigir um placar.') },
  'draft>cancelled': { label: tk('Cancelar a liga'), hint: tk('Não tem volta.'), danger: true },
  'open>cancelled': { label: tk('Cancelar a liga'), hint: tk('Não tem volta. Os inscritos continuam vendo a liga.'), danger: true },
  'running>cancelled': { label: tk('Cancelar a liga'), hint: tk('Não tem volta. Os placares ficam guardados.'), danger: true },
};

export default function LeagueManage(props) {
  const [params, setParams] = useSearchParams();
  const secao = SECOES.some((s) => s.value === params.get('secao')) ? params.get('secao') : 'situacao';
  return (
    <div className="space-y-5">
      <V2SubTabs
        tabs={SECOES.map((s) => ({ ...s, label: s.value === 'rodadas' && isLadderFormat(props.league.format) ? t('Sessões') : t(s.label) }))}
        activeValue={secao}
        onSelect={(s) => setParams((p) => { p.set('secao', s.value); return p; }, { replace: true })}
        ariaLabel={t('Seções da gestão da liga')}
        dica="liga-gerir-secoes"
      />
      {secao === 'situacao' && <Situacao {...props} />}
      {secao === 'dados' && <Dados {...props} />}
      {secao === 'temporada' && <Temporada {...props} />}
      {secao === 'divisoes' && <Divisoes {...props} />}
      {secao === 'inscricoes' && <Inscricoes {...props} />}
      {secao === 'rodadas' && (isLadderFormat(props.league.format) ? <Sessoes {...props} /> : <Rodadas {...props} />)}
      {secao === 'equipe' && <Equipe {...props} />}
    </div>
  );
}

function useSalvar() {
  const acao = useLeagueAction();
  const salvar = async (payload, ok) => {
    try {
      const r = await acao.mutateAsync(payload);
      if (ok) toast.success(ok);
      return r;
    } catch (err) {
      toast.error(err.message);
      return null;
    }
  };
  return { salvar, pending: acao.isPending };
}

function Situacao({ league }) {
  const { salvar, pending } = useSalvar();
  const [confirmar, setConfirmar] = useState(null);
  const proximas = LEAGUE_STATUS_NEXT[league.status] || [];
  return (
    <V2Surface className="space-y-4">
      <V2SectionHeader eyebrow={t('Situação')} title={<span className="flex items-center gap-2">{t('Agora')} <LeagueStatusBadge status={league.status} /></span>} />
      {!proximas.length && <p className="text-sm text-gray-500">{t('A liga foi cancelada. Os dados ficam guardados.')}</p>}
      <ul className="space-y-3">
        {proximas.map((to) => {
          const a = ACAO_DE_STATUS[`${league.status}>${to}`];
          if (!a) return null;
          if (to === 'draft' && league.entries_count > 0) return null;
          return (
            <li key={to} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-100 p-4">
              <div className="min-w-0">
                <p className="font-semibold text-ink">{t(a.label)}</p>
                <p className="text-sm text-gray-500">{t(a.hint)}</p>
              </div>
              {a.danger && confirmar !== to ? (
                <V2Button type="button" size="sm" variant="danger" onClick={() => setConfirmar(to)}>{t(a.label)}</V2Button>
              ) : (
                <V2Button type="button" size="sm" variant={a.danger ? 'danger' : 'primary'} disabled={pending}
                  onClick={() => salvar({ action: 'status', leagueId: league.id, to }, t('Situação atualizada.')).then(() => setConfirmar(null))}>
                  {a.danger ? t('Confirmar') : t(a.label)}
                </V2Button>
              )}
            </li>
          );
        })}
      </ul>
    </V2Surface>
  );
}

function Dados({ league }) {
  const { salvar, pending } = useSalvar();
  const [f, setF] = useState({
    name: league.name || '', description: league.description || '', city: league.city || '', state: league.state || '',
    location: league.location || '', visibility: league.visibility || 'public', self_registration: league.self_registration !== false,
  });
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  return (
    <V2Surface className="space-y-4">
      <V2Field label={t('Nome da liga')} htmlFor="g-nome" required><V2Input id="g-nome" value={f.name} maxLength={100} onChange={(e) => set({ name: e.target.value })} /></V2Field>
      <V2Field label={t('Descrição')} htmlFor="g-desc"><V2Textarea id="g-desc" value={f.description} maxLength={2000} onChange={(e) => set({ description: e.target.value })} /></V2Field>
      <div className="grid gap-4 sm:grid-cols-[1fr,140px]">
        <V2Field label={t('Cidade')} htmlFor="g-cidade"><V2Input id="g-cidade" value={f.city} maxLength={80} onChange={(e) => set({ city: e.target.value })} /></V2Field>
        <V2Field label={t('UF')} htmlFor="g-uf"><V2Select id="g-uf" value={f.state} onChange={(e) => set({ state: e.target.value })} options={[{ value: '', label: '—' }, ...BR_UFS.map((u) => ({ value: u, label: u }))]} /></V2Field>
      </div>
      <V2Field label={t('Local dos jogos')} htmlFor="g-local"><V2Input id="g-local" value={f.location} maxLength={160} onChange={(e) => set({ location: e.target.value })} /></V2Field>
      <div className="space-y-4 rounded-2xl bg-paper p-4">
        <V2Toggle id="g-lista" checked={f.visibility === 'public'} onChange={(v) => set({ visibility: v ? 'public' : 'unlisted' })} label={t('Aparecer na lista de ligas')} hint={t('Desligado, só quem tem o link encontra a liga.')} />
        <V2Toggle id="g-auto" checked={f.self_registration} onChange={(v) => set({ self_registration: v })} label={t('Os atletas se inscrevem sozinhos')} hint={t('Desligado, só a organização inscreve.')} />
      </div>
      <V2Button type="button" disabled={pending} onClick={() => salvar({ action: 'update', leagueId: league.id, patch: f }, t('Dados salvos.'))}>{t('Salvar')}</V2Button>
    </V2Surface>
  );
}

function Temporada({ league }) {
  const { salvar, pending } = useSalvar();
  const [season, setSeason] = useState(() => normalizeSeason(league.season));
  const [standings, setStandings] = useState(() => ({ mode: 'points', win: 3, loss: 1, wo_loss: 0, ...(league.standings || {}) }));
  return (
    <V2Surface className="space-y-6">
      <SeasonFields value={season} onChange={setSeason} idPrefix="g-temporada" ladder={isLadderFormat(league.format)} />
      <PointsFields value={standings} onChange={setStandings} idPrefix="g-pontos" ladder={isLadderFormat(league.format)} />
      <p className="text-xs leading-5 text-gray-500">{t('Mudar a pontuação recalcula a tabela na hora. Mudar o calendário muda as datas das rodadas, não os jogos.')}</p>
      <V2Button type="button" disabled={pending} onClick={() => salvar({ action: 'update', leagueId: league.id, patch: { season, standings } }, t('Temporada salva.'))}>{t('Salvar')}</V2Button>
    </V2Surface>
  );
}

function Divisoes({ league, divisions, entries }) {
  const { salvar, pending } = useSalvar();
  const [editando, setEditando] = useState(null); // id, 'nova' ou null
  const [rascunho, setRascunho] = useState(null);
  const duplas = formatMeta(league.format)?.players === 2;
  if (divisions.isError || entries.isError) return <V2Surface><V2ErrorState inline title={t('Não carregaram as divisões')} onRetry={() => { divisions.refetch(); entries.refetch(); }} /></V2Surface>;
  if (!divisions.isSuccess || !entries.isSuccess) return <V2Skeleton className="h-40" />;
  const divs = divisions.data || [];
  const conta = (id) => (entries.data || []).filter((e) => e.division_id === id).length;
  const abrir = (d) => { setEditando(d ? d.id : 'nova'); setRascunho(d ? { ...d, rule: { ...(d.rule || {}) } } : emptyDivision(divs.length + 1)); };

  async function gravar() {
    const r = await salvar({ action: 'division_save', leagueId: league.id, divisionId: editando === 'nova' ? undefined : editando, division: rascunho }, t('Divisão salva.'));
    if (r) setEditando(null);
  }

  return (
    <div className="space-y-4">
      {divs.map((d) => (
        <V2Surface key={d.id} className="space-y-3">
          {editando === d.id ? (
            <>
              <DivisionFields idPrefix={`g-div-${d.id}`} value={rascunho} onChange={setRascunho} pairs={duplas} />
              {conta(d.id) > 0 && <p className="text-xs text-amber-700">{t('Mudar a regra não tira quem já está inscrito.')}</p>}
              <div className="flex gap-2">
                <V2Button type="button" size="sm" disabled={pending} onClick={gravar}>{t('Salvar')}</V2Button>
                <V2Button type="button" size="sm" variant="ghost" onClick={() => setEditando(null)}>{t('Cancelar')}</V2Button>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-ink">{d.name}</p>
                <p className="text-sm text-gray-500">{divisionSummary(d)} · {conta(d.id)} {entryNoun(league.format, true)}</p>
              </div>
              <div className="flex gap-2">
                <V2Button type="button" size="sm" variant="ghost" onClick={() => abrir(d)}>{t('Editar')}</V2Button>
                {conta(d.id) === 0 && (
                  <V2Button type="button" size="sm" variant="danger" disabled={pending} aria-label={t('Tirar a divisão {nome}', { nome: d.name })}
                    onClick={() => salvar({ action: 'division_remove', leagueId: league.id, divisionId: d.id }, t('Divisão removida.'))}>
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </V2Button>
                )}
              </div>
            </div>
          )}
        </V2Surface>
      ))}
      {editando === 'nova' ? (
        <V2Surface className="space-y-3">
          <DivisionFields idPrefix="g-div-nova" value={rascunho} onChange={setRascunho} pairs={duplas} />
          <div className="flex gap-2">
            <V2Button type="button" size="sm" disabled={pending} onClick={gravar}>{t('Criar divisão')}</V2Button>
            <V2Button type="button" size="sm" variant="ghost" onClick={() => setEditando(null)}>{t('Cancelar')}</V2Button>
          </div>
        </V2Surface>
      ) : divs.length < 12 && !['finished', 'cancelled'].includes(league.status) && (
        <V2Button type="button" variant="ghost" onClick={() => abrir(null)}><Plus className="h-4 w-4" aria-hidden="true" /> {t('Nova divisão')}</V2Button>
      )}
    </div>
  );
}

function Inscricoes({ league, divisions, entries }) {
  const { salvar, pending } = useSalvar();
  const n = formatMeta(league.format)?.players || 1;
  const [divisionId, setDivisionId] = useState('');
  const [comConta, setComConta] = useState([]);
  const [semConta, setSemConta] = useState('');
  const [tirar, setTirar] = useState(null);
  if (divisions.isError || entries.isError) return <V2Surface><V2ErrorState inline title={t('Não carregaram as inscrições')} onRetry={() => { divisions.refetch(); entries.refetch(); }} /></V2Surface>;
  if (!divisions.isSuccess || !entries.isSuccess) return <V2Skeleton className="h-40" />;
  const divs = divisions.data || [];
  const div = divs.find((d) => d.id === divisionId) || divs[0];
  const ativos = (entries.data || []).filter((e) => e.status === 'active');
  const nomesSemConta = semConta.split(/[\n,;]/).map((s) => s.trim()).filter(Boolean);
  const players = [...comConta.map((p) => ({ uid: personUid(p) })), ...nomesSemConta.map((name) => ({ name }))].slice(0, n);
  const fechada = ['finished', 'cancelled'].includes(league.status);
  // Como no torneio: a organização vê o que não cabe na divisão como AVISO e
  // pode inscrever assim mesmo — a inscrição fica marcada como exceção.
  const previa = div && players.length === n ? divisionEligibility(div, [
    ...comConta.map((p) => ({ dupr: Number(p?.dupr_rating) || null, gender: p?.competition_gender || p?.gender || null })),
    ...nomesSemConta.map(() => ({ dupr: null, gender: null })),
  ].slice(0, n)) : null;
  const temSemConta = nomesSemConta.length > 0 && players.length === n;

  async function inscrever() {
    const r = await salvar({ action: 'entry_add', leagueId: league.id, divisionId: div.id, players }, t('Inscrição feita.'));
    if (r) { setComConta([]); setSemConta(''); }
  }

  return (
    <div className="space-y-6">
      {!fechada && div && (
        <V2Surface className="space-y-4">
          <V2SectionHeader eyebrow={t('Inscrever pela organização')} title={n === 2 ? t('Uma dupla') : t('Um atleta')} description={t('Escolha quem tem conta ou escreva o nome de quem ainda não tem.')} />
          <V2Field label={t('Divisão')} htmlFor="g-insc-div">
            <V2Select id="g-insc-div" value={div.id} onChange={(e) => setDivisionId(e.target.value)} options={divs.map((d) => ({ value: d.id, label: `${d.name} · ${divisionSummary(d)}` }))} />
          </V2Field>
          <PersonPicker id="g-insc-pessoas" multiple max={n} rotulo={t('Atletas com conta')} selecionados={comConta} onChange={setComConta} diretorio="todos" />
          {comConta.length < n && (
            <V2Field label={t('Sem conta (um nome por linha)')} htmlFor="g-insc-sem">
              <V2Textarea id="g-insc-sem" rows={2} value={semConta} onChange={(e) => setSemConta(e.target.value)} />
            </V2Field>
          )}
          {previa && !previa.ok && (
            <div role="status" className="flex gap-3 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <p>
                <strong>{t(ELIGIBILITY_REASON_LABELS[previa.reason] || 'Esta inscrição não cabe na divisão.')}</strong>{' '}
                {t('Como organizador você pode prosseguir mesmo assim — a inscrição fica marcada como exceção. Confira os dados.')}
              </p>
            </div>
          )}
          {temSemConta && <p className="text-xs leading-5 text-gray-500">{t('Quem não tem conta entra sem DUPR e sem categoria: confira o nível e a categoria de cada um.')}</p>}
          <V2Button type="button" disabled={pending || players.length !== n} onClick={inscrever}>
            <UserPlus className="h-4 w-4" aria-hidden="true" /> {t('Inscrever')}
          </V2Button>
          {players.length !== n && <p className="text-xs text-gray-500">{t('Faltam {n} atleta(s).', { n: n - players.length })}</p>}
        </V2Surface>
      )}

      <V2Surface className="space-y-3">
        <V2SectionHeader eyebrow={t('Inscritos')} title={t('{n} ativos', { n: ativos.length })} />
        {!ativos.length ? <p className="text-sm text-gray-500">{t('Ninguém inscrito ainda.')}</p> : (
          <ul className="divide-y divide-gray-100">
            {ativos.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{e.name} {e.eligibility?.override && <V2Badge tone="amber" className="ml-1">{t('Por exceção')}</V2Badge>}</p>
                  <p className="text-sm text-gray-500">{divs.find((d) => d.id === e.division_id)?.name} · {(e.players || []).map((p) => p.name).join(' · ')}</p>
                </div>
                {!fechada && (tirar === e.id ? (
                  <div className="flex gap-2">
                    <V2Button type="button" size="sm" variant="ghost" onClick={() => setTirar(null)}>{t('Manter')}</V2Button>
                    <V2Button type="button" size="sm" variant="danger" disabled={pending} onClick={() => salvar({ action: 'withdraw', leagueId: league.id, entryId: e.id }, t('Inscrição retirada.')).then(() => setTirar(null))}>{t('Confirmar')}</V2Button>
                  </div>
                ) : (
                  <V2Button type="button" size="sm" variant="ghost" onClick={() => setTirar(e.id)}>{t('Retirar')}</V2Button>
                ))}
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-gray-500">{t('Quem já tem jogo marcado fica como desistência: os placares lançados continuam valendo para os adversários.')}</p>
      </V2Surface>
    </div>
  );
}

function Sessoes(props) {
  const { salvar, pending } = useSalvar();
  return <LeagueSessionPanel {...props} salvar={salvar} pending={pending} />;
}

function Rodadas({ league, divisions, entries, matches }) {
  const { salvar, pending } = useSalvar();
  const [confirmar, setConfirmar] = useState(null);
  const falhou = [divisions, entries, matches].find((q) => q.isError);
  if (falhou) return <V2Surface><V2ErrorState inline title={t('Não carregaram as rodadas')} onRetry={() => [divisions, entries, matches].forEach((q) => q.isError && q.refetch())} /></V2Surface>;
  if (![divisions, entries, matches].every((q) => q.isSuccess)) return <V2Skeleton className="h-40" />;
  const legs = normalizeSeason(league.season).legs;
  const bloqueada = ['draft', 'finished', 'cancelled'].includes(league.status);

  return (
    <div className="space-y-4">
      {bloqueada && <p className="rounded-2xl bg-paper p-4 text-sm text-gray-500">{league.status === 'draft' ? t('Abra as inscrições antes de gerar as rodadas.') : t('A liga está encerrada.')}</p>}
      {(divisions.data || []).map((d) => {
        const n = (entries.data || []).filter((e) => e.division_id === d.id && e.status === 'active').length;
        const ms = (matches.data || []).filter((m) => m.division_id === d.id);
        const comPlacar = ms.some((m) => m.status === 'done');
        const chave = `div:${d.id}`;
        const gerar = () => salvar({ action: 'schedule', leagueId: league.id, divisionId: d.id, start: league.status === 'open' }, t('Rodadas geradas.')).then(() => setConfirmar(null));
        return (
          <V2Surface key={d.id} className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-ink">{d.name}</p>
              <p className="text-sm text-gray-500">
                {n} {entryNoun(league.format, true)} · {ms.length ? t('{j} jogos em {r} rodadas', { j: ms.length, r: Math.max(...ms.map((m) => m.round || 0)) }) : t('{r} rodadas previstas', { r: roundsFor(n, legs) })}
              </p>
              {comPlacar && <p className="text-xs text-gray-500">{t('Já tem placar lançado: as rodadas não são geradas de novo.')}</p>}
            </div>
            {!bloqueada && !comPlacar && n >= 2 && (ms.length && confirmar !== chave ? (
              <V2Button type="button" size="sm" variant="ghost" onClick={() => setConfirmar(chave)}>{t('Gerar de novo')}</V2Button>
            ) : (
              <V2Button type="button" size="sm" disabled={pending} onClick={gerar}>
                <Shuffle className="h-4 w-4" aria-hidden="true" /> {ms.length ? t('Confirmar: refazer os jogos') : t('Gerar rodadas')}
              </V2Button>
            ))}
            {!bloqueada && n < 2 && <p className="text-xs text-gray-500">{t('Precisa de pelo menos 2 inscritos.')}</p>}
          </V2Surface>
        );
      })}
      {league.status === 'open' && <p className="text-xs text-gray-500">{t('Gerar as rodadas com as inscrições abertas começa a temporada (as inscrições fecham).')}</p>}
    </div>
  );
}

function Equipe({ league }) {
  const { user } = useAuth();
  const { salvar, pending } = useSalvar();
  const pessoas = useAllAthletes();
  const porUid = new Map((pessoas.data || []).map((p) => [personUid(p), p]));
  const admins = league.admins || [];
  const nome = (uid) => porUid.get(uid)?.platform_name || porUid.get(uid)?.full_name || (pessoas.isLoading ? '…' : t('Atleta'));
  return (
    <V2Surface className="space-y-4">
      <V2SectionHeader eyebrow={t('Organização')} title={t('Quem gere a liga')} description={t('Até 10 pessoas. Elas inscrevem, geram rodadas e lançam placares.')} />
      <ul className="divide-y divide-gray-100">
        {admins.map((uid) => (
          <li key={uid} className="flex items-center justify-between gap-2 py-3">
            <span className="font-semibold text-ink">{nome(uid)}{uid === league.creator_uid ? ` · ${t('criou a liga')}` : ''}{uid === user?.uid ? ` (${t('você')})` : ''}</span>
            {uid !== league.creator_uid && (
              <V2Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => salvar({ action: 'staff', leagueId: league.id, remove: uid }, t('Pessoa removida da organização.'))}>{t('Tirar')}</V2Button>
            )}
          </li>
        ))}
      </ul>
      {admins.length < 10 && (
        <PersonPicker
          id="g-equipe"
          rotulo={t('Acrescentar à organização')}
          rotuloAcao={t('Acrescentar')}
          onEscolher={(p) => salvar({ action: 'staff', leagueId: league.id, add: personUid(p) }, t('Pessoa acrescentada à organização.'))}
          ocultar={admins}
          diretorio="todos"
        />
      )}
    </V2Surface>
  );
}
