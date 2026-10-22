/**
 * Painel admin → Federações → Configuração → Documentos: os documentos que a
 * plataforma SUGERE aos planos (`platform_settings/federations.doc_kinds[]`).
 * No plano, cada sugestão é um atalho que copia o nome para os documentos
 * próprios — mudar ou tirar uma sugestão aqui não mexe em plano nenhum. Os
 * quatro documentos de sempre (identidade, atestado, residência, autorização
 * do responsável) seguem fixos no plano e não entram nesta lista.
 */
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { FileText, Plus, Trash2 } from 'lucide-react';
import { useFederationPlatformSettings, useSaveFederationPlatformCatalog } from '@/modules/federations/hooks/useFederations';
import { DEFAULT_DOC_KINDS, DOC_KINDS_MAX, DOC_SCOPE_LABELS, suggestDocKindId, validateDocKinds } from '@/modules/federations/domain/platformCatalog';
import { V2Button, V2ErrorState, V2Field, V2Input, V2Select, V2Skeleton, V2Surface, V2Toggle } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';

export default function AdminFedDocKinds() {
  const q = useFederationPlatformSettings();
  const salvar = useSaveFederationPlatformCatalog('doc_kinds');
  const [lista, setLista] = useState(null);
  const [erros, setErros] = useState({});
  useEffect(() => { if (q.isSuccess && lista == null) setLista(q.docKinds); }, [q.isSuccess, q.docKinds, lista]);

  if (q.isError) return <V2ErrorState title={t('Não carregou a configuração das federações')} onRetry={() => q.refetch()} />;
  if (!lista) return <V2Skeleton lines={6} />;

  const mudar = (i, patch) => { setLista((l) => l.map((x, j) => (j === i ? { ...x, ...patch } : x))); setErros({}); };
  const novo = () => setLista((l) => [...l, { id: suggestDocKindId(t('Documento'), l.map((x) => x.id)), label: '', scope: 'person', active: true, novo: true }]);
  const enviar = (e) => {
    e.preventDefault();
    const r = validateDocKinds(lista);
    if (!r.ok) { setErros(r.errors); toast.error(r.errors.list || t('Confira os campos destacados.')); return; }
    salvar.mutate(r.value, {
      onSuccess: () => { toast.success(t('Documentos sugeridos salvos.')); setLista(null); },
      onError: (er) => { setErros(er.fieldErrors || {}); toast.error(er.message); },
    });
  };

  return (
    <form onSubmit={enviar} noValidate className="space-y-4" data-dica="admin-federacoes-documentos">
      <div>
        <h2 className="flex items-center gap-2 font-display text-xl font-bold text-ink"><FileText className="h-5 w-5" aria-hidden="true" />{t('Documentos sugeridos')}</h2>
        <p className="text-sm text-gray-500">{t('Atalhos que a federação vê ao montar os documentos exigidos de um plano. Ela pode usar, mudar o nome ou pedir outro documento qualquer. Identidade, atestado médico, comprovante de residência e autorização do responsável já são fixos no plano.')}</p>
      </div>
      {lista.length === 0 && <p className="rounded-2xl border border-dashed border-gray-200 p-4 text-sm text-gray-500">{t('Nenhuma sugestão. As federações continuam podendo pedir qualquer documento pelo nome.')}</p>}
      <ul className="space-y-2">
        {lista.map((d, i) => (
          <li key={d.novo ? `novo-${i}` : d.id}>
            <V2Surface variant="compacto" className="grid items-end gap-3 p-3 sm:grid-cols-[1fr_12rem_auto_auto]">
              <V2Field label={t('Nome do documento')} htmlFor={`dk-nome-${i}`} error={erros[`label_${i}`] || erros[`id_${i}`]}>
                <V2Input
                  id={`dk-nome-${i}`}
                  maxLength={80}
                  value={d.label}
                  onChange={(e) => mudar(i, d.novo ? { label: e.target.value, id: suggestDocKindId(e.target.value, lista.filter((_, j) => j !== i).map((x) => x.id)) } : { label: e.target.value })}
                />
              </V2Field>
              <V2Field label={t('Para')} htmlFor={`dk-para-${i}`}>
                <V2Select id={`dk-para-${i}`} value={d.scope} onChange={(e) => mudar(i, { scope: e.target.value })}>
                  {Object.keys(DOC_SCOPE_LABELS).map((k) => <option key={k} value={k}>{t(DOC_SCOPE_LABELS[k])}</option>)}
                </V2Select>
              </V2Field>
              <V2Toggle id={`dk-on-${i}`} checked={d.active} onChange={(v) => mudar(i, { active: v })} label={t('Sugerir')} />
              <V2Button type="button" size="sm" variant="ghost" aria-label={t('Tirar {nome}', { nome: d.label || t('documento {n}', { n: i + 1 }) })} onClick={() => { setLista((l) => l.filter((_, j) => j !== i)); setErros({}); }}>
                <Trash2 className="h-4 w-4" />
              </V2Button>
            </V2Surface>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {lista.length < DOC_KINDS_MAX && <V2Button type="button" variant="secondary" size="sm" onClick={novo}><Plus className="h-4 w-4" />{t('Novo documento')}</V2Button>}
          <V2Button type="button" variant="ghost" size="sm" onClick={() => { setLista(DEFAULT_DOC_KINDS.map((d) => ({ ...d, label: t(d.label), active: true }))); setErros({}); }}>{t('Voltar às sugestões padrão')}</V2Button>
        </div>
        <div className="flex gap-2">
          <V2Button type="button" variant="ghost" onClick={() => { setLista(q.docKinds); setErros({}); }}>{t('Desfazer')}</V2Button>
          <V2Button type="submit" disabled={salvar.isPending}>{t('Salvar documentos')}</V2Button>
        </div>
      </div>
    </form>
  );
}
