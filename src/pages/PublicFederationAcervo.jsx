/**
 * PublicFederationAcervo — o acervo oficial da federação, sem login:
 * `/f/:slug/acervo` (mural, documentos, transparência) e
 * `/f/:slug/acervo/:docId` (o documento). Quem tem conta e é filiado ou da
 * equipe vê também o que é só para filiados ou para a equipe.
 *
 * Falha de rede não vira "não existe". Documento que a pessoa não pode ler
 * e documento que não existe dão a MESMA resposta da regra (permissão
 * negada): a tela diz as duas possibilidades, sem afirmar nenhuma.
 */
import React from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Landmark, Lock } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlags } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useDocumentMeta } from '@/core/seo/useDocumentMeta';
import { useFederationBySlug, useOfficialDoc, useVisibleAcervo } from '@/modules/federations/hooks/useFederations';
import { DOC_STATUS, acervoPublicPath, docDisplayTitle } from '@/modules/federations/domain/acervo';
import { fedModuleOn } from '@/modules/federations/domain/federation';
import { FedLogo, fedPublicPath } from '@/v2/components/federations/federationUi';
import { AcervoBrowser } from '@/v2/components/federations/acervo/AcervoPublic';
import AcervoDocView from '@/v2/components/federations/acervo/AcervoDocView';
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

function Documento({ federation, docId }) {
  const { isAuthenticated } = useAuth();
  const dq = useOfficialDoc(docId);
  const lista = useVisibleAcervo(federation);
  const doc = dq.data && dq.data.federation_id === federation.id && dq.data.status === DOC_STATUS.PUBLISHED ? dq.data : null;
  useDocumentMeta({ title: doc ? docDisplayTitle(doc) : t('Acervo oficial'), description: doc?.summary || '' }, Boolean(doc));
  if (dq.isLoading) return <V2Skeleton lines={8} />;
  const negado = dq.isError && dq.error?.code === 'permission-denied';
  if (dq.isError && !negado) return <V2ErrorState title={t('Não carregou o documento')} description={t('A conexão falhou no meio do caminho. O link continua valendo.')} onRetry={() => dq.refetch()} />;
  if (!doc) {
    const voltar = <Link to={acervoPublicPath(federation)} className={botao}>{t('Ver o acervo')}</Link>;
    return (
      <Aviso
        icone={Lock}
        titulo={t('Documento indisponível')}
        texto={isAuthenticated
          ? t('Ele pode ser só para filiados ou para a equipe da federação, ter saído do ar, ou o link pode estar errado.')
          : t('Ele pode ser só para filiados ou para a equipe — entre na sua conta para ver —, ter saído do ar, ou o link pode estar errado.')}
        acao={isAuthenticated ? voltar : <Link to={`/login?next=${encodeURIComponent(window.location.pathname)}`} className={botao}>{t('Entrar')}</Link>}
      />
    );
  }
  return <AcervoDocView federation={federation} doc={doc} relacionados={lista.docs || []} />;
}

export default function PublicFederationAcervo() {
  const { slug, docId } = useParams();
  const { flags, isLoading: flagsLoading } = useFeatureFlags();
  const ligada = Boolean(flags?.[FEATURE_FLAG.FEDERATIONS]);
  const fq = useFederationBySlug(ligada ? slug : null);
  const f = fq.data;
  useDocumentMeta({ title: f ? t('Acervo oficial — {federacao}', { federacao: f.name }) : t('Acervo oficial'), description: f ? t('Normas, regulamentos, atos, atas e transparência da {federacao}.', { federacao: f.name }) : '' }, Boolean(f) && !docId);

  if (!flagsLoading && !ligada) return <Navigate to="/" replace />;
  return (
    <div className="min-h-screen bg-paper print:bg-white">
      <div className="mx-auto max-w-[880px] space-y-6 px-4 py-10 print:py-0">
        {flagsLoading || fq.isLoading ? <V2Skeleton lines={6} /> : fq.isError ? (
          <V2ErrorState title={t('Não foi possível carregar a federação')} description={t('A conexão falhou no meio do caminho. O link continua valendo.')} onRetry={() => fq.refetch()} />
        ) : !f ? (
          <Aviso titulo={t('Federação não encontrada')} texto={t('O endereço pode estar errado, ou a federação ainda não está aberta ao público.')} acao={<Link to="/" className={botao}>{t('Ir para o PickleRush')}</Link>} />
        ) : !fedModuleOn(f, 'official_docs') ? (
          <Aviso titulo={t('Acervo não disponível')} texto={t('Esta federação não publica o acervo oficial pela plataforma.')} acao={<Link to={fedPublicPath(f)} className={botao}>{t('Ver a federação')}</Link>} />
        ) : (
          <>
            <Link to={fedPublicPath(f)} className="flex items-center gap-3 print:hidden">
              <FedLogo federation={f} size="md" />
              <span className="min-w-0">
                <span className="block text-xs font-bold uppercase tracking-wider text-gray-500">{t('Acervo oficial')}</span>
                <span className="block truncate font-display text-xl font-bold text-ink">{f.name}</span>
              </span>
            </Link>
            {docId ? <Documento federation={f} docId={docId} /> : <AcervoBrowser federation={f} />}
          </>
        )}
      </div>
    </div>
  );
}
