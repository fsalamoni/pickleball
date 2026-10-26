/**
 * O ranking interno do clube. Na página do clube é visão pública dos membros;
 * `adminTools` acrescenta a escolha "Incluir resultados externos" e só a
 * Central do clube (o ambiente de quem administra) a liga.
 */
import React, { useState } from 'react';
import { Globe2, ListChecks, Medal, User, Users2 } from 'lucide-react';
import { useClubInternalRanking } from '@/modules/clubs/hooks/useClubInternalRanking';
import { V2Avatar, V2Badge, V2EmptyState, V2ErrorState, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';
import { t } from '@/core/i18n';

export default function ClubRankingTab({ clubId, adminTools = false }) {
  const doublesOn = true;
  const [tab, setTab] = useState('individual'); // 'individual' | 'doubles'
  const [includeExternal, setIncludeExternal] = useState(false);
  const { data, isLoading, isError, refetch } = useClubInternalRanking(clubId, { includeExternal });

  if (isLoading) return <V2Skeleton className="h-48 rounded-4xl" />;
  // Falha não é "sem ranking ainda": o ranking existe, só não foi lido.
  if (isError) return <V2ErrorState title={t('Não foi possível carregar o ranking')} onRetry={() => refetch()} />;

  return (
    <V2Surface className="overflow-hidden p-0">
      <div className="border-b border-gray-100 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-bold text-ink">{t('Ranking interno')}</h3>
            <p className="text-sm text-gray-500">{t('Casual, a partir dos placares dos dias de jogo. Não afeta o ranking nacional.')}</p>
            {/* Não há "Materializar ranking agora": o ranking interno é
                refeito pelo servidor a cada placar gravado, a cada publicação
                e a cada entrada/saída de membro. Vazio aqui significa que
                ainda não houve resultado — e é isso que o estado vazio diz. */}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <V2Badge tone="neutral" className="rounded-full">
              <Users2 className="mr-1 h-3 w-3" />
              {t('{n} atletas do clube', { n: data?.clubUids?.length || 0 })}
            </V2Badge>
            {data?.sources && (
              <>
                <V2Badge tone="green" className="rounded-full">
                  <ListChecks className="mr-1 h-3 w-3" />
                  {data.sources.club} jogo(s) do clube
                </V2Badge>
                {includeExternal && data.sources.external > 0 && (
                  <V2Badge tone="amber" className="rounded-full">
                    <Globe2 className="mr-1 h-3 w-3" />
                    {data.sources.external} externo(s)
                  </V2Badge>
                )}
              </>
            )}
          </div>
        </div>

        {/* Sub-abas: Individual | Duplas */}
        {doublesOn && (
          <div className="mt-3 inline-flex rounded-full border border-gray-100 bg-paper-pure p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setTab('individual')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition-colors',
                tab === 'individual' ? 'bg-ink text-white' : 'text-gray-500 hover:text-ink',
              )}
            >
              <User className="h-3.5 w-3.5" /> {t('Individual')}
            </button>
            <button
              type="button"
              onClick={() => setTab('doubles')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition-colors',
                tab === 'doubles' ? 'bg-ink text-white' : 'text-gray-500 hover:text-ink',
              )}
            >
              <Users2 className="h-3.5 w-3.5" /> {t('Duplas')}
            </button>
          </div>
        )}
      </div>

      {/* "Incluir resultados externos" é escolha de quem administra: só a Central a oferece. */}
      {adminTools && <ExternalToggle includeExternal={includeExternal} onChange={setIncludeExternal} />}

      {tab === 'individual' && (
        <IndividualRankingTable
          ranking={data?.individual || []}
          emptyMessage={t('Registre placares nos dias de jogo do clube para montar o ranking interno. Ele se atualiza sozinho, a cada resultado.')}
        />
      )}
      {tab === 'doubles' && doublesOn && (
        <DoublesRankingTable
          ranking={data?.doubles || []}
          emptyMessage={t('Nenhuma dupla com jogos suficientes no clube.')}
        />
      )}
    </V2Surface>
  );
}

function ExternalToggle({ includeExternal, onChange }) {
  return (
    <div className="border-b border-gray-100 bg-paper/40 px-4 py-3">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={includeExternal}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-bold text-ink">
            <Globe2 className="h-4 w-4 text-amber-600" /> {t('Incluir resultados externos')}
            {includeExternal && (
              <V2Badge tone="amber" className="rounded-full text-2xs">
                ON
              </V2Badge>
            )}
          </div>
          <p className="mt-0.5 text-xs text-gray-500">
            {t('Quando ligado, o ranking do clube também considera os placares dos atletas do clube em torneios da plataforma e em dias de jogo de outros clubes. Útil para ter um retrato completo do desempenho dos associados.')}
          </p>
          <p className="mt-1 text-xs text-gray-500">{t('Só muda a visão da administração: o ranking que os membros veem segue só com os jogos do clube.')}</p>
        </div>
      </label>
    </div>
  );
}

function IndividualRankingTable({ ranking, emptyMessage, action }) {
  if (ranking.length === 0) {
    return (
      <div className="p-4">
        <V2EmptyState
          icon={Medal}
          title={t('Sem ranking ainda')}
          description={emptyMessage}
          action={action}
        />
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-paper text-left text-2xs uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-4 py-3">#</th>
            <th className="px-4 py-3">{t('Atleta')}</th>
            <th className="px-4 py-3 text-center">J</th>
            <th className="px-4 py-3 text-center">V</th>
            <th className="px-4 py-3 text-center">D</th>
            <th className="px-4 py-3 text-center">{t('Aprov.')}</th>
            <th className="px-4 py-3 text-center">{t('Saldo')}</th>
          </tr>
        </thead>
        <tbody>
          {ranking.map((r, i) => (
            <tr key={r.id} className="border-t border-gray-100">
              <td className="px-4 py-3 font-bold text-ink">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</td>
              <td className="px-4 py-3 font-semibold text-ink">{r.name}</td>
              <td className="px-4 py-3 text-center tabular-nums text-gray-600">{r.games}</td>
              <td className="px-4 py-3 text-center tabular-nums font-bold text-green-700">{r.wins}</td>
              <td className="px-4 py-3 text-center tabular-nums text-gray-500">{r.losses}</td>
              <td className="px-4 py-3 text-center tabular-nums">{Math.round(r.win_rate * 100)}%</td>
              <td className={cn('px-4 py-3 text-center tabular-nums', r.points_balance > 0 ? 'text-green-700' : r.points_balance < 0 ? 'text-red-600' : 'text-gray-500')}>
                {r.points_balance > 0 ? `+${r.points_balance}` : r.points_balance}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DoublesRankingTable({ ranking, emptyMessage }) {
  if (ranking.length === 0) {
    return (
      <div className="p-4">
        <V2EmptyState icon={Users2} title={t('Sem duplas ranqueadas')} description={emptyMessage} />
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-paper text-left text-2xs uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-4 py-3">#</th>
            <th className="px-4 py-3">{t('Dupla')}</th>
            <th className="px-4 py-3 text-center">J</th>
            <th className="px-4 py-3 text-center">V</th>
            <th className="px-4 py-3 text-center">D</th>
            <th className="px-4 py-3 text-center">{t('Aprov.')}</th>
            <th className="px-4 py-3 text-center">{t('Saldo')}</th>
          </tr>
        </thead>
        <tbody>
          {ranking.map((r, i) => (
            <tr key={r.pair_key} className="border-t border-gray-100">
              <td className="px-4 py-3 font-bold text-ink">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</td>
              <td className="px-4 py-3 font-semibold text-ink">
                <PairMembers members={r.members} />
              </td>
              <td className="px-4 py-3 text-center tabular-nums text-gray-600">{r.games}</td>
              <td className="px-4 py-3 text-center tabular-nums font-bold text-green-700">{r.wins}</td>
              <td className="px-4 py-3 text-center tabular-nums text-gray-500">{r.losses}</td>
              <td className="px-4 py-3 text-center tabular-nums">{Math.round(r.win_rate * 100)}%</td>
              <td className={cn('px-4 py-3 text-center tabular-nums', r.points_balance > 0 ? 'text-green-700' : r.points_balance < 0 ? 'text-red-600' : 'text-gray-500')}>
                {r.points_balance > 0 ? `+${r.points_balance}` : r.points_balance}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PairMembers({ members }) {
  // Wave C.3: nomes/fotos vêm do materializado (server-side). Fallback
  // para id em caso de race condition.
  const list = (members || []).length > 0
    ? members
    : []; // vazio evita usar ids crus
  return (
    <div className="flex flex-wrap items-center gap-2">
      {list.map((m, idx) => (
        <span key={m.id} className="inline-flex items-center gap-1.5">
          {idx > 0 && <span className="text-xs text-gray-500">+</span>}
          <V2Avatar size="xs" name={m.name} photoUrl={m.photo_url} />
          <span className="text-sm">{m.name}</span>
        </span>
      ))}
    </div>
  );
}
