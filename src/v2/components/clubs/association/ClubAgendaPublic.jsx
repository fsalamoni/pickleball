/**
 * A AGENDA OFICIAL do clube para quem lê (Bloco D2b): na página do clube (aba "Agenda
 * oficial" do associado e bloco do visitante) e na vitrine sem login (`/c/:id`).
 *
 * Cada pessoa vê o que a regra deixa: o público lê `pub`, o membro do clube lê `members`
 * (que inclui o público) — o filtro da consulta é o que prova a regra, e a "equipe" só
 * aparece na Central. Falha de consulta diz que não carregou, nunca "sem eventos". Evento
 * indisponível não distingue "não existe" de "não pode ver" (a regra também não distingue).
 *
 * Modos: `compacto` mostra os próximos e o caminho para a agenda inteira (vitrine); sem
 * ele, a agenda com busca e filtros. Com `eventId`, a página do evento.
 */
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays } from 'lucide-react';
import { splitAgenda } from '@/modules/federations/domain/agenda';
import { V2Button, V2ErrorState, V2Skeleton } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';
import { agendaPathFor, clubAgendaEntity, useScopedAgenda } from '../../federations/agenda/agendaScope';
import { AgendaBrowser } from '../../federations/agenda/AgendaPublic';
import AgendaEventView from '../../federations/agenda/AgendaEventView';
import { AgendaEventItem } from '../../federations/agenda/agendaUi';

export default function ClubAgendaPublic({ club, member = false, eventId = null, compacto = false, publica = false }) {
  const entity = useMemo(() => clubAgendaEntity(club, { publica, member }), [club, publica, member]);
  const a = useScopedAgenda(entity);
  const proximos = useMemo(() => (a.items ? splitAgenda(a.items).upcoming.slice(0, 4) : []), [a.items]);

  if (a.isLoading) return <V2Skeleton lines={compacto ? 2 : 4} />;
  if (a.isError) {
    return (
      <section id="clube-agenda" className="scroll-mt-4 space-y-2" aria-label={t('Agenda oficial')}>
        <V2ErrorState inline title={t('A agenda não carregou')} onRetry={a.refetch} />
      </section>
    );
  }
  if (!a.items) return null;

  if (eventId) {
    const ev = a.items.find((x) => x.id === eventId);
    return (
      <section id="clube-agenda" className="scroll-mt-4 space-y-3" aria-label={t('Evento da agenda oficial')}>
        {ev
          ? <AgendaEventView federation={entity} ev={ev} />
          : (
            <div className="rounded-2xl border border-gray-100 bg-paper-pure p-6 text-center">
              <p className="font-semibold text-ink">{t('Evento indisponível')}</p>
              <p className="mt-1 text-sm text-gray-500">{t('Ele pode ter sido apagado antes de ser divulgado, ou ser só para associados. Entre com a sua conta de associado para conferir.')}</p>
              <V2Button asChild variant="secondary" size="sm" className="mt-3"><Link to={agendaPathFor(entity)}>{t('Ver a agenda do clube')}</Link></V2Button>
            </div>
          )}
      </section>
    );
  }

  // Vitrine: sem nada marcado daqui para a frente a seção não existe — não há o que mostrar nem convidar a procurar.
  if (compacto) {
    if (proximos.length === 0) return null;
    return (
      <section id="clube-agenda" aria-labelledby="clube-agenda-titulo" className="scroll-mt-4 space-y-3" data-dica="clube-agenda-publica">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="clube-agenda-titulo" className="flex items-center gap-2 font-display text-xl font-bold text-ink"><CalendarDays className="h-5 w-5" aria-hidden="true" />{t('Agenda oficial')}</h2>
          <V2Button asChild variant="ghost" size="sm"><Link to={agendaPathFor(entity)}>{t('Abrir a agenda')}</Link></V2Button>
        </div>
        <ul className="space-y-2">{proximos.map((ev) => <AgendaEventItem key={ev.id} federation={entity} ev={ev} />)}</ul>
      </section>
    );
  }

  return (
    <section id="clube-agenda" className="scroll-mt-4 space-y-3" aria-label={t('Agenda oficial')} data-dica="clube-agenda-publica">
      <p className="text-sm text-gray-500">{member
        ? t('Competições, cursos, assembleias e reuniões do clube. O que muda de data ou é cancelado fica marcado, com o motivo.')
        : t('Os eventos que o clube deixa abertos a qualquer pessoa.')}</p>
      <AgendaBrowser federation={entity} />
    </section>
  );
}
