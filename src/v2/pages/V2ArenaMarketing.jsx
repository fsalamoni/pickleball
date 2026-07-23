/**
 * V2ArenaMarketing — Cupons, campanhas, NPS.
 * Rota: /arenas/:arenaId/gerir/marketing (admin)
 *       /arenas/:arenaId/marketing (público - só NPS)
 */

import React, { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Tag, Megaphone, Star, Plus } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useArena, useMyManagedArenas } from '@/modules/arenas/hooks/useArenas';
import {
  useCanArenaUseModule, useArenaCoupons, useCreateCoupon, useArenaCampaigns, useArenaNps,
  useCreateCampaign, useSubmitNps,
} from '@/modules/arenas/hooks/useArenaV3';
import { V2Badge, V2Button, V2EmptyState, V2Field, V2Input, V2Skeleton, V2Surface, V2Textarea } from '@/v2/ui/primitives';

function NpsCard({ nps, count, onSubmit, user }) {
  const [score, setScore] = useState(null);
  const [comment, setComment] = useState('');
  const submit = useSubmitNps();
  const submitted = score !== null;

  if (submitted) {
    return (
      <V2Surface>
        <p className="text-sm text-green-700">Obrigado pela sua avaliação! 🎉</p>
      </V2Surface>
    );
  }

  return (
    <V2Surface>
      <h3 className="font-display text-base font-bold text-ink">Como foi sua experiência?</h3>
      <p className="mt-1 text-sm text-gray-500">De 0 (ruim) a 10 (excelente)</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {Array.from({ length: 11 }, (_, i) => (
          <button
            key={i}
            type="button"
            onClick={async () => {
              try {
                await submit.mutateAsync({ arenaId: onSubmit, score: i, comment });
                setScore(i);
                toast.success('Obrigado!');
              } catch (err) {
                toast.error(err.message);
              }
            }}
            className="h-9 w-9 rounded-full border border-gray-200 bg-paper-pure text-sm font-bold text-ink hover:border-ink"
          >
            {i}
          </button>
        ))}
      </div>
      <V2Field label="Comentário (opcional)" className="mt-3">
        <V2Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} maxLength={500} />
      </V2Field>
    </V2Surface>
  );
}

function CreateCouponForm({ arenaId, onClose }) {
  const [form, setForm] = useState({ code: '', type: 'percent', value: 10, max_uses: '' });
  const create = useCreateCoupon();
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form, value: Number(form.value) };
      if (form.max_uses === '') payload.max_uses = null;
      else payload.max_uses = Number(form.max_uses);
      await create.mutateAsync({ arenaId, input: payload });
      toast.success('Cupom criado!');
      onClose();
    } catch (err) {
      toast.error(err.message);
    }
  };
  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-gray-100 bg-paper p-4">
      <h3 className="font-display text-base font-bold text-ink">Novo cupom</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <V2Field label="Código">
          <V2Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} required maxLength={30} placeholder="VERAO10" />
        </V2Field>
        <V2Field label="Tipo">
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="h-11 w-full rounded-2xl border border-gray-200 bg-paper-pure px-4 text-sm">
            <option value="percent">% desconto</option>
            <option value="fixed">R$ desconto</option>
          </select>
        </V2Field>
        <V2Field label="Valor">
          <V2Input type="number" min="0.01" step="0.01" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} required />
        </V2Field>
        <V2Field label="Usos máximos">
          <V2Input type="number" min="1" value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} placeholder="Vazio = ilimitado" />
        </V2Field>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <V2Button type="button" variant="ghost" onClick={onClose}>Cancelar</V2Button>
        <V2Button type="submit" disabled={create.isPending}>Criar</V2Button>
      </div>
    </form>
  );
}

export default function V2ArenaMarketing() {
  const { arenaId } = useParams();
  const { user, isPlatformAdmin } = useAuth();
  const { data: arena, isLoading: arenaLoading } = useArena(arenaId);
  const { data: managed = [] } = useMyManagedArenas();
  const canCampaigns = useCanArenaUseModule(arenaId, 'marketing_campaigns');
  const canCoupons = useCanArenaUseModule(arenaId, 'marketing_coupons');
  const canNps = useCanArenaUseModule(arenaId, 'marketing_nps');
  const { data: coupons = [] } = useArenaCoupons(arenaId);
  const { data: campaigns = [] } = useArenaCampaigns(arenaId);
  const { data: nps } = useArenaNps(arenaId);
  const [showCouponForm, setShowCouponForm] = useState(false);

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

  const canManage = arena.owner_id === user?.uid || managed.some((m) => m.id === arena.id) || isPlatformAdmin;
  if (!canCampaigns && !canCoupons && !canNps) {
    return (
      <div className="mx-auto max-w-[700px]">
        <Link to={`/arenas/${arena.id}`} className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar
        </Link>
        <V2Surface>
          <V2EmptyState icon={Megaphone} title="Marketing indisponível" description="Esta arena não ativou o módulo de marketing." />
        </V2Surface>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="mb-6">
        <Link to={canManage ? `/arenas/${arena.id}/gerir` : `/arenas/${arena.id}`} className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar
        </Link>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
          Marketing · {arena.name}
        </h1>
        <p className="mt-2 font-medium text-gray-500">Cupons, campanhas e NPS.</p>
      </div>

      {/* NPS */}
      {canNps && nps && (
        <V2Surface className="mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-100 text-green-700">
              <Star className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500">NPS atual</p>
              <p className="font-display text-2xl font-bold text-ink">{nps.nps} <span className="text-sm text-gray-500">({nps.count} respostas)</span></p>
            </div>
          </div>
          {user && (
            <div className="mt-4">
              <NpsCard onSubmit={arena.id} user={user} />
            </div>
          )}
        </V2Surface>
      )}

      {/* Cupons */}
      {canCoupons && (
        <V2Surface className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-ink">Cupons</h2>
            {canManage && !showCouponForm && (
              <V2Button size="sm" onClick={() => setShowCouponForm(true)}>
                <Plus className="mr-1.5 h-4 w-4" /> Novo
              </V2Button>
            )}
          </div>
          {showCouponForm && canManage && (
            <div className="mb-4">
              <CreateCouponForm arenaId={arena.id} onClose={() => setShowCouponForm(false)} />
            </div>
          )}
          {coupons.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum cupom ativo.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {coupons.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-2xl border border-gray-100 bg-paper p-3">
                  <div>
                    <p className="font-display text-base font-bold text-ink">{c.code}</p>
                    <p className="text-xs text-gray-500">{c.type === 'percent' ? `${c.value}% off` : `R$ ${c.value} off`} · {c.used_count || 0}{c.max_uses ? `/${c.max_uses}` : ''} usado(s)</p>
                  </div>
                  <V2Badge tone={c.active ? 'green' : 'neutral'}>{c.active ? 'Ativo' : 'Inativo'}</V2Badge>
                </div>
              ))}
            </div>
          )}
        </V2Surface>
      )}

      {/* Campanhas */}
      {canCampaigns && (
        <V2Surface>
          <h2 className="mb-3 font-display text-lg font-bold text-ink">Campanhas</h2>
          {campaigns.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhuma campanha ainda.</p>
          ) : (
            <div className="space-y-2">
              {campaigns.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-2xl border border-gray-100 bg-paper p-3">
                  <div>
                    <p className="font-bold text-ink">{c.name}</p>
                    <p className="text-xs text-gray-500">{c.channel} · {c.sent_count || 0} enviada(s)</p>
                  </div>
                  <V2Badge tone={c.status === 'sent' ? 'green' : 'amber'}>{c.status}</V2Badge>
                </div>
              ))}
            </div>
          )}
        </V2Surface>
      )}
    </div>
  );
}
