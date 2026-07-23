/**
 * V2ArenaMembers — Pacotes + Wallet do atleta na arena.
 *
 * Rota: /arenas/:arenaId/membros
 *
 * Mostra:
 * - Pacotes disponíveis para compra
 * - Meus pacotes ativos
 * - Meu wallet (saldo, pontos, histórico)
 * - Meu tier
 *
 * Gate: arena habilitou `members_packages` ou `members_wallet`.
 *
 * Aditivo.
 */

import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Package, Star, Wallet, Trophy, ShoppingCart } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useArena } from '@/modules/arenas/hooks/useArenas';
import {
  useCanArenaUseModule, useArenaPackages, usePurchasePackage,
  useArenaWallet, useArenaMember,
} from '@/modules/arenas/hooks/useArenaV3';
import { computeTier, calculateCashbackPct } from '@/modules/arenas/domain/members';
import { V2Badge, V2Button, V2EmptyState, V2Skeleton, V2Surface } from '@/v2/ui/primitives';

function TierBadge({ points }) {
  const tier = computeTier(points);
  const colors = {
    bronze: 'bg-amber-100 text-amber-800 border-amber-200',
    silver: 'bg-gray-100 text-gray-700 border-gray-200',
    gold: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    platinum: 'bg-violet-100 text-violet-800 border-violet-200',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${colors[tier.id] || colors.bronze}`}>
      <Trophy className="h-3 w-3" /> {tier.name} · {points || 0} pts
    </span>
  );
}

function PackageCard({ pkg, onPurchase, isPurchasing }) {
  const pricePerHour = pkg.price / pkg.hours;
  return (
    <div className="rounded-2xl border border-gray-100 bg-paper-pure p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-base font-bold text-ink">{pkg.name}</h3>
          {pkg.description && <p className="mt-1 text-xs text-gray-500">{pkg.description}</p>}
        </div>
        <V2Badge tone="amber">{pkg.hours}h</V2Badge>
      </div>
      <div className="mt-4 flex items-end gap-2">
        <span className="font-display text-2xl font-bold text-ink">R$ {pkg.price.toFixed(2)}</span>
        <span className="text-xs text-gray-500">R$ {pricePerHour.toFixed(2)}/h</span>
      </div>
      <p className="mt-1 text-xs text-gray-500">Válido por {pkg.validity_days} dias</p>
      <V2Button
        size="sm" className="mt-4 w-full"
        onClick={() => onPurchase(pkg)}
        disabled={isPurchasing}
      >
        <ShoppingCart className="mr-1.5 h-4 w-4" /> {isPurchasing ? 'Comprando...' : 'Comprar'}
      </V2Button>
    </div>
  );
}

export default function V2ArenaMembers() {
  const { arenaId } = useParams();
  const { user } = useAuth();
  const { data: arena, isLoading: arenaLoading } = useArena(arenaId);
  const canPackages = useCanArenaUseModule(arenaId, 'members_packages');
  const canWallet = useCanArenaUseModule(arenaId, 'members_wallet');
  const canTiers = useCanArenaUseModule(arenaId, 'members_tiers');
  const { data: packages = [], isLoading: packagesLoading } = useArenaPackages(arenaId);
  const { data: wallet } = useArenaWallet(arenaId, user?.uid);
  const { data: member } = useArenaMember(arenaId, user?.uid);
  const purchase = usePurchasePackage();

  if (!user) {
    return (
      <div className="mx-auto max-w-[500px]">
        <V2Surface>
          <V2EmptyState
            title="Faça login"
            description="Você precisa estar logado para acessar esta área."
            action={<V2Button asChild><Link to="/login">Entrar</Link></V2Button>}
          />
        </V2Surface>
      </div>
    );
  }

  if (arenaLoading) return <V2Skeleton className="mx-auto h-96 max-w-[1100px] rounded-4xl" />;
  if (!arena) {
    return (
      <div className="mx-auto max-w-[700px]">
        <V2Surface>
          <V2EmptyState title="Arena não encontrada" action={<Link to="/arenas" className="text-sm font-bold text-ink underline">← Voltar</Link>} />
        </V2Surface>
      </div>
    );
  }

  if (!canPackages && !canWallet && !canTiers) {
    return (
      <div className="mx-auto max-w-[700px]">
        <div className="mb-4">
          <Link to={`/arenas/${arena.id}`} className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-ink">
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar
          </Link>
        </div>
        <V2Surface>
          <V2EmptyState
            icon={Package}
            title="Programa de membros indisponível"
            description="Esta arena não ativou o programa de membros."
          />
        </V2Surface>
      </div>
    );
  }

  const handlePurchase = async (pkg) => {
    try {
      await purchase.mutateAsync({ arenaId: arena.id, pkgId: pkg.id });
      toast.success(`${pkg.name} adquirido! Suas ${pkg.hours}h já estão no seu wallet.`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="mb-6">
        <Link to={`/arenas/${arena.id}`} className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar à arena
        </Link>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
          Membros · {arena.name}
        </h1>
        <p className="mt-2 font-medium text-gray-500">
          Compre pacotes, acumule pontos e suba de tier.
        </p>
      </div>

      {/* Tier + Wallet */}
      {(canTiers || canWallet) && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          {canTiers && (
            <V2Surface>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                  <Trophy className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Seu tier</p>
                  <TierBadge points={member?.points || 0} />
                </div>
              </div>
              {member && (
                <p className="mt-3 text-xs text-gray-500">
                  Membro desde {member.joined_at?.toDate?.()?.toLocaleDateString('pt-BR') || 'recente'}.
                </p>
              )}
            </V2Surface>
          )}
          {canWallet && wallet && (
            <V2Surface>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-100 text-green-700">
                  <Wallet className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Seu saldo</p>
                  <p className="font-display text-2xl font-bold text-ink">R$ {(wallet.balance || 0).toFixed(2)}</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-gray-500">
                Total gasto: R$ {(wallet.total_spent || 0).toFixed(2)} · Cashback: {calculateCashbackPct(wallet.total_spent || 0)}%
              </p>
            </V2Surface>
          )}
        </div>
      )}

      {/* Meus pacotes ativos */}
      {canPackages && wallet?.packages?.length > 0 && (
        <V2Surface className="mb-6">
          <h2 className="mb-3 font-display text-lg font-bold text-ink">Meus pacotes ativos</h2>
          <div className="space-y-2">
            {wallet.packages.map((p, idx) => {
              const remaining = (p.total_hours || 0) - (p.used_hours || 0);
              const expiresAt = p.expires_at?.toDate?.() || new Date(p.expires_at);
              const daysLeft = Math.max(0, Math.ceil((expiresAt - Date.now()) / 86_400_000));
              return (
                <div key={idx} className="flex items-center justify-between rounded-2xl border border-gray-100 bg-paper p-3">
                  <div>
                    <p className="font-bold text-ink">{p.pkg_name}</p>
                    <p className="text-xs text-gray-500">{remaining}h restantes · {daysLeft} dia(s)</p>
                  </div>
                  <V2Badge tone={remaining > 0 ? 'green' : 'red'}>
                    {remaining}h / {p.total_hours}h
                  </V2Badge>
                </div>
              );
            })}
          </div>
        </V2Surface>
      )}

      {/* Pacotes disponíveis */}
      {canPackages && (
        <V2Surface>
          <h2 className="mb-4 font-display text-lg font-bold text-ink">Pacotes disponíveis</h2>
          {packagesLoading ? (
            <V2Skeleton className="h-40 rounded-2xl" />
          ) : packages.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">A arena ainda não publicou pacotes.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {packages.map((pkg) => (
                <PackageCard
                  key={pkg.id}
                  pkg={pkg}
                  onPurchase={handlePurchase}
                  isPurchasing={purchase.isPending}
                />
              ))}
            </div>
          )}
        </V2Surface>
      )}
    </div>
  );
}
