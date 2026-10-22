/**
 * Contas → Lançamentos: as receitas e despesas do ano. As cobranças pagas
 * entram SOZINHAS (marcadas "Cobrança paga"); o resto o financeiro lança,
 * com a nota ou o recibo anexado. Lançamento não se apaga: ESTORNA, com
 * motivo — e o período com prestação enviada fica fechado.
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Ban, Download, Paperclip, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { accountsAction } from '@/modules/federations/services/accountsService';
import { useFederationMutation } from '@/modules/federations/hooks/useFederations';
import {
  AUTO_LABELS, ENTRY_KIND, ENTRY_STATUS, canPrepareAccounts, categoriesOf, categoryLabel, chargeIncomeItems, closedPeriodFor, ledgerCsv, validateEntryInput,
} from '@/modules/federations/domain/accounts';
import { parseBrlCents } from '@/modules/federations/domain/charges';
import { V2Badge, V2Button, V2Field, V2Input, V2Select, V2Surface } from '@/v2/ui/primitives';
import { t, tk } from '@/core/i18n';
import { quando } from '../../federationUi';
import { BuscaLista, MostrarMais, useBuscaLista } from '../listTools';
import { baixarCsv, haAlteracaoNaoSalva, useAvisoNaoSalvo } from '../naoSalvo';
import { reais } from '../../accounts/accountsUi';
import { AccountFileInput, ReasonField, YearSelect, accountYears, baixarArquivoDoServidor, motivoOk } from './accountsForms';

const VAZIO = { kind: ENTRY_KIND.EXPENSE, category: '', date: '', amount: '', description: '', counterparty: '', document: null };

function EntryForm({ federation, hoje, onFechar }) {
  const [f, setF] = useState({ ...VAZIO, date: hoje });
  const [erros, setErros] = useState({});
  const alterado = Boolean(f.amount || f.description || f.counterparty || f.document || f.category);
  useAvisoNaoSalvo(alterado);
  const set = (patch) => { setF((x) => ({ ...x, ...patch })); setErros({}); };
  const m = useFederationMutation((entry) => accountsAction({ federationId: federation.id, action: 'entry_add', entry }));
  const lancar = (e) => {
    e.preventDefault();
    const entry = { kind: f.kind, category: f.category, date: f.date, amount_cents: parseBrlCents(f.amount), description: f.description, counterparty: f.counterparty, document: f.document };
    const r = validateEntryInput(entry, { hoje });
    if (!r.ok) { setErros(r.errors); return; }
    m.mutate(r.value, { onSuccess: () => { toast.success(t('Lançamento registrado.')); onFechar(true); }, onError: (er) => toast.error(er.message) });
  };
  return (
    <form onSubmit={lancar} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <V2Field label={t('Tipo')} htmlFor="lc-tipo" error={erros.kind}>
          <V2Select id="lc-tipo" value={f.kind} onChange={(e) => set({ kind: e.target.value, category: '' })}>
            <option value={ENTRY_KIND.EXPENSE}>{t('Despesa')}</option>
            <option value={ENTRY_KIND.INCOME}>{t('Receita')}</option>
          </V2Select>
        </V2Field>
        <V2Field label={t('Categoria')} htmlFor="lc-cat" error={erros.category} required>
          <V2Select id="lc-cat" value={f.category} onChange={(e) => set({ category: e.target.value })}>
            <option value="">{t('Escolha')}</option>
            {categoriesOf(f.kind).map((c) => <option key={c.id} value={c.id}>{t(c.label)}</option>)}
          </V2Select>
        </V2Field>
        <V2Field label={t('Data')} htmlFor="lc-data" error={erros.date} required><V2Input id="lc-data" type="date" max={hoje} value={f.date} onChange={(e) => set({ date: e.target.value })} /></V2Field>
        <V2Field label={t('Valor (R$)')} htmlFor="lc-valor" error={erros.amount_cents} required><V2Input id="lc-valor" inputMode="decimal" placeholder="0,00" value={f.amount} onChange={(e) => set({ amount: e.target.value })} /></V2Field>
        <V2Field label={t('Descrição')} htmlFor="lc-desc" error={erros.description} required className="sm:col-span-2"><V2Input id="lc-desc" maxLength={300} value={f.description} onChange={(e) => set({ description: e.target.value })} /></V2Field>
        <V2Field label={t('Quem pagou ou recebeu (opcional)')} htmlFor="lc-contra" className="sm:col-span-2"><V2Input id="lc-contra" maxLength={120} value={f.counterparty} onChange={(e) => set({ counterparty: e.target.value })} /></V2Field>
      </div>
      <AccountFileInput id="lc-anexo" value={f.document} onChange={(d) => set({ document: d })} />
      {erros.document && <p className="text-sm text-red-600">{erros.document}</p>}
      <p className="text-xs text-gray-500">{t('As cobranças pagas de filiação, renovação, curso e multa entram sozinhas: não lance de novo.')}</p>
      <div className="flex justify-end gap-2">
        <V2Button type="button" variant="ghost" onClick={() => onFechar(false)}>{t('Cancelar')}</V2Button>
        <V2Button type="submit" disabled={m.isPending}><Plus className="h-4 w-4" />{t('Lançar')}</V2Button>
      </div>
    </form>
  );
}

const ORIGENS = [{ id: 'todas', label: tk('Todas as origens') }, { id: 'manual', label: tk('Lançados à mão') }, { id: 'auto', label: tk('Automáticos') }];

function OrigemBadge({ x }) {
  if (x.auto) return <V2Badge tone="blue">{t(AUTO_LABELS[x.auto] || AUTO_LABELS.derived)}</V2Badge>;
  return x.status === ENTRY_STATUS.VOID ? <V2Badge tone="red" title={x.void_reason}>{t('Estornado')}</V2Badge> : <V2Badge tone="neutral">{t('Manual')}</V2Badge>;
}

function Valor({ x }) {
  const cor = x.status === ENTRY_STATUS.VOID ? 'text-gray-500 line-through' : x.kind === ENTRY_KIND.EXPENSE ? 'text-red-600' : 'text-green-700';
  return <span className={`font-semibold tabular-nums ${cor}`}>{x.kind === ENTRY_KIND.EXPENSE ? '−' : '+'} {reais(x.amount_cents)}</span>;
}

export default function FedLedgerTab({ federation, perms, items, ledger, charges, budgets, reports, hoje }) {
  const prep = canPrepareAccounts(perms);
  const anoAtual = Number(hoje.slice(0, 4));
  const [ano, setAno] = useState(anoAtual);
  const anos = useMemo(() => accountYears(items, budgets, anoAtual), [items, budgets, anoAtual]);
  const [tipo, setTipo] = useState('todos');
  const [origem, setOrigem] = useState('todas');
  // Manuais (com os estornados, marcados) + automáticos (cobranças pagas).
  const linhas = useMemo(() => [...ledger.map((x) => ({ ...x, id: x.id })), ...chargeIncomeItems(charges)]
    .filter((x) => String(x.date || '').startsWith(String(ano)))
    .filter((x) => tipo === 'todos' || x.kind === tipo)
    .filter((x) => origem === 'todas' || (origem === 'auto' ? Boolean(x.auto) : !x.auto))
    .sort((a, b) => String(b.date).localeCompare(String(a.date))), [ledger, charges, ano, tipo, origem]);
  const busca = useBuscaLista(linhas, (x) => `${x.description} ${x.counterparty || ''} ${categoryLabel(x.kind, x.category)}`);
  const [novo, setNovo] = useState(false);
  const [estornar, setEstornar] = useState(null);
  const [motivo, setMotivo] = useState('');
  const mVoid = useFederationMutation(() => accountsAction({ federationId: federation.id, action: 'entry_void', entryId: estornar.id, reason: motivo }));
  const [baixando, setBaixando] = useState('');
  const baixar = async (x) => {
    setBaixando(x.id);
    try { baixarArquivoDoServidor(await accountsAction({ federationId: federation.id, action: 'file', entryId: x.id })); } catch (e) { toast.error(e.message); } finally { setBaixando(''); }
  };

  const acoes = (x) => (
    <div className="flex flex-wrap justify-end gap-1">
      {x.document && <V2Button type="button" size="sm" variant="ghost" disabled={baixando === x.id} onClick={() => baixar(x)} aria-label={t('Baixar o anexo de {d}', { d: x.description })}><Paperclip className="h-4 w-4" /></V2Button>}
      {prep && !x.auto && x.status !== ENTRY_STATUS.VOID && !closedPeriodFor(x.date, reports) && <V2Button type="button" size="sm" variant="ghost" onClick={() => { setMotivo(''); setEstornar(x); }} aria-label={t('Estornar {d}', { d: x.description })}><Ban className="h-4 w-4" /></V2Button>}
    </div>
  );

  return (
    <div className="space-y-4" data-dica="federacao-contas-lancamentos">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <YearSelect id="lc-ano" value={ano} onChange={setAno} years={anos} />
          <V2Field label={t('Tipo')} htmlFor="lc-filtro-tipo" className="w-40">
            <V2Select id="lc-filtro-tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="todos">{t('Receitas e despesas')}</option>
              <option value={ENTRY_KIND.INCOME}>{t('Receitas')}</option>
              <option value={ENTRY_KIND.EXPENSE}>{t('Despesas')}</option>
            </V2Select>
          </V2Field>
          <V2Field label={t('Origem')} htmlFor="lc-filtro-origem" className="w-44">
            <V2Select id="lc-filtro-origem" value={origem} onChange={(e) => setOrigem(e.target.value)}>
              {ORIGENS.map((o) => <option key={o.id} value={o.id}>{t(o.label)}</option>)}
            </V2Select>
          </V2Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <V2Button type="button" variant="secondary" disabled={!linhas.length} onClick={() => baixarCsv(ledgerCsv(busca.filtrados), `lancamentos-${federation.acronym || federation.id}-${ano}.csv`)}><Download className="h-4 w-4" />{t('Planilha')}</V2Button>
          {prep && <V2Button type="button" onClick={() => setNovo(true)} data-dica="federacao-contas-lancar"><Plus className="h-4 w-4" />{t('Novo lançamento')}</V2Button>}
        </div>
      </div>
      <BuscaLista id="lc-busca" value={busca.termo} onChange={busca.setTermo} placeholder={t('Buscar por descrição, contraparte ou categoria')} total={linhas.length} achados={busca.filtrados.length} />
      {busca.filtrados.length === 0 ? (
        <V2Surface><p className="text-sm text-gray-500">{linhas.length ? t('Nada com essa busca.') : t('Nada lançado em {ano} com esses filtros.', { ano })}</p></V2Surface>
      ) : (
        <>
          <ul className="space-y-2 md:hidden">
            {busca.visiveis.map((x) => (
              <li key={x.id} className="space-y-1 rounded-2xl border border-gray-100 bg-paper-pure p-3">
                <div className="flex items-start justify-between gap-2"><p className="font-semibold text-ink">{x.description}</p><Valor x={x} /></div>
                <p className="text-xs text-gray-500">{quando(x.date)} · {categoryLabel(x.kind, x.category)}{x.counterparty ? ` · ${x.counterparty}` : ''}</p>
                <div className="flex items-center justify-between gap-2"><OrigemBadge x={x} />{acoes(x)}</div>
              </li>
            ))}
          </ul>
          <V2Surface className="hidden overflow-x-auto p-0 md:block">
            <table className="w-full text-sm">
              <caption className="sr-only">{t('Lançamentos de {ano}', { ano })}</caption>
              <thead><tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wider text-gray-500">
                <th scope="col" className="px-4 py-3 font-bold">{t('Data')}</th>
                <th scope="col" className="px-4 py-3 font-bold">{t('Descrição')}</th>
                <th scope="col" className="px-4 py-3 font-bold">{t('Categoria')}</th>
                <th scope="col" className="px-4 py-3 text-right font-bold">{t('Valor')}</th>
                <th scope="col" className="px-4 py-3 font-bold">{t('Origem')}</th>
                <th scope="col" className="px-4 py-3"><span className="sr-only">{t('Ações')}</span></th>
              </tr></thead>
              <tbody>
                {busca.visiveis.map((x) => (
                  <tr key={x.id} className="border-b border-gray-50">
                    <td className="whitespace-nowrap px-4 py-2 text-gray-700">{quando(x.date)}</td>
                    <td className="px-4 py-2"><span className="font-semibold text-ink">{x.description}</span>{x.counterparty && <span className="block text-xs text-gray-500">{x.counterparty}</span>}</td>
                    <td className="px-4 py-2 text-gray-700">{categoryLabel(x.kind, x.category)}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-right"><Valor x={x} /></td>
                    <td className="px-4 py-2"><OrigemBadge x={x} /></td>
                    <td className="px-4 py-2">{acoes(x)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </V2Surface>
          <MostrarMais restam={busca.restam} onClick={busca.mostrarMais} />
        </>
      )}

      <Dialog open={novo} onOpenChange={(o) => { if (!o) setNovo(false); }}>
        <DialogContent className="max-h-[90dvh] max-w-xl overflow-y-auto" onInteractOutside={(e) => { if (haAlteracaoNaoSalva()) e.preventDefault(); }}>
          <DialogTitle>{t('Novo lançamento')}</DialogTitle>
          <DialogDescription>{t('Receita ou despesa que já aconteceu, com o comprovante.')}</DialogDescription>
          {novo && <EntryForm federation={federation} hoje={hoje} onFechar={() => setNovo(false)} />}
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={Boolean(estornar)} onOpenChange={(o) => { if (!o) setEstornar(null); }} destructive title={t('Estornar o lançamento?')} description={estornar ? `${estornar.description} · ${reais(estornar.amount_cents)}` : ''} confirmLabel={t('Estornar')} loading={mVoid.isPending} confirmDisabled={!motivoOk(motivo)}
        onConfirm={() => mVoid.mutate(undefined, { onSuccess: () => { toast.success(t('Lançamento estornado.')); setEstornar(null); }, onError: (e) => toast.error(e.message) })}>
        <ReasonField id="lc-motivo" value={motivo} onChange={setMotivo} hint={t('O lançamento continua na lista, riscado, com o motivo. Mínimo 10 caracteres.')} />
      </ConfirmDialog>
    </div>
  );
}
