import React, { useMemo, useState } from 'react';
import { Check, Gift, Lock, Ticket } from 'lucide-react';
import { toast } from 'sonner';
import { V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { V2SubTabs } from '@/v2/ui/V2SectionNav';
import CopyCodeButton from '@/v2/ui/CopyCodeButton';
import { useClaimActions, useMyClaims, useRewards } from '@/modules/progression/hooks/useRewards';
import {
  CLAIM_STATUS_LABEL, REWARD_ISSUER_LABEL, REWARD_KIND_META, describeEligibility, evaluateEligibility, rewardAvailability,
} from '@/modules/progression/domain/rewards';
import { achievementName } from './achievementName';
import TermHint from './TermHint';

const TABS = [
  { value: 'disponiveis', label: 'Disponíveis', icon: Gift },
  { value: 'meus', label: 'Meus pedidos', icon: Ticket },
];

const STATUS_TONE = { requested: 'amber', approved: 'green', redeemed: 'neutral', rejected: 'red', cancelled: 'neutral' };

function RewardCard({ r, claim, snapshot, onRequest, requesting }) {
  const meta = REWARD_KIND_META[r.kind] || REWARD_KIND_META.other;
  const disp = rewardAvailability(r);
  const ev = evaluateEligibility(r.eligibility, snapshot, { achievementName });
  const falta = ev.checks.filter((c) => !c.ok);
  return (
    <li className="rounded-2xl border border-gray-100 p-4" data-reward={r.id}>
      <div className="flex items-start gap-3">
        <span className="text-3xl" aria-hidden="true">{meta.emoji}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="font-display text-base font-bold text-ink">{r.title}</p>
            <V2Badge tone="purple">{r.issuerName || REWARD_ISSUER_LABEL[r.issuerType]}</V2Badge>
            <V2Badge>{meta.label}</V2Badge>
          </div>
          {r.description && <p className="mt-0.5 text-sm text-gray-600">{r.description}</p>}
          <p className="mt-1 text-xs text-gray-500">{describeEligibility(r.eligibility, { achievementName })}</p>
          {disp.available && disp.remaining != null && <p className="text-xs text-gray-400">{disp.remaining} {disp.remaining === 1 ? 'unidade restante' : 'unidades restantes'}</p>}
          {r.instructions && <p className="mt-1 text-xs text-gray-500">Como usar: {r.instructions}</p>}
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {claim ? (
          <div className="flex flex-wrap items-center gap-2">
            <V2Badge tone={STATUS_TONE[claim.status]}>{CLAIM_STATUS_LABEL[claim.status]}</V2Badge>
            {['requested', 'approved'].includes(claim.status) && <CopyCodeButton code={claim.code} />}
          </div>
        ) : !disp.available ? (
          <p className="flex items-center gap-1.5 text-xs text-gray-500"><Lock className="h-3.5 w-3.5" aria-hidden="true" /> {disp.reason}</p>
        ) : ev.eligible ? (
          <V2Button size="sm" disabled={requesting} onClick={() => onRequest(r)}>Pedir esta recompensa</V2Button>
        ) : (
          <ul className="space-y-1" aria-label="O que falta">
            {falta.map((c) => (
              <li key={c.field} className="flex items-center gap-1.5 text-xs text-gray-600">
                <Lock className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden="true" />
                {c.label}: você tem <strong className="text-ink">{c.have}</strong>, precisa de <strong className="text-ink">{c.need}</strong>
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

/**
 * Recompensas da plataforma, de arenas, clubes e professores. Quem se qualifica
 * pede e recebe um código; quem oferece confere e libera. Nada é entregue sozinho.
 *
 * @param {{ uid: string, user: object, snapshot: object }} props
 */
export default function RewardsPanel({ uid, user, snapshot }) {
  const [aba, setAba] = useState('disponiveis');
  const rewards = useRewards();
  const claims = useMyClaims(uid);
  const act = useClaimActions(uid);
  const porReward = useMemo(() => new Map(claims.claims.map((c) => [c.rewardId, c])), [claims.claims]);

  const ativas = useMemo(
    () => rewards.rewards.filter((r) => r.status === 'active' || porReward.has(r.id)),
    [rewards.rewards, porReward],
  );
  // quem pode pedir primeiro
  const ordenadas = useMemo(() => [...ativas].sort((a, b) => {
    const pa = evaluateEligibility(a.eligibility, snapshot).eligible && rewardAvailability(a).available && !porReward.has(a.id) ? 0 : 1;
    const pb = evaluateEligibility(b.eligibility, snapshot).eligible && rewardAvailability(b).available && !porReward.has(b.id) ? 0 : 1;
    return pa - pb;
  }), [ativas, snapshot, porReward]);
  const meus = useMemo(() => [...claims.claims].sort((a, b) => Number(b.createdAt) - Number(a.createdAt)), [claims.claims]);

  const pedir = async (r) => {
    try {
      const { code } = await act.request.mutateAsync({ reward: r, user, snapshot });
      toast.success(`Pedido enviado. Seu código: ${code}`);
    } catch (e) {
      toast.error(e?.message || 'Não foi possível pedir agora.');
    }
  };

  const carregando = rewards.isLoading || claims.isLoading;
  const falhou = rewards.isError || claims.isError;

  return (
    <V2Surface data-testid="rewards-panel" data-dica="recompensas" className="space-y-4">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink"><Gift className="h-5 w-5" aria-hidden="true" /> Recompensas <TermHint term="recompensas" /></h2>
      <V2SubTabs tabs={TABS} activeValue={aba} onSelect={(t) => setAba(t.value)} ariaLabel="Recompensas" />
      {carregando ? <V2Skeleton lines={4} /> : falhou ? (
        <V2ErrorState inline title="Não deu para carregar as recompensas" onRetry={() => { rewards.refetch(); claims.refetch(); }} />
      ) : aba === 'disponiveis' ? (
        ordenadas.length === 0 ? (
          <V2EmptyState icon={Gift} title="Nenhuma recompensa por aqui ainda" description="Arenas, clubes e professores podem oferecer benefícios para quem joga e evolui. Quando houver, eles aparecem aqui." />
        ) : (
          <ul className="space-y-3">
            {ordenadas.map((r) => <RewardCard key={r.id} r={r} claim={porReward.get(r.id)} snapshot={snapshot} onRequest={pedir} requesting={act.request.isPending} />)}
          </ul>
        )
      ) : meus.length === 0 ? (
        <V2EmptyState icon={Check} title="Você ainda não pediu nada" description="Quando você pedir uma recompensa, o código dela fica guardado aqui." />
      ) : (
        <ul className="space-y-2">
          {meus.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-gray-100 p-3">
              <div>
                <p className="text-sm font-bold text-ink">{c.rewardTitle}</p>
                <p className="text-xs text-gray-500">{new Date(Number(c.createdAt)).toLocaleDateString('pt-BR')}{c.note ? ` · ${c.note}` : ''}</p>
              </div>
              <div className="flex items-center gap-2">
                <V2Badge tone={STATUS_TONE[c.status]}>{CLAIM_STATUS_LABEL[c.status]}</V2Badge>
                {['requested', 'approved'].includes(c.status) && (
                  <>
                    <CopyCodeButton code={c.code} />
                    <V2Button size="sm" variant="ghost" onClick={() => act.cancel.mutate(c.id)}>Cancelar</V2Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </V2Surface>
  );
}
