/**
 * CONTROLE DE USO dos cupons da plataforma ou do professor (Onda CG) — quanto
 * cada um foi usado, quanto custou e (no desconto do professor) quanto as
 * aulas renderam. A conta é do domínio (`promoUsageReport`).
 *
 * Como no controle da arena, o relatório só aparece com TODAS as consultas em
 * mãos — sem as aulas, o custo de um desconto sairia zero, e zero afirma "não
 * custou nada". "—" quer dizer que o número não é conhecido, nunca zero.
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { BarChart3, Check, Lock, Pencil } from 'lucide-react';
import { couponBenefitText } from '@/modules/arenas/domain/marketing';
import { COUPON_STATUS_LABEL, couponStatus } from '@/modules/arenas/domain/couponUsage';
import { formatPrice } from '@/modules/arenas/domain/pricing';
import { PROMO_FAMILY, PROMO_ISSUER, promoKindLabel, promoUsageReport } from '@/modules/promo/domain/promo';
import { usePromoSettings, useSetPromoCouponUnitCost } from '@/modules/promo/hooks/usePromo';
import { useCoachLessons } from '@/modules/coaches/hooks/useLessons';
import { V2Badge, V2EmptyState, V2ErrorState, V2Input, V2Skeleton } from '@/v2/ui/primitives';
import { PROMO_KIND_ICON } from './promoUi';

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

function CustoUnitario({ issuer, row, unit }) {
  const salvar = useSetPromoCouponUnitCost();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(unit ?? '');
  if (!editando) {
    return (
      <button type="button" onClick={() => { setValor(unit ?? ''); setEditando(true); }}
        className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold text-ink hover:bg-paper"
        aria-label={`Editar o custo unitário de ${row.code}`}>
        {unit == null ? <span className="text-amber-700">Informar</span> : formatPrice(unit)}
        <Pencil className="h-3 w-3 text-gray-400" aria-hidden />
      </button>
    );
  }
  const gravar = async () => {
    try {
      await salvar.mutateAsync({ issuer, couponId: row.id, cost: valor });
      toast.success('Custo unitário salvo.');
      setEditando(false);
    } catch (err) {
      toast.error(err?.message || 'Não foi possível salvar o custo.');
    }
  };
  return (
    <span className="inline-flex items-center gap-1">
      <label htmlFor={`pcusto-${row.id}`} className="sr-only">Custo unitário de {row.code} (R$)</label>
      <V2Input id={`pcusto-${row.id}`} type="number" min="0" step="0.01" className="h-8 w-24 px-2 text-xs"
        value={valor} onChange={(e) => setValor(e.target.value)} />
      <button type="button" onClick={gravar} disabled={salvar.isPending} aria-label="Salvar custo"
        className="rounded-full p-1.5 text-ink hover:bg-paper disabled:opacity-50">
        <Check className="h-4 w-4" aria-hidden />
      </button>
    </span>
  );
}

/**
 * @param {{ issuer: object, couponsQ: object }} props
 *   `couponsQ` é a consulta de cupons do painel (a mesma lista, sem ler de novo).
 */
export default function PromoUsageReport({ issuer, couponsQ }) {
  const ehProfessor = issuer.type === PROMO_ISSUER.COACH;
  const config = usePromoSettings(issuer);
  const aulas = useCoachLessons(ehProfessor ? issuer.id : null);
  const consultas = [couponsQ, config, ...(ehProfessor ? [aulas] : [])];
  const falhou = consultas.some((q) => q.isError);
  const carregando = consultas.some((q) => q.isLoading);

  const cupons = useMemo(() => couponsQ.data || [], [couponsQ.data]);
  const custos = useMemo(() => config.data?.coupon_costs || {}, [config.data]);
  const relatorio = useMemo(() => {
    if (falhou || carregando) return null;
    return promoUsageReport({ coupons: cupons, costs: custos, lessons: ehProfessor ? (aulas.data || []) : [] });
  }, [falhou, carregando, cupons, custos, aulas.data, ehProfessor]);
  const porId = useMemo(() => new Map(cupons.map((c) => [c.id, c])), [cupons]);

  if (falhou) {
    return (
      <V2ErrorState
        title="Não foi possível montar o controle de uso"
        description={ehProfessor
          ? 'A conta precisa dos cupons, dos custos informados e das suas aulas. Sem um deles, os números sairiam pela metade.'
          : 'A conta precisa dos cupons e dos custos informados. Sem um deles, os números sairiam pela metade.'}
        onRetry={() => consultas.filter((q) => q.isError).forEach((q) => q.refetch())}
      />
    );
  }
  if (carregando || !relatorio) return <V2Skeleton className="h-48 rounded-2xl" />;
  if (relatorio.linhas.length === 0) {
    return (
      <V2EmptyState icon={BarChart3} title="Nenhum cupom criado ainda"
        description="Quando o primeiro cupom existir, aqui aparecem os usos, o que custou e o que trouxe." />
    );
  }

  const { total, linhas } = relatorio;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Resumo label="Usos" valor={total.usos} dica={`${linhas.length} ${linhas.length === 1 ? 'cupom' : 'cupons'}`} />
        <Resumo label="Custo" valor={dinheiro(total.custo)}
          dica={total.custo == null ? 'Falta o custo de algum cupom' : (ehProfessor ? 'Descontos nas aulas e vales' : 'Vales entregues')} />
        <Resumo label={ehProfessor ? 'Aulas com cupom renderam' : 'Receita'} valor={dinheiro(total.receita)}
          dica={ehProfessor ? 'Aulas confirmadas que usaram um desconto' : 'A plataforma não cobra pelo que divulga'} />
      </div>

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
                <span className="inline-flex items-center gap-1"><Lock className="h-3 w-3" aria-hidden /> Custo unitário</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((r) => {
              const c = porId.get(r.id) || {};
              const Icone = PROMO_KIND_ICON[r.kind];
              const estado = couponStatus(c);
              return (
                <tr key={r.id} className="border-t border-gray-100 align-top">
                  <td className="px-3 py-2.5">
                    <p className="inline-flex items-center gap-1.5 font-display font-bold tracking-wide text-ink">
                      {Icone && <Icone className="h-3.5 w-3.5 text-gray-400" aria-hidden />}{r.code}
                    </p>
                    <p className="text-xs text-gray-500">{promoKindLabel(issuer.type, r.kind)} · {couponBenefitText(c)}</p>
                  </td>
                  <td className="px-3 py-2.5"><V2Badge tone={TOM_DO_ESTADO[estado]}>{COUPON_STATUS_LABEL[estado]}</V2Badge></td>
                  <td className="px-3 py-2.5 text-center">
                    {r.usos}{c.max_uses ? <span className="text-gray-400"> / {c.max_uses}</span> : null}
                  </td>
                  <td className="px-3 py-2.5 text-right">{dinheiro(r.custo)}</td>
                  <td className="px-3 py-2.5 text-right">{dinheiro(r.receita)}</td>
                  <td className="px-3 py-2.5 text-right">
                    {r.familia === PROMO_FAMILY.VOUCHER
                      ? <CustoUnitario issuer={issuer} row={r} unit={custos[r.id] ?? null} />
                      : <span className="text-gray-400">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs leading-5 text-gray-500">
        {ehProfessor
          ? <><strong>Custo</strong> é o que você deu: o desconto abatido nas aulas confirmadas com o código e os vales entregues (usos × custo unitário). <strong>Receita</strong> é o que essas aulas renderam. </>
          : <><strong>Custo</strong> é o que a plataforma deu nos vales (usos × custo unitário). O desconto da plataforma não passa por um preço da plataforma — por isso só os usos. </>}
        <strong>—</strong> quer dizer que o número não é conhecido, nunca que foi zero.
      </p>
    </div>
  );
}
