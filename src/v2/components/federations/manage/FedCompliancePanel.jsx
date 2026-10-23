/**
 * Conformidade (Central → Indicadores → Conformidade, só o admin da
 * federação): a lista do que a Lei Geral do Esporte e a boa governança pedem,
 * cada item com o estado e o atalho para a aba que resolve. As contas são de
 * `domain/compliance.js`; aqui só se desenha. Zero banco: usa as leituras que
 * a Central já faz (equipe, acervo) e a agenda pública; o cofre de certidões
 * só é lido com o módulo ligado. Fonte que falhou vira "não deu para
 * conferir" — nunca reprovado.
 *
 * O DOSSIÊ DO ART. 36 é a mesma lista recortada no que o art. 36 exige, numa
 * folha para imprimir: cada exigência, a base legal, a situação e ONDE ela
 * vive na Central (para quem confere — o ministério, um patrocinador estatal
 * — achar a evidência).
 */
import React, { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, FileCheck2, HelpCircle, Printer, Scale } from 'lucide-react';
import { complianceChecklist, complianceSummary } from '@/modules/federations/domain/compliance';
import { fedModuleOn } from '@/modules/federations/domain/federation';
import { useCertificates } from '@/modules/federations/hooks/useInstitutional';
import { V2Button, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { t, tk } from '@/core/i18n';
import PrintSheet, { imprimirFolha } from '../institutional/PrintSheet';

const ESTADO = {
  ok: { icon: CheckCircle2, cor: 'text-green-600', rotulo: tk('Em dia') },
  attention: { icon: AlertTriangle, cor: 'text-amber-700', rotulo: tk('Pede atenção') },
  unknown: { icon: HelpCircle, cor: 'text-gray-500', rotulo: tk('Não deu para conferir') },
};
const ORDEM = { attention: 0, unknown: 1, ok: 2 };
const dados = (q) => (q?.isSuccess ? q.data || [] : undefined);
const DO_ART_36 = /art\. 36/;

/** "Seção → Aba" de uma aba da Central (ou nada, se a aba não existe para esta federação). */
function ondeNaCentral(sections, tab) {
  for (const s of sections || []) {
    const x = s.tabs.find((a) => a.value === tab);
    if (x) return s.tabs.length > 1 ? `${t(s.label)} → ${t(x.label)}` : t(s.label);
  }
  return '';
}

function Dossier({ federation, itens, sections }) {
  const linhas = itens.filter((x) => DO_ART_36.test(x.basis));
  const s = complianceSummary(linhas);
  return (
    <PrintSheet federation={federation} title={t('Dossiê do art. 36 da Lei Geral do Esporte')}>
      <p className="text-gray-700">{t('Exigências do art. 36 da Lei 14.597/2023 para receber recursos públicos, conferidas com o que a federação mantém na plataforma: {ok} em dia, {att} pedem atenção, {unk} sem dado para conferir.', { ok: s.ok, att: s.attention, unk: s.unknown })}</p>
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-gray-300 text-xs uppercase tracking-wide text-gray-500">
            <th scope="col" className="py-2 pr-3">{t('Exigência')}</th>
            <th scope="col" className="py-2 pr-3">{t('Situação')}</th>
            <th scope="col" className="py-2">{t('Onde está na plataforma')}</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((x) => (
            <tr key={x.id} className="break-inside-avoid border-b border-gray-100 align-top">
              <td className="py-2 pr-3"><p className="font-semibold">{t(x.label)}</p><p className="text-xs text-gray-500">{t(x.basis)}</p></td>
              <td className="py-2 pr-3"><p className="font-semibold">{t(ESTADO[x.status].rotulo)}</p><p className="text-xs text-gray-700">{x.detail}</p></td>
              <td className="py-2 text-xs text-gray-700">{ondeNaCentral(sections, x.tab) || t('Fora da plataforma')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-gray-500">{t('"Sem dado para conferir" não é reprovação: a plataforma não sabe o que a federação guarda fora dela. Anexe a evidência correspondente quando for o caso.')}</p>
    </PrintSheet>
  );
}

export default function FedCompliancePanel({ federation, staffQ, docsQ, eventsQ, budgetsQ, accountReportsQ, electionsQ, tournamentsQ, sections, abas, onIrParaAba }) {
  const certsQ = useCertificates(federation.id, { enabled: fedModuleOn(federation, 'certificates') });
  const [dossie, setDossie] = useState(false);
  const itens = useMemo(() => complianceChecklist({ federation, staff: dados(staffQ), docs: dados(docsQ), events: dados(eventsQ), budgets: dados(budgetsQ), accountReports: dados(accountReportsQ), elections: dados(electionsQ), tournaments: dados(tournamentsQ), certificates: dados(certsQ) })
    .sort((a, b) => ORDEM[a.status] - ORDEM[b.status]), [federation, staffQ?.isSuccess, staffQ?.data, docsQ?.isSuccess, docsQ?.data, eventsQ?.isSuccess, eventsQ?.data, budgetsQ?.isSuccess, budgetsQ?.data, accountReportsQ?.isSuccess, accountReportsQ?.data, electionsQ?.isSuccess, electionsQ?.data, tournamentsQ?.isSuccess, tournamentsQ?.data, certsQ.isSuccess, certsQ.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const s = complianceSummary(itens);
  const carregando = [staffQ, docsQ, eventsQ, budgetsQ, accountReportsQ, electionsQ, tournamentsQ, certsQ].some((q) => q?.isLoading);
  const pct = s.total ? Math.round((s.ok / s.total) * 100) : 0;

  return (
    <section className="space-y-6" aria-label={t('Conformidade')} data-dica="federacao-conformidade">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-display text-xl font-bold text-ink"><Scale className="h-5 w-5" aria-hidden="true" />{t('Conformidade')}</h2>
          <p className="text-sm text-gray-500">{t('O que a Lei Geral do Esporte (Lei 14.597/2023) e a boa governança pedem, conferido com o que está na plataforma. É aviso, não trava nada.')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <V2Button type="button" variant={dossie ? 'secondary' : 'ghost'} aria-pressed={dossie} onClick={() => setDossie((x) => !x)} data-dica="federacao-dossie-art36"><FileCheck2 className="h-4 w-4" />{t('Dossiê do art. 36')}</V2Button>
          {dossie && <V2Button type="button" disabled={carregando} onClick={imprimirFolha}><Printer className="h-4 w-4" />{t('Imprimir / PDF')}</V2Button>}
        </div>
      </div>

      {dossie ? (carregando ? <V2Skeleton lines={8} /> : <Dossier federation={federation} itens={itens} sections={sections} />) : (
        <>
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
        </>
      )}
    </section>
  );
}
