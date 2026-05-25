import { useEffect } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { Hash, ShieldCheck, Trophy, Users } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { usePool, useMyMembership } from '@/modules/pool/hooks/usePools';
import { ensureOwnerMembership } from '@/modules/pool/services/poolsService';
import { logger } from '@/core/lib/logger';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { BettingCard } from '@/modules/pool/components/BettingCard';
import { PoolLeaderboard } from '@/modules/pool/components/PoolLeaderboard';
import { PoolRulesTab } from '@/modules/pool/components/PoolRulesTab';
import { PoolDashboardTab } from '@/modules/pool/components/PoolDashboardTab';
import { PoolAdminTab } from '@/modules/pool/components/PoolAdminTab';
import { PoolMatchesTab } from '@/modules/pool/components/PoolMatchesTab';
import { PoolCalendarTab } from '@/modules/pool/components/PoolCalendarTab';
import { PoolScoringTab } from '@/modules/pool/components/PoolScoringTab';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function Pool() {
  const { poolId, tab } = useParams();
  const navigate = useNavigate();
  const { user, isPlatformAdmin } = useAuth();
  const { pool, isLoading } = usePool(poolId);
  const { membership, isLoading: memLoading } = useMyMembership(poolId);

  const activeTab = tab || 'dashboard';
  const setTab = (t) => navigate(`/boloes/${poolId}/${t}`);

  useEffect(() => {
    if (!user || !pool || membership || memLoading || pool.owner_user_id !== user.uid) return;
    ensureOwnerMembership(pool.id, user).catch((e) => logger.error('ensureOwnerMembership error:', e));
  }, [user, pool, membership, memLoading]);

  if (isLoading || memLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-3">
        <Skeleton className="h-12" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (!pool) return <Navigate to="/boloes" replace />;
  if (!membership && pool.owner_user_id !== user?.uid && !isPlatformAdmin) {
    return <Navigate to="/boloes/ingressar" replace />;
  }

  const isAdmin = isPlatformAdmin || pool.owner_user_id === user?.uid || membership?.role === 'owner' || membership?.role === 'admin';
  const hasConfirmedPayment = isAdmin
    || Number(pool.entry_fee || 0) <= 0
    || membership?.payment_status === 'confirmed';

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <header className="arena-panel-strong rounded-lg p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-amber-300 text-slate-950">
              <Trophy className="h-5 w-5" />
            </div>
            <div className="min-w-0 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-200">Bolão ativo</p>
              <h1 className="truncate text-2xl font-bold text-white sm:text-3xl">{pool.name}</h1>
              {pool.description && <p className="max-w-3xl text-sm leading-6 text-emerald-50/85">{pool.description}</p>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-emerald-50/85">
            <span className="inline-flex h-8 items-center gap-1 rounded-md border border-emerald-300/20 bg-white/10 px-2 font-medium">
              <Users className="h-3.5 w-3.5" /> {pool.stats?.members_count || 1} participantes
            </span>
            <span className="inline-flex h-8 items-center gap-1 rounded-md border border-emerald-300/20 bg-white/10 px-2 font-mono font-medium">
              <Hash className="h-3.5 w-3.5" /> {pool.invite_code}
            </span>
            {isAdmin && (
              <span className="inline-flex h-8 items-center gap-1 rounded-md border border-amber-300/30 bg-amber-300/15 px-2 font-medium text-amber-100">
                <ShieldCheck className="h-3.5 w-3.5" /> Admin
              </span>
            )}
          </div>
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={setTab}>
        <TabsList className="flex h-auto flex-wrap border border-emerald-950/10 bg-white/70 p-1 shadow-sm shadow-emerald-950/5">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="calendario">Calendário</TabsTrigger>
          <TabsTrigger value="jogos">Jogos</TabsTrigger>
          <TabsTrigger value="cartao">Cartão de palpites</TabsTrigger>
          <TabsTrigger value="pontuacao">Pontuação</TabsTrigger>
          <TabsTrigger value="ranking">Ranking</TabsTrigger>
          <TabsTrigger value="regras">Regras</TabsTrigger>
          {isAdmin && <TabsTrigger value="admin">Admin</TabsTrigger>}
        </TabsList>

        <TabsContent value="dashboard" className="mt-4">
          <PoolDashboardTab poolId={poolId} pool={pool} />
        </TabsContent>
        <TabsContent value="calendario" className="mt-4">
          <PoolCalendarTab pool={pool} />
        </TabsContent>
        <TabsContent value="jogos" className="mt-4">
          <PoolMatchesTab pool={pool} />
        </TabsContent>
        <TabsContent value="cartao" className="mt-4">
          {hasConfirmedPayment ? <BettingCard poolId={poolId} pool={pool} /> : <PaymentRequiredCard />}
        </TabsContent>
        <TabsContent value="pontuacao" className="mt-4">
          {hasConfirmedPayment ? <PoolScoringTab poolId={poolId} pool={pool} /> : <PaymentRequiredCard />}
        </TabsContent>
        <TabsContent value="ranking" className="mt-4">
          {hasConfirmedPayment ? <PoolLeaderboard poolId={poolId} pool={pool} /> : <PaymentRequiredCard />}
        </TabsContent>
        <TabsContent value="regras" className="mt-4">
          <PoolRulesTab pool={pool} />
        </TabsContent>
        {isAdmin && (
          <TabsContent value="admin" className="mt-4">
            <PoolAdminTab pool={pool} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function PaymentRequiredCard() {
  return (
    <Card className="overflow-hidden border-amber-300/70 bg-amber-50/90">
      <CardHeader>
        <CardTitle className="text-amber-900">Participação pendente</CardTitle>
        <CardDescription className="text-amber-800">
          Informe o pagamento no Dashboard e aguarde a confirmação do admin do bolão.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-amber-900">
        Até a confirmação, você pode visualizar o bolão, mas não pode registrar palpites, editar informações de participação nem entrar no ranking.
      </CardContent>
    </Card>
  );
}
