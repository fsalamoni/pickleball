import React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldAlert } from 'lucide-react';
import TournamentModalitiesTab from './TournamentModalitiesTab';
import TournamentRegistrationsTab from './TournamentRegistrationsTab';
import TournamentDrawTab from './TournamentDrawTab';
import TournamentMatchesTab from './TournamentMatchesTab';
import TournamentAdminTab from './TournamentAdminTab';

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
    <div className="space-y-4">
      <Card className="border-amber-300 bg-amber-50/60">
        <CardContent className="p-4 flex items-start gap-3">
          <div className="rounded-md bg-amber-200 text-amber-900 p-2">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-amber-950">Área de administração do torneio</h3>
              <Badge variant="secondary" className="bg-amber-200 text-amber-950 hover:bg-amber-200">
                Somente admins
              </Badge>
            </div>
            <p className="text-xs text-amber-900/80 mt-1">
              Todas as alterações feitas aqui — informações, modalidades, inscrições, sorteios e
              resultados — valem automaticamente para o torneio e ficam visíveis para os jogadores
              em tempo real.
            </p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="geral" className="w-full">
        <TabsList className="flex flex-wrap h-auto bg-amber-100/70">
          <TabsTrigger value="geral">Geral & Status</TabsTrigger>
          <TabsTrigger value="modalidades">Modalidades</TabsTrigger>
          <TabsTrigger value="inscricoes">Inscrições</TabsTrigger>
          <TabsTrigger value="sorteio">Sorteio</TabsTrigger>
          <TabsTrigger value="resultados">Resultados</TabsTrigger>
        </TabsList>
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
