import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowRight, Sparkles, Trophy } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { V2Button } from '@/v2/ui/primitives';

const LOGIN_HIGHLIGHTS = [
  'Acesse torneios, ranking e ferramentas com menos atrito.',
  'Mantenha a identidade do evento consistente do convite ao resultado final.',
  'Use uma interface mais clara para operar no balcão, no desktop e na quadra.',
];

export default function Login() {
  const { signInWithGoogle, isAuthenticated, isLoadingAuth, authError, isAuthAvailable, authUnavailableReason } = useAuth();
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) navigate('/');
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (authError?.message) toast.error(authError.message);
  }, [authError]);

  const onClick = async () => {
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch {
      // tratado pelo authError effect
    } finally {
      setBusy(false);
    }
  };

  if (isLoadingAuth) return null;

  return (
    <div className="v2-root relative min-h-screen overflow-hidden bg-paper font-inter text-ink">
      <div className="relative mx-auto grid min-h-screen max-w-6xl gap-8 px-6 py-8 lg:grid-cols-[1.05fr,0.95fr] lg:items-center">
        {/* Painel escuro (branding) */}
        <div className="relative hidden h-full min-h-[42rem] flex-col justify-between overflow-hidden rounded-4xl bg-mesh p-10 shadow-organic lg:flex">
          <div className="absolute -right-10 -top-10 h-56 w-56 rounded-full bg-acid opacity-20 blur-[80px]" />
          <div className="relative z-10">
            <Link to="/" className="inline-flex items-center gap-3">
              <img src="/logo-escuro.png" alt="PickleRush" className="h-11 w-auto object-contain object-left" />
              <span className="font-display text-2xl font-bold tracking-tight text-white">PickleRush</span>
            </Link>
          </div>

          <div className="relative z-10">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-acid">
              <Sparkles className="h-3.5 w-3.5" /> Entrada principal da plataforma
            </span>
            <h1 className="mt-6 font-display text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-5xl">
              Entre para criar, administrar e acompanhar cada modalidade do seu torneio.
            </h1>

            <div className="mt-8 grid gap-3">
              {LOGIN_HIGHLIGHTS.map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-white/70 backdrop-blur-sm">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-10 flex flex-wrap gap-4 text-sm text-white/60">
            <Link to="/regras" className="transition-colors hover:text-acid">Regras oficiais</Link>
            <Link to="/nivelamento" className="transition-colors hover:text-acid">Nivelamento</Link>
            <Link to="/conduta" className="transition-colors hover:text-acid">Fair Play</Link>
          </div>
        </div>

        {/* Cartão de login */}
        <div className="flex items-center justify-center">
          <div className="w-full max-w-lg rounded-4xl border border-gray-100 bg-paper-pure p-6 shadow-organic sm:p-8">
            <div className="text-center">
              <Link to="/" className="mx-auto mb-6 inline-flex items-center gap-3 lg:hidden">
                <img src="/logo-claro.png" alt="PickleRush" className="h-8 w-auto object-contain" />
                <span className="font-display text-xl font-bold tracking-tight text-ink">PickleRush</span>
              </Link>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-ink text-acid shadow-glow">
                <Trophy className="h-6 w-6" />
              </div>
              <h2 className="mt-6 font-display text-3xl font-bold leading-tight text-ink">
                Entrar para publicar e operar torneios com mais confiança.
              </h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-gray-500">
                Use sua conta Google para acessar a plataforma e manter inscrições, modalidades e resultados sob controle.
              </p>
            </div>

            <div className="mt-8 space-y-5">
              <V2Button onClick={onClick} disabled={busy || !isAuthAvailable} size="lg" className="w-full">
                <GoogleIcon className="h-4 w-4" />
                {busy ? (
                  'Conectando…'
                ) : isAuthAvailable ? (
                  <>
                    <span className="sm:hidden">Continuar</span>
                    <span className="hidden sm:inline">Continuar com Google</span>
                  </>
                ) : (
                  <>
                    <span className="sm:hidden">Login indisponível</span>
                    <span className="hidden sm:inline">Login indisponível neste ambiente</span>
                  </>
                )}
                <ArrowRight className="h-4 w-4" />
              </V2Button>

              {!isAuthAvailable && (
                <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                  {authUnavailableReason || 'Configure o Firebase para habilitar autenticação e dados em tempo real.'}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <Link to="/regras" className="font-bold text-ink transition-colors hover:text-acid-dark">Conhecer as regras</Link>
                <Link to="/nivelamento" className="font-bold text-ink transition-colors hover:text-acid-dark">Ver nivelamento</Link>
              </div>

              <p className="text-center text-xs leading-6 text-gray-400">
                Ao continuar você aceita nossa{' '}
                <Link to="/politica-uso" className="font-bold text-gray-600 underline underline-offset-4">Política de Uso</Link>
                {' '}e o{' '}
                <Link to="/conduta" className="font-bold text-gray-600 underline underline-offset-4">Conduta &amp; Fair Play</Link>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}
