/**
 * Peças do CALENDÁRIO OFICIAL compartilhadas pela página pública, pelo
 * resumo na página da federação e pela Central: a data em destaque, a linha
 * do evento, a faixa de situação (cancelado, adiado, remarcado) e os
 * caminhos para levar o evento ao calendário de quem lê (arquivo ICS e
 * Google Agenda).
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Lock, MapPin, Video } from 'lucide-react';
import {
  EVENT_CHANGE_LABELS, EVENT_STATUS, EVENT_VISIBILITY, EVENT_VISIBILITY_LABELS, buildIcs, eventKind, eventPublicPath, eventState, lastChange, placeText,
} from '@/modules/federations/domain/agenda';
import { V2Badge } from '@/v2/ui/primitives';
import { fmtData, t, tk } from '@/core/i18n';
import { baixarBlob } from '../acervo/acervoFiles';
import { publicHost } from '../federationUi';

/** A data do evento ("2026-11-05") como dia LOCAL — meio-dia evita virar o dia anterior em qualquer fuso. */
const diaLocal = (iso) => new Date(`${String(iso || '').slice(0, 10)}T12:00:00`);

export const mesAno = (chave) => (chave ? fmtData(diaLocal(`${chave}-01`), { month: 'long', year: 'numeric' }) : '');

/** "qui., 5 de nov. de 2026" — e "5 a 7 de nov." quando dura mais de um dia. */
export function dataDoEvento(ev) {
  if (!ev?.date) return '';
  const ini = fmtData(diaLocal(ev.date), { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  if (!ev.end_date || ev.end_date === ev.date) return ini;
  return t('{inicio} a {fim}', { inicio: ini, fim: fmtData(diaLocal(ev.end_date), { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) });
}

/** "19:30–21:00", "19:30" ou "Dia inteiro". */
export function horarioDoEvento(ev) {
  if (!ev || ev.all_day) return t('Dia inteiro');
  return ev.end_time ? `${ev.start_time}–${ev.end_time}` : ev.start_time || '';
}

/** O quadradinho com o dia e o mês. */
export function DateBadge({ ev, adiado = false }) {
  const d = diaLocal(ev?.date);
  return (
    <span className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl ${adiado ? 'bg-amber-50 text-amber-800' : 'bg-ink text-white'}`} aria-hidden="true">
      <span className="font-display text-xl font-bold leading-none">{adiado ? '?' : d.getDate()}</span>
      <span className="mt-0.5 text-xs font-bold uppercase">{adiado ? t('adiado') : fmtData(d, { month: 'short' }).replace('.', '')}</span>
    </span>
  );
}

const TOM = { cancelled: 'red', postponed: 'amber', ongoing: 'acid', past: 'neutral' };
const ROTULO = { cancelled: tk('Cancelado'), postponed: tk('Adiado'), ongoing: tk('Acontecendo agora'), past: tk('Já aconteceu') };

/** A faixa de situação do evento (para a lista). */
export function StatusBadge({ ev, nowMs = Date.now() }) {
  const st = eventState(ev, nowMs);
  const mudou = lastChange(ev);
  if (TOM[st]) return <V2Badge tone={TOM[st]}>{t(ROTULO[st])}</V2Badge>;
  if (mudou && (mudou.kind === 'rescheduled' || mudou.kind === 'reopened')) return <V2Badge tone="acid">{t(EVENT_CHANGE_LABELS[mudou.kind])}</V2Badge>;
  return null;
}

/** "05/11/2026, 19:30" a partir das partes gravadas no histórico. */
export const dataCurta = (date, time) => (date ? `${fmtData(diaLocal(date), { day: '2-digit', month: '2-digit', year: 'numeric' })}${time ? `, ${time}` : ''}` : '');

/** O aviso grande na página do evento: cancelado, adiado, remarcado. */
export function StatusBanner({ ev }) {
  const mudou = lastChange(ev);
  if (ev.status === EVENT_STATUS.CANCELLED) {
    return <p role="status" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"><strong>{t('Evento cancelado.')}</strong> {ev.status_reason ? t('Motivo: {motivo}', { motivo: ev.status_reason }) : ''}</p>;
  }
  if (ev.status === EVENT_STATUS.POSTPONED) {
    return <p role="status" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><strong>{t('Adiado: a nova data ainda será definida.')}</strong> {ev.status_reason ? t('Motivo: {motivo}', { motivo: ev.status_reason }) : ''}</p>;
  }
  if (mudou && (mudou.kind === 'rescheduled' || mudou.kind === 'reopened')) {
    return (
      <p role="status" className="rounded-2xl border border-acid/40 bg-acid/10 px-4 py-3 text-sm text-ink">
        <strong>{mudou.kind === 'reopened' ? t('Reaberto.') : t('Remarcado.')}</strong>{' '}
        {mudou.from_date ? t('Antes: {data}.', { data: dataCurta(mudou.from_date, mudou.from_time) }) : ''} {mudou.reason ? t('Motivo: {motivo}', { motivo: mudou.reason }) : ''}
      </p>
    );
  }
  return null;
}

/** Uma linha da agenda. */
export function AgendaEventItem({ federation, ev, nowMs = Date.now() }) {
  const kind = eventKind(ev.kind);
  const adiado = ev.status === EVENT_STATUS.POSTPONED;
  const local = placeText(ev.place);
  return (
    <li>
      <Link to={eventPublicPath(federation, ev)} className={`flex gap-3 rounded-2xl border border-gray-100 bg-paper-pure p-3 transition-colors hover:border-ink/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink ${ev.status === EVENT_STATUS.CANCELLED ? 'opacity-75' : ''}`}>
        <DateBadge ev={ev} adiado={adiado} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2 text-xs">
            {kind && <span className="font-bold uppercase tracking-wider text-gray-500">{t(kind.label)}</span>}
            <StatusBadge ev={ev} nowMs={nowMs} />
            {ev.visibility && ev.visibility !== EVENT_VISIBILITY.PUBLIC && <V2Badge tone="neutral"><Lock className="h-3 w-3" aria-hidden="true" />{t(EVENT_VISIBILITY_LABELS[ev.visibility])}</V2Badge>}
          </span>
          <span className={`mt-0.5 block font-semibold text-ink ${ev.status === EVENT_STATUS.CANCELLED ? 'line-through' : ''}`}>{ev.title}</span>
          <span className="mt-0.5 block text-xs text-gray-500">{adiado ? t('Nova data a definir') : [dataDoEvento(ev), horarioDoEvento(ev)].filter(Boolean).join(' · ')}</span>
          {(local || ev.online_url) && (
            <span className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
              {local ? <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" /> : <Video className="h-3 w-3 shrink-0" aria-hidden="true" />}
              <span className="truncate">{local || t('Online')}</span>
            </span>
          )}
        </span>
      </Link>
    </li>
  );
}

const urlDoEvento = (federation, ev) => `https://${publicHost()}${eventPublicPath(federation, ev)}`;

/** Baixa o arquivo de calendário (ICS) de um evento ou de uma lista. */
export function baixarIcs(federation, eventos, nome) {
  const texto = buildIcs(eventos, { name: `${federation.acronym || federation.name} — ${t('Agenda oficial')}`, host: publicHost(), urlOf: (ev) => urlDoEvento(federation, ev), stampMs: Date.now() });
  baixarBlob(new Blob([texto], { type: 'text/calendar;charset=utf-8' }), `${nome}.ics`);
}

export { urlDoEvento };
