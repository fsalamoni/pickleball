/**
 * AdminDuprExportTab — Exportação de partidas para o DUPR (platform_admin).
 *
 * Flag: `dupr_match_export`. Fica no painel administrativo (seção Governança).
 * Permite ao admin FILTRAR o histórico de partidas decididas da plataforma
 * (por data, torneio, dia de jogo, clube, evento, atleta, tipo e origem) e
 * BAIXAR um CSV no formato exato de importação de partidas de clubes do DUPR
 * (27 colunas). Somente leitura — não altera nenhum dado.
 *
 * A base é a MESMA do ranking oficial: torneios (`tournament_matches`) + dias
 * de jogo/eventos/confrontos publicados (`club_event_games`). Partidas cujos
 * jogadores ainda não têm ID DUPR ficam marcadas como "incompletas" e podem
 * ser omitidas do arquivo (o DUPR exige o ID de cada jogador).
 */

import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Download, Filter, RotateCcw, Trophy, Users,
  AlertTriangle, CheckCircle2, ListChecks, Info,
} from 'lucide-react';
import { useDuprExportData, useRecordDuprExport } from '@/modules/rating/hooks/useDuprExport';
import {
  DUPR_MATCH_TYPE,
  DUPR_SCORE_TYPE,
  DUPR_SCORE_TYPE_LABELS,
  DUPR_EXPORT_SOURCE,
  DUPR_EXPORT_SOURCE_LABELS,
  filterExportMatches,
  buildDuprEntries,
  summarizeEntries,
  buildFilterOptions,
  buildDuprCsv,
  entriesToRows,
  duprCsvFilename,
} from '@/modules/rating/domain/duprMatchExport';
import {
  V2Surface, V2Button, V2Field, V2Input, V2Select, V2Toggle,
  V2Badge, V2StatCard, V2EmptyState, V2Skeleton, V2PageIntro,
} from '@/v2/ui/primitives';

const PREVIEW_LIMIT = 60;

const EMPTY_FILTERS = {
  dateFrom: '', dateTo: '', source: '', matchType: '',
  tournamentId: '', gameDayId: '', clubId: '', eventId: '', athleteUid: '',
};

/** Opção "todas" + a lista derivada, cada uma com contagem. */
function withAllOption(list, allLabel) {
  return [{ value: '', label: allLabel }, ...list.map((o) => ({ value: o.value, label: `${o.label} (${o.count})` }))];
}

export default function AdminDuprExportTab() {
  const { data, isLoading, isError, refetch, isFetching } = useDuprExportData(true);
  const recordExport = useRecordDuprExport();

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [scoreType, setScoreType] = useState(DUPR_SCORE_TYPE.SIDEOUT);
  const [readyOnly, setReadyOnly] = useState(true);
  const [includeExternalId, setIncludeExternalId] = useState(true);

  const set = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }));

  const matches = useMemo(() => data?.matches || [], [data]);
  const profileById = data?.profileById;
  const maps = data?.maps;

  // Opções de filtro derivadas da base COMPLETA (todas as origens).
  const options = useMemo(
    () => buildFilterOptions(matches, { profileById, ...(maps || {}) }),
    [matches, profileById, maps],
  );

  const filtered = useMemo(
    () => filterExportMatches(matches, filters),
    [matches, filters],
  );

  const entries = useMemo(
    () => buildDuprEntries(filtered, profileById, { scoreType, includeExternalId }),
    [filtered, profileById, scoreType, includeExternalId],
  );

  const summary = useMemo(() => summarizeEntries(entries), [entries]);

  const exportableCount = readyOnly ? summary.ready : summary.total;

  const preview = useMemo(() => entries.slice(0, PREVIEW_LIMIT), [entries]);

  const resetFilters = () => setFilters(EMPTY_FILTERS);

  const handleDownload = () => {
    const rows = entriesToRows(entries, { readyOnly });
    if (rows.length === 0) {
      toast.error('Nenhuma partida para exportar com os filtros atuais.');
      return;
    }
    const csv = buildDuprCsv(rows);
    // SEM BOM: o BOM corromperia o cabeçalho "matchType" e quebraria a
    // detecção de colunas obrigatórias no importador do DUPR.
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = duprCsvFilename(filters);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    recordExport.mutate({
      total: rows.length,
      ready: summary.ready,
      incomplete: summary.incomplete,
      singles: summary.singles,
      doubles: summary.doubles,
      filters,
    });
    toast.success(`${rows.length} partida(s) exportada(s) para CSV do DUPR.`);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <V2Skeleton lines={2} />
        <V2Skeleton className="h-40" />
      </div>
    );
  }

  if (isError) {
    return (
      <V2EmptyState
        icon={AlertTriangle}
        title="Não foi possível carregar as partidas"
        description="Tente novamente em instantes."
        action={<V2Button onClick={() => refetch()}>Tentar de novo</V2Button>}
      />
    );
  }

  return (
    <div className="space-y-6">
      <V2PageIntro
        title="Exportar partidas para o DUPR"
        subtitle="Gere um CSV no formato de importação de partidas de clubes do DUPR a partir do histórico oficial da plataforma."
      />

      <V2Surface className="border-l-4 border-l-acid p-4">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-acid" />
          <div className="text-sm leading-6 text-gray-600">
            <p>
              A base são as <strong>partidas decididas registradas no ranking</strong> da
              plataforma: torneios, dias de jogo, eventos de clube e confrontos por equipes.
              W.O./partidas sem placar não entram.
            </p>
            <p className="mt-1">
              O DUPR exige o <strong>ID DUPR</strong> de cada jogador. Partidas com algum
              atleta sem ID ficam marcadas como <em>incompletas</em> — mantenha a opção
              &ldquo;Somente partidas prontas&rdquo; ligada para gerar um arquivo válido.
            </p>
          </div>
        </div>
      </V2Surface>

      {/* Filtros */}
      <V2Surface className="p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Filter className="h-4 w-4" /> Filtros da extração
          </div>
          <V2Button variant="ghost" size="sm" onClick={resetFilters}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Limpar
          </V2Button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <V2Field label="Data inicial" htmlFor="dupr-date-from">
            <V2Input id="dupr-date-from" type="date" value={filters.dateFrom} onChange={set('dateFrom')} />
          </V2Field>
          <V2Field label="Data final" htmlFor="dupr-date-to">
            <V2Input id="dupr-date-to" type="date" value={filters.dateTo} onChange={set('dateTo')} />
          </V2Field>
          <V2Field label="Origem" htmlFor="dupr-source">
            <V2Select
              id="dupr-source"
              value={filters.source}
              onChange={set('source')}
              options={[
                { value: '', label: 'Todas as origens' },
                ...Object.values(DUPR_EXPORT_SOURCE).map((v) => ({ value: v, label: DUPR_EXPORT_SOURCE_LABELS[v] })),
              ]}
            />
          </V2Field>
          <V2Field label="Tipo de partida" htmlFor="dupr-type">
            <V2Select
              id="dupr-type"
              value={filters.matchType}
              onChange={set('matchType')}
              options={[
                { value: '', label: 'Simples e duplas' },
                { value: DUPR_MATCH_TYPE.SINGLES, label: 'Somente simples' },
                { value: DUPR_MATCH_TYPE.DOUBLES, label: 'Somente duplas' },
              ]}
            />
          </V2Field>
          <V2Field label="Torneio" htmlFor="dupr-tournament">
            <V2Select
              id="dupr-tournament"
              value={filters.tournamentId}
              onChange={set('tournamentId')}
              options={withAllOption(options.tournaments, 'Todos os torneios')}
            />
          </V2Field>
          <V2Field label="Dia de jogo" htmlFor="dupr-gameday">
            <V2Select
              id="dupr-gameday"
              value={filters.gameDayId}
              onChange={set('gameDayId')}
              options={withAllOption(options.gameDays, 'Todos os dias de jogo')}
            />
          </V2Field>
          <V2Field label="Clube" htmlFor="dupr-club">
            <V2Select
              id="dupr-club"
              value={filters.clubId}
              onChange={set('clubId')}
              options={withAllOption(options.clubs, 'Todos os clubes')}
            />
          </V2Field>
          <V2Field label="Evento de clube" htmlFor="dupr-event">
            <V2Select
              id="dupr-event"
              value={filters.eventId}
              onChange={set('eventId')}
              options={withAllOption(options.events, 'Todos os eventos')}
            />
          </V2Field>
          <V2Field label="Atleta" htmlFor="dupr-athlete">
            <V2Select
              id="dupr-athlete"
              value={filters.athleteUid}
              onChange={set('athleteUid')}
              options={withAllOption(options.athletes, 'Todos os atletas')}
            />
          </V2Field>
          <V2Field label="Tipo de pontuação (DUPR)" htmlFor="dupr-scoretype">
            <V2Select
              id="dupr-scoretype"
              value={scoreType}
              onChange={(e) => setScoreType(e.target.value)}
              options={Object.values(DUPR_SCORE_TYPE).map((v) => ({ value: v, label: DUPR_SCORE_TYPE_LABELS[v] }))}
            />
          </V2Field>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <V2Toggle
            id="dupr-ready-only"
            checked={readyOnly}
            onChange={setReadyOnly}
            label="Somente partidas prontas"
            hint="Exclui do CSV as partidas com algum jogador sem ID DUPR."
          />
          <V2Toggle
            id="dupr-external-id"
            checked={includeExternalId}
            onChange={setIncludeExternalId}
            label="Incluir ID interno (externalId)"
            hint="Preenche o externalId do DUPR com o id do atleta na plataforma."
          />
        </div>
      </V2Surface>

      {/* Resumo */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <V2StatCard icon={ListChecks} label="Partidas filtradas" value={summary.total} accent="ink" />
        <V2StatCard icon={CheckCircle2} label="Prontas (com ID)" value={summary.ready} accent="green" />
        <V2StatCard icon={AlertTriangle} label="Incompletas" value={summary.incomplete} accent={summary.incomplete ? 'acid' : 'ink'} />
        <V2StatCard icon={Users} label="Simples" value={summary.singles} accent="ink" />
        <V2StatCard icon={Users} label="Duplas" value={summary.doubles} accent="ink" />
      </div>

      {summary.incomplete > 0 && (
        <V2Surface className="border-l-4 border-l-amber-400 bg-amber-50/60 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <p className="text-sm leading-6 text-amber-900">
              <strong>{summary.incomplete}</strong> partida(s) têm jogadores sem ID DUPR e
              não entrarão no arquivo enquanto &ldquo;Somente partidas prontas&rdquo; estiver ligado.
              Peça a esses atletas para cadastrar o ID DUPR no perfil.
            </p>
          </div>
        </V2Surface>
      )}

      {/* Ação de download */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          {exportableCount > 0
            ? <>Pronto para exportar <strong className="text-ink">{exportableCount}</strong> partida(s).</>
            : 'Nenhuma partida para exportar com os filtros atuais.'}
        </p>
        <V2Button onClick={handleDownload} disabled={exportableCount === 0 || isFetching}>
          <Download className="mr-2 h-4 w-4" /> Baixar CSV do DUPR
        </V2Button>
      </div>

      {/* Pré-visualização */}
      {entries.length === 0 ? (
        <V2EmptyState
          icon={Trophy}
          title="Nenhuma partida encontrada"
          description="Ajuste os filtros para encontrar partidas decididas na plataforma."
        />
      ) : (
        <V2Surface className="overflow-hidden p-0">
          <div className="border-b border-gray-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Pré-visualização {entries.length > PREVIEW_LIMIT ? `(primeiras ${PREVIEW_LIMIT} de ${entries.length})` : `(${entries.length})`}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
                  <th className="px-4 py-2 font-semibold">Data</th>
                  <th className="px-4 py-2 font-semibold">Evento</th>
                  <th className="px-4 py-2 font-semibold">Tipo</th>
                  <th className="px-4 py-2 font-semibold">Time A</th>
                  <th className="px-4 py-2 font-semibold">Time B</th>
                  <th className="px-4 py-2 font-semibold">Placar</th>
                  <th className="px-4 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((e, i) => {
                  const r = e.row;
                  const teamA = [r.playerA1, r.playerA2].filter(Boolean).join(' / ');
                  const teamB = [r.playerB1, r.playerB2].filter(Boolean).join(' / ');
                  const score = [1, 2, 3, 4, 5]
                    .map((n) => (r[`teamAGame${n}`] !== '' ? `${r[`teamAGame${n}`]}-${r[`teamBGame${n}`]}` : null))
                    .filter(Boolean)
                    .join(', ');
                  return (
                    <tr key={`${e.at}-${i}`} className="border-b border-gray-50 last:border-0">
                      <td className="whitespace-nowrap px-4 py-2 text-gray-500">{r.date || '—'}</td>
                      <td className="px-4 py-2 text-ink">{r.event}</td>
                      <td className="px-4 py-2 text-gray-500">{r.matchType === 'D' ? 'Duplas' : 'Simples'}</td>
                      <td className="px-4 py-2 text-ink">{teamA || '—'}</td>
                      <td className="px-4 py-2 text-ink">{teamB || '—'}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-gray-500">{score || '—'}</td>
                      <td className="px-4 py-2">
                        {e.ready
                          ? <V2Badge tone="green">Pronta</V2Badge>
                          : <V2Badge tone="amber" title={`Sem ID DUPR: ${e.missing.join(', ')}`}>Falta ID</V2Badge>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </V2Surface>
      )}
    </div>
  );
}
