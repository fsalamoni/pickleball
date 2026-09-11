/**
 * V2DoublesRanking — Ranking de duplas. Rota /ranking/duplas.
 *
 * Classifica as PARCERIAS (dois atletas jogando juntos) pelos jogos de duplas
 * já finalizados, na ordem: aproveitamento → vitórias → derrotas → saldo.
 *
 * A classificação NÃO é feita aqui. Ela vem pronta do banco
 * (`doubles_rankings`), reescrita pelo servidor a cada resultado publicado —
 * inclusive a `position` de cada linha. A tela só filtra, pagina e desenha.
 * Foi de propósito: a numeração que o usuário lê tem de ser a mesma que o
 * servidor calculou, e não uma reordenação feita no navegador.
 *
 * O estado da lista (busca, tamanho de página, página) vive na URL. Assim o
 * link é compartilhável, o botão "voltar" do navegador funciona e recarregar a
 * página não joga ninguém de volta para o começo.
 */

import React, { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Users2, Search } from 'lucide-react';
import { useDoublesRanking } from '@/modules/rating/hooks/useRating';
import { paginate, normalizePageSize, DEFAULT_PAGE_SIZE } from '@/core/domain/pagination';
import {
  V2Avatar, V2EmptyState, V2PageIntro, V2SearchInput, V2Skeleton, V2Surface,
} from '@/v2/ui/primitives';
import V2Pagination from '@/v2/ui/V2Pagination';
import { cn } from '@/core/lib/utils';

function medalEmoji(position) {
  if (position === 1) return '🥇';
  if (position === 2) return '🥈';
  if (position === 3) return '🥉';
  return null;
}

/** Aproveitamento como texto: é o critério principal, então não some no arredondamento. */
function aproveitamento(winRate) {
  return `${Math.round((Number(winRate) || 0) * 100)}%`;
}

export default function V2DoublesRanking() {
  const { data: ranking = [], isLoading } = useDoublesRanking(true);
  const [params, setParams] = useSearchParams();

  const q = params.get('q') || '';
  const pageSize = normalizePageSize(params.get('tam') || DEFAULT_PAGE_SIZE);
  const page = Math.max(1, Number(params.get('pag')) || 1);

  /** Atualiza a URL preservando o resto do estado. Sem histórico: a lista não
   *  deve encher o botão "voltar" de passos intermediários. */
  const atualizar = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => {
      if (v === '' || v == null) next.delete(k);
      else next.set(k, String(v));
    });
    setParams(next, { replace: true });
  };

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return ranking;
    return ranking.filter((row) => (row.players || []).some(
      (p) => (p.name || '').toLowerCase().includes(term),
    ));
  }, [ranking, q]);

  const pageData = useMemo(() => paginate(filtered, page, pageSize), [filtered, page, pageSize]);

  return (
    <div className="mx-auto max-w-[900px]">
      <V2PageIntro
        title="Ranking de duplas"
        subtitle="Parcerias classificadas por aproveitamento. Empate é decidido por mais vitórias, menos derrotas e saldo de pontos, nessa ordem."
        action={(
          <Link to="/ranking" className="text-sm font-semibold text-green-700 underline">
            Ver ranking individual
          </Link>
        )}
      />

      <div className="mb-4 max-w-sm">
        <V2SearchInput
          value={q}
          // Buscar volta para a primeira página: continuar na 5 depois de
          // filtrar quase sempre cai numa tela vazia.
          onChange={(e) => atualizar({ q: e.target.value, pag: null })}
          placeholder="Buscar atleta na dupla…"
          icon={Search}
        />
      </div>

      {isLoading ? (
        <V2Skeleton className="h-64 rounded-4xl" />
      ) : filtered.length === 0 ? (
        <V2Surface>
          <V2EmptyState
            icon={Users2}
            title={q ? 'Nenhuma dupla encontrada' : 'Sem duplas ranqueadas ainda'}
            description={q
              ? 'Nenhuma parceria tem atleta com esse nome. Tente outro termo.'
              : 'Assim que houver jogos de duplas finalizados, as parcerias aparecem aqui.'}
          />
        </V2Surface>
      ) : (
        <V2Surface className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">
                Ranking de duplas, classificado por aproveitamento
              </caption>
              <thead className="bg-paper text-left text-[11px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th scope="col" className="px-4 py-3">#</th>
                  <th scope="col" className="px-4 py-3">Dupla</th>
                  <th scope="col" className="px-4 py-3 text-center">J</th>
                  <th scope="col" className="px-4 py-3 text-center">V</th>
                  <th scope="col" className="px-4 py-3 text-center">D</th>
                  {/* Aproveitamento é o critério principal — destacado na tabela. */}
                  <th scope="col" className="px-4 py-3 text-center font-bold text-ink">Aprov.</th>
                  <th scope="col" className="px-4 py-3 text-center">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {pageData.pageItems.map((row) => {
                  const pos = row.position;
                  const medal = medalEmoji(pos);
                  return (
                    <tr key={row.pair_key} className="border-t border-gray-100">
                      <td className="px-4 py-3 font-bold text-ink">{medal || pos}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex -space-x-2">
                            {(row.players || []).map((p) => (
                              <V2Avatar key={p.id} name={p.name} photoUrl={p.photo} size="sm" />
                            ))}
                          </div>
                          <span className="font-semibold text-ink">
                            {(row.players || []).map((p) => p.name).join(' & ')}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center tabular-nums text-gray-600">{row.games}</td>
                      <td className="px-4 py-3 text-center tabular-nums font-bold text-green-700">{row.wins}</td>
                      <td className="px-4 py-3 text-center tabular-nums text-gray-500">{row.losses}</td>
                      <td className="px-4 py-3 text-center tabular-nums font-bold text-ink">
                        {aproveitamento(row.win_rate)}
                      </td>
                      <td className={cn(
                        'px-4 py-3 text-center tabular-nums',
                        row.points_balance > 0 ? 'text-green-700'
                          : row.points_balance < 0 ? 'text-red-600' : 'text-gray-500',
                      )}
                      >
                        {row.points_balance > 0 ? `+${row.points_balance}` : row.points_balance}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <V2Pagination
            data={pageData}
            itemLabel="duplas"
            idPrefix="duplas"
            onPage={(p) => atualizar({ pag: p === 1 ? null : p })}
            // Trocar o tamanho volta para a primeira página: a página 7 de 20
            // itens não existe quando passam a caber 100 por tela.
            onPageSize={(s) => atualizar({ tam: s === DEFAULT_PAGE_SIZE ? null : s, pag: null })}
          />
        </V2Surface>
      )}
    </div>
  );
}
