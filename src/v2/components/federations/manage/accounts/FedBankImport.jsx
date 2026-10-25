/**
 * Contas → Lançamentos → Importar extrato: o financeiro escolhe o arquivo
 * que o banco exporta (OFX ou planilha), confere os movimentos — crédito é
 * receita, débito é despesa — ajusta a categoria e importa. O que já está no
 * livro (mesma identidade do banco), no futuro ou em período fechado chega
 * desmarcado e explicado. Quem grava é o servidor (`entry_import`).
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { FileUp, Upload } from 'lucide-react';
import { callAccounts, useAccountsMutation } from './accountsScope';
import { BANK_IMPORT_MAX, ENTRY_KIND, categoriesOf, closedPeriodFor } from '@/modules/federations/domain/accounts';
import { bankImportPayload, decodeBankFile, parseBankStatement, reviewBankRows } from '@/modules/federations/domain/bankStatement';
import { V2Badge, V2Button, V2Select } from '@/v2/ui/primitives';
import { t, tk, tn } from '@/core/i18n';
import { quando } from '../../federationUi';
import { useAvisoNaoSalvo } from '../naoSalvo';
import { reais } from '../../accounts/accountsUi';

const PROBLEMA = {
  duplicate: { tone: 'neutral', label: tk('Já lançado') },
  closed: { tone: 'amber', label: tk('Período fechado') },
  invalid: { tone: 'red', label: tk('Data no futuro ou dado incompleto') },
};

export default function FedBankImport({ federation, ledger, reports, hoje, onFechar }) {
  const [arquivo, setArquivo] = useState('');
  const [lido, setLido] = useState(null);
  const [linhas, setLinhas] = useState([]);
  const marcadas = linhas.filter((r) => r.selected && !r.problem);
  useAvisoNaoSalvo(marcadas.length > 0);
  const m = useAccountsMutation(federation, (entries) => callAccounts(federation, { action: 'entry_import', entries }));

  const ler = async (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error(t('Arquivo grande demais (máximo 5 MB). Exporte um período menor.')); return; }
    const r = parseBankStatement(decodeBankFile(await file.arrayBuffer()));
    setArquivo(file.name);
    setLido(r);
    setLinhas(reviewBankRows(r.rows, { ledger, hoje, closedPeriod: (d) => closedPeriodFor(d, reports) }));
  };

  const muda = (i, patch) => setLinhas((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const todas = (sel) => setLinhas((xs) => xs.map((x) => (x.problem ? x : { ...x, selected: sel })));
  const resumo = useMemo(() => ({
    receitas: marcadas.filter((r) => r.kind === ENTRY_KIND.INCOME).reduce((a, r) => a + r.amount_cents, 0),
    despesas: marcadas.filter((r) => r.kind === ENTRY_KIND.EXPENSE).reduce((a, r) => a + r.amount_cents, 0),
    repetidos: linhas.filter((r) => r.problem === 'duplicate').length,
  }), [marcadas, linhas]);
  const excede = marcadas.length > BANK_IMPORT_MAX;

  const importar = () => {
    m.mutate(bankImportPayload(linhas), {
      onSuccess: (r) => {
        toast.success(r.skipped
          ? t('{n} lançamentos importados; {s} já estavam no livro.', { n: r.imported, s: r.skipped })
          : tn(r.imported, '{n} lançamento importado.', '{n} lançamentos importados.'));
        if (excede) {
          // Os que foram ficam "já lançados" na próxima leitura; os demais seguem aqui para a parte seguinte.
          const enviados = new Set(bankImportPayload(linhas).map((x) => x.bank_ref));
          setLinhas((xs) => xs.map((x) => (enviados.has(x.bank_ref) ? { ...x, problem: 'duplicate', selected: false } : x)));
        } else onFechar(true);
      },
      onError: (e) => toast.error(e.message),
    });
  };

  return (
    <div className="space-y-4">
      <label htmlFor="extrato-arquivo" className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-gray-200 p-5 text-center hover:border-gray-300">
        <FileUp className="h-6 w-6 text-gray-500" aria-hidden />
        <span className="font-semibold text-ink">{arquivo || t('Escolher o arquivo do extrato')}</span>
        <span className="text-xs text-gray-500">{t('OFX (o "extrato para programas financeiros" do internet banking) ou planilha CSV com data, descrição e valor.')}</span>
        <input id="extrato-arquivo" type="file" accept=".ofx,.csv,.txt,application/x-ofx,text/csv,text/plain" className="sr-only" onChange={(e) => { ler(e.target.files?.[0]); e.target.value = ''; }} />
      </label>

      {lido && (
        <div className="space-y-1 text-sm">
          <p className="text-gray-700">
            {tn(lido.rows.length, '{n} movimento lido', '{n} movimentos lidos')}
            {lido.skipped ? ` · ${tn(lido.skipped, '{n} linha de saldo ou valor zero ignorada', '{n} linhas de saldo ou valor zero ignoradas')}` : ''}
            {resumo.repetidos ? ` · ${tn(resumo.repetidos, '{n} já estava no livro', '{n} já estavam no livro')}` : ''}
          </p>
          {lido.errors.length > 0 && (
            <details className="text-red-600">
              <summary className="cursor-pointer">{tn(lido.errors.length, '{n} linha não entendida', '{n} linhas não entendidas')}</summary>
              <ul className="mt-1 list-disc pl-5 text-xs">{lido.errors.slice(0, 20).map((e) => <li key={e}>{e}</li>)}</ul>
            </details>
          )}
        </div>
      )}

      {linhas.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <div className="flex gap-2">
              <V2Button type="button" size="sm" variant="ghost" onClick={() => todas(true)}>{t('Marcar todos')}</V2Button>
              <V2Button type="button" size="sm" variant="ghost" onClick={() => todas(false)}>{t('Desmarcar todos')}</V2Button>
            </div>
            <p className="tabular-nums text-gray-700">
              <span className="text-green-700">+ {reais(resumo.receitas)}</span> · <span className="text-red-600">− {reais(resumo.despesas)}</span>
            </p>
          </div>
          <ul className="max-h-[45dvh] space-y-2 overflow-y-auto pr-1">
            {linhas.map((r, i) => (
              <li key={`${r.bank_ref}-${i}`} className={`rounded-2xl border p-3 ${r.problem ? 'border-gray-100 bg-gray-50' : 'border-gray-100 bg-paper-pure'}`}>
                <div className="flex items-start gap-3">
                  <input id={`mov-${i}`} type="checkbox" className="mt-1 h-5 w-5" checked={r.selected} disabled={Boolean(r.problem)} onChange={(e) => muda(i, { selected: e.target.checked })} />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <label htmlFor={`mov-${i}`} className="min-w-0">
                        <span className="block font-semibold text-ink">{r.description}</span>
                        <span className="block text-xs text-gray-500">{quando(r.date)}{r.counterparty ? ` · ${r.counterparty}` : ''}</span>
                      </label>
                      <span className={`font-semibold tabular-nums ${r.kind === ENTRY_KIND.EXPENSE ? 'text-red-600' : 'text-green-700'}`}>{r.kind === ENTRY_KIND.EXPENSE ? '−' : '+'} {reais(r.amount_cents)}</span>
                    </div>
                    {r.problem ? <V2Badge tone={PROBLEMA[r.problem].tone}>{t(PROBLEMA[r.problem].label)}</V2Badge> : (
                      <V2Select aria-label={t('Categoria de {d}', { d: r.description })} value={r.category} onChange={(e) => muda(i, { category: e.target.value })} className="max-w-xs">
                        {categoriesOf(r.kind).map((c) => <option key={c.id} value={c.id}>{t(c.label)}</option>)}
                      </V2Select>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {excede && <p className="text-sm text-amber-700">{t('No máximo {n} por vez: vão os primeiros {n} marcados, e o resto fica aqui para a parte seguinte.', { n: BANK_IMPORT_MAX })}</p>}
        </>
      )}

      <p className="text-xs text-gray-500">{t('As cobranças pagas pela plataforma já entram sozinhas: desmarque no extrato os Pix de filiação, renovação, curso e multa para não contar duas vezes.')}</p>
      <div className="flex justify-end gap-2">
        <V2Button type="button" variant="ghost" onClick={() => onFechar(false)}>{t('Cancelar')}</V2Button>
        <V2Button type="button" disabled={!marcadas.length || m.isPending} onClick={importar}>
          <Upload className="h-4 w-4" />{tn(Math.min(marcadas.length, BANK_IMPORT_MAX), 'Importar {n} lançamento', 'Importar {n} lançamentos')}
        </V2Button>
      </div>
    </div>
  );
}
