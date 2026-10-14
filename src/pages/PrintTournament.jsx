import React, { useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Printer, Trophy } from 'lucide-react';
import { getTournament } from '@/modules/tournament/services/tournamentService';
import { listModalities } from '@/modules/tournament/services/modalityService';
import { listAllMatchesForModality } from '@/modules/tournament/services/matchService';
import { listRegistrations } from '@/modules/tournament/services/registrationService';
import { computeModalityRankingStructured } from '@/modules/tournament/services/rankingService';
import { MODALITY_FORMAT_LABELS } from '@/modules/tournament/domain/constants';
import { isKnockoutStage } from '@/modules/tournament/domain/bracketLayout';
import { normalizePhases } from '@/modules/tournament/domain/phases';
import V2BracketTree from '@/v2/components/tournament/V2BracketTree';
import { t, fmtData } from '@/core/i18n';

/**
 * Versão para impressão (A4) das chaves, grupos e ranking de um torneio.
 * Inspirado em coderobotics e bracketmaker.app.
 *
 * ⚠️ Aqui a falha silenciosa é a mais cara da plataforma: **o papel sobrevive à
 * tela**. Uma modalidade que não carregou simplesmente não sai na folha, e a
 * folha vai para a mesa da organização parecendo completa — ninguém tem como
 * desconfiar de uma ausência. Por isso, quando alguma consulta falha, o aviso
 * é IMPRESSO junto (nunca `print:hidden`): é melhor a folha dizer que está
 * incompleta do que enganar quem a estiver usando para chamar jogo.
 */
export default function PrintTournament() {
  const { tournamentId } = useParams();
  const {
    data: tournament, isLoading, isError: falhouTorneio, refetch: recarregarTorneio,
  } = useQuery({
    queryKey: ['print', 'tournament', tournamentId],
    queryFn: () => getTournament(tournamentId),
  });
  const {
    data: modalities = [], isError: falhouModalidades, refetch: recarregarModalidades,
  } = useQuery({
    queryKey: ['print', 'modalities', tournamentId],
    queryFn: () => listModalities(tournamentId),
    enabled: !!tournament,
  });

  useEffect(() => {
    document.body.classList.add('print-mode');
    return () => document.body.classList.remove('print-mode');
  }, []);

  if (isLoading) {
    return <p className="p-8 text-sm text-gray-500">{t('Carregando…')}</p>;
  }

  // ⚠️ Antes, QUALQUER desfecho sem torneio ficava em "Carregando…" para
  // sempre: quem ia imprimir as chaves minutos antes do jogo encarava uma
  // reticência eterna, sem saber que havia falhado e sem nada em que clicar.
  if (falhouTorneio) {
    return (
      <div className="p-8 text-sm">
        <p className="font-semibold text-ink">{t('Não foi possível carregar o torneio')}</p>
        <p className="mt-1 text-gray-500">{t('A conexão falhou. O link continua valendo.')}</p>
        <button
          type="button"
          onClick={() => recarregarTorneio()}
          className="mt-3 rounded border px-3 py-1.5 font-semibold hover:bg-paper"
        >
          {t('Tentar de novo')}
        </button>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="p-8 text-sm">
        <p className="font-semibold text-ink">{t('Torneio não encontrado')}</p>
        <p className="mt-1 text-gray-500">
          {t('Confira o link recebido — ele pode apontar para um torneio removido.')}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white text-ink max-w-4xl mx-auto p-8 print:p-0 print:max-w-none">
      <header className="flex items-center justify-between border-b pb-3 mb-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Trophy className="w-5 h-5 text-green-600" /> {tournament.name}
          </h1>
          <p className="text-xs text-gray-500">
            {tournament.city ? `${tournament.city} · ` : ''}
            {t('Código: {invite_code}', { invite_code: tournament.invite_code })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="print:hidden text-sm inline-flex items-center gap-1 px-3 py-1.5 border rounded hover:bg-paper"
        >
          <Printer className="w-4 h-4" /> {t('Imprimir')}
        </button>
      </header>

      {falhouModalidades && (
        <p className="mb-4 rounded border border-amber-400 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
          {t('⚠ Esta folha está INCOMPLETA: a lista de modalidades não carregou. Recarregue a página antes de usá-la.')}{' '}
          <button
            type="button"
            onClick={() => recarregarModalidades()}
            className="print:hidden underline"
          >
            {t('Tentar de novo')}
          </button>
        </p>
      )}

      {modalities.map((m) => (
        <PrintModality key={m.id} modality={m} />
      ))}

      <footer className="text-[10px] text-gray-400 mt-6">
        <Link to={`/p/${tournamentId}`} className="hover:underline">
          {t('plataforma PickleRush — visão pública')}
        </Link>
      </footer>
    </div>
  );
}

function formatPrintTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return fmtData(d, { hour: '2-digit', minute: '2-digit' });
}

function roundLabel(m) {
  if (m.third_place) return t('3º lugar');
  if (m.bracket === 'gf') return m.round === 2 ? t('Final (reset)') : t('Grande final');
  if (m.bracket === 'wb') return t('Venc. R{round}', { round: m.round });
  if (m.bracket === 'lb') return t('Repesc. R{round}', { round: m.round });
  return m.round;
}

function PrintModality({ modality }) {
  const { data: matches = [], isError: falhouJogos } = useQuery({
    queryKey: ['print', 'matches', modality.id, 'all'],
    queryFn: () => listAllMatchesForModality(modality.id),
  });
  const multiPhase = matches.some((m) => (m.stage_index ?? 0) > 0);
  // Mata-mata sai no papel como CHAVE desenhada, não como tabela.
  const fasesConfig = useMemo(() => normalizePhases(modality.stages), [modality.stages]);
  const chavesPorFase = useMemo(() => {
    const porFase = new Map();
    matches.forEach((m) => {
      const k = m.stage_index ?? 0;
      if (!porFase.has(k)) porFase.set(k, []);
      porFase.get(k).push(m);
    });
    return [...porFase.entries()]
      .sort((a, b) => a[0] - b[0])
      .filter(([k, lista]) => isKnockoutStage(fasesConfig[k] || { type: lista[0]?.stage_type }, lista));
  }, [matches, fasesConfig]);
  const fasesChave = useMemo(() => new Set(chavesPorFase.map(([k]) => Number(k))), [chavesPorFase]);
  const jogosEmLista = useMemo(
    () => matches.filter((m) => !fasesChave.has(Number(m.stage_index ?? 0))),
    [matches, fasesChave],
  );
  const { data: rankingData, isError: falhouRanking } = useQuery({
    queryKey: ['print', 'ranking-structured', modality.id],
    queryFn: () => computeModalityRankingStructured(modality.id),
  });
  const rankingPhases = useMemo(
    () => (rankingData?.phases || []).filter((p) => p.played && !fasesChave.has(Number(p.stageIndex))
      && p.groups.some((g) => (g.rows || []).length > 0)),
    [rankingData, fasesChave],
  );
  const showRankingPhaseHeaders = rankingPhases.length > 1;
  const { data: registrations = [], isError: falhouInscritos } = useQuery({
    queryKey: ['print', 'registrations', modality.id],
    queryFn: () => listRegistrations(modality.id),
  });
  const labelById = useMemo(() => {
    const map = new Map();
    registrations.forEach((r) =>
      map.set(r.id, r.label || `${r.player_a_name || ''}${r.player_b_name ? ' / ' + r.player_b_name : ''}`),
    );
    return map;
  }, [registrations]);

  function renderSide(match, key) {
    const ids = match[`${key}_ids`];
    if (Array.isArray(ids) && ids.length > 0) {
      return ids.map((id) => labelById.get(id) || id).join(' + ');
    }
    const raw = match[key];
    if (!raw) return '—';
    return String(raw)
      .split('+')
      .map((id) => labelById.get(id.trim()) || id.trim())
      .join(' + ');
  }

  const hasSchedule = jogosEmLista.some((m) => m.court || m.scheduled_at);
  const hasGroups = jogosEmLista.some((m) => m.group);

  // Sem os inscritos, `renderSide` cai no `id`: a folha sairia com
  // identificadores do banco no lugar dos nomes de quem vai jogar.
  const partesQueFalharam = [
    falhouJogos && t('os jogos'),
    falhouRanking && t('a classificação'),
    falhouInscritos && t('os nomes dos inscritos'),
  ].filter(Boolean);

  return (
    <section className="mb-6 break-inside-avoid print:break-after-page">
      <h2 className="font-semibold text-sm border-b border-ink pb-1 mb-2">
        {modality.name} —{' '}
        <span className="font-normal text-gray-500">
          {MODALITY_FORMAT_LABELS[modality.format] || modality.format}
        </span>
      </h2>

      {partesQueFalharam.length > 0 && (
        <p className="mb-2 rounded border border-amber-400 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-900">
          {t('⚠ Incompleto: não carregou')} {partesQueFalharam.join(' nem ')}.
        </p>
      )}

      {rankingPhases.length > 0 && (
        <div className="mb-3 space-y-3">
          <h3 className="text-xs font-semibold">{t('Classificação')}</h3>
          {rankingPhases.map((phase) => (
            <div key={phase.stageIndex} className="space-y-2">
              {showRankingPhaseHeaders && (
                <div className="text-[11px] font-semibold text-gray-600">
                  {t('Fase')} {phase.stageIndex + 1}{phase.typeLabel ? ` · ${phase.typeLabel}` : ''}
                </div>
              )}
              {phase.groups.filter((g) => (g.rows || []).length > 0).map((group, gi) => (
                <div key={group.name || gi}>
                  {group.name && <div className="text-[11px] font-semibold mb-0.5">{group.name}</div>}
                  <table className="w-full table-fixed border-collapse text-xs">
                    <colgroup>
                      <col className="w-[9%]" />
                      <col className="w-[31%]" />
                      <col className="w-[8%]" />
                      <col className="w-[7%]" />
                      <col className="w-[7%]" />
                      <col className="w-[13%]" />
                      <col className="w-[8%]" />
                      <col className="w-[8%]" />
                      <col className="w-[9%]" />
                    </colgroup>
                    <thead>
                      <tr className="border-b">
                        <th className="py-1 text-left">#</th>
                        <th className="py-1 text-left">{t('Participante')}</th>
                        <th className="py-1 text-center" title={t('Partidas jogadas')}>{t('PJ')}</th>
                        <th className="py-1 text-center" title={t('Vitórias')}>V</th>
                        <th className="py-1 text-center" title={t('Derrotas')}>D</th>
                        <th className="py-1 text-center">{t('Sets')}</th>
                        <th className="py-1 text-center" title={t('Pontos a favor')}>{t('PF')}</th>
                        <th className="py-1 text-center" title={t('Pontos contra')}>{t('PC')}</th>
                        <th className="py-1 text-right">{t('Saldo')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.map((r) => {
                        const balance = (r.points_for || 0) - (r.points_against || 0);
                        return (
                          <tr key={r.key} className="border-b">
                            <td className="py-1 tabular-nums">{r.position}</td>
                            <td className="py-1 truncate" title={r.label}>{r.label}</td>
                            <td className="py-1 text-center tabular-nums">{r.played}</td>
                            <td className="py-1 text-center font-semibold tabular-nums">{r.wins}</td>
                            <td className="py-1 text-center tabular-nums">{r.losses}</td>
                            <td className="py-1 text-center tabular-nums whitespace-nowrap">{r.sets_won}–{r.sets_lost}</td>
                            <td className="py-1 text-center tabular-nums">{r.points_for}</td>
                            <td className="py-1 text-center tabular-nums">{r.points_against}</td>
                            <td className="py-1 text-right font-medium tabular-nums">{balance > 0 ? `+${balance}` : balance}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {chavesPorFase.length > 0 && (
        <div className="mb-3 space-y-3">
          <h3 className="text-xs font-semibold">{t('Chave')}</h3>
          {chavesPorFase.map(([stageIndex, stageMatches]) => (
            <V2BracketTree
              key={stageIndex}
              matches={stageMatches}
              labelById={labelById}
              thirdPlace={Boolean(fasesConfig[stageIndex]?.third_place)}
              double={fasesConfig[stageIndex]?.type === 'double_knockout'}
              title={multiPhase ? t('Fase {v1}', { v1: Number(stageIndex) + 1 }) : undefined}
              larguraMax={700}
            />
          ))}
        </div>
      )}

      {jogosEmLista.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold mb-1">{t('Jogos')}</h3>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b">
                {multiPhase && <th className="py-1 text-left">{t('Fase')}</th>}
                <th className="py-1 text-left">{t('Rod.')}</th>
                {hasGroups && <th className="py-1 text-left">{t('Grupo')}</th>}
                {hasSchedule && <th className="py-1 text-left">{t('Quadra')}</th>}
                {hasSchedule && <th className="py-1 text-left">{t('Horário')}</th>}
                <th className="py-1 text-left">{t('Lado A')}</th>
                <th className="py-1 text-left">{t('Lado B')}</th>
                <th className="py-1 text-right">{t('Placar')}</th>
              </tr>
            </thead>
            <tbody>
              {jogosEmLista.map((m) => (
                <tr key={m.id} className="border-b">
                  {multiPhase && <td className="py-1">{(m.stage_index ?? 0) + 1}</td>}
                  <td className="py-1">{roundLabel(m)}</td>
                  {hasGroups && <td className="py-1">{m.group || '—'}</td>}
                  {hasSchedule && <td className="py-1">{m.court || '—'}</td>}
                  {hasSchedule && <td className="py-1 tabular-nums">{formatPrintTime(m.scheduled_at)}</td>}
                  <td className="py-1">{renderSide(m, 'side_a')}</td>
                  <td className="py-1">{renderSide(m, 'side_b')}</td>
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
