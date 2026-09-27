/**
 * Criar ou editar um cupom da PLATAFORMA ou de um PROFESSOR (Onda CG).
 *
 * O mesmo desenho do formulário da arena: começa pelo TIPO (o que o cupom dá),
 * cada família pergunta só o que se aplica, a arte é o mesmo tíquete com os
 * mesmos cinco modelos (e os modelos do emissor), e a prévia usa a MESMA
 * normalização do serviço — o que se lê aqui é o que vai ser gravado.
 *
 * O que muda por emissor: os tipos (o professor fala em "desconto na aula"),
 * onde o cupom é divulgado (vitrine de promoções × perfil do professor), o
 * alcance na tela inicial e — só para o professor — "só para os meus alunos".
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, Lock, X } from 'lucide-react';
import { COUPON_KIND, COUPON_TYPE, couponLabel } from '@/modules/arenas/domain/marketing';
import {
  PROMO_FAMILY, PROMO_ISSUER, PROMO_KIND_META, PROMO_REACH, PROMO_VISIBILITY,
  normalizePromoCouponInput, promoBenefitText, promoFamily, reachLabel,
} from '@/modules/promo/domain/promo';
import { useCreatePromoCoupon, usePromoTemplatesSource, useUpdatePromoCoupon } from '@/modules/promo/hooks/usePromo';
import { instanteEmMs } from '@/core/domain/instant';
import { V2Button, V2Field, V2Input, V2Select } from '@/v2/ui/primitives';
import CouponArtEditor from '@/v2/components/arenas/marketing/coupons/CouponArtEditor';
import PromoReachPicker from './PromoReachPicker';
import { PROMO_KIND_ICON, issuerBrand, promoKindGroups, uploadFolderFor } from './promoUi';

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
      code: '', type: COUPON_TYPE.PERCENT, value: 10, benefit: '', face_value: '', unit_cost: '',
      description: '', max_uses: '', once_per_user: true, expires_at: '', active: true,
      show_public: false, show_home: false,
      reach: { mode: PROMO_REACH.BRASIL, state: '', city: '' },
      visibility: PROMO_VISIBILITY.ALL,
      kind,
    };
  }
  return {
    kind: cupom.kind || COUPON_KIND.DISCOUNT,
    code: cupom.code || '',
    type: cupom.type || COUPON_TYPE.PERCENT,
    value: vazioSeNulo(cupom.value),
    benefit: cupom.benefit || '',
    face_value: vazioSeNulo(cupom.face_value),
    unit_cost: vazioSeNulo(unitCost),
    description: cupom.description || '',
    max_uses: vazioSeNulo(cupom.max_uses),
    once_per_user: cupom.once_per_user !== false,
    expires_at: dataDoCampo(cupom.expires_at),
    active: cupom.active !== false,
    show_public: cupom.show_public === true,
    show_home: cupom.show_home === true,
    reach: cupom.reach || { mode: PROMO_REACH.BRASIL, state: '', city: '' },
    visibility: cupom.visibility === PROMO_VISIBILITY.STUDENTS ? PROMO_VISIBILITY.STUDENTS : PROMO_VISIBILITY.ALL,
  };
}

function paraEnvio(form) {
  const n = (v) => (v === '' || v == null ? null : Number(v));
  return {
    ...form,
    value: n(form.value),
    face_value: n(form.face_value),
    max_uses: n(form.max_uses),
    expires_at: form.expires_at ? new Date(`${form.expires_at}T23:59:59`).getTime() : null,
  };
}

/** Seletor de tipo: um cartão por tipo, agrupados pela família. */
function KindPicker({ issuerType, onPick }) {
  return (
    <div className="space-y-4">
      {promoKindGroups(issuerType).map((grupo) => (
        <section key={grupo.family} aria-label={grupo.label}>
          <h4 className="text-xs font-bold uppercase tracking-widest text-gray-500">{grupo.label}</h4>
          <p className="mb-2 text-xs text-gray-500">{grupo.hint}</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {grupo.kinds.map(({ kind, label, hint, icon: Icon }) => (
              <button key={kind} type="button" onClick={() => onPick(kind)}
                className="flex items-start gap-2.5 rounded-2xl border border-gray-200 bg-paper-pure p-3 text-left transition-colors hover:border-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ink">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-paper text-ink">
                  {Icon && <Icon className="h-4 w-4" aria-hidden />}
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

/**
 * @param {{
 *   issuer: { type: string, id: string, name: string },
 *   cupom?: object|null, unitCost?: number|null, onClose: Function,
 * }} props
 */
export default function PromoCouponForm({ issuer, cupom = null, unitCost = null, onClose }) {
  const issuerType = issuer.type;
  const ehProfessor = issuerType === PROMO_ISSUER.COACH;
  const [kind, setKind] = useState(cupom ? (cupom.kind || COUPON_KIND.DISCOUNT) : null);
  const [form, setForm] = useState(() => estadoInicial(cupom, kind || COUPON_KIND.DISCOUNT, unitCost));
  const [art, setArt] = useState(() => cupom?.art || null);
  const [artTocada, setArtTocada] = useState(false);
  const enviaArte = !cupom || artTocada;
  const criar = useCreatePromoCoupon();
  const editar = useUpdatePromoCoupon();
  const modelos = usePromoTemplatesSource(issuer, 'coupon');
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const previa = useMemo(
    () => normalizePromoCouponInput(paraEnvio({ ...form, kind, ...(enviaArte ? { art } : {}) }), { issuerType }),
    [form, kind, art, enviaArte, issuerType],
  );
  const familia = kind ? promoFamily({ kind }) : null;
  const meta = kind ? PROMO_KIND_META[issuerType]?.[kind] : null;
  const Icone = kind ? PROMO_KIND_ICON[kind] : null;
  const salvando = criar.isPending || editar.isPending;
  const onde = ehProfessor ? 'no seu perfil' : 'na vitrine de promoções';

  const escolherTipo = (k) => {
    setKind(k);
    setForm(estadoInicial(null, k, null));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!previa.valid) {
      toast.error(Object.values(previa.errors)[0]);
      return;
    }
    const input = paraEnvio({ ...form, kind, ...(enviaArte ? { art } : {}) });
    if (familia !== PROMO_FAMILY.VOUCHER) delete input.unit_cost;
    try {
      if (cupom) await editar.mutateAsync({ issuer, couponId: cupom.id, input });
      else await criar.mutateAsync({ issuer, input });
      toast.success(cupom ? 'Cupom atualizado.' : 'Cupom criado.');
      onClose();
    } catch (err) {
      toast.error(err?.message || 'Não foi possível salvar o cupom.');
    }
  };

  const cabecalho = (
    <div className="mb-3 flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        {!cupom && kind && (
          <button type="button" onClick={() => setKind(null)} aria-label="Escolher outro tipo"
            className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-ink">
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        {Icone && <Icone className="h-4 w-4 shrink-0 text-ink" aria-hidden />}
        <h3 className="truncate font-display text-base font-bold text-ink">
          {cupom ? `Editar ${cupom.code}` : kind ? `Novo cupom · ${meta?.label || ''}` : 'Novo cupom: o que ele dá?'}
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
        <KindPicker issuerType={issuerType} onPick={escolherTipo} />
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-gray-100 bg-paper p-4">
      {cabecalho}
      {meta?.hint && <p className="mb-3 text-xs text-gray-500">{meta.hint}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        <V2Field label="Código" htmlFor="pcup-code" hint="É o que a pessoa digita ou mostra. Sempre em maiúsculas.">
          <V2Input id="pcup-code" required maxLength={30} placeholder={familia === PROMO_FAMILY.VOUCHER ? 'BRINDE' : 'PRIMEIRA10'}
            value={form.code} onChange={(e) => set({ code: e.target.value.toUpperCase().replace(/\s+/g, '') })} />
        </V2Field>

        {kind === COUPON_KIND.DISCOUNT && (
          <>
            <V2Field label="Tipo de desconto" htmlFor="pcup-tipo">
              <V2Select id="pcup-tipo" value={form.type} onChange={(e) => set({ type: e.target.value })}>
                <option value={COUPON_TYPE.PERCENT}>Percentual (%)</option>
                <option value={COUPON_TYPE.FIXED}>Valor fixo (R$)</option>
              </V2Select>
            </V2Field>
            <V2Field label={form.type === COUPON_TYPE.PERCENT ? 'Desconto (%)' : 'Desconto (R$)'} htmlFor="pcup-valor">
              <V2Input id="pcup-valor" type="number" min="0.01" step="0.01" required
                max={form.type === COUPON_TYPE.PERCENT ? '100' : undefined}
                value={form.value} onChange={(e) => set({ value: e.target.value })} />
            </V2Field>
          </>
        )}

        {familia === PROMO_FAMILY.VOUCHER && (
          <>
            <V2Field label="O que o vale dá" htmlFor="pcup-beneficio" className="sm:col-span-2"
              hint="Escreva como a pessoa vai ler.">
              <V2Input id="pcup-beneficio" required maxLength={120} placeholder={meta?.example || ''}
                value={form.benefit} onChange={(e) => set({ benefit: e.target.value })} />
            </V2Field>
            <V2Field label="Valor para quem usa (R$)" htmlFor="pcup-face" hint="Quanto custaria sem o vale. Opcional.">
              <V2Input id="pcup-face" type="number" min="0" step="0.01" placeholder="Opcional"
                value={form.face_value} onChange={(e) => set({ face_value: e.target.value })} />
            </V2Field>
            <V2Field label={ehProfessor ? 'Custo para você (R$)' : 'Custo para a plataforma (R$)'} htmlFor="pcup-custo"
              hint={<span className="inline-flex items-center gap-1"><Lock className="h-3 w-3" aria-hidden /> Só você vê. Entra no controle de uso.</span>}>
              <V2Input id="pcup-custo" type="number" min="0" step="0.01" placeholder="Opcional"
                value={form.unit_cost} onChange={(e) => set({ unit_cost: e.target.value })} />
            </V2Field>
          </>
        )}

        <V2Field label="Usos máximos" htmlFor="pcup-max" hint="Vazio = ilimitado.">
          <V2Input id="pcup-max" type="number" min="1" placeholder="Ilimitado"
            value={form.max_uses} onChange={(e) => set({ max_uses: e.target.value })} />
        </V2Field>

        <V2Field label="Vale até" htmlFor="pcup-exp" hint="Vazio = sem prazo.">
          <V2Input id="pcup-exp" type="date" value={form.expires_at} onChange={(e) => set({ expires_at: e.target.value })} />
        </V2Field>
      </div>

      <V2Field label="Descrição" htmlFor="pcup-desc" className="mt-3" hint="Aparece para quem usa o código. Diga a regra em uma linha.">
        <V2Input id="pcup-desc" maxLength={160}
          placeholder={ehProfessor ? 'Para a primeira aula de quem nunca treinou comigo' : 'Válido no Open de Primavera'}
          value={form.description} onChange={(e) => set({ description: e.target.value })} />
      </V2Field>

      <section className="mt-4 rounded-2xl border border-gray-100 bg-paper-pure p-3" aria-label="Arte do cupom">
        <p className="font-display text-sm font-bold text-ink">Arte do cupom</p>
        <p className="mb-3 text-xs text-gray-500">
          É como o cupom aparece {onde}, na tela inicial e na lista. O código fica no canhoto — quem vê toca para copiar.
        </p>
        <CouponArtEditor
          value={art}
          onChange={(a) => { setArt(a); setArtTocada(true); }}
          templates={modelos}
          brand={issuerBrand(issuer)}
          uploadFolder={uploadFolderFor(issuer, 'coupon')}
          amostra={{
            code: form.code,
            benefit: previa.errors.value || previa.errors.benefit ? (meta?.label || '') : promoBenefitText({ ...previa.value, issuer_type: issuerType }),
            description: form.description,
          }}
        />
      </section>

      <label className="mt-3 flex items-center gap-2 text-sm text-gray-600">
        <input type="checkbox" checked={form.once_per_user} onChange={(e) => set({ once_per_user: e.target.checked })}
          className="h-4 w-4 rounded border-gray-300" />
        Cada pessoa pode usar uma vez só
      </label>

      {ehProfessor && (
        <label className="mt-2 flex items-start gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={form.visibility === PROMO_VISIBILITY.STUDENTS}
            onChange={(e) => set({ visibility: e.target.checked ? PROMO_VISIBILITY.STUDENTS : PROMO_VISIBILITY.ALL })}
            className="mt-0.5 h-4 w-4 rounded border-gray-300" />
          <span>
            Mostrar só para os meus alunos
            <span className="block text-xs text-gray-500">
              Na vitrine, no seu perfil e na tela inicial, só quem é seu aluno vê. Quem recebeu o código de você continua podendo usá-lo.
            </span>
          </span>
        </label>
      )}

      <label className="mt-2 flex items-start gap-2 text-sm text-gray-600">
        <input type="checkbox" checked={form.show_public}
          onChange={(e) => set({ show_public: e.target.checked, ...(e.target.checked ? {} : { show_home: false }) })}
          className="mt-0.5 h-4 w-4 rounded border-gray-300" />
        <span>
          {ehProfessor ? 'Divulgar no meu perfil e na vitrine de promoções' : 'Divulgar na vitrine de promoções'}
          <span className="block text-xs text-gray-500">
            Aparece com o código, para quem quiser usar. Sem marcar, o cupom é um código que você entrega a quem quiser.
          </span>
        </span>
      </label>
      {form.show_public && (
        <div className="ml-6 mt-2 space-y-3">
          <label className="flex items-start gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={form.show_home} onChange={(e) => set({ show_home: e.target.checked })}
              className="mt-0.5 h-4 w-4 rounded border-gray-300" />
            <span>
              Também como banner na tela inicial
              <span className="block text-xs text-gray-500">No carrossel de promoções da tela inicial, na região que você escolher.</span>
            </span>
          </label>
          {form.show_home && (
            <PromoReachPicker idPrefix="pcup-alcance" value={form.reach} onChange={(reach) => set({ reach })} />
          )}
        </div>
      )}

      {previa.valid && (
        <p className="mt-3 rounded-2xl bg-paper-pure p-3 text-xs text-gray-600">
          Vai valer como: <strong className="text-ink">{couponLabel({ ...previa.value })}</strong>
          {previa.value.max_uses ? ` · até ${previa.value.max_uses} usos` : ' · usos ilimitados'}
          {previa.value.show_home ? ` · banner na tela inicial (${reachLabel(previa.value.reach)})` : ''}
          {previa.value.visibility === PROMO_VISIBILITY.STUDENTS ? ' · só para os seus alunos' : ''}
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
