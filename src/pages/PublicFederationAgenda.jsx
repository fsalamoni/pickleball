/**
 * PublicFederationAgenda — o calendário oficial da federação, sem login:
 * `/f/:slug/agenda` (próximos e anteriores, assinar, compartilhar) e
 * `/f/:slug/agenda/:eventId` (o evento). Quem tem conta e é filiado ou da
 * equipe vê também o que é só para filiados ou para a equipe.
 *
 * Falha de rede não vira "não existe". Evento que a pessoa não pode ler e
 * evento que não existe dão a MESMA resposta da regra: a tela diz as duas
 * possibilidades, sem afirmar nenhuma.
 */
import React from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { CalendarDays, Landmark, Lock } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlags } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useDocumentMeta } from '@/core/seo/useDocumentMeta';
import { useFederationBySlug, useFederationEvent } from '@/modules/federations/hooks/useFederations';
import { agendaPublicPath } from '@/modules/federations/domain/agenda';
import { fedModuleOn } from '@/modules/federations/domain/federation';
import { FedLogo, fedPublicPath } from '@/v2/components/federations/federationUi';
import { AgendaBrowser } from '@/v2/components/federations/agenda/AgendaPublic';
import AgendaEventView from '@/v2/components/federations/agenda/AgendaEventView';
import { V2ErrorState, V2Skeleton } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';

function Aviso({ icone: Icone = Landmark, titulo, texto, acao }) {
  return (
    <div className="rounded-4xl border border-gray-100 bg-paper-pure p-8 text-center">
      <Icone className="mx-auto h-10 w-10 text-gray-500" aria-hidden="true" />
      <h1 className="mt-3 font-display text-2xl font-bold text-ink">{titulo}</h1>
      <p className="mt-2 text-sm text-gray-500">{texto}</p>
      {acao}
    </div>
  );
}

const botao = 'mt-4 inline-flex rounded-full bg-ink px-6 py-3 text-sm font-bold text-white';

function Evento({ federation, eventId }) {
  const { isAuthenticated } = useAuth();
  const eq = useFederationEvent(eventId);
  const ev = eq.data && eq.data.federation_id === federation.id ? eq.data : null;
  useDocumentMeta({ title: ev ? ev.title : t('Calendário oficial'), description: ev?.description?.slice(0, 160) || '' }, Boolean(ev));
  if (eq.isLoading) return <V2Skeleton lines={8} />;
  const negado = eq.isError && eq.error?.code === 'permission-denied';
  if (eq.isError && !negado) return <V2ErrorState title={t('Não carregou o evento')} description={t('A conexão falhou no meio do caminho. O link continua valendo.')} onRetry={() => eq.refetch()} />;
  if (!ev) {
    const voltar = <Link to={agendaPublicPath(federation)} className={botao}>{t('Ver a agenda')}</Link>;
    return (
      <Aviso
        icone={Lock}
        titulo={t('Evento indisponível')}
        texto={isAuthenticated
          ? t('Ele pode ser só para filiados ou para a equipe da federação, ter sido retirado da agenda, ou o link pode estar errado.')
          : t('Ele pode ser só para filiados ou para a equipe — entre na sua conta para ver —, ter sido retirado da agenda, ou o link pode estar errado.')}
        acao={isAuthenticated ? voltar : <Link to={`/login?next=${encodeURIComponent(window.location.pathname)}`} className={botao}>{t('Entrar')}</Link>}
      />
    );
  }
  return <AgendaEventView federation={federation} ev={ev} />;
}

export default function PublicFederationAgenda() {
  const { slug, eventId } = useParams();
  const { flags, isLoading: flagsLoading } = useFeatureFlags();
  const ligada = Boolean(flags?.[FEATURE_FLAG.FEDERATIONS]);
  const fq = useFederationBySlug(ligada ? slug : null);
  const f = fq.data;
  useDocumentMeta({ title: f ? t('Calendário oficial — {federacao}', { federacao: f.name }) : t('Calendário oficial'), description: f ? t('Competições, assembleias, reuniões e eventos da {federacao}.', { federacao: f.name }) : '' }, Boolean(f) && !eventId);

  if (!flagsLoading && !ligada) return <Navigate to="/" replace />;
  return (
    <div className="min-h-screen bg-paper print:bg-white">
      <div className="mx-auto max-w-[880px] space-y-6 px-4 py-10 print:py-0">
        {flagsLoading || fq.isLoading ? <V2Skeleton lines={6} /> : fq.isError ? (
          <V2ErrorState title={t('Não foi possível carregar a federação')} description={t('A conexão falhou no meio do caminho. O link continua valendo.')} onRetry={() => fq.refetch()} />
        ) : !f ? (
          <Aviso titulo={t('Federação não encontrada')} texto={t('O endereço pode estar errado, ou a federação ainda não está aberta ao público.')} acao={<Link to="/" className={botao}>{t('Ir para o PickleRush')}</Link>} />
        ) : !fedModuleOn(f, 'calendar') ? (
          <Aviso icone={CalendarDays} titulo={t('Agenda não disponível')} texto={t('Esta federação não publica o calendário oficial pela plataforma.')} acao={<Link to={fedPublicPath(f)} className={botao}>{t('Ver a federação')}</Link>} />
        ) : (
          <>
            <Link to={fedPublicPath(f)} className="flex items-center gap-3 print:hidden">
              <FedLogo federation={f} size="md" />
              <span className="min-w-0">
                <span className="block text-xs font-bold uppercase tracking-wider text-gray-500">{t('Calendário oficial')}</span>
                <span className="block truncate font-display text-xl font-bold text-ink">{f.name}</span>
              </span>
            </Link>
            {eventId ? <Evento federation={f} eventId={eventId} /> : <AgendaBrowser federation={f} />}
          </>
        )}
      </div>
    </div>
  );
}
