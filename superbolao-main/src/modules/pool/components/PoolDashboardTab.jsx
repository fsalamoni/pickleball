import { useState } from 'react';
import { toast } from 'sonner';
import { Trophy, Lock, QrCode, CreditCard } from 'lucide-react';
import { useMyMembership, usePoolLeaderboard } from '@/modules/pool/hooks/usePools';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { reportPayment } from '@/modules/pool/services/poolsService';
import { useTournamentStaticData } from '@/modules/tournament/hooks/useTournament';
import {
  isConfirmedForRanking,
  normalizePaymentStatus,
  participationPaymentStatusLabel,
} from '@/modules/pool/domain/paymentStatus';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DeadlineBadge } from './DeadlineBadge';
import { compareForGeneralRanking } from '@/core/domain/scoringEngine';
import { applyPoolDeadlineOverrides } from '@/modules/pool/domain/poolSettings';

export function PoolDashboardTab({ poolId, pool }) {
  const { user } = useAuth();
  const { membership } = useMyMembership(poolId);
  const { memberships } = usePoolLeaderboard(poolId);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const { stages: rawStages } = useTournamentStaticData(pool?.tournament_id);
  const stages = applyPoolDeadlineOverrides(rawStages, pool);

  const sorted = memberships.filter(isConfirmedForRanking).sort(compareForGeneralRanking);
  const myPosition = sorted.findIndex((m) => m.user_id === user?.uid) + 1;
  const needsPayment = Number(pool?.entry_fee || 0) > 0 && Boolean(membership);
  const paymentStatus = needsPayment ? normalizePaymentStatus(membership?.payment_status) : 'confirmed';
  const canReportPayment = needsPayment && paymentStatus !== 'confirmed';

  const onReportPayment = async () => {
    setPaymentBusy(true);
    try {
      await reportPayment(pool, membership, user);
      toast.success('Pagamento informado ao admin. Aguarde a confirmação.');
    } catch (err) {
      toast.error(err.message || 'Erro ao informar pagamento.');
    } finally {
      setPaymentBusy(false);
    }
  };

  const now = Date.now();
  const nextStage = stages
    .filter((s) => toDate(s.bet_lock_at)?.getTime() > now)
    .sort((a, b) => toDate(a.bet_lock_at).getTime() - toDate(b.bet_lock_at).getTime())[0];

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard label="Sua posição" value={myPosition || '—'} suffix={myPosition ? `/ ${sorted.length}` : ''} icon={Trophy} />
      <StatCard label="Pontos" value={membership?.points ?? 0} icon={Trophy} />
      <StatCard label="Buchas" value={membership?.buchas ?? 0} />
      <StatCard label="Super Buchas" value={membership?.super_buchas ?? 0} />

      <Card className="sm:col-span-2 lg:col-span-4 overflow-hidden">
        <CardHeader className="border-b border-emerald-950/10 bg-white/45 p-4">
          <CardTitle className="text-base flex items-center gap-2">
            <QrCode className="w-4 h-4" /> Informações para participação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="grid gap-4 md:grid-cols-[1fr_240px] md:items-start">
            <div className="space-y-3 text-sm leading-6 text-slate-700">
              <p className="whitespace-pre-wrap">
                {pool?.participation_info_text || 'O admin deste bolão ainda não cadastrou instruções de participação.'}
              </p>
              {Number(pool?.entry_fee || 0) > 0 && (
                <p className="font-medium text-slate-900">
                  Valor de participação: {formatCurrency(pool.entry_fee)}
                </p>
              )}
              {needsPayment && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-slate-600">Status:</span>
                  <Badge variant={paymentStatus === 'confirmed' ? 'success' : paymentStatus === 'reported' ? 'warning' : 'outline'} className="text-[10px]">
                    {participationPaymentStatusLabel(paymentStatus)}
                  </Badge>
                </div>
              )}
            </div>
            <div className="flex min-h-48 items-center justify-center rounded-md border border-emerald-950/10 bg-white/70 p-3">
              {pool?.participation_qr_code_data_url ? (
                <img
                  src={pool.participation_qr_code_data_url}
                  alt="QR code para pagamento"
                  className="h-52 w-52 rounded object-contain"
                />
              ) : (
                <div className="text-center text-sm text-slate-500">
                  <QrCode className="mx-auto mb-2 h-10 w-10 text-slate-400" />
                  QR code não cadastrado.
                </div>
              )}
            </div>
          </div>
          {canReportPayment && (
            <Button onClick={onReportPayment} disabled={paymentBusy || paymentStatus === 'reported'} className="bg-emerald-700 hover:bg-emerald-800">
              <CreditCard className="h-4 w-4" />
              {paymentBusy ? 'Informando…' : paymentStatus === 'reported' ? 'Pagamento informado' : 'Informar pagamento'}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="sm:col-span-2 lg:col-span-4 overflow-hidden">
        <CardHeader className="border-b border-emerald-950/10 bg-white/45 p-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="w-4 h-4" /> Próximo prazo de palpite
          </CardTitle>
        </CardHeader>
        <CardContent>
          {nextStage ? (
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <div className="font-semibold text-slate-950">{nextStage.label}</div>
                <div className="text-xs text-slate-500">
                  {toDate(nextStage.bet_lock_at)?.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} (BRT)
                </div>
              </div>
              <DeadlineBadge deadline={nextStage.bet_lock_at} />
            </div>
          ) : (
            <p className="text-sm text-slate-500">Todos os palpites já foram encerrados.</p>
          )}
        </CardContent>
      </Card>

      <Card className="sm:col-span-2 lg:col-span-4 bg-gradient-to-br from-white/90 to-emerald-50/70">
        <CardContent className="p-6 text-sm text-slate-700">
          <p>
            <strong>{pool?.name}</strong>
            {pool?.description && <> — {pool.description}</>}
          </p>
          <p className="mt-2 text-slate-500">
            Código de convite: <span className="font-mono font-semibold">{pool?.invite_code}</span> ·{' '}
            {pool?.stats?.members_count || 1} participantes
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function StatCard({ label, value, suffix, icon: Icon }) {
  return (
    <Card className="bg-gradient-to-br from-white/90 to-emerald-50/75">
      <CardContent className="p-5">
        <div className="text-xs font-medium text-emerald-800 flex items-center gap-1">
          {Icon && <Icon className="w-3.5 h-3.5" />}
          {label}
        </div>
        <div className="text-2xl font-bold mt-1 text-slate-950">
          {value}
          {suffix && <span className="text-sm text-slate-500 font-normal ml-1">{suffix}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function toDate(d) {
  if (!d) return null;
  if (d instanceof Date) return d;
  if (typeof d.seconds === 'number') return new Date(d.seconds * 1000);
  if (typeof d.toDate === 'function') return d.toDate();
  return new Date(d);
}
