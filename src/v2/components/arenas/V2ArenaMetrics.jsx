/**
 * V2ArenaMetrics — painel do proprietário (Sprint 2 ARE-08).
 *
 * Tab read-only no /arenas/:id/gerir. Agrega:
 * - Receita (confirmada + pendente)
 * - Reservas (total, conversão, próximas)
 * - Vendas (PDV)
 * - Ocupação (horas reservadas vs disponíveis)
 * - Rating médio
 *
 * Carrega via hooks existentes (useArenaBookings, useArenaSales,
 * useArenaCourtSchedules, useArenaCourts, useArenaReviews).
 * Filtra período no client (mês calendário).
 *
 * Decisões:
 * - Não usa Firestore range query (carrega tudo do mês via hooks já
 *   cacheados). Pra arenas grandes (>1000 reservas), adicionar
 *   query range no service.
 * - Métricas calculadas no client via `calculateArenaMetrics`
 *   (domain puro, testado).
 */

import React, { useMemo, useState } from 'react';
import {
  ChevronLeft, ChevronRight, TrendingUp, Users, Clock, Star, ShoppingBag, Calendar,
  Crown, GraduationCap, Trophy,
} from 'lucide-react';
import { calculateArenaMetrics, formatPeriodLabel, nowYearMonth } from '@/modules/arenas/domain/arena_metrics';
import { useArenaBookings } from '@/modules/arenas/hooks/useBookings';
import {
  useArenaSales, useArenaClasses, useArenaClassBookingsAll, useArenaWallets,
  useArenaSubscriptions, useArenaInternalTournaments,
} from '@/modules/arenas/hooks/useArenaV3';
import { useArenaModules } from '@/modules/arenas/hooks/useArenaModules';
import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';
import { moduleRevenue } from '@/modules/arenas/domain/moduleRevenue';
import { appOrdersSummary, salesOutsideMercado } from '@/modules/arenas/domain/shop';
import { useArenaReviews } from '@/modules/arenas/hooks/useArenas';
import { useArenaCourtSchedules, useArenaCourts, useInventoryEntries, useInventoryExits } from '@/modules/arenas/hooks/useArenas';
import { V2Badge, V2Button, V2ErrorState, V2Surface } from '@/v2/ui/primitives';
import { formatPrice } from '@/modules/arenas/domain/pricing';
import { formatDateShortBR } from '@/modules/arenas/domain/calendar';
import { BOOKING_STATUS_LABELS } from '@/modules/arenas/domain/constants';

/** Lista vazia estável: um `[]` novo a cada render desfaria os `useMemo`. */
const SEM_ITENS = [];

function Stat({ label, value, sub, tone = 'default', icon: Icon }) {
  const toneColors = {
    default: 'text-ink',
    success: 'text-green-700',
    warning: 'text-amber-700',
    info: 'text-blue-700',
    danger: 'text-red-600',
  };
  return (
    <V2Surface className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs text-gray-500">{label}</div>
        {Icon && <Icon className="h-4 w-4 text-gray-400" />}
      </div>
      <div className={`mt-1 font-display text-2xl font-bold ${toneColors[tone]}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-gray-400">{sub}</div>}
    </V2Surface>
  );
}

function getNowYearMonth() {
  return nowYearMonth();
}

function prevMonth({ year, month }) {
  if (month === 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

function nextMonth({ year, month }) {
  if (month === 12) return { year: year + 1, month: 1 };
  return { year, month: month + 1 };
}

export default function V2ArenaMetrics({ arena }) {
  const [cursor, setCursor] = useState(() => getNowYearMonth());

  // Carrega tudo via hooks já cacheados
  const { data: bookings = [], isLoading: loadingBookings, isError: reservasFalharam, refetch: recarregarReservas } = useArenaBookings(arena.id);
  const { data: sales = [], isLoading: loadingSales, isError: vendasFalharam, refetch: recarregarVendas } = useArenaSales(arena.id);
  const qQuadras = useArenaCourts(arena.id);
  const courts = qQuadras.data || SEM_ITENS;
  const qAvaliacoes = useArenaReviews(arena.id);
  const reviews = qAvaliacoes.data || SEM_ITENS;
  const qJanelas = useArenaCourtSchedules(arena.id);
  const schedulesData = qJanelas.data;
  const schedules = useMemo(() => {
    if (!schedulesData) return [];
    return Array.isArray(schedulesData) ? schedulesData : [];
  }, [schedulesData]);

  // Filtra bookings e sales pelo mês selecionado
  const monthPrefix = `${cursor.year}-${String(cursor.month).padStart(2, '0')}`;
  const bookingsInMonth = useMemo(
    () => bookings.filter((b) => {
      const slots = Array.isArray(b.slots) ? b.slots : (b.date ? [{ date: b.date }] : []);
      return slots.some((s) => s.date?.startsWith(monthPrefix));
    }),
    [bookings, monthPrefix],
  );
  const salesInMonth = useMemo(
    () => sales.filter((s) => {
      const ts = s?.created_at_ms || s?.created_at?.seconds * 1000 || 0;
      if (ts) {
        const d = new Date(ts);
        return d.getFullYear() === cursor.year && d.getMonth() + 1 === cursor.month;
      }
      return false;
    }),
    [sales, cursor.year, cursor.month],
  );

  // Mercado / estoque do mês (contabiliza no desempenho): receita das saídas
  // do tipo "venda" e o investido nas entradas do mês.
  const qEntradas = useInventoryEntries(arena.id);
  const invEntries = qEntradas.data || SEM_ITENS;
  const qSaidas = useInventoryExits(arena.id);
  const invExits = qSaidas.data || SEM_ITENS;
  const market = useMemo(() => {
    const inMonth = (d) => String(d || '').startsWith(monthPrefix);
    const salesExits = invExits.filter((x) => inMonth(x.date) && (x.exit_type || 'sale') === 'sale');
    const revenue = salesExits.reduce((s, x) => s + Number(x.total_price || 0), 0);
    const units = salesExits.reduce((s, x) => s + Number(x.quantity || 0), 0);
    const invested = invEntries.filter((e) => inMonth(e.date)).reduce((s, e) => s + Number(e.total_cost || 0), 0);
    // O que saiu pela ENTREGA de pedidos do app — já está dentro de `revenue`.
    const pelaLoja = salesExits.filter((x) => x.channel === 'app').reduce((s, x) => s + Number(x.total_price || 0), 0);
    return {
      revenue: Math.round(revenue * 100) / 100,
      app: Math.round(pelaLoja * 100) / 100,
      invested: Math.round(invested * 100) / 100,
      net: Math.round((revenue - invested) * 100) / 100,
      units,
      count: salesExits.length,
    };
  }, [invExits, invEntries, monthPrefix]);

  // Os MÓDULOS integrados à arena (Membros, Aulas, Torneios): o que entrou
  // por eles no mês. Cada consulta só sai com o módulo ligado.
  const { isOn } = useArenaModules(arena.id);
  const comAulas = isOn(ARENA_MODULE_ID.CLASSES);
  const comPacotes = isOn(ARENA_MODULE_ID.MEMBERS_PACKAGES);
  const comMensalidade = isOn(ARENA_MODULE_ID.MEMBERS_SUBSCRIPTION);
  const comTorneios = isOn(ARENA_MODULE_ID.LEAGUES);
  const qAulas = useArenaClasses(comAulas ? arena.id : null, { includeClosed: true, lim: 500 });
  const aulas = qAulas.data || SEM_ITENS;
  const qMatriculas = useArenaClassBookingsAll(comAulas ? arena.id : null);
  const matriculas = qMatriculas.data || SEM_ITENS;
  const qCarteiras = useArenaWallets(comPacotes ? arena.id : null);
  const carteiras = qCarteiras.data || SEM_ITENS;
  const qMensalidades = useArenaSubscriptions(comMensalidade ? arena.id : null);
  const mensalidades = qMensalidades.data || SEM_ITENS;
  const qTorneios = useArenaInternalTournaments(comTorneios ? arena.id : null);
  const torneiosDaCasa = qTorneios.data || SEM_ITENS;
  const modulos = useMemo(() => moduleRevenue({
    year: cursor.year,
    month: cursor.month,
    classes: aulas,
    classBookings: matriculas,
    wallets: carteiras,
    subscriptions: mensalidades,
    tournaments: torneiosDaCasa,
  }), [cursor.year, cursor.month, aulas, matriculas, carteiras, mensalidades, torneiosDaCasa]);
  const algumModulo = comAulas || comPacotes || comMensalidade || comTorneios;
  const lojaOn = isOn(ARENA_MODULE_ID.PDV);

  // As vendas da loja em duas famílias. As ANTIGAS (catálogo próprio da
  // loja) contam pelo pagamento, como sempre. Os pedidos do app, quando
  // entregues, viram saída do Mercado e já estão em `market.revenue` —
  // somá-los aqui também seria contar a mesma água duas vezes.
  const vendasAntigas = useMemo(() => salesOutsideMercado(salesInMonth), [salesInMonth]);
  const pedidosApp = useMemo(() => appOrdersSummary(salesInMonth), [salesInMonth]);
  // Com a loja desligada o painel é o de antes; o cartão do PDV antigo segue
  // enquanto houver venda dele no mês.
  const mostrarPdvAntigo = vendasAntigas.length > 0 || !lojaOn;

  const metrics = useMemo(() => calculateArenaMetrics({
    bookings: bookingsInMonth,
    sales: vendasAntigas,
    reviews,
    schedules,
    courts,
    year: cursor.year,
    month: cursor.month,
  }), [bookingsInMonth, vendasAntigas, reviews, schedules, courts, cursor.year, cursor.month]);

  const isLoading = loadingBookings || loadingSales;

  // 🐞 Toda consulta daqui lia `data = []`: com as reservas falhando, a receita
  // do mês saía ZERO, sem aviso — o número que a arena usa para decidir preço
  // e horário. Reservas e vendas são o coração do painel: sem elas, não há
  // número a mostrar. As outras partes, faltando, deixam o total INCOMPLETO —
  // e a tela diz qual parte ficou de fora.
  const nucleoFalhou = reservasFalharam || vendasFalharam;
  const partesQueFalharam = [
    [qQuadras.isError || qJanelas.isError, 'ocupação (quadras e horários)', [qQuadras, qJanelas]],
    [qAvaliacoes.isError, 'avaliações', [qAvaliacoes]],
    [qEntradas.isError || qSaidas.isError, 'mercado', [qEntradas, qSaidas]],
    [qAulas.isError || qMatriculas.isError, 'aulas', [qAulas, qMatriculas]],
    [qCarteiras.isError, 'pacotes', [qCarteiras]],
    [qMensalidades.isError, 'mensalidades', [qMensalidades]],
    [qTorneios.isError, 'torneios da casa', [qTorneios]],
  ].filter(([falhou]) => falhou);
  const tentarNucleo = () => {
    if (reservasFalharam) recarregarReservas();
    if (vendasFalharam) recarregarVendas();
  };
  const tentarPartes = () => partesQueFalharam.forEach(([, , consultas]) => (
    consultas.forEach((q) => q.isError && q.refetch())
  ));

  return (
    <V2Surface className="space-y-4 p-4 sm:p-6">
      {/* Header: navegação de mês */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <V2Button variant="ghost" size="sm" onClick={() => setCursor((c) => prevMonth(c))} aria-label="Mês anterior">
            <ChevronLeft className="h-4 w-4" />
          </V2Button>
          <h3 className="font-display text-lg font-bold text-ink min-w-[160px] text-center">
            {formatPeriodLabel(cursor.year, cursor.month)}
          </h3>
          <V2Button variant="ghost" size="sm" onClick={() => setCursor((c) => nextMonth(c))} aria-label="Próximo mês">
            <ChevronRight className="h-4 w-4" />
          </V2Button>
        </div>
        <div className="text-xs text-gray-500">
          {isLoading ? 'Carregando…' : `${bookingsInMonth.length} reservas · ${salesInMonth.length} pedidos da loja no mês`}
        </div>
      </div>

      {nucleoFalhou ? (
        <V2ErrorState
          title="Não foi possível carregar as reservas e vendas do mês"
          description="Sem elas, a receita e a ocupação sairiam zeradas. Tente de novo em instantes."
          onRetry={tentarNucleo}
        />
      ) : (
      <>
      {partesQueFalharam.length > 0 && (
        <V2ErrorState
          inline
          title="Parte dos números não carregou"
          description={`Ficou de fora: ${partesQueFalharam.map(([, rotulo]) => rotulo).join(', ')}. Os totais abaixo estão incompletos até carregar.`}
          onRetry={tentarPartes}
        />
      )}

      {/* Stats principais */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label="Receita total (mês)"
          // 🐞 Somava `revenue_by_source.sales` por cima de `revenue.confirmed`,
          // que JÁ inclui as vendas pagas: toda venda da loja entrava duas vezes.
          value={formatPrice(metrics.revenue.confirmed + market.revenue + modulos.recebido)}
          tone="success"
          icon={TrendingUp}
          sub={`Reservas${mostrarPdvAntigo ? ' + PDV' : ''} + Mercado${algumModulo ? ' + Planos e aulas' : ''}${metrics.revenue.pending > 0 ? ` · +${formatPrice(metrics.revenue.pending)} pendente` : ''}`}
        />
        <Stat
          label="Reservas"
          value={metrics.bookings.total}
          sub={metrics.bookings.conversion_rate != null ? `${metrics.bookings.conversion_rate}% conversão` : 'sem dados'}
          icon={Calendar}
        />
        <Stat
          label="Ocupação"
          value={metrics.occupancy.rate != null ? `${metrics.occupancy.rate}%` : '—'}
          sub={metrics.occupancy.booked_hours != null ? `${metrics.occupancy.booked_hours}h / ${metrics.occupancy.available_hours}h` : null}
          tone="info"
          icon={Clock}
        />
        <Stat
          label="Rating"
          value={metrics.rating.average != null ? metrics.rating.average.toFixed(1) : '—'}
          sub={metrics.rating.count > 0 ? `${metrics.rating.count} avaliações` : 'sem reviews'}
          tone="warning"
          icon={Star}
        />
      </div>

      {/* Receita por origem */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <V2Surface className="p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-ink">
            <Calendar className="h-4 w-4 text-gray-500" />
            Receita de reservas
          </div>
          <div className="mt-2 font-display text-2xl font-bold text-ink">
            {formatPrice(metrics.revenue_by_source.bookings)}
          </div>
          <div className="mt-1 text-xs text-gray-500">
            Reservas confirmadas/concluídas no mês
          </div>
        </V2Surface>
        {mostrarPdvAntigo ? (
          <V2Surface className="p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-ink">
              <ShoppingBag className="h-4 w-4 text-gray-500" />
              Receita de vendas (PDV)
            </div>
            <div className="mt-2 font-display text-2xl font-bold text-ink">
              {formatPrice(metrics.revenue_by_source.sales)}
            </div>
            <div className="mt-1 text-xs text-gray-500">
              {metrics.sales.paid} de {metrics.sales.total} vendas pagas (catálogo antigo da loja)
            </div>
          </V2Surface>
        ) : (
          <V2Surface className="p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-ink">
              <ShoppingBag className="h-4 w-4 text-gray-500" />
              Pedidos do app
            </div>
            <div className="mt-2 font-display text-2xl font-bold text-ink">{pedidosApp.total}</div>
            <div className="mt-1 text-xs text-gray-500">
              {pedidosApp.entregues} entregue(s) · {pedidosApp.pagos} pago(s) — o valor entra no Mercado ao entregar
            </div>
          </V2Surface>
        )}
        <V2Surface className="p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-ink">
            <ShoppingBag className="h-4 w-4 text-gray-500" />
            Mercado / estoque
          </div>
          <div className="mt-2 font-display text-2xl font-bold text-ink">
            {formatPrice(market.revenue)}
          </div>
          <div className="mt-1 text-xs text-gray-500">
            {market.count} venda(s) · {market.units} un{market.app > 0 ? ` (${formatPrice(market.app)} pelo app)` : ''} · investido {formatPrice(market.invested)}
            {' · '}<span className={market.net >= 0 ? 'font-bold text-green-700' : 'font-bold text-red-600'}>líquido {formatPrice(market.net)}</span>
          </div>
        </V2Surface>
      </div>

      {/* Planos, aulas e torneios — só com os módulos ligados. */}
      {algumModulo && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {(comPacotes || comMensalidade) && (
            <V2Surface className="p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-ink">
                <Crown className="h-4 w-4 text-gray-500" />
                Planos (membros)
              </div>
              <div className="mt-2 font-display text-2xl font-bold text-ink">
                {formatPrice(modulos.pacotes.valor + modulos.mensalidades.recebido)}
              </div>
              <div className="mt-1 text-xs text-gray-500">
                {comPacotes && `${modulos.pacotes.vendidos} pacote(s) vendido(s)`}
                {comPacotes && comMensalidade && ' · '}
                {comMensalidade && `${modulos.mensalidades.pagantes} mensalidade(s) paga(s)`}
              </div>
            </V2Surface>
          )}
          {comAulas && (
            <V2Surface className="p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-ink">
                <GraduationCap className="h-4 w-4 text-gray-500" />
                Aulas
              </div>
              <div className="mt-2 font-display text-2xl font-bold text-ink">
                {formatPrice(modulos.aulas.arena)}
              </div>
              <div className="mt-1 text-xs text-gray-500">
                Fica com a arena · {formatPrice(modulos.aulas.recebido)} recebidos de {modulos.aulas.alunos} aluno(s)
                {modulos.aulas.aReceber > 0 ? ` · ${formatPrice(modulos.aulas.aReceber)} a receber` : ''}
              </div>
            </V2Surface>
          )}
          {comTorneios && (
            <V2Surface className="p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-ink">
                <Trophy className="h-4 w-4 text-gray-500" />
                Torneios da casa
              </div>
              <div className="mt-2 font-display text-2xl font-bold text-ink">
                {formatPrice(modulos.torneios.previsto)}
              </div>
              <div className="mt-1 text-xs text-gray-500">
                Previsto em inscrições · {modulos.torneios.quantos} torneio(s), {modulos.torneios.inscritos} inscrito(s) — não entra no total
              </div>
            </V2Surface>
          )}
        </div>
      )}

      {/* Status das reservas */}
      <V2Surface className="p-4">
        <div className="flex items-center gap-2 text-sm font-bold text-ink">
          <Users className="h-4 w-4 text-gray-500" />
          Status das reservas no mês
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(metrics.bookings.by_status).map(([status, count]) => (
            <V2Badge key={status} tone={count > 0 ? 'blue' : 'neutral'}>
              {/* O status vinha CRU do banco ("requested: 3"). O painel é da
                  arena, não do console. */}
              {BOOKING_STATUS_LABELS[status] || status}: {count}
            </V2Badge>
          ))}
          {Object.keys(metrics.bookings.by_status).length === 0 && (
            <span className="text-sm text-gray-500">Nenhuma reserva no período.</span>
          )}
        </div>
      </V2Surface>

      {/* Próximas reservas */}
      <V2Surface className="p-4">
        <div className="text-sm font-bold text-ink">Próximas reservas confirmadas</div>
        {metrics.bookings.upcoming.length === 0 ? (
          <div className="mt-2 text-sm text-gray-500">Nenhuma reserva futura.</div>
        ) : (
          <ul className="mt-3 divide-y divide-gray-100">
            {metrics.bookings.upcoming.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <div className="min-w-0">
                  <div className="font-semibold text-ink">
                    {b.next_date ? formatDateShortBR(b.next_date) : ''} {b.next_start && `· ${b.next_start}–${b.next_end}`}
                  </div>
                  <div className="text-xs text-gray-500">{b.athlete_name || 'Atleta'}</div>
                </div>
                <div className="text-xs font-semibold text-green-700">
                  {b.agreed_price ? formatPrice(b.agreed_price) : b.proposed_price ? formatPrice(b.proposed_price) : '—'}
                </div>
              </li>
            ))}
          </ul>
        )}
      </V2Surface>
      </>
      )}
    </V2Surface>
  );
}
