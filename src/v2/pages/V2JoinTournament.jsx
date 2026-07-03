import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Globe, Hash } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { getTournamentByInviteCode } from '@/modules/tournament/services/tournamentService';
import { V2Button, V2Field, V2Surface } from '@/v2/ui/primitives';

const STEPS = [
  { order: '01', title: 'Receba o código do organizador', description: 'Torneios privados usam um código curto para liberar o acesso.' },
  { order: '02', title: 'Valide o acesso aqui', description: 'Ao confirmar, o acesso é guardado no navegador e abre a visão geral.' },
  { order: '03', title: 'Escolha a modalidade', description: 'Depois disso você segue para o torneio e decide onde se inscrever.' },
];

export default function V2JoinTournament() {
  const navigate = useNavigate();
  const { isAuthAvailable } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const isPreview = import.meta.env.DEV && !isAuthAvailable;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    try {
      const t = await getTournamentByInviteCode(code.trim());
      if (!t) { toast.error('Código não encontrado.'); return; }
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
    <div className="mx-auto max-w-[1100px]">
      <Link to="/torneios" className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Voltar aos torneios
      </Link>

      <div className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
        <div className="relative overflow-hidden rounded-4xl bg-mesh p-8 shadow-organic">
          <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-acid">Acesso privado</span>
          <h1 className="mt-4 font-display text-3xl font-bold text-white sm:text-4xl">Entre em um torneio privado com o código recebido.</h1>
          <p className="mt-3 max-w-xl text-sm leading-7 text-gray-300">O código de convite desbloqueia a visão geral do evento e libera a escolha da modalidade.</p>
          <div className="mt-8 space-y-3">
            {STEPS.map((s) => (
              <div key={s.order} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="text-[11px] font-bold uppercase tracking-widest text-acid">{s.order}</div>
                <div className="mt-1.5 font-display text-lg font-bold text-white">{s.title}</div>
                <p className="mt-1 text-sm leading-6 text-gray-300">{s.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <V2Surface>
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-acid/15 text-ink"><Hash className="h-5 w-5" /></div>
              <div>
                <h2 className="font-display text-2xl font-bold text-ink">Ingressar com código</h2>
                <p className="mt-1 text-sm leading-6 text-gray-500">Informe o código recebido do organizador para liberar o acesso.</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              {isPreview && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
                  Prévia local sem Firebase: a busca pelo código fica desabilitada neste ambiente.
                </div>
              )}
              <V2Field label="Código de convite" hint="O código libera a entrada no torneio para qualquer pessoa com o convite.">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="Ex.: PB7K9X"
                  maxLength={10}
                  autoComplete="off"
                  spellCheck={false}
                  className="h-16 w-full rounded-3xl border border-gray-200 bg-paper-pure text-center text-2xl font-bold uppercase tracking-[0.35em] text-ink focus:border-gray-300 focus:outline-none focus:ring-4 focus:ring-gray-100"
                />
              </V2Field>
              <V2Button type="submit" className="w-full" disabled={loading || !code.trim() || isPreview}>
                {loading ? 'Buscando…' : 'Continuar para o torneio'} <ArrowRight className="h-4 w-4" />
              </V2Button>
            </form>
          </V2Surface>

          <V2Surface>
            <div className="flex items-start gap-3 text-sm text-gray-500">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-acid/15 text-ink"><Globe className="h-5 w-5" /></div>
              <div>
                <p className="font-display text-base font-bold text-ink">Procurando torneios abertos?</p>
                <p className="mt-2 leading-6">
                  Torneios públicos não exigem código.{' '}
                  <Link to="/torneios" className="font-bold text-ink underline">Veja a lista</Link> ou{' '}
                  <Link to="/torneios/criar" className="font-bold text-ink underline">crie o seu</Link>.
                </p>
              </div>
            </div>
          </V2Surface>
        </div>
      </div>
    </div>
  );
}
