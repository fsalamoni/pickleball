import React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ClipboardCheck, FolderCog, Settings2, ShieldAlert, Sparkles, Swords, Users } from 'lucide-react';
import TournamentModalitiesTab from './TournamentModalitiesTab';
import TournamentRegistrationsTab from './TournamentRegistrationsTab';
import TournamentDrawTab from './TournamentDrawTab';
import TournamentMatchesTab from './TournamentMatchesTab';
import TournamentAdminTab from './TournamentAdminTab';

const ADMIN_TABS = [
  { value: 'geral', label: 'Geral & Status', icon: Settings2 },
  { value: 'modalidades', label: 'Modalidades', icon: FolderCog },
  { value: 'inscricoes', label: 'Inscrições', icon: Users },
  { value: 'sorteio', label: 'Sorteio', icon: ClipboardCheck },
  { value: 'resultados', label: 'Resultados', icon: Swords },
];

/**
 * Painel exclusivo de administração do torneio.
 *
 * Concentra todas as ações de gestão (status, modalidades, inscrições,
 * sorteio, lançamento de resultados, admins). A visualização do jogador é
 * mantida intencionalmente separada: as abas públicas do torneio mostram
 * apenas a versão somente-leitura desses dados.
 */
export default function TournamentAdminPanel({ tournament }) {
  return (
    <div className="space-y-5">
      <Card className="bg-ink text-white overflow-hidden rounded-[2rem] border-0">
        <CardContent className="relative p-6 sm:p-7 lg:p-8">
          <div className="absolute inset-y-0 right-0 hidden w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.16),transparent_46%)] lg:block" />
          <div className="relative max-w-3xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
                <Sparkles className="h-3.5 w-3.5" /> Hub administrativo
              </span>
              <Badge variant="secondary" className="rounded-full border-0 bg-amber-300 px-3 py-1 text-xs font-semibold text-amber-950 shadow-none">
                Somente admins
              </Badge>
            </div>

            <div className="mt-5 flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.5rem] bg-white/10 text-white backdrop-blur-sm">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-3xl font-semibold leading-tight text-white">Controle tudo o que muda a experiência do torneio sem misturar a visão do atleta.</h3>
                <p className="mt-3 text-sm leading-7 text-white/70 sm:text-base">
                  Status, modalidades, inscrições, sorteio e resultados continuam aqui, mas agora em uma estrutura mais clara para operação ao vivo.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="geral" className="w-full">
        <div className="rounded-[1.75rem] border border-white/80 bg-white/82 p-3 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.28)]">
          <div className="overflow-x-auto -mx-1 px-1 sm:mx-0 sm:px-0">
            <TabsList className="inline-flex h-auto min-w-full justify-start gap-2 rounded-[1.5rem] bg-amber-50 p-2 sm:min-w-0">
              {ADMIN_TABS.map(({ value, label, icon: Icon }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="rounded-full px-4 py-2 text-sm font-semibold data-[state=active]:bg-white data-[state=active]:text-ink data-[state=active]:shadow-[0_14px_30px_-22px_rgba(15,23,42,0.35)]"
                >
                  <Icon className="mr-2 h-4 w-4" /> {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </div>
        <TabsContent value="geral" className="mt-4">
          <TournamentAdminTab tournament={tournament} />
        </TabsContent>
        <TabsContent value="modalidades" className="mt-4">
          <TournamentModalitiesTab tournament={tournament} isAdmin />
        </TabsContent>
        <TabsContent value="inscricoes" className="mt-4">
          <TournamentRegistrationsTab tournament={tournament} isAdmin />
        </TabsContent>
        <TabsContent value="sorteio" className="mt-4">
          <TournamentDrawTab tournament={tournament} isAdmin />
        </TabsContent>
        <TabsContent value="resultados" className="mt-4">
          <TournamentMatchesTab tournament={tournament} isAdmin />
        </TabsContent>
      </Tabs>
    </div>
  );
}
