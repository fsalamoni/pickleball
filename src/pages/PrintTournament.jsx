import React, { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Printer, Trophy } from 'lucide-react';
import { getTournament } from '@/modules/tournament/services/tournamentService';
import { listModalities } from '@/modules/tournament/services/modalityService';
import { listMatches } from '@/modules/tournament/services/matchService';
import { computeModalityRanking } from '@/modules/tournament/services/rankingService';
import { MODALITY_FORMAT_LABELS } from '@/modules/tournament/domain/constants';

/**
 * Versão para impressão (A4) das chaves, grupos e ranking de um torneio.
 * Inspirado em coderobotics e bracketmaker.app.
 */
export default function PrintTournament() {
  const { tournamentId } = useParams();
  const { data: tournament } = useQuery({
    queryKey: ['print', 'tournament', tournamentId],
    queryFn: () => getTournament(tournamentId),
  });
  const { data: modalities = [] } = useQuery({
    queryKey: ['print', 'modalities', tournamentId],
    queryFn: () => listModalities(tournamentId),
    enabled: !!tournament,
  });

  useEffect(() => {
    document.body.classList.add('print-mode');
    return () => document.body.classList.remove('print-mode');
  }, []);

  if (!tournament) {
    return <p className="p-8 text-sm text-slate-500">Carregando…</p>;
  }

  return (
    <div className="bg-white text-slate-900 max-w-4xl mx-auto p-8 print:p-0 print:max-w-none">
      <header className="flex items-center justify-between border-b pb-3 mb-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Trophy className="w-5 h-5 text-emerald-600" /> {tournament.name}
          </h1>
          <p className="text-xs text-slate-500">
            {tournament.city ? `${tournament.city} · ` : ''}
            Código: {tournament.invite_code}
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="print:hidden text-sm inline-flex items-center gap-1 px-3 py-1.5 border rounded hover:bg-slate-50"
        >
          <Printer className="w-4 h-4" /> Imprimir
        </button>
      </header>

      {modalities.map((m) => (
        <PrintModality key={m.id} modality={m} />
      ))}

      <footer className="text-[10px] text-slate-400 mt-6">
        <Link to={`/p/${tournamentId}`} className="hover:underline">
          plataforma Pickleball — visão pública
        </Link>
      </footer>
    </div>
  );
}

function PrintModality({ modality }) {
  const { data: matches = [] } = useQuery({
    queryKey: ['print', 'matches', modality.id, 0],
    queryFn: () => listMatches(modality.id, 0),
  });
  const { data: ranking = [] } = useQuery({
    queryKey: ['print', 'ranking', modality.id],
    queryFn: () => computeModalityRanking(modality.id),
  });

  return (
    <section className="mb-6 break-inside-avoid print:break-after-page">
      <h2 className="font-semibold text-sm border-b border-emerald-600 pb-1 mb-2">
        {modality.name} —{' '}
        <span className="font-normal text-slate-500">
          {MODALITY_FORMAT_LABELS[modality.format] || modality.format}
        </span>
      </h2>

      {ranking.length > 0 && (
        <div className="mb-3">
          <h3 className="text-xs font-semibold mb-1">Classificação</h3>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b">
                <th className="py-1 text-left">#</th>
                <th className="py-1 text-left">Participante</th>
                <th className="py-1 text-center">PJ</th>
                <th className="py-1 text-center">V</th>
                <th className="py-1 text-center">Sets</th>
                <th className="py-1 text-right">Pts</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((r) => (
                <tr key={r.participant_id} className="border-b">
                  <td className="py-1">{r.position}</td>
                  <td className="py-1">{r.label || r.participant_id}</td>
                  <td className="py-1 text-center">{r.played}</td>
                  <td className="py-1 text-center">{r.wins}</td>
                  <td className="py-1 text-center">{r.sets_won}–{r.sets_lost}</td>
                  <td className="py-1 text-right font-semibold">{r.ranking_points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {matches.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold mb-1">Jogos</h3>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b">
                <th className="py-1 text-left">Rod.</th>
                {matches.some((m) => m.group) && <th className="py-1 text-left">Grupo</th>}
                <th className="py-1 text-left">Lado A</th>
                <th className="py-1 text-left">Lado B</th>
                <th className="py-1 text-right">Placar</th>
              </tr>
            </thead>
            <tbody>
              {matches.map((m) => (
                <tr key={m.id} className="border-b">
                  <td className="py-1">{m.round}</td>
                  {matches.some((mm) => mm.group) && <td className="py-1">{m.group || '—'}</td>}
                  <td className="py-1">{m.side_a || '—'}</td>
                  <td className="py-1">{m.side_b || '—'}</td>
                  <td className="py-1 text-right tabular-nums">
                    {(m.games || []).map((g, i) => (
                      <span key={i} className="ml-1">
                        {g.a}-{g.b}
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
