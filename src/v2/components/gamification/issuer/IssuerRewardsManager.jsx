import React, { useMemo, useState } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import ConfirmDialog from '@/components/ConfirmDialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Field, V2Input, V2Select, V2Skeleton, V2Surface, V2Textarea, V2Toggle } from '@/v2/ui/primitives';
import { V2SubTabs } from '@/v2/ui/V2SectionNav';
import { useIssuerRewards } from '@/modules/progression/hooks/useRewards';
import {
  CLAIM_STATUS_LABEL, REWARD_KIND_META, describeEligibility, rewardAvailability, validateReward,
} from '@/modules/progression/domain/rewards';
import { emptyRewardForm, formToRewardInput, rewardToForm } from '@/modules/progression/domain/issuerForms';
import { TIER_NAMES } from '@/modules/progression/domain/tiers';
import { ACHIEVEMENTS_V2 } from '@/modules/achievements/domain/achievementsV2';
import { achievementName } from '../achievementName';

const STATUS_TONE = { requested: 'amber', approved: 'green', redeemed: 'neutral', rejected: 'red', cancelled: 'neutral' };

function RewardForm({ issuer, initial, atual, onCancel, onSave, saving }) {
  const [f, setF] = useState(initial);
  const [erro, setErro] = useState('');
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const conquistas = useMemo(() => [...ACHIEVEMENTS_V2].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')), []);

  const salvar = () => {
    const input = formToRewardInput(f, atual);
    const v = validateReward(input, { ...issuer, uid: 'x' });
    if (!v.ok) { setErro(Object.values(v.errors)[0]); return; }
    setErro('');
    onSave(input);
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{initial.title ? 'Editar recompensa' : 'Nova recompensa'}</DialogTitle>
          <DialogDescription>Quem se qualificar pede e recebe um código. Você confere e libera — nada é entregue sozinho.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60dvh] space-y-4 overflow-y-auto pr-1">
          <V2Field label="Nome" htmlFor="rw-title" required><V2Input id="rw-title" value={f.title} maxLength={80} placeholder="Ex.: 1 hora de quadra grátis" onChange={(e) => set({ title: e.target.value })} /></V2Field>
          <V2Field label="Tipo" htmlFor="rw-kind">
            <V2Select id="rw-kind" value={f.kind} onChange={(e) => set({ kind: e.target.value })}>
              {Object.entries(REWARD_KIND_META).map(([id, m]) => <option key={id} value={id}>{m.emoji} {m.label}</option>)}
            </V2Select>
          </V2Field>
          <V2Field label="Descrição" htmlFor="rw-desc"><V2Textarea id="rw-desc" rows={2} maxLength={400} value={f.description} onChange={(e) => set({ description: e.target.value })} /></V2Field>
          <V2Field label="Como usar (opcional)" htmlFor="rw-how" hint="Ex.: “Mostre o código na recepção”."><V2Input id="rw-how" maxLength={300} value={f.instructions} onChange={(e) => set({ instructions: e.target.value })} /></V2Field>

          <fieldset className="space-y-3 rounded-2xl border border-gray-100 p-3">
            <legend className="px-1 text-sm font-semibold text-ink">Quem pode pedir (todos os critérios somam)</legend>
            <div className="grid grid-cols-2 gap-3">
              <V2Field label="Tier mínimo" htmlFor="rw-tier">
                <V2Select id="rw-tier" value={f.minTier} onChange={(e) => set({ minTier: e.target.value })}>
                  <option value="">Qualquer</option>
                  {TIER_NAMES.map((t) => <option key={t} value={t}>{t}</option>)}
                </V2Select>
              </V2Field>
              <V2Field label="Jogos (mínimo)" htmlFor="rw-games"><V2Input id="rw-games" type="number" min={5} value={f.minGames} onChange={(e) => set({ minGames: e.target.value })} /></V2Field>
              <V2Field label="Semanas seguidas" htmlFor="rw-streak"><V2Input id="rw-streak" type="number" min={2} value={f.minStreakWeeks} onChange={(e) => set({ minStreakWeeks: e.target.value })} /></V2Field>
              <V2Field label="Top % da temporada" htmlFor="rw-top"><V2Input id="rw-top" type="number" min={1} max={100} value={f.topPercent} onChange={(e) => set({ topPercent: e.target.value })} /></V2Field>
            </div>
            <V2Field label="Conquista exigida" htmlFor="rw-ach">
              <V2Select id="rw-ach" value={f.achievementId} onChange={(e) => set({ achievementId: e.target.value })}>
                <option value="">Nenhuma</option>
                {conquistas.map((a) => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
              </V2Select>
            </V2Field>
          </fieldset>

          <div className="grid grid-cols-2 gap-3">
            <V2Field label="Quantidade" htmlFor="rw-qty" hint="Em branco = sem limite."><V2Input id="rw-qty" type="number" min={1} value={f.quantity} onChange={(e) => set({ quantity: e.target.value })} /></V2Field>
            <V2Field label="Vale até" htmlFor="rw-until"><V2Input id="rw-until" type="date" value={f.validUntil} onChange={(e) => set({ validUntil: e.target.value })} /></V2Field>
          </div>
          <V2Toggle id="rw-active" checked={f.active} onChange={(v) => set({ active: v })} label="Disponível para pedidos" hint="Desligado, a recompensa fica pausada." />
        </div>
        {erro && <p role="alert" className="text-sm text-red-600">{erro}</p>}
        <DialogFooter>
          <V2Button variant="ghost" onClick={onCancel}>Cancelar</V2Button>
          <V2Button disabled={saving} onClick={salvar}>{saving ? 'Salvando…' : 'Salvar'}</V2Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ClaimsQueue({ claims, onDecide, deciding }) {
  const [nota, setNota] = useState({});
  const abertos = claims.filter((c) => ['requested', 'approved'].includes(c.status));
  const fechados = claims.filter((c) => !['requested', 'approved'].includes(c.status)).slice(0, 10);
  const decidir = (claim, next) => onDecide({ claim, next, note: nota[claim.id] || '' });

  if (claims.length === 0) return <V2EmptyState title="Nenhum pedido ainda" description="Quando alguém pedir uma das suas recompensas, o pedido aparece aqui com o código." />;
  return (
    <div className="space-y-4">
      {abertos.length > 0 && (
        <ul className="space-y-2">
          {abertos.map((c) => (
            <li key={c.id} className="rounded-2xl border border-gray-100 p-3" data-claim={c.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-ink">{c.userName || 'Atleta'} <span className="font-normal text-gray-500">pediu</span> {c.rewardTitle}</p>
                  <p className="text-xs text-gray-500">
                    Código <strong className="font-mono text-ink">{c.code}</strong> · {c.snapshot?.tier} nível {c.snapshot?.level} · {c.snapshot?.games} jogos · {c.snapshot?.streakWeeks} sem. seguidas
                  </p>
                </div>
                <V2Badge tone={STATUS_TONE[c.status]}>{CLAIM_STATUS_LABEL[c.status]}</V2Badge>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <V2Input aria-label="Observação para a pessoa (opcional)" placeholder="Observação (opcional)" className="max-w-xs !py-1.5 !text-xs" maxLength={200}
                  value={nota[c.id] || ''} onChange={(e) => setNota((n) => ({ ...n, [c.id]: e.target.value }))} />
                {c.status === 'requested' && <V2Button size="sm" disabled={deciding} onClick={() => decidir(c, 'approved')}><Check className="mr-1 h-3.5 w-3.5" /> Liberar</V2Button>}
                {c.status === 'approved' && <V2Button size="sm" disabled={deciding} onClick={() => decidir(c, 'redeemed')}><Check className="mr-1 h-3.5 w-3.5" /> Marcar como usada</V2Button>}
                <V2Button size="sm" variant="ghost" disabled={deciding} onClick={() => decidir(c, 'rejected')}><X className="mr-1 h-3.5 w-3.5" /> Recusar</V2Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {fechados.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-400">Já decididos</p>
          <ul className="space-y-1">
            {fechados.map((c) => (
              <li key={c.id} className="flex items-center justify-between text-sm text-gray-600">
                <span>{c.userName || 'Atleta'} · {c.rewardTitle}</span>
                <V2Badge tone={STATUS_TONE[c.status]}>{CLAIM_STATUS_LABEL[c.status]}</V2Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const TABS = [
  { value: 'recompensas', label: 'Recompensas' },
  { value: 'pedidos', label: 'Pedidos' },
];

/**
 * As recompensas de UM emissor e a fila de pedidos.
 * @param {{ issuer: { type: string, id: string, name?: string }, actor: object }} props
 */
export default function IssuerRewardsManager({ issuer, actor }) {
  const r = useIssuerRewards(issuer, actor);
  const [aba, setAba] = useState('recompensas');
  const [editando, setEditando] = useState(null);
  const pendentes = r.claims.filter((c) => c.status === 'requested').length;
  const tabs = TABS.map((t) => (t.value === 'pedidos' && pendentes ? { ...t, label: `Pedidos (${pendentes})` } : t));

  const salvar = async (input) => {
    try {
      if (editando.id) await r.update.mutateAsync({ id: editando.id, atual: editando.atual, patch: input });
      else await r.create.mutateAsync(input);
      toast.success('Recompensa salva.');
      setEditando(null);
    } catch (e) {
      toast.error(e?.message || 'Não foi possível salvar agora.');
    }
  };
  const decidir = async (p) => {
    try {
      await r.decide.mutateAsync(p);
      toast.success('Pedido atualizado e a pessoa foi avisada.');
    } catch (e) {
      toast.error(e?.message || 'Não foi possível atualizar o pedido.');
    }
  };

  if (r.isLoading) return <V2Skeleton className="h-48 rounded-4xl" />;
  if (r.isError) return <V2Surface><V2ErrorState title="Não deu para carregar as recompensas" onRetry={r.refetch} /></V2Surface>;

  return (
    <V2Surface data-testid="issuer-rewards" data-dica="oferta-recompensas" className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-bold text-ink">Recompensas</h2>
          <p className="text-sm text-gray-500">Benefícios para quem joga e evolui — com critério claro e código para conferir.</p>
        </div>
        <V2Button size="sm" onClick={() => setEditando({ form: emptyRewardForm() })}><Plus className="mr-1 h-4 w-4" /> Nova recompensa</V2Button>
      </div>
      <V2SubTabs tabs={tabs} activeValue={aba} onSelect={(t) => setAba(t.value)} ariaLabel="Recompensas e pedidos" />

      {aba === 'pedidos' ? (
        <ClaimsQueue claims={r.claims} onDecide={decidir} deciding={r.decide.isPending} />
      ) : r.rewards.length === 0 ? (
        <V2EmptyState title="Nenhuma recompensa ainda" description="Crie a primeira: por exemplo, uma aula experimental para quem chegou ao tier Regular." />
      ) : (
        <ul className="space-y-3">
          {r.rewards.map((w) => {
            const meta = REWARD_KIND_META[w.kind] || REWARD_KIND_META.other;
            const disp = rewardAvailability(w);
            return (
              <li key={w.id} className="rounded-2xl border border-gray-100 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-display text-base font-bold text-ink">{meta.emoji} {w.title}</p>
                    <p className="text-xs text-gray-500">{describeEligibility(w.eligibility, { achievementName })}</p>
                    <p className="text-xs text-gray-400">{w.approvedCount || 0}{w.quantity != null ? ` de ${w.quantity}` : ''} liberadas</p>
                  </div>
                  <V2Badge tone={disp.available ? 'green' : 'neutral'}>{disp.available ? 'disponível' : (w.status === 'paused' ? 'pausada' : 'indisponível')}</V2Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <V2Button size="sm" variant="ghost" onClick={() => setEditando({ id: w.id, atual: w, form: rewardToForm(w) })}><Pencil className="mr-1 h-3.5 w-3.5" /> Editar</V2Button>
                  <ConfirmDialog
                    trigger={<V2Button size="sm" variant="ghost"><Trash2 className="mr-1 h-3.5 w-3.5" /> Apagar</V2Button>}
                    title="Apagar esta recompensa?" description="Os pedidos já feitos continuam registrados, mas ninguém mais consegue pedir." confirmLabel="Apagar"
                    onConfirm={() => r.remove.mutate(w.id)}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {editando && <RewardForm issuer={issuer} initial={editando.form} atual={editando.atual} onCancel={() => setEditando(null)} onSave={salvar} saving={r.create.isPending || r.update.isPending} />}
    </V2Surface>
  );
}
