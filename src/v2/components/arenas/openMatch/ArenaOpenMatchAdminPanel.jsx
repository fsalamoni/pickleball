/**
 * O jogo aberto na CENTRAL da arena — a arena publica horários com vagas.
 *
 * Era a página `/arenas/:arenaId/gerir/open-match`, alcançada por um botão no
 * topo da Central; virou a aba **Jogo aberto** (`?aba=jogo-aberto`). A rota
 * antiga continua existindo e leva para cá (notificação antiga aponta para ela).
 *
 * O que a aba acrescentou à tela antiga:
 *  - **quem vem jogar**: a vaga dizia "3 de 4" e a arena não sabia QUEM eram
 *    os três — nome e foto saem do diretório de atletas;
 *  - **a fila de cada jogo**: quantos esperam e quem foi chamado, numa
 *    consulta só para a arena inteira.
 *
 * O que continua igual, e por quê:
 *  1. **A quadra é ESCOLHIDA, não digitada** — publicar OCUPA o horário.
 *  2. **O nível está na régua da plataforma (2.0–8.0).**
 *  3. **Conflito é dito na hora** — em cima de reserva, dia de jogo ou outra
 *     vaga, a publicação é recusada com o motivo.
 */

import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  AlertTriangle, BellRing, CalendarDays, Info, Plus, Trash2, X,
} from 'lucide-react';
import { useArenaCourts } from '@/modules/arenas/hooks/useArenas';
import { useAthletes } from '@/modules/athletes/hooks/useAthletes';
import {
  useArenaOpenSlots,
  useArenaWaitlist,
  useCreateOpenSlot,
  useCancelOpenSlot,
  useDeleteOpenSlot,
} from '@/modules/arenas/hooks/useArenaV3';
import {
  computeSlotStatus,
  formatLevel,
  slotLevelRangeLabel,
} from '@/modules/arenas/domain/openMatch';
import { OPEN_SLOT_FORMAT_LABEL, waitlistBySlot } from '@/modules/arenas/domain/openMatchView';
import { formatSlotLabel, todayISO } from '@/modules/arenas/domain/calendar';
import { formatPrice } from '@/modules/arenas/domain/pricing';
import { DUPR_MAX, DUPR_MIN } from '@/modules/rating/domain/duprScale';
import ConfirmDialog from '@/components/ConfirmDialog';
import {
  V2Avatar, V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Field, V2Input, V2Skeleton, V2Surface, V2Textarea,
} from '@/v2/ui/primitives';

const FORMATOS = [
  { id: 'duplas', label: 'Duplas' },
  { id: 'simples', label: 'Simples' },
  { id: 'mistas', label: 'Duplas mistas' },
  { id: 'open', label: 'Livre' },
  { id: 'treino', label: 'Treino' },
];
const FORMATO_LABEL = OPEN_SLOT_FORMAT_LABEL;

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

function VagaCard({ slot, onCancel, onDelete, pessoas = [], fila = null }) {
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
          <V2Badge tone="neutral">{formatPrice(Number(slot.price))} por atleta</V2Badge>
        )}
        {!slot.court_id && (
          <span className="inline-flex items-center gap-1 text-amber-700">
            <AlertTriangle className="h-3 w-3" /> não ocupa a quadra
          </span>
        )}
      </div>

      {slot.notes && <p className="mt-2 text-xs leading-5 text-gray-500">{slot.notes}</p>}

      {/* QUEM vem jogar — a vaga dizia "3 de 4" e a arena não sabia quem
          eram os três. Quem não está no diretório aparece como "Atleta". */}
      {pessoas.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Quem vem</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {pessoas.map((p) => (
              <span key={p.uid} className="inline-flex items-center gap-1.5 rounded-full border border-gray-100 bg-paper py-0.5 pl-0.5 pr-2.5 text-xs text-ink">
                <V2Avatar photoUrl={p.photo} name={p.name} size="xs" /> {p.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {fila && (fila.esperando > 0 || fila.chamado) && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-gray-600">
          <BellRing className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
          <span>
            {fila.esperando > 0 && (
              <>Fila de espera: <strong className="text-ink">{fila.esperando}</strong>
                {fila.nomes.length > 0 ? ` (${fila.nomes.slice(0, 3).join(', ')}${fila.nomes.length > 3 ? '…' : ''})` : ''}. </>
            )}
            {fila.chamado && (
              <>Chamado agora: <strong className="text-ink">{fila.chamado.athlete_name || 'Atleta'}</strong> — tem até o prazo para confirmar.</>
            )}
          </span>
        </p>
      )}

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

/* ---------------------------------- painel ---------------------------------- */

/**
 * @param {{ arena: object }} props
 */
export default function ArenaOpenMatchAdminPanel({ arena }) {
  const arenaId = arena.id;
  const { data: courts = [] } = useArenaCourts(arenaId);
  const {
    data: slots = [], isLoading: carregandoVagas, isError, refetch,
  } = useArenaOpenSlots(arenaId);
  const { data: filaDaArena = [] } = useArenaWaitlist(arenaId);
  const { data: atletas = [] } = useAthletes();
  const cancelar = useCancelOpenSlot();
  const excluir = useDeleteOpenSlot();
  const [criando, setCriando] = useState(false);

  const quadrasAtivas = useMemo(() => courts.filter((c) => c.is_active !== false), [courts]);
  const hoje = todayISO();
  const { futuras, passadas } = useMemo(() => ({
    futuras: slots.filter((s) => String(s.date || '') >= hoje),
    passadas: slots.filter((s) => String(s.date || '') < hoje).reverse(),
  }), [slots, hoje]);
  const filaPorVaga = useMemo(() => waitlistBySlot(filaDaArena), [filaDaArena]);
  const porUid = useMemo(() => new Map(atletas.map((a) => [a.id || a.uid, a])), [atletas]);
  const pessoasDe = (slot) => (slot.participants || []).map((uid) => {
    const a = porUid.get(uid);
    return { uid, name: a?.platform_name || a?.full_name || 'Atleta', photo: a?.photo_url || '' };
  });

  const aoCancelar = (id) => cancelar.mutateAsync({ slotId: id })
    .then(() => toast.success('Jogo cancelado. A quadra voltou a ficar livre.'))
    .catch((e) => toast.error(e?.message || 'Não foi possível cancelar.'));
  const aoExcluir = (id) => excluir.mutateAsync(id)
    .then(() => toast.success('Excluído.'))
    .catch((e) => toast.error(e?.message || 'Não foi possível excluir.'));

  return (
    <div className="space-y-4">
      <V2Surface>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-ink">Jogo aberto</h2>
            <p className="mt-1 text-sm text-gray-500">
              Publique um horário com vagas e deixe os atletas do nível certo preencherem — sem
              ninguém precisar montar o grupo. O jogo aparece na página da arena.
            </p>
          </div>
          {!criando && (
            <V2Button onClick={() => setCriando(true)}>
              <Plus className="h-4 w-4" /> Publicar jogo
            </V2Button>
          )}
        </div>

        {quadrasAtivas.length === 0 && (
          <p className="mt-4 flex gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Esta arena ainda não tem quadras ativas. Você pode publicar mesmo assim, mas o
              jogo <strong>não vai ocupar horário</strong> no calendário.{' '}
              <Link to={`/arenas/${arenaId}/gerir?aba=quadras`} className="font-bold underline">
                Cadastrar quadras
              </Link>
            </span>
          </p>
        )}

        {criando && (
          <div className="mt-4">
            <NovaVagaForm arenaId={arenaId} courts={quadrasAtivas} onClose={() => setCriando(false)} />
          </div>
        )}
      </V2Surface>

      {isError ? (
        <V2Surface>
          <V2ErrorState title="Não foi possível carregar os jogos abertos"
            description="Os jogos publicados continuam lá — tente de novo." onRetry={() => refetch()} />
        </V2Surface>
      ) : carregandoVagas ? (
        <V2Skeleton className="h-48" />
      ) : slots.length === 0 ? (
        !criando && (
          <V2Surface>
            <V2EmptyState
              icon={CalendarDays}
              title="Nenhum jogo aberto ainda"
              description="Escolha um horário que costuma ficar vazio e publique. Quem estiver no nível certo entra sozinho."
              action={<V2Button onClick={() => setCriando(true)}><Plus className="h-4 w-4" /> Publicar o primeiro</V2Button>}
            />
          </V2Surface>
        )
      ) : (
        <>
          <V2Surface>
            <h3 className="mb-3 font-display text-base font-bold text-ink">
              Próximos <V2Badge tone="neutral">{futuras.length}</V2Badge>
            </h3>
            {futuras.length === 0 ? (
              <p className="text-sm text-gray-500">Nada marcado daqui para a frente.</p>
            ) : (
              <div className="space-y-2">
                {futuras.map((s) => (
                  <VagaCard key={s.id} slot={s} pessoas={pessoasDe(s)} fila={filaPorVaga.get(s.id) || null}
                    onCancel={aoCancelar} onDelete={aoExcluir} />
                ))}
              </div>
            )}
          </V2Surface>

          {passadas.length > 0 && (
            <V2Surface>
              <h3 className="mb-3 font-display text-base font-bold text-gray-500">
                Já aconteceram <V2Badge tone="neutral">{passadas.length}</V2Badge>
              </h3>
              <div className="space-y-2">
                {passadas.slice(0, 10).map((s) => (
                  <VagaCard key={s.id} slot={s} pessoas={pessoasDe(s)}
                    onCancel={aoCancelar} onDelete={aoExcluir} />
                ))}
              </div>
            </V2Surface>
          )}
        </>
      )}

      <p className="flex items-start gap-2 rounded-2xl bg-paper p-4 text-xs leading-5 text-gray-500">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Jogo com quadra escolhida ocupa o horário no calendário, como uma reserva. Quando alguém
        sai de um jogo lotado, o próximo da fila é chamado sozinho e tem um prazo para confirmar.
      </p>
    </div>
  );
}
