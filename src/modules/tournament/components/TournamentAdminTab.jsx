import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { UserPlus, Trash2, Play, Lock, CheckCircle2 } from 'lucide-react';
import {
  useTournamentAdmins,
  useAddTournamentAdmin,
  useRemoveTournamentAdmin,
  useSetTournamentStatus,
} from '@/modules/tournament/hooks/useTournament';
import { TOURNAMENT_STATUS, TOURNAMENT_STATUS_LABELS, TOURNAMENT_ADMIN_ROLE } from '@/modules/tournament/domain/constants';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/core/config/firebase';

export default function TournamentAdminTab({ tournament }) {
  const { data: admins = [] } = useTournamentAdmins(tournament.id);
  const addMutation = useAddTournamentAdmin(tournament.id);
  const removeMutation = useRemoveTournamentAdmin(tournament.id);
  const statusMutation = useSetTournamentStatus(tournament.id);
  const [email, setEmail] = useState('');

  async function handleAddAdmin() {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    try {
      const q = query(collection(db, 'users'), where('email', '==', trimmed));
      const snap = await getDocs(q);
      if (snap.empty) {
        toast.error('Usuário não encontrado. Peça para a pessoa fazer login uma vez na plataforma.');
        return;
      }
      const data = snap.docs[0].data();
      await addMutation.mutateAsync({ uid: data.uid, email: data.email, displayName: data.platform_name || data.full_name });
      toast.success('Admin adicionado.');
      setEmail('');
    } catch (err) {
      toast.error(err.message || 'Falha ao adicionar.');
    }
  }

  async function setStatus(s) {
    try {
      await statusMutation.mutateAsync(s);
      toast.success('Status atualizado.');
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <h4 className="font-semibold">Status do torneio</h4>
          <p className="text-sm text-slate-600">
            Atual: <Badge variant="secondary">{TOURNAMENT_STATUS_LABELS[tournament.status]}</Badge>
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setStatus(TOURNAMENT_STATUS.REGISTRATIONS_OPEN)}>
              <Play className="w-4 h-4 mr-1" /> Abrir inscrições
            </Button>
            <Button size="sm" variant="outline" onClick={() => setStatus(TOURNAMENT_STATUS.REGISTRATIONS_CLOSED)}>
              <Lock className="w-4 h-4 mr-1" /> Encerrar inscrições
            </Button>
            <Button size="sm" variant="outline" onClick={() => setStatus(TOURNAMENT_STATUS.IN_PROGRESS)}>
              Iniciar
            </Button>
            <Button size="sm" variant="outline" onClick={() => setStatus(TOURNAMENT_STATUS.FINISHED)}>
              <CheckCircle2 className="w-4 h-4 mr-1" /> Encerrar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h4 className="font-semibold">Admins do torneio</h4>
          <p className="text-xs text-slate-500">
            O criador é admin permanente. Outros admins compartilham todas as funções de gestão deste torneio
            (não afeta o admin geral da plataforma).
          </p>
          <ul className="text-sm space-y-1">
            {admins.map((a) => (
              <li key={a.user_id} className="flex items-center justify-between">
                <span>
                  {a.user_name || a.user_email}{' '}
                  <Badge variant="secondary" className="ml-1">
                    {a.role === TOURNAMENT_ADMIN_ROLE.OWNER ? 'Owner' : 'Admin'}
                  </Badge>
                </span>
                {a.role !== TOURNAMENT_ADMIN_ROLE.OWNER && (
                  <Button size="icon" variant="ghost" onClick={() => removeMutation.mutate(a.user_id)}>
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <div className="space-y-2">
            <Label>Adicionar admin (e-mail do usuário já cadastrado)</Label>
            <div className="flex gap-2">
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@dominio.com" type="email" />
              <Button onClick={handleAddAdmin} disabled={addMutation.isPending}>
                <UserPlus className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
