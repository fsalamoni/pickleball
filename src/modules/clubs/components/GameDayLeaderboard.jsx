import React, { useMemo } from 'react';
import { Trophy } from 'lucide-react';
import { UserAvatar } from '@/components/ui/user-avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { computeGameDayLeaderboard } from '@/modules/clubs/domain/gameDayLeaderboard';

/**
 * Ranking do dia (classificação interna do dia de jogo). Presentacional e
 * compartilhado entre o organizador do dia de jogo do ATLETA e o do CLUBE.
 * Não traz "surface" própria — quem usa envolve no Card/V2Surface adequado.
 *
 * Mostra, por participante: jogos, vitórias, derrotas, saldo de pontos e
 * pontos sofridos. Ordenação: mais vitórias → menos derrotas → melhor saldo →
 * menos pontos sofridos (ver domain/gameDayLeaderboard).
 */
export default function GameDayLeaderboard({ participants = [], games = [] }) {
  const rows = useMemo(
    () => computeGameDayLeaderboard(participants, games),
    [participants, games],
  );
  const anyDecided = useMemo(
    () => rows.some((r) => r.games > 0),
    [rows],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Trophy className="h-5 w-5 text-green-600" />
        <h3 className="text-base font-semibold text-ink">Ranking do dia</h3>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="Sem participantes"
          description="Insira participantes para ver a classificação do dia."
        />
      ) : (
        <>
          {!anyDecided && (
            <p className="text-xs text-gray-500">
              Lance os resultados dos jogos para a classificação começar a contar.
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                  <th className="w-8 py-2 pr-2 text-left font-semibold">#</th>
                  <th className="py-2 pr-2 text-left font-semibold">Atleta</th>
                  <th className="py-2 px-2 text-center font-semibold" title="Jogos">J</th>
                  <th className="py-2 px-2 text-center font-semibold" title="Vitórias">V</th>
                  <th className="py-2 px-2 text-center font-semibold" title="Derrotas">D</th>
                  <th className="py-2 px-2 text-center font-semibold" title="Saldo de pontos">Saldo</th>
                  <th className="py-2 pl-2 text-center font-semibold" title="Pontos sofridos">Sofr.</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id} className="border-b border-gray-100 last:border-0">
                    <td className="py-2 pr-2 text-left">
                      <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                        i === 0 && r.games > 0 ? 'bg-acid text-ink' : 'text-gray-500'
                      }`}>
                        {i + 1}
                      </span>
                    </td>
                    <td className="py-2 pr-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <UserAvatar name={r.name} size="xs" />
                        <span className="truncate font-medium text-ink">{r.name}</span>
                      </div>
                    </td>
                    <td className="py-2 px-2 text-center tabular-nums text-gray-600">{r.games}</td>
                    <td className="py-2 px-2 text-center tabular-nums font-semibold text-green-700">{r.wins}</td>
                    <td className="py-2 px-2 text-center tabular-nums text-gray-600">{r.losses}</td>
                    <td className={`py-2 px-2 text-center tabular-nums font-medium ${
                      r.diff > 0 ? 'text-green-700' : r.diff < 0 ? 'text-red-600' : 'text-gray-500'
                    }`}>
                      {r.diff > 0 ? `+${r.diff}` : r.diff}
                    </td>
                    <td className="py-2 pl-2 text-center tabular-nums text-gray-600">{r.pointsAgainst}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
