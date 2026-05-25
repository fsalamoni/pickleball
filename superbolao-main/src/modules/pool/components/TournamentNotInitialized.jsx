import { Link } from 'react-router-dom';
import { Sprout } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function TournamentNotInitialized() {
  const { isPlatformAdmin } = useAuth();

  return (
    <Card>
      <CardContent className="p-6 text-center space-y-3">
        <p className="text-slate-600">
          Torneio ainda não inicializado. Aguarde o admin geral configurar o calendário.
        </p>
        {isPlatformAdmin && (
          <div className="pt-2">
            <p className="text-sm text-amber-700 mb-2">
              Você é admin geral. Rode o seed inicial para popular times, fases, prazos e os 104 jogos.
            </p>
            <Button asChild>
              <Link to="/admin/seed">
                <Sprout className="w-4 h-4" />
                Ir para o seed inicial
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
