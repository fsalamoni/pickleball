/**
 * JOGO LIMPO na página pública da federação (aba "Jogo limpo", também sem
 * conta): a lista de equipamentos homologados com busca — a da federação e,
 * na estadual filiada, a da confederação — e o bloco de antidopagem com o
 * texto, os links da ABCD e as cláusulas dos torneios chancelados.
 */
import React, { useMemo, useState } from 'react';
import { ExternalLink, ShieldCheck, Wrench } from 'lucide-react';
import { useEquipment } from '@/modules/federations/hooks/useIntegrity';
import { useFederation } from '@/modules/federations/hooks/useFederations';
import { fedModuleOn } from '@/modules/federations/domain/federation';
import { nationalBodyOf } from '@/modules/federations/domain/national';
import {
  EQUIPMENT_KINDS, EQUIPMENT_KIND_LABELS, EQUIPMENT_STATUS, EQUIPMENT_STATUS_LABELS, antidopingView, equipmentCounts, equipmentList, searchEquipment,
} from '@/modules/federations/domain/integrity';
import { V2Badge, V2ErrorState, V2Input, V2Select, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';

const br = (iso) => (iso ? String(iso).split('-').reverse().join('/') : '');
const TOM = { approved: 'green', rejected: 'red', decertified: 'amber' };

/** Uma linha da lista (página pública e Central). */
export function EquipmentRow({ item, network = '', children }) {
  return (
    <V2Surface variant="compacto" className="flex flex-wrap items-start justify-between gap-2 p-3">
      <div className="min-w-0 space-y-0.5">
        <p className="font-semibold text-ink">{item.brand} {item.model}</p>
        <p className="text-xs text-gray-500">
          {t(EQUIPMENT_KIND_LABELS[item.kind] || EQUIPMENT_KIND_LABELS.other)}
          {item.reference ? ` · ${item.reference}` : ''}
          {item.source ? ` · ${t('ensaio: {fonte}', { fonte: item.source })}` : ''}
          {network ? ` · ${t('lista da {conf}', { conf: network })}` : ''}
        </p>
        {item.status_reason && <p className="text-xs text-gray-600">{item.status_reason}</p>}
      </div>
      <div className="flex flex-col items-end gap-1">
        <V2Badge tone={TOM[item.status] || 'neutral'}>{t(EQUIPMENT_STATUS_LABELS[item.status] || item.status)}</V2Badge>
        {item.status_at && <span className="text-xs text-gray-500">{t('desde {data}', { data: br(item.status_at) })}</span>}
        {children}
      </div>
    </V2Surface>
  );
}

/** Busca, tipo e situação, com a contagem. */
export function EquipmentFilters({ value, onChange, counts, idPrefix }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-[1fr_10rem_11rem]">
        <V2Input id={`${idPrefix}-busca`} aria-label={t('Buscar por marca, modelo ou referência')} placeholder={t('Buscar por marca, modelo ou referência')} value={value.query} onChange={set('query')} />
        <V2Select id={`${idPrefix}-tipo`} aria-label={t('Tipo')} value={value.kind} onChange={set('kind')} options={[{ value: '', label: t('Todos os tipos') }, ...EQUIPMENT_KINDS.map((k) => ({ value: k, label: t(EQUIPMENT_KIND_LABELS[k]) }))]} />
        <V2Select id={`${idPrefix}-situacao`} aria-label={t('Situação')} value={value.status} onChange={set('status')} options={[{ value: '', label: t('Todas as situações') }, ...Object.values(EQUIPMENT_STATUS).map((s) => ({ value: s, label: t(EQUIPMENT_STATUS_LABELS[s]) }))]} />
      </div>
      {counts && <p className="text-xs text-gray-500">{t('{a} homologados · {d} descertificados · {r} reprovados', { a: counts.approved, d: counts.decertified, r: counts.rejected })}</p>}
    </div>
  );
}

export function FedEquipmentBlock({ federation }) {
  const ligado = fedModuleOn(federation, 'equipment');
  const nb = nationalBodyOf(federation);
  const proprio = useEquipment(federation?.id, { enabled: ligado });
  const confQ = useFederation(nb?.id, { enabled: Boolean(nb) });
  const confLigada = fedModuleOn(confQ.data, 'equipment');
  const rede = useEquipment(nb?.id, { enabled: confLigada });
  const [filtro, setFiltro] = useState({ query: '', kind: '', status: '' });
  const todos = useMemo(() => equipmentList(ligado ? proprio.data : [], confLigada ? rede.data : []), [ligado, proprio.data, confLigada, rede.data]);
  const achados = useMemo(() => searchEquipment(todos, filtro), [todos, filtro]);
  if (!ligado && !confLigada) return null;
  const carregando = (ligado && proprio.isLoading) || (confLigada && rede.isLoading);
  const sigla = confQ.data?.acronym || nb?.acronym || '';
  return (
    <section id="fed-equipamentos" aria-labelledby="fed-equipamentos-titulo" className="scroll-mt-4 space-y-3" data-dica="federacao-pub-equipamentos">
      <h2 id="fed-equipamentos-titulo" className="flex items-center gap-2 font-display text-xl font-bold text-ink"><Wrench className="h-5 w-5" />{t('Equipamentos homologados')}</h2>
      <p className="text-sm text-gray-600">{t('Raquetes, bolas e redes que valem nos torneios chancelados. Descertificado deixou de valer na data indicada.')}</p>
      {ligado && proprio.isError && <V2ErrorState inline title={t('Não carregou a lista da federação')} onRetry={() => proprio.refetch()} />}
      {confLigada && rede.isError && <V2ErrorState inline title={t('Não carregou a lista da confederação')} onRetry={() => rede.refetch()} />}
      {carregando ? <V2Skeleton lines={4} /> : (
        <>
          <EquipmentFilters value={filtro} onChange={setFiltro} counts={equipmentCounts(todos)} idPrefix="fed-equip" />
          {todos.length === 0 && !proprio.isError && !rede.isError && <p className="text-sm text-gray-500">{t('A lista ainda não tem nenhum equipamento.')}</p>}
          {todos.length > 0 && achados.length === 0 && <p className="text-sm text-gray-500">{t('Nada encontrado com essa busca.')}</p>}
          <ul className="grid gap-2 lg:grid-cols-2">
            {achados.map((x) => <li key={`${x.origin}${x.id}`}><EquipmentRow item={x} network={x.origin === 'network' ? sigla : ''} /></li>)}
          </ul>
        </>
      )}
    </section>
  );
}

/** As cláusulas e os links — também no torneio chancelado. */
export function AntidopingClauses({ view }) {
  if (!view.clauses.length) return null;
  return (
    <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-700">
      {view.clauses.map((c) => <li key={c}>{c}</li>)}
    </ol>
  );
}

export function AntidopingLinks({ view }) {
  return (
    <ul className="space-y-1 text-sm">
      {view.links.map((l) => (
        <li key={l.url}><a href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-ink underline-offset-2 hover:underline">{l.label}<ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /></a></li>
      ))}
    </ul>
  );
}

/** A aba "Jogo limpo" da página (carregada sob demanda). */
export default function FedIntegrityTab({ federation }) {
  return (
    <div className="space-y-8">
      <FedEquipmentBlock federation={federation} />
      <FedAntidopingBlock federation={federation} />
    </div>
  );
}

export function FedAntidopingBlock({ federation }) {
  if (!fedModuleOn(federation, 'antidoping')) return null;
  const v = antidopingView(federation);
  return (
    <section id="fed-antidopagem" aria-labelledby="fed-antidopagem-titulo" className="scroll-mt-4 space-y-3" data-dica="federacao-pub-antidopagem">
      <h2 id="fed-antidopagem-titulo" className="flex items-center gap-2 font-display text-xl font-bold text-ink"><ShieldCheck className="h-5 w-5" />{t('Antidopagem')}</h2>
      <p className="whitespace-pre-line text-sm text-gray-700">{v.text}</p>
      {v.contact && <p className="text-sm text-gray-700"><strong>{t('Fale com a federação')}:</strong> {v.contact}</p>}
      <AntidopingLinks view={v} />
      {v.clauses.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">{t('No regulamento dos torneios chancelados')}</h3>
          <AntidopingClauses view={v} />
        </div>
      )}
    </section>
  );
}
