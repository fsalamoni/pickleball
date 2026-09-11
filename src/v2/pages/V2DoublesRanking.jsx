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
 * O estado da lista (busca, amostra mínima, tamanho de página, página) vive na
 * URL. Assim o link é compartilhável, o botão "voltar" do navegador funciona e
 * recarregar a página não joga ninguém de volta para o começo.
 *
 * A AMOSTRA MÍNIMA é, além disso, uma PREFERÊNCIA: fica salva por usuário no
 * navegador (`v2:view:<uid>:ranking:duplas:min-jogos`) e volta sozinha na
 * próxima visita. A URL manda quando vem preenchida — é o que faz um link
 * compartilhado mostrar a mesma coisa para quem abre —, mas só mexer no
 * seletor grava a preferência: abrir o link de outra pessoa não reescreve a
 * sua escolha.
 *
 * Nada disso toca o banco de dados.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Users2, Search } from 'lucide-react';
import { useDoublesRanking } from '@/modules/rating/hooks/useRating';
import {
  filterByMinGames, DOUBLES_MIN_GAMES_OPTIONS, DEFAULT_DOUBLES_MIN_GAMES,
} from '@/modules/rating/domain/doublesRanking';
import { paginate, normalizePageSize, DEFAULT_PAGE_SIZE } from '@/core/domain/pagination';
import { readNumericPreference, writeViewPreference } from '@/core/lib/viewPreference';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import {
  V2Avatar, V2EmptyState, V2PageIntro, V2SearchInput, V2Select, V2Skeleton, V2Surface,
} from '@/v2/ui/primitives';
import V2Pagination from '@/v2/ui/V2Pagination';
import { cn } from '@/core/lib/utils';

/**
 * Id da preferência salva. É um CONTRATO: mudar esta string apaga, de uma vez,
 * a escolha já salva de todo mundo.
 */
const PREF_MIN_JOGOS = 'ranking:duplas:min-jogos';

/** Rótulo de cada mínimo oferecido. */
function rotuloMinimo(n) {
  return n <= 1 ? 'Todas as duplas' : `${n}+ jogos`;
}

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
  const { user } = useAuth();

  const q = params.get('q') || '';
  const pageSize = normalizePageSize(params.get('tam') || DEFAULT_PAGE_SIZE);
  const page = Math.max(1, Number(params.get('pag')) || 1);

  // AMOSTRA MÍNIMA — a URL manda quando vem preenchida (é o que faz um link
  // compartilhado mostrar a mesma coisa); sem ela, vale a escolha desta
  // pessoa; sem as duas, o padrão (todas as duplas).
  //
  // A escolha fica em ESTADO, semeado da preferência salva, e não numa leitura
  // direta do storage a cada render. É o que faz "voltar para Todas" (que
  // APAGA a preferência e limpa a URL) ter efeito na hora — lendo o storage
  // memoizado, a tela continuaria mostrando o recorte antigo até recarregar.
  const [minEscolhido, setMinEscolhido] = useState(() => readNumericPreference(
    user?.uid, PREF_MIN_JOGOS, DOUBLES_MIN_GAMES_OPTIONS, DEFAULT_DOUBLES_MIN_GAMES,
  ));

  // Trocou de conta no meio da sessão (entrar, sair): a escolha passa a ser a
  // de quem está logado agora, não a herdada da tela anterior.
  useEffect(() => {
    setMinEscolhido(readNumericPreference(
      user?.uid, PREF_MIN_JOGOS, DOUBLES_MIN_GAMES_OPTIONS, DEFAULT_DOUBLES_MIN_GAMES,
    ));
  }, [user?.uid]);

  const minDaUrl = params.get('min');
  const minGames = minDaUrl !== null && DOUBLES_MIN_GAMES_OPTIONS.includes(Number(minDaUrl))
    ? Number(minDaUrl)
    : minEscolhido;

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

  /**
   * O recorte por amostra mínima vem ANTES da busca, e é o único que renumera:
   * ele redefine quem disputa o ranking. A busca é "encontre esta dupla" e
   * preserva a posição que a linha já tem.
   */
  const recortado = useMemo(() => filterByMinGames(ranking, minGames), [ranking, minGames]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return recortado;
    return recortado.filter((row) => (row.players || []).some(
      (p) => (p.name || '').toLowerCase().includes(term),
    ));
  }, [recortado, q]);

  const pageData = useMemo(() => paginate(filtered, page, pageSize), [filtered, page, pageSize]);

  /**
   * Trocar a amostra mínima: grava a PREFERÊNCIA deste usuário, reflete na URL
   * e volta para a primeira página (o recorte mudou, a página 7 pode não
   * existir mais). Voltar ao padrão APAGA a preferência em vez de gravá-la —
   * assim quem nunca escolheu e quem voltou ao padrão ficam no mesmo estado.
   */
  const escolherMinimo = (valor) => {
    const n = DOUBLES_MIN_GAMES_OPTIONS.includes(Number(valor))
      ? Number(valor) : DEFAULT_DOUBLES_MIN_GAMES;
    const ehPadrao = n === DEFAULT_DOUBLES_MIN_GAMES;
    setMinEscolhido(n);
    writeViewPreference(user?.uid, PREF_MIN_JOGOS, ehPadrao ? null : n);
    atualizar({ min: ehPadrao ? null : n, pag: null });
  };

  const recorteAtivo = minGames > DEFAULT_DOUBLES_MIN_GAMES;

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

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="max-w-sm flex-1">
          <V2SearchInput
            value={q}
            // Buscar volta para a primeira página: continuar na 5 depois de
            // filtrar quase sempre cai numa tela vazia.
            onChange={(e) => atualizar({ q: e.target.value, pag: null })}
            placeholder="Buscar atleta na dupla…"
            icon={Search}
          />
        </div>

        <div className="shrink-0">
          <label htmlFor="duplas-min-jogos" className="mb-1 block text-xs font-semibold text-gray-500">
            Amostra mínima
          </label>
          <V2Select
            id="duplas-min-jogos"
            value={String(minGames)}
            onChange={(e) => escolherMinimo(e.target.value)}
            options={DOUBLES_MIN_GAMES_OPTIONS.map((n) => ({
              value: String(n), label: rotuloMinimo(n),
            }))}
            className="w-44"
          />
        </div>
      </div>

      {recorteAtivo && (
        <p className="mb-4 rounded-2xl bg-paper px-4 py-2.5 text-xs leading-5 text-gray-500">
          Vendo apenas duplas com <strong className="text-ink">{minGames} jogos ou mais</strong>,
          numeradas <strong className="text-ink">entre elas</strong>. A posição no ranking geral
          aparece ao lado. Esta escolha fica salva para as suas próximas visitas.
        </p>
      )}

      {isLoading ? (
        <V2Skeleton className="h-64 rounded-4xl" />
      ) : filtered.length === 0 ? (
        <V2Surface>
          {/* Três vazios diferentes: dizer QUAL filtro esvaziou a tela é a
              diferença entre "ajuste o filtro" e "a plataforma está quebrada". */}
          <V2EmptyState
            icon={Users2}
            title={
              q ? 'Nenhuma dupla encontrada'
                : recorteAtivo ? `Nenhuma dupla com ${minGames}+ jogos`
                  : 'Sem duplas ranqueadas ainda'
            }
            description={
              q ? 'Nenhuma parceria tem atleta com esse nome. Tente outro termo.'
                : recorteAtivo
                  ? `Ainda não há parceria com ${minGames} jogos ou mais. Reduza a amostra mínima para ver as demais.`
                  : 'Assim que houver jogos de duplas finalizados, as parcerias aparecem aqui.'
            }
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
                      <td className="px-4 py-3 font-bold text-ink">
                        {medal || pos}
                        {/* Com recorte ativo, a posição no ranking geral fica
                            visível ao lado — a numeração muda, a informação não
                            se perde. */}
                        {recorteAtivo && (
                          <span
                            className="ml-1.5 align-middle text-[11px] font-normal text-gray-400"
                            title={`Posição ${row.overall_position} no ranking geral`}
                          >
                            #{row.overall_position}
                          </span>
                        )}
                      </td>
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
