/**
 * Contas → Prestação de contas: rascunho → enviada ao conselho fiscal (os
 * totais CONGELAM) → parecer → assembleia (opcional) → publicada na
 * transparência (e no acervo, como dois atos: demonstrações e parecer).
 * O financeiro prepara; o conselho fiscal lê e dá o parecer.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { CheckCircle2, Circle, Download, FilePlus2, Gavel, Globe, RotateCcw, Save, Send, Stamp, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { accountsFolder, callAccounts, isClubScope, useAccountsMutation } from './accountsScope';
import {
  ACCOUNT_REPORT_STATUS, ACCOUNT_REPORT_STATUS_LABELS, ASSEMBLY_RESULTS, OPINION_TEXT_MIN, OPINION_VERDICTS, STATEMENTS_MAX, STATEMENT_KINDS, budgetVsActual, canPrepareAccounts, categoryLabel,
  isAnnualPeriod, itemsInPeriod, legalDeadline, periodLabel, periodRange, periodYear, reportActions, reportTimeline, totalsByCategory, validateAssemblyInput, validateOpinionInput,
} from '@/modules/federations/domain/accounts';
import { docPublicPath } from '@/modules/federations/domain/acervo';
import { V2Badge, V2Button, V2Field, V2Input, V2Select, V2Surface, V2Textarea } from '@/v2/ui/primitives';
import { t, fmtData } from '@/core/i18n';
import { quando } from '../../federationUi';
import { haAlteracaoNaoSalva, useAvisoNaoSalvo } from '../naoSalvo';
import { BudgetVsActualTable, TotalsTiles, reais } from '../../accounts/accountsUi';
import { AccountFileInput, HistoryList, MeetingSelect, ReasonField, baixarArquivoDoServidor, motivoOk } from './accountsForms';

const rotulo = (lista, id) => { const x = lista.find((v) => v.id === id); return x ? t(x.label) : ''; };
const quandoMs = (ms) => (ms ? fmtData(new Date(ms), { day: '2-digit', month: '2-digit', year: 'numeric' }) : '');

/** Os períodos que dá para abrir: o ano e os trimestres já começados, deste ano e do anterior. */
export function openablePeriods(reports, hoje) {
  const ano = Number(hoje.slice(0, 4));
  const existe = new Set(reports.map((r) => r.period));
  const out = [];
  for (const a of [ano - 1, ano]) {
    for (const p of [String(a), `${a}-Q1`, `${a}-Q2`, `${a}-Q3`, `${a}-Q4`]) {
      if (!existe.has(p) && periodRange(p).from <= hoje) out.push(p);
    }
  }
  return out;
}

function Timeline({ report }) {
  const passos = reportTimeline(report);
  return (
    <ol className="grid gap-2 sm:grid-cols-5" aria-label={t('Andamento da prestação de contas')}>
      {passos.map((p) => (
        <li key={p.id} className={`flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs ${p.current ? 'border-ink bg-acid/20 font-bold text-ink' : p.done ? 'border-green-100 bg-green-50 text-green-700' : 'border-gray-100 text-gray-500'}`} aria-current={p.current ? 'step' : undefined}>
          {p.done ? <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" /> : <Circle className="h-4 w-4 shrink-0" aria-hidden="true" />}
          <span className="min-w-0">
            <span className="block">{t(p.label)}</span>
            {p.at && <span className="block font-normal text-gray-500">{typeof p.at === 'number' ? quandoMs(p.at) : quando(p.at)}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

function CategoryList({ totais }) {
  const linhas = [
    ...Object.entries(totais.income || {}).filter(([, v]) => v > 0).map(([c, v]) => ({ k: `i.${c}`, kind: 'income', c, v })),
    ...Object.entries(totais.expense || {}).filter(([, v]) => v > 0).map(([c, v]) => ({ k: `e.${c}`, kind: 'expense', c, v })),
  ];
  if (!linhas.length) return <p className="text-sm text-gray-500">{t('Nada lançado neste período.')}</p>;
  return (
    <ul className="grid gap-1 text-sm sm:grid-cols-2">
      {linhas.map((l) => <li key={l.k} className="flex justify-between gap-2"><span className="text-gray-500">{l.kind === 'expense' ? t('Despesa') : t('Receita')} · {categoryLabel(l.kind, l.c)}</span><span className="tabular-nums text-ink">{reais(l.v)}</span></li>)}
    </ul>
  );
}

function OpinionForm({ federation, report, onFechar }) {
  const [f, setF] = useState({ verdict: '', text: '' });
  useAvisoNaoSalvo(Boolean(f.verdict || f.text));
  const ok = validateOpinionInput(f).ok;
  const m = useAccountsMutation(federation, () => callAccounts(federation, { action: 'opinion', reportId: report.id, opinion: f }));
  return (
    <div className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-ink">{t('Parecer')}</legend>
        {OPINION_VERDICTS.map((v) => (
          <label key={v.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border border-gray-100 px-3 text-sm">
            <input type="radio" name="parecer" value={v.id} checked={f.verdict === v.id} onChange={() => setF((x) => ({ ...x, verdict: v.id }))} />{t(v.label)}
          </label>
        ))}
      </fieldset>
      <V2Field label={t('Texto do parecer')} htmlFor="pc-texto" required hint={t('Mínimo {n} caracteres. Vai publicado junto com as contas.', { n: OPINION_TEXT_MIN })}>
        <V2Textarea id="pc-texto" rows={8} maxLength={8000} value={f.text} onChange={(e) => setF((x) => ({ ...x, text: e.target.value }))} />
      </V2Field>
      <div className="flex justify-end gap-2">
        <V2Button type="button" variant="ghost" onClick={onFechar}>{t('Cancelar')}</V2Button>
        <V2Button type="button" disabled={!ok || m.isPending} onClick={() => m.mutate(undefined, { onSuccess: () => { toast.success(t('Parecer registrado. O financeiro foi avisado.')); onFechar(); }, onError: (e) => toast.error(e.message) })}><Stamp className="h-4 w-4" />{t('Registrar o parecer')}</V2Button>
      </div>
    </div>
  );
}

function AssemblyForm({ federation, report, hoje, onFechar }) {
  const [f, setF] = useState({ date: hoje, result: '', event_id: '', note: '' });
  const ok = validateAssemblyInput(f).ok;
  const m = useAccountsMutation(federation, () => callAccounts(federation, { action: 'report_assembly', reportId: report.id, assembly: f }));
  return (
    <div className="space-y-4">
      <V2Field label={t('Data da assembleia')} htmlFor="as-data" required><V2Input id="as-data" type="date" max={hoje} value={f.date} onChange={(e) => setF((x) => ({ ...x, date: e.target.value }))} /></V2Field>
      <V2Field label={t('Resultado')} htmlFor="as-res" required>
        <V2Select id="as-res" value={f.result} onChange={(e) => setF((x) => ({ ...x, result: e.target.value }))}>
          <option value="">{t('Escolha')}</option>
          {ASSEMBLY_RESULTS.map((r) => <option key={r.id} value={r.id}>{t(r.label)}</option>)}
        </V2Select>
      </V2Field>
      <MeetingSelect federation={federation} id="as-reuniao" value={f.event_id} onChange={(v) => setF((x) => ({ ...x, event_id: v }))} />
      <V2Field label={t('Observação (opcional)')} htmlFor="as-nota"><V2Textarea id="as-nota" rows={3} maxLength={2000} value={f.note} onChange={(e) => setF((x) => ({ ...x, note: e.target.value }))} /></V2Field>
      <div className="flex justify-end gap-2">
        <V2Button type="button" variant="ghost" onClick={onFechar}>{t('Cancelar')}</V2Button>
        <V2Button type="button" disabled={!ok || m.isPending} onClick={() => m.mutate(undefined, { onSuccess: () => { toast.success(t('Resultado da assembleia registrado.')); onFechar(); }, onError: (e) => toast.error(e.message) })}><Gavel className="h-4 w-4" />{t('Registrar')}</V2Button>
      </div>
    </div>
  );
}

/** As demonstrações (balanço, DRE, fluxo de caixa, notas) e as observações, enquanto rascunho. */
function Statements({ federation, report, editavel }) {
  const atuais = useMemo(() => (Array.isArray(report.statements) ? report.statements : []), [report.statements]);
  const [lista, setLista] = useState(atuais);
  const [notas, setNotas] = useState(report.notes || '');
  const [novo, setNovo] = useState(null);
  const [tipo, setTipo] = useState('balance_sheet');
  useEffect(() => { setLista(atuais); setNotas(report.notes || ''); }, [atuais, report.notes]);
  const alterado = editavel && (JSON.stringify(lista) !== JSON.stringify(atuais) || notas !== (report.notes || ''));
  useAvisoNaoSalvo(alterado);
  const m = useAccountsMutation(federation, () => callAccounts(federation, { action: 'report_save', reportId: report.id, statements: lista, notes: notas }));
  const [baixando, setBaixando] = useState('');
  const baixar = async (s) => {
    setBaixando(s.path);
    try { baixarArquivoDoServidor(await callAccounts(federation, { action: 'file', reportId: report.id, path: s.path })); } catch (e) { toast.error(e.message); } finally { setBaixando(''); }
  };
  const oficial = (s) => atuais.some((x) => x.path === s.path);
  return (
    <div className="space-y-3">
      <h4 className="font-bold text-ink">{t('Demonstrações')}</h4>
      {lista.length === 0 ? <p className="text-sm text-gray-500">{editavel ? t('Anexe o balanço, a DRE, o fluxo de caixa e as notas explicativas (PDF).') : t('Sem demonstração anexada.')}</p> : (
        <ul className="space-y-1">
          {lista.map((s, i) => (
            <li key={s.path} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-gray-100 px-3 py-1 text-sm">
              <span className="min-w-0"><span className="font-semibold text-ink">{rotulo(STATEMENT_KINDS, s.kind) || t('Documento')}</span> <span className="text-gray-500">· {s.name}</span></span>
              <span className="flex gap-1">
                {oficial(s) && <V2Button type="button" size="sm" variant="ghost" disabled={baixando === s.path} onClick={() => baixar(s)} aria-label={t('Baixar {nome}', { nome: s.name })}><Download className="h-4 w-4" /></V2Button>}
                {editavel && <V2Button type="button" size="sm" variant="ghost" onClick={() => setLista((x) => x.filter((_, j) => j !== i))} aria-label={t('Tirar {nome}', { nome: s.name })}><Trash2 className="h-4 w-4" /></V2Button>}
              </span>
            </li>
          ))}
        </ul>
      )}
      {editavel && lista.length < STATEMENTS_MAX && (
        <div className="grid items-end gap-3 rounded-2xl bg-paper p-3 sm:grid-cols-[12rem_1fr_auto]">
          <V2Field label={t('Tipo')} htmlFor="pc-dem-tipo"><V2Select id="pc-dem-tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>{STATEMENT_KINDS.map((k) => <option key={k.id} value={k.id}>{t(k.label)}</option>)}</V2Select></V2Field>
          <AccountFileInput id="pc-dem-arquivo" folder={accountsFolder(federation)} label={t('Arquivo')} value={novo} onChange={setNovo} />
          <V2Button type="button" variant="secondary" disabled={!novo} onClick={() => { setLista((x) => [...x, { ...novo, kind: tipo }]); setNovo(null); }}><FilePlus2 className="h-4 w-4" />{t('Incluir')}</V2Button>
        </div>
      )}
      {(editavel || report.notes) && (
        <V2Field label={t('Notas da prestação (opcional)')} htmlFor="pc-notas" hint={editavel ? t('Explicações para o conselho e para quem lê a transparência.') : undefined}>
          <V2Textarea id="pc-notas" rows={3} maxLength={2000} readOnly={!editavel} value={notas} onChange={(e) => setNotas(e.target.value)} />
        </V2Field>
      )}
      {editavel && <div className="flex justify-end"><V2Button type="button" variant="secondary" disabled={!alterado || m.isPending} onClick={() => m.mutate(undefined, { onSuccess: () => toast.success(t('Prestação salva.')), onError: (e) => toast.error(e.message) })}><Save className="h-4 w-4" />{t('Salvar demonstrações')}</V2Button></div>}
    </div>
  );
}

function ReportDetail({ federation, perms, report, items, hoje }) {
  const acoes = reportActions(report, perms);
  const range = periodRange(report.period);
  const terminou = range.to < hoje;
  const s = report.snapshot;
  const previa = useMemo(() => totalsByCategory(itemsInPeriod(items, report.period)), [items, report.period]);
  const tot = s || previa;
  const [dialogo, setDialogo] = useState(null); // 'enviar' | 'reabrir' | 'parecer' | 'assembleia' | 'publicar'
  const [motivo, setMotivo] = useState('');
  const fechar = () => { setDialogo(null); setMotivo(''); };
  const m = useAccountsMutation(federation, (payload) => callAccounts(federation, payload));
  const rodar = (payload, okMsg) => m.mutate(payload, { onSuccess: () => { toast.success(okMsg); fechar(); }, onError: (e) => toast.error(e.message) });
  const op = report.fiscal_opinion;
  return (
    <V2Surface className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-lg font-bold text-ink">{t('Prestação de contas · {periodo}', { periodo: periodLabel(report.period) })}</h3>
        <V2Badge tone={report.status === ACCOUNT_REPORT_STATUS.PUBLISHED ? 'green' : report.status === ACCOUNT_REPORT_STATUS.REJECTED ? 'red' : 'neutral'}>{t(ACCOUNT_REPORT_STATUS_LABELS[report.status] || report.status)}</V2Badge>
      </div>
      {isAnnualPeriod(report.period) && report.status !== ACCOUNT_REPORT_STATUS.PUBLISHED && <p className="text-sm text-gray-500">{t('Prazo legal para publicar: {data} (último dia útil de abril).', { data: quando(legalDeadline(periodYear(report.period))) })}</p>}
      <Timeline report={report} />

      <div className="space-y-3">
        <p className="text-sm text-gray-500">{s ? t('Totais congelados em {data}, no envio ao conselho fiscal.', { data: quandoMs(s.frozen_at_ms) }) : t('Prévia ao vivo ({de} a {ate}): os totais congelam no envio ao conselho fiscal.', { de: quando(range.from), ate: quando(range.to) })}</p>
        <TotalsTiles income={tot.income_total} expense={tot.expense_total} balance={tot.balance} />
        {s?.budget_lines ? <BudgetVsActualTable rows={budgetVsActual(s.budget_lines, s)} caption={t('Orçado × realizado')} /> : <CategoryList totais={tot} />}
        {s && <p className="text-xs text-gray-500">{t('{n} lançamentos manuais e {a} automáticos no retrato.', { n: s.entries ?? '—', a: s.auto_entries ?? '—' })}</p>}
      </div>

      <Statements federation={federation} report={report} editavel={acoes.save} />

      {op && (
        <div className="space-y-1 rounded-2xl border border-gray-100 p-4">
          <h4 className="font-bold text-ink">{t('Parecer do conselho fiscal')}</h4>
          <p className="text-sm"><V2Badge tone={op.verdict === 'reject' ? 'red' : op.verdict === 'approve' ? 'green' : 'amber'}>{rotulo(OPINION_VERDICTS, op.verdict)}</V2Badge> <span className="text-gray-500">{op.by_name} · {quandoMs(op.at_ms)}{op.by_admin ? ` · ${t('registrado pela administração')}` : ''}</span></p>
          <p className="whitespace-pre-line text-sm text-gray-700">{op.text}</p>
        </div>
      )}
      {report.assembly?.result && (
        <p className="text-sm text-gray-700"><span className="font-bold text-ink">{t('Assembleia')}: </span>{quando(report.assembly.date)} · {rotulo(ASSEMBLY_RESULTS, report.assembly.result)}{report.assembly.event_title ? ` · ${report.assembly.event_title}` : ''}{report.assembly.note ? ` — ${report.assembly.note}` : ''}</p>
      )}
      {report.acervo?.statements_doc_id && (
        <div className="flex flex-wrap gap-3 text-sm">
          <Link className="inline-flex min-h-11 items-center font-bold text-ink underline" to={docPublicPath(federation, report.acervo.statements_doc_id)}>{t('Ver no acervo: demonstrações')}{report.acervo.statements_code ? ` (${report.acervo.statements_code})` : ''}</Link>
          {report.acervo.opinion_doc_id && <Link className="inline-flex min-h-11 items-center font-bold text-ink underline" to={docPublicPath(federation, report.acervo.opinion_doc_id)}>{t('Ver no acervo: parecer')}</Link>}
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        {acoes.reopen && <V2Button type="button" variant="ghost" onClick={() => setDialogo('reabrir')}><RotateCcw className="h-4 w-4" />{t('Reabrir')}</V2Button>}
        {acoes.submit && <V2Button type="button" disabled={!terminou || m.isPending} title={terminou ? undefined : t('O período ainda não terminou.')} onClick={() => setDialogo('enviar')}><Send className="h-4 w-4" />{t('Enviar ao conselho fiscal')}</V2Button>}
        {acoes.opinion && <V2Button type="button" onClick={() => setDialogo('parecer')} data-dica="federacao-contas-parecer"><Stamp className="h-4 w-4" />{t('Dar o parecer')}</V2Button>}
        {acoes.assembly && <V2Button type="button" variant="secondary" onClick={() => setDialogo('assembleia')}><Gavel className="h-4 w-4" />{t('Registrar a assembleia')}</V2Button>}
        {acoes.publish && <V2Button type="button" onClick={() => setDialogo('publicar')}><Globe className="h-4 w-4" />{t('Publicar na transparência')}</V2Button>}
      </div>
      {acoes.submit && !terminou && <p className="text-right text-xs text-gray-500">{t('O envio abre depois de {data}, o último dia do período.', { data: quando(range.to) })}</p>}
      <HistoryList history={report.history} />

      <ConfirmDialog open={dialogo === 'enviar'} onOpenChange={(o) => { if (!o) fechar(); }} title={t('Enviar ao conselho fiscal?')} description={t('Os totais congelam e o período fica fechado para lançamentos. Quem tem o papel do conselho fiscal é avisado.')} confirmLabel={t('Enviar')} loading={m.isPending} onConfirm={() => rodar({ action: 'report_submit', reportId: report.id }, t('Prestação enviada ao conselho fiscal.'))} />
      <ConfirmDialog open={dialogo === 'reabrir'} onOpenChange={(o) => { if (!o) fechar(); }} title={t('Reabrir a prestação?')} description={t('Volta a rascunho, os totais descongelam e o período reabre. Só é possível antes do parecer.')} confirmLabel={t('Reabrir')} loading={m.isPending} confirmDisabled={!motivoOk(motivo)} onConfirm={() => rodar({ action: 'report_open', period: report.period, reason: motivo }, t('Prestação reaberta.'))}>
        <ReasonField id="pc-motivo" value={motivo} onChange={setMotivo} />
      </ConfirmDialog>
      <ConfirmDialog open={dialogo === 'publicar'} onOpenChange={(o) => { if (!o) fechar(); }} title={t('Publicar a prestação de contas?')} description={isClubScope(federation) ? t('Aparece na página do clube, com os totais e o parecer do conselho fiscal. Publicado não sai.') : federation.modules?.official_docs ? t('Aparece na página da federação e vira dois atos no acervo oficial: as demonstrações e o parecer do conselho fiscal. Publicado não sai.') : t('Aparece na página da federação, na aba Documentos. Publicado não sai.')} confirmLabel={t('Publicar')} loading={m.isPending} onConfirm={() => rodar({ action: 'report_publish', reportId: report.id }, t('Prestação de contas publicada.'))} />
      <Dialog open={dialogo === 'parecer' || dialogo === 'assembleia'} onOpenChange={(o) => { if (!o) fechar(); }}>
        <DialogContent className="max-h-[90dvh] max-w-xl overflow-y-auto" onInteractOutside={(e) => { if (haAlteracaoNaoSalva()) e.preventDefault(); }}>
          <DialogTitle>{dialogo === 'parecer' ? t('Parecer do conselho fiscal') : t('Assembleia das contas')}</DialogTitle>
          <DialogDescription>{periodLabel(report.period)}</DialogDescription>
          {dialogo === 'parecer' && <OpinionForm federation={federation} report={report} onFechar={fechar} />}
          {dialogo === 'assembleia' && <AssemblyForm federation={federation} report={report} hoje={hoje} onFechar={fechar} />}
        </DialogContent>
      </Dialog>
    </V2Surface>
  );
}

export default function FedReportsTab({ federation, perms, items, reports, hoje }) {
  const prep = canPrepareAccounts(perms);
  const lista = useMemo(() => [...reports].sort((a, b) => String(b.period).localeCompare(String(a.period))), [reports]);
  const [selId, setSelId] = useState(() => (lista.find((r) => r.status === ACCOUNT_REPORT_STATUS.SUBMITTED) || lista[0])?.id || '');
  const sel = lista.find((r) => r.id === selId) || lista[0] || null;
  const periodos = useMemo(() => openablePeriods(reports, hoje), [reports, hoje]);
  const [periodo, setPeriodo] = useState('');
  const m = useAccountsMutation(federation, (p) => callAccounts(federation, { action: 'report_open', period: p }));
  const abrir = () => m.mutate(periodo, { onSuccess: (r) => { toast.success(t('Prestação aberta.')); setSelId(r?.reportId || ''); setPeriodo(''); }, onError: (e) => toast.error(e.message) });
  return (
    <div className="space-y-4" data-dica="federacao-contas-prestacao">
      {prep && periodos.length > 0 && (
        <V2Surface variant="compacto" className="flex flex-wrap items-end gap-3 p-4">
          <V2Field label={t('Abrir a prestação de')} htmlFor="pc-periodo" className="w-56">
            <V2Select id="pc-periodo" value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
              <option value="">{t('Escolha o período')}</option>
              {periodos.map((p) => <option key={p} value={p}>{periodLabel(p)}</option>)}
            </V2Select>
          </V2Field>
          <V2Button type="button" disabled={!periodo || m.isPending} onClick={abrir}><FilePlus2 className="h-4 w-4" />{t('Abrir')}</V2Button>
        </V2Surface>
      )}
      {lista.length === 0 ? (
        <V2Surface><p className="text-sm text-gray-500">{prep ? t('Abra a primeira prestação de contas. A do ano é obrigatória: abra quando o ano terminar e publique até o fim de abril.') : t('O financeiro abre a prestação de contas; quando enviar, ela aparece aqui para o parecer.')}</p></V2Surface>
      ) : (
        <>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('Prestações de contas')}>
            {lista.map((r) => (
              <button key={r.id} type="button" aria-pressed={sel?.id === r.id} onClick={() => setSelId(r.id)}
                className={`min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acid/30 ${sel?.id === r.id ? 'border-ink bg-ink text-acid' : 'border-gray-100 bg-paper-pure text-ink hover:border-ink/30'}`}>
                {r.period} · {t(ACCOUNT_REPORT_STATUS_LABELS[r.status] || r.status)}
              </button>
            ))}
          </div>
          {sel && <ReportDetail key={sel.id} federation={federation} perms={perms} report={sel} items={items} hoje={hoje} />}
        </>
      )}
    </div>
  );
}
