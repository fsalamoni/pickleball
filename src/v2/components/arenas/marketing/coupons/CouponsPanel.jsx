/**
 * Cupons na Central da arena — duas abas: **Cupons** (criar e gerenciar) e
 * **Controle de uso** (usos, custos e ganhos, tipo a tipo).
 *
 * Um cupom agora tem TIPO: desconto e hora grátis entram sozinhos no preço da
 * reserva; aula, clínica, comida, bebida, brinde, aluguel e evento são VALES
 * que a pessoa mostra na recepção; e a indicação é o próprio programa "indique
 * e ganhe", configurado como um cupom. A lista separa por família, e cada
 * cartão oferece a ação que o tipo pede — o vale tem "Registrar uso"; o
 * desconto, não (ele é contado sozinho quando a arena confirma a reserva).
 *
 * Sem a lista de cupons na mão (a consulta falhou), "Novo cupom" não aparece:
 * criar às cegas é como nascem dois cupons com o mesmo código.
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { BarChart3, Eye, Megaphone, Pencil, Plus, ScanLine, Tag, Trash2 } from 'lucide-react';
import {
  useArenaCouponsAll, useArenaSettings, useDeleteCoupon, useSetCouponActive,
} from '@/modules/arenas/hooks/useArenaV3';
import {
  COUPON_FAMILY, COUPON_FAMILY_META, COUPON_KIND_META, couponBenefitText, couponFamily, couponKind,
} from '@/modules/arenas/domain/marketing';
import { COUPON_STATUS_LABEL, couponStatus } from '@/modules/arenas/domain/couponUsage';
import { formatPrice } from '@/modules/arenas/domain/pricing';
import { formatDateShortBR } from '@/modules/arenas/domain/calendar';
import { instanteEmMs } from '@/core/domain/instant';
import ConfirmDialog from '@/components/ConfirmDialog';
import { cn } from '@/core/lib/utils';
import { V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import CouponArt from './CouponArt';
import CouponForm from './CouponForm';
import CouponUsageReport from './CouponUsageReport';
import VoucherReception from './VoucherReception';
import { COUPON_KIND_ICON } from './couponKindUi';

const TOM_DO_ESTADO = { ativo: 'green', desligado: 'neutral', esgotado: 'amber', vencido: 'amber' };

function diaIso(v) {
  const n = instanteEmMs(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  const d = new Date(n);
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Duas abas internas, num seletor compacto — distinto das abas da Central. */
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
          <Icon className="h-3.5 w-3.5" /> {label}
        </button>
      ))}
    </div>
  );
}

function CartaoCupom({ cupom, arenaName, onEditar, onRegistrar, onAlternar, onApagar }) {
  const kind = couponKind(cupom);
  const familia = couponFamily(cupom);
  const estado = couponStatus(cupom);
  const desligado = cupom.active === false;
  const Icone = COUPON_KIND_ICON[kind];
  const ate = diaIso(cupom.expires_at);

  return (
    <div data-cupom={cupom.code} className={cn('rounded-2xl border p-3', desligado ? 'border-gray-100 bg-gray-50 opacity-75' : 'border-gray-100 bg-paper')}>
      <div className="flex items-start justify-between gap-2">
        <p className="inline-flex items-center gap-1 rounded-full bg-paper-pure px-2 py-0.5 text-[11px] font-bold text-gray-600">
          {Icone && <Icone className="h-3 w-3" />} {COUPON_KIND_META[kind].label}
        </p>
        <V2Badge tone={TOM_DO_ESTADO[estado]}>{COUPON_STATUS_LABEL[estado]}</V2Badge>
      </div>

      {familia !== COUPON_FAMILY.REFERRAL ? (
        // O cupom como o atleta vê — a arte, com o código copiável no canhoto
        // (a arena também copia para mandar a alguém). Onda CD.
        <div className="mt-2">
          <CouponArt coupon={cupom} code={cupom.code} benefit={couponBenefitText(cupom)} description={cupom.description}
            footer={ate ? `até ${formatDateShortBR(ate)}` : ''} arenaName={arenaName} copyable
            notch={desligado ? 'bg-gray-50' : 'bg-paper'} />
        </div>
      ) : (
        <div className="mt-1">
          <p className="text-sm text-gray-700">{couponBenefitText(cupom)}</p>
          {cupom.description && <p className="mt-0.5 text-xs text-gray-500">{cupom.description}</p>}
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
        {cupom.show_public === true && (
          <span className="inline-flex items-center gap-1 font-bold text-ink"><Eye className="h-3.5 w-3.5" /> Na página da arena</span>
        )}
        {cupom.show_public === true && cupom.show_home === true && (
          <span className="inline-flex items-center gap-1 font-bold text-ink"><Megaphone className="h-3.5 w-3.5" /> Banner na tela inicial</span>
        )}
        {familia !== COUPON_FAMILY.REFERRAL && (
          <span>{Number(cupom.used_count) || 0}{cupom.max_uses ? ` de ${cupom.max_uses}` : ''} usos</span>
        )}
        {cupom.min_amount ? <span>{familia === COUPON_FAMILY.REFERRAL ? '1ª reserva' : 'mín.'} a partir de {formatPrice(cupom.min_amount)}</span> : null}
        {ate ? <span>até {formatDateShortBR(ate)}</span> : null}
        {familia === COUPON_FAMILY.REFERRAL
          ? (
            <>
              {cupom.first_booking_only !== false && <span>só quem nunca reservou aqui</span>}
              {cupom.max_per_referrer ? <span>até {cupom.max_per_referrer} por pessoa</span> : null}
            </>
          )
          : cupom.once_per_user !== false && <span>1 por pessoa</span>}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {familia === COUPON_FAMILY.VOUCHER && !desligado && (
          <V2Button size="sm" variant="secondary" onClick={() => onRegistrar(cupom)}>
            <ScanLine className="mr-1 h-3.5 w-3.5" /> Registrar uso
          </V2Button>
        )}
        <V2Button size="sm" variant="ghost" onClick={() => onEditar(cupom)}>
          <Pencil className="mr-1 h-3.5 w-3.5" /> {familia === COUPON_FAMILY.REFERRAL ? 'Editar regras' : 'Editar'}
        </V2Button>
        <V2Button size="sm" variant="ghost" onClick={() => onAlternar(cupom)}>
          {desligado ? 'Religar' : 'Desligar'}
        </V2Button>
        <ConfirmDialog
          title={familia === COUPON_FAMILY.REFERRAL ? 'Apagar as regras do indique e ganhe?' : `Apagar o cupom ${cupom.code}?`}
          description={familia === COUPON_FAMILY.REFERRAL
            ? 'Os códigos dos atletas continuam existindo, mas o programa fica sem regras até você criar outras. Se a ideia é pausar, use "Desligar".'
            : `Apagar leva junto a contagem de ${Number(cupom.used_count) || 0} uso(s) — depois não dá para saber quanto essa promoção rendeu. Se a ideia é só parar de aceitar o código, use "Desligar".`}
          confirmLabel="Apagar mesmo assim"
          destructive
          onConfirm={() => onApagar(cupom)}
          trigger={(
            <V2Button size="sm" variant="ghost" className="text-red-600">
              <Trash2 className="mr-1 h-3.5 w-3.5" /> Apagar
            </V2Button>
          )}
        />
      </div>
    </div>
  );
}

export default function CouponsPanel({ arenaId, arena = null, referralOn = false }) {
  const [aba, setAba] = useState('cupons');
  const [form, setForm] = useState(null);          // null | 'novo' | cupom
  const [recepcao, setRecepcao] = useState(null);  // null | 'codigo' | cupom
  const [familia, setFamilia] = useState('todas');
  const { data: cupons, isLoading, isError, refetch } = useArenaCouponsAll(arenaId);
  const { data: configuracoes } = useArenaSettings(arenaId);
  const ligar = useSetCouponActive();
  const apagar = useDeleteCoupon();

  const lista = useMemo(() => (Array.isArray(cupons) ? cupons : []), [cupons]);
  const contagem = useMemo(() => {
    const c = { todas: lista.length };
    lista.forEach((x) => { const f = couponFamily(x); c[f] = (c[f] || 0) + 1; });
    return c;
  }, [lista]);
  const temVale = (contagem[COUPON_FAMILY.VOUCHER] || 0) > 0;

  const visiveis = useMemo(() => {
    const filtrados = familia === 'todas' ? lista : lista.filter((c) => couponFamily(c) === familia);
    // Ligados primeiro; dentro, os mais novos.
    return [...filtrados].sort((a, b) => {
      if ((a.active !== false) !== (b.active !== false)) return a.active === false ? 1 : -1;
      return (instanteEmMs(b.created_at) || 0) - (instanteEmMs(a.created_at) || 0);
    });
  }, [lista, familia]);

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

  const filtros = [
    { v: 'todas', label: 'Todos' },
    ...[COUPON_FAMILY.BOOKING, COUPON_FAMILY.VOUCHER, COUPON_FAMILY.REFERRAL]
      .filter((f) => contagem[f])
      .map((f) => ({ v: f, label: COUPON_FAMILY_META[f].label })),
  ];

  return (
    <V2Surface>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Tag className="h-5 w-5 text-ink" />
          <h2 className="font-display text-lg font-bold text-ink">Cupons</h2>
        </div>
        <Alternador valor={aba} onChange={setAba} />
      </div>

      {aba === 'uso' && <CouponUsageReport arenaId={arenaId} referralOn={referralOn} />}

      {aba === 'cupons' && (
        <>
          {isLoading && <V2Skeleton className="h-24 rounded-2xl" />}

          {isError && (
            <V2ErrorState
              title="Não foi possível carregar os cupons"
              description="Isto é uma falha de leitura — não quer dizer que a arena não tenha cupons. Criar um agora poderia repetir um código que já existe."
              onRetry={() => refetch()}
            />
          )}

          {!isLoading && !isError && (
            <>
              <div className="mb-4 flex flex-wrap gap-2">
                {!form && (
                  <V2Button size="sm" onClick={() => { setForm('novo'); setRecepcao(null); }}>
                    <Plus className="mr-1.5 h-4 w-4" /> Novo cupom
                  </V2Button>
                )}
                {temVale && recepcao == null && (
                  <V2Button size="sm" variant="secondary" onClick={() => { setRecepcao('codigo'); setForm(null); }}>
                    <ScanLine className="mr-1.5 h-4 w-4" /> Registrar uso de vale
                  </V2Button>
                )}
              </div>

              {form && (
                <div className="mb-4">
                  <CouponForm
                    arenaId={arenaId}
                    arena={arena}
                    cupom={form === 'novo' ? null : form}
                    referralOn={referralOn}
                    unitCost={form !== 'novo' ? configuracoes?.coupon_costs?.[form.id] ?? null : null}
                    onClose={() => setForm(null)}
                  />
                </div>
              )}

              {recepcao && (
                <div className="mb-4">
                  <VoucherReception
                    key={recepcao === 'codigo' ? 'codigo' : recepcao.id}
                    arenaId={arenaId}
                    cupom={recepcao === 'codigo' ? null : recepcao}
                    onDone={() => setRecepcao(null)}
                  />
                </div>
              )}

              {lista.length === 0 && !form && (
                <V2EmptyState
                  icon={Tag}
                  title="Nenhum cupom ainda"
                  description="Desconto, hora grátis, aula, bebida, brinde — um cupom é a forma mais direta de trazer gente numa semana fraca. Comece escolhendo o que ele dá."
                  action={<V2Button size="sm" onClick={() => setForm('novo')}>Criar o primeiro</V2Button>}
                />
              )}

              {lista.length > 0 && filtros.length > 2 && (
                <div role="group" aria-label="Filtrar por tipo" className="mb-3 flex flex-wrap gap-1.5">
                  {filtros.map((f) => (
                    <button key={f.v} type="button" onClick={() => setFamilia(f.v)} aria-pressed={familia === f.v}
                      className={cn(
                        'rounded-full border px-3 py-1 text-xs font-bold transition-colors',
                        familia === f.v ? 'border-ink bg-ink/5 text-ink' : 'border-gray-200 text-gray-500 hover:border-ink/40 hover:text-ink',
                      )}>
                      {f.label} <span className="text-gray-400">{contagem[f.v] || 0}</span>
                    </button>
                  ))}
                </div>
              )}

              {visiveis.length > 0 && (
                <div className="grid gap-3 md:grid-cols-2">
                  {visiveis.map((c) => (
                    <CartaoCupom
                      key={c.id}
                      cupom={c}
                      arenaName={arena?.name || ''}
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
