/**
 * Conformidade (Central → Indicadores → Conformidade, só o admin da
 * federação): a lista do que a Lei Geral do Esporte e a boa governança pedem,
 * cada item com o estado e o atalho para a aba que resolve. As contas são de
 * `domain/compliance.js`; aqui só se desenha. Zero banco: usa as leituras que
 * a Central já faz (equipe, acervo) e a agenda pública. Fonte que falhou vira
 * "não deu para conferir" — nunca reprovado.
 */
import React, { useMemo } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, HelpCircle, Scale } from 'lucide-react';
import { complianceChecklist, complianceSummary } from '@/modules/federations/domain/compliance';
import { V2Button, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { t, tk } from '@/core/i18n';

const ESTADO = {
  ok: { icon: CheckCircle2, cor: 'text-green-600', rotulo: tk('Em dia') },
  attention: { icon: AlertTriangle, cor: 'text-amber-700', rotulo: tk('Pede atenção') },
  unknown: { icon: HelpCircle, cor: 'text-gray-500', rotulo: tk('Não deu para conferir') },
};
const ORDEM = { attention: 0, unknown: 1, ok: 2 };
const dados = (q) => (q?.isSuccess ? q.data || [] : undefined);

export default function FedCompliancePanel({ federation, staffQ, docsQ, eventsQ, abas, onIrParaAba }) {
  const itens = useMemo(() => complianceChecklist({ federation, staff: dados(staffQ), docs: dados(docsQ), events: dados(eventsQ) })
    .sort((a, b) => ORDEM[a.status] - ORDEM[b.status]), [federation, staffQ?.isSuccess, staffQ?.data, docsQ?.isSuccess, docsQ?.data, eventsQ?.isSuccess, eventsQ?.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const s = complianceSummary(itens);
  const carregando = [staffQ, docsQ, eventsQ].some((q) => q?.isLoading);
  const pct = s.total ? Math.round((s.ok / s.total) * 100) : 0;

  return (
    <section className="space-y-6" aria-label={t('Conformidade')} data-dica="federacao-conformidade">
      <div>
        <h2 className="flex items-center gap-2 font-display text-xl font-bold text-ink"><Scale className="h-5 w-5" aria-hidden="true" />{t('Conformidade')}</h2>
        <p className="text-sm text-gray-500">{t('O que a Lei Geral do Esporte (Lei 14.597/2023) e a boa governança pedem, conferido com o que está na plataforma. É aviso, não trava nada.')}</p>
      </div>

      <V2Surface className="flex flex-wrap items-center gap-6">
        <div className="relative h-20 w-20 shrink-0" aria-hidden="true">
          <svg viewBox="0 0 36 36" className="h-20 w-20 -rotate-90">
            <circle cx="18" cy="18" r="15.9" fill="none" strokeWidth="3.5" className="stroke-gray-100" />
            <circle cx="18" cy="18" r="15.9" fill="none" strokeWidth="3.5" strokeLinecap="round" className="stroke-green-600" strokeDasharray={`${pct} 100`} />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center font-display text-lg font-bold tabular-nums text-ink">{s.ok}/{s.total}</span>
        </div>
        <dl className="grid flex-1 grid-cols-3 gap-3 text-center sm:text-left">
          {['ok', 'attention', 'unknown'].map((k) => {
            const E = ESTADO[k];
            return (
              <div key={k}>
                <dt className={`flex items-center justify-center gap-1 text-xs font-semibold sm:justify-start ${E.cor}`}><E.icon className="h-3.5 w-3.5" aria-hidden="true" />{t(E.rotulo)}</dt>
                <dd className="font-display text-2xl font-bold tabular-nums text-ink">{s[k]}</dd>
              </div>
            );
          })}
        </dl>
      </V2Surface>

      {carregando && <V2Skeleton lines={3} />}

      <ul className="space-y-3">
        {itens.map((x) => {
          const E = ESTADO[x.status];
          const podeIr = x.status !== 'ok' && abas?.has(x.tab);
          return (
            <li key={x.id}>
              <V2Surface className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <E.icon className={`h-5 w-5 shrink-0 ${E.cor}`} aria-hidden="true" />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-semibold text-ink">{t(x.label)} <span className="sr-only">— {t(E.rotulo)}</span></p>
                  <p className="text-sm text-gray-700">{x.detail}</p>
                  <p className="text-xs text-gray-500">{t(x.basis)}</p>
                </div>
                {podeIr && <V2Button type="button" size="sm" variant="secondary" className="self-start" onClick={() => onIrParaAba(x.tab)}>{t('Resolver')}<ArrowRight className="h-4 w-4" /></V2Button>}
              </V2Surface>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
