import React, { useState } from 'react';
import { ClipboardCheck, FolderCog, Settings2, ShieldAlert, Sparkles, Swords, Users } from 'lucide-react';
import TournamentModalitiesTab from '@/modules/tournament/components/TournamentModalitiesTab';
import TournamentRegistrationsTab from '@/modules/tournament/components/TournamentRegistrationsTab';
import TournamentDrawTab from '@/modules/tournament/components/TournamentDrawTab';
import TournamentMatchesTab from '@/modules/tournament/components/TournamentMatchesTab';
import TournamentAdminTab from '@/modules/tournament/components/TournamentAdminTab';
import { V2Badge, V2Surface } from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';

const ADMIN_TABS = [
  { value: 'geral', label: 'Geral', icon: Settings2 },
  { value: 'modalidades', label: 'Modalidades', icon: FolderCog },
  { value: 'inscricoes', label: 'Inscrições', icon: Users },
  { value: 'sorteio', label: 'Sorteio', icon: ClipboardCheck },
  { value: 'resultados', label: 'Resultados', icon: Swords },
];

export default function V2TournamentAdminPanel({ tournament }) {
  const [activeTab, setActiveTab] = useState('geral');

  return (
    <div className="space-y-6">
      <V2Surface className="relative overflow-hidden bg-ink p-6 shadow-organic sm:p-8">
        <div className="absolute inset-y-0 right-0 hidden w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.05),transparent_46%)] lg:block" />
        <div className="relative z-10 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-3 py-1 font-display text-xs font-bold uppercase tracking-widest text-acid">
              <Sparkles className="h-3.5 w-3.5" /> Hub administrativo
            </span>
            <V2Badge tone="amber">Somente admins</V2Badge>
          </div>

          <div className="mt-5 flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white backdrop-blur-sm">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-display text-2xl font-bold leading-tight text-white sm:text-3xl">Controle a operação do torneio.</h3>
              <p className="mt-3 text-sm leading-7 text-white/60 sm:text-base">
                Status, modalidades, inscrições, sorteio e resultados.
              </p>
            </div>
          </div>
        </div>
      </V2Surface>

      <div className="overflow-x-auto">
        <div className="inline-flex gap-1.5 rounded-full border border-gray-100 bg-paper-pure p-1.5 shadow-sm">
          {ADMIN_TABS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setActiveTab(value)}
              className={cn(
                'inline-flex items-center gap-2 whitespace-nowrap rounded-full px-5 py-2.5 text-sm font-bold transition-colors',
                activeTab === value ? 'bg-ink text-white shadow-md' : 'text-gray-500 hover:text-ink'
              )}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        {activeTab === 'geral' && <TournamentAdminTab tournament={tournament} />}
        {activeTab === 'modalidades' && <TournamentModalitiesTab tournament={tournament} isAdmin />}
        {activeTab === 'inscricoes' && <TournamentRegistrationsTab tournament={tournament} isAdmin />}
        {activeTab === 'sorteio' && <TournamentDrawTab tournament={tournament} isAdmin />}
        {activeTab === 'resultados' && <TournamentMatchesTab tournament={tournament} isAdmin />}
      </div>
    </div>
  );
}
