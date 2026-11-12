/**
 * MINHA CARREIRA (`/carreira`, flag `athlete_career`, docs/54).
 *
 * Abas (`?aba=`, contrato): `linha-do-tempo` (abre aqui), `proximos` (o plano
 * e a descoberta), `metas` (as metas da temporada) e `conquistas` (a estante,
 * com "Fora da plataforma"). Só a aba aberta consulta (a linha do tempo serve
 * às três primeiras: os próximos e as metas saem dela).
 *
 * Outros parâmetros: `?evento=<id>` abre a ficha de um torneio de fora,
 * `?registrar=1` abre o registro rápido, `?lista=1` o modo lista e
 * `?dupla=<id do pedido>` destaca um pedido de confirmação que chegou (aviso).
 * Abrir empilha no histórico (o Voltar do aparelho fecha o diálogo); FECHAR
 * substitui — senão o Voltar reabriria o que a pessoa acabou de fechar.
 *
 * Com a flag DESLIGADA a página não some para quem tem registros: fica a
 * versão mínima (`CarreiraDesligada`) para apagar e tirar do perfil público —
 * a regra e o servidor mantêm as duas coisas de propósito.
 *
 * O resultado declarado aqui nunca entra em ranking, rating nem XP.
 */
import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { CalendarClock, Flag, ListPlus, Medal, Plus, Route } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlags } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { CAREER_TAB, careerTabFromParam } from '@/modules/career/domain/timeline.js';
import { repeatEvent } from '@/modules/career/domain/careerEvent.js';
import { PARTNER_STATUS, pastPartners } from '@/modules/career/domain/careerPartner.js';
import {
  useCareerEvents, useCareerPartnerAction, useCareerPublic, useCareerSaveWithDraft, useDeleteCareerEvent,
} from '@/modules/career/hooks/useCareer';
import { useCareerTimeline } from '@/modules/career/hooks/useCareerTimeline';
import { V2Button, V2ErrorState, V2Page, V2PageIntro, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { V2SubTabs } from '@/v2/ui/V2SectionNav';
import CareerTimeline from '@/v2/components/career/CareerTimeline';
import { CareerPartnerInbox } from '@/v2/components/career/CareerPartnerUi';
import { careerDateLabel } from '@/v2/components/career/careerUi';
import TrophyShelf, { ABA_FORA } from '@/v2/components/trophies/TrophyShelf';
import { t, tk } from '@/core/i18n';

const CareerQuickRegister = lazy(() => import('@/v2/components/career/CareerQuickRegister'));
const CareerEventSheet = lazy(() => import('@/v2/components/career/CareerEventSheet'));
const CareerListMode = lazy(() => import('@/v2/components/career/CareerListMode'));
const CareerUpcomingTab = lazy(() => import('@/v2/components/career/CareerUpcomingTab'));
const CareerGoalsTab = lazy(() => import('@/v2/components/career/CareerGoalsTab'));
const CareerRankPanel = lazy(() => import('@/v2/components/career/CareerRankPanel'));

const ABAS = [
  { value: CAREER_TAB.TIMELINE, label: tk('Linha do tempo'), icon: Route, dica: 'carreira-aba-linha-do-tempo' },
  { value: CAREER_TAB.UPCOMING, label: tk('Próximos'), icon: CalendarClock, dica: 'carreira-aba-proximos' },
  { value: CAREER_TAB.GOALS, label: tk('Metas'), icon: Flag, dica: 'carreira-aba-metas' },
  { value: CAREER_TAB.ACHIEVEMENTS, label: tk('Conquistas'), icon: Medal, dica: 'carreira-aba-conquistas' },
];

function Carreira() {
  const { user, userProfile } = useAuth();
  const [params, setParams] = useSearchParams();
  const aba = careerTabFromParam(params.get('aba'));
  const eventoId = params.get('evento');
  const duplaId = params.get('dupla');
  // Com `?evento=` a consulta roda em qualquer aba: sem a lista não há como abrir (nem dizer que sumiu).
  const linhaDoTempo = useCareerTimeline({ enabled: aba !== CAREER_TAB.ACHIEVEMENTS || Boolean(eventoId) });
  const rascunho = useCareerSaveWithDraft();
  const [repetir, setRepetir] = useState(null);
  // O recém-registrado (ainda fora da lista) abre a ficha mesmo assim.
  const [fichaLocal, setFichaLocal] = useState(null);

  const muda = (mexer, replace = false) => {
    const p = new URLSearchParams(params);
    mexer(p);
    setParams(p, { replace });
  };
  const abrirFicha = (id, local) => { if (local) setFichaLocal(local); muda((p) => { p.set('evento', id); p.delete('registrar'); }, params.has('registrar')); };
  const fechar = (k) => muda((p) => p.delete(k), true);
  const abrirLista = () => muda((p) => p.set('lista', '1'));
  const abrirRegistro = () => { setRepetir(null); muda((p) => p.set('registrar', '1')); };

  // O rascunho do aparelho vem primeiro: é o que a pessoa digitou por último (e o recusado só existe ali).
  const evento = useMemo(() => rascunho.pending.find((e) => e.id === eventoId)
    || (linhaDoTempo.events || []).find((e) => e.id === eventoId)
    || (fichaLocal?.id === eventoId ? fichaLocal : null), [rascunho.pending, linhaDoTempo.events, eventoId, fichaLocal]);
  const registrar = params.get('registrar') === '1';
  const lista = params.get('lista') === '1';
  const past = useMemo(() => pastPartners({ career: linhaDoTempo.events, trophies: linhaDoTempo.trophies, me: user?.uid }),
    [linhaDoTempo.events, linhaDoTempo.trophies, user?.uid]);

  // `?evento=` de um torneio que não existe mais (aviso antigo, excluído, Voltar depois de excluir):
  // com a lista CARREGADA, dizer e limpar a URL. O que esta visita já abriu sai calado (foi a pessoa que excluiu).
  const abertos = useRef(new Set());
  useEffect(() => { if (evento) abertos.current.add(evento.id); }, [evento]);
  // Só com dado FRESCO: o cache de outra tela pode não ter o torneio/pedido que o aviso acabou de trazer.
  const listaCarregou = !linhaDoTempo.isPending && !linhaDoTempo.eventsFetching && Array.isArray(linhaDoTempo.events);
  useEffect(() => {
    if (!eventoId || evento || !listaCarregou) return;
    if (!abertos.current.has(eventoId)) toast.message(t('Este torneio não está mais na sua carreira.'));
    fechar('evento');
  }, [eventoId, evento, listaCarregou]); // eslint-disable-line react-hooks/exhaustive-deps
  // O mesmo para `?dupla=` de um pedido cancelado ou recusado.
  const pedidos = linhaDoTempo.isPending || linhaDoTempo.partnersFetching ? undefined : linhaDoTempo.partners;
  useEffect(() => {
    if (!duplaId || !Array.isArray(pedidos)) return;
    if (pedidos.some((d) => d.id === duplaId && d.partner_uid === user?.uid && d.status !== PARTNER_STATUS.DECLINED)) return;
    toast.message(t('Este pedido de confirmação não está mais aberto.'));
    fechar('dupla');
  }, [duplaId, pedidos, user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  /** "Pôr na minha carreira também": grava o registro espelhado e abre a ficha para ajustar. */
  async function porTambem(rascunhoDaDupla) {
    if (!rascunhoDaDupla) return false;
    // Sem a lista não dá para saber se já está na carreira: espelhar às cegas duplicaria.
    if (!Array.isArray(linhaDoTempo.events)) {
      toast.error(t('Os seus torneios não carregaram, então não dá para saber se este já está na sua carreira. Tente de novo quando a conexão voltar.'));
      return false;
    }
    // Já está na carreira (o vínculo do servidor ainda não chegou): abre o que existe, não grava outro.
    const ja = linhaDoTempo.events.find((e) => e.linked_event?.id && e.linked_event.id === rascunhoDaDupla.linked_event?.id);
    if (ja) { abrirFicha(ja.id); return true; }
    try {
      const { saved, event: ev } = await rascunho.save(rascunhoDaDupla);
      toast.success(saved ? t('Está na sua carreira também.') : t('Guardado neste aparelho. Enviamos quando a conexão voltar.'));
      abrirFicha(ev.id, ev);
      return true;
    } catch (err) {
      toast.error(err?.message || t('Não foi possível salvar. Tente de novo.'));
      return false;
    }
  }

  return (
    <V2Page className="space-y-6">
      <V2PageIntro
        title={t('Carreira')}
        subtitle={t('Os torneios que você jogou, aqui e fora do PickleRush, numa linha do tempo só sua.')}
        action={(
          <>
            <V2Button type="button" variant="secondary" data-dica="carreira-lista" onClick={abrirLista}>
              <ListPlus className="h-4 w-4" /> {t('Vários de uma vez')}
            </V2Button>
            <V2Button type="button" variant="primary" data-dica="carreira-registrar" onClick={abrirRegistro}>
              <Plus className="h-4 w-4" /> {t('Registrar torneio')}
            </V2Button>
          </>
        )}
      />

      <V2SubTabs
        tabs={ABAS.map((a) => ({ ...a, label: t(a.label) }))}
        activeValue={aba}
        onSelect={(a) => muda((p) => { if (a.value === CAREER_TAB.TIMELINE) p.delete('aba'); else p.set('aba', a.value); })}
        ariaLabel={t('Abas da Carreira')}
        dica="carreira-abas"
      />

      {aba === CAREER_TAB.TIMELINE && !linhaDoTempo.isPending && (
        <CareerPartnerInbox
          partners={linhaDoTempo.partners}
          error={linhaDoTempo.partnersError}
          onRetry={linhaDoTempo.retryPartners}
          focus={duplaId}
          onMirror={porTambem}
        />
      )}
      {aba === CAREER_TAB.TIMELINE && (
        <CareerTimeline
          data={linhaDoTempo}
          pending={rascunho.pending}
          onFlush={rascunho.flush}
          flushing={rascunho.flushing}
          onOpenEvent={abrirFicha}
          onRegister={abrirRegistro}
          onList={abrirLista}
        />
      )}
      {aba === CAREER_TAB.TIMELINE && !linhaDoTempo.isPending && (
        <Suspense fallback={<V2Skeleton lines={2} />}>
          <CareerRankPanel federationPoints={linhaDoTempo.federationPoints} onRetryPoints={linhaDoTempo.retry} />
        </Suspense>
      )}
      {aba === CAREER_TAB.UPCOMING && (
        <Suspense fallback={<V2Skeleton lines={4} />}>
          <CareerUpcomingTab data={linhaDoTempo} save={rascunho.save} onOpenEvent={abrirFicha} onRegister={abrirRegistro} />
        </Suspense>
      )}
      {aba === CAREER_TAB.GOALS && (
        <Suspense fallback={<V2Skeleton lines={4} />}>
          <CareerGoalsTab data={linhaDoTempo} />
        </Suspense>
      )}
      {aba === CAREER_TAB.ACHIEVEMENTS && (
        <TrophyShelf uid={user?.uid} nome={userProfile?.platform_name || user?.displayName || ''} mine abaInicial={ABA_FORA} />
      )}

      <Suspense fallback={null}>
        {(registrar || repetir) && (
          <CareerQuickRegister
            open
            onOpenChange={(v) => { if (!v) { setRepetir(null); fechar('registrar'); } }}
            save={rascunho.save}
            events={linhaDoTempo.events}
            initial={repetir}
            onDetail={(ev) => { setRepetir(null); abrirFicha(ev.id, ev); }}
          />
        )}
        {eventoId && evento && (
          <CareerEventSheet
            open
            event={evento}
            // A exclusão pode ter tirado um rascunho da fila: a faixa relê. E a cópia local sai,
            // senão o Voltar reabriria (e deixaria salvar de novo) a ficha de um torneio excluído.
            onOpenChange={(v) => { if (!v) { rascunho.refresh(); setFichaLocal(null); fechar('evento'); } }}
            save={rascunho.save}
            myTournaments={linhaDoTempo.myTournaments}
            onRepeat={(ev) => { setRepetir(repeatEvent(ev)); setFichaLocal(null); fechar('evento'); }}
            saved={(linhaDoTempo.events || []).some((e) => e.id === evento.id)}
            partners={linhaDoTempo.partners}
            partnersError={linhaDoTempo.partnersError}
            onRetryPartners={linhaDoTempo.retryPartners}
            past={past}
          />
        )}
        {lista && <CareerListMode open onOpenChange={(v) => { if (!v) fechar('lista'); }} />}
      </Suspense>
      {/* Link para a ficha com a lista falhando: dizer por que ela não abriu (em qualquer aba). */}
      {eventoId && !evento && !linhaDoTempo.isPending && linhaDoTempo.events === undefined && (
        <V2ErrorState
          inline
          title={t('Não deu para abrir a ficha deste torneio')}
          description={t('Os torneios de fora não carregaram. A ficha continua lá — a conexão é que falhou.')}
          onRetry={linhaDoTempo.retry}
        />
      )}
    </V2Page>
  );
}

/**
 * A Carreira com a flag DESLIGADA: nada de registrar nem editar (a regra
 * recusa), mas o que já existe é da pessoa — ela apaga os registros e tira da
 * vitrine pública o que estava lá. Sem nada guardado, a página não existe.
 */
function CarreiraDesligada() {
  const { user } = useAuth();
  const eventsQ = useCareerEvents();
  const publicQ = useCareerPublic(user?.uid);
  const remover = useDeleteCareerEvent();
  const acao = useCareerPartnerAction();
  const [apagar, setApagar] = useState(null);

  if (eventsQ.isPending || publicQ.isPending) return <V2Page className="space-y-4"><V2Skeleton className="h-12" /><V2Skeleton className="h-64" /></V2Page>;
  const eventos = eventsQ.isSuccess ? eventsQ.data : undefined;
  const publicos = publicQ.isSuccess ? publicQ.data : undefined;
  // Só com as DUAS leituras certas dá para afirmar que não há nada (e sair da página).
  if (eventos && publicos && !eventos.length && !publicos.length) return <Navigate to="/perfil" replace />;

  async function excluir(ev) {
    try {
      await remover.mutateAsync(ev);
      toast.success(t('Torneio excluído.'));
      setApagar(null);
    } catch (err) {
      toast.error(err?.message || t('Não foi possível excluir. Tente de novo.'));
    }
  }
  async function tirar(doc) {
    try {
      await acao.mutateAsync({ action: 'unpublish', eventId: doc.event_id });
      toast.success(t('Tirado do seu perfil público.'));
    } catch (err) {
      toast.error(err?.message || t('Não foi possível tirar do perfil. Tente de novo.'));
    }
  }
  const linha = 'flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-gray-100 bg-paper-pure p-3';
  const data = (x) => careerDateLabel(x.start_date, x.date_precision);

  return (
    <V2Page className="space-y-6">
      <V2PageIntro
        title={t('Carreira')}
        subtitle={t('A Carreira está desligada no momento. O que você registrou continua guardado: aqui dá para apagar os registros e tirar do perfil público o que estava na vitrine.')}
      />
      <V2Surface as="section" variant="compacto" aria-labelledby="carreira-off-vitrine" className="space-y-3">
        <h2 id="carreira-off-vitrine" className="font-display text-base font-bold text-ink">{t('No seu perfil público')}</h2>
        {publicQ.isError || !publicos ? (
          <V2ErrorState inline title={t('A vitrine não carregou')} onRetry={() => publicQ.refetch()} />
        ) : publicos.length === 0 ? (
          <p className="text-sm text-gray-500">{t('Nenhum torneio seu está no perfil público.')}</p>
        ) : (
          <ul className="space-y-2">
            {publicos.map((d) => (
              <li key={d.id} className={linha}>
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-ink">{d.name}</span>
                  <span className="block text-xs text-gray-500">{data(d)}</span>
                </span>
                <V2Button type="button" size="sm" variant="secondary" disabled={acao.isPending} onClick={() => tirar(d)}>{t('Tirar do perfil')}</V2Button>
              </li>
            ))}
          </ul>
        )}
      </V2Surface>
      <V2Surface as="section" variant="compacto" aria-labelledby="carreira-off-registros" className="space-y-3">
        <h2 id="carreira-off-registros" className="font-display text-base font-bold text-ink">{t('Torneios registrados')}</h2>
        {eventsQ.isError || !eventos ? (
          <V2ErrorState inline title={t('Os seus registros não carregaram')} onRetry={() => eventsQ.refetch()} />
        ) : eventos.length === 0 ? (
          <p className="text-sm text-gray-500">{t('Nenhum registro guardado.')}</p>
        ) : (
          <ul className="space-y-2">
            {eventos.map((ev) => (
              <li key={ev.id} className={linha}>
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-ink">{ev.name}</span>
                  <span className="block text-xs text-gray-500">{data(ev)}</span>
                </span>
                {apagar === ev.id ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <span role="alert" className="text-xs text-gray-600">{t('Apaga o registro e as fotos dele. Não dá para desfazer.')}</span>
                    {/* O Cancelar fica onde estava o Excluir: toque duplo não apaga. */}
                    <V2Button type="button" size="sm" variant="ghost" autoFocus onClick={() => setApagar(null)}>{t('Cancelar')}</V2Button>
                    <V2Button type="button" size="sm" variant="danger" disabled={remover.isPending} onClick={() => excluir(ev)}>{t('Excluir de vez')}</V2Button>
                  </span>
                ) : (
                  <V2Button type="button" size="sm" variant="ghost" onClick={() => setApagar(ev.id)}>{t('Excluir')}</V2Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </V2Surface>
    </V2Page>
  );
}

export default function V2Career() {
  const { flags, isLoading } = useFeatureFlags();
  if (isLoading) return <V2Page className="space-y-4"><V2Skeleton className="h-12" /><V2Skeleton className="h-64" /></V2Page>;
  if (!flags?.[FEATURE_FLAG.ATHLETE_CAREER]) return <CarreiraDesligada />;
  return <Carreira />;
}
