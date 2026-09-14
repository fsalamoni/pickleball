/**
 * V2ArenaLeagues — a competição da casa.
 *
 * Rotas: `/arenas/:arenaId/torneios` (atleta) ·
 *        `/arenas/:arenaId/gerir/torneios` (arena)
 * Módulos: `leagues` (+ `leagues_internal`, `leagues_ladder`,
 * `leagues_open_play`, `leagues_prizing`).
 *
 * ## O que a versão anterior não fazia
 *
 * **O torneio não gerava partida nenhuma.** Guardava `format:
 * 'single_elimination'` e nada no projeto sorteava nada: o atleta se inscrevia
 * e acabava ali. Um torneio que não vira jogo é uma lista de nomes.
 *
 * **O ladder era lido e nunca escrito** — a classificação da arena estava
 * vazia desde sempre, para todo mundo.
 *
 * **O torneio não ocupava a quadra**, e **não dava para sair** dele.
 *
 * ## A decisão que evitou reescrever a plataforma
 *
 * A arena já tem uma máquina completa de dia de jogo: sorteio equilibrado pela
 * régua 2.0–8.0, Play, Americano, Americano aprimorado, placar, ranking do
 * dia, telão e tutoriais. Um torneio interno é exatamente isso, com inscrição
 * antecipada e prêmio.
 *
 * Então **Começar o torneio** cria um dia de jogo da arena com os inscritos, e
 * a partir dali o botão leva para lá. O ambiente do atleta não precisou de
 * nada novo.
 */

import React, { useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  AlertTriangle, ArrowLeft, Calendar, Crown, Gift, MapPin, Medal, Pencil,
  Play, Plus, Trash2, Trophy, Users, X,
} from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useArena, useMyManagedArenas, useArenaCourts } from '@/modules/arenas/hooks/useArenas';
import {
  useArenaTournaments, useCreateTournament, useUpdateTournament,
  useCancelTournament, useDeleteTournament, useJoinTournament,
  useLeaveTournament, useStartTournament, useArenaLadder,
} from '@/modules/arenas/hooks/useArenaV3';
import { useArenaModules } from '@/modules/arenas/hooks/useArenaModules';
import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';
import {
  INTERNAL_TOURNAMENT_FORMAT, INTERNAL_TOURNAMENT_FORMAT_META,
  INTERNAL_TOURNAMENT_STATUS, INTERNAL_TOURNAMENT_STATUS_META,
  isTournamentOpen, tournamentSeatsLeft,
} from '@/modules/arenas/domain/leagues';
import { formatPrice } from '@/modules/arenas/domain/pricing';
import { formatDateShortBR } from '@/modules/arenas/domain/calendar';
import { todayISO } from '@/modules/arenas/domain/subscription';
import ConfirmDialog from '@/components/ConfirmDialog';
import {
  V2Avatar, V2Badge, V2Button, V2EmptyState, V2Field, V2Input, V2Skeleton,
  V2Surface, V2Textarea,
} from '@/v2/ui/primitives';

/* ======================================================= FORMULÁRIO ===== */

function TorneioForm({ arenaId, torneio, courts, onClose }) {
  const [form, setForm] = useState(() => ({
    name: torneio?.name || '',
    description: torneio?.description || '',
    date: torneio?.date || todayISO(),
    max_participants: torneio?.max_participants ?? 16,
    entry_fee: torneio?.entry_fee ?? 0,
    format: torneio?.format || INTERNAL_TOURNAMENT_FORMAT.AMERICANO,
    court_ids: torneio?.court_ids || [],
    start_time: torneio?.start_time || '14:00',
    end_time: torneio?.end_time || '18:00',
  }));
  const criar = useCreateTournament();
  const editar = useUpdateTournament();
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const alternarQuadra = (id) => set({
    court_ids: form.court_ids.includes(id)
      ? form.court_ids.filter((c) => c !== id)
      : [...form.court_ids, id],
  });

  const submit = async (e) => {
    e.preventDefault();
    const input = {
      ...form,
      max_participants: Number(form.max_participants),
      entry_fee: Number(form.entry_fee),
    };
    try {
      if (torneio) await editar.mutateAsync({ arenaId, tid: torneio.id, input });
      else await criar.mutateAsync({ arenaId, input });
      toast.success(torneio ? 'Torneio atualizado.' : 'Torneio publicado.');
      onClose();
    } catch (err) {
      toast.error(err?.message || 'Não foi possível salvar o torneio.');
    }
  };

  return (
    <form onSubmit={submit} className="mb-4 rounded-2xl border border-gray-100 bg-paper p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-base font-bold text-ink">
          {torneio ? 'Editar torneio' : 'Novo torneio da casa'}
        </h3>
        <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-ink">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <V2Field label="Nome" htmlFor="tn-nome">
          <V2Input id="tn-nome" required maxLength={80} placeholder="Ex.: Americano de sábado"
            value={form.name} onChange={(e) => set({ name: e.target.value })} />
        </V2Field>
        <V2Field label="Data" htmlFor="tn-data">
          <V2Input id="tn-data" type="date" required value={form.date}
            onChange={(e) => set({ date: e.target.value })} />
        </V2Field>
      </div>

      <V2Field
        label="Formato" htmlFor="tn-formato" className="mt-3"
        hint={INTERNAL_TOURNAMENT_FORMAT_META[form.format]?.hint}
      >
        <select id="tn-formato" value={form.format} onChange={(e) => set({ format: e.target.value })}
          className="h-11 w-full rounded-2xl border border-gray-200 bg-paper-pure px-4 text-sm">
          {Object.entries(INTERNAL_TOURNAMENT_FORMAT_META).map(([k, m]) => (
            <option key={k} value={k}>{m.label}</option>
          ))}
        </select>
      </V2Field>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <V2Field label="Vagas" htmlFor="tn-vagas">
          <V2Input id="tn-vagas" type="number" min="2" max="64" required
            value={form.max_participants} onChange={(e) => set({ max_participants: e.target.value })} />
        </V2Field>
        <V2Field label="Inscrição (R$)" htmlFor="tn-taxa" hint="0 = de graça.">
          <V2Input id="tn-taxa" type="number" min="0" step="0.01"
            value={form.entry_fee} onChange={(e) => set({ entry_fee: e.target.value })} />
        </V2Field>
        <V2Field label="Começa" htmlFor="tn-ini">
          <V2Input id="tn-ini" type="time" value={form.start_time}
            onChange={(e) => set({ start_time: e.target.value })} />
        </V2Field>
        <V2Field label="Termina" htmlFor="tn-fim">
          <V2Input id="tn-fim" type="time" value={form.end_time}
            onChange={(e) => set({ end_time: e.target.value })} />
        </V2Field>
      </div>

      <div className="mt-3">
        <p className="mb-1.5 text-xs font-bold uppercase tracking-widest text-gray-400">
          Quadras do torneio
        </p>
        <div className="flex flex-wrap gap-1.5">
          {courts.map((c) => {
            const marcada = form.court_ids.includes(c.id);
            return (
              <button key={c.id} type="button" onClick={() => alternarQuadra(c.id)}
                className={`rounded-2xl border px-3 py-1.5 text-sm transition ${marcada ? 'border-ink bg-ink text-acid' : 'border-gray-200 bg-paper-pure text-ink hover:border-gray-300'}`}>
                {c.name}
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-xs text-gray-500">
          {form.court_ids.length === 0
            ? 'Nenhuma escolhida — o torneio não tira horário da venda, e não dá para começá-lo pelo sistema.'
            : `${form.court_ids.length} quadra(s) saem da venda das ${form.start_time} às ${form.end_time}.`}
        </p>
      </div>

      <V2Field label="Descrição" htmlFor="tn-desc" className="mt-3">
        <V2Textarea id="tn-desc" rows={2} maxLength={500}
          placeholder="Regras da casa, premiação, o que levar…"
          value={form.description} onChange={(e) => set({ description: e.target.value })} />
      </V2Field>

      <div className="mt-3 flex justify-end gap-2">
        <V2Button type="button" variant="ghost" onClick={onClose}>Cancelar</V2Button>
        <V2Button type="submit" disabled={criar.isPending || editar.isPending}>
          {torneio ? 'Salvar' : 'Publicar torneio'}
        </V2Button>
      </div>
    </form>
  );
}

/* =========================================================== CARTÃO ===== */

function CartaoDoTorneio({ torneio, arena, courts, podeGerir, souInscrito, onEditar }) {
  const entrar = useJoinTournament();
  const sair = useLeaveTournament();
  const comecar = useStartTournament();
  const cancelar = useCancelTournament();
  const apagar = useDeleteTournament();

  const meta = INTERNAL_TOURNAMENT_STATUS_META[torneio.status]
    || INTERNAL_TOURNAMENT_STATUS_META[INTERNAL_TOURNAMENT_STATUS.SCHEDULED];
  const formato = INTERNAL_TOURNAMENT_FORMAT_META[torneio.format];
  const vagas = tournamentSeatsLeft(torneio);
  const aberto = isTournamentOpen(torneio);
  const nomeQuadra = new Map(courts.map((c) => [c.id, c.name]));
  const quadras = (torneio.court_ids || []).map((id) => nomeQuadra.get(id)).filter(Boolean);
  const roster = Array.isArray(torneio.roster) ? torneio.roster : [];
  const podeComecar = podeGerir && aberto && roster.length >= 2
    && (torneio.court_ids || []).length > 0 && torneio.start_time && torneio.end_time;

  return (
    <div className={`rounded-2xl border p-4 ${!aberto && torneio.status !== INTERNAL_TOURNAMENT_STATUS.RUNNING ? 'border-gray-100 bg-gray-50 opacity-80' : 'border-gray-100 bg-paper'}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-lg font-bold text-ink">{torneio.name}</p>
          <p className="mt-0.5 text-sm text-gray-600">
            {formatDateShortBR(torneio.date)}
            {torneio.start_time ? ` · ${torneio.start_time}–${torneio.end_time}` : ''}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
          {formato && <V2Badge tone="neutral">{formato.label}</V2Badge>}
          <V2Badge tone={meta.tone}>{meta.label}</V2Badge>
        </div>
      </div>

      {torneio.description && (
        <p className="mt-2 text-sm leading-6 text-gray-600">{torneio.description}</p>
      )}

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
        <span className="inline-flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          {torneio.enrolled || 0}/{torneio.max_participants}
          {vagas !== null && vagas > 0 ? ` · ${vagas} vaga(s)` : vagas === 0 ? ' · lotado' : ''}
        </span>
        {quadras.length > 0 && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" /> {quadras.join(', ')}
          </span>
        )}
        {Number(torneio.entry_fee) > 0
          ? <span className="font-bold text-ink">{formatPrice(torneio.entry_fee)}</span>
          : <span>Inscrição gratuita</span>}
      </div>

      {(torneio.prizes || []).length > 0 && (
        <ul className="mt-2 space-y-1">
          {torneio.prizes.map((p, i) => (
            <li key={`${p.position}-${i}`} className="flex items-center gap-1.5 text-xs text-gray-600">
              <Gift className="h-3.5 w-3.5 shrink-0 text-amber-600" />
              {p.position}º · {p.value}
            </li>
          ))}
        </ul>
      )}

      {torneio.status === INTERNAL_TOURNAMENT_STATUS.CANCELLED && torneio.cancel_reason && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-red-700">
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" /> {torneio.cancel_reason}
        </p>
      )}

      {/* Quem já está dentro. Mostrar os inscritos é o que faz alguém decidir
          entrar — "tem gente que eu conheço" vale mais que qualquer texto. */}
      {roster.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-gray-400">
            Quem já está
          </p>
          <div className="flex flex-wrap gap-1.5">
            {roster.slice(0, 12).map((r) => (
              <span key={r.user_id} className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-paper-pure py-0.5 pl-0.5 pr-2.5 text-xs text-ink">
                <V2Avatar photoUrl={r.photo_url} name={r.name} size="xs" />
                {r.name}
              </span>
            ))}
            {roster.length > 12 && (
              <span className="self-center text-xs text-gray-500">e mais {roster.length - 12}</span>
            )}
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {/* ---- o torneio já virou dia de jogo: a porta é lá ---- */}
        {torneio.game_day_id && (
          <V2Button asChild size="sm">
            <Link to={`/dia-de-jogo/${torneio.game_day_id}`}>
              <Play className="mr-1 h-3.5 w-3.5" /> Abrir o jogo
            </Link>
          </V2Button>
        )}

        {/* ---- atleta ---- */}
        {!podeGerir && aberto && (
          souInscrito ? (
            <ConfirmDialog
              title="Sair deste torneio?"
              description="Sua vaga volta para a arena. Dá para entrar de novo se sobrar lugar."
              confirmLabel="Sair"
              destructive
              onConfirm={() => sair.mutateAsync({ arenaId: arena.id, tid: torneio.id })
                .then(() => toast.success('Você saiu do torneio.'))
                .catch((e) => toast.error(e?.message || 'Não foi possível sair.'))}
              trigger={<V2Button size="sm" variant="ghost">Sair do torneio</V2Button>}
            />
          ) : (
            <V2Button size="sm" disabled={vagas === 0 || entrar.isPending}
              onClick={() => entrar.mutateAsync({ arenaId: arena.id, tid: torneio.id })
                .then(() => toast.success('Inscrição feita!'))
                .catch((e) => toast.error(e?.message || 'Não foi possível inscrever.'))}>
              {vagas === 0 ? 'Lotado' : 'Quero jogar'}
            </V2Button>
          )
        )}
        {souInscrito && <V2Badge tone="green">Você está inscrito</V2Badge>}

        {/* ---- arena ---- */}
        {podeGerir && aberto && (
          <>
            <V2Button
              size="sm"
              disabled={!podeComecar || comecar.isPending}
              onClick={() => comecar.mutateAsync({ arenaId: arena.id, tournament: torneio, arena, courts })
                .then(() => toast.success('Torneio começou! O dia de jogo foi criado com os inscritos.'))
                .catch((e) => toast.error(e?.message || 'Não foi possível começar.'))}
            >
              <Play className="mr-1 h-3.5 w-3.5" />
              {comecar.isPending ? 'Começando…' : 'Começar o torneio'}
            </V2Button>
            <V2Button size="sm" variant="ghost" onClick={() => onEditar(torneio)}>
              <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
            </V2Button>
            <ConfirmDialog
              title="Cancelar este torneio?"
              description="Quem está inscrito é avisado, e as quadras voltam à venda."
              confirmLabel="Cancelar o torneio"
              destructive
              onConfirm={() => cancelar.mutateAsync({ arenaId: arena.id, tid: torneio.id, motivo: '' })
                .then(() => toast.success('Torneio cancelado e inscritos avisados.'))
                .catch((e) => toast.error(e?.message || 'Não foi possível cancelar.'))}
              trigger={<V2Button size="sm" variant="ghost" className="text-red-600">Cancelar</V2Button>}
            />
          </>
        )}
        {podeGerir && !aberto && (
          <ConfirmDialog
            title="Apagar do histórico?"
            description="O torneio some da lista. O registro em auditoria permanece."
            confirmLabel="Apagar"
            destructive
            onConfirm={() => apagar.mutateAsync({ arenaId: arena.id, tid: torneio.id })
              .then(() => toast.success('Torneio apagado.'))
              .catch((e) => toast.error(e?.message || 'Não foi possível apagar.'))}
            trigger={(
              <V2Button size="sm" variant="ghost" className="text-red-600">
                <Trash2 className="mr-1 h-3.5 w-3.5" /> Apagar
              </V2Button>
            )}
          />
        )}
      </div>

      {podeGerir && aberto && !podeComecar && (
        <p className="mt-2 text-xs text-gray-500">
          {roster.length < 2
            ? 'Faltam inscritos para começar (mínimo de 2).'
            : 'Escolha as quadras e o horário para poder começar.'}
        </p>
      )}
    </div>
  );
}

/* ============================================================ LADDER ==== */

const MEDALHA = ['text-amber-500', 'text-gray-400', 'text-amber-700'];

function LadderSecao({ arenaId }) {
  const { data: linhas = [], isLoading } = useArenaLadder(arenaId);

  return (
    <V2Surface className="mb-6">
      <div className="mb-4 flex items-center gap-2">
        <Crown className="h-5 w-5 text-ink" />
        <h2 className="font-display text-lg font-bold text-ink">Classificação da casa</h2>
      </div>

      {isLoading && <V2Skeleton className="h-24 rounded-2xl" />}

      {!isLoading && linhas.length === 0 && (
        <V2EmptyState
          icon={Medal}
          title="Ninguém pontuou ainda"
          description="A classificação soma os torneios encerrados: 100 pontos para o campeão, 70 para o segundo, e 10 para quem participou. Quem só aparece também sobe."
        />
      )}

      {linhas.length > 0 && (
        <ol className="space-y-1.5">
          {linhas.slice(0, 20).map((l, i) => (
            <li key={l.user_id} className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-paper p-2.5">
              <span className={`w-6 text-center font-display text-base font-bold ${MEDALHA[i] || 'text-gray-400'}`}>
                {l.ladder_position || i + 1}
              </span>
              <V2Avatar name={l.name} size="sm" />
              <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink">{l.name}</span>
              <span className="text-xs text-gray-500">
                {l.played || 0} torneio(s)
                {Number(l.titles) > 0 ? ` · ${l.titles} título(s)` : ''}
              </span>
              <span className="font-display text-base font-bold text-ink">{l.points || 0}</span>
            </li>
          ))}
        </ol>
      )}
    </V2Surface>
  );
}

/* =========================================================== A PÁGINA === */

export default function V2ArenaLeagues() {
  const { arenaId } = useParams();
  const { user, isPlatformAdmin, isAuthenticated } = useAuth();
  const { data: arena, isLoading } = useArena(arenaId);
  const { data: managed = [] } = useMyManagedArenas();
  const { isOn, isLoading: modulosCarregando } = useArenaModules(arenaId);
  const { data: courts = [] } = useArenaCourts(arenaId);
  const { data: torneios = [], isLoading: tCarregando } = useArenaTournaments(arenaId);
  const [form, setForm] = useState(null);
  const [verEncerrados, setVerEncerrados] = useState(false);

  const podeGerir = arena?.owner_id === user?.uid
    || managed.some((m) => m.id === arena?.id)
    || isPlatformAdmin;

  const { ativos, encerrados } = useMemo(() => ({
    ativos: torneios.filter((t) => t.status !== INTERNAL_TOURNAMENT_STATUS.FINISHED
      && t.status !== INTERNAL_TOURNAMENT_STATUS.CANCELLED),
    encerrados: torneios.filter((t) => t.status === INTERNAL_TOURNAMENT_STATUS.FINISHED
      || t.status === INTERNAL_TOURNAMENT_STATUS.CANCELLED),
  }), [torneios]);

  if (isLoading || modulosCarregando) {
    return <V2Skeleton className="mx-auto h-96 max-w-[900px] rounded-4xl" />;
  }
  if (!arena) return <Navigate to="/arenas" replace />;
  if (!isOn(ARENA_MODULE_ID.LEAGUES)) return <Navigate to={`/arenas/${arenaId}`} replace />;

  const temLadder = isOn(ARENA_MODULE_ID.LEAGUES_LADDER);
  const lista = verEncerrados ? encerrados : ativos;

  return (
    <div className="mx-auto max-w-[900px]">
      <div className="mb-6">
        <Link
          to={podeGerir ? `/arenas/${arena.id}/gerir` : `/arenas/${arena.id}`}
          className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {podeGerir ? 'Voltar para a gestão' : arena.name}
        </Link>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
          Torneios da casa
        </h1>
        <p className="mt-2 font-medium text-gray-500">
          {arena.name} · a competição da comunidade da arena.
        </p>
      </div>

      {temLadder && <LadderSecao arenaId={arena.id} />}

      <V2Surface>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-ink" />
            <h2 className="font-display text-lg font-bold text-ink">
              {verEncerrados ? 'Encerrados' : 'Torneios'}
            </h2>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <V2Button size="sm" variant="ghost" onClick={() => setVerEncerrados((v) => !v)}>
              {verEncerrados ? `Ativos (${ativos.length})` : `Encerrados (${encerrados.length})`}
            </V2Button>
            {podeGerir && !form && (
              <V2Button size="sm" onClick={() => setForm('novo')}>
                <Plus className="mr-1.5 h-4 w-4" /> Novo torneio
              </V2Button>
            )}
          </div>
        </div>

        {form && podeGerir && (
          <TorneioForm arenaId={arena.id} torneio={form === 'novo' ? null : form}
            courts={courts} onClose={() => setForm(null)} />
        )}

        {tCarregando && <V2Skeleton className="h-32 rounded-2xl" />}

        {!tCarregando && lista.length === 0 && !form && (
          <V2EmptyState
            icon={Calendar}
            title={verEncerrados ? 'Nenhum torneio encerrado' : 'Nenhum torneio marcado'}
            description={podeGerir
              ? 'Um torneio da casa dá motivo para a turma voltar toda semana, sem virar torneio nacional. Ao começar, ele vira um dia de jogo com sorteio, placar e ranking — tudo já pronto.'
              : 'Quando a arena marcar um torneio, ele aparece aqui.'}
            action={podeGerir && !verEncerrados
              ? <V2Button size="sm" onClick={() => setForm('novo')}>Marcar o primeiro</V2Button>
              : null}
          />
        )}

        <div className="space-y-3">
          {lista.map((t) => (
            <CartaoDoTorneio
              key={t.id}
              torneio={t}
              arena={arena}
              courts={courts}
              podeGerir={podeGerir}
              souInscrito={(t.participants || []).includes(user?.uid)}
              onEditar={setForm}
            />
          ))}
        </div>

        {!isAuthenticated && (
          <p className="mt-4 text-sm text-gray-500">
            <Link to="/entrar" className="font-bold text-ink underline">Entre</Link> para se inscrever.
          </p>
        )}
      </V2Surface>

      {podeGerir && (
        <p className="mt-6 flex items-start gap-2 rounded-2xl bg-paper p-4 text-xs leading-5 text-gray-500">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            <strong className="text-ink">Começar o torneio</strong> cria um dia de jogo da arena
            com os inscritos, no formato escolhido — e a partir dali valem o sorteio equilibrado,
            o placar, o ranking do dia e o telão, sem nada a configurar. As quadras escolhidas
            saem da venda enquanto o torneio durar.
          </span>
        </p>
      )}
    </div>
  );
}
