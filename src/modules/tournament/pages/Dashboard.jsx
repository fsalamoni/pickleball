import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Plus, Hash, Users, Calendar, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useMyTournaments, usePublicTournaments } from '@/modules/tournament/hooks/useTournament';
import {
  TOURNAMENT_STATUS,
  TOURNAMENT_STATUS_LABELS,
  TOURNAMENT_USER_ROLE,
  TOURNAMENT_VISIBILITY,
  TOURNAMENT_VISIBILITY_LABELS,
} from '@/modules/tournament/domain/constants';

const STATUS_TONE = {
  [TOURNAMENT_STATUS.IN_PROGRESS]: 'bg-blue-100 text-blue-900 border-blue-200',
  [TOURNAMENT_STATUS.REGISTRATIONS_OPEN]: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  [TOURNAMENT_STATUS.REGISTRATIONS_CLOSED]: 'bg-amber-100 text-amber-900 border-amber-200',
  [TOURNAMENT_STATUS.DRAFT]: 'bg-slate-100 text-slate-700 border-slate-200',
  [TOURNAMENT_STATUS.FINISHED]: 'bg-slate-200 text-slate-700 border-slate-300',
  [TOURNAMENT_STATUS.CANCELLED]: 'bg-red-100 text-red-800 border-red-200',
};

export default function Dashboard() {
  const { data: tournaments, isLoading } = useMyTournaments();
  const { data: publicTournaments = [], isLoading: isLoadingPublic } = usePublicTournaments();
  const visibleTournaments = useMemo(() => {
    const byId = new Map();
    (tournaments || []).forEach((t) => byId.set(t.id, t));
    publicTournaments.forEach((t) => {
      if (!byId.has(t.id)) byId.set(t.id, { ...t, my_role: TOURNAMENT_USER_ROLE.PUBLIC });
    });
    return Array.from(byId.values());
  }, [tournaments, publicTournaments]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold arena-heading">Meus torneios</h1>
          <p className="text-sm text-slate-600">Torneios que você administra, está inscrito ou estão públicos.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
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
          <Button asChild variant="outline">
            <Link to="/torneios/publicos">
              <Globe className="w-4 h-4 mr-1" /> Torneios públicos
            </Link>
          </Button>
        </div>
      </div>

      {isLoading || isLoadingPublic ? (
        <div className="grid md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : visibleTournaments.length > 0 ? (
        <div className="grid md:grid-cols-2 gap-4">
          {visibleTournaments.map((t) => (
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
                    <Badge variant={t.my_role === TOURNAMENT_USER_ROLE.OWNER || t.my_role === TOURNAMENT_USER_ROLE.ADMIN ? 'success' : 'secondary'}>
                      {t.my_role === TOURNAMENT_USER_ROLE.OWNER
                        ? 'Owner'
                        : t.my_role === TOURNAMENT_USER_ROLE.ADMIN
                          ? 'Admin'
                          : t.my_role === TOURNAMENT_USER_ROLE.PUBLIC
                            ? 'Público'
                            : 'Jogador'}
                    </Badge>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-slate-600 flex-wrap">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium ${STATUS_TONE[t.status] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                      <Calendar className="w-3 h-3" /> {TOURNAMENT_STATUS_LABELS[t.status] || t.status}
                    </span>
                    {t.invite_code && (
                      <span className="inline-flex items-center gap-1">
                        <Hash className="w-3 h-3" /> {t.invite_code}
                      </span>
                    )}
                    <span>{TOURNAMENT_VISIBILITY_LABELS[t.visibility || TOURNAMENT_VISIBILITY.PRIVATE]}</span>
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
            <p className="mt-1 text-sm text-slate-600">Crie o seu, ingresse com um código ou aguarde torneios públicos.</p>
            <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
              <Button asChild>
                <Link to="/torneios/criar">Criar torneio</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/torneios/ingressar">Ingressar com código</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/torneios/publicos">Torneios públicos</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
