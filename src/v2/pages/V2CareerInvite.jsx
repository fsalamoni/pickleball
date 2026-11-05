/**
 * `/carreira/convite/:token` — o link que a dupla SEM conta recebe pelo
 * WhatsApp (Carreira, PR 6, flag `athlete_career`, docs/54 §4.13).
 *
 * Duas portas, um arquivo (carregado só nesta rota):
 *  - sem conta: explica e leva a criar a conta ou entrar, com `?next=` de
 *    volta para este link (o redirecionamento do login de sempre); o token
 *    não sai da URL e nada é gravado;
 *  - com conta: o servidor confere o link (`invite_peek`, nada gravado) e,
 *    no toque em "Sou eu", preenche a dupla VAZIA do registro com a conta
 *    (`invite_accept`, uso único) e abre a confirmação de sempre
 *    (`/carreira?dupla=…`).
 *
 * Link usado, vencido, cancelado, inexistente — ou de quem não pode ser
 * convidado — recebe a MESMA mensagem: a resposta não serve de sonda.
 */
import React from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Handshake } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlags } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { careerAction } from '@/modules/career/services/careerService.js';
import { V2Button, V2ErrorState, V2Page, V2PageIntro, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { careerDateLabel } from '@/v2/components/career/careerUi';
import { t } from '@/core/i18n';

const NEUTRO = () => t('Este convite não vale mais. Peça um link novo a quem convidou.');

function Icone() {
  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-paper text-ink">
      <Handshake className="h-7 w-7" aria-hidden="true" />
    </div>
  );
}

/** Quem ainda não entrou: explica e leva ao login, voltando a este link. */
function SemConta() {
  const { pathname } = useLocation();
  const login = `/login?next=${encodeURIComponent(pathname)}`;
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <V2PageIntro
        title={t('Você foi convidado como dupla')}
        subtitle={t('Alguém registrou um torneio com você na carreira do PickleRush e quer que você confirme.')}
      />
      <V2Surface>
        <div className="flex flex-col items-center gap-4 text-center">
          <Icone />
          <p className="text-sm text-gray-600">
            {t('Crie a sua conta (ou entre, se já tem) e volte por este mesmo link. Aí você confirma se jogaram juntos — e, se quiser, põe o torneio na sua carreira também.')}
          </p>
          <V2Button asChild className="w-full sm:w-auto">
            <Link to={login}>{t('Criar conta ou entrar')}</Link>
          </V2Button>
          <p className="text-xs text-gray-500">{t('O link vale uma vez só e por pouco tempo. Ninguém recebe o seu telefone.')}</p>
        </div>
      </V2Surface>
    </div>
  );
}

/** Link aberto com a flag desligada por quem não entrou: nada a prometer. */
function Indisponivel() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <V2Surface>
        <div className="flex flex-col items-center gap-4 text-center">
          <Icone />
          <p className="text-sm text-gray-600">{t('Este link não está disponível agora.')}</p>
          <V2Button asChild variant="secondary"><Link to="/">{t('Ir para o PickleRush')}</Link></V2Button>
        </div>
      </V2Surface>
    </div>
  );
}

function ComConta({ token }) {
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  // Conta recém-criada chega aqui sem nascimento (o assistente de cadastro abre
  // por cima): o servidor trataria como menor e diria "não vale". Sem a data,
  // a tela pede o cadastro e só pergunta ao servidor quando ela existir — e a
  // chave inclui a data, para perguntar de novo assim que o cadastro é salvo.
  const nascimento = userProfile?.birth_date || '';
  const peek = useQuery({
    queryKey: ['career', 'invite-peek', token, user?.uid || '', nascimento],
    queryFn: () => careerAction('invite_peek', { token }),
    enabled: Boolean(nascimento),
    retry: false,
  });
  const aceitar = useMutation({
    mutationFn: () => careerAction('invite_accept', { token }),
    onSuccess: (r) => navigate(`/carreira?dupla=${encodeURIComponent(r.docId)}`, { replace: true }),
  });

  let corpo;
  if (!nascimento) {
    corpo = (
      <div className="flex flex-col items-center gap-4 text-center">
        <Icone />
        <p className="text-sm text-gray-600">{t('Complete o seu cadastro (data de nascimento) para aceitar o convite. Depois volte por este mesmo link.')}</p>
        <V2Button asChild variant="secondary"><Link to="/perfil">{t('Completar o cadastro')}</Link></V2Button>
      </div>
    );
  } else if (peek.isError) {
    corpo = <V2ErrorState inline title={t('Não deu para conferir o convite')} description={peek.error?.message} onRetry={() => peek.refetch()} />;
  } else if (!peek.isSuccess) {
    corpo = <V2Skeleton lines={3} />;
  } else if (!peek.data?.valid) {
    corpo = (
      <div className="flex flex-col items-center gap-4 text-center">
        <Icone />
        <p className="text-sm text-gray-600">{peek.data?.own ? t('Este convite é seu: mande o link para a sua dupla.') : NEUTRO()}</p>
        <V2Button asChild variant="secondary"><Link to="/carreira">{t('Abrir a Carreira')}</Link></V2Button>
      </div>
    );
  } else {
    const d = peek.data;
    corpo = (
      <div className="flex flex-col items-center gap-4 text-center">
        <Icone />
        <p className="text-sm text-gray-600">
          {t('{quem} registrou o {torneio} ({data}) com "{nome}" como dupla.', {
            quem: d.owner_name || t('Alguém'), torneio: d.event_name || t('torneio'), data: careerDateLabel(d.start_date, d.date_precision), nome: d.partner_name,
          })}
        </p>
        <p className="text-sm text-gray-600">{t('Se é você, a sua conta passa a ser a dupla deste torneio e você confirma o resultado em seguida.')}</p>
        {aceitar.isError && <p role="alert" className="text-sm font-semibold text-red-700">{aceitar.error?.message || NEUTRO()}</p>}
        <div className="flex flex-wrap justify-center gap-2">
          <V2Button type="button" disabled={aceitar.isPending || aceitar.isError} onClick={() => aceitar.mutate()}>{t('Sou eu, aceitar o convite')}</V2Button>
          <V2Button asChild variant="ghost"><Link to="/carreira">{t('Não sou eu')}</Link></V2Button>
        </div>
      </div>
    );
  }

  return (
    <V2Page className="space-y-6">
      <V2PageIntro title={t('Convite de dupla')} subtitle={t('Carreira')} />
      <V2Surface>{corpo}</V2Surface>
    </V2Page>
  );
}

export default function V2CareerInvite() {
  const { token } = useParams();
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const { flags, isLoading } = useFeatureFlags();
  if (isLoadingAuth) return null;
  if (isLoading) return isAuthenticated ? <V2Page className="space-y-4"><V2Skeleton className="h-12" /><V2Skeleton className="h-40" /></V2Page> : null;
  const ligada = Boolean(flags?.[FEATURE_FLAG.ATHLETE_CAREER]);
  if (!isAuthenticated) return ligada ? <SemConta /> : <Indisponivel />;
  if (!ligada) return <Navigate to="/perfil" replace />;
  return <ComConta token={String(token || '')} />;
}
