/**
 * Painel admin → Federações → Configuração: o CATÁLOGO de tipos de filiação
 * (`platform_settings/federations.member_types[]`). Os cinco prontos (atleta,
 * professor, árbitro, clube, arena) podem ser renomeados, descritos e
 * desligados, nunca apagados; o admin cria outros (dirigente, técnico,
 * escola…) dizendo QUEM se filia (pessoa, clube ou arena) e em que GRUPO a
 * pessoa conta (colégio eleitoral e indicadores). O código do tipo é gravado
 * no plano e na filiação: só se escolhe ao criar.
 *
 * Desligar um tipo tira a opção de criar plano novo para ele; os planos e as
 * filiações que já existem continuam valendo.
 */
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus, Tags } from 'lucide-react';
import { useFederationPlatformSettings, useSaveFederationMemberTypes } from '@/modules/federations/hooks/useFederations';
import {
  MEMBER_CATEGORY_LABELS, MEMBER_ENTITY_LABELS, MEMBER_TYPES_MAX, PERSON_CATEGORIES, memberTypeName, suggestMemberTypeId, validateMemberTypes,
} from '@/modules/federations/domain/memberTypes';
import { V2Badge, V2Button, V2ErrorState, V2Field, V2Input, V2Select, V2Skeleton, V2Surface, V2Toggle } from '@/v2/ui/primitives';
import { V2SubTabs } from '@/v2/ui/V2SectionNav';
import { t, tk } from '@/core/i18n';
import AdminFedDocKinds from './AdminFedDocKinds';
import AdminFedTierTemplates from './AdminFedTierTemplates';
import AdminFedDefaultModules from './AdminFedDefaultModules';

/** O rascunho editável: o nome aparece por extenso (o pronto, traduzido) e volta ao padrão se ficar igual. */
const paraRascunho = (catalog) => catalog.map((x) => ({ ...x, label: memberTypeName(x), novo: false }));

function Tipo({ tipo, i, erros, onChange }) {
  const set = (patch) => onChange({ ...tipo, ...patch });
  const pessoa = tipo.entity === 'person';
  return (
    <V2Surface variant="compacto" className="space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-bold text-ink">{tipo.label || t('Novo tipo')}</p>
        <V2Badge tone="neutral">{t(MEMBER_ENTITY_LABELS[tipo.entity])}</V2Badge>
        {pessoa && <V2Badge tone="blue">{t(MEMBER_CATEGORY_LABELS[tipo.category])}</V2Badge>}
        {tipo.builtin && <V2Badge tone="neutral">{t('Pronto')}</V2Badge>}
        <span className="ml-auto font-mono text-xs text-gray-500">{tipo.id}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <V2Field label={t('Nome')} htmlFor={`mt-nome-${i}`} error={erros[`label_${i}`]} required={!tipo.builtin}>
          <V2Input
            id={`mt-nome-${i}`}
            maxLength={40}
            value={tipo.label}
            onChange={(e) => set(tipo.novo ? { label: e.target.value, id: tipo.id_manual ? tipo.id : suggestMemberTypeId(e.target.value, tipo.outros) } : { label: e.target.value })}
          />
        </V2Field>
        <V2Field label={t('Descrição')} htmlFor={`mt-desc-${i}`} hint={t('Aparece para a federação ao criar o plano.')}>
          <V2Input id={`mt-desc-${i}`} maxLength={200} value={tipo.description} onChange={(e) => set({ description: e.target.value })} />
        </V2Field>
      </div>
      {tipo.novo && (
        <div className="grid gap-3 sm:grid-cols-3">
          <V2Field label={t('Quem se filia')} htmlFor={`mt-ent-${i}`}>
            <V2Select id={`mt-ent-${i}`} value={tipo.entity} onChange={(e) => set({ entity: e.target.value, category: e.target.value === 'person' ? 'athlete' : e.target.value })}>
              {Object.keys(MEMBER_ENTITY_LABELS).map((k) => <option key={k} value={k}>{t(MEMBER_ENTITY_LABELS[k])}</option>)}
            </V2Select>
          </V2Field>
          {pessoa && (
            <V2Field label={t('Conta no grupo')} htmlFor={`mt-cat-${i}`} hint={t('Colégio eleitoral e indicadores.')}>
              <V2Select id={`mt-cat-${i}`} value={tipo.category} onChange={(e) => set({ category: e.target.value })}>
                {PERSON_CATEGORIES.map((k) => <option key={k} value={k}>{t(MEMBER_CATEGORY_LABELS[k])}</option>)}
              </V2Select>
            </V2Field>
          )}
          <V2Field label={t('Código')} htmlFor={`mt-id-${i}`} error={erros[`id_${i}`]} hint={t('Gravado nos planos: não muda depois.')}>
            <V2Input id={`mt-id-${i}`} maxLength={24} className="font-mono" value={tipo.id} onChange={(e) => set({ id: e.target.value.toLowerCase(), id_manual: true })} />
          </V2Field>
        </div>
      )}
      <V2Toggle
        id={`mt-on-${i}`}
        checked={tipo.active !== false}
        onChange={(v) => set({ active: v })}
        label={t('Disponível para novos planos')}
        hint={t('Desligado, as federações não criam plano novo deste tipo; os planos e as filiações que já existem continuam.')}
      />
    </V2Surface>
  );
}

function TiposForm() {
  const q = useFederationPlatformSettings();
  const salvar = useSaveFederationMemberTypes();
  const [lista, setLista] = useState(null);
  const [erros, setErros] = useState({});
  useEffect(() => { if (q.isSuccess && lista == null) setLista(paraRascunho(q.catalog)); }, [q.isSuccess, q.catalog, lista]);

  if (q.isError) return <V2ErrorState title={t('Não carregou a configuração das federações')} onRetry={() => q.refetch()} />;
  if (!lista) return <V2Skeleton lines={6} />;

  const mudar = (i, x) => { setLista((l) => l.map((y, j) => (j === i ? x : y))); setErros({}); };
  const novo = () => {
    const ids = lista.map((x) => x.id);
    setLista((l) => [...l, { id: suggestMemberTypeId(t('Novo tipo'), ids), label: '', description: '', entity: 'person', category: 'athlete', active: true, builtin: false, novo: true, outros: ids }]);
  };
  const enviar = (e) => {
    e.preventDefault();
    const r = validateMemberTypes(lista);
    if (!r.ok) { setErros(r.errors); toast.error(r.errors.list || t('Confira os campos destacados.')); return; }
    salvar.mutate(lista, {
      onSuccess: () => { toast.success(t('Tipos de filiação salvos.')); setLista(null); },
      onError: (er) => { setErros(er.fieldErrors || {}); toast.error(er.message); },
    });
  };

  return (
    <form onSubmit={enviar} noValidate className="space-y-4" data-dica="admin-federacoes-tipos">
      <div>
        <h2 className="flex items-center gap-2 font-display text-xl font-bold text-ink"><Tags className="h-5 w-5" aria-hidden="true" />{t('Tipos de filiação')}</h2>
        <p className="text-sm text-gray-500">{t('Os tipos que as federações escolhem ao criar um plano. Pessoa se filia pela página da federação; clube e arena, pela gestão do clube ou pela Central da arena.')}</p>
      </div>
      <ul className="space-y-3">
        {lista.map((x, i) => <li key={`${i}-${x.builtin ? x.id : 'novo'}`}><Tipo tipo={x} i={i} erros={erros} onChange={(y) => mudar(i, y)} /></li>)}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {lista.length < MEMBER_TYPES_MAX
          ? <V2Button type="button" variant="secondary" size="sm" onClick={novo}><Plus className="h-4 w-4" />{t('Novo tipo')}</V2Button>
          : <p className="text-sm text-gray-500">{t('No máximo {n} tipos.', { n: MEMBER_TYPES_MAX })}</p>}
        <div className="flex gap-2">
          <V2Button type="button" variant="ghost" onClick={() => { setLista(paraRascunho(q.catalog)); setErros({}); }}>{t('Desfazer')}</V2Button>
          <V2Button type="submit" disabled={salvar.isPending}>{t('Salvar tipos')}</V2Button>
        </div>
      </div>
    </form>
  );
}

/**
 * A configuração geral das federações, em quatro partes: tipos de filiação,
 * documentos sugeridos, modelos de categorias de torneio e módulos que nascem
 * ligados. Cada parte salva só a sua chave. A parte aberta fica na URL
 * (`?parte=`), para o link levar direto a ela.
 */
const PARTES = [
  { value: 'tipos', label: tk('Tipos de filiação'), dica: 'admin-federacoes-parte-tipos', Comp: TiposForm },
  { value: 'documentos', label: tk('Documentos sugeridos'), dica: 'admin-federacoes-parte-documentos', Comp: AdminFedDocKinds },
  { value: 'categorias', label: tk('Categorias de torneio'), dica: 'admin-federacoes-parte-categorias', Comp: AdminFedTierTemplates },
  { value: 'modulos', label: tk('Módulos iniciais'), dica: 'admin-federacoes-parte-modulos', Comp: AdminFedDefaultModules },
];

export default function AdminFederationsConfig() {
  const [params, setParams] = useSearchParams();
  const atual = PARTES.find((p) => p.value === params.get('parte')) || PARTES[0];
  const ir = (p) => setParams((x) => { const n = new URLSearchParams(x); n.set('parte', p.value); return n; }, { replace: true });
  const { Comp } = atual;
  return (
    <div className="space-y-4">
      <V2SubTabs tabs={PARTES.map((p) => ({ value: p.value, label: t(p.label), dica: p.dica }))} activeValue={atual.value} onSelect={ir} ariaLabel={t('Partes da configuração das federações')} />
      <Comp />
    </div>
  );
}
