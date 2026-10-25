/**
 * Importar associados (Associados → "Importar lista"): o clube que já tinha a
 * lista de sócios fora da plataforma a traz por CSV (nome, e-mail, número e
 * validade). Quem tem conta com o e-mail entra ativo no plano escolhido; quem
 * não tem fica no histórico das importações para a secretaria convidar. O
 * servidor confere cada pessoa; aqui só se lê o arquivo e se mostra a prévia.
 */
import React, { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Download, Upload } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { parseMembersCsv } from '@/modules/federations/domain/importMembers';
import { IMPORT_CHUNK } from '@/modules/clubs/services/associationService';
import { dataCurta } from '@/modules/clubs/domain/association';
import { useClubImports, useImportMembers } from '@/modules/clubs/hooks/useClubAssociation';
import { V2Button, V2ErrorState, V2Field, V2Select, V2Surface, V2Textarea } from '@/v2/ui/primitives';
import { baixarCsv } from '@/v2/components/federations/manage/naoSalvo';
import { t, tn } from '@/core/i18n';

const MODELO_CSV = 'nome;email;numero;validade\nMaria Silva;maria@exemplo.com;CLB-0001;31/12/2027\n';

export default function ClubImportDialog({ open, onOpenChange, clubId, plansQ }) {
  const [texto, setTexto] = useState('');
  const [planId, setPlanId] = useState('');
  const [resultado, setResultado] = useState(null);
  const arquivo = useRef(null);
  const importar = useImportMembers(clubId);
  const importsQ = useClubImports(clubId, { enabled: open });
  const previa = useMemo(() => (texto.trim() ? parseMembersCsv(texto) : { rows: [], errors: [] }), [texto]);
  const planos = (plansQ.data || []).filter((p) => p.active !== false);

  function lerArquivo(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const leitor = new FileReader();
    leitor.onload = () => setTexto(String(leitor.result || ''));
    leitor.readAsText(f, 'utf-8');
  }
  function enviar(e) {
    e.preventDefault();
    if (!planId || !previa.rows.length) return;
    const rows = previa.rows.map(({ name, email, member_number, valid_until }) => ({ name, email, member_number, valid_until }));
    importar.mutate({ planId, rows }, {
      onSuccess: (r) => { setResultado(r); setTexto(''); toast.success(tn(r.imported, '{n} associado importado.', '{n} associados importados.')); },
      onError: (er) => {
        // Fatias anteriores já valeram: o aviso diz quantas entraram antes da falha.
        const entrou = er.partial?.imported || 0;
        toast.error(entrou ? t('{msg} Já entraram {n} antes do erro; confira a lista e tente o restante.', { msg: er.message, n: entrou }) : er.message);
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto" sheet>
        <DialogHeader>
          <DialogTitle>{t('Importar lista de associados')}</DialogTitle>
          <DialogDescription>{t('Uma planilha CSV com nome, e-mail, número (opcional) e validade (opcional). Quem tem conta com o e-mail entra como associado ativo no plano escolhido, sem cobrança. Quem não tem conta fica numa lista para você convidar.')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={enviar} className="space-y-4" noValidate data-dica="clube-importar">
          <div className="flex flex-wrap items-center gap-2">
            <V2Button type="button" size="sm" variant="secondary" onClick={() => arquivo.current?.click()}><Upload className="h-4 w-4" />{t('Escolher arquivo CSV')}</V2Button>
            <input ref={arquivo} type="file" accept=".csv,text/csv,text/plain" className="sr-only" onChange={lerArquivo} aria-label={t('Arquivo CSV')} />
            <V2Button type="button" size="sm" variant="ghost" onClick={() => baixarCsv(MODELO_CSV, 'associados-modelo.csv')}><Download className="h-4 w-4" />{t('Baixar o modelo')}</V2Button>
          </div>
          <V2Field label={t('Ou cole o conteúdo')} htmlFor="club-imp-texto" hint={t('Primeira linha: nome;email;numero;validade (separado por ; ou ,).')}>
            <V2Textarea id="club-imp-texto" rows={5} value={texto} onChange={(e) => setTexto(e.target.value)} className="font-mono text-xs" />
          </V2Field>
          <V2Field label={t('Plano em que entram')} htmlFor="club-imp-plano" required>
            <V2Select id="club-imp-plano" value={planId} onChange={(e) => setPlanId(e.target.value)}>
              <option value="">{plansQ.isLoading ? t('Carregando…') : t('Escolha…')}</option>
              {planos.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </V2Select>
          </V2Field>
          {plansQ.isError && <V2ErrorState inline title={t('Não carregaram os planos')} onRetry={() => plansQ.refetch()} />}
          {previa.errors.length > 0 && (
            <ul className="space-y-1 text-sm text-red-600">
              {previa.errors.slice(0, 8).map((e) => <li key={e}>{e}</li>)}
              {previa.errors.length > 8 && <li>{t('… e mais {n}', { n: previa.errors.length - 8 })}</li>}
            </ul>
          )}
          {previa.rows.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-ink">{tn(previa.rows.length, '{n} linha pronta para importar', '{n} linhas prontas para importar')}</p>
              {previa.rows.length > IMPORT_CHUNK && <p className="text-xs text-gray-500">{t('Vai em lotes de {n}; você acompanha o total no fim.', { n: IMPORT_CHUNK })}</p>}
              <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-gray-700">
                {previa.rows.slice(0, 40).map((r) => <li key={r.email}>{r.name} · {r.email}{r.member_number ? ` · ${r.member_number}` : ''}{r.valid_until ? ` · ${t('até {data}', { data: dataCurta(r.valid_until) })}` : ''}</li>)}
                {previa.rows.length > 40 && <li>{t('… e mais {n}', { n: previa.rows.length - 40 })}</li>}
              </ul>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <V2Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>{t('Fechar')}</V2Button>
            <V2Button type="submit" disabled={importar.isPending || !previa.rows.length || !planId}>{importar.isPending ? t('Importando…') : t('Importar')}</V2Button>
          </div>
        </form>

        {resultado && (
          <V2Surface variant="compacto" className="space-y-1 p-4">
            <p className="font-bold text-ink">{t('Resultado da importação')}</p>
            <p className="text-sm text-gray-700">
              {tn(resultado.imported, '{n} associado ativado.', '{n} associados ativados.')} {tn(resultado.pending, '{n} sem conta na plataforma.', '{n} sem conta na plataforma.')} {tn(resultado.skipped.length, '{n} pulado.', '{n} pulados.')}
            </p>
            {resultado.skipped.length > 0 && <ul className="text-xs text-gray-500">{resultado.skipped.map((s) => <li key={`${s.email}-${s.reason}`}>{s.email || t('(sem e-mail)')} — {s.reason}</li>)}</ul>}
          </V2Surface>
        )}

        {importsQ.isError && <V2ErrorState inline title={t('Não carregou o histórico das importações')} onRetry={() => importsQ.refetch()} />}
        {importsQ.isSuccess && (importsQ.data || []).some((i) => (i.pending || []).length > 0) && (
          <div className="space-y-2">
            <h3 className="font-display text-base font-bold text-ink">{t('Ainda sem conta na plataforma')}</h3>
            <p className="text-xs text-gray-500">{t('Convide essas pessoas por fora (e-mail, WhatsApp). Quando criarem a conta, use "Associar uma pessoa".')}</p>
            <ul className="max-h-48 space-y-1 overflow-y-auto text-xs text-gray-700">
              {[...importsQ.data].sort((a, b) => (b.created_at_ms || 0) - (a.created_at_ms || 0)).flatMap((imp) => (imp.pending || []).map((p) => (
                <li key={`${imp.id}-${p.email}`}>{p.name} · {p.email}{p.member_number ? ` · ${p.member_number}` : ''}</li>
              )))}
            </ul>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
