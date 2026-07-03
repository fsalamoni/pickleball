import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { PlatformSurfaceCard } from '@/components/ui/platform-page';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { ArrowRight, Globe, Hash, ShieldCheck, Sparkles, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { getTournamentByInviteCode } from '@/modules/tournament/services/tournamentService';

const JOIN_STEPS = [
  {
    order: '01',
    title: 'Receba o código do organizador',
    description: 'Torneios privados usam um código curto para liberar o acesso às modalidades.',
  },
  {
    order: '02',
    title: 'Valide o acesso aqui',
    description: 'Ao confirmar, a plataforma guarda o acesso no navegador e abre a visão geral do evento.',
  },
  {
    order: '03',
    title: 'Escolha a modalidade',
    description: 'Depois disso você segue para o torneio e decide onde se inscrever.',
  },
];

export default function JoinTournament() {
  const navigate = useNavigate();
  const { isAuthAvailable, authUnavailableReason } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const isPreviewMode = import.meta.env.DEV && !isAuthAvailable;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    try {
      const t = await getTournamentByInviteCode(code.trim());
      if (!t) {
        toast.error('Código não encontrado.');
        return;
      }
      sessionStorage.setItem(`tournament_access_${t.id}`, code.trim().toUpperCase());
      toast.success(`Acesso concedido a "${t.name}".`);
      navigate(`/torneios/${t.id}/visao-geral?join=1`);
    } catch (err) {
      toast.error(err.message || 'Falha ao buscar torneio.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
        <Card className="bg-ink text-white overflow-hidden rounded-[1.25rem] border-0 sm:rounded-[2rem]">
          <CardContent className="p-5 sm:p-8 lg:p-10">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
              <Sparkles className="h-3.5 w-3.5" /> Acesso privado
            </span>
            <h1 className="mt-5 text-2xl font-semibold leading-tight text-white sm:text-3xl lg:text-5xl">
              Entre em um torneio privado com o código recebido.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/70 sm:text-base">
              O código de convite desbloqueia a visão geral do evento e libera a escolha da modalidade.
            </p>

            <div className="mt-8 space-y-3">
              {JOIN_STEPS.map((step) => (
                <div key={step.order} className="rounded-[1.35rem] border border-white/12 bg-white/10 p-4 backdrop-blur-sm">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">{step.order}</div>
                  <div className="mt-2 text-lg font-semibold text-white">{step.title}</div>
                  <p className="mt-1 text-sm leading-6 text-white/70">{step.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <PlatformSurfaceCard>
            <div className="px-0 pb-2 pt-0">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-green-100 text-green-700 shrink-0">
                  <Hash className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-ink">Ingressar com código</h2>
                  <p className="mt-1 text-sm leading-6 text-gray-500">
                    Informe o código que você recebeu do organizador para liberar o acesso ao torneio privado.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <form onSubmit={handleSubmit} className="space-y-5">
                {isPreviewMode && (
                  <div className="rounded-[1.35rem] border border-amber-300/70 bg-amber-50/85 p-4 text-sm leading-6 text-amber-950">
                    Prévia local sem Firebase: você pode validar o layout desta etapa, mas a busca pelo código fica desabilitada neste ambiente.
                    {authUnavailableReason ? ` ${authUnavailableReason}` : ''}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="invite_code">Código de convite</Label>
                  <Input
                    id="invite_code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="Ex.: PB7K9X"
                    maxLength={10}
                    autoCapitalize="characters"
                    autoComplete="off"
                    spellCheck={false}
                    className="h-14 rounded-[1.25rem] uppercase tracking-[0.35em] text-center text-2xl font-semibold"
                  />
                  <p className="text-sm leading-6 text-gray-500">
                    O código não funciona como senha individual. Ele apenas libera a entrada no torneio privado para qualquer pessoa com o convite.
                  </p>
                </div>

                <div className="rounded-[1.35rem] border border-gray-100 bg-paper p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-green-100 text-green-700">
                      <ShieldCheck className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <div className="font-semibold text-ink">Depois da validação, o acesso fica salvo neste navegador</div>
                      <p className="mt-1 text-sm leading-6 text-gray-500">
                        Isso evita digitar o mesmo código toda vez que você voltar à visão geral do torneio.
                      </p>
                    </div>
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={loading || !code.trim() || isPreviewMode}>
                  {loading ? 'Buscando…' : isPreviewMode ? 'Validação indisponível no preview' : 'Continuar para o torneio'}
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </form>
            </div>
          </PlatformSurfaceCard>

          <PlatformSurfaceCard>
              <div className="flex items-start gap-3 text-sm text-gray-600">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-green-100 text-green-700 shrink-0">
                  <Globe className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-ink">Procurando torneios abertos?</p>
                  <p className="mt-2 leading-6">
                    Torneios públicos não exigem código.{' '}
                    <Link to="/torneios/publicos" className="text-green-700 underline underline-offset-4">
                      Veja a lista de torneios públicos
                    </Link>{' '}
                    ou{' '}
                    <Link to="/torneios/criar" className="text-green-700 underline underline-offset-4">
                      crie o seu
                    </Link>
                    .
                  </p>
                </div>
              </div>
          </PlatformSurfaceCard>
        </div>
      </section>

      <p className="text-center text-xs text-gray-500 flex items-center justify-center gap-1">
        <Trophy className="w-3 h-3" /> Plataforma Pickleball
      </p>
    </div>
  );
}
