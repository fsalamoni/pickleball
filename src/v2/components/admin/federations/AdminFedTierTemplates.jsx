/**
 * Painel admin → Federações → Configuração → Categorias de torneio: os
 * MODELOS que a federação pode copiar ao criar as suas categorias
 * (`platform_settings/federations.tournament_tier_templates[]`). Escreva
 * `{SIGLA}` na sigla ou no nome para virar a sigla de cada federação
 * ("{SIGLA} 1000" → "FGP 1000"). Copiado, o modelo é da federação: mudar ou
 * tirar um modelo aqui não mexe em federação nenhuma.
 */
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { LayoutTemplate, Plus, Trash2 } from 'lucide-react';
import { useFederationPlatformSettings, useSaveFederationPlatformCatalog } from '@/modules/federations/hooks/useFederations';
import { ACRONYM_TOKEN, TIER_TEMPLATES_MAX, tierTemplatesCatalog, validateTierTemplates } from '@/modules/federations/domain/platformCatalog';
import { newTierId, tierTableFromChampion } from '@/modules/federations/domain/officialRanking';
import { V2Button, V2ErrorState, V2Field, V2Input, V2Skeleton, V2Surface, V2Textarea } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';
import FedTiersEditor from '@/v2/components/federations/manage/FedTiersEditor';

const novoModelo = (ids) => ({
  id: newTierId('modelo', ids),
  name: '',
  description: '',
  tiers: [{ id: 'g1', code: `${ACRONYM_TOKEN} 1000`, group: 'G1', name: '', ...tierTableFromChampion(1000, 16), active: true }],
});

export default function AdminFedTierTemplates() {
  const q = useFederationPlatformSettings();
  const salvar = useSaveFederationPlatformCatalog('tournament_tier_templates');
  const [lista, setLista] = useState(null);
  const [erros, setErros] = useState({});
  useEffect(() => { if (q.isSuccess && lista == null) setLista(q.tierTemplates); }, [q.isSuccess, q.tierTemplates, lista]);

  if (q.isError) return <V2ErrorState title={t('Não carregou a configuração das federações')} onRetry={() => q.refetch()} />;
  if (!lista) return <V2Skeleton lines={6} />;

  const mudar = (i, patch) => { setLista((l) => l.map((x, j) => (j === i ? { ...x, ...patch } : x))); setErros({}); };
  const enviar = (e) => {
    e.preventDefault();
    const r = validateTierTemplates(lista);
    if (!r.ok) { setErros(r.errors); toast.error(r.errors.list || Object.values(r.errors)[0] || t('Confira os campos destacados.')); return; }
    salvar.mutate(r.value, {
      onSuccess: () => { toast.success(t('Modelos de categorias salvos.')); setLista(null); },
      onError: (er) => { setErros(er.fieldErrors || {}); toast.error(er.message); },
    });
  };

  return (
    <form onSubmit={enviar} noValidate className="space-y-4" data-dica="admin-federacoes-modelos">
      <div>
        <h2 className="flex items-center gap-2 font-display text-xl font-bold text-ink"><LayoutTemplate className="h-5 w-5" aria-hidden="true" />{t('Modelos de categorias de torneio')}</h2>
        <p className="text-sm text-gray-500">{t('A federação que ainda não criou as suas categorias vê estes modelos em Competições → Ranking e pode copiar um deles. Escreva {token} na sigla para virar a sigla de cada federação (ex.: "{token} 1000" vira "FGP 1000").', { token: ACRONYM_TOKEN })}</p>
      </div>
      {lista.length === 0 && <p className="rounded-2xl border border-dashed border-gray-200 p-4 text-sm text-gray-500">{t('Nenhum modelo. As federações criam as categorias do zero ou a partir das três padrão.')}</p>}
      <ul className="space-y-4">
        {lista.map((m, i) => (
          <li key={`${i}-${m.id}`}>
            <V2Surface className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <V2Field label={t('Nome do modelo')} htmlFor={`tt-nome-${i}`} error={erros[`name_${i}`] || erros[`id_${i}`]}>
                  <V2Input id={`tt-nome-${i}`} maxLength={80} value={m.name} onChange={(e) => mudar(i, { name: e.target.value })} />
                </V2Field>
                <div className="flex items-end">
                  <V2Button type="button" size="sm" variant="ghost" onClick={() => { setLista((l) => l.filter((_, j) => j !== i)); setErros({}); }}><Trash2 className="h-4 w-4" />{t('Tirar modelo')}</V2Button>
                </div>
              </div>
              <V2Field label={t('Descrição')} htmlFor={`tt-desc-${i}`} hint={t('Para que serve este modelo. A federação lê antes de copiar.')}>
                <V2Textarea id={`tt-desc-${i}`} rows={2} maxLength={300} value={m.description} onChange={(e) => mudar(i, { description: e.target.value })} />
              </V2Field>
              {erros[`tiers_${i}`] && <p role="alert" className="text-sm font-medium text-red-600">{erros[`tiers_${i}`]}</p>}
              <FedTiersEditor modelo explicit tiers={m.tiers} onChange={(tiers) => mudar(i, { tiers })} />
            </V2Surface>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {lista.length < TIER_TEMPLATES_MAX && <V2Button type="button" variant="secondary" size="sm" onClick={() => setLista((l) => [...l, novoModelo(l.map((x) => x.id))])}><Plus className="h-4 w-4" />{t('Novo modelo')}</V2Button>}
          <V2Button type="button" variant="ghost" size="sm" onClick={() => { setLista(tierTemplatesCatalog({})); setErros({}); }}>{t('Voltar aos modelos padrão')}</V2Button>
        </div>
        <div className="flex gap-2">
          <V2Button type="button" variant="ghost" onClick={() => { setLista(q.tierTemplates); setErros({}); }}>{t('Desfazer')}</V2Button>
          <V2Button type="submit" disabled={salvar.isPending}>{t('Salvar modelos')}</V2Button>
        </div>
      </div>
    </form>
  );
}
