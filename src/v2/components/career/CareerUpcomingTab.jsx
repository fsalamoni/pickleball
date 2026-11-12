/**
 * A aba PRÓXIMOS da Carreira (`?aba=proximos`, docs/54 §4.9):
 *  - a contagem regressiva do torneio PRINCIPAL;
 *  - o PLANO: os planejados (prioridade, prazo, "Já me inscrevi", .ics) e os
 *    torneios da plataforma em que a pessoa está inscrita;
 *  - a DESCOBERTA: a agenda das federações em que é filiada, os chancelados e
 *    os torneios públicos da plataforma, filtrados pela Minha região. "Pôr no
 *    meu plano" cria o planejado já preenchido.
 * Cada fonte falha sozinha e a tela diz qual — nunca "não há torneio".
 */
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { CalendarClock, Plus } from 'lucide-react';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useRegionalList } from '@/core/lib/useMyRegion';
import { usePublicTournaments } from '@/modules/tournament/hooks/useTournament';
import { useFederationAgendaForMe } from '@/modules/career/hooks/useCareer';
import { CAREER_PRIORITY } from '@/modules/career/domain/careerEvent.js';
import {
  DISCOVERY_KIND, DISCOVERY_KIND_LABEL, PRIORITY_LABEL, buildDiscovery, careerEventIcs, countdownText, deadlineInfo, mainCountdown, planDraftFrom, upcomingPlan,
} from '@/modules/career/domain/careerUpcoming.js';
import { aspectLabel } from '@/modules/training/domain/debrief.js';
import AddToCalendarButton from '@/modules/tournament/components/AddToCalendarButton';
import RegionBar, { RegionEmptyHint } from '@/v2/components/region/RegionBar';
import { V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Select, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { careerDateLabel } from './careerUi';
import { t, tn } from '@/core/i18n';

const lugar = (x) => [x.city, x.state].filter(Boolean).join(' - ');
// Lista vazia de identidade estável: um `[]` novo a cada render desfaria o `useMemo` da descoberta.
const VAZIO = [];

function Prazo({ event }) {
  const p = deadlineInfo(event);
  if (event.registered) return <V2Badge tone="green">{t('Inscrito')}</V2Badge>;
  if (!p) return null;
  if (p.closed) return <V2Badge tone="neutral">{t('Inscrição fechou')}</V2Badge>;
  return <V2Badge tone={p.soon ? 'red' : 'neutral'}>{p.days === 0 ? t('Inscrição fecha hoje') : tn(p.days, 'Inscrição fecha em {n} dia', 'Inscrição fecha em {n} dias')}</V2Badge>;
}

function ItemDoPlano({ item, save, onOpenEvent }) {
  const [busy, setBusy] = useState(false);
  if (item.kind === 'platform') {
    const tt = item.tournament;
    return (
      <li className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-gray-100 p-3">
        <div className="min-w-0">
          <p className="font-semibold text-ink">{item.title}</p>
          <p className="text-sm text-gray-500">{[careerDateLabel(item.date), lugar(tt)].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <V2Badge tone="blue">{t('Inscrito no PickleRush')}</V2Badge>
          <V2Button asChild size="sm" variant="ghost"><Link to={`/torneios/${tt.id}`}>{t('Abrir')}</Link></V2Button>
        </div>
      </li>
    );
  }
  const ev = item.event;
  const grava = async (patch, ok) => {
    // O seletor não é desligado enquanto salva (perderia o foco no teclado): a mudança concorrente é ignorada.
    if (busy) return;
    setBusy(true);
    try {
      const { saved } = await save({ ...ev, ...patch });
      toast.success(saved ? ok : t('Guardado neste aparelho. Enviamos quando a conexão voltar.'));
    } catch (err) {
      toast.error(err?.message || t('Não foi possível salvar. Tente de novo.'));
    } finally {
      setBusy(false);
    }
  };
  const ics = careerEventIcs(ev);
  return (
    <li className="space-y-2 rounded-2xl border border-gray-100 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <button type="button" className="min-w-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ink" onClick={() => onOpenEvent(ev.id)}>
          <span className="block font-semibold text-ink underline-offset-2 hover:underline">{ev.name}</span>
          <span className="block text-sm text-gray-500">{[careerDateLabel(ev.start_date, ev.date_precision), lugar(ev)].filter(Boolean).join(' · ')}</span>
          {ev.aim && <span className="block text-sm text-gray-600">{t('Meta: {m}', { m: ev.aim })}</span>}
        </button>
        <Prazo event={ev} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <V2Select
          aria-label={t('Prioridade de {torneio}', { torneio: ev.name })}
          className="w-auto"
          value={ev.priority || 'casual'}
          aria-busy={busy}
          onChange={(e) => grava({ priority: e.target.value }, t('Prioridade salva.'))}
        >
          {CAREER_PRIORITY.map((v) => <option key={v} value={v}>{t(PRIORITY_LABEL[v])}</option>)}
        </V2Select>
        {/* Sem depender do prazo de inscrição (campo opcional): quem se inscreveu marca — e desmarca — aqui. */}
        {ev.registered ? (
          <V2Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => grava({ registered: false }, t('Inscrição desmarcada.'))}>
            {t('Desmarcar inscrição')}
          </V2Button>
        ) : (
          <V2Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => grava({ registered: true }, t('Marcado como inscrito.'))}>
            {t('Já me inscrevi')}
          </V2Button>
        )}
        {ics && <AddToCalendarButton event={ics} variant="ghost" />}
      </div>
    </li>
  );
}

function Descoberta({ events, myTournaments, save, onOpenEvent }) {
  const fedOn = useFeatureFlag(FEATURE_FLAG.FEDERATIONS);
  const publicos = usePublicTournaments();
  const agenda = useFederationAgendaForMe({ enabled: fedOn });
  const [busy, setBusy] = useState('');
  // Identidades estáveis: o hook devolve `[]` e o mapa das federações novos a cada render.
  const fedEvents = !fedOn ? VAZIO : agenda.events?.length ? agenda.events : agenda.events && VAZIO;
  const torneios = publicos.isSuccess ? publicos.data : VAZIO;
  const fedsKey = JSON.stringify(agenda.federations || {});
  // Memo: sem ele o filtro por região (distância cidade a cidade) rodava a cada render da aba.
  const itens = useMemo(() => buildDiscovery({
    federationEvents: fedEvents, tournaments: torneios, events, myTournaments, federations: JSON.parse(fedsKey),
  }), [fedEvents, torneios, events, myTournaments, fedsKey]);
  const regional = useRegionalList(itens, (x) => ({ city: x.city, state: x.state }));
  // Agenda que FALHOU não segura o esqueleto: os torneios do PickleRush aparecem e o aviso diz o que faltou.
  const carregando = publicos.isPending || (fedOn && agenda.isPending && !agenda.isError);
  const faltou = [publicos.isError && t('os torneios do PickleRush'), fedOn && (agenda.isError || agenda.incompleto) && t('a agenda das suas federações')].filter(Boolean);

  async function porNoPlano(item) {
    setBusy(item.key);
    try {
      const { saved, event } = await save(planDraftFrom(item));
      toast.success(saved ? t('Está no seu plano.') : t('Guardado neste aparelho. Enviamos quando a conexão voltar.'));
      onOpenEvent(event.id, event);
    } catch (err) {
      toast.error(err?.message || t('Não foi possível salvar. Tente de novo.'));
    } finally {
      setBusy('');
    }
  }

  return (
    <section className="space-y-3" data-dica="carreira-descoberta">
      <h2 className="font-display text-lg font-bold text-ink">{t('Para pôr no plano')}</h2>
      <RegionBar regional={regional} nomeItens={['torneio', 'torneios']} />
      {faltou.length > 0 && (
        <V2ErrorState
          inline
          title={t('Parte da lista não carregou')}
          description={t('Ficou de fora: {fontes}. O que aparece abaixo está certo, mas pode faltar torneio.', { fontes: faltou.join(', ') })}
          onRetry={() => { if (publicos.isError) publicos.refetch(); agenda.retry(); }}
        />
      )}
      {carregando ? <V2Skeleton lines={3} /> : regional.itens.length === 0 ? (
        regional.fora > 0 ? <RegionEmptyHint regional={regional} oque={t('Nenhum torneio')} /> : faltou.length === 0 && (
          <p className="text-sm text-gray-500">{t('Nenhum torneio público por vir agora. Os da agenda das suas federações também aparecem aqui.')}</p>
        )
      ) : (
        <ul className="space-y-2">
          {regional.itens.map((item) => (
            <li key={item.key} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-gray-100 p-3">
              <div className="min-w-0">
                <p className="font-semibold text-ink">{item.title}</p>
                <p className="text-sm text-gray-500">{[careerDateLabel(item.start_date), lugar(item), item.federation_acronym].filter(Boolean).join(' · ')}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <V2Badge tone={item.kind === 'platform' ? 'neutral' : 'blue'}>{t(DISCOVERY_KIND_LABEL[item.kind])}</V2Badge>
                {item.link && <V2Button asChild size="sm" variant="ghost"><Link to={item.link}>{t('Ver')}</Link></V2Button>}
                {/* Sem saber em que a pessoa está inscrita, o torneio daqui poderia virar plano repetido. */}
                {(myTournaments !== undefined || item.kind === DISCOVERY_KIND.FEDERATION) && (
                  <V2Button type="button" size="sm" variant="secondary" disabled={Boolean(busy)} onClick={() => porNoPlano(item)}>
                    <Plus className="h-4 w-4" /> {busy === item.key ? t('Salvando…') : t('Pôr no meu plano')}
                  </V2Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** @param {{ data: object, save: Function, onOpenEvent: (id: string, ev?: object) => void, onRegister: Function }} props */
export default function CareerUpcomingTab({ data, save, onOpenEvent, onRegister }) {
  if (data.isPending) return <V2Skeleton lines={4} />;
  const { events, myTournaments } = data;
  const plano = upcomingPlan({ events, myTournaments });
  const principal = mainCountdown(events);
  return (
    <div className="space-y-6">
      {principal && (
        <V2Surface variant="plano" className="flex items-center gap-3" data-dica="carreira-contagem">
          <CalendarClock className="h-6 w-6 text-ink" aria-hidden="true" />
          <div>
            <p className="font-display text-xl font-bold text-ink">{countdownText(principal.days)}</p>
            <p className="text-sm text-gray-600">
              {[principal.event.name, principal.event.focus_aspect ? t('Foco: {aspecto}', { aspecto: aspectLabel(principal.event.focus_aspect) }) : ''].filter(Boolean).join(' · ')}
            </p>
          </div>
        </V2Surface>
      )}

      <section className="space-y-3" data-dica="carreira-plano-lista">
        <h2 className="font-display text-lg font-bold text-ink">{t('Meu plano')}</h2>
        {events === undefined && (
          <V2ErrorState inline title={t('Os seus torneios planejados não carregaram')} description={t('Eles continuam lá — a conexão é que falhou.')} onRetry={data.retry} />
        )}
        {myTournaments === undefined && events !== undefined && (
          <p className="text-sm text-gray-500">{t('Os torneios do PickleRush em que você está inscrito não carregaram agora.')}</p>
        )}
        {plano.length > 0 ? (
          <ul className="space-y-2">
            {plano.map((item) => <ItemDoPlano key={item.key} item={item} save={save} onOpenEvent={onOpenEvent} />)}
          </ul>
        ) : events !== undefined && myTournaments !== undefined && (
          <V2EmptyState
            icon={CalendarClock}
            title={t('Nada no plano ainda')}
            description={t('Ponha abaixo um torneio que vem por aí, ou registre um planejado.')}
            action={<V2Button type="button" variant="secondary" onClick={onRegister}><Plus className="h-4 w-4" /> {t('Registrar torneio')}</V2Button>}
          />
        )}
      </section>

      {/* Sem o plano carregado, "Pôr no meu plano" poderia duplicar o que já está lá. */}
      {events !== undefined && <Descoberta events={events} myTournaments={myTournaments} save={save} onOpenEvent={onOpenEvent} />}
    </div>
  );
}
