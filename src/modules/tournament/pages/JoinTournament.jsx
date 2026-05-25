import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
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
      navigate(`/torneios/${t.id}/inscritos?join=1`);
    } catch (err) {
      toast.error(err.message || 'Falha ao buscar torneio.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Ingressar em um torneio</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Código de convite</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Ex.: PB7K9X"
                maxLength={10}
                className="uppercase tracking-widest text-center text-lg"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Buscando…' : 'Continuar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
