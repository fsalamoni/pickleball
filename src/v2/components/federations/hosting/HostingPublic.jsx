/**
 * O que o PÚBLICO vê de SEDES E COPA (aba Competições da página da
 * federação): os editais de sede publicados (evento, prazos, critérios com o
 * peso de cada um e, no fim, o resultado com a nota de cada proposta — sem
 * uid) e, na confederação, a Copa das Federações com os elencos aprovados
 * (nome e categoria). Candidatar-se é no cartão "Federação" do clube ou da
 * arena; inscrever o elenco é na Central da estadual.
 */
import React, { useState } from 'react';
import { ChevronDown, ChevronUp, MapPin, Trophy } from 'lucide-react';
import { fedModuleOn } from '@/modules/federations/domain/federation';
import { isConfederation } from '@/modules/federations/domain/national';
import { CUP_STATUS_LABELS, HOST_BID_STATUS_LABELS, normalizeCupCategories, normalizeHostCriteria } from '@/modules/federations/domain/hosting';
import { useCups, useHostBids } from '@/modules/federations/hooks/useHosting';
import { V2Badge, V2ErrorState, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { t, tn } from '@/core/i18n';
import { TOM_COPA, TOM_EDITAL_SEDE, br, periodo } from './hostingUi';

function Edital({ b }) {
  const [aberto, setAberto] = useState(b.status !== 'result' && b.status !== 'cancelled');
  const criterios = normalizeHostCriteria(b.criteria);
  const peso = criterios.reduce((s, c) => s + c.weight, 0) || 1;
  return (
    <li>
      <V2Surface variant="compacto" className="space-y-2 p-4">
        <button type="button" className="flex w-full flex-wrap items-start justify-between gap-2 text-left" aria-expanded={aberto} onClick={() => setAberto((v) => !v)}>
          <span className="min-w-0">
            <span className="block font-semibold text-ink">{b.title}</span>
            <span className="block text-xs text-gray-500">{[b.event_name, periodo(b.event_start, b.event_end)].filter(Boolean).join(' · ')}</span>
          </span>
          <span className="flex items-center gap-2">
            <V2Badge tone={TOM_EDITAL_SEDE[b.status] || 'neutral'}>{t(HOST_BID_STATUS_LABELS[b.status] || b.status)}</V2Badge>
            {aberto ? <ChevronUp className="h-4 w-4" aria-hidden /> : <ChevronDown className="h-4 w-4" aria-hidden />}
          </span>
        </button>
        {aberto && (
          <div className="space-y-3 text-sm">
            <p className="text-gray-600">{t('Cartas de intenção até {carta} · propostas até {proposta}', { carta: br(b.intent_until), proposta: br(b.proposal_until) })}</p>
            {b.description && <p className="whitespace-pre-line text-gray-700">{b.description}</p>}
            {b.requirements && (
              <div><p className="font-semibold text-ink">{t('O que a sede precisa ter')}</p><p className="whitespace-pre-line text-gray-700">{b.requirements}</p></div>
            )}
            <div>
              <p className="font-semibold text-ink">{t('Como as propostas são avaliadas')}</p>
              <ul className="mt-1 space-y-1">
                {criterios.map((c) => (
                  <li key={c.id} className="flex items-baseline justify-between gap-3 text-gray-700">
                    <span>{c.label}{c.description && <span className="block text-xs text-gray-500">{c.description}</span>}</span>
                    <span className="shrink-0 text-xs font-semibold text-gray-600">{t('{n}% da nota', { n: Math.round((c.weight / peso) * 100) })}</span>
                  </li>
                ))}
              </ul>
            </div>
            {b.counts && b.status !== 'result' && <p className="text-xs text-gray-500">{tn(b.counts.intents || 0, '{n} candidatura recebida', '{n} candidaturas recebidas')}</p>}
            {b.status === 'cancelled' && b.cancel_reason && <p className="text-gray-600">{t('Cancelado: {motivo}', { motivo: b.cancel_reason })}</p>}
            {b.result && (
              <div className="space-y-1 rounded-xl bg-gray-50 p-3">
                <p className="flex items-center gap-2 font-semibold text-ink"><MapPin className="h-4 w-4" aria-hidden />{t('Sede escolhida: {org}', { org: [b.result.winner_name, b.result.winner_city].filter(Boolean).join(' · ') })}</p>
                {b.result.note && <p className="text-xs text-gray-600">{t('Justificativa: {texto}', { texto: b.result.note })}</p>}
                <ol className="space-y-0.5 text-xs text-gray-700">
                  {(b.result.ranking || []).map((r, i) => (
                    <li key={`${r.org_name}-${i}`} className="flex justify-between gap-2">
                      <span>{i + 1}. {r.org_name}{r.org_city ? ` · ${[r.org_city, r.org_state].filter(Boolean).join('/')}` : ''}{r.winner ? ` · ${t('escolhida')}` : ''}</span>
                      <span className="font-semibold">{t('nota {n}', { n: Number(r.total || 0).toFixed(2) })}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {b.status === 'intent' && <p className="text-xs text-gray-500">{t('Clube ou arena filiado se candidata no cartão "Federação", na gestão do clube ou da arena.')}</p>}
          </div>
        )}
      </V2Surface>
    </li>
  );
}

export function HostBidsPublic({ federation }) {
  const on = fedModuleOn(federation, 'host_bids');
  const q = useHostBids(federation?.id, { enabled: on });
  if (!on) return null;
  return (
    <section id="fed-sedes" aria-labelledby="fed-sedes-titulo" className="scroll-mt-4 space-y-3" data-dica="federacao-pub-sedes">
      <h2 id="fed-sedes-titulo" className="flex items-center gap-2 font-display text-xl font-bold text-ink"><MapPin className="h-5 w-5" aria-hidden />{t('Editais de sede')}</h2>
      {q.isError && <V2ErrorState inline title={t('Não carregaram os editais de sede')} onRetry={() => q.refetch()} />}
      {q.isLoading && <V2Skeleton lines={3} />}
      {q.isSuccess && (q.data.length === 0
        ? <p className="text-sm text-gray-500">{t('Nenhum edital de sede publicado ainda.')}</p>
        : <ul className="space-y-2">{q.data.map((b) => <Edital key={b.id} b={b} />)}</ul>)}
    </section>
  );
}

function Copa({ k }) {
  const [aberta, setAberta] = useState(k.status !== 'cancelled');
  const cats = normalizeCupCategories(k.categories);
  const nomeCat = (id) => cats.find((c) => c.id === id)?.label || '';
  return (
    <li>
      <V2Surface variant="compacto" className="space-y-2 p-4">
        <button type="button" className="flex w-full flex-wrap items-start justify-between gap-2 text-left" aria-expanded={aberta} onClick={() => setAberta((v) => !v)}>
          <span className="min-w-0">
            <span className="block font-semibold text-ink">{k.title}</span>
            <span className="block text-xs text-gray-500">{[periodo(k.starts_at, k.ends_at), k.location].filter(Boolean).join(' · ')}</span>
          </span>
          <span className="flex items-center gap-2">
            <V2Badge tone={TOM_COPA[k.status] || 'neutral'}>{t(CUP_STATUS_LABELS[k.status] || k.status)}</V2Badge>
            {aberta ? <ChevronUp className="h-4 w-4" aria-hidden /> : <ChevronDown className="h-4 w-4" aria-hidden />}
          </span>
        </button>
        {aberta && (
          <div className="space-y-3 text-sm">
            {k.status === 'open' && <p className="text-gray-600">{t('As federações inscrevem o elenco até {data}.', { data: br(k.entries_until) })}</p>}
            {k.description && <p className="whitespace-pre-line text-gray-700">{k.description}</p>}
            <p className="text-xs text-gray-500">{t('Categorias: {lista}', { lista: cats.map((c) => t('{cat} (até {n})', { cat: c.label, n: c.roster_max })).join(' · ') })}</p>
            {k.status === 'cancelled' && k.cancel_reason && <p className="text-gray-600">{t('Cancelada: {motivo}', { motivo: k.cancel_reason })}</p>}
            {(k.teams_public || []).length === 0
              ? <p className="text-gray-500">{t('Nenhum elenco aprovado ainda.')}</p>
              : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {k.teams_public.map((tm) => (
                    <li key={tm.acronym || tm.federation_name} className="rounded-xl border border-gray-100 p-3">
                      <p className="font-semibold text-ink">{tm.acronym ? `${tm.acronym} · ${tm.federation_name}` : tm.federation_name}</p>
                      <ul className="mt-1 space-y-0.5 text-xs text-gray-700">
                        {tm.athletes.map((a, i) => <li key={`${a.key}-${a.category_id}-${i}`}>{a.name} <span className="text-gray-500">· {nomeCat(a.category_id)}</span></li>)}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
          </div>
        )}
      </V2Surface>
    </li>
  );
}

export function CupPublic({ federation }) {
  const on = isConfederation(federation) && fedModuleOn(federation, 'federation_cup');
  const q = useCups(federation?.id, { enabled: on });
  if (!on) return null;
  return (
    <section id="fed-copa" aria-labelledby="fed-copa-titulo" className="scroll-mt-4 space-y-3" data-dica="federacao-pub-copa">
      <h2 id="fed-copa-titulo" className="flex items-center gap-2 font-display text-xl font-bold text-ink"><Trophy className="h-5 w-5" aria-hidden />{t('Copa das Federações')}</h2>
      {q.isError && <V2ErrorState inline title={t('Não carregou a Copa das Federações')} onRetry={() => q.refetch()} />}
      {q.isLoading && <V2Skeleton lines={3} />}
      {q.isSuccess && (q.data.length === 0
        ? <p className="text-sm text-gray-500">{t('Nenhuma Copa aberta ainda.')}</p>
        : <ul className="space-y-2">{q.data.map((k) => <Copa key={k.id} k={k} />)}</ul>)}
    </section>
  );
}
