/**
 * V2NotFound — página 404 interna amigável (flag not_found_page).
 *
 * Quando a flag está ligada, rotas inexistentes mostram esta página com atalhos
 * úteis em vez de redirecionar silenciosamente para a home. Aditivo.
 */

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Compass, Home, Trophy, Building2, Users } from 'lucide-react';
import { V2Button, V2Surface } from '@/v2/ui/primitives';

const SHORTCUTS = [
  { to: '/', icon: Home, label: 'Início' },
  { to: '/torneios', icon: Trophy, label: 'Torneios' },
  { to: '/arenas', icon: Building2, label: 'Arenas' },
  { to: '/atletas', icon: Users, label: 'Atletas' },
];

export default function V2NotFound() {
  const location = useLocation();
  return (
    <div className="mx-auto max-w-[640px]">
      <V2Surface className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-ink text-acid">
          <Compass className="h-8 w-8" />
        </div>
        <h1 className="mt-4 font-display text-3xl font-bold text-ink">Página não encontrada</h1>
        <p className="mt-2 text-sm text-gray-500">
          Não encontramos <span className="font-mono text-gray-600">{location.pathname}</span>.
          O link pode estar quebrado ou a página pode ter mudado de lugar.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {SHORTCUTS.map(({ to, icon: Icon, label }) => (
            <V2Button key={to} asChild variant="secondary" size="sm">
              <Link to={to}><Icon className="h-4 w-4" /> {label}</Link>
            </V2Button>
          ))}
        </div>
        <div className="mt-4">
          <V2Button asChild>
            <Link to="/"><Home className="h-4 w-4" /> Voltar ao início</Link>
          </V2Button>
        </div>
      </V2Surface>
    </div>
  );
}
