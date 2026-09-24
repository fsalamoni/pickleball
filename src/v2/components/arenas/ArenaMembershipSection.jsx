/**
 * "Planos e vantagens" — os membros da arena, DENTRO da página da arena.
 *
 * Módulo: `members` (+ `members_tiers`, `members_packages`, `members_wallet`,
 * `members_subscription`).
 *
 * ## Por que uma seção, e não mais um botão
 *
 * Antes, o programa de membros era um botão no topo que levava a outra
 * página — e quem não sabia que existia não clicava. Pacote de horas é uma
 * decisão de compra que se toma OLHANDO o preço da hora avulsa, ali na página
 * da arena; escondido atrás de um botão, ele concorre com nada e perde.
 *
 * A seção responde à pergunta de cada pessoa:
 *
 * - **membro**: "o que eu tenho aqui?" — nível, horas que restam, saldo e a
 *   mensalidade, numa linha;
 * - **quem não é**: "o que eu ganho?" — os pacotes à venda, com a compra ali
 *   mesmo.
 *
 * O detalhe (extrato, pontos, indicação) continua em "Ver meu plano".
 * Módulo desligado = a seção não existe.
 */
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ChevronRight, Crown } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useArenaModules } from '@/modules/arenas/hooks/useArenaModules';
import {
  useArenaMember, useArenaWallet, useArenaPackages, useMemberSubscription, useRequestPackage,
} from '@/modules/arenas/hooks/useArenaV3';
import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';
import { tierProgress, usableHours } from '@/modules/arenas/domain/memberBenefit';
import { SUBSCRIPTION_STATUS, subscriptionState } from '@/modules/arenas/domain/subscription';
import { formatPrice } from '@/modules/arenas/domain/pricing';
import { V2Badge, V2Surface } from '@/v2/ui/primitives';
import PackageForSaleCard from '@/v2/components/arenas/PackageForSaleCard';

const TIER_TONE = { bronze: 'amber', silver: 'neutral', gold: 'acid', platinum: 'ink' };
/** Na página da arena cabem poucos: o resto está em "Ver todos". */
const PACOTES_NA_PAGINA = 2;

export default function ArenaMembershipSection({ arena }) {
  const arenaId = arena?.id;
  const { user } = useAuth();
  const { isOn } = useArenaModules(arenaId);
  const ligado = isOn(ARENA_MODULE_ID.MEMBERS);
  const uid = ligado ? user?.uid : null;
  const { data: member } = useArenaMember(ligado ? arenaId : null, uid);
  const { data: wallet } = useArenaWallet(ligado ? arenaId : null, uid);
  const temPacotes = ligado && isOn(ARENA_MODULE_ID.MEMBERS_PACKAGES);
  const { data: catalogo = [] } = useArenaPackages(temPacotes ? arenaId : null);
  const temMensalidade = ligado && isOn(ARENA_MODULE_ID.MEMBERS_SUBSCRIPTION);
  const { data: mensalidade } = useMemberSubscription(temMensalidade ? arenaId : null, uid);
  const comprar = useRequestPackage();

  const horas = useMemo(() => (Array.isArray(wallet?.packages) ? wallet.packages : [])
    .reduce((s, p) => s + usableHours(p), 0), [wallet]);

  if (!ligado || !arena) return null;

  const temNiveis = isOn(ARENA_MODULE_ID.MEMBERS_TIERS);
  const temCarteira = isOn(ARENA_MODULE_ID.MEMBERS_WALLET);
  const nivel = member && temNiveis ? tierProgress(member).current : null;
  const saldo = Number(wallet?.balance) || 0;
  const estadoMensal = temMensalidade && mensalidade ? subscriptionState(mensalidade) : null;
  const vitrine = catalogo.slice(0, PACOTES_NA_PAGINA);

  // Nada para mostrar: não é membro e a arena não vende pacote. Uma caixa
  // dizendo "fale com a arena" no meio da página não ajuda ninguém.
  if (!member && vitrine.length === 0) return null;

  const aoComprar = (pkg) => comprar.mutateAsync({ arenaId, pkgId: pkg.id })
    .then(() => toast.success('Pedido enviado à arena. As horas entram na sua carteira assim que ela confirmar o pagamento.'))
    .catch((e) => toast.error(e?.message || 'Não foi possível enviar o pedido.'));

  return (
    <V2Surface>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink">
          <Crown className="h-5 w-5 text-acid-dark" /> Planos e vantagens
        </h2>
        <Link to={`/arenas/${arenaId}/membros`} className="inline-flex items-center gap-1 text-xs font-bold text-ink hover:underline">
          {member ? 'Ver meu plano' : 'Ver todos'} <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {member && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl bg-paper px-4 py-3 text-sm text-ink">
          <span className="font-semibold">Você é membro</span>
          {nivel && <V2Badge tone={TIER_TONE[nivel.id] || 'amber'}>{nivel.name}</V2Badge>}
          {nivel?.discount_pct > 0 && <span className="text-xs text-gray-600">{nivel.discount_pct}% de desconto na reserva</span>}
          {temPacotes && horas > 0 && <span className="text-xs text-gray-600">· {horas}h de pacote</span>}
          {temCarteira && saldo > 0 && <span className="text-xs text-gray-600">· {formatPrice(saldo)} de saldo</span>}
          {estadoMensal?.status === SUBSCRIPTION_STATUS.OVERDUE && <V2Badge tone="red">Mensalidade em atraso</V2Badge>}
        </div>
      )}

      {vitrine.length > 0 && (
        <>
          <p className="mb-3 text-xs text-gray-500">
            Horas compradas adiantado saem mais baratas e são abatidas sozinhas quando a arena confirma a
            reserva. Você pede aqui; a arena credita quando receber o pagamento.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {vitrine.map((p) => (
              <PackageForSaleCard key={p.id} pkg={p} onComprar={aoComprar} ocupado={comprar.isPending} />
            ))}
          </div>
        </>
      )}
    </V2Surface>
  );
}
