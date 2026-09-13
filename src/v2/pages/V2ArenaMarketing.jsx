/**
 * V2ArenaMarketing — o console de marketing e fidelidade da arena.
 *
 * Rota: `/arenas/:arenaId/gerir/marketing` (e `/arenas/:arenaId/marketing`).
 * Módulos: `marketing` (+ `marketing_coupons`, `marketing_campaigns`,
 * `marketing_nps`, `marketing_referral`, `marketing_loyalty`).
 *
 * ## O que a versão anterior não fazia
 *
 * Ela LISTAVA. O cupom só podia ser criado — não editado, não desligado, não
 * apagado (a regra do Firestore recusava o `delete`, corrigida na Onda AG); a
 * campanha era um rascunho que não chegava a ninguém; o NPS mostrava a nota
 * sem os comentários, que são a única parte acionável; e a indicação não tinha
 * onde ser resgatada. Um console de marketing que não envia, não corrige e não
 * mostra o motivo da nota é um relatório, não uma ferramenta.
 *
 * ## As decisões que valem a pena conhecer
 *
 * - **A campanha diz para quantas pessoas vai ANTES de enviar.** O público é
 *   calculado no domínio (`campaignRecipients`) a partir do que a tela já tem
 *   em mãos — membros e reservas. Mandar mensagem para um número desconhecido
 *   de pessoas é como uma arena queima a paciência da própria comunidade.
 * - **Desligar vem antes de apagar.** Apagar leva junto a contagem de usos, e
 *   aí ninguém responde mais "quanto essa promoção rendeu?".
 * - **A indicação é resgatada pela ARENA.** Não é escolha de produto: só o
 *   gestor pode creditar carteira. No balcão é assim mesmo — a pessoa chega e
 *   diz quem indicou.
 * - **Quem não é gestor não vê esta tela.** A pergunta de NPS ao atleta mora
 *   na página da arena, no momento em que ele acabou de jogar.
 */

import React, { useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  AlertTriangle, ArrowLeft, Check, Gift, Megaphone, MessageSquare, Pencil,
  Plus, Send, Star, Tag, Trash2, TrendingUp, Users, X,
} from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useArena, useMyManagedArenas } from '@/modules/arenas/hooks/useArenas';
import { useArenaBookings } from '@/modules/arenas/hooks/useBookings';
import { useAthletes } from '@/modules/athletes/hooks/useAthletes';
import {
  useArenaCouponsAll, useCreateCoupon, useUpdateCoupon, useSetCouponActive,
  useDeleteCoupon, useArenaCampaigns, useSendCampaign, useArenaNps,
  useArenaNpsResponses, useArenaMembers, useRedeemReferral,
} from '@/modules/arenas/hooks/useArenaV3';
import { useArenaModules } from '@/modules/arenas/hooks/useArenaModules';
import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';
import {
  CAMPAIGN_AUDIENCE, CAMPAIGN_AUDIENCE_META, COUPON_TYPE, campaignRecipients,
  classifyNps, couponLabel, normalizeCouponInput,
} from '@/modules/arenas/domain/marketing';
import { formatPrice } from '@/modules/arenas/domain/pricing';
import { formatDateShortBR } from '@/modules/arenas/domain/calendar';
import ConfirmDialog from '@/components/ConfirmDialog';
import { ConfirmDialog as ConfirmDialogControlado } from '@/components/ui/confirm-dialog';
import {
  V2Avatar, V2Badge, V2Button, V2EmptyState, V2Field, V2Input, V2Skeleton,
  V2Surface, V2Textarea,
} from '@/v2/ui/primitives';

/** `Timestamp | Date | number` → ms, ou `null`. */
function ms(v) {
  if (!v) return null;
  const n = v?.toMillis ? v.toMillis() : v instanceof Date ? v.getTime() : v?.seconds ? v.seconds * 1000 : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** ms → 'YYYY-MM-DD' (o formato que `formatDateShortBR` espera). */
function iso(v) {
  const n = ms(v);
  if (n == null) return null;
  const d = new Date(n);
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/* ======================================================== 1. CUPONS ====== */

const CUPOM_VAZIO = {
  code: '', type: COUPON_TYPE.PERCENT, value: 10, description: '',
  max_uses: '', min_amount: '', once_per_user: true, expires_at: '', active: true,
};

function CupomForm({ arenaId, cupom, onClose }) {
  const [form, setForm] = useState(() => (cupom
    ? {
      code: cupom.code || '',
      type: cupom.type || COUPON_TYPE.PERCENT,
      value: cupom.value ?? 10,
      description: cupom.description || '',
      max_uses: cupom.max_uses ?? '',
      min_amount: cupom.min_amount ?? '',
      once_per_user: cupom.once_per_user !== false,
      expires_at: iso(cupom.expires_at) || '',
      active: cupom.active !== false,
    }
    : { ...CUPOM_VAZIO }));
  const criar = useCreateCoupon();
  const editar = useUpdateCoupon();
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  // A prévia usa a MESMA normalização do serviço: o que a arena lê aqui é
  // exatamente o que vai ser gravado, não uma aproximação da tela.
  const previa = useMemo(() => normalizeCouponInput({
    ...form,
    value: Number(form.value),
    max_uses: form.max_uses === '' ? null : Number(form.max_uses),
    min_amount: form.min_amount === '' ? null : Number(form.min_amount),
    expires_at: form.expires_at ? new Date(`${form.expires_at}T23:59:59`).getTime() : null,
  }), [form]);

  const submit = async (e) => {
    e.preventDefault();
    if (!previa.valid) {
      toast.error(Object.values(previa.errors)[0]);
      return;
    }
    try {
      const input = {
        ...form,
        value: Number(form.value),
        max_uses: form.max_uses === '' ? null : Number(form.max_uses),
        min_amount: form.min_amount === '' ? null : Number(form.min_amount),
        expires_at: form.expires_at ? new Date(`${form.expires_at}T23:59:59`).getTime() : null,
      };
      if (cupom) await editar.mutateAsync({ arenaId, couponId: cupom.id, input });
      else await criar.mutateAsync({ arenaId, input });
      toast.success(cupom ? 'Cupom atualizado.' : 'Cupom criado.');
      onClose();
    } catch (err) {
      toast.error(err?.message || 'Não foi possível salvar o cupom.');
    }
  };

  const salvando = criar.isPending || editar.isPending;

  return (
    <form onSubmit={submit} className="rounded-2xl border border-gray-100 bg-paper p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-base font-bold text-ink">
          {cupom ? `Editar ${cupom.code}` : 'Novo cupom'}
        </h3>
        <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-ink">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <V2Field label="Código" htmlFor="cup-code" hint="Quem digita sempre em maiúsculas.">
          <V2Input id="cup-code" required maxLength={30} placeholder="VERAO10"
            value={form.code} onChange={(e) => set({ code: e.target.value.toUpperCase().replace(/\s+/g, '') })} />
        </V2Field>
        <V2Field label="Tipo de desconto" htmlFor="cup-tipo">
          <select id="cup-tipo" value={form.type} onChange={(e) => set({ type: e.target.value })}
            className="h-11 w-full rounded-2xl border border-gray-200 bg-paper-pure px-4 text-sm">
            <option value={COUPON_TYPE.PERCENT}>Percentual (%)</option>
            <option value={COUPON_TYPE.FIXED}>Valor fixo (R$)</option>
          </select>
        </V2Field>
        <V2Field label={form.type === COUPON_TYPE.PERCENT ? 'Desconto (%)' : 'Desconto (R$)'} htmlFor="cup-valor">
          <V2Input id="cup-valor" type="number" min="0.01" step="0.01" required
            max={form.type === COUPON_TYPE.PERCENT ? '100' : undefined}
            value={form.value} onChange={(e) => set({ value: e.target.value })} />
        </V2Field>
        <V2Field label="Valor mínimo da conta (R$)" htmlFor="cup-min" hint="Vazio = sem mínimo.">
          <V2Input id="cup-min" type="number" min="0" step="0.01" placeholder="Sem mínimo"
            value={form.min_amount} onChange={(e) => set({ min_amount: e.target.value })} />
        </V2Field>
        <V2Field label="Usos máximos" htmlFor="cup-max" hint="Vazio = ilimitado.">
          <V2Input id="cup-max" type="number" min="1" placeholder="Ilimitado"
            value={form.max_uses} onChange={(e) => set({ max_uses: e.target.value })} />
        </V2Field>
        <V2Field label="Vale até" htmlFor="cup-exp" hint="Vazio = sem prazo.">
          <V2Input id="cup-exp" type="date" value={form.expires_at}
            onChange={(e) => set({ expires_at: e.target.value })} />
        </V2Field>
      </div>

      <V2Field label="Descrição" htmlFor="cup-desc" className="mt-3"
        hint="Aparece para quem digita o código. Diga a regra em uma linha.">
        <V2Input id="cup-desc" maxLength={160} placeholder="10% na primeira reserva do mês"
          value={form.description} onChange={(e) => set({ description: e.target.value })} />
      </V2Field>

      <label className="mt-3 flex items-center gap-2 text-sm text-gray-600">
        <input type="checkbox" checked={form.once_per_user}
          onChange={(e) => set({ once_per_user: e.target.checked })}
          className="h-4 w-4 rounded border-gray-300" />
        Cada pessoa pode usar uma vez só
      </label>

      {previa.valid && (
        <p className="mt-3 rounded-2xl bg-paper-pure p-3 text-xs text-gray-600">
          Vai valer como: <strong className="text-ink">{couponLabel(previa.value)}</strong>
          {previa.value.min_amount ? ` · a partir de ${formatPrice(previa.value.min_amount)}` : ''}
          {previa.value.max_uses ? ` · até ${previa.value.max_uses} usos` : ' · usos ilimitados'}
        </p>
      )}

      <div className="mt-3 flex justify-end gap-2">
        <V2Button type="button" variant="ghost" onClick={onClose}>Cancelar</V2Button>
        <V2Button type="submit" disabled={salvando}>
          {salvando ? 'Salvando…' : cupom ? 'Salvar' : 'Criar cupom'}
        </V2Button>
      </div>
    </form>
  );
}

function CuponsSecao({ arenaId }) {
  const { data: cupons = [], isLoading, isError, refetch } = useArenaCouponsAll(arenaId);
  const ligar = useSetCouponActive();
  const apagar = useDeleteCoupon();
  const [form, setForm] = useState(null);   // null | 'novo' | cupom

  const ordenados = useMemo(
    () => [...cupons].sort((a, b) => {
      if ((a.active !== false) !== (b.active !== false)) return a.active === false ? 1 : -1;
      return (ms(b.created_at) || 0) - (ms(a.created_at) || 0);
    }),
    [cupons],
  );

  const alternar = async (c) => {
    try {
      await ligar.mutateAsync({ arenaId, couponId: c.id, active: c.active === false });
      toast.success(c.active === false ? 'Cupom religado.' : 'Cupom desligado.');
    } catch (err) {
      toast.error(err?.message || 'Não foi possível alterar o cupom.');
    }
  };

  const remover = async (c) => {
    try {
      await apagar.mutateAsync({ arenaId, couponId: c.id });
      toast.success('Cupom apagado.');
    } catch (err) {
      toast.error(err?.message || 'Não foi possível apagar.');
    }
  };

  return (
    <V2Surface>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Tag className="h-5 w-5 text-ink" />
          <h2 className="font-display text-lg font-bold text-ink">Cupons</h2>
        </div>
        {!form && (
          <V2Button size="sm" onClick={() => setForm('novo')}>
            <Plus className="mr-1.5 h-4 w-4" /> Novo cupom
          </V2Button>
        )}
      </div>

      {form && (
        <div className="mb-4">
          <CupomForm arenaId={arenaId} cupom={form === 'novo' ? null : form} onClose={() => setForm(null)} />
        </div>
      )}

      {isLoading && <V2Skeleton className="h-24 rounded-2xl" />}

      {isError && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="flex items-center gap-2 font-bold"><AlertTriangle className="h-4 w-4" /> Não foi possível carregar os cupons.</p>
          <p className="mt-1 text-xs">Isto é uma falha de leitura — não quer dizer que a arena não tenha cupons.</p>
          <V2Button size="sm" variant="ghost" className="mt-2" onClick={() => refetch()}>Tentar de novo</V2Button>
        </div>
      )}

      {!isLoading && !isError && ordenados.length === 0 && !form && (
        <V2EmptyState
          icon={Tag}
          title="Nenhum cupom ainda"
          description="Um cupom é a forma mais direta de trazer gente numa semana fraca. Quem reserva digita o código e o desconto entra no preço."
          action={<V2Button size="sm" onClick={() => setForm('novo')}>Criar o primeiro</V2Button>}
        />
      )}

      {ordenados.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {ordenados.map((c) => {
            const desligado = c.active === false;
            const esgotado = c.max_uses && (c.used_count || 0) >= c.max_uses;
            const vencido = ms(c.expires_at) && ms(c.expires_at) < Date.now();
            return (
              <div key={c.id} className={`rounded-2xl border p-3 ${desligado ? 'border-gray-100 bg-gray-50 opacity-70' : 'border-gray-100 bg-paper'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-display text-base font-bold tracking-wide text-ink">{c.code}</p>
                    <p className="text-sm text-gray-600">{couponLabel(c)}</p>
                    {c.description && <p className="mt-0.5 text-xs text-gray-500">{c.description}</p>}
                  </div>
                  <V2Badge tone={desligado ? 'neutral' : esgotado || vencido ? 'amber' : 'green'}>
                    {desligado ? 'Desligado' : esgotado ? 'Esgotado' : vencido ? 'Vencido' : 'Ativo'}
                  </V2Badge>
                </div>

                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                  <span>{c.used_count || 0}{c.max_uses ? ` de ${c.max_uses}` : ''} usos</span>
                  {c.min_amount ? <span>mín. {formatPrice(c.min_amount)}</span> : null}
                  {iso(c.expires_at) ? <span>até {formatDateShortBR(iso(c.expires_at))}</span> : null}
                  {c.once_per_user !== false ? <span>1 por pessoa</span> : null}
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <V2Button size="sm" variant="ghost" onClick={() => setForm(c)}>
                    <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
                  </V2Button>
                  <V2Button size="sm" variant="ghost" onClick={() => alternar(c)}>
                    {desligado ? 'Religar' : 'Desligar'}
                  </V2Button>
                  <ConfirmDialog
                    title={`Apagar o cupom ${c.code}?`}
                    description={`Apagar leva junto a contagem de ${c.used_count || 0} uso(s) — depois não dá para saber quanto essa promoção rendeu. Se a ideia é só parar de aceitar o código, use "Desligar".`}
                    confirmLabel="Apagar mesmo assim"
                    destructive
                    onConfirm={() => remover(c)}
                    trigger={(
                      <V2Button size="sm" variant="ghost" className="text-red-600">
                        <Trash2 className="mr-1 h-3.5 w-3.5" /> Apagar
                      </V2Button>
                    )}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

    </V2Surface>
  );
}

/* ===================================================== 2. CAMPANHAS ====== */

function CampanhasSecao({ arenaId }) {
  const { data: campanhas = [] } = useArenaCampaigns(arenaId);
  const { data: membros = [] } = useArenaMembers(arenaId);
  const { data: reservas = [] } = useArenaBookings(arenaId);
  const enviar = useSendCampaign();

  const [form, setForm] = useState({ name: '', message: '', audience: CAMPAIGN_AUDIENCE.ALL });
  const [aberto, setAberto] = useState(false);
  const [confirmar, setConfirmar] = useState(false);

  // Só reserva CONCLUÍDA conta como "já jogou aqui" — pedido recusado não é
  // relação com a arena, e mandar "sentimos sua falta" a quem nunca veio é o
  // tipo de mensagem que faz desinstalar o aplicativo.
  const concluidas = useMemo(
    () => reservas.filter((b) => ['completed', 'confirmed'].includes(b.status)),
    [reservas],
  );

  const destinatarios = useMemo(
    () => campaignRecipients(form.audience, { members: membros, bookings: concluidas }),
    [form.audience, membros, concluidas],
  );

  const disparar = async () => {
    try {
      const { sent } = await enviar.mutateAsync({
        arenaId,
        input: { name: form.name, message: form.message, audience: form.audience },
        recipients: destinatarios,
      });
      toast.success(`Campanha enviada para ${sent} pessoa(s).`);
      setForm({ name: '', message: '', audience: CAMPAIGN_AUDIENCE.ALL });
      setAberto(false);
      setConfirmar(false);
    } catch (err) {
      toast.error(err?.message || 'Não foi possível enviar.');
      setConfirmar(false);
    }
  };

  const podeEnviar = form.name.trim() && form.message.trim() && destinatarios.length > 0;

  return (
    <V2Surface>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-ink" />
          <h2 className="font-display text-lg font-bold text-ink">Campanhas</h2>
        </div>
        {!aberto && (
          <V2Button size="sm" onClick={() => setAberto(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Nova campanha
          </V2Button>
        )}
      </div>

      {aberto && (
        <div className="mb-4 rounded-2xl border border-gray-100 bg-paper p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-base font-bold text-ink">Nova campanha</h3>
            <button type="button" onClick={() => setAberto(false)} aria-label="Fechar" className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-ink">
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-400">Para quem vai</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.values(CAMPAIGN_AUDIENCE).map((a) => {
              const meta = CAMPAIGN_AUDIENCE_META[a];
              const quantos = campaignRecipients(a, { members: membros, bookings: concluidas }).length;
              const marcado = form.audience === a;
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, audience: a }))}
                  className={`rounded-2xl border p-3 text-left transition ${marcado ? 'border-ink bg-ink/5' : 'border-gray-200 bg-paper-pure hover:border-gray-300'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-ink">{meta.label}</span>
                    <V2Badge tone={quantos > 0 ? 'green' : 'neutral'}>
                      {quantos} {quantos === 1 ? 'pessoa' : 'pessoas'}
                    </V2Badge>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{meta.hint}</p>
                </button>
              );
            })}
          </div>

          <V2Field label="Nome da campanha" htmlFor="camp-nome" className="mt-3"
            hint="É o título do aviso que a pessoa recebe.">
            <V2Input id="camp-nome" maxLength={80} required placeholder="Quinta com 20% de desconto"
              value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </V2Field>
          <V2Field label="Mensagem" htmlFor="camp-msg" className="mt-3">
            <V2Textarea id="camp-msg" rows={3} maxLength={1000} required
              placeholder="Escreva como falaria no balcão. Diga o que é, quando vale e o que a pessoa precisa fazer."
              value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} />
          </V2Field>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-gray-500">
              {destinatarios.length === 0
                ? 'Ninguém neste público ainda — escolha outro.'
                : <>Vai para <strong className="text-ink">{destinatarios.length}</strong> {destinatarios.length === 1 ? 'pessoa' : 'pessoas'}, como aviso dentro do aplicativo.</>}
            </p>
            <div className="flex gap-2">
              <V2Button variant="ghost" onClick={() => setAberto(false)}>Cancelar</V2Button>
              <V2Button disabled={!podeEnviar || enviar.isPending} onClick={() => setConfirmar(true)}>
                <Send className="mr-1.5 h-4 w-4" /> {enviar.isPending ? 'Enviando…' : 'Enviar'}
              </V2Button>
            </div>
          </div>
        </div>
      )}

      {campanhas.length === 0 ? (
        <V2EmptyState
          icon={Megaphone}
          title="Nenhuma campanha enviada"
          description="Uma campanha avisa a sua comunidade dentro do aplicativo. Vale para chamar os sumidos de volta ou encher um horário vago."
        />
      ) : (
        <div className="space-y-2">
          {[...campanhas]
            .sort((a, b) => (ms(b.sent_at) || ms(b.created_at) || 0) - (ms(a.sent_at) || ms(a.created_at) || 0))
            .map((c) => (
              <div key={c.id} className="rounded-2xl border border-gray-100 bg-paper p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-ink">{c.name}</p>
                    {c.message && <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{c.message}</p>}
                  </div>
                  <V2Badge tone={c.status === 'sent' ? 'green' : 'amber'}>
                    {c.status === 'sent' ? 'Enviada' : 'Rascunho'}
                  </V2Badge>
                </div>
                <p className="mt-2 flex flex-wrap gap-x-3 text-xs text-gray-500">
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" /> {c.sent_count || 0} {c.sent_count === 1 ? 'pessoa' : 'pessoas'}
                  </span>
                  {CAMPAIGN_AUDIENCE_META[c.target_audience]
                    && <span>{CAMPAIGN_AUDIENCE_META[c.target_audience].label}</span>}
                  {iso(c.sent_at) && <span>{formatDateShortBR(iso(c.sent_at))}</span>}
                </p>
              </div>
            ))}
        </div>
      )}

      <ConfirmDialogControlado
        open={confirmar}
        onOpenChange={setConfirmar}
        title={`Enviar para ${destinatarios.length} ${destinatarios.length === 1 ? 'pessoa' : 'pessoas'}?`}
        description="O aviso chega na hora e não dá para cancelar depois. Confira o texto — é a sua arena falando."
        confirmLabel="Enviar agora"
        destructive={false}
        onConfirm={disparar}
      />
    </V2Surface>
  );
}

/* ========================================================== 3. NPS ====== */

const NPS_TONE = { promoter: 'green', passive: 'amber', detractor: 'red' };
const NPS_LABEL = { promoter: 'Promotor', passive: 'Neutro', detractor: 'Detrator' };

function NpsSecao({ arenaId }) {
  const { data: resumo } = useArenaNps(arenaId);
  const { data: respostas = [], isLoading } = useArenaNpsResponses(arenaId);

  const comentarios = useMemo(
    () => [...respostas]
      .filter((r) => String(r.comment || '').trim())
      .sort((a, b) => (ms(b.created_at) || 0) - (ms(a.created_at) || 0))
      .slice(0, 12),
    [respostas],
  );

  const total = respostas.length;
  const contagem = useMemo(() => respostas.reduce((acc, r) => {
    const k = classifyNps(r.score);
    return { ...acc, [k]: (acc[k] || 0) + 1 };
  }, { promoter: 0, passive: 0, detractor: 0 }), [respostas]);

  const nota = Number(resumo?.nps);
  const temNota = Number.isFinite(nota) && total > 0;

  return (
    <V2Surface>
      <div className="mb-4 flex items-center gap-2">
        <Star className="h-5 w-5 text-ink" />
        <h2 className="font-display text-lg font-bold text-ink">Satisfação (NPS)</h2>
      </div>

      {isLoading && <V2Skeleton className="h-24 rounded-2xl" />}

      {!isLoading && total === 0 && (
        <V2EmptyState
          icon={Star}
          title="Ninguém respondeu ainda"
          description="A pergunta aparece sozinha para quem jogou aqui nos últimos 30 dias, uma vez a cada 90 dias. Ela não é feita a quem nunca veio."
        />
      )}

      {!isLoading && total > 0 && (
        <>
          <div className="flex flex-wrap items-end gap-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400">NPS</p>
              <p className="font-display text-4xl font-bold text-ink">{temNota ? nota : '—'}</p>
              <p className="text-xs text-gray-500">{total} {total === 1 ? 'resposta' : 'respostas'}</p>
            </div>
            <div className="flex-1 space-y-1.5">
              {['promoter', 'passive', 'detractor'].map((k) => {
                const n = contagem[k] || 0;
                const pct = total > 0 ? Math.round((n / total) * 100) : 0;
                return (
                  <div key={k} className="flex items-center gap-2">
                    <span className="w-20 shrink-0 text-xs text-gray-500">{NPS_LABEL[k]}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className={`h-full rounded-full ${k === 'promoter' ? 'bg-green-500' : k === 'passive' ? 'bg-amber-400' : 'bg-red-400'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-10 shrink-0 text-right text-xs font-bold text-ink">{n}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="mt-3 flex items-start gap-1.5 rounded-2xl bg-paper p-3 text-xs leading-5 text-gray-500">
            <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            O NPS é a diferença entre a fatia de promotores (9-10) e a de detratores (0-6).
            Vai de −100 a 100; acima de 50 é considerado muito bom.
          </p>

          <div className="mt-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-400">
              O que estão dizendo
            </p>
            {comentarios.length === 0 ? (
              <p className="text-sm text-gray-500">
                As notas vieram sem comentário. O número diz que algo mudou; o comentário é o
                que diz o quê.
              </p>
            ) : (
              <ul className="space-y-2">
                {comentarios.map((r) => (
                  <li key={r.id} className="rounded-2xl border border-gray-100 bg-paper p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <V2Badge tone={NPS_TONE[classifyNps(r.score)]}>
                        {r.score} · {NPS_LABEL[classifyNps(r.score)]}
                      </V2Badge>
                      {iso(r.created_at) && (
                        <span className="text-xs text-gray-400">{formatDateShortBR(iso(r.created_at))}</span>
                      )}
                    </div>
                    <p className="mt-1.5 text-sm leading-6 text-gray-700">{r.comment}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </V2Surface>
  );
}

/* =================================================== 4. INDICAÇÕES ====== */

function IndicacoesSecao({ arenaId }) {
  const { data: membros = [] } = useArenaMembers(arenaId);
  const { data: atletas = [] } = useAthletes();
  const resgatar = useRedeemReferral();
  const [code, setCode] = useState('');
  const [q, setQ] = useState('');
  const [indicado, setIndicado] = useState(null);
  const [premio, setPremio] = useState(20);

  const resultados = useMemo(() => {
    const termo = q.trim().toLowerCase();
    if (!termo) return [];
    return atletas
      .filter((a) => `${a.platform_name || ''} ${a.full_name || ''}`.toLowerCase().includes(termo))
      .slice(0, 6);
  }, [atletas, q]);

  const enviar = async () => {
    try {
      const { reward } = await resgatar.mutateAsync({
        arenaId,
        code: code.trim().toUpperCase(),
        referredId: indicado.id,
        referredName: indicado.platform_name || indicado.full_name || 'Atleta',
        reward: Number(premio),
      });
      toast.success(`Indicação registrada. ${formatPrice(reward)} para cada lado.`);
      setCode(''); setQ(''); setIndicado(null);
    } catch (err) {
      toast.error(err?.message || 'Não foi possível registrar a indicação.');
    }
  };

  const pronto = code.trim().length >= 4 && indicado && Number(premio) > 0;

  return (
    <V2Surface>
      <div className="mb-2 flex items-center gap-2">
        <Gift className="h-5 w-5 text-ink" />
        <h2 className="font-display text-lg font-bold text-ink">Indique e ganhe</h2>
      </div>
      <p className="mb-4 text-sm text-gray-500">
        Cada membro tem um código na página dele. Quando alguém chegar dizendo que foi
        indicado, registre aqui: os <strong>dois lados</strong> recebem o mesmo crédito em
        carteira. O registro é feito pela arena porque só ela pode creditar saldo.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <V2Field label="Código de indicação" htmlFor="ref-code">
          <V2Input id="ref-code" maxLength={20} placeholder="ABC123"
            value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s+/g, ''))} />
        </V2Field>
        <V2Field label="Crédito para cada lado (R$)" htmlFor="ref-premio">
          <V2Input id="ref-premio" type="number" min="1" step="0.01"
            value={premio} onChange={(e) => setPremio(e.target.value)} />
        </V2Field>
      </div>

      <V2Field label="Quem foi indicado" htmlFor="ref-quem" className="mt-3">
        {indicado ? (
          <div className="flex items-center justify-between gap-2 rounded-2xl border border-gray-200 bg-paper p-2.5">
            <div className="flex items-center gap-2">
              <V2Avatar photoUrl={indicado.photo_url} name={indicado.platform_name || indicado.full_name} size="sm" />
              <span className="text-sm font-bold text-ink">{indicado.platform_name || indicado.full_name}</span>
            </div>
            <button type="button" onClick={() => setIndicado(null)} aria-label="Trocar" className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-ink">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <V2Input id="ref-quem" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar atleta pelo nome…" />
        )}
      </V2Field>

      {!indicado && resultados.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {resultados.map((a) => (
            <button key={a.id} type="button" onClick={() => { setIndicado(a); setQ(''); }}
              className="flex w-full items-center gap-2 rounded-2xl border border-gray-100 bg-paper p-2.5 text-left hover:border-gray-300">
              <V2Avatar photoUrl={a.photo_url} name={a.platform_name || a.full_name} size="sm" />
              <span className="text-sm text-ink">{a.platform_name || a.full_name}</span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 flex justify-end">
        <V2Button disabled={!pronto || resgatar.isPending} onClick={enviar}>
          <Check className="mr-1.5 h-4 w-4" />
          {resgatar.isPending ? 'Registrando…' : 'Registrar indicação'}
        </V2Button>
      </div>

      {membros.length === 0 && (
        <p className="mt-3 text-xs text-gray-500">
          Esta arena ainda não tem membros — o código de indicação nasce com o primeiro.
        </p>
      )}
    </V2Surface>
  );
}

/* ======================================================== A PÁGINA ====== */

export default function V2ArenaMarketing() {
  const { arenaId } = useParams();
  const { user, isPlatformAdmin } = useAuth();
  const { data: arena, isLoading } = useArena(arenaId);
  const { data: managed = [] } = useMyManagedArenas();
  const { isOn, isLoading: modulosCarregando } = useArenaModules(arenaId);

  if (isLoading || modulosCarregando) {
    return <V2Skeleton className="mx-auto h-96 max-w-[1100px] rounded-4xl" />;
  }

  if (!arena) {
    return (
      <div className="mx-auto max-w-[700px]">
        <V2Surface>
          <V2EmptyState
            title="Arena não encontrada"
            action={<Link to="/arenas" className="text-sm font-bold text-ink underline">← Voltar ao diretório</Link>}
          />
        </V2Surface>
      </div>
    );
  }

  const podeGerir = arena.owner_id === user?.uid
    || managed.some((m) => m.id === arena.id)
    || isPlatformAdmin;

  // Esta é a mesa da arena, não uma tela pública. Quem não gere volta para a
  // página da arena — onde a parte que lhe cabe (o cupom, a pergunta de NPS)
  // já aparece no momento certo.
  if (!podeGerir || !isOn(ARENA_MODULE_ID.MARKETING)) {
    return <Navigate to={`/arenas/${arenaId}`} replace />;
  }

  const cupons = isOn(ARENA_MODULE_ID.MARKETING_COUPONS);
  const campanhas = isOn(ARENA_MODULE_ID.MARKETING_CAMPAIGNS);
  const nps = isOn(ARENA_MODULE_ID.MARKETING_NPS);
  const indicacoes = isOn(ARENA_MODULE_ID.MARKETING_REFERRAL);
  const nenhum = !cupons && !campanhas && !nps && !indicacoes;

  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="mb-6">
        <Link to={`/arenas/${arena.id}/gerir`} className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar para a gestão
        </Link>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
          Marketing e fidelidade
        </h1>
        <p className="mt-2 font-medium text-gray-500">
          {arena.name} · cupons, campanhas, satisfação e indicações.
        </p>
      </div>

      {nenhum ? (
        <V2Surface>
          <V2EmptyState
            icon={MessageSquare}
            title="Nenhuma ferramenta de marketing ativa"
            description="Ative o que quiser usar em Gestão → Configurações → Módulos. Cada ferramenta liga separadamente."
            action={(
              <Link to={`/arenas/${arena.id}/gerir?secao=configuracoes&aba=modulos`} className="text-sm font-bold text-ink underline">
                Abrir os módulos
              </Link>
            )}
          />
        </V2Surface>
      ) : (
        <div className="space-y-6">
          {cupons && <CuponsSecao arenaId={arena.id} />}
          {campanhas && <CampanhasSecao arenaId={arena.id} />}
          {nps && <NpsSecao arenaId={arena.id} />}
          {indicacoes && <IndicacoesSecao arenaId={arena.id} />}
        </div>
      )}
    </div>
  );
}
