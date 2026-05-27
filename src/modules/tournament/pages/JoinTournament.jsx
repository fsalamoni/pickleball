import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { ArrowRight, Hash } from 'lucide-react';
import { toast } from 'sonner';
import { getTournamentByInviteCode } from '@/modules/tournament/services/tournamentService';

export default function JoinTournament() {
  const navigate = useNavigate();
  const { isAuthAvailable, authUnavailableReason } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const isPreviewMode = import.meta.env.DEV && !isAuthAvailable;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    try {
      const t = await getTournamentByInviteCode(code.trim());
      if (!t) {
        toast.error('Código não encontrado.');
        return;
      }
      sessionStorage.setItem(`tournament_access_${t.id}`, code.trim().toUpperCase());
      toast.success(`Acesso concedido a "${t.name}".`);
      navigate(`/torneios/${t.id}/visao-geral?join=1`);
    } catch (err) {
      toast.error(err.message || 'Falha ao buscar torneio.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <Card className="rounded-[2rem] border-white/80 bg-white/82">
        <CardHeader className="px-6 pb-2 pt-6 sm:px-7">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 shrink-0">
              <Hash className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-2xl text-slate-950">Ingressar com código</CardTitle>
              <CardDescription className="mt-1 text-sm leading-6 text-slate-600">
                Informe o código que você recebeu do organizador para liberar o acesso ao torneio privado.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-6 pb-6 pt-4 sm:px-7">
          <form onSubmit={handleSubmit} className="space-y-5">
            {isPreviewMode && (
              <div className="rounded-[1.35rem] border border-amber-300/70 bg-amber-50/85 p-4 text-sm leading-6 text-amber-950">
                Prévia local sem Firebase: a busca pelo código fica desabilitada neste ambiente.
                {authUnavailableReason ? ` ${authUnavailableReason}` : ''}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="invite_code">Código de convite</Label>
              <Input
                id="invite_code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Ex.: PB7K9X"
                maxLength={10}
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                className="h-14 rounded-[1.25rem] uppercase tracking-[0.35em] text-center text-2xl font-semibold"
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading || !code.trim() || isPreviewMode}>
              {loading ? 'Buscando…' : isPreviewMode ? 'Validação indisponível no preview' : 'Continuar para o torneio'}
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>

            <p className="text-center text-sm text-slate-600">
              Procurando torneios abertos?{' '}
              <Link to="/torneios/publicos" className="text-emerald-700 underline underline-offset-4">
                Ver torneios públicos
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
