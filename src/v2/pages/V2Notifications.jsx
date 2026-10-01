/**
 * V2Notifications — a CENTRAL DE NOTIFICAÇÕES (flag `notifications_center`).
 * Rota: `/notificacoes`.
 *
 * O sino mostra os avisos mais novos; aqui estão TODOS, os novos e os antigos:
 *  - agrupados por dia (Hoje, Ontem, Nos últimos 7 dias, e um grupo por mês);
 *  - filtráveis por "não lidas", pela ÁREA (jogos, torneios, arenas…) e por
 *    busca no texto — e os filtros moram na URL, então abrir um aviso e
 *    voltar devolve a pessoa exatamente onde estava;
 *  - marcar como lida, como NÃO lida (para lembrar de voltar) e todas de uma vez;
 *  - o que as preferências escondem é DITO, com "mostrar também" — senão "não
 *    recebi o aviso" vira chamado de suporte para algo que a pessoa desligou.
 *
 * A lista é a MESMA assinatura do sino (`useNotifications`, uma por pessoa):
 * abrir esta página não lê nada a mais do banco. Nada novo é gravado: marcar
 * lida ou não lida usa os campos de sempre (`read`, `read_at`).
 *
 * Falha não é vazio: "nenhuma notificação" só com a leitura em mãos.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import {
  Bell, BellOff, Check, CheckCheck, ChevronRight, CircleDot, Search, Settings, SlidersHorizontal,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/core/lib/utils';
import { useFeatureFlags } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useRelogio } from '@/core/lib/useRelogio';
import { destinoDeAviso } from '@/core/domain/internalLink';
import { useNotifications } from '@/modules/notifications/hooks/useNotifications';
import { isNotificationMuted } from '@/modules/notifications/domain/preferences';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import {
  NOTICE_PAGE_STEP, filterNotices, groupNotices, noticeArea, noticeAreaCounts, noticeAreaMeta,
  noticeFiltersFromParams, noticeFiltersToParams,
} from '@/modules/notifications/domain/noticeFeed';
import {
  V2Button, V2EmptyState, V2ErrorState, V2FilterChip, V2PageIntro, V2SearchInput, V2Select, V2Skeleton,
} from '@/v2/ui/primitives';
import PartnerInviteNotificationAction from '@/v2/components/tournament/PartnerInviteNotificationAction';
import { AREA_ICON, NoticeIcon, NoticeTime } from '@/v2/components/notifications/noticeParts';
import { NOTIFICATION_PREFS_PATH } from '@/v2/components/notifications/NotificationsBell';

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

function NoticeRow({ n, agora, silenciado, onAbrir, onAlternarLida }) {
  const destino = destinoDeAviso(n.link);
  const area = noticeAreaMeta(noticeArea(n));
  const titulo = (
    <span className={cn('text-[15px] leading-snug text-ink', n.read ? 'font-semibold' : 'font-bold')}>
      {n.title}
    </span>
  );
  return (
    <li className={cn('relative flex gap-3 px-4 py-4 sm:px-5', !n.read && 'bg-acid/10')}>
      <NoticeIcon notice={n} />
      <div className="min-w-0 flex-1">
        {destino ? (
          // O cartão inteiro abre o aviso (o `after` estica o link sobre ele);
          // os botões ficam por cima, com `relative z-10`.
          <Link
            to={destino}
            onClick={() => onAbrir(n)}
            className="block rounded-md after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:rounded-none focus-visible:after:ring-4 focus-visible:after:ring-inset focus-visible:after:ring-acid/40"
          >
            {titulo}
          </Link>
        ) : (
          <p>{titulo}</p>
        )}
        {n.message && <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-gray-600">{n.message}</p>}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium text-gray-400">
          <NoticeTime notice={n} agora={agora} />
          <span aria-hidden="true">·</span>
          <span>{area.label}</span>
          {silenciado && (
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-gray-500">
              <BellOff className="h-3 w-3" aria-hidden="true" /> Silenciada
            </span>
          )}
          {!n.read && <span className="sr-only">Não lida</span>}
        </div>
        <div className="relative z-10">
          <PartnerInviteNotificationAction
            notification={n}
            onResolved={() => { if (!n.read) onAlternarLida(n, true); }}
          />
        </div>
      </div>
      <div className="relative z-10 flex shrink-0 flex-col items-center gap-1">
        <button
          type="button"
          onClick={() => onAlternarLida(n, !n.read)}
          aria-label={n.read ? `Marcar como não lida: ${n.title}` : `Marcar como lida: ${n.title}`}
          title={n.read ? 'Marcar como não lida' : 'Marcar como lida'}
          className="flex h-9 w-9 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-white hover:text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acid/30"
        >
          {n.read ? <CircleDot className="h-4 w-4" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
        </button>
        {destino && <ChevronRight className="h-4 w-4 text-gray-300" aria-hidden="true" />}
      </div>
    </li>
  );
}

function ListaCarregando() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Carregando notificações">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex gap-3 rounded-3xl border border-gray-100 bg-paper-pure p-4">
          <V2Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <V2Skeleton lines={2} className="flex-1" />
        </div>
      ))}
    </div>
  );
}

export default function V2Notifications() {
  const { flags, isLoading: flagsCarregando } = useFeatureFlags();
  const ligado = Boolean(flags?.[FEATURE_FLAG.NOTIFICATIONS_CENTER]);
  const { userProfile } = useAuth();
  const {
    notifications, allNotifications, muted, isLoading, isError, retry,
    markAsRead, markAsUnread, markAllAsRead,
  } = useNotifications();
  const { ms: agora } = useRelogio(60_000);

  const [params, setParams] = useSearchParams();
  const filtros = noticeFiltersFromParams(params);
  const [busca, setBusca] = useState(filtros.busca);
  const [limite, setLimite] = useState(NOTICE_PAGE_STEP);
  const [marcando, setMarcando] = useState(false);

  function mudarFiltros(parcial) {
    const proximo = { ...filtros, busca, ...parcial };
    setParams(noticeFiltersToParams(proximo), { replace: true });
  }

  // A busca é digitada ao vivo: o campo é local e a URL acompanha.
  function onBusca(valor) {
    setBusca(valor);
    setParams(noticeFiltersToParams({ ...filtros, busca: valor }), { replace: true });
  }

  // Filtro novo, lista nova: volta ao começo dela.
  const chaveDosFiltros = `${filtros.somenteNaoLidas}|${filtros.area}|${busca}|${filtros.silenciados}`;
  useEffect(() => { setLimite(NOTICE_PAGE_STEP); }, [chaveDosFiltros]);

  const prefs = userProfile?.notification_prefs;
  const base = filtros.silenciados ? allNotifications : notifications;
  const filtrada = useMemo(
    () => filterNotices(base, { somenteNaoLidas: filtros.somenteNaoLidas, area: filtros.area, busca }),
    [base, filtros.somenteNaoLidas, filtros.area, busca],
  );
  const areas = useMemo(() => noticeAreaCounts(base), [base]);
  const visiveis = filtrada.slice(0, limite);
  const grupos = useMemo(() => groupNotices(visiveis, agora), [visiveis, agora]);
  const naoLidasNaBase = useMemo(() => base.filter((n) => !n.read).length, [base]);

  if (!flagsCarregando && !ligado) return <Navigate to="/" replace />;

  async function alternarLida(n, lida) {
    try {
      if (lida) await markAsRead(n.id);
      else await markAsUnread(n.id);
    } catch {
      toast.error('Não foi possível atualizar a notificação. Tente de novo.');
    }
  }

  function abrir(n) {
    if (!n.read) markAsRead(n.id).catch(() => {});
  }

  async function marcarTodas() {
    if (marcando) return;
    setMarcando(true);
    try {
      const n = await markAllAsRead(base);
      if (n > 0) toast.success(`${plural(n, 'notificação marcada', 'notificações marcadas')} como lida${n === 1 ? '' : 's'}.`);
    } catch {
      toast.error('Não foi possível marcar as notificações como lidas. Tente de novo.');
    } finally {
      setMarcando(false);
    }
  }

  function limparFiltros() {
    setBusca('');
    setParams(noticeFiltersToParams({ silenciados: filtros.silenciados }), { replace: true });
  }

  const temFiltro = filtros.somenteNaoLidas || Boolean(filtros.area) || Boolean(busca.trim());
  const carregando = flagsCarregando || (isLoading && base.length === 0);

  let conteudo;
  if (isError) {
    conteudo = (
      <V2ErrorState
        title="Não foi possível carregar as notificações"
        description="A conexão falhou no meio do caminho. Suas notificações continuam guardadas — tente de novo."
        onRetry={retry}
      />
    );
  } else if (carregando) {
    conteudo = <ListaCarregando />;
  } else if (base.length === 0) {
    conteudo = (
      <V2EmptyState
        icon={Bell}
        title="Nenhuma notificação por enquanto"
        description="Convites, respostas de reserva, resultados e novidades dos seus clubes vão aparecer aqui — os novos e os antigos."
      />
    );
  } else if (filtrada.length === 0) {
    conteudo = filtros.somenteNaoLidas && !filtros.area && !busca.trim() ? (
      <V2EmptyState
        icon={CheckCheck}
        title="Tudo lido"
        description="Você está em dia com as notificações."
        action={<V2Button variant="secondary" size="sm" onClick={() => mudarFiltros({ somenteNaoLidas: false })}>Ver todas</V2Button>}
      />
    ) : (
      <V2EmptyState
        icon={Search}
        title="Nada encontrado"
        description="Nenhuma notificação com esses filtros."
        action={<V2Button variant="secondary" size="sm" onClick={limparFiltros}>Limpar filtros</V2Button>}
      />
    );
  } else {
    conteudo = (
      <div className="space-y-6" data-dica="notificacoes-lista">
        {grupos.map((g) => (
          <section key={g.key} aria-labelledby={`grupo-${g.key}`}>
            <h2 id={`grupo-${g.key}`} className="mb-2 px-1 text-xs font-bold uppercase tracking-widest text-gray-400">
              {g.label}
            </h2>
            <ul className="divide-y divide-gray-100 overflow-hidden rounded-3xl border border-gray-100 bg-paper-pure shadow-organic-sm">
              {g.items.map((n) => (
                <NoticeRow
                  key={n.id}
                  n={n}
                  agora={agora}
                  silenciado={filtros.silenciados && isNotificationMuted(prefs, n.type)}
                  onAbrir={abrir}
                  onAlternarLida={alternarLida}
                />
              ))}
            </ul>
          </section>
        ))}
        <div className="flex flex-col items-center gap-2 pt-2 text-center">
          <p className="text-xs text-gray-400" aria-live="polite">
            Mostrando {visiveis.length} de {plural(filtrada.length, 'notificação', 'notificações')}
          </p>
          {filtrada.length > visiveis.length && (
            <V2Button variant="secondary" size="sm" onClick={() => setLimite((l) => l + NOTICE_PAGE_STEP)}>
              Mostrar mais {Math.min(NOTICE_PAGE_STEP, filtrada.length - visiveis.length)}
            </V2Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[760px]">
      <V2PageIntro
        title="Notificações"
        // O número de não lidas já está no filtro "Não lidas" e no sino.
        subtitle="Os avisos novos e os antigos, num lugar só."
        action={(
          <>
            {naoLidasNaBase > 0 && !isError && (
              <V2Button size="sm" onClick={marcarTodas} disabled={marcando}>
                <CheckCheck className="h-4 w-4" aria-hidden="true" />
                {marcando ? 'Marcando…' : 'Marcar todas como lidas'}
              </V2Button>
            )}
            <V2Button asChild variant="ghost" size="sm">
              <Link to={NOTIFICATION_PREFS_PATH} aria-label="Preferências de notificação" title="Preferências de notificação">
                <Settings className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Preferências</span>
              </Link>
            </V2Button>
          </>
        )}
      />

      {!isError && !carregando && base.length > 0 && (
        <div className="mb-6 space-y-3" data-dica="notificacoes-filtros">
          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Quais notificações" className="flex flex-wrap gap-2">
              <V2FilterChip
                active={!filtros.somenteNaoLidas}
                aria-pressed={!filtros.somenteNaoLidas}
                onClick={() => mudarFiltros({ somenteNaoLidas: false })}
              >
                Todas <span className="text-xs opacity-70">{base.length}</span>
              </V2FilterChip>
              <V2FilterChip
                active={filtros.somenteNaoLidas}
                aria-pressed={filtros.somenteNaoLidas}
                onClick={() => mudarFiltros({ somenteNaoLidas: true })}
              >
                Não lidas <span className="text-xs opacity-70">{naoLidasNaBase}</span>
              </V2FilterChip>
            </div>
            <V2SearchInput
              icon={Search}
              type="search"
              value={busca}
              onChange={(e) => onBusca(e.target.value)}
              placeholder="Buscar nas notificações"
              aria-label="Buscar nas notificações"
              maxLength={80}
              wrapperClassName="min-w-[12rem] flex-1"
              className="py-2.5"
            />
          </div>
          {areas.length > 1 && (
            // No celular, uma lista de seleção: nove botões ocupariam cinco
            // linhas antes do primeiro aviso.
            <V2Select
              aria-label="Filtrar por área"
              value={filtros.area || ''}
              onChange={(e) => mudarFiltros({ area: e.target.value || null })}
              className="h-11 py-2 sm:hidden"
            >
              <option value="">Todas as áreas ({base.length})</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label} ({a.total}{a.naoLidas > 0 ? `, ${plural(a.naoLidas, 'não lida', 'não lidas')}` : ''})
                </option>
              ))}
            </V2Select>
          )}
          {areas.length > 1 && (
            <div role="group" aria-label="Filtrar por área" className="hidden flex-wrap gap-2 sm:flex">
              <span className="sr-only">Área:</span>
              <V2FilterChip
                active={!filtros.area}
                aria-pressed={!filtros.area}
                onClick={() => mudarFiltros({ area: null })}
                className="px-4 py-1.5"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" /> Todas as áreas
              </V2FilterChip>
              {areas.map((a) => {
                const Icon = AREA_ICON[a.id] || Bell;
                const ativa = filtros.area === a.id;
                return (
                  <V2FilterChip
                    key={a.id}
                    active={ativa}
                    aria-pressed={ativa}
                    title={a.label}
                    onClick={() => mudarFiltros({ area: ativa ? null : a.id })}
                    className="px-4 py-1.5"
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {a.curto}
                    <span className="text-xs opacity-70">{a.total}</span>
                    {a.naoLidas > 0 && <span className="sr-only">, {plural(a.naoLidas, 'não lida', 'não lidas')}</span>}
                  </V2FilterChip>
                );
              })}
            </div>
          )}
        </div>
      )}

      {muted.total > 0 && !isError && !carregando && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2 rounded-3xl border border-gray-100 bg-paper-pure px-4 py-3 text-sm text-gray-600">
          <p className="flex min-w-0 items-start gap-2">
            <BellOff className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
            <span>
              {filtros.silenciados
                ? `Mostrando também ${plural(muted.total, 'notificação silenciada', 'notificações silenciadas')} (${muted.categorias.join(', ')}).`
                : `Você silenciou ${muted.categorias.join(', ')}: ${plural(muted.total, 'notificação dessa categoria não aparece', 'notificações dessas categorias não aparecem')} aqui nem no sino.`}
            </span>
          </p>
          <div className="flex flex-wrap gap-1">
            <V2Button variant="ghost" size="sm" onClick={() => mudarFiltros({ silenciados: !filtros.silenciados })}>
              {filtros.silenciados ? 'Esconder de novo' : 'Mostrar também'}
            </V2Button>
            <V2Button asChild variant="ghost" size="sm">
              <Link to={NOTIFICATION_PREFS_PATH}>Ajustar</Link>
            </V2Button>
          </div>
        </div>
      )}

      {temFiltro && filtrada.length > 0 && !isError && (
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            onClick={limparFiltros}
            className="text-xs font-semibold text-gray-500 underline-offset-2 hover:text-ink hover:underline"
          >
            Limpar filtros
          </button>
        </div>
      )}

      {conteudo}
    </div>
  );
}
