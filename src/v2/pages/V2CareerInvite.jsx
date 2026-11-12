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
import React, { useRef } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Handshake } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlags } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { careerAction } from '@/modules/career/services/careerService.js';
import { V2Button, V2ErrorState, V2Page, V2PageIntro, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { careerDateLabel } from '@/v2/components/career/careerUi';
import BrandMark from '@/v2/ui/BrandMark';
import { t } from '@/core/i18n';

const NEUTRO = () => t('Este convite não vale mais. Peça um link novo a quem convidou.');

function Icone() {
  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-paper text-ink">
      <Handshake className="h-7 w-7" aria-hidden="true" />
    </div>
  );
}

/**
 * Moldura de quem chega SEM login: a rota é desenhada fora do V2Layout, então
 * a marca, o fundo e a fonte (escopada a `.v2-root`) vêm daqui.
 */
function ConviteMoldura({ children }) {
  return (
    <div className="v2-root min-h-screen bg-paper font-inter text-ink">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <Link to="/" className="mb-8 inline-flex items-center gap-2.5 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ink">
          <BrandMark className="h-8 w-auto" alt="" />
          <span className="font-display text-xl font-bold tracking-tight text-ink">PickleRush</span>
        </Link>
        {children}
      </div>
    </div>
  );
}

/** Quem ainda não entrou: explica e leva ao login, voltando a este link. */
function SemConta() {
  const { pathname } = useLocation();
  const login = `/login?next=${encodeURIComponent(pathname)}`;
  return (
    <ConviteMoldura>
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
    </ConviteMoldura>
  );
}

/** Link aberto com a flag desligada por quem não entrou: nada a prometer. */
function Indisponivel() {
  return (
    <ConviteMoldura>
      <V2Surface>
        <div className="flex flex-col items-center gap-4 text-center">
          <Icone />
          <p className="text-sm text-gray-600">{t('Este link não está disponível agora.')}</p>
          <V2Button asChild variant="secondary"><Link to="/">{t('Ir para o PickleRush')}</Link></V2Button>
        </div>
      </V2Surface>
    </ConviteMoldura>
  );
}

function ComConta({ token }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, userProfile, signOut } = useAuth();
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
  // Uma tentativa caiu sem resposta: o aceite PODE ter passado (o convite é de uso único),
  // e aí a recusa seguinte não quer dizer que falhou.
  const incerto = useRef(false);
  const aceitar = useMutation({
    mutationFn: () => careerAction('invite_accept', { token }),
    onError: (err) => { if (!String(err?.code || '').endsWith('failed-precondition')) incerto.current = true; },
    onSuccess: (r) => {
      // A Carreira pode estar em cache (60 s): sem isto o pedido novo não aparece na caixa.
      qc.invalidateQueries({ queryKey: ['career'] });
      navigate(`/carreira?dupla=${encodeURIComponent(r.docId)}`, { replace: true });
    },
  });
  // Recusa do servidor (link morto, convite próprio) não muda tentando de novo; queda de rede, sim.
  const definitivo = String(aceitar.error?.code || '').endsWith('failed-precondition');

  let corpo;
  if (!nascimento) {
    corpo = (
      <div className="flex flex-col items-center gap-4 text-center">
        <Icone />
        <p className="text-sm text-gray-600">{t('Preencha a sua data de nascimento no cadastro. Assim que salvar, o convite aparece aqui.')} {t('Se for completar pelo perfil, volte por este mesmo link depois.')}</p>
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
    const vars = { quem: d.owner_name || t('Alguém'), torneio: d.event_name || t('torneio'), data: careerDateLabel(d.start_date, d.date_precision), nome: d.partner_name };
    const conta = userProfile?.platform_name || userProfile?.full_name || '';
    corpo = (
      <div className="flex flex-col items-center gap-4 text-center">
        <Icone />
        <p className="text-sm text-gray-600">
          {vars.data
            ? t('{quem} registrou o {torneio} ({data}) com "{nome}" como dupla.', vars)
            : t('{quem} registrou o {torneio} com "{nome}" como dupla.', vars)}
        </p>
        <p className="text-sm text-gray-600">{t('Se é você, a sua conta passa a ser a dupla deste torneio e você confirma o resultado em seguida.')}</p>
        {aceitar.isError && (
          <p role="alert" className="text-sm font-semibold text-red-700">
            {definitivo && incerto.current
              ? t('Se o aceite já tinha passado na tentativa anterior, o torneio está na sua Carreira. Se não estiver, peça um link novo a quem convidou.')
              : aceitar.error?.message || NEUTRO()}
          </p>
        )}
        <div className="flex flex-wrap justify-center gap-2">
          <V2Button type="button" disabled={aceitar.isPending || definitivo} onClick={() => aceitar.mutate()}>
            {aceitar.isPending ? t('Aceitando…') : aceitar.isError && !definitivo ? t('Tentar de novo') : t('Sou eu, aceitar o convite')}
          </V2Button>
          <V2Button asChild variant="ghost"><Link to="/carreira">{definitivo && incerto.current ? t('Abrir a Carreira') : t('Não sou eu')}</Link></V2Button>
        </div>
        {/* O aceite não troca de conta depois: dizer QUAL conta está aceitando. Deslogado nesta URL, a tela de "sem conta" volta para cá. */}
        <p className="text-xs text-gray-500">
          {conta ? t('Você entrou como {nome}.', { nome: conta }) : t('Você entrou com a sua conta.')}{' '}
          <button type="button" onClick={() => Promise.resolve(signOut()).catch(() => toast.error(t('Não foi possível concluir. Tente de novo.')))} className="inline-flex items-center rounded font-semibold text-ink underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ink coarse:min-h-11">
            {t('Não é você? Trocar de conta')}
          </button>
        </p>
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
