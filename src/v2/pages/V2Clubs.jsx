import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, MapPin, Plus, Search, Users } from 'lucide-react';
import { useClubs, useMyClubs } from '@/modules/clubs/hooks/useClubs';
import {
  V2Avatar,
  V2Badge,
  V2Button,
  V2EmptyState,
  V2PageIntro,
  V2SearchInput,
  V2SectionHeader,
  V2Skeleton,
  V2Surface,
} from '@/v2/ui/primitives';

function locationText(club) {
  return [club.city, club.state].filter(Boolean).join(' / ') || null;
}

export default function V2Clubs() {
  const { data: clubs = [], isLoading } = useClubs();
  const { data: myClubs = [] } = useMyClubs();
  const [search, setSearch] = useState('');

  const myClubIds = useMemo(() => new Set(myClubs.map((c) => c.id)), [myClubs]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return clubs
      .filter((c) => (!term ? true : [c.name, c.city, c.state, c.description].filter(Boolean).join(' ').toLowerCase().includes(term)))
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));
  }, [clubs, search]);

  return (
    <div className="mx-auto max-w-[1400px]">
      <V2PageIntro
        title="Clubes"
        subtitle="Descubra clubes, crie o seu e organize sua turma."
        action={<V2Button asChild><Link to="/v2/clubes/criar"><Plus className="h-4 w-4" /> Criar clube</Link></V2Button>}
      />

      {myClubs.length > 0 && (
        <div className="mb-8">
          <V2SectionHeader eyebrow="Meus clubes" title="Clubes em que você participa" className="mb-4" />
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {myClubs.map((club) => <ClubCard key={club.id} club={club} mine />)}
          </div>
        </div>
      )}

      <V2Surface className="mb-8">
        <V2SearchInput
          icon={Search}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar clube por nome, cidade ou descrição"
        />
        <p className="mt-4 border-t border-gray-100 pt-4 text-sm text-gray-500">
          <span className="font-bold text-ink">{filtered.length}</span> clube(s) na plataforma.
        </p>
      </V2Surface>

      {isLoading ? (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => <V2Skeleton key={i} className="h-52 rounded-4xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <V2Surface>
          <V2EmptyState
            icon={Building2}
            title="Nenhum clube encontrado"
            description="Ajuste a busca ou crie o primeiro clube e convide sua turma."
            action={<V2Button asChild><Link to="/v2/clubes/criar">Criar clube</Link></V2Button>}
          />
        </V2Surface>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((club) => <ClubCard key={club.id} club={club} mine={myClubIds.has(club.id)} />)}
        </div>
      )}
    </div>
  );
}

function ClubCard({ club, mine }) {
  const location = locationText(club);
  return (
    <Link
      to={`/v2/clubes/${club.id}`}
      className="group flex h-full flex-col rounded-4xl border border-gray-100 bg-paper-pure p-6 shadow-organic-sm transition-all hover:shadow-organic"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {club.logo_url
            ? <V2Avatar name={club.name} photoUrl={club.logo_url} size="lg" className="rounded-2xl" />
            : <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-ink text-white"><Building2 className="h-6 w-6" /></span>}
          <h3 className="truncate font-display text-lg font-bold text-ink">{club.name}</h3>
        </div>
        {mine && <V2Badge tone={club.my_role === 'admin' ? 'amber' : 'green'}>{club.my_role === 'admin' ? 'Admin' : 'Membro'}</V2Badge>}
      </div>

      <div className="mt-4 space-y-2 text-sm text-gray-500">
        <div className="flex items-center gap-2"><MapPin className="h-4 w-4 shrink-0 text-gray-400" /> {location || 'Cidade não informada'}</div>
        <div className="flex items-center gap-2"><Users className="h-4 w-4 shrink-0 text-gray-400" /> {club.member_count || 0} membro(s)</div>
      </div>

      {club.description && <p className="mt-4 line-clamp-3 text-sm leading-6 text-gray-500">{club.description}</p>}

      <div className="mt-auto flex items-center justify-between pt-6 text-sm font-bold text-ink">
        <span>Abrir clube</span>
        <span className="transition-transform group-hover:translate-x-1">→</span>
      </div>
    </Link>
  );
}
