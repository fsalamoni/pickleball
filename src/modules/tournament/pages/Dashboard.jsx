import React from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Plus, Hash, Users, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useMyTournaments } from '@/modules/tournament/hooks/useTournament';
import { TOURNAMENT_STATUS_LABELS } from '@/modules/tournament/domain/constants';

export default function Dashboard() {
  const { data: tournaments, isLoading } = useMyTournaments();

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold arena-heading">Meus torneios</h1>
          <p className="text-sm text-slate-600">Torneios que você administra ou está inscrito.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link to="/torneios/criar">
              <Plus className="w-4 h-4 mr-1" /> Criar torneio
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/torneios/ingressar">
              <Hash className="w-4 h-4 mr-1" /> Ingressar com código
            </Link>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : tournaments && tournaments.length > 0 ? (
        <div className="grid md:grid-cols-2 gap-4">
          {tournaments.map((t) => (
            <Link key={t.id} to={`/torneios/${t.id}`}>
              <Card className="hover:border-emerald-400 transition-colors">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-emerald-600" /> {t.name}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">
                        {t.city ? `${t.city}${t.state ? ' / ' + t.state : ''}` : 'Local não informado'}
                      </p>
                    </div>
                    <Badge variant={t.my_role === 'owner' || t.my_role === 'admin' ? 'success' : 'secondary'}>
                      {t.my_role === 'owner' ? 'Owner' : t.my_role === 'admin' ? 'Admin' : 'Jogador'}
                    </Badge>
                  </div>
                  <div className="mt-3 flex items-center gap-3 text-xs text-slate-600 flex-wrap">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {TOURNAMENT_STATUS_LABELS[t.status] || t.status}
                    </span>
                    {t.invite_code && (
                      <span className="inline-flex items-center gap-1">
                        <Hash className="w-3 h-3" /> {t.invite_code}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <Users className="w-10 h-10 mx-auto text-slate-300" />
            <h3 className="mt-3 font-medium text-slate-900">Você ainda não participa de nenhum torneio</h3>
            <p className="mt-1 text-sm text-slate-600">Crie o seu ou ingresse com um código de convite.</p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <Button asChild>
                <Link to="/torneios/criar">Criar torneio</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/torneios/ingressar">Ingressar com código</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
