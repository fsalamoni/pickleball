/**
 * LinkedClubsSection — clubes vinculados a um professor ou arena.
 * Flag linked_clubs. No modo público (`canManage` false), só renderiza se
 * houver clubes. No admin, permite vincular um clube existente (que o usuário
 * administra) ou criar um novo já vinculado.
 */

import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Users, Plus, Link2 } from 'lucide-react';
import { useClubsByCoach, useClubsByArena, useMyClubs, useLinkClub } from '../hooks/useClubs';
import { CLUB_ROLE } from '../domain/constants';
import {
  V2Badge, V2Button, V2EmptyState, V2Select, V2Skeleton, V2Surface,
} from '@/v2/ui/primitives';

function ClubCard({ club }) {
  return (
    <Link to={`/clubes/${club.id}`} className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-paper p-3 transition-transform hover:scale-[1.01]">
      {club.logo_url
        ? <img src={club.logo_url} alt="" className="h-10 w-10 rounded-2xl object-cover" />
        : <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-ink text-acid"><Users className="h-5 w-5" /></div>}
      <div className="min-w-0">
        <p className="font-bold text-ink line-clamp-1">{club.name}</p>
        <p className="text-xs text-gray-400">
          {club.member_count || 1} membro(s){club.city ? ` · ${club.city}` : ''}
        </p>
      </div>
    </Link>
  );
}

export default function LinkedClubsSection({ ownerType, ownerId, canManage = false, title = 'Clubes' }) {
  const navigate = useNavigate();
  const isCoach = ownerType === 'coach';
  const coachClubs = useClubsByCoach(isCoach ? ownerId : null);
  const arenaClubs = useClubsByArena(isCoach ? null : ownerId);
  const { data: clubs = [], isLoading } = isCoach ? coachClubs : arenaClubs;
  const { data: myClubs = [] } = useMyClubs();
  const link = useLinkClub();
  const [selClub, setSelClub] = useState('');

  const linkField = isCoach ? 'linked_coach_id' : 'linked_arena_id';
  // Clubes que administro e ainda não estão vinculados a este dono.
  const linkable = useMemo(() => {
    const linkedIds = new Set(clubs.map((c) => c.id));
    return myClubs.filter((c) => c.my_role === CLUB_ROLE.ADMIN && !linkedIds.has(c.id) && !c[linkField]);
  }, [myClubs, clubs, linkField]);

  // Público: nada a mostrar se não há clubes.
  if (!canManage && clubs.length === 0) return null;

  const handleLink = async () => {
    if (!selClub) return;
    try {
      await link.mutateAsync({ clubId: selClub, patch: { [linkField]: ownerId } });
      toast.success('Clube vinculado.');
      setSelClub('');
    } catch (err) {
      toast.error(err?.message || 'Não foi possível vincular.');
    }
  };

  const createHref = `/clubes/criar?${isCoach ? 'coach' : 'arena'}=${ownerId}`;

  return (
    <V2Surface>
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-ink" />
          <h3 className="font-display text-base font-bold text-ink">{title}</h3>
        </div>
        {canManage && (
          <V2Button size="sm" variant="secondary" onClick={() => navigate(createHref)}>
            <Plus className="h-4 w-4" /> Criar clube
          </V2Button>
        )}
      </div>

      {isLoading ? (
        <V2Skeleton lines={2} />
      ) : clubs.length === 0 ? (
        canManage ? (
          <V2EmptyState
            icon={Users}
            title="Nenhum clube vinculado"
            description="Crie um clube próprio para promover eventos, times e treinos — ou vincule um clube que você já administra."
          />
        ) : null
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {clubs.map((c) => <ClubCard key={c.id} club={c} />)}
        </div>
      )}

      {canManage && linkable.length > 0 && (
        <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-gray-100 pt-4">
          <div className="flex-1 min-w-[200px]">
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-400">Vincular clube existente</label>
            <V2Select value={selClub} onChange={(e) => setSelClub(e.target.value)}>
              <option value="">Selecione um clube que você administra…</option>
              {linkable.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </V2Select>
          </div>
          <V2Button onClick={handleLink} disabled={!selClub || link.isPending}>
            <Link2 className="h-4 w-4" /> Vincular
          </V2Button>
        </div>
      )}
    </V2Surface>
  );
}
