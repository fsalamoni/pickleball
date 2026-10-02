import React from 'react';
import { Link } from 'react-router-dom';
import { Building2, ChevronRight, GraduationCap, ShieldCheck, Users } from 'lucide-react';
import { V2Surface } from '@/v2/ui/primitives';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useMyManagedArenas } from '@/modules/arenas/hooks/useArenas';
import { useCoach } from '@/modules/coaches/hooks/useCoaches';
import { useMyClubs } from '@/modules/clubs/hooks/useClubs';
import { issuerLinks } from './issuerLinks';

const ICON = { admin: ShieldCheck, arena: Building2, coach: GraduationCap, club: Users };

/**
 * "Você também oferece": quem gere uma arena, dá aula, administra um clube ou é
 * admin da plataforma tem aqui o caminho para os desafios e recompensas que
 * oferece (a ferramenta mora na central de cada um).
 */
export default function IssuerShortcuts() {
  const { user, isPlatformAdmin } = useAuth();
  const arenas = useMyManagedArenas();
  const coach = useCoach(user?.uid);
  const clubs = useMyClubs();
  const links = issuerLinks({
    isAdmin: !!isPlatformAdmin,
    arenas: arenas.data || [],
    coach: coach.data || null,
    clubs: clubs.data || [],
  });
  if (links.length === 0) return null;
  return (
    <V2Surface data-testid="issuer-shortcuts" data-dica="oferecer">
      <h2 className="mb-1 font-display text-lg font-bold text-ink">Você também oferece</h2>
      <p className="mb-3 text-sm text-gray-500">Crie desafios e recompensas para o seu público e acompanhe o engajamento.</p>
      <ul className="space-y-2">
        {links.map((l) => {
          const Icon = ICON[l.kind] || Users;
          return (
            <li key={l.key}>
              <Link to={l.to} className="flex items-center gap-3 rounded-2xl border border-gray-100 p-3 transition-colors hover:border-gray-200 hover:bg-paper">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-paper text-ink"><Icon className="h-4 w-4" aria-hidden="true" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-ink">{l.label}</span>
                  <span className="block text-xs text-gray-500">{l.hint}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ul>
    </V2Surface>
  );
}
