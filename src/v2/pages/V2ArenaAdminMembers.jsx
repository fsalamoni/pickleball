/**
 * V2ArenaAdminMembers — a arena cuida dos seus membros.
 *
 * Onde: **Central da arena → Membros** (abas *Membros* e *Pacotes*). A rota
 * `/arenas/:arenaId/gerir/membros` virou atalho para a aba.
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
import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  CalendarClock, Check, Package, Plus, Search, Trash2,
  UserPlus, Wallet, X,
} from 'lucide-react';
import { useAthletes } from '@/modules/athletes/hooks/useAthletes';
import {
  useArenaMembers, useArenaPackages, useCreatePackage, useDeletePackage,
  useAddArenaMember, useRemoveArenaMember, useAddPointsToMember, useCreditWallet,
  useRedeemMemberPoints,
  useArenaSubscriptions, useSetMemberSubscription, useSetSubscriptionMonthPaid,
  useCancelMemberSubscription, useSellPackageToMember,
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
  V2ErrorState,
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

/**
 * O PEDIDO de pacote que chegou pelo aviso (`?pacote=&para=`).
 *
 * O atleta pede na página da arena; a arena recebe o aviso, cai aqui e, com o
 * pagamento na mão, confirma — as horas entram na carteira da pessoa na hora.
 * Descartar só limpa o endereço: nada foi gravado pelo pedido.
 */
function PedidoDePacote({ arenaId, packages, members }) {
  const [params, setParams] = useSearchParams();
  const pkgId = params.get('pacote');
  const uid = params.get('para');
  const { data: athletes = [] } = useAthletes();
  const vender = useSellPackageToMember();
  if (!pkgId || !uid) return null;

  const pkg = packages.find((p) => p.id === pkgId);
  const membro = members.find((m) => m.user_id === uid);
  const atleta = athletes.find((a) => a.id === uid);
  const nome = membro?.user_name || atleta?.platform_name || atleta?.full_name || 'Atleta';
  const foto = membro?.user_photo || atleta?.photo_url || '';
  const limpar = () => setParams((atual) => {
    const p = new URLSearchParams(atual);
    p.delete('pacote');
    p.delete('para');
    return p;
  }, { replace: true });

  if (!pkg) {
    return (
      <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        O pacote deste pedido não existe mais.{' '}
        <button type="button" className="font-bold underline" onClick={limpar}>Fechar</button>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-2xl border border-acid/60 bg-acid/10 p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-ink/70">Pedido de pacote</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <V2Avatar name={nome} photoUrl={foto} size="sm" />
        <p className="min-w-0 flex-1 text-sm text-ink">
          <strong>{nome}</strong> quer <strong>{pkg.name}</strong> — {pkg.hours}h por {formatPrice(pkg.price)}.
          {!membro && ' Ao confirmar, a pessoa vira membro.'}
        </p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <V2Button
          size="sm"
          disabled={vender.isPending}
          onClick={() => vender.mutateAsync({
            arenaId, pkgId, target: { user_id: uid, user_name: nome, user_photo: foto },
          })
            .then(() => { toast.success(`${pkg.hours}h creditadas para ${nome}.`); limpar(); })
            .catch((e) => toast.error(e?.message || 'Não foi possível creditar.'))}
        >
          <Check className="h-4 w-4" /> Recebi o pagamento — creditar
        </V2Button>
        <V2Button size="sm" variant="ghost" onClick={limpar}>Descartar</V2Button>
      </div>
    </div>
  );
}

/** Venda de balcão: a arena escolhe o pacote e credita na hora. */
function VenderPacote({ arenaId, member, packages, onClose }) {
  const aVenda = packages.filter((p) => p.active !== false);
  const [pkgId, setPkgId] = useState(aVenda[0]?.id || '');
  const vender = useSellPackageToMember();
  const pkg = aVenda.find((p) => p.id === pkgId);
  if (aVenda.length === 0) {
    return <p className="mt-2 text-xs text-gray-500">Nenhum pacote à venda — crie um na aba Pacotes de horas.</p>;
  }
  return (
    <div className="mt-2 flex flex-wrap items-end gap-2 rounded-xl bg-paper-pure p-3">
      <V2Field label="Pacote" htmlFor={`vp-${member.user_id}`} className="min-w-[200px] flex-1">
        <select id={`vp-${member.user_id}`} value={pkgId} onChange={(e) => setPkgId(e.target.value)}
          className="h-10 w-full rounded-2xl border border-gray-200 bg-paper-pure px-3 text-sm">
          {aVenda.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.hours}h · {formatPrice(p.price)}</option>)}
        </select>
      </V2Field>
      <V2Button
        size="sm"
        disabled={!pkg || vender.isPending}
        onClick={() => vender.mutateAsync({
          arenaId, pkgId, target: { user_id: member.user_id, user_name: member.user_name, user_photo: member.user_photo },
        })
          .then(() => { toast.success(`${pkg.hours}h creditadas.`); onClose(); })
          .catch((e) => toast.error(e?.message || 'Não foi possível creditar.'))}
      >
        Recebi — creditar
      </V2Button>
      <V2Button size="sm" variant="ghost" onClick={onClose}>Cancelar</V2Button>
    </div>
  );
}

function LinhaDoMembro({
  arenaId, member, temCarteira, temMensalidade, temPontos, sub, onRemover,
  pacotes = [],
}) {
  const [ajustando, setAjustando] = useState(false);
  const [vendendo, setVendendo] = useState(false);
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
        {pacotes.length > 0 && (
          <V2Button variant="ghost" size="sm" onClick={() => setVendendo((v) => !v)}>
            Vender pacote
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
      {vendendo && (
        <VenderPacote arenaId={arenaId} member={member} packages={pacotes} onClose={() => setVendendo(false)} />
      )}
      {temMensalidade && (
        <MensalidadeDoMembro arenaId={arenaId} member={member} sub={sub} />
      )}
    </div>
  );
}

/* ----------------------------- o painel (aba) ------------------------------ */

/**
 * O corpo da gestão de membros, como PAINEL — é o que vira aba na Central da
 * arena. `view` escolhe o pedaço:
 *
 * - `membros`: quem é membro, incluir, ajustar, mensalidade;
 * - `planos`: os pacotes de horas à venda.
 *
 * Quem chama já garantiu que a pessoa gere a arena e que o módulo está
 * ligado: o painel não redireciona ninguém (dentro de uma aba, redirecionar
 * tiraria a pessoa da Central no meio do caminho).
 */
export function ArenaMembersPanel({ arena, view = 'membros' }) {
  const arenaId = arena?.id;
  const { isOn } = useArenaModules(arenaId);
  const {
    data: members = [], isLoading: carregandoMembros, isError: membrosFalharam, refetch: recarregarMembros,
  } = useArenaMembers(arenaId);
  const {
    data: packages = [], isLoading: carregandoPacotes, isError: pacotesFalharam, refetch: recarregarPacotes,
  } = useArenaPackages(arenaId, { onlyActive: false });
  const remover = useRemoveArenaMember();
  const {
    data: mensalidades = [], isError: mensalidadesFalharam, refetch: recarregarMensalidades,
  } = useArenaSubscriptions(arenaId);
  const excluirPacote = useDeletePackage();
  const [novoPacote, setNovoPacote] = useState(false);
  const [incluindo, setIncluindo] = useState(false);

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

  if (!arena) return null;

  if (view === 'planos') {
    if (!temPacotes) {
      return (
        <V2Surface>
          <V2EmptyState
            icon={Package}
            title="Pacotes de horas não estão ativos"
            description="Ative “Pacotes de horas” em Configurações → Módulos para vender horas adiantado."
          />
        </V2Surface>
      );
    }
    return (
      <V2Surface>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-bold text-ink">Pacotes de horas</h2>
            <p className="text-xs text-gray-500">
              Horas vendidas adiantado. O pacote é abatido na CONFIRMAÇÃO da reserva, e o que vence primeiro sai primeiro.
            </p>
          </div>
          {/* Sem a lista, "Novo pacote" é convite a duplicar um que já está à venda. */}
          {!novoPacote && !pacotesFalharam && (
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
        ) : pacotesFalharam ? (
          <V2ErrorState
            inline
            title="Não foi possível carregar os pacotes"
            description="Tente de novo antes de criar um — ele pode já existir."
            onRetry={() => recarregarPacotes()}
          />
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
    );
  }

  return (
    <V2Surface>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-base font-bold text-ink">
            Quem é membro <V2Badge tone="neutral">{members.length}</V2Badge>
          </h2>
          <p className="text-xs text-gray-500">Nível, horas de pacote, saldo e mensalidade de cada um.</p>
        </div>
        {!incluindo && !membrosFalharam && (
          <V2Button size="sm" variant="secondary" onClick={() => setIncluindo(true)}>
            <UserPlus className="h-4 w-4" /> Incluir membro
          </V2Button>
        )}
      </div>

      {/* O pedido de pacote precisa do pacote e de saber se a pessoa já é
          membro: sem as duas listas, ele não é oferecido (a venda confere de
          novo no banco, mas a tela não pode afirmar o que não sabe). */}
      {temPacotes && !pacotesFalharam && !membrosFalharam && (
        <PedidoDePacote arenaId={arena.id} packages={packages} members={members} />
      )}

      {temMensalidade && mensalidadesFalharam && !membrosFalharam && (
        <V2ErrorState
          inline
          className="mb-3"
          title="Não foi possível carregar as mensalidades"
          description="Os membros aparecem sem o plano até carregar."
          onRetry={() => recarregarMensalidades()}
        />
      )}

      {incluindo && (
        <div className="mb-3">
          <IncluirMembro
            arenaId={arena.id} jaSaoMembros={jaSaoMembros} onClose={() => setIncluindo(false)}
          />
        </div>
      )}

      {carregandoMembros ? (
        <V2Skeleton className="h-32" />
      ) : membrosFalharam ? (
        <V2ErrorState
          inline
          title="Não foi possível carregar os membros"
          description="A arena não perdeu ninguém — a lista só não chegou. Tente de novo."
          onRetry={() => recarregarMembros()}
        />
      ) : members.length === 0 ? (
        <V2EmptyState
          icon={Wallet}
          title="Nenhum membro ainda"
          description="Inclua quem já joga aqui sempre — a aba Clientes mostra quem mais reserva. Membro tem desconto, pacote e carteira, e volta mais."
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
              // Sem as mensalidades na mão, o plano de cada um é desconhecido —
              // não "sem plano", que ofereceria criar um por cima do que existe.
              temMensalidade={temMensalidade && !mensalidadesFalharam}
              temPontos={temPontos}
              sub={mensalidadePorUid.get(m.user_id) || null}
              pacotes={temPacotes && !pacotesFalharam ? packages : []}
              onRemover={(alvo) => remover.mutateAsync({ arenaId: arena.id, userId: alvo.user_id })
                .then(() => toast.success('Membro removido.'))
                .catch((e) => toast.error(e?.message || 'Não foi possível remover.'))}
            />
          ))}
        </div>
      )}
    </V2Surface>
  );
}

/* --------------------------------- página ---------------------------------- */

/**
 * A rota antiga `/arenas/:id/gerir/membros` virou atalho para a aba da
 * Central. Ela continua existindo porque notificações antigas e o catálogo
 * apontam para cá — e um link antigo que abre a aba certa é melhor que uma
 * segunda tela com o mesmo conteúdo.
 */
export default function V2ArenaAdminMembers() {
  const { arenaId } = useParams();
  return <Navigate to={`/arenas/${arenaId}/gerir?aba=membros`} replace />;
}
