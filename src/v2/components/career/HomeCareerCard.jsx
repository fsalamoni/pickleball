/**
 * Card "Carreira" do início (flag `athlete_career`, escolhido pela pessoa,
 * docs/31 + docs/54 §4.9): a contagem do torneio principal, o que pede a
 * pessoa (prazo de inscrição perto, "Como foi?") e os próximos planejados.
 * Falha ≠ vazio: com a lista falhando, o card não diz "nada planejado".
 */
import React from 'react';
import { CalendarClock, CircleHelp, Route } from 'lucide-react';
import { useCareerEvents } from '@/modules/career/hooks/useCareer';
import { awaitsResult } from '@/modules/career/domain/careerEvent.js';
import { countdownText, deadlineInfo, mainCountdown, upcomingPlan } from '@/modules/career/domain/careerUpcoming.js';
import { V2ErrorState, V2Skeleton } from '@/v2/ui/primitives';
import { HomeAction, HomeEmpty, HomeRow, HomeSection } from '@/v2/components/home/personal/HomeSection';
import { careerDateLabel } from './careerUi';
import { t, tn } from '@/core/i18n';

const evLink = (id, aba = '') => `/carreira?${aba ? `aba=${aba}&` : ''}evento=${encodeURIComponent(id)}`;

export default function HomeCareerCard() {
  const q = useCareerEvents();
  const moldura = (conteudo) => (
    <HomeSection id="carreira" icon={Route} title={t('Carreira')} action={{ to: '/carreira?aba=proximos', label: t('Ver os próximos') }}>{conteudo}</HomeSection>
  );
  if (q.isLoading) return moldura(<V2Skeleton lines={3} />);
  if (q.isError) return moldura(<V2ErrorState inline title={t('A sua carreira não carregou')} onRetry={() => q.refetch()} />);
  const eventos = q.data || [];
  const principal = mainCountdown(eventos);
  // A MESMA pergunta da linha do tempo e dos próximos (resultado = colocação, posição ou pontos).
  const comoFoi = eventos.filter(awaitsResult).slice(0, 2);
  const plano = upcomingPlan({ events: eventos }).filter((i) => i.event.id !== principal?.event.id).slice(0, 3);
  if (!principal && !comoFoi.length && !plano.length) {
    return moldura(
      <HomeEmpty icon={Route} actions={<HomeAction to="/carreira?aba=proximos" primary>{t('Planejar um torneio')}</HomeAction>}>
        {t('Ponha no plano os torneios que vêm por aí — aqui e fora do PickleRush.')}
      </HomeEmpty>,
    );
  }
  const rotuloPrazo = (ev) => {
    const p = deadlineInfo(ev);
    return !ev.registered && p?.soon ? (p.days === 0 ? t('Inscrição fecha hoje') : tn(p.days, 'Inscrição fecha em {n} dia', 'Inscrição fecha em {n} dias')) : undefined;
  };
  return moldura(
    <div className="space-y-1">
      {principal && (
        <HomeRow to={evLink(principal.event.id, 'proximos')} icon={CalendarClock} title={principal.event.name} subtitle={countdownText(principal.days)} badge={rotuloPrazo(principal.event)} badgeTone="amber" highlight />
      )}
      {comoFoi.map((ev) => (
        <HomeRow key={ev.id} to={evLink(ev.id)} icon={CircleHelp} title={t('Como foi o {torneio}?', { torneio: ev.name })} subtitle={careerDateLabel(ev.start_date, ev.date_precision)} highlight />
      ))}
      {plano.map((i) => (
        <HomeRow key={i.key} to={evLink(i.event.id, 'proximos')} icon={CalendarClock} title={i.title} subtitle={careerDateLabel(i.date)} badge={rotuloPrazo(i.event)} badgeTone="amber" />
      ))}
    </div>,
  );
}
