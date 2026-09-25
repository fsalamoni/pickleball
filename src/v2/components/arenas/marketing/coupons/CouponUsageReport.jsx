/**
 * CONTROLE DE USO dos cupons — quanto cada um foi usado, quanto custou à arena
 * e quanto trouxe. A conta é do domínio (`couponUsageReport`); aqui só a
 * apresentação.
 *
 * ⚠️ O relatório só aparece com TODAS as consultas em mãos. Sem as reservas,
 * o custo de um desconto sairia zero — e zero afirma "não custou nada", que a
 * arena não sabe. Com qualquer consulta falhando, a tela diz que falhou e
 * oferece tentar de novo; nunca mostra um número pela metade.
 *
 * O custo unitário do vale é editável aqui mesmo, na linha do vale: é quando a
 * arena olha o custo "—" que ela lembra de informar.
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { BarChart3, Check, Lock, Pencil } from 'lucide-react';
import {
  useArenaCouponsAll, useArenaReferrals, useArenaSettings, useSetCouponUnitCost,
} from '@/modules/arenas/hooks/useArenaV3';
import { useArenaBookings } from '@/modules/arenas/hooks/useBookings';
import { COUPON_FAMILY } from '@/modules/arenas/domain/marketing';
import {
  COUPON_STATUS_LABEL, couponUsageReport, returnPerReal,
} from '@/modules/arenas/domain/couponUsage';
import { formatPrice } from '@/modules/arenas/domain/pricing';
import { V2Badge, V2EmptyState, V2ErrorState, V2Input, V2Skeleton } from '@/v2/ui/primitives';
import { COUPON_KIND_ICON } from './couponKindUi';

const dinheiro = (v) => (v == null ? '—' : formatPrice(v));
const TOM_DO_ESTADO = { ativo: 'green', desligado: 'neutral', esgotado: 'amber', vencido: 'amber' };

function Resumo({ label, valor, dica }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-paper-pure p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-gray-500">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold text-ink">{valor}</p>
      {dica && <p className="mt-0.5 text-xs text-gray-500">{dica}</p>}
    </div>
  );
}

/** O custo unitário do vale, editável na própria linha. */
function CustoUnitario({ arenaId, row }) {
  const salvar = useSetCouponUnitCost();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(row.unitCost ?? '');

  if (!editando) {
    return (
      <button type="button" onClick={() => { setValor(row.unitCost ?? ''); setEditando(true); }}
        className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold text-ink hover:bg-paper"
        aria-label={`Editar o custo unitário de ${row.code}`}>
        {row.unitCost == null ? <span className="text-amber-700">Informar</span> : formatPrice(row.unitCost)}
        <Pencil className="h-3 w-3 text-gray-400" />
      </button>
    );
  }
  const gravar = async () => {
    try {
      await salvar.mutateAsync({ arenaId, couponId: row.id, cost: valor });
      toast.success('Custo unitário salvo.');
      setEditando(false);
    } catch (err) {
      toast.error(err?.message || 'Não foi possível salvar o custo.');
    }
  };
  return (
    <span className="inline-flex items-center gap-1">
      <label htmlFor={`custo-${row.id}`} className="sr-only">Custo unitário de {row.code} (R$)</label>
      <V2Input id={`custo-${row.id}`} type="number" min="0" step="0.01" className="h-8 w-24 px-2 text-xs"
        value={valor} onChange={(e) => setValor(e.target.value)} />
      <button type="button" onClick={gravar} disabled={salvar.isPending} aria-label="Salvar custo"
        className="rounded-full p-1.5 text-ink hover:bg-paper disabled:opacity-50">
        <Check className="h-4 w-4" />
      </button>
    </span>
  );
}

export default function CouponUsageReport({ arenaId, referralOn = false }) {
  const cupons = useArenaCouponsAll(arenaId);
  const reservas = useArenaBookings(arenaId);
  const configuracoes = useArenaSettings(arenaId);
  const indicacoes = useArenaReferrals(referralOn ? arenaId : null);

  const consultas = [cupons, reservas, configuracoes, ...(referralOn ? [indicacoes] : [])];
  const falhou = consultas.some((q) => q.isError);
  const carregando = consultas.some((q) => q.isLoading);

  const relatorio = useMemo(() => {
    if (falhou || carregando) return null;
    return couponUsageReport({
      coupons: cupons.data || [],
      bookings: reservas.data || [],
      referrals: referralOn ? (indicacoes.data || []) : [],
      costs: configuracoes.data?.coupon_costs || {},
    });
  }, [falhou, carregando, cupons.data, reservas.data, indicacoes.data, configuracoes.data, referralOn]);

  if (falhou) {
    return (
      <V2ErrorState
        title="Não foi possível montar o controle de uso"
        description="A conta precisa dos cupons, das reservas e dos custos informados. Sem um deles, os números sairiam pela metade — por isso não mostramos nada até carregar tudo."
        onRetry={() => consultas.filter((q) => q.isError).forEach((q) => q.refetch())}
      />
    );
  }
  if (carregando || !relatorio) return <V2Skeleton className="h-48 rounded-2xl" />;

  if (relatorio.rows.length === 0) {
    return (
      <V2EmptyState
        icon={BarChart3}
        title="Nenhum cupom criado ainda"
        description="Quando a arena criar o primeiro cupom, aqui aparecem os usos, o que custou e o que trouxe — tipo a tipo."
      />
    );
  }

  const { totals, byKind, rows } = relatorio;
  const retorno = returnPerReal(totals.revenue, totals.costKnown ? totals.cost : null);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Resumo label="Usos" valor={totals.uses} dica={`${totals.coupons} ${totals.coupons === 1 ? 'cupom' : 'cupons'}`} />
        <Resumo label="Custo" valor={totals.costKnown ? formatPrice(totals.cost) : `${formatPrice(totals.cost)}+`}
          dica={totals.costKnown ? 'Descontos, vales e créditos' : 'Falta o custo de algum vale'} />
        <Resumo label="Receita trazida" valor={formatPrice(totals.revenue)} dica="Reservas que usaram cupom ou indicação" />
        <Resumo label="Retorno" valor={retorno == null ? '—' : `${formatPrice(retorno)}`}
          dica={retorno == null ? 'Sem custo conhecido para comparar' : 'de receita por R$ 1 dado'} />
      </div>

      <section aria-labelledby="uso-por-tipo">
        <h3 id="uso-por-tipo" className="mb-2 font-display text-base font-bold text-ink">Por tipo de cupom</h3>
        <div className="overflow-x-auto rounded-2xl border border-gray-100">
          <table className="w-full text-sm">
            <thead className="bg-paper text-left text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2.5">Tipo</th>
                <th className="px-3 py-2.5 text-center">Cupons</th>
                <th className="px-3 py-2.5 text-center">Usos</th>
                <th className="px-3 py-2.5 text-right">Custo</th>
                <th className="px-3 py-2.5 text-right">Receita</th>
              </tr>
            </thead>
            <tbody>
              {byKind.map((k) => {
                const Icone = COUPON_KIND_ICON[k.kind];
                return (
                  <tr key={k.kind} className="border-t border-gray-100">
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
                        {Icone && <Icone className="h-3.5 w-3.5 text-gray-400" />}{k.label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">{k.coupons}</td>
                    <td className="px-3 py-2.5 text-center">{k.uses}</td>
                    <td className="px-3 py-2.5 text-right">{dinheiro(k.cost)}</td>
                    <td className="px-3 py-2.5 text-right">{k.family === COUPON_FAMILY.VOUCHER ? '—' : dinheiro(k.revenue)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="uso-por-cupom">
        <h3 id="uso-por-cupom" className="mb-2 font-display text-base font-bold text-ink">Cupom a cupom</h3>
        <div className="overflow-x-auto rounded-2xl border border-gray-100">
          <table className="w-full text-sm">
            <thead className="bg-paper text-left text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2.5">Cupom</th>
                <th className="px-3 py-2.5">Estado</th>
                <th className="px-3 py-2.5 text-center">Usos</th>
                <th className="px-3 py-2.5 text-right">Custo</th>
                <th className="px-3 py-2.5 text-right">Receita</th>
                <th className="whitespace-nowrap px-3 py-2.5 text-right">
                  <span className="inline-flex items-center gap-1"><Lock className="h-3 w-3" /> Custo unitário</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const Icone = COUPON_KIND_ICON[r.kind];
                return (
                  <tr key={r.id} className="border-t border-gray-100 align-top">
                    <td className="px-3 py-2.5">
                      <p className="inline-flex items-center gap-1.5 font-display font-bold tracking-wide text-ink">
                        {Icone && <Icone className="h-3.5 w-3.5 text-gray-400" />}{r.code}
                      </p>
                      <p className="text-xs text-gray-500">{r.kindLabel} · {r.benefit}</p>
                    </td>
                    <td className="px-3 py-2.5"><V2Badge tone={TOM_DO_ESTADO[r.status]}>{COUPON_STATUS_LABEL[r.status]}</V2Badge></td>
                    <td className="px-3 py-2.5 text-center">
                      {r.uses}{r.maxUses ? <span className="text-gray-400"> / {r.maxUses}</span> : null}
                      {r.newCustomers ? <span className="block text-[11px] text-gray-500">{r.newCustomers} novos</span> : null}
                    </td>
                    <td className="px-3 py-2.5 text-right">{dinheiro(r.cost)}</td>
                    <td className="px-3 py-2.5 text-right">{r.revenue == null ? '—' : formatPrice(r.revenue)}</td>
                    <td className="px-3 py-2.5 text-right">
                      {r.family === COUPON_FAMILY.VOUCHER ? <CustoUnitario arenaId={arenaId} row={r} /> : <span className="text-gray-400">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-xs leading-5 text-gray-500">
        <strong>Custo</strong> é o que a arena deu: o desconto abatido nas reservas confirmadas, os vales entregues
        (usos × custo unitário) e os créditos de indicação. <strong>Receita</strong> é o que pagaram as reservas que
        usaram o cupom (ou chegaram por indicação). Pedido recusado ou cancelado não entra. <strong>—</strong> quer dizer
        que o número não é conhecido — por exemplo, um vale sem custo informado —, nunca que foi zero.
      </p>
      {rows.some((r) => r.family === COUPON_FAMILY.VOUCHER && r.unitCost == null) && (
        <p className="rounded-2xl bg-amber-50 p-3 text-xs text-amber-900">
          Há vale sem custo informado — toque em <strong>Informar</strong>, na última coluna, para o custo entrar na conta.
        </p>
      )}
    </div>
  );
}
