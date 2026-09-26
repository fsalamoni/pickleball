/**
 * Os CUPONS da plataforma ou do professor (Onda CG) — criar, gerenciar,
 * registrar uso e ver o controle de uso, como na Central da arena.
 *
 * Sem a lista de cupons na mão (a consulta falhou), "Novo cupom" não aparece:
 * criar às cegas é como nascem dois cupons com o mesmo código.
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { BarChart3, Eye, GraduationCap, Megaphone, Pencil, Plus, ScanLine, Tag, Trash2 } from 'lucide-react';
import { couponKind } from '@/modules/arenas/domain/marketing';
import { COUPON_STATUS_LABEL, couponStatus } from '@/modules/arenas/domain/couponUsage';
import { formatDateShortBR } from '@/modules/arenas/domain/calendar';
import {
  PROMO_ISSUER, PROMO_VISIBILITY, promoBenefitText, promoKindLabel, reachLabel,
} from '@/modules/promo/domain/promo';
import {
  useDeletePromoCoupon, useIssuerCoupons, usePromoSettings, useSetPromoCouponActive,
} from '@/modules/promo/hooks/usePromo';
import { instanteEmMs } from '@/core/domain/instant';
import ConfirmDialog from '@/components/ConfirmDialog';
import { cn } from '@/core/lib/utils';
import { V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import CouponArt from '@/v2/components/arenas/marketing/coupons/CouponArt';
import PromoCouponForm from './PromoCouponForm';
import PromoReception from './PromoReception';
import PromoUsageReport from './PromoUsageReport';
import { PROMO_KIND_ICON, issuerBrand } from './promoUi';

const TOM_DO_ESTADO = { ativo: 'green', desligado: 'neutral', esgotado: 'amber', vencido: 'amber' };

function diaIso(v) {
  const n = instanteEmMs(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  const d = new Date(n);
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function Alternador({ valor, onChange }) {
  const opcoes = [
    { v: 'cupons', label: 'Cupons', icon: Tag },
    { v: 'uso', label: 'Controle de uso', icon: BarChart3 },
  ];
  return (
    <div role="tablist" aria-label="Cupons" className="inline-flex rounded-full bg-paper p-1">
      {opcoes.map(({ v, label, icon: Icon }) => (
        <button key={v} type="button" role="tab" aria-selected={valor === v} onClick={() => onChange(v)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ink sm:text-sm',
            valor === v ? 'bg-ink text-white shadow-sm' : 'text-gray-500 hover:text-ink',
          )}>
          <Icon className="h-3.5 w-3.5" aria-hidden /> {label}
        </button>
      ))}
    </div>
  );
}

function CartaoCupom({ issuer, cupom, onEditar, onRegistrar, onAlternar, onApagar }) {
  const kind = couponKind(cupom);
  const estado = couponStatus(cupom);
  const desligado = cupom.active === false;
  const Icone = PROMO_KIND_ICON[kind];
  const ate = diaIso(cupom.expires_at);
  const ehProfessor = issuer.type === PROMO_ISSUER.COACH;

  return (
    <div data-cupom={cupom.code} className={cn('rounded-2xl border p-3', desligado ? 'border-gray-100 bg-gray-50 opacity-75' : 'border-gray-100 bg-paper')}>
      <div className="flex items-start justify-between gap-2">
        <p className="inline-flex items-center gap-1 rounded-full bg-paper-pure px-2 py-0.5 text-[11px] font-bold text-gray-600">
          {Icone && <Icone className="h-3 w-3" aria-hidden />} {promoKindLabel(issuer.type, kind)}
        </p>
        <V2Badge tone={TOM_DO_ESTADO[estado]}>{COUPON_STATUS_LABEL[estado]}</V2Badge>
      </div>

      <div className="mt-2">
        <CouponArt coupon={cupom} code={cupom.code} benefit={promoBenefitText(cupom)} description={cupom.description}
          footer={ate ? `até ${formatDateShortBR(ate)}` : ''} arenaName={issuerBrand(issuer).name} copyable
          notch={desligado ? 'bg-gray-50' : 'bg-paper'} />
      </div>

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
        {cupom.show_public === true && (
          <span className="inline-flex items-center gap-1 font-bold text-ink">
            <Eye className="h-3.5 w-3.5" aria-hidden /> {ehProfessor ? 'No seu perfil e na vitrine' : 'Na vitrine de promoções'}
          </span>
        )}
        {cupom.show_public === true && cupom.show_home === true && (
          <span className="inline-flex items-center gap-1 font-bold text-ink">
            <Megaphone className="h-3.5 w-3.5" aria-hidden /> Tela inicial · {reachLabel(cupom.reach)}
          </span>
        )}
        {cupom.visibility === PROMO_VISIBILITY.STUDENTS && (
          <span className="inline-flex items-center gap-1 font-bold text-ink"><GraduationCap className="h-3.5 w-3.5" aria-hidden /> Só alunos</span>
        )}
        <span>{Number(cupom.used_count) || 0}{cupom.max_uses ? ` de ${cupom.max_uses}` : ''} usos</span>
        {ate ? <span>até {formatDateShortBR(ate)}</span> : null}
        {cupom.once_per_user !== false && <span>1 por pessoa</span>}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {!desligado && (
          <V2Button size="sm" variant="secondary" onClick={() => onRegistrar(cupom)}>
            <ScanLine className="mr-1 h-3.5 w-3.5" aria-hidden /> Registrar uso
          </V2Button>
        )}
        <V2Button size="sm" variant="ghost" onClick={() => onEditar(cupom)}>
          <Pencil className="mr-1 h-3.5 w-3.5" aria-hidden /> Editar
        </V2Button>
        <V2Button size="sm" variant="ghost" onClick={() => onAlternar(cupom)}>
          {desligado ? 'Religar' : 'Desligar'}
        </V2Button>
        <ConfirmDialog
          title={`Apagar o cupom ${cupom.code}?`}
          description={`Apagar leva junto a contagem de ${Number(cupom.used_count) || 0} uso(s) — depois não dá para saber quanto essa promoção rendeu. Se a ideia é só parar de aceitar o código, use "Desligar".`}
          confirmLabel="Apagar mesmo assim"
          destructive
          onConfirm={() => onApagar(cupom)}
          trigger={(
            <V2Button size="sm" variant="ghost" className="text-red-600">
              <Trash2 className="mr-1 h-3.5 w-3.5" aria-hidden /> Apagar
            </V2Button>
          )}
        />
      </div>
    </div>
  );
}

/** @param {{ issuer: { type: string, id: string, name: string } }} props */
export default function PromoCouponsPanel({ issuer }) {
  const [aba, setAba] = useState('cupons');
  const [form, setForm] = useState(null);          // null | 'novo' | cupom
  const [recepcao, setRecepcao] = useState(null);  // null | 'codigo' | cupom
  const couponsQ = useIssuerCoupons(issuer);
  const config = usePromoSettings(issuer);
  const ligar = useSetPromoCouponActive();
  const apagar = useDeletePromoCoupon();
  const ehProfessor = issuer.type === PROMO_ISSUER.COACH;

  const lista = useMemo(() => {
    const todos = Array.isArray(couponsQ.data) ? couponsQ.data : [];
    return [...todos].sort((a, b) => {
      if ((a.active !== false) !== (b.active !== false)) return a.active === false ? 1 : -1;
      return (instanteEmMs(b.created_at) || 0) - (instanteEmMs(a.created_at) || 0);
    });
  }, [couponsQ.data]);

  const alternar = async (c) => {
    try {
      await ligar.mutateAsync({ issuer, couponId: c.id, active: c.active === false });
      toast.success(c.active === false ? 'Cupom religado.' : 'Cupom desligado.');
    } catch (err) {
      toast.error(err?.message || 'Não foi possível alterar o cupom.');
    }
  };
  const remover = async (c) => {
    try {
      await apagar.mutateAsync({ issuer, couponId: c.id });
      toast.success('Cupom apagado.');
    } catch (err) {
      toast.error(err?.message || 'Não foi possível apagar.');
    }
  };

  return (
    <V2Surface>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-ink" aria-hidden />
            <h2 className="font-display text-lg font-bold text-ink">Cupons</h2>
          </div>
          <p className="mt-0.5 text-xs text-gray-500">
            {ehProfessor
              ? 'Desconto na aula, aula experimental, clínica, brinde — para os seus alunos ou para quem ainda vai ser.'
              : 'Desconto, inscrição em evento, brinde, clínica — para toda a comunidade ou para uma região.'}
          </p>
        </div>
        <Alternador valor={aba} onChange={setAba} />
      </div>

      {aba === 'uso' && <PromoUsageReport issuer={issuer} couponsQ={couponsQ} />}

      {aba === 'cupons' && (
        <>
          {couponsQ.isLoading && <V2Skeleton className="h-24 rounded-2xl" />}
          {couponsQ.isError && (
            <V2ErrorState
              title="Não foi possível carregar os cupons"
              description="Isto é uma falha de leitura — não quer dizer que não existam cupons. Criar um agora poderia repetir um código que já existe."
              onRetry={() => couponsQ.refetch()}
            />
          )}

          {!couponsQ.isLoading && !couponsQ.isError && (
            <>
              <div className="mb-4 flex flex-wrap gap-2">
                {!form && (
                  <V2Button size="sm" onClick={() => { setForm('novo'); setRecepcao(null); }}>
                    <Plus className="mr-1.5 h-4 w-4" aria-hidden /> Novo cupom
                  </V2Button>
                )}
                {lista.length > 0 && recepcao == null && (
                  <V2Button size="sm" variant="secondary" onClick={() => { setRecepcao('codigo'); setForm(null); }}>
                    <ScanLine className="mr-1.5 h-4 w-4" aria-hidden /> Registrar uso pelo código
                  </V2Button>
                )}
              </div>

              {form && (
                <div className="mb-4">
                  <PromoCouponForm
                    key={form === 'novo' ? 'novo' : form.id}
                    issuer={issuer}
                    cupom={form === 'novo' ? null : form}
                    unitCost={form !== 'novo' ? config.data?.coupon_costs?.[form.id] ?? null : null}
                    onClose={() => setForm(null)}
                  />
                </div>
              )}

              {recepcao && (
                <div className="mb-4">
                  <PromoReception
                    key={recepcao === 'codigo' ? 'codigo' : recepcao.id}
                    issuer={issuer}
                    cupom={recepcao === 'codigo' ? null : recepcao}
                    onDone={() => setRecepcao(null)}
                  />
                </div>
              )}

              {lista.length === 0 && !form && (
                <V2EmptyState
                  icon={Tag}
                  title="Nenhum cupom ainda"
                  description={ehProfessor
                    ? 'Uma aula experimental grátis ou um desconto na primeira aula é o jeito mais direto de trazer aluno novo. Comece escolhendo o que o cupom dá.'
                    : 'Um cupom é o jeito mais direto de movimentar a comunidade num evento ou numa semana fraca. Comece escolhendo o que ele dá.'}
                  action={<V2Button size="sm" onClick={() => setForm('novo')}>Criar o primeiro</V2Button>}
                />
              )}

              {lista.length > 0 && (
                <div className="grid gap-3 md:grid-cols-2">
                  {lista.map((c) => (
                    <CartaoCupom
                      key={c.id}
                      issuer={issuer}
                      cupom={c}
                      onEditar={(x) => { setForm(x); setRecepcao(null); }}
                      onRegistrar={(x) => { setRecepcao(x); setForm(null); }}
                      onAlternar={alternar}
                      onApagar={remover}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </V2Surface>
  );
}
