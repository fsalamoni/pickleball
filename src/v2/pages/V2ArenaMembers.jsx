/**
 * V2ArenaMembers — a minha relação com ESTA arena.
 *
 * Rota: `/arenas/:arenaId/membros`
 * Módulos: `members` (+ `members_tiers`, `members_packages`, `members_wallet`).
 *
 * A tela responde três perguntas, nesta ordem — que é a ordem em que elas
 * importam para quem joga:
 *
 *   1. **O que eu sou aqui?** nível, pontos e quanto falta para o próximo.
 *   2. **O que eu tenho aqui?** horas de pacote e saldo em carteira, com
 *      validade — um pacote que vence sem aviso é dinheiro perdido.
 *   3. **O que isso me dá?** o desconto e as vantagens, escritos. Antes o
 *      nível era um selo bonito que não dizia para que servia.
 *
 * Cada bloco é gatilhado pelo SEU módulo: a arena pode ter membros sem
 * carteira, ou pacotes sem níveis.
 */

import React, { useMemo } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  AlertTriangle, ArrowLeft, CalendarClock, Check, Clock, Gift, Package,
  Sparkles, Trophy, Wallet,
} from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useArena } from '@/modules/arenas/hooks/useArenas';
import {
  useArenaPackages, usePurchasePackage, useArenaWallet, useArenaMember,
  useMemberSubscription,
} from '@/modules/arenas/hooks/useArenaV3';
import { useArenaModules } from '@/modules/arenas/hooks/useArenaModules';
import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';
import { tierProgress, usableHours } from '@/modules/arenas/domain/memberBenefit';
import {
  SUBSCRIPTION_STATUS, amountDue, subscriptionState,
} from '@/modules/arenas/domain/subscription';
import { formatPrice } from '@/modules/arenas/domain/pricing';
import { formatDateShortBR } from '@/modules/arenas/domain/calendar';
import { V2Badge, V2Button, V2EmptyState, V2Skeleton, V2Surface } from '@/v2/ui/primitives';

const TIER_CLASS = {
  bronze: 'bg-amber-100 text-amber-800 border-amber-200',
  silver: 'bg-gray-100 text-gray-700 border-gray-200',
  gold: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  platinum: 'bg-violet-100 text-violet-800 border-violet-200',
};

/** `Timestamp | Date | number` → 'YYYY-MM-DD', para as funções de data. */
function toISO(value) {
  if (!value) return null;
  const ms = value?.toMillis ? value.toMillis()
    : value instanceof Date ? value.getTime()
      : value?.seconds ? value.seconds * 1000
        : Number(value);
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/* ------------------------------- 1. quem sou ------------------------------- */

function MeuNivel({ member }) {
  const { current, next, missing, progress } = tierProgress(member);
  const pontos = Number(member?.points) || 0;

  return (
    <V2Surface>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Seu nível aqui</p>
          <div className="mt-1.5 flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-bold ${TIER_CLASS[current?.id] || TIER_CLASS.bronze}`}>
              <Trophy className="h-3.5 w-3.5" /> {current?.name || 'Bronze'}
            </span>
            <span className="text-sm text-gray-500">{pontos} pontos</span>
          </div>
        </div>
        {Number(current?.discount_pct) > 0 && (
          <V2Badge tone="green">{current.discount_pct}% de desconto nas reservas</V2Badge>
        )}
      </div>

      {next && (
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-xs text-gray-500">
            <span>Faltam <strong className="text-ink">{missing}</strong> pontos para {next.name}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full bg-acid" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {(current?.perks || []).length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {current.perks.map((p) => (
            <li key={p} className="flex items-center gap-2 text-sm text-gray-600">
              <Check className="h-3.5 w-3.5 shrink-0 text-green-600" /> {p}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 rounded-2xl bg-paper p-3 text-xs leading-5 text-gray-500">
        Você ganha pontos a cada reserva concluída — pelo valor e pelas horas jogadas.
        Usar pacote também pontua.
      </p>
    </V2Surface>
  );
}

/* ----------------------------- 2. o que eu tenho --------------------------- */

function MeusPacotes({ packages }) {
  const uteis = useMemo(
    () => packages
      .map((p) => ({ ...p, restam: usableHours(p) }))
      .filter((p) => p.restam > 0)
      .sort((a, b) => {
        const va = toISO(a.expires_at) || '9999';
        const vb = toISO(b.expires_at) || '9999';
        return va.localeCompare(vb);
      }),
    [packages],
  );
  const total = uteis.reduce((a, p) => a + p.restam, 0);

  if (uteis.length === 0) return null;

  return (
    <V2Surface>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-display text-base font-bold text-ink">Suas horas</h2>
        <V2Badge tone="green">{total}h disponíveis</V2Badge>
      </div>
      <div className="space-y-2">
        {uteis.map((p, i) => {
          const venceEm = toISO(p.expires_at);
          return (
            <div key={`${p.pkg_id}-${i}`} className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-paper p-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-ink">{p.pkg_name || 'Pacote'}</p>
                <p className="text-xs text-gray-500">
                  {venceEm
                    ? <>Vence em {formatDateShortBR(venceEm)}</>
                    : 'Sem prazo de validade'}
                  {i === 0 && uteis.length > 1 && ' · é o primeiro a ser usado'}
                </p>
              </div>
              <V2Badge tone="neutral">{p.restam}h</V2Badge>
            </div>
          );
        })}
      </div>
      <p className="mt-3 flex gap-1.5 text-xs leading-5 text-gray-500">
        <Clock className="mt-px h-3.5 w-3.5 shrink-0" />
        As horas são abatidas quando a arena confirma a reserva — e sempre do
        pacote que vence primeiro.
      </p>
    </V2Surface>
  );
}

function MinhaCarteira({ wallet }) {
  const saldo = Number(wallet?.balance) || 0;
  const lancamentos = [...(wallet?.transactions || [])].reverse().slice(0, 12);

  return (
    <V2Surface>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-display text-base font-bold text-ink">Sua carteira</h2>
        <span className="font-display text-2xl font-bold text-ink">{formatPrice(saldo)}</span>
      </div>
      {lancamentos.length === 0 ? (
        <p className="text-sm text-gray-500">
          Sem lançamentos ainda. O saldo aparece aqui quando a arena credita algo
          (cashback, estorno ou cortesia).
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {lancamentos.map((t, i) => {
            const credito = t.type === 'credit' || t.type === 'cashback';
            const rotulo = t.type === 'package_use'
              ? `${t.hours}h de pacote`
              : formatPrice(Number(t.amount) || 0);
            return (
              <li key={i} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="min-w-0 truncate text-gray-600">{t.source || 'Lançamento'}</span>
                <span className={credito ? 'font-bold text-green-700' : 'font-bold text-gray-700'}>
                  {credito ? '+' : '−'} {rotulo}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </V2Surface>
  );
}

function MinhaMensalidade({ sub }) {
  const estado = subscriptionState(sub);
  const devendo = estado.status === SUBSCRIPTION_STATUS.OVERDUE;
  const encerrada = estado.status === SUBSCRIPTION_STATUS.CANCELLED;
  const devido = amountDue(sub);

  if (!sub || encerrada) return null;

  return (
    <V2Surface className={devendo ? 'border-amber-200 bg-amber-50' : undefined}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Sua mensalidade</p>
          <p className="mt-1 font-display text-base font-bold text-ink">{sub.plan_name}</p>
          <p className="text-sm text-gray-600">
            {formatPrice(sub.price)} por mês · vence todo dia {sub.billing_day}
          </p>
        </div>
        <V2Badge tone={devendo ? 'amber' : 'green'}>{estado.label}</V2Badge>
      </div>

      {devendo ? (
        <p className="mt-3 flex gap-1.5 text-sm leading-6 text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {estado.monthsLate === 1
              ? 'Há 1 mês em aberto'
              : `Há ${estado.monthsLate} meses em aberto`}
            {' '}({estado.unpaidMonths.join(', ')}) — <strong>{formatPrice(devido)}</strong>.
            Combine o pagamento com a arena; ela registra aqui assim que cair.
          </span>
        </p>
      ) : (
        <p className="mt-3 flex gap-1.5 text-sm text-gray-600">
          <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" />
          Tudo em dia. O próximo vencimento é {formatDateShortBR(estado.dueDate)}.
        </p>
      )}
    </V2Surface>
  );
}

/* ------------------------------ 3. comprar --------------------------------- */

function PacoteAVenda({ pkg, onComprar, ocupado }) {
  const porHora = pkg.hours > 0 ? pkg.price / pkg.hours : 0;
  return (
    <div className="flex h-full flex-col rounded-2xl border border-gray-100 bg-paper-pure p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-display text-base font-bold text-ink">{pkg.name}</h3>
          {pkg.description && <p className="mt-1 text-xs leading-5 text-gray-500">{pkg.description}</p>}
        </div>
        <V2Badge tone="amber">{pkg.hours}h</V2Badge>
      </div>
      <div className="mt-4 flex items-end gap-2">
        <span className="font-display text-2xl font-bold text-ink">{formatPrice(pkg.price)}</span>
        <span className="pb-1 text-xs text-gray-500">{formatPrice(porHora)}/h</span>
      </div>
      <p className="mt-1 text-xs text-gray-500">Vale por {pkg.validity_days} dias após a compra</p>
      <div className="mt-auto pt-4">
        <V2Button size="sm" className="w-full" disabled={ocupado} onClick={() => onComprar(pkg)}>
          Quero este pacote
        </V2Button>
      </div>
    </div>
  );
}

/* --------------------------------- página ---------------------------------- */

export default function V2ArenaMembers() {
  const { arenaId } = useParams();
  const { user, isAuthenticated } = useAuth();
  const { data: arena, isLoading } = useArena(arenaId);
  const { isOn, isLoading: modulosLoading } = useArenaModules(arenaId);
  const { data: member } = useArenaMember(arenaId, user?.uid);
  const { data: wallet } = useArenaWallet(arenaId, user?.uid);
  const { data: catalogo = [], isError, refetch } = useArenaPackages(arenaId);
  const { data: mensalidade } = useMemberSubscription(arenaId, user?.uid);
  const comprar = usePurchasePackage();

  const temMembros = isOn(ARENA_MODULE_ID.MEMBERS);
  const temNiveis = isOn(ARENA_MODULE_ID.MEMBERS_TIERS);
  const temPacotes = isOn(ARENA_MODULE_ID.MEMBERS_PACKAGES);
  const temCarteira = isOn(ARENA_MODULE_ID.MEMBERS_WALLET);
  const temMensalidade = isOn(ARENA_MODULE_ID.MEMBERS_SUBSCRIPTION);

  if (isLoading || modulosLoading) {
    return <V2Skeleton className="mx-auto h-96 max-w-[820px] rounded-4xl" />;
  }
  if (!arena) return <Navigate to="/arenas" replace />;
  if (!temMembros) return <Navigate to={`/arenas/${arena.id}`} replace />;

  const aoComprar = (pkg) => comprar.mutateAsync({ arenaId: arena.id, pkgId: pkg.id })
    .then(() => toast.success('Pacote reservado! Combine o pagamento com a arena.'))
    .catch((e) => toast.error(e?.message || 'Não foi possível comprar.'));

  const meusPacotes = Array.isArray(wallet?.packages) ? wallet.packages : [];

  return (
    <div className="mx-auto max-w-[820px]">
      <Link
        to={`/arenas/${arena.id}`}
        className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> {arena.name}
      </Link>
      <h1 className="font-display text-3xl font-bold tracking-tight text-ink">Você nesta arena</h1>
      <p className="mt-1 text-sm text-gray-500">
        Seu nível, suas horas e seu saldo na {arena.name}.
      </p>

      {!isAuthenticated ? (
        <V2Surface className="mt-5">
          <V2EmptyState
            icon={Sparkles}
            title="Entre para ver a sua relação com esta arena"
            description="Nível, pontos, horas de pacote e saldo aparecem depois do login."
            action={<V2Button asChild><Link to="/entrar">Entrar</Link></V2Button>}
          />
        </V2Surface>
      ) : (
        <div className="mt-5 space-y-4">
          {temNiveis && <MeuNivel member={member} />}

          {!member && (
            <V2Surface className="border-amber-200 bg-amber-50">
              <p className="flex gap-2 text-sm text-amber-900">
                <Gift className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Você ainda não é membro da {arena.name}. Fale com a arena para entrar —
                  membros têm desconto, pacotes de horas e prioridade.
                </span>
              </p>
            </V2Surface>
          )}

          {temMensalidade && <MinhaMensalidade sub={mensalidade} />}
          {temPacotes && <MeusPacotes packages={meusPacotes} />}
          {temCarteira && <MinhaCarteira wallet={wallet} />}

          {temPacotes && (
            <V2Surface>
              <h2 className="mb-1 font-display text-base font-bold text-ink">Pacotes de horas</h2>
              <p className="mb-4 text-xs text-gray-500">
                Comprando adiantado sai mais barato — e as horas são abatidas
                automaticamente na reserva.
              </p>
              {isError ? (
                <p className="text-sm text-red-700">
                  Não foi possível carregar os pacotes.{' '}
                  <button type="button" className="font-bold underline" onClick={() => refetch()}>
                    Tentar de novo
                  </button>
                </p>
              ) : catalogo.length === 0 ? (
                <V2EmptyState
                  icon={Package}
                  title="Esta arena ainda não vende pacotes"
                  description="Quando ela publicar, os pacotes aparecem aqui."
                />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {catalogo.map((p) => (
                    <PacoteAVenda
                      key={p.id} pkg={p} onComprar={aoComprar} ocupado={comprar.isPending}
                    />
                  ))}
                </div>
              )}
            </V2Surface>
          )}

          {!temPacotes && !temCarteira && !temNiveis && !temMensalidade && (
            <V2Surface>
              <V2EmptyState
                icon={Wallet}
                title="Nada por aqui ainda"
                description="Esta arena ativou os membros, mas ainda não ligou níveis, pacotes ou carteira."
              />
            </V2Surface>
          )}
        </div>
      )}
    </div>
  );
}
