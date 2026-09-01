/**
 * AdminDuprExportTab — Exportação de partidas para o DUPR (platform_admin).
 *
 * Flag: `dupr_match_export`. Fica no painel administrativo (seção Governança).
 * Permite ao admin FILTRAR o histórico de partidas decididas da plataforma
 * (por data, torneio, dia de jogo, clube, evento, atleta, tipo e origem) e
 * BAIXAR um CSV no formato exato de importação de partidas de clubes do DUPR
 * (27 colunas). Somente leitura — não altera nenhum dado de partida.
 *
 * A base é a MESMA do ranking oficial: torneios (`tournament_matches`) + dias
 * de jogo/eventos/confrontos publicados (`club_event_games`). Partidas cujos
 * jogadores ainda não têm ID DUPR ficam marcadas como "incompletas" e podem
 * ser omitidas do arquivo (o DUPR exige o ID de cada jogador).
 *
 * ANTIDUPLICAÇÃO (ledger `dupr_export_log`): cada download registra QUAIS
 * partidas foram exportadas e QUANDO. O admin pode marcar partidas como já
 * "lançadas no DUPR". A coluna "Situação DUPR" mostra pendente/exportada/
 * lançada. Com a flag `dupr_official_sync` ligada, é possível colar o histórico
 * de partidas do DUPR (JSON) para CONFERIR quais já constam lá (por identifier/
 * impressão digital) e marcá-las como "confirmadas" — evitando relançar dados.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Download, Filter, RotateCcw, Trophy, Users,
  AlertTriangle, CheckCircle2, ListChecks, Info,
  ArrowUp, ArrowDown, ArrowUpDown, ChevronLeft, ChevronRight,
  ClipboardCheck, ClipboardList, CheckCheck, History,
} from 'lucide-react';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import {
  useDuprExportData, useRecordDuprExport, useDuprLedger, useRecordDuprLedger,
} from '@/modules/rating/hooks/useDuprExport';
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
  DUPR_PAGE_SIZES,
  DEFAULT_DUPR_PAGE_SIZE,
  DUPR_SORT_KEY,
  DUPR_SORT_DIR,
  sortDuprEntries,
  paginate,
} from '@/modules/rating/domain/duprExportView';
import {
  EXPORT_STATUS,
  EXPORT_STATUS_LABELS,
  EXPORT_STATUS_TONE,
  buildReconciliationView,
  summarizeSituations,
  filterBySituation,
  latestExportInfo,
  parseDuprHistory,
  buildDuprIndex,
} from '@/modules/rating/domain/duprReconcile';
import {
  V2Surface, V2Button, V2Field, V2Input, V2Select, V2Toggle, V2Textarea,
  V2Badge, V2StatCard, V2EmptyState, V2Skeleton, V2PageIntro,
} from '@/v2/ui/primitives';

const EMPTY_FILTERS = {
  dateFrom: '', dateTo: '', source: '', matchType: '',
  tournamentId: '', gameDayId: '', clubId: '', eventId: '', athleteUid: '',
};

/** Opção "todas" + a lista derivada, cada uma com contagem. */
function withAllOption(list, allLabel) {
  return [{ value: '', label: allLabel }, ...list.map((o) => ({ value: o.value, label: `${o.label} (${o.count})` }))];
}

/** Formata um timestamp (ms) em data/hora pt-BR; '—' quando ausente. */
function formatDateTime(ms) {
  if (!ms) return '—';
  try {
    return new Date(ms).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '—';
  }
}

/** Cabeçalho de coluna clicável que ordena por `sortKey`. */
function SortHeader({ label, sortKey, active, dir, onSort, className = '' }) {
  const Icon = !active ? ArrowUpDown : (dir === DUPR_SORT_DIR.ASC ? ArrowUp : ArrowDown);
  return (
    <th className={`px-4 py-2 font-semibold ${className}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 transition-colors hover:text-ink ${active ? 'text-ink' : ''}`}
        aria-label={`Ordenar por ${label}`}
      >
        {label}
        <Icon className="h-3.5 w-3.5" />
      </button>
    </th>
  );
}

export default function AdminDuprExportTab() {
  const { data, isLoading, isError, refetch, isFetching } = useDuprExportData(true);
  const recordExport = useRecordDuprExport();

  // Conferência oficial (flag reservada): só habilita o painel de importação do
  // histórico do DUPR quando `dupr_official_sync` está ligada.
  const officialSyncOn = useFeatureFlag(FEATURE_FLAG.DUPR_OFFICIAL_SYNC);

  // Ledger de exportação (antiduplicação). Leitura leve, cacheada.
  const { data: ledgerData } = useDuprLedger(true);
  const recordLedger = useRecordDuprLedger();
  const ledgerByKey = useMemo(() => ledgerData || new Map(), [ledgerData]);

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [scoreType, setScoreType] = useState(DUPR_SCORE_TYPE.SIDEOUT);
  const [readyOnly, setReadyOnly] = useState(true);
  const [includeExternalId, setIncludeExternalId] = useState(true);

  // Tabela: ordenação, paginação e filtro por situação DUPR.
  const [sortKey, setSortKey] = useState(DUPR_SORT_KEY.DATE);
  const [sortDir, setSortDir] = useState(DUPR_SORT_DIR.DESC);
  const [pageSize, setPageSize] = useState(DEFAULT_DUPR_PAGE_SIZE);
  const [page, setPage] = useState(1);
  const [situationFilter, setSituationFilter] = useState('');

  // Conferência: texto colado do histórico DUPR (aplicado sob demanda).
  const [historyText, setHistoryText] = useState('');
  const [historyApplied, setHistoryApplied] = useState('');

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

  // Índice do histórico DUPR (só quando a conferência oficial está ligada).
  const duprIndex = useMemo(() => {
    if (!officialSyncOn || !historyApplied.trim()) return null;
    const records = parseDuprHistory(historyApplied);
    return records.length > 0
      ? buildDuprIndex(records)
      : { byFingerprint: new Set(), byIdentifier: new Set(), byMatchCode: new Set(), count: 0 };
  }, [officialSyncOn, historyApplied]);

  // Conferência: anexa a cada entry a "situação DUPR" (pendente/exportada/
  // lançada/confirmada) a partir do ledger local + índice do histórico DUPR.
  const view = useMemo(
    () => buildReconciliationView(entries, { ledgerByKey, duprIndex }),
    [entries, ledgerByKey, duprIndex],
  );

  const situations = useMemo(() => summarizeSituations(view), [view]);

  const viewBySituation = useMemo(
    () => filterBySituation(view, situationFilter),
    [view, situationFilter],
  );

  const sorted = useMemo(
    () => sortDuprEntries(viewBySituation, sortKey, sortDir),
    [viewBySituation, sortKey, sortDir],
  );

  const pageData = useMemo(
    () => paginate(sorted, page, pageSize),
    [sorted, page, pageSize],
  );

  const lastExport = useMemo(() => latestExportInfo(ledgerByKey), [ledgerByKey]);

  const exportableCount = readyOnly ? summary.ready : summary.total;

  // Entries efetivamente exportáveis (base do registro no ledger).
  const exportableEntries = useMemo(
    () => (readyOnly ? entries.filter((e) => e.ready) : entries),
    [entries, readyOnly],
  );

  // Reinicia para a 1ª página quando muda o conjunto/ordenação/paginação.
  useEffect(() => {
    setPage(1);
  }, [filters, situationFilter, sortKey, sortDir, pageSize, scoreType, readyOnly, includeExternalId]);

  const resetFilters = () => {
    setFilters(EMPTY_FILTERS);
    setSituationFilter('');
  };

  const toggleSort = (key) => {
    if (key === sortKey) {
      setSortDir((d) => (d === DUPR_SORT_DIR.ASC ? DUPR_SORT_DIR.DESC : DUPR_SORT_DIR.ASC));
    } else {
      setSortKey(key);
      // Data começa do mais recente; textos/tipos começam do A→Z.
      setSortDir(key === DUPR_SORT_KEY.DATE ? DUPR_SORT_DIR.DESC : DUPR_SORT_DIR.ASC);
    }
  };

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
    // Registra no ledger QUAIS partidas foram exportadas e QUANDO (antiduplicação).
    recordLedger.mutate({ entries: exportableEntries, status: EXPORT_STATUS.EXPORTED, ledgerByKey });
    toast.success(`${rows.length} partida(s) exportada(s) para CSV do DUPR.`);
  };

  // Marca as partidas PRONTAS do recorte atual como "lançadas no DUPR".
  const handleMarkSubmitted = () => {
    const readyView = viewBySituation.filter((e) => e.ready);
    if (readyView.length === 0) {
      toast.error('Nenhuma partida pronta no recorte atual para marcar como lançada.');
      return;
    }
    // eslint-disable-next-line no-alert
    const ok = window.confirm(
      `Marcar ${readyView.length} partida(s) como já lançadas no DUPR? `
      + 'Isso evita reexportá-las por engano. A situação pode ser reajustada exportando novamente.',
    );
    if (!ok) return;
    recordLedger.mutate(
      { entries: readyView, status: EXPORT_STATUS.SUBMITTED, ledgerByKey },
      {
        onSuccess: () => toast.success(`${readyView.length} partida(s) marcada(s) como lançada(s) no DUPR.`),
        onError: () => toast.error('Não foi possível registrar o lançamento. Tente novamente.'),
      },
    );
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

  const situationOptions = [
    { value: '', label: `Todas as situações (${situations.total})` },
    { value: EXPORT_STATUS.PENDING, label: `${EXPORT_STATUS_LABELS.pending} (${situations.pending})` },
    { value: EXPORT_STATUS.EXPORTED, label: `${EXPORT_STATUS_LABELS.exported} (${situations.exported})` },
    { value: EXPORT_STATUS.SUBMITTED, label: `${EXPORT_STATUS_LABELS.submitted} (${situations.submitted})` },
    ...(duprIndex ? [{ value: EXPORT_STATUS.CONFIRMED, label: `${EXPORT_STATUS_LABELS.confirmed} (${situations.confirmed})` }] : []),
  ];

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

      {/* Controle de lançamentos (antiduplicação) */}
      <V2Surface className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <History className="h-4 w-4" /> Controle de lançamentos no DUPR
          </div>
          <V2Button
            variant="secondary"
            size="sm"
            onClick={handleMarkSubmitted}
            disabled={recordLedger.isPending}
          >
            <CheckCheck className="mr-1.5 h-3.5 w-3.5" /> Marcar filtradas como lançadas
          </V2Button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-gray-50 px-3 py-2">
            <div className="text-xs uppercase tracking-wide text-gray-400">Última atividade</div>
            <div className="text-sm font-semibold text-ink">{formatDateTime(lastExport.lastActivityAt)}</div>
          </div>
          <div className="rounded-xl bg-gray-50 px-3 py-2">
            <div className="text-xs uppercase tracking-wide text-gray-400">Já exportadas</div>
            <div className="text-sm font-semibold text-ink">{lastExport.exportedCount}</div>
          </div>
          <div className="rounded-xl bg-gray-50 px-3 py-2">
            <div className="text-xs uppercase tracking-wide text-gray-400">Lançadas no DUPR</div>
            <div className="text-sm font-semibold text-ink">{lastExport.submittedCount}</div>
          </div>
          <div className="rounded-xl bg-gray-50 px-3 py-2">
            <div className="text-xs uppercase tracking-wide text-gray-400">Partidas no ledger</div>
            <div className="text-sm font-semibold text-ink">{lastExport.total}</div>
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
          <V2Field label="Situação DUPR" htmlFor="dupr-situation">
            <V2Select
              id="dupr-situation"
              value={situationFilter}
              onChange={(e) => setSituationFilter(e.target.value)}
              options={situationOptions}
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

      {/* Conferência oficial (flag dupr_official_sync) */}
      {officialSyncOn && (
        <V2Surface className="p-4 sm:p-5">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
            <ClipboardList className="h-4 w-4" /> Conferência com o DUPR (evitar duplicação)
          </div>
          <p className="mb-3 text-sm leading-6 text-gray-600">
            Cole aqui o <strong>histórico de partidas do DUPR</strong> (JSON exportado da API de
            parceiro/clube ou do painel do DUPR). A conferência marca como
            <V2Badge tone="green" className="mx-1">Confirmada no DUPR</V2Badge>
            as partidas que já constam lá, cruzando por <em>identifier</em> determinístico
            (<code>pr_&lt;id&gt;</code>) e por impressão digital (data + tipo + IDs + placar).
            A conferência <strong>em tempo real</strong> exige um backend com credenciais de
            parceiro DUPR (Cloud Function) — o espaço já está reservado para essa fase.
          </p>
          <V2Textarea
            id="dupr-history"
            rows={5}
            value={historyText}
            onChange={(e) => setHistoryText(e.target.value)}
            placeholder='Cole o JSON do histórico do DUPR aqui (ex.: {"result":{"hits":[...]}} ou [ ... ]).'
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <V2Button variant="secondary" size="sm" onClick={() => setHistoryApplied(historyText)}>
              <ClipboardCheck className="mr-1.5 h-3.5 w-3.5" /> Conferir agora
            </V2Button>
            {historyApplied.trim() && (
              <V2Button
                variant="ghost"
                size="sm"
                onClick={() => { setHistoryText(''); setHistoryApplied(''); }}
              >
                Limpar conferência
              </V2Button>
            )}
            {duprIndex && (
              <span className="text-sm text-gray-500">
                {duprIndex.count} registro(s) lidos do DUPR ·{' '}
                <strong className="text-green-600">{situations.confirmed}</strong> confirmada(s) no recorte.
              </span>
            )}
          </div>
        </V2Surface>
      )}

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

      {/* Pré-visualização paginada + ordenável */}
      {view.length === 0 ? (
        <V2EmptyState
          icon={Trophy}
          title="Nenhuma partida encontrada"
          description="Ajuste os filtros para encontrar partidas decididas na plataforma."
        />
      ) : (
        <V2Surface className="overflow-hidden p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              {pageData.total > 0
                ? `Mostrando ${pageData.from}–${pageData.to} de ${pageData.total}`
                : 'Nenhuma partida no recorte'}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <label htmlFor="dupr-page-size" className="text-gray-500">Por página</label>
              <V2Select
                id="dupr-page-size"
                value={String(pageSize)}
                onChange={(e) => setPageSize(Number(e.target.value))}
                options={DUPR_PAGE_SIZES.map((n) => ({ value: String(n), label: String(n) }))}
                className="w-24"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
                  <SortHeader label="Data" sortKey={DUPR_SORT_KEY.DATE} active={sortKey === DUPR_SORT_KEY.DATE} dir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Evento" sortKey={DUPR_SORT_KEY.EVENT} active={sortKey === DUPR_SORT_KEY.EVENT} dir={sortDir} onSort={toggleSort} />
                  <SortHeader label="Tipo" sortKey={DUPR_SORT_KEY.TYPE} active={sortKey === DUPR_SORT_KEY.TYPE} dir={sortDir} onSort={toggleSort} />
                  <th className="px-4 py-2 font-semibold">Time A</th>
                  <th className="px-4 py-2 font-semibold">Time B</th>
                  <th className="px-4 py-2 font-semibold">Placar</th>
                  <th className="px-4 py-2 font-semibold">ID DUPR</th>
                  <SortHeader label="Situação DUPR" sortKey={DUPR_SORT_KEY.STATUS} active={sortKey === DUPR_SORT_KEY.STATUS} dir={sortDir} onSort={toggleSort} />
                </tr>
              </thead>
              <tbody>
                {pageData.pageItems.map((e, i) => {
                  const r = e.row;
                  const teamA = [r.playerA1, r.playerA2].filter(Boolean).join(' / ');
                  const teamB = [r.playerB1, r.playerB2].filter(Boolean).join(' / ');
                  const score = [1, 2, 3, 4, 5]
                    .map((n) => (r[`teamAGame${n}`] !== '' ? `${r[`teamAGame${n}`]}-${r[`teamBGame${n}`]}` : null))
                    .filter(Boolean)
                    .join(', ');
                  const status = e.situation?.status || EXPORT_STATUS.PENDING;
                  return (
                    <tr key={e.id || `${e.at}-${i}`} className="border-b border-gray-50 last:border-0">
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
                      <td className="px-4 py-2">
                        <V2Badge tone={EXPORT_STATUS_TONE[status] || 'neutral'}>
                          {EXPORT_STATUS_LABELS[status] || status}
                        </V2Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          {pageData.pageCount > 1 && (
            <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-4 py-3 text-sm">
              <V2Button
                variant="ghost"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={pageData.page <= 1}
              >
                <ChevronLeft className="mr-1 h-4 w-4" /> Anterior
              </V2Button>
              <span className="text-gray-500">
                Página <strong className="text-ink">{pageData.page}</strong> de {pageData.pageCount}
              </span>
              <V2Button
                variant="ghost"
                size="sm"
                onClick={() => setPage((p) => Math.min(pageData.pageCount, p + 1))}
                disabled={pageData.page >= pageData.pageCount}
              >
                Próxima <ChevronRight className="ml-1 h-4 w-4" />
              </V2Button>
            </div>
          )}
        </V2Surface>
      )}
    </div>
  );
}
