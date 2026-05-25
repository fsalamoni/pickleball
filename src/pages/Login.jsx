import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Trophy } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function Login() {
  const { signInWithGoogle, isAuthenticated, isLoadingAuth, authError } = useAuth();
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard');
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
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mb-2">
            <Trophy className="w-6 h-6 text-emerald-700" />
          </div>
          <CardTitle>Entrar no Pickleball</CardTitle>
          <CardDescription>Use sua conta Google para acessar.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={onClick} disabled={busy} className="w-full h-11" size="lg">
            <GoogleIcon className="w-4 h-4" />
            {busy ? 'Conectando…' : 'Continuar com Google'}
          </Button>
          <p className="text-xs text-center text-slate-500">
            Ao continuar você aceita nossa{' '}
            <Link to="/politica-uso" className="underline">Política de Uso</Link>
            {' '}e o{' '}
            <Link to="/conduta" className="underline">Conduta &amp; Fair Play</Link>.
          </p>
        </CardContent>
      </Card>
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
