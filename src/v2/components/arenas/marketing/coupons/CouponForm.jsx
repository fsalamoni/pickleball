/**
 * Criar ou editar um cupom — de QUALQUER tipo.
 *
 * Criar começa pelo TIPO (o que o cupom dá), em cartões agrupados pela
 * família: desconto na reserva, vale para usar na arena, indique e ganhe.
 * Escolher o tipo primeiro é o que deixa o formulário curto — cada família
 * pergunta só o que se aplica a ela (o vale não tem "% de desconto"; a
 * indicação não tem código para digitar).
 *
 * Editar mantém o tipo: trocar um vale de bebida por um desconto de 10% não é
 * editar, é outro cupom — e a contagem de usos do vale deixaria de fazer
 * sentido.
 *
 * O custo unitário do vale é pedido aqui, com o aviso de que só a arena o vê:
 * ele não vai para o cupom (legível por qualquer conta logada), vai para as
 * configurações da arena.
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, Lock, X } from 'lucide-react';
import { useCreateCoupon, useUpdateCoupon } from '@/modules/arenas/hooks/useArenaV3';
import {
  COUPON_FAMILY, COUPON_KIND, COUPON_KIND_META, COUPON_TYPE, REFERRED_REWARD,
  couponFamily, couponKind, couponLabel, normalizeCouponInput, referralRulesText,
} from '@/modules/arenas/domain/marketing';
import { formatPrice } from '@/modules/arenas/domain/pricing';
import { instanteEmMs } from '@/core/domain/instant';
import { V2Button, V2Field, V2Input } from '@/v2/ui/primitives';
import { COUPON_KIND_ICON, kindGroups } from './couponKindUi';

/** ms → 'YYYY-MM-DD' para o campo de data. */
function dataDoCampo(v) {
  const n = instanteEmMs(v);
  if (!Number.isFinite(n) || n <= 0) return '';
  const d = new Date(n);
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const vazioSeNulo = (v) => (v == null ? '' : v);

function estadoInicial(cupom, kind, unitCost) {
  if (!cupom) {
    return {
      kind,
      code: '', type: COUPON_TYPE.PERCENT, value: kind === COUPON_KIND.FREE_HOURS ? 1 : 10,
      benefit: '', face_value: '', unit_cost: '',
      description: '', max_uses: '', min_amount: '', once_per_user: true, expires_at: '',
      active: true, show_public: false, show_home: false,
      referrer_reward: 20, referred_reward_kind: REFERRED_REWARD.CREDIT, referred_reward_value: 20,
      first_booking_only: true, max_per_referrer: '',
    };
  }
  return {
    kind: couponKind(cupom),
    code: cupom.code || '',
    type: cupom.type || COUPON_TYPE.PERCENT,
    value: vazioSeNulo(cupom.value),
    benefit: cupom.benefit || '',
    face_value: vazioSeNulo(cupom.face_value),
    unit_cost: vazioSeNulo(unitCost),
    description: cupom.description || '',
    max_uses: vazioSeNulo(cupom.max_uses),
    min_amount: vazioSeNulo(cupom.min_amount),
    once_per_user: cupom.once_per_user !== false,
    expires_at: dataDoCampo(cupom.expires_at),
    active: cupom.active !== false,
    show_public: cupom.show_public === true,
    show_home: cupom.show_home === true,
    referrer_reward: vazioSeNulo(cupom.referrer_reward),
    referred_reward_kind: cupom.referred_reward_kind || REFERRED_REWARD.CREDIT,
    referred_reward_value: vazioSeNulo(cupom.referred_reward_value),
    first_booking_only: cupom.first_booking_only !== false,
    max_per_referrer: vazioSeNulo(cupom.max_per_referrer),
  };
}

/** O que vai para o serviço — números como números, vazio como `null`. */
function paraEnvio(form) {
  const n = (v) => (v === '' || v == null ? null : Number(v));
  return {
    ...form,
    value: n(form.value),
    face_value: n(form.face_value),
    max_uses: n(form.max_uses),
    min_amount: n(form.min_amount),
    referrer_reward: n(form.referrer_reward),
    referred_reward_value: n(form.referred_reward_value),
    max_per_referrer: n(form.max_per_referrer),
    expires_at: form.expires_at ? new Date(`${form.expires_at}T23:59:59`).getTime() : null,
  };
}

/** Seletor de tipo: um cartão por tipo, agrupados pela família. */
export function CouponKindPicker({ referralOn, onPick }) {
  return (
    <div className="space-y-4">
      {kindGroups({ referralOn }).map((grupo) => (
        <section key={grupo.family} aria-label={grupo.label}>
          <h4 className="text-xs font-bold uppercase tracking-widest text-gray-500">{grupo.label}</h4>
          <p className="mb-2 text-xs text-gray-500">{grupo.hint}</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {grupo.kinds.map(({ kind, label, hint, icon: Icon }) => (
              <button
                key={kind}
                type="button"
                onClick={() => onPick(kind)}
                className="flex items-start gap-2.5 rounded-2xl border border-gray-200 bg-paper-pure p-3 text-left transition-colors hover:border-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-paper text-ink">
                  {Icon && <Icon className="h-4 w-4" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-ink">{label}</span>
                  <span className="block text-xs leading-5 text-gray-500">{hint}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

const inputClasse = 'h-11 w-full rounded-2xl border border-gray-200 bg-paper-pure px-4 text-sm';

export default function CouponForm({ arenaId, cupom = null, initialKind = null, referralOn = false, unitCost = null, onClose }) {
  const [kind, setKind] = useState(cupom ? couponKind(cupom) : initialKind);
  const [form, setForm] = useState(() => estadoInicial(cupom, kind || COUPON_KIND.DISCOUNT, unitCost));
  const criar = useCreateCoupon();
  const editar = useUpdateCoupon();
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const escolherTipo = (k) => {
    setKind(k);
    setForm(estadoInicial(null, k, null));
  };

  // A prévia usa a MESMA normalização do serviço: o que a arena lê aqui é
  // exatamente o que vai ser gravado.
  const previa = useMemo(() => normalizeCouponInput(paraEnvio({ ...form, kind })), [form, kind]);
  const familia = kind ? couponFamily({ kind }) : null;
  const meta = kind ? COUPON_KIND_META[kind] : null;
  const Icone = kind ? COUPON_KIND_ICON[kind] : null;
  const salvando = criar.isPending || editar.isPending;

  const submit = async (e) => {
    e.preventDefault();
    if (!previa.valid) {
      toast.error(Object.values(previa.errors)[0]);
      return;
    }
    const input = paraEnvio({ ...form, kind });
    // O custo unitário só existe no vale; nos outros tipos não é enviado.
    if (familia !== COUPON_FAMILY.VOUCHER) delete input.unit_cost;
    try {
      if (cupom) await editar.mutateAsync({ arenaId, couponId: cupom.id, input });
      else await criar.mutateAsync({ arenaId, input });
      toast.success(cupom ? 'Cupom atualizado.' : 'Cupom criado.');
      onClose();
    } catch (err) {
      toast.error(err?.message || 'Não foi possível salvar o cupom.');
    }
  };

  const cabecalho = (
    <div className="mb-3 flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        {!cupom && kind && !initialKind && (
          <button type="button" onClick={() => setKind(null)} aria-label="Escolher outro tipo"
            className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-ink">
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        {Icone && <Icone className="h-4 w-4 shrink-0 text-ink" />}
        <h3 className="truncate font-display text-base font-bold text-ink">
          {cupom ? `Editar ${cupom.code}` : kind ? `Novo cupom · ${meta.label}` : 'Novo cupom: o que ele dá?'}
        </h3>
      </div>
      <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-ink">
        <X className="h-4 w-4" />
      </button>
    </div>
  );

  if (!kind) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-paper p-4">
        {cabecalho}
        <CouponKindPicker referralOn={referralOn} onPick={escolherTipo} />
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-gray-100 bg-paper p-4">
      {cabecalho}
      {meta?.hint && <p className="mb-3 text-xs text-gray-500">{meta.hint}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        {familia !== COUPON_FAMILY.REFERRAL && (
          <V2Field label="Código" htmlFor="cup-code" hint="É o que a pessoa digita ou mostra. Sempre em maiúsculas.">
            <V2Input id="cup-code" required maxLength={30} placeholder={familia === COUPON_FAMILY.VOUCHER ? 'COCO' : 'VERAO10'}
              value={form.code} onChange={(e) => set({ code: e.target.value.toUpperCase().replace(/\s+/g, '') })} />
          </V2Field>
        )}

        {kind === COUPON_KIND.DISCOUNT && (
          <>
            <V2Field label="Tipo de desconto" htmlFor="cup-tipo">
              <select id="cup-tipo" value={form.type} onChange={(e) => set({ type: e.target.value })} className={inputClasse}>
                <option value={COUPON_TYPE.PERCENT}>Percentual (%)</option>
                <option value={COUPON_TYPE.FIXED}>Valor fixo (R$)</option>
              </select>
            </V2Field>
            <V2Field label={form.type === COUPON_TYPE.PERCENT ? 'Desconto (%)' : 'Desconto (R$)'} htmlFor="cup-valor">
              <V2Input id="cup-valor" type="number" min="0.01" step="0.01" required
                max={form.type === COUPON_TYPE.PERCENT ? '100' : undefined}
                value={form.value} onChange={(e) => set({ value: e.target.value })} />
            </V2Field>
          </>
        )}

        {kind === COUPON_KIND.FREE_HOURS && (
          <V2Field label="Horas grátis" htmlFor="cup-horas" hint="De meia em meia hora. Abate a proporção das horas da reserva.">
            <V2Input id="cup-horas" type="number" min="0.5" max="24" step="0.5" required
              value={form.value} onChange={(e) => set({ value: e.target.value })} />
          </V2Field>
        )}

        {familia === COUPON_FAMILY.VOUCHER && (
          <>
            <V2Field label="O que o vale dá" htmlFor="cup-beneficio" className="sm:col-span-2"
              hint="Escreva como a pessoa vai ler na recepção.">
              <V2Input id="cup-beneficio" required maxLength={120} placeholder={meta?.example || ''}
                value={form.benefit} onChange={(e) => set({ benefit: e.target.value })} />
            </V2Field>
            <V2Field label="Valor para o cliente (R$)" htmlFor="cup-face" hint="Quanto custaria sem o vale. Opcional.">
              <V2Input id="cup-face" type="number" min="0" step="0.01" placeholder="Opcional"
                value={form.face_value} onChange={(e) => set({ face_value: e.target.value })} />
            </V2Field>
            <V2Field label="Custo para a arena (R$)" htmlFor="cup-custo"
              hint={<span className="inline-flex items-center gap-1"><Lock className="h-3 w-3" /> Só a arena vê. Entra no controle de uso.</span>}>
              <V2Input id="cup-custo" type="number" min="0" step="0.01" placeholder="Opcional"
                value={form.unit_cost} onChange={(e) => set({ unit_cost: e.target.value })} />
            </V2Field>
          </>
        )}

        {familia === COUPON_FAMILY.REFERRAL && (
          <>
            <V2Field label="Quem indica ganha (R$ em crédito)" htmlFor="ind-quem-indica"
              hint="Creditado na carteira quando a indicação é registrada.">
              <V2Input id="ind-quem-indica" type="number" min="0" step="0.01"
                value={form.referrer_reward} onChange={(e) => set({ referrer_reward: e.target.value })} />
            </V2Field>
            <V2Field label="Quem chega ganha" htmlFor="ind-tipo">
              <select id="ind-tipo" value={form.referred_reward_kind}
                onChange={(e) => set({ referred_reward_kind: e.target.value })} className={inputClasse}>
                <option value={REFERRED_REWARD.CREDIT}>Crédito em carteira (R$)</option>
                <option value={REFERRED_REWARD.PERCENT}>Desconto na primeira reserva (%)</option>
                <option value={REFERRED_REWARD.FIXED}>Desconto na primeira reserva (R$)</option>
                <option value={REFERRED_REWARD.NONE}>Nada — só quem indica ganha</option>
              </select>
            </V2Field>
            {form.referred_reward_kind !== REFERRED_REWARD.NONE && (
              <V2Field label={form.referred_reward_kind === REFERRED_REWARD.PERCENT ? 'Desconto (%)' : 'Valor (R$)'} htmlFor="ind-valor"
                hint={form.referred_reward_kind === REFERRED_REWARD.CREDIT
                  ? 'Creditado na carteira de quem chegou.'
                  : 'Abatido da primeira reserva, quando a arena confirma o código.'}>
                <V2Input id="ind-valor" type="number" min="0" step="0.01"
                  value={form.referred_reward_value} onChange={(e) => set({ referred_reward_value: e.target.value })} />
              </V2Field>
            )}
            <V2Field label="Limite de indicações por pessoa" htmlFor="ind-limite" hint="Vazio = sem limite.">
              <V2Input id="ind-limite" type="number" min="1" placeholder="Sem limite"
                value={form.max_per_referrer} onChange={(e) => set({ max_per_referrer: e.target.value })} />
            </V2Field>
          </>
        )}

        {familia !== COUPON_FAMILY.VOUCHER && (
          <V2Field label={familia === COUPON_FAMILY.REFERRAL ? 'Primeira reserva a partir de (R$)' : 'Valor mínimo da conta (R$)'}
            htmlFor="cup-min" hint="Vazio = sem mínimo.">
            <V2Input id="cup-min" type="number" min="0" step="0.01" placeholder="Sem mínimo"
              value={form.min_amount} onChange={(e) => set({ min_amount: e.target.value })} />
          </V2Field>
        )}

        {familia !== COUPON_FAMILY.REFERRAL && (
          <V2Field label="Usos máximos" htmlFor="cup-max" hint="Vazio = ilimitado.">
            <V2Input id="cup-max" type="number" min="1" placeholder="Ilimitado"
              value={form.max_uses} onChange={(e) => set({ max_uses: e.target.value })} />
          </V2Field>
        )}

        <V2Field label="Vale até" htmlFor="cup-exp" hint="Vazio = sem prazo.">
          <V2Input id="cup-exp" type="date" value={form.expires_at}
            onChange={(e) => set({ expires_at: e.target.value })} />
        </V2Field>
      </div>

      <V2Field label="Descrição" htmlFor="cup-desc" className="mt-3"
        hint={familia === COUPON_FAMILY.REFERRAL ? 'Aparece para o atleta no "Indique e ganhe".' : 'Aparece para quem usa o código. Diga a regra em uma linha.'}>
        <V2Input id="cup-desc" maxLength={160}
          placeholder={{
            [COUPON_FAMILY.REFERRAL]: 'Traga um amigo que nunca jogou aqui',
            [COUPON_FAMILY.VOUCHER]: 'Vale de segunda a quinta, até as 18h',
          }[familia] || '10% na primeira reserva do mês'}
          value={form.description} onChange={(e) => set({ description: e.target.value })} />
      </V2Field>

      {familia === COUPON_FAMILY.REFERRAL ? (
        <label className="mt-3 flex items-start gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={form.first_booking_only}
            onChange={(e) => set({ first_booking_only: e.target.checked })}
            className="mt-0.5 h-4 w-4 rounded border-gray-300" />
          <span>
            Vale só para quem nunca reservou nesta arena
            <span className="block text-xs text-gray-500">
              É o que faz a indicação trazer gente nova. Desmarcado, qualquer pessoa indicada conta.
            </span>
          </span>
        </label>
      ) : (
        <>
          <label className="mt-3 flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={form.once_per_user}
              onChange={(e) => set({ once_per_user: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300" />
            Cada pessoa pode usar uma vez só
          </label>
          <label className="mt-2 flex items-start gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={form.show_public}
              onChange={(e) => set({ show_public: e.target.checked, ...(e.target.checked ? {} : { show_home: false }) })}
              className="mt-0.5 h-4 w-4 rounded border-gray-300" />
            <span>
              Divulgar na página da arena
              <span className="block text-xs text-gray-500">
                {familia === COUPON_FAMILY.BOOKING
                  ? 'Vira PROMOÇÃO: aparece na página da arena e no pedido de reserva, com um toque para aplicar.'
                  : 'Aparece na página da arena com o código, para mostrar na recepção.'}
                {' '}Sem marcar, o cupom é um código que você entrega a quem quiser.
              </span>
            </span>
          </label>
          {form.show_public && (
            <label className="ml-6 mt-2 flex items-start gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={form.show_home}
                onChange={(e) => set({ show_home: e.target.checked })}
                className="mt-0.5 h-4 w-4 rounded border-gray-300" />
              <span>
                Também como banner na tela inicial
                <span className="block text-xs text-gray-500">
                  Aparece para quem é da cidade da arena (ou escolheu ver essa região), no carrossel de promoções da tela inicial.
                </span>
              </span>
            </label>
          )}
        </>
      )}

      {previa.valid && (
        <p className="mt-3 rounded-2xl bg-paper-pure p-3 text-xs text-gray-600">
          Vai valer como:{' '}
          <strong className="text-ink">
            {familia === COUPON_FAMILY.REFERRAL ? referralRulesText(previa.value) : couponLabel(previa.value)}
          </strong>
          {previa.value.min_amount ? ` · a partir de ${formatPrice(previa.value.min_amount)}` : ''}
          {familia !== COUPON_FAMILY.REFERRAL && (previa.value.max_uses ? ` · até ${previa.value.max_uses} usos` : ' · usos ilimitados')}
          {familia === COUPON_FAMILY.REFERRAL && previa.value.max_per_referrer ? ` · até ${previa.value.max_per_referrer} por pessoa` : ''}
        </p>
      )}

      <div className="mt-3 flex justify-end gap-2">
        <V2Button type="button" variant="ghost" onClick={onClose}>Cancelar</V2Button>
        <V2Button type="submit" disabled={salvando}>
          {salvando ? 'Salvando…' : cupom ? 'Salvar' : familia === COUPON_FAMILY.REFERRAL ? 'Salvar as regras' : 'Criar cupom'}
        </V2Button>
      </div>
    </form>
  );
}
