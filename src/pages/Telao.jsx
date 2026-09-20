/**
 * Telao — Modo Telão/TV do torneio.
 *
 * Página pública em tela cheia (fundo escuro, tipografia grande) para exibir num
 * telão durante o evento: jogos em andamento, próximos chamados e resultados
 * recentes. Atualiza sozinha (refetch periódico). Rota /torneios/:id/telao.
 *
 * ⚠️ Esta tela tem a MESMA exposição do telão do dia de jogo — horas numa TV na
 * beira da quadra, atualizando sozinha —, e por isso segue exatamente as mesmas
 * três regras (ver `docs/14-DIA-DE-JOGO-TELAO.md`):
 *
 * 1. **Falha de atualização não apaga o painel.** Numa atualização de fundo o
 *    React Query MANTÉM o dado e só marca `isError`; decidir por `isError` cru
 *    substituiria o quadro inteiro por um aviso, na frente de todo mundo, com o
 *    estado bom ainda na memória.
 * 2. **Continuar mostrando não pode virar mentir.** Passada a tolerância, o
 *    painel DIZ há quanto tempo está parado e o pulso "ao vivo" para de pulsar.
 * 3. **A tela não apaga sozinha.** Sem `wakeLock` o tablet dorme em 30 s–2 min
 *    e alguém precisa cutucá-lo a noite inteira.
 */

import React, { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Radio, Clock, CheckCircle2, MapPin, WifiOff, Sun } from 'lucide-react';
import { telaoConnectionState } from '@/modules/games/domain/telaoConnection';
import { useWakeLock } from '@/core/lib/useWakeLock';
import { useRelogio } from '@/core/lib/useRelogio';
import { getTournament } from '@/modules/tournament/services/tournamentService';
import { listModalities } from '@/modules/tournament/services/modalityService';
import { listAllMatchesForModality } from '@/modules/tournament/services/matchService';
import { listRegistrations } from '@/modules/tournament/services/registrationService';
import { categorizeBoardMatches } from '@/modules/tournament/domain/tournamentBoard';

function regLabel(reg) {
  if (!reg) return '';
  return reg.label || `${reg.player_a_name || ''}${reg.player_b_name ? ' / ' + reg.player_b_name : ''}`.trim();
}

function sideLabel(ids, labelById) {
  return (ids || []).map((id) => labelById.get(id) || '—').join(' / ') || 'A definir';
}

async function loadBoard(tournamentId) {
  const [tournament, modalities] = await Promise.all([
    getTournament(tournamentId),
    listModalities(tournamentId),
  ]);
  const perModality = await Promise.all(
    (modalities || []).map(async (m) => {
      const [matches, regs] = await Promise.all([
        listAllMatchesForModality(m.id),
        listRegistrations(m.id),
      ]);
      const labelById = new Map((regs || []).map((r) => [r.id, regLabel(r)]));
      return (matches || []).map((mt) => ({
        ...mt,
        modality_name: m.name,
        side_a_label: sideLabel(mt.side_a_ids, labelById),
        side_b_label: sideLabel(mt.side_b_ids, labelById),
      }));
    }),
  );
  return { tournament, matches: perModality.flat() };
}

function scoreText(m) {
  const games = Array.isArray(m.games) ? m.games : [];
  const a = games.reduce((s, g) => s + (Number(g.a) || 0), 0);
  const b = games.reduce((s, g) => s + (Number(g.b) || 0), 0);
  return `${a} × ${b}`;
}

function timeText(value) {
  if (!value) return '';
  const d = typeof value === 'object' && value.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export default function Telao() {
  const { tournamentId } = useParams();

  const { data, isLoading, isError, dataUpdatedAt } = useQuery({
    queryKey: ['telao', tournamentId],
    queryFn: () => loadBoard(tournamentId),
    enabled: !!tournamentId,
    refetchInterval: 20_000,
  });

  const board = useMemo(() => categorizeBoardMatches(data?.matches || []), [data]);
  const { hora, ms: agoraMs } = useRelogio();
  const { suportado: podeManterAcesa, ativo: telaAcesa } = useWakeLock(true);

  // ⚠️ A decisão sai do domínio, não de `isError` cru: com o quadro em mãos a
  // falha de um ciclo NÃO apaga o telão — ela só passa a ser dita.
  const conexao = telaoConnectionState({
    isError,
    hasData: !!data?.tournament,
    dataUpdatedAt,
    now: agoraMs,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink text-2xl text-white/50">
        Carregando o torneio…
      </div>
    );
  }

  if (!conexao.showBoard) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-ink px-6 text-center">
        <p className="text-2xl font-bold text-white">
          {isError ? 'Não foi possível carregar o torneio' : 'Torneio não encontrado'}
        </p>
        <p className="max-w-md text-lg text-white/50">
          {isError
            ? 'A conexão falhou. O telão volta sozinho assim que a rede voltar.'
            : 'Confira o link recebido — ele pode apontar para um torneio removido.'}
        </p>
        <Link
          to={`/p/${tournamentId}`}
          className="rounded-full bg-acid px-5 py-2.5 font-bold text-ink"
        >
          Ver a página do torneio
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink text-white">
      <div className="mx-auto max-w-[1600px] px-8 py-6">
        {/* ⚠️ Dado velho apresentado como ao vivo manda alguém para a quadra
            errada: é pelo telão que as pessoas sabem quando são chamadas. */}
        {conexao.mode === 'stale' && (
          <div
            role="status"
            className="mb-4 flex items-center justify-center gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-2 text-center text-lg font-bold text-amber-200"
          >
            <WifiOff aria-hidden="true" className="h-5 w-5 shrink-0" />
            {conexao.label}
          </div>
        )}

        <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="min-w-0">
            <h1 className="truncate font-display text-4xl font-bold text-acid">
              {data.tournament.name}
            </h1>
            <p className="mt-1 text-lg text-gray-300">Acompanhe os jogos ao vivo</p>
          </div>

          <div className="ml-auto flex items-center gap-4">
            <div className="text-right">
              <div className="font-display text-3xl font-black tabular-nums text-white">{hora}</div>
              {/* A tela acesa é promessa que o navegador pode recusar. Só se
                  anuncia o que está valendo — prometer e não cumprir faz alguém
                  deixar o tablet sozinho e voltar para uma tela preta. */}
              {podeManterAcesa && telaAcesa && (
                <div className="flex items-center justify-end gap-1.5 text-xs text-white/40">
                  <Sun aria-hidden="true" className="h-3.5 w-3.5" /> Tela sempre acesa
                </div>
              )}
            </div>
            <div
              className={`flex items-center gap-2 text-sm ${
                conexao.mode === 'stale' ? 'text-amber-300' : 'text-gray-400'}`}
            >
              {/* ⚠️ O pulso diz "ao vivo". Mantê-lo pulsando com o dado parado
                  é a própria mentira que este bloco veio tirar da tela. */}
              <Radio
                aria-hidden="true"
                className={`h-5 w-5 ${
                  conexao.mode === 'stale' ? 'text-amber-300' : 'animate-pulse text-acid'}`}
              />
              {conexao.mode === 'stale' ? 'Sem conexão' : 'Atualiza automaticamente'}
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-3">
            {/* Em andamento */}
            <section className="lg:col-span-2">
              <h2 className="mb-3 flex items-center gap-2 text-xl font-bold text-acid">
                <Radio className="h-5 w-5" /> Em andamento ({board.inProgress.length})
              </h2>
              {board.inProgress.length === 0 ? (
                <p className="rounded-2xl border border-white/10 bg-white/5 p-6 text-lg text-gray-400">Nenhum jogo em andamento.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {board.inProgress.map((m) => (
                    <div key={m.id} className="rounded-3xl border border-acid/30 bg-white/5 p-5">
                      <div className="mb-2 flex items-center justify-between text-sm text-gray-400">
                        <span className="flex items-center gap-2">
                          {m.modality_name}
                          {m.group && <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold text-acid">{m.group}</span>}
                        </span>
                        {m.court && <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> Quadra {m.court}</span>}
                      </div>
                      <div className="space-y-1 text-2xl font-bold">
                        <div className="truncate">{m.side_a_label}</div>
                        <div className="truncate text-gray-300">{m.side_b_label}</div>
                      </div>
                      <div className="mt-2 font-display text-3xl font-bold text-acid">{scoreText(m)}</div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Próximos + Recentes */}
            <aside className="space-y-6">
              <section>
                <h2 className="mb-3 flex items-center gap-2 text-xl font-bold text-white">
                  <Clock className="h-5 w-5" /> Próximos
                </h2>
                <div className="space-y-2">
                  {board.upcoming.length === 0 ? (
                    <p className="text-gray-500">Sem próximos jogos.</p>
                  ) : board.upcoming.map((m) => (
                    <div key={m.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span className="flex items-center gap-1.5">
                          {m.modality_name}
                          {m.group && <span className="rounded-full bg-white/10 px-1.5 py-0.5 font-semibold text-acid">{m.group}</span>}
                        </span>
                        <span>{m.court ? `Quadra ${m.court}` : ''} {timeText(m.scheduled_at)}</span>
                      </div>
                      <div className="mt-1 truncate text-lg font-semibold">{m.side_a_label}</div>
                      <div className="truncate text-lg text-gray-300">{m.side_b_label}</div>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h2 className="mb-3 flex items-center gap-2 text-xl font-bold text-white">
                  <CheckCircle2 className="h-5 w-5" /> Resultados recentes
                </h2>
                <div className="space-y-2">
                  {board.recent.length === 0 ? (
                    <p className="text-gray-500">Sem resultados ainda.</p>
                  ) : board.recent.map((m) => (
                    <div key={m.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-3">
                      <div className="min-w-0">
                        {m.group && <div className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-acid/80">{m.group}</div>}
                        <div className="truncate text-base font-semibold">{m.side_a_label}</div>
                        <div className="truncate text-base text-gray-300">{m.side_b_label}</div>
                      </div>
                      <div className="ml-3 shrink-0 font-display text-xl font-bold text-acid">
                        {m.status === 'walkover' ? 'WO' : scoreText(m)}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </aside>
        </div>
      </div>
    </div>
  );
}
