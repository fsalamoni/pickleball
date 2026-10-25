/**
 * A página de UM evento do calendário oficial (`/f/:slug/agenda/:eventId`):
 * quando, onde (com mapa), o link da transmissão, o órgão que se reúne, o
 * texto, os documentos do acervo ligados a ele (o edital, a ata), o que
 * mudou (remarcado, adiado, cancelado — com o motivo) e os caminhos para
 * levar ao calendário de quem lê e compartilhar.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { CalendarPlus, Clock, Copy, History, Landmark, Lock, MapPin, Share2, Video } from 'lucide-react';
import { useClipboard } from '@/core/lib/useClipboard';
import { buildWhatsAppShareUrl } from '@/modules/sharing/domain/shareLinks';
import { EVENT_CHANGE_LABELS, EVENT_VISIBILITY, eventKind, googleCalendarUrl, mapUrl, placeText } from '@/modules/federations/domain/agenda';
import { V2Badge, V2Button } from '@/v2/ui/primitives';
import { fmtData, t } from '@/core/i18n';
import { AcervoFollowButton } from '../acervo/AcervoPublic';
import { docPathFor, visibilityLabelFor } from '../acervo/acervoScope';
import { agendaPathFor, hasComments, hasFollow, hasMeetings } from './agendaScope';
import MeetingBlock from './MeetingBlock';
import CommentsSection from '../comments/CommentsSection';
import { StatusBadge, StatusBanner, baixarIcs, dataCurta, dataDoEvento, horarioDoEvento, urlDoEvento } from './agendaUi';

function Linha({ icone: Icone, children }) {
  return (
    <p className="flex items-start gap-2 text-sm text-gray-700">
      <Icone className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
      <span className="min-w-0">{children}</span>
    </p>
  );
}

export default function AgendaEventView({ federation, ev }) {
  const { copy } = useClipboard();
  const kind = eventKind(ev.kind);
  const url = urlDoEvento(federation, ev);
  const local = placeText(ev.place);
  const mapa = mapUrl(ev.place);
  const adiado = ev.status === 'postponed';
  const cancelado = ev.status === 'cancelled';
  const compartilhar = async () => {
    if (navigator.share) { try { await navigator.share({ title: ev.title, url }); return; } catch (e) { if (e?.name === 'AbortError') return; } }
    copy(url, t('Link do evento copiado.'));
  };
  const historico = Array.isArray(ev.history) ? [...ev.history].reverse() : [];
  return (
    <article className="space-y-5">
      <Link to={agendaPathFor(federation)} className="text-sm font-semibold text-gray-500 underline-offset-2 hover:underline print:hidden">{t('← Toda a agenda')}</Link>
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {kind && <span className="font-bold uppercase tracking-wider text-gray-500">{t(kind.label)}</span>}
          <StatusBadge ev={ev} />
          {ev.visibility && ev.visibility !== EVENT_VISIBILITY.PUBLIC && <V2Badge tone="neutral"><Lock className="h-3 w-3" aria-hidden="true" />{t(visibilityLabelFor(federation, ev.visibility))}</V2Badge>}
        </div>
        <h1 className={`font-display text-2xl font-bold text-ink break-words sm:text-3xl ${cancelado ? 'line-through' : ''}`}>{ev.title}</h1>
      </header>
      <StatusBanner ev={ev} />
      <section className="space-y-2 rounded-2xl border border-gray-100 bg-paper-pure p-4">
        <Linha icone={Clock}>{adiado ? t('Nova data a definir') : <>{dataDoEvento(ev)} · {horarioDoEvento(ev)} <span className="text-xs text-gray-500">{t('(horário de Brasília)')}</span></>}</Linha>
        {local && <Linha icone={MapPin}>{local}{mapa && <> · <a href={mapa} target="_blank" rel="noopener noreferrer" className="font-semibold text-ink underline underline-offset-2">{t('Ver no mapa')}</a></>}</Linha>}
        {ev.online_url && <Linha icone={Video}><a href={ev.online_url} target="_blank" rel="noopener noreferrer" className="break-all font-semibold text-ink underline underline-offset-2">{t('Acompanhar online')}</a></Linha>}
        {ev.organ && <Linha icone={Landmark}>{ev.organ}</Linha>}
      </section>
      {ev.description && <div className="whitespace-pre-line text-base leading-relaxed text-gray-800">{ev.description}</div>}
      {hasMeetings(federation) && <MeetingBlock federation={federation} ev={ev} />}
      {ev.related_docs?.length > 0 && (
        <section aria-labelledby="ev-docs" className="space-y-2">
          <h2 id="ev-docs" className="text-xs font-bold uppercase tracking-wider text-gray-500">{t('Documentos ligados')}</h2>
          <ul className="space-y-1">
            {ev.related_docs.map((d) => (
              <li key={d.doc_id}>
                <Link to={docPathFor(federation, d.doc_id)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink underline underline-offset-2">
                  {d.visibility && d.visibility !== 'public' && <Lock className="h-3.5 w-3.5" aria-label={t('Restrito')} />}
                  {[d.code, d.title].filter(Boolean).join(' — ') || t('Documento')}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {!cancelado && (
        <div className="flex flex-wrap gap-2 print:hidden">
          {!adiado && <V2Button type="button" size="sm" onClick={() => baixarIcs(federation, [ev], `evento-${ev.id}`)}><CalendarPlus className="h-4 w-4" />{t('Adicionar ao calendário')}</V2Button>}
          {!adiado && <V2Button asChild size="sm" variant="secondary"><a href={googleCalendarUrl(ev, { url })} target="_blank" rel="noopener noreferrer">{t('Google Agenda')}</a></V2Button>}
        </div>
      )}
      <div className="flex flex-wrap gap-2 print:hidden">
        <V2Button type="button" size="sm" variant="ghost" onClick={compartilhar}><Share2 className="h-4 w-4" />{t('Compartilhar')}</V2Button>
        <V2Button asChild size="sm" variant="ghost"><a href={buildWhatsAppShareUrl(`${ev.title} — ${url}`)} target="_blank" rel="noopener noreferrer">WhatsApp</a></V2Button>
        <V2Button type="button" size="sm" variant="ghost" onClick={() => copy(url, t('Link do evento copiado.'))}><Copy className="h-4 w-4" />{t('Copiar o link')}</V2Button>
        {hasFollow(federation) && <AcervoFollowButton federation={federation} next={agendaPathFor(federation)} />}
      </div>
      {historico.length > 0 && (
        <details className="rounded-2xl border border-gray-100 bg-paper-pure p-4 text-sm">
          <summary className="flex cursor-pointer items-center gap-2 font-semibold text-ink"><History className="h-4 w-4" aria-hidden="true" />{t('O que mudou')}</summary>
          <ul className="mt-3 space-y-2">
            {historico.map((h, i) => (
              <li key={`${h.at_ms || i}-${h.kind}`} className="text-gray-700">
                <strong>{EVENT_CHANGE_LABELS[h.kind] ? t(EVENT_CHANGE_LABELS[h.kind]) : t('Alterado')}</strong>
                {h.at_ms ? <span className="text-gray-500"> · {fmtData(new Date(h.at_ms), { day: '2-digit', month: '2-digit', year: 'numeric' })}</span> : null}
                {h.from_date ? <> · {t('antes: {data}', { data: dataCurta(h.from_date, h.from_time) })}</> : null}
                {h.to_date ? <> · {t('nova data: {data}', { data: dataCurta(h.to_date, h.to_time) })}</> : null}
                {h.reason ? <span className="block text-gray-500">{t('Motivo: {motivo}', { motivo: h.reason })}</span> : null}
              </li>
            ))}
          </ul>
        </details>
      )}
      {!ev.derived && hasComments(federation) && <div className="print:hidden"><CommentsSection federation={federation} kind="event" targetId={ev.id} /></div>}
    </article>
  );
}
