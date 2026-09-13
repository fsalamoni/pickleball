/**
 * V2ArenaAdminOpenMatch — a arena publica horários com vagas (Open Match).
 *
 * Rota: `/arenas/:arenaId/gerir/open-match`
 * Módulo: `matchmaking_open_match` (camada 2 — a arena precisa ter ativado).
 *
 * O que mudou em relação à primeira versão, e por quê:
 *
 * 1. **A quadra é ESCOLHIDA, não digitada.** Antes era texto livre, e por isso
 *    a vaga não fechava a quadra no calendário: ninguém sabia qual quadra era.
 *    Agora sai da lista de quadras da arena — e publicar OCUPA o horário.
 * 2. **O nível está na régua da plataforma (2.0–8.0).** Antes o campo aceitava
 *    0 a 7 e era comparado contra outro número, de outra escala: a peneira
 *    filtrava errado ou não filtrava nada.
 * 3. **Datas em português.** `2026-07-23 · 19:00` virou `Qui, 23/07 · 19:00`.
 * 4. **Conflito é dito na hora.** Publicar em cima de uma reserva, de um dia
 *    de jogo ou de outra vaga é recusado com o motivo — antes o choque só
 *    aparecia no dia, com gente na porta.
 */

import React, { useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  AlertTriangle, ArrowLeft, CalendarDays, Info, Plus, Trash2, Users, X,
} from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useArena, useArenaCourts, useMyManagedArenas } from '@/modules/arenas/hooks/useArenas';
import {
  useArenaOpenSlots,
  useCreateOpenSlot,
  useCancelOpenSlot,
  useDeleteOpenSlot,
} from '@/modules/arenas/hooks/useArenaV3';
import { useArenaModules } from '@/modules/arenas/hooks/useArenaModules';
import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';
import {
  computeSlotStatus,
  formatLevel,
  slotLevelRangeLabel,
} from '@/modules/arenas/domain/openMatch';
import { formatSlotLabel, todayISO } from '@/modules/arenas/domain/calendar';
import { DUPR_MAX, DUPR_MIN } from '@/modules/rating/domain/duprScale';
import ConfirmDialog from '@/components/ConfirmDialog';
import {
  V2Badge, V2Button, V2EmptyState, V2Field, V2Input, V2Skeleton, V2Surface, V2Textarea,
} from '@/v2/ui/primitives';

const FORMATOS = [
  { id: 'duplas', label: 'Duplas' },
  { id: 'simples', label: 'Simples' },
  { id: 'mistas', label: 'Duplas mistas' },
  { id: 'open', label: 'Livre' },
  { id: 'treino', label: 'Treino' },
];
const FORMATO_LABEL = Object.fromEntries(FORMATOS.map((f) => [f.id, f.label]));

/** Os degraus da régua: 2.0, 2.5, … 8.0. */
const NIVEIS = Array.from(
  { length: Math.round((DUPR_MAX - DUPR_MIN) / 0.5) + 1 },
  (_, i) => DUPR_MIN + i * 0.5,
);

function NivelSelect({ id, value, onChange, placeholder }) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-11 w-full rounded-2xl border border-gray-200 bg-paper-pure px-4 text-sm text-ink"
    >
      <option value="">{placeholder}</option>
      {NIVEIS.map((n) => (
        <option key={n} value={n}>{formatLevel(n)}</option>
      ))}
    </select>
  );
}

/* ------------------------------- formulário -------------------------------- */

const VAZIO = {
  date: '', start: '', end: '', total_spots: 4, format: 'duplas',
  court_id: '', price: '', min_level: '', max_level: '', notes: '',
};

function NovaVagaForm({ arenaId, courts, onClose }) {
  const [form, setForm] = useState(VAZIO);
  const create = useCreateOpenSlot();
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const quadraEscolhida = courts.find((c) => c.id === form.court_id);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const numeroOuNulo = (v) => (v === '' || v == null ? null : Number(v));
    try {
      await create.mutateAsync({
        arenaId,
        input: {
          ...form,
          total_spots: Number(form.total_spots) || 4,
          price: numeroOuNulo(form.price),
          min_level: numeroOuNulo(form.min_level),
          max_level: numeroOuNulo(form.max_level),
          // O nome vai junto para a vaga continuar legível se a quadra for
          // renomeada ou removida depois.
          court: quadraEscolhida?.name || '',
        },
      });
      toast.success('Jogo aberto publicado. A quadra já consta ocupada no calendário.');
      onClose();
    } catch (err) {
      toast.error(err?.message || 'Não foi possível publicar.');
    }
  };

  return (
    <V2Surface>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold text-ink">Publicar jogo aberto</h3>
          <p className="text-xs text-gray-500">
            Os atletas veem o horário e entram sozinhos. Escolhendo a quadra, ela fica
            reservada para este jogo — ninguém consegue pedir a mesma hora.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <V2Field label="Data" htmlFor="vaga-data">
            <V2Input
              id="vaga-data" type="date" required min={todayISO()}
              value={form.date} onChange={(e) => set({ date: e.target.value })}
            />
          </V2Field>
          <V2Field label="Início" htmlFor="vaga-inicio">
            <V2Input
              id="vaga-inicio" type="time" required
              value={form.start} onChange={(e) => set({ start: e.target.value })}
            />
          </V2Field>
          <V2Field label="Fim" htmlFor="vaga-fim">
            <V2Input
              id="vaga-fim" type="time" required
              value={form.end} onChange={(e) => set({ end: e.target.value })}
            />
          </V2Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <V2Field
            label="Quadra"
            htmlFor="vaga-quadra"
            hint={form.court_id ? 'Fica ocupada no calendário' : 'Sem quadra, não bloqueia horário'}
          >
            <select
              id="vaga-quadra"
              value={form.court_id}
              onChange={(e) => set({ court_id: e.target.value })}
              className="h-11 w-full rounded-2xl border border-gray-200 bg-paper-pure px-4 text-sm text-ink"
            >
              <option value="">Sem quadra definida</option>
              {courts.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </V2Field>
          <V2Field label="Vagas" htmlFor="vaga-vagas">
            <V2Input
              id="vaga-vagas" type="number" min="2" max="20" required
              value={form.total_spots} onChange={(e) => set({ total_spots: e.target.value })}
            />
          </V2Field>
          <V2Field label="Formato" htmlFor="vaga-formato">
            <select
              id="vaga-formato"
              value={form.format}
              onChange={(e) => set({ format: e.target.value })}
              className="h-11 w-full rounded-2xl border border-gray-200 bg-paper-pure px-4 text-sm text-ink"
            >
              {FORMATOS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </V2Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <V2Field label="Valor por atleta (R$)" htmlFor="vaga-preco">
            <V2Input
              id="vaga-preco" type="number" min="0" step="0.01"
              placeholder="Vazio = combinar"
              value={form.price} onChange={(e) => set({ price: e.target.value })}
            />
          </V2Field>
          <V2Field label="Nível mínimo" htmlFor="vaga-min" hint="Régua 2.0–8.0">
            <NivelSelect
              id="vaga-min" value={form.min_level}
              onChange={(v) => set({ min_level: v })} placeholder="Qualquer"
            />
          </V2Field>
          <V2Field label="Nível máximo" htmlFor="vaga-max" hint="Régua 2.0–8.0">
            <NivelSelect
              id="vaga-max" value={form.max_level}
              onChange={(v) => set({ max_level: v })} placeholder="Qualquer"
            />
          </V2Field>
        </div>

        <V2Field label="Observações" htmlFor="vaga-obs">
          <V2Textarea
            id="vaga-obs" rows={2}
            placeholder="Ex.: traga raquete própria; estacionamento no local."
            value={form.notes} onChange={(e) => set({ notes: e.target.value })}
          />
        </V2Field>

        {!form.court_id && (
          <p className="flex gap-1.5 rounded-2xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">
            <Info className="mt-px h-3.5 w-3.5 shrink-0" />
            <span>
              Sem escolher a quadra, este jogo <strong>não ocupa horário nenhum</strong> —
              alguém pode reservar a mesma hora.
            </span>
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <V2Button type="button" variant="ghost" onClick={onClose}>Cancelar</V2Button>
          <V2Button type="submit" disabled={create.isPending}>
            {create.isPending ? 'Publicando…' : 'Publicar'}
          </V2Button>
        </div>
      </form>
    </V2Surface>
  );
}

/* --------------------------------- cartão ---------------------------------- */

function VagaCard({ slot, onCancel, onDelete }) {
  const situacao = computeSlotStatus(slot);
  const inscritos = (slot.participants || []).length;
  const total = slot.total_spots || 0;
  const pct = total > 0 ? Math.round((inscritos / total) * 100) : 0;
  const faixa = slotLevelRangeLabel(slot);
  const cancelada = slot.status === 'cancelled';

  const tom = cancelada ? 'red'
    : situacao === 'full' ? 'amber'
      : situacao === 'completed' ? 'neutral' : 'green';
  const rotulo = cancelada ? 'Cancelado'
    : situacao === 'full' ? 'Lotado'
      : situacao === 'completed' ? 'Encerrado'
        : `${inscritos} de ${total}`;

  return (
    <div className={`rounded-2xl border p-4 ${cancelada ? 'border-gray-100 bg-paper opacity-70' : 'border-gray-100 bg-paper-pure'}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-base font-bold text-ink">{formatSlotLabel(slot)}</p>
          <p className="mt-0.5 text-xs text-gray-500">
            {slot.court || 'Sem quadra definida'}
            {slot.format ? ` · ${FORMATO_LABEL[slot.format] || slot.format}` : ''}
          </p>
        </div>
        <V2Badge tone={tom}>{rotulo}</V2Badge>
      </div>

      {!cancelada && total > 0 && (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className={`h-full rounded-full ${pct >= 100 ? 'bg-amber-400' : 'bg-acid'}`}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
        {faixa && <V2Badge tone="blue">Nível {faixa}</V2Badge>}
        {Number.isFinite(slot.price) && slot.price > 0 && (
          <V2Badge tone="neutral">R$ {Number(slot.price).toFixed(2)}</V2Badge>
        )}
        {!slot.court_id && (
          <span className="inline-flex items-center gap-1 text-amber-700">
            <AlertTriangle className="h-3 w-3" /> não ocupa a quadra
          </span>
        )}
      </div>

      {slot.notes && <p className="mt-2 text-xs leading-5 text-gray-500">{slot.notes}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!cancelada && situacao !== 'completed' && (
          <ConfirmDialog
            title="Cancelar este jogo aberto?"
            description={
              inscritos > 0
                ? `${inscritos} atleta(s) já estão inscritos e serão avisados. A quadra volta a ficar livre para reserva.`
                : 'A quadra volta a ficar livre para reserva.'
            }
            confirmLabel="Cancelar jogo"
            onConfirm={() => onCancel(slot.id)}
            trigger={<V2Button variant="ghost" size="sm">Cancelar jogo</V2Button>}
          />
        )}
        <ConfirmDialog
          title="Excluir definitivamente?"
          description="O registro some do histórico. Para apenas tirar do ar, prefira cancelar."
          confirmLabel="Excluir"
          destructive
          onConfirm={() => onDelete(slot.id)}
          trigger={(
            <V2Button variant="ghost" size="sm" className="text-red-600">
              <Trash2 className="h-4 w-4" /> Excluir
            </V2Button>
          )}
        />
      </div>
    </div>
  );
}

/* --------------------------------- página ---------------------------------- */

export default function V2ArenaAdminOpenMatch() {
  const { arenaId } = useParams();
  const { user, isPlatformAdmin } = useAuth();
  const { data: arena, isLoading } = useArena(arenaId);
  const { data: managed = [] } = useMyManagedArenas();
  const { data: courts = [] } = useArenaCourts(arenaId);
  const {
    data: slots = [], isLoading: carregandoVagas, isError, refetch,
  } = useArenaOpenSlots(arenaId);
  const { isOn, isLoading: carregandoModulos } = useArenaModules(arenaId);
  const cancelar = useCancelOpenSlot();
  const excluir = useDeleteOpenSlot();
  const [criando, setCriando] = useState(false);

  const quadrasAtivas = useMemo(() => courts.filter((c) => c.is_active !== false), [courts]);
  const hoje = todayISO();
  const { futuras, passadas } = useMemo(() => ({
    futuras: slots.filter((s) => String(s.date || '') >= hoje),
    passadas: slots.filter((s) => String(s.date || '') < hoje),
  }), [slots, hoje]);

  if (isLoading || carregandoModulos) {
    return <V2Skeleton className="mx-auto h-96 max-w-[900px] rounded-4xl" />;
  }
  if (!arena) {
    return (
      <div className="mx-auto max-w-[700px]">
        <V2Surface>
          <V2EmptyState
            title="Arena não encontrada"
            action={<Link to="/arenas" className="text-sm font-bold text-ink underline">← Voltar</Link>}
          />
        </V2Surface>
      </div>
    );
  }

  const podeGerir = arena.owner_id === user?.uid
    || managed.some((m) => m.id === arena.id)
    || isPlatformAdmin;
  if (!podeGerir) return <Navigate to={`/arenas/${arena.id}`} replace />;

  const voltar = (
    <Link
      to={`/arenas/${arena.id}/gerir`}
      className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-ink"
    >
      <ArrowLeft className="h-3.5 w-3.5" /> Central da arena
    </Link>
  );

  // Módulo desligado não é erro: é ausência. Mas quem administra precisa saber
  // ONDE ligar — mandar embora sem explicação seria pior.
  if (!isOn(ARENA_MODULE_ID.MATCHMAKING_OPEN_MATCH)) {
    return (
      <div className="mx-auto max-w-[700px]">
        {voltar}
        <V2Surface>
          <V2EmptyState
            icon={Users}
            title="Jogo aberto não está ativo nesta arena"
            description="Com este módulo, você publica um horário com vagas e os atletas do nível certo entram sozinhos — sem ninguém precisar montar o grupo."
            action={(
              <V2Button asChild>
                <Link to={`/arenas/${arena.id}/gerir/modulos`}>Ver módulos da arena</Link>
              </V2Button>
            )}
          />
        </V2Surface>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[900px]">
      {voltar}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink">Jogos abertos</h1>
          <p className="mt-1 text-sm text-gray-500">
            {arena.name} · publique um horário com vagas e deixe os atletas preencherem.
          </p>
        </div>
        {!criando && (
          <V2Button onClick={() => setCriando(true)}>
            <Plus className="h-4 w-4" /> Publicar jogo
          </V2Button>
        )}
      </div>

      {quadrasAtivas.length === 0 && (
        <V2Surface className="mb-4 border-amber-200 bg-amber-50">
          <p className="flex gap-2 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Esta arena ainda não tem quadras ativas. Você pode publicar mesmo assim, mas o
              jogo <strong>não vai ocupar horário</strong> no calendário.{' '}
              <Link to={`/arenas/${arena.id}/gerir`} className="font-bold underline">
                Cadastrar quadras
              </Link>
            </span>
          </p>
        </V2Surface>
      )}

      {criando && (
        <div className="mb-4">
          <NovaVagaForm arenaId={arena.id} courts={quadrasAtivas} onClose={() => setCriando(false)} />
        </div>
      )}

      {isError ? (
        <V2Surface>
          <p className="text-sm text-red-700">
            Não foi possível carregar os jogos abertos.{' '}
            <button type="button" className="font-bold underline" onClick={() => refetch()}>
              Tentar de novo
            </button>
          </p>
        </V2Surface>
      ) : carregandoVagas ? (
        <V2Skeleton className="h-48" />
      ) : slots.length === 0 ? (
        <V2Surface>
          <V2EmptyState
            icon={CalendarDays}
            title="Nenhum jogo aberto ainda"
            description="Escolha um horário que costuma ficar vazio e publique. Quem estiver no nível certo entra sozinho."
            action={<V2Button onClick={() => setCriando(true)}><Plus className="h-4 w-4" /> Publicar o primeiro</V2Button>}
          />
        </V2Surface>
      ) : (
        <div className="space-y-4">
          <V2Surface>
            <h2 className="mb-3 font-display text-base font-bold text-ink">
              Próximos <V2Badge tone="neutral">{futuras.length}</V2Badge>
            </h2>
            {futuras.length === 0 ? (
              <p className="text-sm text-gray-500">Nada marcado daqui para a frente.</p>
            ) : (
              <div className="space-y-2">
                {futuras.map((s) => (
                  <VagaCard
                    key={s.id}
                    slot={s}
                    onCancel={(id) => cancelar.mutateAsync({ slotId: id })
                      .then(() => toast.success('Jogo cancelado. A quadra voltou a ficar livre.'))
                      .catch((e) => toast.error(e?.message || 'Não foi possível cancelar.'))}
                    onDelete={(id) => excluir.mutateAsync(id)
                      .then(() => toast.success('Excluído.'))
                      .catch((e) => toast.error(e?.message || 'Não foi possível excluir.'))}
                  />
                ))}
              </div>
            )}
          </V2Surface>

          {passadas.length > 0 && (
            <V2Surface>
              <h2 className="mb-3 font-display text-base font-bold text-gray-500">
                Já aconteceram <V2Badge tone="neutral">{passadas.length}</V2Badge>
              </h2>
              <div className="space-y-2">
                {passadas.slice(0, 10).map((s) => (
                  <VagaCard
                    key={s.id}
                    slot={s}
                    onCancel={(id) => cancelar.mutateAsync({ slotId: id })}
                    onDelete={(id) => excluir.mutateAsync(id)
                      .then(() => toast.success('Excluído.'))
                      .catch((e) => toast.error(e?.message || 'Não foi possível excluir.'))}
                  />
                ))}
              </div>
            </V2Surface>
          )}
        </div>
      )}
    </div>
  );
}
