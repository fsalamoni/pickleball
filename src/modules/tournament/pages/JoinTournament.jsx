import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Hash, Globe, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { getTournamentByInviteCode } from '@/modules/tournament/services/tournamentService';

export default function JoinTournament() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

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
    <div className="max-w-md mx-auto space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-md bg-emerald-100 flex items-center justify-center shrink-0">
              <Hash className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <CardTitle className="text-lg">Ingressar com código</CardTitle>
              <CardDescription>
                Informe o código de 6 caracteres que você recebeu do organizador do torneio privado.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
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
                className="uppercase tracking-[0.4em] text-center text-xl font-semibold"
              />
              <p className="text-xs text-slate-500">
                O código é distinto de senha — qualquer pessoa com ele pode acessar o torneio.
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={loading || !code.trim()}>
              {loading ? 'Buscando…' : 'Continuar'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="bg-emerald-50/40 border-emerald-200">
        <CardContent className="p-4 flex items-start gap-3 text-sm text-slate-700">
          <Globe className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-slate-900">Procurando torneios abertos?</p>
            <p className="mt-0.5">
              Torneios públicos não exigem código.{' '}
              <Link to="/torneios/publicos" className="text-emerald-700 underline">
                Veja a lista de torneios públicos
              </Link>{' '}
              ou{' '}
              <Link to="/torneios/criar" className="text-emerald-700 underline">
                crie o seu
              </Link>
              .
            </p>
          </div>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-slate-500 flex items-center justify-center gap-1">
        <Trophy className="w-3 h-3" /> Plataforma Pickleball
      </p>
    </div>
  );
}
