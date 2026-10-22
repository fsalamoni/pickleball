/**
 * Contas → Orçamento: o orçamento do ano por categoria, ao lado do orçado e
 * do realizado do ano anterior. Rascunho → enviado → aprovado (ligado a uma
 * reunião da agenda) → publicado na transparência. Mexer no aprovado é
 * REFORMULAR, com motivo no histórico (o valor anterior fica guardado).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Globe, Save, Send, Undo2 } from 'lucide-react';
import { accountsAction } from '@/modules/federations/services/accountsService';
import { useFederationMutation } from '@/modules/federations/hooks/useFederations';
import {
  BUDGET_STATUS, BUDGET_STATUS_LABELS, EXPENSE_CATEGORIES, INCOME_CATEGORIES, budgetActions, budgetTotals, itemsInPeriod, lineKey, totalsByCategory, validateAssemblyInput, validateBudgetInput,
} from '@/modules/federations/domain/accounts';
import { parseBrlCents } from '@/modules/federations/domain/charges';
import { V2Badge, V2Button, V2Field, V2Input, V2Surface, V2Textarea } from '@/v2/ui/primitives';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { t } from '@/core/i18n';
import { quando } from '../../federationUi';
import { useAvisoNaoSalvo } from '../naoSalvo';
import { reais, reaisParaCampo } from '../../accounts/accountsUi';
import { HistoryList, MeetingSelect, ReasonField, YearSelect, accountYears, motivoOk } from './accountsForms';

const camposDe = (budget) => Object.fromEntries([...INCOME_CATEGORIES.map((c) => lineKey('income', c.id)), ...EXPENSE_CATEGORIES.map((c) => lineKey('expense', c.id))].map((k) => [k, reaisParaCampo(budget?.lines?.[k])]));
const linhasDe = (campos) => Object.fromEntries(Object.entries(campos).map(([k, v]) => [k, String(v).trim() === '' ? 0 : parseBrlCents(v)]));

function Linhas({ kind, cats, campos, setCampo, erros, anterior, realAnterior, leitura }) {
  return (
    <div className="space-y-2">
      <div className="hidden grid-cols-12 gap-3 text-xs font-bold uppercase tracking-wider text-gray-500 md:grid">
        <span className="col-span-4">{t('Categoria')}</span>
        <span className="col-span-3 text-right">{t('Orçado no ano anterior')}</span>
        <span className="col-span-2 text-right">{t('Realizado no ano anterior')}</span>
        <span className="col-span-3">{t('Orçamento (R$)')}</span>
      </div>
      {cats.map((c) => {
        const k = lineKey(kind, c.id);
        return (
          <div key={k} className="grid grid-cols-2 items-center gap-x-3 gap-y-1 border-b border-gray-50 pb-2 md:grid-cols-12">
            <label htmlFor={`orc-${k}`} className="col-span-2 text-sm font-semibold text-ink md:col-span-4">{t(c.label)}</label>
            <span className="text-xs text-gray-500 md:col-span-3 md:text-right md:text-sm"><span className="md:hidden">{t('Orçado antes')}: </span>{anterior ? reais(anterior[k] || 0) : '—'}</span>
            <span className="text-right text-xs text-gray-500 md:col-span-2 md:text-sm"><span className="md:hidden">{t('Realizado antes')}: </span>{reais(realAnterior[kind]?.[c.id] || 0)}</span>
            <div className="col-span-2 md:col-span-3">
              <V2Input id={`orc-${k}`} inputMode="decimal" placeholder="0,00" value={campos[k]} readOnly={leitura} aria-invalid={Boolean(erros[`lines.${k}`])} onChange={(e) => setCampo(k, e.target.value)} />
              {erros[`lines.${k}`] && <p className="mt-1 text-xs text-red-600">{erros[`lines.${k}`]}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function FedBudgetTab({ federation, perms, items, budgets, hoje }) {
  const anoAtual = Number(hoje.slice(0, 4));
  const [ano, setAno] = useState(anoAtual);
  const anos = useMemo(() => accountYears(items, budgets, anoAtual), [items, budgets, anoAtual]);
  const budget = budgets.find((b) => Number(b.year) === ano) || null;
  const antes = budgets.find((b) => Number(b.year) === ano - 1) || null;
  const realAnterior = useMemo(() => totalsByCategory(itemsInPeriod(items, String(ano - 1))), [items, ano]);
  const acoes = budgetActions(budget, perms);
  const leitura = !acoes.save;

  const [campos, setCampos] = useState(() => camposDe(budget));
  const [notas, setNotas] = useState(budget?.notes || '');
  const [erros, setErros] = useState({});
  const base = `${ano}:${budget?.updated_at_ms || 0}`;
  useEffect(() => { setCampos(camposDe(budget)); setNotas(budget?.notes || ''); setErros({}); }, [base]); // eslint-disable-line react-hooks/exhaustive-deps
  const alterado = !leitura && (JSON.stringify(campos) !== JSON.stringify(camposDe(budget)) || notas !== (budget?.notes || ''));
  useAvisoNaoSalvo(alterado);
  const setCampo = (k, v) => { setCampos((x) => ({ ...x, [k]: v })); setErros({}); };
  const totais = budgetTotals(Object.fromEntries(Object.entries(linhasDe(campos)).filter(([, v]) => Number.isInteger(v))));

  const [dialogo, setDialogo] = useState(null); // 'reformular' | 'enviar' | 'aprovar' | 'publicar' | 'voltar'
  const [motivo, setMotivo] = useState('');
  const [aprov, setAprov] = useState({ date: hoje, event_id: '', note: '' });
  const fechar = () => { setDialogo(null); setMotivo(''); };
  const m = useFederationMutation((payload) => accountsAction({ federationId: federation.id, ...payload }));
  const rodar = (payload, okMsg) => m.mutate(payload, { onSuccess: () => { toast.success(okMsg); fechar(); }, onError: (e) => toast.error(e.message) });

  const salvar = (reason) => {
    const r = validateBudgetInput({ year: ano, lines: linhasDe(campos), notes: notas });
    if (!r.ok) { setErros(r.errors); toast.error(Object.values(r.errors)[0]); return; }
    rodar({ action: 'budget_save', budget: { year: ano, lines: r.value.lines, notes: r.value.notes }, reason }, acoes.reformulate ? t('Orçamento reformulado: voltou a rascunho.') : t('Orçamento salvo.'));
  };
  const aprovOk = validateAssemblyInput({ ...aprov, result: 'approved' }).ok;

  return (
    <div className="space-y-4" data-dica="federacao-contas-orcamento">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <YearSelect id="orc-ano" value={ano} onChange={setAno} years={anos} />
        <div className="flex flex-wrap items-center gap-2">
          <V2Badge tone={budget ? (budget.status === BUDGET_STATUS.DRAFT ? 'neutral' : 'green') : 'neutral'}>{budget ? t(BUDGET_STATUS_LABELS[budget.status] || budget.status) : t('Sem orçamento')}</V2Badge>
          {budget?.approved_in?.date && <span className="text-xs text-gray-500">{t('Aprovado em {data}', { data: quando(budget.approved_in.date) })}{budget.approved_in.event_title ? ` · ${budget.approved_in.event_title}` : ''}</span>}
        </div>
      </div>
      {budget?.status === BUDGET_STATUS.SUBMITTED && <p className="rounded-2xl border border-gray-100 bg-paper px-4 py-3 text-sm text-gray-700">{t('Enviado para aprovação: registre a aprovação (assembleia ou reunião) ou volte a rascunho para mudar.')}</p>}
      {acoes.reformulate && <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{t('Este orçamento já foi aprovado. Mudar é reformular: pede motivo, volta a rascunho e precisa ser aprovado de novo. O publicado continua na página até a nova publicação.')}</p>}

      <V2Surface className="space-y-4">
        <h3 className="font-display text-base font-bold text-ink">{t('Receitas')}</h3>
        <Linhas kind="income" cats={INCOME_CATEGORIES} campos={campos} setCampo={setCampo} erros={erros} anterior={antes?.lines} realAnterior={realAnterior} leitura={leitura} />
        <h3 className="pt-2 font-display text-base font-bold text-ink">{t('Despesas')}</h3>
        <Linhas kind="expense" cats={EXPENSE_CATEGORIES} campos={campos} setCampo={setCampo} erros={erros} anterior={antes?.lines} realAnterior={realAnterior} leitura={leitura} />
        <dl className="grid gap-2 rounded-2xl bg-paper p-3 text-sm sm:grid-cols-3">
          <div><dt className="text-gray-500">{t('Receitas previstas')}</dt><dd className="font-semibold tabular-nums text-ink">{reais(totais.income)}</dd></div>
          <div><dt className="text-gray-500">{t('Despesas previstas')}</dt><dd className="font-semibold tabular-nums text-ink">{reais(totais.expense)}</dd></div>
          <div><dt className="text-gray-500">{t('Resultado previsto')}</dt><dd className={`font-semibold tabular-nums ${totais.balance < 0 ? 'text-red-600' : 'text-ink'}`}>{reais(totais.balance)}</dd></div>
        </dl>
        <V2Field label={t('Observações (opcional)')} htmlFor="orc-notas" hint={t('Premissas do orçamento. Vão junto na publicação.')}>
          <V2Textarea id="orc-notas" rows={3} maxLength={2000} readOnly={leitura} value={notas} onChange={(e) => setNotas(e.target.value)} />
        </V2Field>
        <div className="flex flex-wrap justify-end gap-2">
          {acoes.back && <V2Button type="button" variant="ghost" onClick={() => setDialogo('voltar')}><Undo2 className="h-4 w-4" />{t('Voltar a rascunho')}</V2Button>}
          {acoes.save && <V2Button type="button" variant={acoes.submit && !alterado ? 'secondary' : 'primary'} disabled={m.isPending || (!alterado && Boolean(budget))} onClick={() => (acoes.reformulate ? setDialogo('reformular') : salvar())}><Save className="h-4 w-4" />{acoes.reformulate ? t('Reformular') : t('Salvar')}</V2Button>}
          {acoes.submit && <V2Button type="button" disabled={m.isPending || alterado} title={alterado ? t('Salve antes de enviar.') : undefined} onClick={() => setDialogo('enviar')}><Send className="h-4 w-4" />{t('Enviar para aprovação')}</V2Button>}
          {acoes.approve && <V2Button type="button" disabled={m.isPending} onClick={() => setDialogo('aprovar')}><CheckCircle2 className="h-4 w-4" />{t('Registrar a aprovação')}</V2Button>}
          {acoes.publish && <V2Button type="button" disabled={m.isPending || alterado} onClick={() => setDialogo('publicar')}><Globe className="h-4 w-4" />{t('Publicar na transparência')}</V2Button>}
        </div>
        {budget && <HistoryList history={budget.history} />}
      </V2Surface>

      <ConfirmDialog open={dialogo === 'reformular'} onOpenChange={(o) => { if (!o) fechar(); }} title={t('Reformular o orçamento de {ano}?', { ano })} description={t('Volta a rascunho e precisa ser aprovado de novo. O valor anterior fica guardado no histórico.')} confirmLabel={t('Reformular')} loading={m.isPending} confirmDisabled={!motivoOk(motivo)} onConfirm={() => salvar(motivo)}>
        <ReasonField id="orc-motivo" value={motivo} onChange={setMotivo} />
      </ConfirmDialog>
      <ConfirmDialog open={dialogo === 'enviar'} onOpenChange={(o) => { if (!o) fechar(); }} title={t('Enviar o orçamento de {ano} para aprovação?', { ano })} description={t('Ele fica travado até a aprovação ser registrada (ou até voltar a rascunho).')} confirmLabel={t('Enviar')} loading={m.isPending} onConfirm={() => rodar({ action: 'budget_submit', year: ano }, t('Orçamento enviado para aprovação.'))} />
      <ConfirmDialog open={dialogo === 'voltar'} onOpenChange={(o) => { if (!o) fechar(); }} title={t('Voltar o orçamento a rascunho?')} description={t('Para mudar os valores antes da aprovação.')} confirmLabel={t('Voltar a rascunho')} loading={m.isPending} onConfirm={() => rodar({ action: 'budget_save', budget: { year: ano, lines: budget?.lines || {}, notes: budget?.notes || '' } }, t('O orçamento voltou a rascunho.'))} />
      <ConfirmDialog open={dialogo === 'aprovar'} onOpenChange={(o) => { if (!o) fechar(); }} title={t('Registrar a aprovação do orçamento de {ano}', { ano })} description={t('A data e a reunião em que a assembleia (ou o órgão do estatuto) aprovou.')} confirmLabel={t('Registrar a aprovação')} loading={m.isPending} confirmDisabled={!aprovOk} onConfirm={() => rodar({ action: 'budget_approve', year: ano, approval: aprov }, t('Aprovação registrada.'))}>
        <div className="space-y-3">
          <V2Field label={t('Data da aprovação')} htmlFor="orc-aprov-data" required><V2Input id="orc-aprov-data" type="date" max={hoje} value={aprov.date} onChange={(e) => setAprov((x) => ({ ...x, date: e.target.value }))} /></V2Field>
          <MeetingSelect federation={federation} id="orc-aprov-reuniao" value={aprov.event_id} onChange={(v) => setAprov((x) => ({ ...x, event_id: v }))} />
          <V2Field label={t('Observação (opcional)')} htmlFor="orc-aprov-nota"><V2Textarea id="orc-aprov-nota" rows={2} maxLength={2000} value={aprov.note} onChange={(e) => setAprov((x) => ({ ...x, note: e.target.value }))} /></V2Field>
        </div>
      </ConfirmDialog>
      <ConfirmDialog open={dialogo === 'publicar'} onOpenChange={(o) => { if (!o) fechar(); }} title={t('Publicar o orçamento de {ano}?', { ano })} description={t('Aparece na página da federação (aba Documentos) para todo mundo que vê a federação. Publicado não sai: uma reformulação aprovada substitui.')} confirmLabel={t('Publicar')} loading={m.isPending} onConfirm={() => rodar({ action: 'budget_publish', year: ano }, t('Orçamento publicado na transparência.'))} />
    </div>
  );
}
