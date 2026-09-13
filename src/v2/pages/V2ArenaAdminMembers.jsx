/**
 * V2ArenaAdminMembers — a arena cuida dos seus membros.
 *
 * Rota: `/arenas/:arenaId/gerir/membros`
 * Módulo: `members` (+ `members_packages`, `members_wallet`, `members_tiers`).
 *
 * ## O que faltava
 *
 * A primeira versão só LISTAVA. Não dava para incluir um membro (a lista dizia
 * "conforme atletas comprarem pacotes, eles aparecem aqui" — ou seja, a arena
 * não tinha como convidar ninguém), nem ajustar pontos, nem creditar saldo.
 * Um programa de membros em que a arena não consegue incluir ninguém não é um
 * programa de membros.
 *
 * Agora: incluir pelo diretório de atletas, ver nível, horas de pacote e
 * saldo de cada um, ajustar pontos e creditar carteira — com motivo, que vai
 * para a auditoria e para o extrato do atleta.
 */

import React, { useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft, CalendarClock, Check, Package, Plus, Search, Trash2, Trophy,
  UserPlus, Wallet, X,
} from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useArena, useMyManagedArenas } from '@/modules/arenas/hooks/useArenas';
import { useAthletes } from '@/modules/athletes/hooks/useAthletes';
import {
  useArenaMembers, useArenaPackages, useCreatePackage, useDeletePackage,
  useAddArenaMember, useRemoveArenaMember, useAddPointsToMember, useCreditWallet,
  useRedeemMemberPoints,
  useArenaSubscriptions, useSetMemberSubscription, useSetSubscriptionMonthPaid,
  useCancelMemberSubscription,
} from '@/modules/arenas/hooks/useArenaV3';
import { useArenaModules } from '@/modules/arenas/hooks/useArenaModules';
import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';
import { computeTier } from '@/modules/arenas/domain/members';
import { DEFAULT_POINTS_PER_REAL, redeemPoints } from '@/modules/arenas/domain/marketing';
import { formatPrice } from '@/modules/arenas/domain/pricing';
import {
  SUBSCRIPTION_STATUS, amountDue, monthKey, subscriptionState, todayISO,
} from '@/modules/arenas/domain/subscription';
import ConfirmDialog from '@/components/ConfirmDialog';
import {
  V2Avatar, V2Badge, V2Button, V2EmptyState, V2Field, V2Input,
  V2Skeleton, V2Surface, V2Textarea,
} from '@/v2/ui/primitives';

const TIER_TONE = { bronze: 'amber', silver: 'neutral', gold: 'acid', platinum: 'ink' };

/* ------------------------------ novo pacote -------------------------------- */

function NovoPacoteForm({ arenaId, onClose }) {
  const [form, setForm] = useState({
    name: '', description: '', hours: 10, price: 250, validity_days: 60,
  });
  const create = useCreatePackage();
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const porHora = Number(form.hours) > 0 ? Number(form.price) / Number(form.hours) : 0;

  const submit = async (e) => {
    e.preventDefault();
    try {
      await create.mutateAsync({
        arenaId,
        input: {
          ...form,
          hours: Number(form.hours),
          price: Number(form.price),
          validity_days: Number(form.validity_days),
        },
      });
      toast.success('Pacote publicado.');
      onClose();
    } catch (err) {
      toast.error(err?.message || 'Não foi possível criar o pacote.');
    }
  };

  return (
    <form onSubmit={submit} className="rounded-2xl border border-gray-100 bg-paper p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-base font-bold text-ink">Novo pacote de horas</h3>
        <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-ink">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <V2Field label="Nome" htmlFor="pkg-nome">
          <V2Input id="pkg-nome" required maxLength={80} placeholder="Ex.: Mensal 10h"
            value={form.name} onChange={(e) => set({ name: e.target.value })} />
        </V2Field>
        <V2Field label="Validade (dias)" htmlFor="pkg-validade">
          <V2Input id="pkg-validade" type="number" min="1" max="365" required
            value={form.validity_days} onChange={(e) => set({ validity_days: e.target.value })} />
        </V2Field>
        <V2Field label="Horas" htmlFor="pkg-horas">
          <V2Input id="pkg-horas" type="number" min="1" max="200" required
            value={form.hours} onChange={(e) => set({ hours: e.target.value })} />
        </V2Field>
        <V2Field
          label="Preço (R$)"
          htmlFor="pkg-preco"
          hint={porHora > 0 ? `Sai a ${formatPrice(porHora)} por hora` : undefined}
        >
          <V2Input id="pkg-preco" type="number" min="1" step="0.01" required
            value={form.price} onChange={(e) => set({ price: e.target.value })} />
        </V2Field>
      </div>
      <V2Field label="Descrição" htmlFor="pkg-desc" className="mt-3">
        <V2Textarea id="pkg-desc" rows={2} maxLength={500}
          placeholder="O que está incluído, restrições de horário…"
          value={form.description} onChange={(e) => set({ description: e.target.value })} />
      </V2Field>
      <div className="mt-3 flex justify-end gap-2">
        <V2Button type="button" variant="ghost" onClick={onClose}>Cancelar</V2Button>
        <V2Button type="submit" disabled={create.isPending}>
          {create.isPending ? 'Publicando…' : 'Publicar pacote'}
        </V2Button>
      </div>
    </form>
  );
}

/* ------------------------------ incluir membro ----------------------------- */

function IncluirMembro({ arenaId, jaSaoMembros, onClose }) {
  const { data: athletes = [] } = useAthletes();
  const add = useAddArenaMember();
  const [q, setQ] = useState('');

  const resultados = useMemo(() => {
    const termo = q.trim().toLowerCase();
    if (!termo) return [];
    return athletes
      .filter((a) => !jaSaoMembros.has(a.id))
      .filter((a) => `${a.platform_name || ''} ${a.full_name || ''}`.toLowerCase().includes(termo))
      .slice(0, 8);
  }, [athletes, q, jaSaoMembros]);

  const incluir = async (a) => {
    try {
      await add.mutateAsync({
        arenaId,
        target: {
          user_id: a.id,
          user_name: a.platform_name || a.full_name || 'Atleta',
          user_photo: a.photo_url || '',
        },
      });
      toast.success(`${a.platform_name || a.full_name || 'Atleta'} agora é membro.`);
      setQ('');
    } catch (err) {
      toast.error(err?.message || 'Não foi possível incluir.');
    }
  };

  return (
    <div className="rounded-2xl border border-gray-100 bg-paper p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-base font-bold text-ink">Incluir membro</h3>
        <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-ink">
          <X className="h-4 w-4" />
        </button>
      </div>
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="search" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar atleta pelo nome…"
          className="h-11 w-full rounded-2xl border border-gray-200 bg-paper-pure pl-10 pr-4 text-sm"
        />
      </label>
      {q.trim() && resultados.length === 0 && (
        <p className="mt-2 text-xs text-gray-500">Ninguém encontrado — ou já é membro.</p>
      )}
      <div className="mt-2 space-y-1.5">
        {resultados.map((a) => (
          <button
            key={a.id}
            type="button"
            disabled={add.isPending}
            onClick={() => incluir(a)}
            className="flex w-full items-center gap-3 rounded-2xl border border-gray-100 bg-paper-pure p-2.5 text-left hover:border-ink"
          >
            <V2Avatar name={a.platform_name || a.full_name} photoUrl={a.photo_url} size="sm" />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
              {a.platform_name || a.full_name || 'Atleta'}
            </span>
            <UserPlus className="h-4 w-4 shrink-0 text-gray-400" />
          </button>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------- ajustes ---------------------------------- */

function AjusteDoMembro({ arenaId, member, temCarteira, onClose }) {
  const pontos = useAddPointsToMember();
  const credito = useCreditWallet();
  const [form, setForm] = useState({ points: '', amount: '', reason: '' });
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const aplicar = async (e) => {
    e.preventDefault();
    const p = Number(form.points);
    const v = Number(form.amount);
    if (!Number.isFinite(p) && !Number.isFinite(v)) return;
    try {
      if (Number.isFinite(p) && p !== 0) {
        await pontos.mutateAsync({ arenaId, userId: member.user_id, points: p });
      }
      if (temCarteira && Number.isFinite(v) && v > 0) {
        await credito.mutateAsync({
          arenaId, userId: member.user_id, amount: v,
          source: form.reason.trim() || 'ajuste da arena',
        });
      }
      toast.success('Ajuste aplicado.');
      onClose();
    } catch (err) {
      toast.error(err?.message || 'Não foi possível aplicar.');
    }
  };

  const ocupado = pontos.isPending || credito.isPending;

  return (
    <form onSubmit={aplicar} className="mt-3 rounded-2xl border border-gray-100 bg-paper-pure p-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <V2Field label="Pontos (+/−)" htmlFor={`pts-${member.id}`}>
          <V2Input id={`pts-${member.id}`} type="number" placeholder="Ex.: 50"
            value={form.points} onChange={(e) => set({ points: e.target.value })} />
        </V2Field>
        {temCarteira && (
          <V2Field label="Creditar (R$)" htmlFor={`cred-${member.id}`}>
            <V2Input id={`cred-${member.id}`} type="number" min="0" step="0.01" placeholder="Ex.: 20"
              value={form.amount} onChange={(e) => set({ amount: e.target.value })} />
          </V2Field>
        )}
        <V2Field label="Motivo" htmlFor={`mot-${member.id}`} hint="Aparece no extrato do atleta">
          <V2Input id={`mot-${member.id}`} maxLength={60} placeholder="Ex.: cortesia"
            value={form.reason} onChange={(e) => set({ reason: e.target.value })} />
        </V2Field>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <V2Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancelar</V2Button>
        <V2Button type="submit" size="sm" disabled={ocupado}>
          {ocupado ? 'Aplicando…' : 'Aplicar ajuste'}
        </V2Button>
      </div>
    </form>
  );
}

/**
 * Trocar pontos por crédito — o balcão do programa de fidelidade.
 *
 * Fica do lado da ARENA porque a regra do Firestore só deixa o gestor escrever
 * pontos e carteira. Na tela do atleta o resgate aparece como valor, com o
 * caminho: pedir aqui.
 *
 * O campo já vem preenchido com o resgate MÁXIMO possível — que é o que a
 * pessoa quase sempre pede — e o rótulo mostra em reais quanto sai, antes de
 * confirmar. Sobra de pontos fica com o atleta, nunca é arredondada para fora.
 */
function ResgateDePontos({ arenaId, member, onClose }) {
  const resgatar = useRedeemMemberPoints();
  const disponiveis = Math.max(0, Number(member?.points) || 0);
  const maximo = redeemPoints(disponiveis, { available: disponiveis });
  const [pontos, setPontos] = useState(() => String(maximo.points || ''));

  const previa = redeemPoints(Number(pontos), { available: disponiveis });

  const aplicar = async (e) => {
    e.preventDefault();
    if (previa.error) { toast.error(previa.error); return; }
    try {
      const { points, credit } = await resgatar.mutateAsync({
        arenaId, userId: member.user_id, points: previa.points,
      });
      toast.success(`${points} pontos trocados por ${formatPrice(credit)} em carteira.`);
      onClose();
    } catch (err) {
      toast.error(err?.message || 'Não foi possível resgatar.');
    }
  };

  return (
    <form onSubmit={aplicar} className="mt-3 rounded-2xl border border-gray-100 bg-paper-pure p-3">
      <p className="mb-2 text-xs text-gray-500">
        {disponiveis} pontos disponíveis · {DEFAULT_POINTS_PER_REAL} pontos = R$ 1,00
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <V2Field label="Pontos a trocar" htmlFor={`resg-${member.id}`} className="flex-1 min-w-[140px]">
          <V2Input id={`resg-${member.id}`} type="number" min="0" step="1"
            value={pontos} onChange={(e) => setPontos(e.target.value)} />
        </V2Field>
        <p className="pb-2 font-display text-lg font-bold text-ink">
          {previa.error ? '—' : formatPrice(previa.credit)}
        </p>
      </div>
      {previa.error && <p className="mt-1 text-xs text-amber-700">{previa.error}</p>}
      {!previa.error && previa.points < Number(pontos) && (
        <p className="mt-1 text-xs text-gray-500">
          Sobram {Number(pontos) - previa.points} pontos com o atleta — o resgate é sempre em reais inteiros.
        </p>
      )}
      <div className="mt-3 flex justify-end gap-2">
        <V2Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancelar</V2Button>
        <V2Button type="submit" size="sm" disabled={resgatar.isPending || !!previa.error}>
          {resgatar.isPending ? 'Resgatando…' : 'Resgatar'}
        </V2Button>
      </div>
    </form>
  );
}

/**
 * A mensalidade de um membro, na visão da arena.
 *
 * O botão que importa é um só: **"recebi o mês"**. O resto (valor, dia,
 * encerrar) é configuração, e configuração não pode competir em destaque com
 * a ação do dia a dia.
 */
function MensalidadeDoMembro({ arenaId, member, sub }) {
  const salvar = useSetMemberSubscription();
  const marcar = useSetSubscriptionMonthPaid();
  const encerrar = useCancelMemberSubscription();
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState(() => ({
    plan_name: sub?.plan_name || 'Mensal',
    price: sub?.price ?? 200,
    billing_day: sub?.billing_day ?? 10,
  }));
  const estado = subscriptionState(sub);
  const ativa = Boolean(sub) && estado.status !== SUBSCRIPTION_STATUS.CANCELLED;
  const mesAtual = monthKey(todayISO());

  const submit = async (e) => {
    e.preventDefault();
    try {
      await salvar.mutateAsync({
        arenaId,
        userId: member.user_id,
        input: {
          ...form,
          price: Number(form.price),
          billing_day: Number(form.billing_day),
          user_name: member.user_name,
        },
      });
      toast.success('Mensalidade salva.');
      setEditando(false);
    } catch (err) {
      toast.error(err?.message || 'Não foi possível salvar.');
    }
  };

  if (!ativa && !editando) {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-gray-200 p-3">
        <CalendarClock className="h-4 w-4 text-gray-400" />
        <span className="text-xs text-gray-500">Sem mensalidade.</span>
        <V2Button variant="ghost" size="sm" onClick={() => setEditando(true)}>
          Criar mensalidade
        </V2Button>
      </div>
    );
  }

  if (editando) {
    return (
      <form onSubmit={submit} className="mt-3 rounded-2xl border border-gray-100 bg-paper-pure p-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <V2Field label="Plano" htmlFor={`plano-${member.id}`}>
            <V2Input id={`plano-${member.id}`} required maxLength={80}
              value={form.plan_name} onChange={(e) => setForm((f) => ({ ...f, plan_name: e.target.value }))} />
          </V2Field>
          <V2Field label="Valor mensal (R$)" htmlFor={`valor-${member.id}`}>
            <V2Input id={`valor-${member.id}`} type="number" min="1" step="0.01" required
              value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} />
          </V2Field>
          <V2Field label="Vence no dia" htmlFor={`dia-${member.id}`} hint="De 1 a 28">
            <V2Input id={`dia-${member.id}`} type="number" min="1" max="28" required
              value={form.billing_day} onChange={(e) => setForm((f) => ({ ...f, billing_day: e.target.value }))} />
          </V2Field>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <V2Button type="button" variant="ghost" size="sm" onClick={() => setEditando(false)}>Cancelar</V2Button>
          <V2Button type="submit" size="sm" disabled={salvar.isPending}>Salvar</V2Button>
        </div>
      </form>
    );
  }

  const devendo = estado.status === SUBSCRIPTION_STATUS.OVERDUE;
  return (
    <div className={`mt-3 rounded-2xl border p-3 ${devendo ? 'border-amber-200 bg-amber-50' : 'border-gray-100 bg-paper-pure'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold text-ink">
            {sub.plan_name} · {formatPrice(sub.price)}/mês
          </p>
          <p className="text-xs text-gray-500">
            Vence dia {sub.billing_day}
            {devendo
              ? ` · ${estado.monthsLate} mês(es) em aberto (${formatPrice(amountDue(sub))})`
              : ' · em dia'}
          </p>
        </div>
        <V2Badge tone={devendo ? 'amber' : 'green'}>{estado.label}</V2Badge>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <V2Button
          size="sm"
          variant={estado.paidCurrent ? 'ghost' : 'primary'}
          disabled={marcar.isPending}
          onClick={() => marcar.mutateAsync({
            arenaId, userId: member.user_id, month: mesAtual, paid: !estado.paidCurrent,
          }).then(() => toast.success(estado.paidCurrent ? 'Pagamento desfeito.' : 'Pagamento registrado.'))
            .catch((e) => toast.error(e?.message || 'Não foi possível registrar.'))}
        >
          {estado.paidCurrent
            ? <><Check className="h-4 w-4" /> {mesAtual} recebido</>
            : `Recebi ${mesAtual}`}
        </V2Button>
        {estado.unpaidMonths.filter((m) => m !== mesAtual).map((m) => (
          <V2Button
            key={m} size="sm" variant="ghost" disabled={marcar.isPending}
            onClick={() => marcar.mutateAsync({ arenaId, userId: member.user_id, month: m, paid: true })
              .then(() => toast.success(`Pagamento de ${m} registrado.`))
              .catch((e) => toast.error(e?.message || 'Não foi possível registrar.'))}
          >
            Recebi {m}
          </V2Button>
        ))}
        <V2Button variant="ghost" size="sm" onClick={() => setEditando(true)}>Editar plano</V2Button>
        <ConfirmDialog
          title="Encerrar a mensalidade?"
          description="O plano para de ser cobrado. O histórico de pagamentos permanece."
          confirmLabel="Encerrar"
          destructive
          onConfirm={() => encerrar.mutateAsync({ arenaId, userId: member.user_id })
            .then(() => toast.success('Mensalidade encerrada.'))
            .catch((e) => toast.error(e?.message || 'Não foi possível encerrar.'))}
          trigger={<V2Button variant="ghost" size="sm" className="text-red-600">Encerrar</V2Button>}
        />
      </div>
    </div>
  );
}

function LinhaDoMembro({
  arenaId, member, temCarteira, temMensalidade, temPontos, sub, onRemover,
}) {
  const [ajustando, setAjustando] = useState(false);
  const [resgatando, setResgatando] = useState(false);
  const tier = computeTier(Number(member.points) || 0);
  const podeResgatar = temPontos && temCarteira
    && redeemPoints(Number(member.points) || 0, { available: Number(member.points) || 0 }).credit > 0;

  return (
    <div className="rounded-2xl border border-gray-100 bg-paper p-3">
      <div className="flex flex-wrap items-center gap-3">
        <V2Avatar name={member.user_name} photoUrl={member.user_photo} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-ink">{member.user_name || 'Atleta'}</p>
          <p className="text-xs text-gray-500">
            {Number(member.points) || 0} pontos
            {member.status && member.status !== 'active' ? ` · ${member.status}` : ''}
          </p>
        </div>
        <V2Badge tone={TIER_TONE[tier.id] || 'amber'}>{tier.name}</V2Badge>
        <V2Button variant="ghost" size="sm" onClick={() => setAjustando((v) => !v)}>
          Ajustar
        </V2Button>
        {podeResgatar && (
          <V2Button variant="ghost" size="sm" onClick={() => setResgatando((v) => !v)}>
            Resgatar pontos
          </V2Button>
        )}
        <ConfirmDialog
          title="Remover este membro?"
          description="A pessoa deixa de ter os benefícios. Pacotes já comprados e saldo em carteira NÃO são apagados."
          confirmLabel="Remover"
          destructive
          onConfirm={() => onRemover(member)}
          trigger={(
            <button type="button" aria-label="Remover membro"
              className="rounded-full border border-red-200 bg-red-50 p-1.5 text-red-600 hover:bg-red-100">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        />
      </div>
      {ajustando && (
        <AjusteDoMembro
          arenaId={arenaId} member={member} temCarteira={temCarteira}
          onClose={() => setAjustando(false)}
        />
      )}
      {resgatando && (
        <ResgateDePontos arenaId={arenaId} member={member} onClose={() => setResgatando(false)} />
      )}
      {temMensalidade && (
        <MensalidadeDoMembro arenaId={arenaId} member={member} sub={sub} />
      )}
    </div>
  );
}

/* --------------------------------- página ---------------------------------- */

export default function V2ArenaAdminMembers() {
  const { arenaId } = useParams();
  const { user, isPlatformAdmin } = useAuth();
  const { data: arena, isLoading } = useArena(arenaId);
  const { data: managed = [] } = useMyManagedArenas();
  const { isOn, isLoading: modulosLoading } = useArenaModules(arenaId);
  const { data: members = [], isLoading: carregandoMembros } = useArenaMembers(arenaId);
  const { data: packages = [], isLoading: carregandoPacotes } = useArenaPackages(arenaId, { onlyActive: false });
  const remover = useRemoveArenaMember();
  const { data: mensalidades = [] } = useArenaSubscriptions(arenaId);
  const excluirPacote = useDeletePackage();
  const [novoPacote, setNovoPacote] = useState(false);
  const [incluindo, setIncluindo] = useState(false);

  const temMembros = isOn(ARENA_MODULE_ID.MEMBERS);
  const temPacotes = isOn(ARENA_MODULE_ID.MEMBERS_PACKAGES);
  const temCarteira = isOn(ARENA_MODULE_ID.MEMBERS_WALLET);
  const temMensalidade = isOn(ARENA_MODULE_ID.MEMBERS_SUBSCRIPTION);
  const temPontos = isOn(ARENA_MODULE_ID.MARKETING_LOYALTY);
  const jaSaoMembros = useMemo(
    () => new Set(members.map((m) => m.user_id).filter(Boolean)),
    [members],
  );
  const mensalidadePorUid = useMemo(
    () => new Map(mensalidades.map((s) => [s.user_id, s])),
    [mensalidades],
  );

  if (isLoading || modulosLoading) {
    return <V2Skeleton className="mx-auto h-96 max-w-[900px] rounded-4xl" />;
  }
  if (!arena) {
    return (
      <div className="mx-auto max-w-[700px]">
        <V2Surface>
          <V2EmptyState title="Arena não encontrada"
            action={<Link to="/arenas" className="text-sm font-bold text-ink underline">← Voltar</Link>} />
        </V2Surface>
      </div>
    );
  }

  const podeGerir = arena.owner_id === user?.uid
    || managed.some((m) => m.id === arena.id)
    || isPlatformAdmin;
  if (!podeGerir) return <Navigate to={`/arenas/${arena.id}`} replace />;

  const voltar = (
    <Link to={`/arenas/${arena.id}/gerir`}
      className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-ink">
      <ArrowLeft className="h-3.5 w-3.5" /> Central da arena
    </Link>
  );

  if (!temMembros) {
    return (
      <div className="mx-auto max-w-[700px]">
        {voltar}
        <V2Surface>
          <V2EmptyState
            icon={Trophy}
            title="Membros não está ativo nesta arena"
            description="Com este módulo, quem joga sempre aqui ganha nível, desconto, pacotes de horas e carteira — e você sai da venda avulsa."
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
      <h1 className="font-display text-3xl font-bold tracking-tight text-ink">Membros</h1>
      <p className="mt-1 text-sm text-gray-500">
        {arena.name} · quem é de casa, o que cada um tem e o que cada nível dá.
      </p>

      {temPacotes && (
        <V2Surface className="mt-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-base font-bold text-ink">Pacotes de horas</h2>
            {!novoPacote && (
              <V2Button size="sm" onClick={() => setNovoPacote(true)}>
                <Plus className="h-4 w-4" /> Novo pacote
              </V2Button>
            )}
          </div>
          {novoPacote && (
            <div className="mb-3">
              <NovoPacoteForm arenaId={arena.id} onClose={() => setNovoPacote(false)} />
            </div>
          )}
          {carregandoPacotes ? (
            <V2Skeleton className="h-24" />
          ) : packages.length === 0 ? (
            <V2EmptyState
              icon={Package}
              title="Nenhum pacote ainda"
              description="Vender horas adiantado garante a frequência e o caixa. Comece por um."
            />
          ) : (
            <div className="space-y-2">
              {packages.map((pkg) => (
                <div key={pkg.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-gray-100 bg-paper p-3">
                  <div className="min-w-0">
                    <p className="font-bold text-ink">{pkg.name}</p>
                    <p className="text-xs text-gray-500">
                      {pkg.hours}h · {formatPrice(pkg.price)} · vale {pkg.validity_days} dias
                      {pkg.sold_count ? ` · ${pkg.sold_count} vendido(s)` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <V2Badge tone={pkg.active !== false ? 'green' : 'neutral'}>
                      {pkg.active !== false ? 'À venda' : 'Fora do ar'}
                    </V2Badge>
                    <ConfirmDialog
                      title="Excluir este pacote?"
                      description={`"${pkg.name}" sai da vitrine. Quem já comprou NÃO perde as horas.`}
                      confirmLabel="Excluir"
                      destructive
                      onConfirm={() => excluirPacote.mutateAsync({ pkgId: pkg.id })
                        .then(() => toast.success('Pacote excluído.'))
                        .catch((e) => toast.error(e?.message || 'Não foi possível excluir.'))}
                      trigger={(
                        <button type="button" aria-label="Excluir pacote"
                          className="rounded-full border border-red-200 bg-red-50 p-1.5 text-red-600 hover:bg-red-100">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </V2Surface>
      )}

      <V2Surface className="mt-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-base font-bold text-ink">
            Quem é membro <V2Badge tone="neutral">{members.length}</V2Badge>
          </h2>
          {!incluindo && (
            <V2Button size="sm" variant="secondary" onClick={() => setIncluindo(true)}>
              <UserPlus className="h-4 w-4" /> Incluir membro
            </V2Button>
          )}
        </div>

        {incluindo && (
          <div className="mb-3">
            <IncluirMembro
              arenaId={arena.id} jaSaoMembros={jaSaoMembros} onClose={() => setIncluindo(false)}
            />
          </div>
        )}

        {carregandoMembros ? (
          <V2Skeleton className="h-32" />
        ) : members.length === 0 ? (
          <V2EmptyState
            icon={Wallet}
            title="Nenhum membro ainda"
            description="Inclua quem já joga aqui sempre. Membro tem desconto, pacote e carteira — e volta mais."
            action={<V2Button onClick={() => setIncluindo(true)}><UserPlus className="h-4 w-4" /> Incluir o primeiro</V2Button>}
          />
        ) : (
          <div className="space-y-2">
            {members.map((m) => (
              <LinhaDoMembro
                key={m.id}
                arenaId={arena.id}
                member={m}
                temCarteira={temCarteira}
                temMensalidade={temMensalidade}
                temPontos={temPontos}
                sub={mensalidadePorUid.get(m.user_id) || null}
                onRemover={(alvo) => remover.mutateAsync({ arenaId: arena.id, userId: alvo.user_id })
                  .then(() => toast.success('Membro removido.'))
                  .catch((e) => toast.error(e?.message || 'Não foi possível remover.'))}
              />
            ))}
          </div>
        )}
      </V2Surface>
    </div>
  );
}
