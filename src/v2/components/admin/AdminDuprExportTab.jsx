/**
 * AdminDuprExportTab — Exportação de partidas para o DUPR (platform_admin).
 *
 * Flag: `dupr_match_export`. Fica no painel administrativo (seção Governança).
 * A aba tem DUAS listas de partidas, com papéis bem separados:
 *
 *  1. RECORTE DOS FILTROS — todo o histórico de partidas decididas da
 *     plataforma (por data, torneio, dia de jogo, clube, evento, atleta, tipo e
 *     origem). Serve para procurar e para CORRIGIR a situação DUPR de qualquer
 *     partida, esteja ela onde estiver.
 *
 *  2. LISTA DE EXPORTAÇÃO — as partidas APTAS a serem lançadas no DUPR. Ela se
 *     monta sozinha: toda partida pronta (todos os jogadores com ID DUPR) e
 *     ainda pendente entra nela automaticamente. É essa lista — e só ela — que
 *     vira o CSV. O admin pode tirar uma partida da lista sem mudar a situação
 *     dela (é "não lançar agora", não "nunca lançar").
 *
 * Nas duas listas o admin seleciona partidas (todas ou algumas) e aplica em
 * massa: tornar pendente, exportada, lançada no DUPR ou não lançar no DUPR. A
 * seleção é do admin, não da tabela: trocar um filtro NUNCA desmarca o que já
 * estava selecionado.
 *
 * O CSV sai no formato exato de importação de partidas de clubes do DUPR (27
 * colunas). Nenhum dado de partida é alterado — as únicas escritas são no
 * ledger de governança `dupr_export_log`.
 *
 * A base é a MESMA do ranking oficial: torneios (`tournament_matches`) + dias
 * de jogo/eventos/confrontos publicados (`club_event_games`). Partidas cujos
 * jogadores ainda não têm ID DUPR ficam marcadas como "incompletas" e não
 * entram na lista de exportação (o DUPR exige o ID de cada jogador).
 *
 * ANTIDUPLICAÇÃO (ledger `dupr_export_log`): cada download registra QUAIS
 * partidas foram exportadas e QUANDO. A coluna "Situação DUPR" mostra
 * pendente/exportada/lançada/não lançar. Com a flag `dupr_official_sync`
 * ligada, é possível colar o histórico de partidas do DUPR (JSON) para
 * CONFERIR quais já constam lá (por identifier/impressão digital) e marcá-las
 * como "confirmadas" — evitando relançar dados.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Download, Filter, RotateCcw, Trophy, Users,
  AlertTriangle, CheckCircle2, ListChecks, Info,
  ClipboardCheck, ClipboardList, History, MinusCircle, PlusCircle,
} from 'lucide-react';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import {
  useDuprExportData, useRecordDuprExport, useDuprLedger, useRecordDuprLedger,
  useUpdateDuprQueue,
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
  EXPORT_STATUS,
  EXPORT_STATUS_LABELS,
  buildReconciliationView,
  summarizeSituations,
  filterBySituation,
  latestExportInfo,
  parseDuprHistory,
  buildDuprIndex,
  buildExportQueue,
  summarizeQueue,
} from '@/modules/rating/domain/duprReconcile';
import {
  toggleId, addIds, removeIds, resolveSelectedEntries,
  countHiddenSelected, pruneSelection,
} from '@/modules/rating/domain/duprSelection';
import DuprMatchesTable from '@/v2/components/admin/dupr/DuprMatchesTable';
import DuprBulkActions from '@/v2/components/admin/dupr/DuprBulkActions';
import {
  V2Surface, V2Button, V2Field, V2Input, V2Select, V2Toggle, V2Textarea,
  V2Badge, V2StatCard, V2EmptyState, V2Skeleton, V2PageIntro,
} from '@/v2/ui/primitives';

const EMPTY_FILTERS = {
  dateFrom: '', dateTo: '', source: '', matchType: '',
  tournamentId: '', gameDayId: '', clubId: '', eventId: '', athleteUid: '',
};

/** Texto de confirmação de cada mudança de situação em massa. */
const STATUS_CONFIRM = {
  [EXPORT_STATUS.PENDING]: (n) => `Tornar ${n} partida(s) PENDENTE(S)? `
    + 'Elas voltam para a lista de exportação e podem ser baixadas de novo no CSV.',
  [EXPORT_STATUS.EXPORTED]: (n) => `Marcar ${n} partida(s) como EXPORTADA(S)? `
    + 'Elas saem da lista de exportação, mas continuam pendentes de lançamento no DUPR.',
  [EXPORT_STATUS.SUBMITTED]: (n) => `Marcar ${n} partida(s) como LANÇADA(S) NO DUPR? `
    + 'Isso evita reexportá-las por engano.',
  [EXPORT_STATUS.EXCLUDED]: (n) => `Marcar ${n} partida(s) como NÃO LANÇAR NO DUPR? `
    + 'Elas deixam de aparecer na lista de exportação até que você as torne pendentes de novo.',
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

/** Menor e maior data (`YYYY-MM-DD`) de um conjunto de entries. */
function dateRangeOf(entries = []) {
  const dates = entries.map((e) => e?.row?.date).filter(Boolean).sort();
  return { dateFrom: dates[0] || '', dateTo: dates[dates.length - 1] || '' };
}

/** Cabeçalho de uma das listas de partidas. */
function ListHeader({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Icon className="h-4 w-4" /> {title}
        </div>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">{description}</p>
      </div>
      {action}
    </div>
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
  const updateQueue = useUpdateDuprQueue();
  const ledgerByKey = useMemo(() => ledgerData || new Map(), [ledgerData]);
  const isWriting = recordLedger.isPending || updateQueue.isPending;

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [scoreType, setScoreType] = useState(DUPR_SCORE_TYPE.SIDEOUT);
  const [readyOnly, setReadyOnly] = useState(true);
  const [includeExternalId, setIncludeExternalId] = useState(true);
  const [situationFilter, setSituationFilter] = useState('');

  // Seleção por lista. Guardada aqui (e não nas tabelas) justamente para
  // SOBREVIVER à troca de filtros: quem sai do recorte continua marcado.
  const [filteredSelection, setFilteredSelection] = useState(() => new Set());
  const [queueSelection, setQueueSelection] = useState(() => new Set());

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

  // Índice do histórico DUPR (só quando a conferência oficial está ligada).
  const duprIndex = useMemo(() => {
    if (!officialSyncOn || !historyApplied.trim()) return null;
    const records = parseDuprHistory(historyApplied);
    return records.length > 0
      ? buildDuprIndex(records)
      : { byFingerprint: new Set(), byIdentifier: new Set(), byMatchCode: new Set(), count: 0 };
  }, [officialSyncOn, historyApplied]);

  // Entries + situação da base COMPLETA (não do recorte). É o que permite
  // aplicar uma ação a partidas selecionadas que já saíram do filtro atual, e
  // montar a lista de exportação com TODA a plataforma, não só com o recorte.
  const allEntries = useMemo(
    () => buildDuprEntries(matches, profileById, { scoreType, includeExternalId }),
    [matches, profileById, scoreType, includeExternalId],
  );

  const allView = useMemo(
    () => buildReconciliationView(allEntries, { ledgerByKey, duprIndex }),
    [allEntries, ledgerByKey, duprIndex],
  );

  // Recorte dos filtros (aplicados sobre as partidas cruas, como antes).
  const filteredIds = useMemo(
    () => new Set(filterExportMatches(matches, filters).map((m) => m.id)),
    [matches, filters],
  );

  const filteredView = useMemo(
    () => allView.filter((e) => filteredIds.has(e.id)),
    [allView, filteredIds],
  );

  const summary = useMemo(() => summarizeEntries(filteredView), [filteredView]);

  // "Somente partidas prontas": quando ligado, a lista dos filtros (e os
  // contadores de situação) mostra apenas as partidas exportáveis — as com
  // algum jogador sem ID DUPR ficam de fora.
  const readyFilteredView = useMemo(
    () => (readyOnly ? filteredView.filter((e) => e.ready) : filteredView),
    [filteredView, readyOnly],
  );

  const situations = useMemo(() => summarizeSituations(readyFilteredView), [readyFilteredView]);

  const viewBySituation = useMemo(
    () => filterBySituation(readyFilteredView, situationFilter),
    [readyFilteredView, situationFilter],
  );

  // Ids visíveis de cada lista — usados para o check "selecionar todos" e para
  // contar quantas selecionadas ficaram fora do recorte.
  const filteredVisibleIds = useMemo(() => viewBySituation.map((e) => e.id), [viewBySituation]);

  // Lista de exportação: automática (pronta + pendente + não removida à mão).
  const queue = useMemo(() => buildExportQueue(allView), [allView]);
  const queueIds = useMemo(() => queue.map((e) => e.id), [queue]);
  const queueStats = useMemo(() => summarizeQueue(allView), [allView]);
  const queueSummary = useMemo(() => summarizeEntries(queue), [queue]);

  const lastExport = useMemo(() => latestExportInfo(ledgerByKey), [ledgerByKey]);

  // Higiene: se uma partida sumiu da base (recarregamento), tira o id órfão da
  // seleção. NUNCA poda pelo filtro — só pelo que existe na plataforma.
  const knownIds = useMemo(() => new Set(allView.map((e) => e.id)), [allView]);
  useEffect(() => {
    const prune = (s) => {
      if (s.size === 0) return s;
      const next = pruneSelection(s, knownIds);
      return next.size === s.size ? s : next;
    };
    setFilteredSelection(prune);
    setQueueSelection(prune);
  }, [knownIds]);

  const resetFilters = () => {
    setFilters(EMPTY_FILTERS);
    setSituationFilter('');
  };

  /**
   * Aplica uma situação DUPR às partidas selecionadas de uma lista. Usa
   * `force` porque é uma decisão explícita do admin — só ela pode rebaixar a
   * situação (ex.: devolver para pendente).
   */
  const applyStatus = (selection, clearSelection, status) => {
    const entries = resolveSelectedEntries(selection, allView);
    if (entries.length === 0) {
      toast.error('Selecione ao menos uma partida.');
      return;
    }
    const ok = window.confirm(STATUS_CONFIRM[status](entries.length));
    if (!ok) return;
    recordLedger.mutate(
      { entries, status, ledgerByKey, force: true },
      {
        onSuccess: () => {
          clearSelection();
          toast.success(`${entries.length} partida(s) agora com situação "${EXPORT_STATUS_LABELS[status]}".`);
        },
        onError: () => toast.error('Não foi possível atualizar a situação. Tente novamente.'),
      },
    );
  };

  /** Tira (ou devolve) as selecionadas da lista de exportação, sem mexer na situação. */
  const applyQueueChange = (selection, clearSelection, removed) => {
    const entries = resolveSelectedEntries(selection, allView);
    if (entries.length === 0) {
      toast.error('Selecione ao menos uma partida.');
      return;
    }
    if (removed) {
      const ok = window.confirm(
        `Excluir ${entries.length} partida(s) da lista de exportação? `
        + 'A situação DUPR delas NÃO muda — continuam pendentes e podem voltar à lista quando você quiser.',
      );
      if (!ok) return;
    }
    updateQueue.mutate(
      { entries, removed },
      {
        onSuccess: () => {
          clearSelection();
          toast.success(removed
            ? `${entries.length} partida(s) fora da lista de exportação.`
            : `${entries.length} partida(s) devolvida(s) à lista de exportação.`);
        },
        onError: () => toast.error('Não foi possível atualizar a lista de exportação. Tente novamente.'),
      },
    );
  };

  /**
   * Baixa o CSV da LISTA DE EXPORTAÇÃO — e só dela. Os filtros da lista de cima
   * não interferem no arquivo: o que sai é exatamente o que está na tabela.
   */
  const handleDownload = () => {
    const rows = entriesToRows(queue, { readyOnly: true });
    if (rows.length === 0) {
      toast.error('A lista de exportação está vazia.');
      return;
    }
    const range = dateRangeOf(queue);
    const csv = buildDuprCsv(rows);
    // SEM BOM: o BOM corromperia o cabeçalho "matchType" e quebraria a
    // detecção de colunas obrigatórias no importador do DUPR.
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = duprCsvFilename(range);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    recordExport.mutate({
      total: rows.length,
      ready: queueSummary.ready,
      incomplete: queueSummary.incomplete,
      singles: queueSummary.singles,
      doubles: queueSummary.doubles,
      filters: { ...range, origem: 'lista_de_exportacao' },
    });
    // Registra no ledger QUAIS partidas foram exportadas e QUANDO
    // (antiduplicação). Sem `force`: nada é rebaixado por um download.
    recordLedger.mutate({ entries: queue, status: EXPORT_STATUS.EXPORTED, ledgerByKey });
    setQueueSelection(new Set());
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

  const situationOptions = [
    { value: '', label: `Todas as situações (${situations.total})` },
    { value: EXPORT_STATUS.PENDING, label: `${EXPORT_STATUS_LABELS.pending} (${situations.pending})` },
    { value: EXPORT_STATUS.EXPORTED, label: `${EXPORT_STATUS_LABELS.exported} (${situations.exported})` },
    { value: EXPORT_STATUS.SUBMITTED, label: `${EXPORT_STATUS_LABELS.submitted} (${situations.submitted})` },
    { value: EXPORT_STATUS.EXCLUDED, label: `${EXPORT_STATUS_LABELS.excluded} (${situations.excluded})` },
    ...(duprIndex ? [{ value: EXPORT_STATUS.CONFIRMED, label: `${EXPORT_STATUS_LABELS.confirmed} (${situations.confirmed})` }] : []),
  ];

  const filterSignature = `${JSON.stringify(filters)}|${situationFilter}|${readyOnly}`;

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
              A tabela de cima é a <strong>busca</strong> (obedece aos filtros). A de baixo é a{' '}
              <strong>lista de exportação</strong>: ela se monta sozinha com as partidas prontas
              e pendentes, e é <strong>só ela</strong> que vira o CSV.
            </p>
            <p className="mt-1">
              O DUPR exige o <strong>ID DUPR</strong> de cada jogador. Partidas com algum
              atleta sem ID ficam marcadas como <em>incompletas</em> e não entram na lista de
              exportação — peça a esses atletas para cadastrar o ID no perfil.
            </p>
          </div>
        </div>
      </V2Surface>

      {/* Controle de lançamentos (antiduplicação) */}
      <V2Surface className="p-4 sm:p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink">
          <History className="h-4 w-4" /> Controle de lançamentos no DUPR
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
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
            <div className="text-xs uppercase tracking-wide text-gray-400">Não lançar</div>
            <div className="text-sm font-semibold text-ink">{lastExport.excludedCount}</div>
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
            <Filter className="h-4 w-4" /> Filtros da busca
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
            hint="Na busca, mostra apenas as partidas com todos os jogadores com ID DUPR."
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

      {/* Resumo do recorte dos filtros */}
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
              <strong>{summary.incomplete}</strong> partida(s) do recorte têm jogadores sem ID
              DUPR e não entram na lista de exportação. Peça a esses atletas para cadastrar o
              ID DUPR no perfil.
            </p>
          </div>
        </V2Surface>
      )}

      {/* LISTA 1 — recorte dos filtros */}
      <section className="space-y-3">
        <ListHeader
          icon={Filter}
          title="Partidas do filtro"
          description="Tudo o que os filtros acima alcançam. Selecione partidas para corrigir a situação DUPR delas ou para devolvê-las à lista de exportação. Trocar um filtro não desmarca o que já estava selecionado."
        />
        <DuprMatchesTable
          idPrefix="dupr-filtered"
          entries={viewBySituation}
          selected={filteredSelection}
          onToggleId={(id) => setFilteredSelection((s) => toggleId(s, id))}
          onToggleAll={(ids, checked) => setFilteredSelection(
            (s) => (checked ? addIds(s, ids) : removeIds(s, ids)),
          )}
          resetKey={filterSignature}
          toolbar={(
            <DuprBulkActions
              count={filteredSelection.size}
              hiddenCount={countHiddenSelected(filteredSelection, filteredVisibleIds)}
              disabled={isWriting}
              onStatus={(status) => applyStatus(
                filteredSelection, () => setFilteredSelection(new Set()), status,
              )}
              onClear={() => setFilteredSelection(new Set())}
              extraActions={[{
                key: 'restore',
                label: 'Devolver à lista de exportação',
                icon: PlusCircle,
                variant: 'ghost',
                onClick: () => applyQueueChange(
                  filteredSelection, () => setFilteredSelection(new Set()), false,
                ),
              }]}
            />
          )}
          empty={(
            <V2EmptyState
              icon={Trophy}
              title="Nenhuma partida encontrada"
              description="Ajuste os filtros para encontrar partidas decididas na plataforma."
            />
          )}
        />
      </section>

      {/* LISTA 2 — apta a ser exportada (fonte exclusiva do CSV) */}
      <section className="space-y-3">
        <ListHeader
          icon={ListChecks}
          title="Aptas a exportar para lançar no DUPR"
          description="Montada automaticamente: toda partida pronta (todos os jogadores com ID DUPR) e ainda pendente entra aqui sozinha. O CSV leva exatamente estas partidas — nem mais, nem menos."
          action={(
            <V2Button onClick={handleDownload} disabled={queue.length === 0 || isFetching}>
              <Download className="mr-2 h-4 w-4" /> Baixar CSV do DUPR ({queue.length})
            </V2Button>
          )}
        />

        {(queueStats.pendingIncomplete > 0 || queueStats.removed > 0) && (
          <p className="text-sm text-gray-500">
            Fora da lista, mesmo pendentes:{' '}
            <strong className="text-ink">{queueStats.pendingIncomplete}</strong> sem ID DUPR
            {' '}e <strong className="text-ink">{queueStats.removed}</strong> retirada(s) por você
            {' '}(use &ldquo;Devolver à lista de exportação&rdquo; na tabela de cima para trazê-las de volta).
          </p>
        )}

        <DuprMatchesTable
          idPrefix="dupr-queue"
          entries={queue}
          selected={queueSelection}
          onToggleId={(id) => setQueueSelection((s) => toggleId(s, id))}
          onToggleAll={(ids, checked) => setQueueSelection(
            (s) => (checked ? addIds(s, ids) : removeIds(s, ids)),
          )}
          toolbar={(
            <DuprBulkActions
              count={queueSelection.size}
              hiddenCount={countHiddenSelected(queueSelection, queueIds)}
              disabled={isWriting}
              onStatus={(status) => applyStatus(
                queueSelection, () => setQueueSelection(new Set()), status,
              )}
              onClear={() => setQueueSelection(new Set())}
              extraActions={[{
                key: 'remove',
                label: 'Excluir da lista',
                icon: MinusCircle,
                variant: 'ghost',
                onClick: () => applyQueueChange(
                  queueSelection, () => setQueueSelection(new Set()), true,
                ),
              }]}
            />
          )}
          empty={(
            <V2EmptyState
              icon={CheckCircle2}
              title="Nenhuma partida aguardando exportação"
              description="Assim que uma partida decidida com todos os IDs DUPR entrar na plataforma, ela aparece aqui automaticamente."
            />
          )}
        />
      </section>
    </div>
  );
}
