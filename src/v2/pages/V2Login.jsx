import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowRight, Mail, Lock, User as UserIcon, Sparkles, Trophy } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { V2Button } from '@/v2/ui/primitives';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const LOGIN_HIGHLIGHTS = [
  'Acesse torneios, ranking e ferramentas com menos atrito.',
  'Mantenha a identidade do evento consistente do convite ao resultado final.',
  'Use uma interface mais clara para operar no balcão, no desktop e na quadra.',
];

export default function Login() {
  const {
    signInWithGoogle,
    signInWithApple,
    signInWithEmailPassword,
    registerWithEmailPassword,
    sendPasswordReset,
    isAuthenticated,
    isLoadingAuth,
    authError,
    isAuthAvailable,
    isGoogleAvailable,
    isAppleAvailable,
    authUnavailableReason,
  } = useAuth();
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) navigate('/');
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (authError?.message) toast.error(authError.message);
  }, [authError]);

  const runBusy = async (fn) => {
    setBusy(true);
    try {
      await fn();
    } catch {
      // erros são tratados pelo effect de authError
    } finally {
      setBusy(false);
    }
  };

  const onGoogle = () => runBusy(() => signInWithGoogle());
  const onApple = () => runBusy(() => signInWithApple());

  const onEmailSubmit = (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error('Informe e-mail e senha.');
      return;
    }
    if (mode === 'signup' && password.length < 6) {
      toast.error('A senha precisa ter ao menos 6 caracteres.');
      return;
    }
    return runBusy(async () => {
      if (mode === 'signup') {
        await registerWithEmailPassword(email, password, name);
        toast.success('Conta criada! Bem-vindo(a).');
      } else {
        await signInWithEmailPassword(email, password);
      }
      // O redirecionamento acontece no effect de isAuthenticated.
    });
  };

  const onForgotPassword = async () => {
    if (!email.trim()) {
      toast.error('Digite seu e-mail acima para receber o link de redefinição.');
      return;
    }
    await runBusy(async () => {
      await sendPasswordReset(email);
      toast.success('Enviamos um e-mail para redefinir sua senha.');
    });
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
                {mode === 'signup' ? 'Crie sua conta para começar.' : 'Entre para publicar e operar torneios.'}
              </h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-gray-500">
                Use e-mail e senha, sua conta Google ou Apple. O e-mail da sua conta vincula automaticamente
                as inscrições e resultados registrados provisoriamente com o mesmo e-mail.
              </p>
            </div>

            <div className="mt-8 space-y-5">
              {/* Provedores sociais */}
              <div className="grid gap-3">
                {isGoogleAvailable && (
                  <V2Button onClick={onGoogle} disabled={busy || !isAuthAvailable} variant="ghost" size="lg" className="w-full">
                    <GoogleIcon className="h-4 w-4" />
                    <span>Continuar com Google</span>
                  </V2Button>
                )}
                {isAppleAvailable && (
                  <V2Button onClick={onApple} disabled={busy || !isAuthAvailable} variant="ghost" size="lg" className="w-full">
                    <AppleIcon className="h-4 w-4" />
                    <span>Continuar com Apple</span>
                  </V2Button>
                )}
              </div>

              {(isGoogleAvailable || isAppleAvailable) && isAuthAvailable && (
                <div className="flex items-center gap-3 text-xs font-medium uppercase tracking-widest text-gray-300">
                  <span className="h-px flex-1 bg-gray-100" />ou<span className="h-px flex-1 bg-gray-100" />
                </div>
              )}

              {/* E-mail e senha */}
              <form onSubmit={onEmailSubmit} className="space-y-4">
                {mode === 'signup' && (
                  <div className="space-y-1.5">
                    <Label htmlFor="login-name">Nome</Label>
                    <div className="relative">
                      <UserIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <Input
                        id="login-name"
                        type="text"
                        autoComplete="name"
                        placeholder="Seu nome"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="pl-9"
                        disabled={busy || !isAuthAvailable}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="login-email">E-mail</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                      id="login-email"
                      type="email"
                      autoComplete="email"
                      placeholder="voce@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-9"
                      disabled={busy || !isAuthAvailable}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="login-password">Senha</Label>
                    {mode === 'signin' && (
                      <button
                        type="button"
                        onClick={onForgotPassword}
                        disabled={busy || !isAuthAvailable}
                        className="text-xs font-bold text-ink transition-colors hover:text-acid-dark disabled:opacity-50"
                      >
                        Esqueci minha senha
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                      id="login-password"
                      type="password"
                      autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                      placeholder={mode === 'signup' ? 'Mínimo de 6 caracteres' : 'Sua senha'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-9"
                      disabled={busy || !isAuthAvailable}
                      required
                    />
                  </div>
                </div>

                <V2Button type="submit" disabled={busy || !isAuthAvailable} size="lg" className="w-full">
                  {busy
                    ? 'Conectando…'
                    : mode === 'signup' ? 'Criar conta' : 'Entrar'}
                  <ArrowRight className="h-4 w-4" />
                </V2Button>
              </form>

              {!isAuthAvailable && (
                <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                  {authUnavailableReason || 'Configure o Firebase para habilitar autenticação e dados em tempo real.'}
                </p>
              )}

              <p className="text-center text-sm text-gray-500">
                {mode === 'signup' ? 'Já tem conta?' : 'Ainda não tem conta?'}{' '}
                <button
                  type="button"
                  onClick={() => setMode(mode === 'signup' ? 'signin' : 'signup')}
                  className="font-bold text-ink transition-colors hover:text-acid-dark"
                >
                  {mode === 'signup' ? 'Entrar' : 'Criar conta'}
                </button>
              </p>

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

function AppleIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <path d="M16.365 1.43c0 1.14-.42 2.22-1.19 3.02-.83.87-2.2 1.55-3.29 1.46-.13-1.1.44-2.28 1.16-3.03.8-.85 2.24-1.5 3.32-1.45zM20.9 17.09c-.55 1.27-.81 1.83-1.52 2.95-.99 1.56-2.38 3.5-4.11 3.51-1.53.02-1.93-.99-4.02-.98-2.09.01-2.52 1-4.06.97-1.72-.01-3.04-1.76-4.03-3.32C.4 15.55-.16 10.66 1.66 8.14c.86-1.22 2.22-1.99 3.5-1.99 1.31 0 2.13.86 3.21.86 1.05 0 1.69-.86 3.21-.86 1.14 0 2.35.62 3.21 1.69-2.82 1.55-2.36 5.58.11 6.65-.42.99-.71 1.51-1.21 2.6z"/>
    </svg>
  );
}
