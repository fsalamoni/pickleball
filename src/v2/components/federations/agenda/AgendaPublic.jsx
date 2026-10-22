/**
 * O CALENDÁRIO OFICIAL para quem lê (módulo `calendar`):
 *  - `FedAgendaBlock`: os próximos eventos na página da federação (app e
 *    `/f/:slug`) e o caminho para a agenda inteira;
 *  - `AgendaBrowser`: a página `/f/:slug/agenda` — próximos e anteriores,
 *    por mês, com busca e filtro de agenda (esportiva, institucional,
 *    eventos), seguir, assinar no celular e compartilhar.
 * Cada pessoa vê o que a regra deixa (`useVisibleAgenda`). O cancelado e o
 * adiado continuam na lista, com a faixa: some quem ia, não a informação.
 */
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, CalendarDays, CalendarPlus, Copy, History, Search, Share2 } from 'lucide-react';
import { useClipboard } from '@/core/lib/useClipboard';
import { useVisibleAgenda } from '@/modules/federations/hooks/useFederations';
import { EVENT_GROUPS, agendaFeedPath, agendaPublicPath, filterAgenda, groupByMonth, splitAgenda } from '@/modules/federations/domain/agenda';
import { V2Button, V2ErrorState, V2Input, V2Select, V2Skeleton } from '@/v2/ui/primitives';
import { V2SubTabs } from '@/v2/ui/V2SectionNav';
import { t, tn } from '@/core/i18n';
import { publicHost } from '../federationUi';
import { AcervoFollowButton } from '../acervo/AcervoPublic';
import { MostrarMais, POR_VEZ } from '../manage/listTools';
import { AgendaEventItem, baixarIcs, mesAno } from './agendaUi';

/* ------------------------------------------------- bloco na página -- */

/** Os próximos eventos na página da federação. Vitrine: sem nada marcado, o bloco diz isso e segue. */
export function FedAgendaBlock({ federation, limite = 4 }) {
  const a = useVisibleAgenda(federation);
  const proximos = useMemo(() => (a.items ? splitAgenda(a.items).upcoming.slice(0, limite) : []), [a.items, limite]);
  if (!a.ligado) return null;
  return (
    <section id="federacao-agenda" aria-labelledby="fed-agenda" className="scroll-mt-4 space-y-3" data-dica="federacao-agenda-publica">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="fed-agenda" className="font-display text-xl font-bold text-ink">{t('Calendário oficial')}</h2>
        <V2Button asChild variant="ghost" size="sm"><Link to={agendaPublicPath(federation)}><CalendarDays className="h-4 w-4" />{t('Abrir a agenda')}</Link></V2Button>
      </div>
      {a.isError && <V2ErrorState inline title={t('Não carregou a agenda')} onRetry={a.refetch} />}
      {a.isLoading && <V2Skeleton lines={3} />}
      {a.items && proximos.length === 0 && <p className="text-sm text-gray-500">{t('Sem eventos marcados daqui para a frente.')}</p>}
      {proximos.length > 0 && <ul className="space-y-2">{proximos.map((ev) => <AgendaEventItem key={ev.id} federation={federation} ev={ev} />)}</ul>}
      {a.incompleto && <p className="text-xs text-amber-700">{t('Parte da agenda (só para filiados, só para a equipe ou os torneios) não carregou agora.')}</p>}
    </section>
  );
}

/* -------------------------------------------------------- assinar -- */

/** Levar a agenda pública ao celular: assinar (atualiza sozinha), Google Agenda, copiar o endereço ou baixar o arquivo. */
export function AgendaSubscribe({ federation, items }) {
  const { copy } = useClipboard();
  const [aberto, setAberto] = useState(false);
  const https = `https://${publicHost()}${agendaFeedPath(federation)}`;
  const webcal = `webcal://${publicHost()}${agendaFeedPath(federation)}`;
  const publicos = (items || []).filter((ev) => !ev.visibility || ev.visibility === 'public');
  return (
    <div className="space-y-2">
      <V2Button type="button" variant="secondary" size="sm" aria-expanded={aberto} onClick={() => setAberto((x) => !x)} data-dica="federacao-agenda-assinar"><CalendarPlus className="h-4 w-4" />{t('Assinar a agenda')}</V2Button>
      {aberto && (
        <div className="space-y-3 rounded-2xl border border-gray-100 bg-paper-pure p-4 text-sm">
          <p className="text-gray-700">{t('Assinando, os eventos públicos aparecem no calendário do seu celular e se atualizam sozinhos quando a federação marca, remarca ou cancela.')}</p>
          <div className="flex flex-wrap gap-2">
            <V2Button asChild size="sm"><a href={webcal}><CalendarPlus className="h-4 w-4" />{t('Assinar no celular')}</a></V2Button>
            <V2Button asChild size="sm" variant="secondary"><a href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`} target="_blank" rel="noopener noreferrer">{t('Google Agenda')}</a></V2Button>
            <V2Button type="button" size="sm" variant="ghost" onClick={() => copy(https, t('Endereço da agenda copiado.'))}><Copy className="h-4 w-4" />{t('Copiar o endereço')}</V2Button>
            {publicos.length > 0 && <V2Button type="button" size="sm" variant="ghost" onClick={() => baixarIcs(federation, publicos, `agenda-${federation.slug || federation.id}`)}>{t('Baixar o arquivo (.ics)')}</V2Button>}
          </div>
          <p className="text-xs text-gray-500">{t('O que é só para filiados ou para a equipe não entra na agenda assinada: abra cada evento aqui e use "Adicionar ao calendário".')}</p>
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------- página da agenda -- */

const ABAS = ['proximos', 'anteriores'];
const FILTRO_VAZIO = { q: '', group: '' };

export function AgendaBrowser({ federation }) {
  const a = useVisibleAgenda(federation);
  const { copy } = useClipboard();
  const [aba, setAba] = useState(() => {
    const pedida = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('aba') : '';
    return ABAS.includes(pedida) ? pedida : 'proximos';
  });
  const [filtro, setFiltroCru] = useState(FILTRO_VAZIO);
  const [quantos, setQuantos] = useState(POR_VEZ);
  // Mudou o filtro ou a aba, a lista volta aos primeiros.
  const setFiltro = (fn) => { setFiltroCru(fn); setQuantos(POR_VEZ); };
  const algumFiltro = Boolean(filtro.q || filtro.group);
  const partes = useMemo(() => splitAgenda(a.items || []), [a.items]);
  const lista = useMemo(() => filterAgenda(aba === 'proximos' ? partes.upcoming : partes.past, filtro), [aba, partes, filtro]);
  const meses = useMemo(() => groupByMonth(lista.slice(0, quantos)), [lista, quantos]);
  const link = typeof window !== 'undefined' ? `${window.location.origin}${agendaPublicPath(federation)}` : agendaPublicPath(federation);
  const compartilhar = async () => {
    if (navigator.share) { try { await navigator.share({ title: t('Calendário oficial — {federacao}', { federacao: federation.name }), url: link }); return; } catch (e) { if (e?.name === 'AbortError') return; } }
    copy(link, t('Link da agenda copiado.'));
  };
  const trocar = (x) => {
    setAba(x.value);
    setQuantos(POR_VEZ);
    try { const u = new URL(window.location.href); u.searchParams.set('aba', x.value); window.history.replaceState(null, '', u); } catch { /* sem URL: só a tela muda */ }
  };
  if (!a.ligado) return <p className="text-sm text-gray-500">{t('Esta federação não tem o calendário oficial ligado.')}</p>;
  const vazioTotal = a.items && (aba === 'proximos' ? partes.upcoming : partes.past).length === 0;
  return (
    <div className="space-y-4" data-dica="federacao-agenda-pagina">
      <div className="flex flex-wrap items-start gap-2">
        <AcervoFollowButton federation={federation} next={agendaPublicPath(federation)} />
        <V2Button type="button" variant="ghost" size="sm" onClick={compartilhar}><Share2 className="h-4 w-4" />{t('Compartilhar a agenda')}</V2Button>
        <AgendaSubscribe federation={federation} items={a.items} />
      </div>
      <V2SubTabs
        ariaLabel={t('Partes da agenda')}
        activeValue={aba}
        onSelect={trocar}
        tabs={[
          { value: 'proximos', label: t('Próximos'), icon: CalendarClock },
          { value: 'anteriores', label: t('Anteriores'), icon: History },
        ]}
      />
      {a.isError && <V2ErrorState title={t('Não carregou a agenda')} description={t('A conexão falhou no meio do caminho. O link continua valendo.')} onRetry={a.refetch} />}
      {a.isLoading && <V2Skeleton lines={6} />}
      {a.incompleto && <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{t('Parte da agenda (só para filiados, só para a equipe ou os torneios) não carregou agora. A lista mostra o resto.')}</p>}
      {a.items && (
        <section className="space-y-3" aria-label={aba === 'proximos' ? t('Próximos') : t('Anteriores')}>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <label className="relative block">
              <span className="sr-only">{t('Buscar na agenda')}</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" aria-hidden="true" />
              <V2Input className="pl-9" type="search" value={filtro.q} onChange={(e) => setFiltro((f) => ({ ...f, q: e.target.value }))} placeholder={t('Evento, local, órgão…')} />
            </label>
            <V2Select aria-label={t('Agenda')} value={filtro.group} onChange={(e) => setFiltro((f) => ({ ...f, group: e.target.value }))}>
              <option value="">{t('Todas as agendas')}</option>
              {EVENT_GROUPS.map((g) => <option key={g.id} value={g.id}>{t(g.label)}</option>)}
            </V2Select>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs text-gray-500" aria-live="polite">{tn(lista.length, '{n} evento', '{n} eventos')}</p>
            {algumFiltro && <button type="button" onClick={() => setFiltro(() => FILTRO_VAZIO)} className="text-xs font-semibold text-ink underline">{t('Limpar filtros')}</button>}
          </div>
          {vazioTotal ? <p className="text-sm text-gray-500">{aba === 'proximos' ? t('Sem eventos marcados daqui para a frente.') : t('Sem eventos anteriores na agenda.')}</p>
            : lista.length === 0 ? <p className="text-sm text-gray-500">{t('Nada com esses filtros.')}</p>
              : meses.map((g) => (
                <div key={g.key || 'adiados'} className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">{g.key ? mesAno(g.key) : t('Adiados — nova data a definir')}</h3>
                  <ul className="space-y-2">{g.items.map((ev) => <AgendaEventItem key={ev.id} federation={federation} ev={ev} />)}</ul>
                </div>
              ))}
          {!vazioTotal && <MostrarMais restam={lista.length - quantos} onClick={() => setQuantos((n) => n + POR_VEZ)} />}
        </section>
      )}
    </div>
  );
}
