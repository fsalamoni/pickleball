/**
 * O SINO do topo de toda tela.
 *
 * 🐞 Antes a caixa não tinha altura máxima: ela crescia com a lista, passava
 * do fim da tela e o que ficava abaixo era inalcançável — sem rolagem e sem
 * nenhum outro lugar para ver os avisos antigos. Agora a caixa cabe na tela
 * (o espaço que sobra abaixo do botão, no máximo 36rem), o cabeçalho e o
 * rodapé ficam presos e só a LISTA rola.
 *
 * Com a central de notificações (flag `notifications_center`), o sino mostra
 * os 20 mais novos e o rodapé leva a TODOS — dizendo quantos ficaram de fora
 * e quantos deles não foram lidos, senão o selo contaria avisos que a pessoa
 * não acha no sino. Desligada, o sino mostra a lista inteira, com rolagem.
 */
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, ChevronRight, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/core/lib/utils';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { destinoDeAviso } from '@/core/domain/internalLink';
import { useNotifications } from '@/modules/notifications/hooks/useNotifications';
import {
  bellAccessibleLabel, bellSlice, formatUnreadBadge,
} from '@/modules/notifications/domain/noticeFeed';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import PartnerInviteNotificationAction from '@/v2/components/tournament/PartnerInviteNotificationAction';
import { NoticeIcon, NoticeTime } from '@/v2/components/notifications/noticeParts';

export const NOTIFICATIONS_PATH = '/notificacoes';
export const NOTIFICATION_PREFS_PATH = '/configuracoes#notificacoes';

export default function NotificationsBell() {
  const navigate = useNavigate();
  const centralOn = useFeatureFlag(FEATURE_FLAG.NOTIFICATIONS_CENTER);
  const {
    notifications, unreadCount, muted, isLoading, isError, retry, markAsRead, markAllAsRead,
  } = useNotifications();
  const [aberto, setAberto] = useState(false);
  // "há 5 min" é medido a partir de quando o sino abre.
  const [agora, setAgora] = useState(() => Date.now());
  const [marcando, setMarcando] = useState(false);

  const { itens, restantes, naoLidasFora } = centralOn
    ? bellSlice(notifications)
    : { itens: notifications, restantes: 0, naoLidasFora: 0 };
  const selo = formatUnreadBadge(unreadCount);

  function onOpenChange(v) {
    setAberto(v);
    if (v) setAgora(Date.now());
  }

  function abrir(n) {
    if (!n.read) markAsRead(n.id).catch(() => {});
    const destino = destinoDeAviso(n.link);
    if (destino) navigate(destino);
  }

  async function marcarTodas(event) {
    // Mantém o sino aberto enquanto marca.
    event.preventDefault();
    if (marcando) return;
    setMarcando(true);
    try {
      await markAllAsRead();
    } catch {
      toast.error('Não foi possível marcar as notificações como lidas. Tente de novo.');
    } finally {
      setMarcando(false);
    }
  }

  let corpo;
  if (isError) {
    // Falha não é "nenhuma notificação".
    corpo = (
      <div role="alert" className="p-5 text-center text-sm text-amber-800">
        <p className="font-semibold">Não foi possível carregar as notificações.</p>
        <p className="mt-1 text-xs text-amber-700">A conexão falhou no meio do caminho.</p>
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); retry(); }}
          className="mt-3 rounded-full bg-ink px-4 py-1.5 text-xs font-bold text-white"
        >
          Tentar de novo
        </button>
      </div>
    );
  } else if (isLoading && notifications.length === 0) {
    // Carregando não é "nenhuma notificação" também.
    corpo = (
      <div className="space-y-2 p-3" aria-busy="true" aria-label="Carregando notificações">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-3">
            <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-gray-100" />
            <div className="flex-1 space-y-1.5 py-1">
              <div className="h-3.5 w-3/4 animate-pulse rounded-full bg-gray-100" />
              <div className="h-3 w-1/2 animate-pulse rounded-full bg-gray-100" />
            </div>
          </div>
        ))}
      </div>
    );
  } else if (notifications.length === 0) {
    corpo = (
      <div className="px-5 py-8 text-center">
        <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-acid/15 text-ink">
          <Bell className="h-5 w-5" aria-hidden="true" />
        </span>
        <p className="text-sm font-bold text-ink">Nenhuma notificação por enquanto</p>
        <p className="mt-1 text-xs text-gray-500">
          Convites, respostas de reserva, resultados e novidades dos seus clubes chegam aqui.
        </p>
        {muted.total > 0 && (
          <p className="mt-2 text-xs text-gray-500">
            Você silenciou {muted.categorias.join(', ')} — esses avisos não aparecem aqui.
          </p>
        )}
      </div>
    );
  } else {
    corpo = itens.map((n) => (
      <DropdownMenuItem
        key={n.id}
        onSelect={() => abrir(n)}
        className={cn(
          'cursor-pointer items-start gap-3 rounded-2xl px-3 py-2.5',
          !n.read && 'bg-acid/10',
        )}
      >
        <NoticeIcon notice={n} />
        <div className="min-w-0 flex-1">
          <p className={cn('line-clamp-2 text-sm leading-snug text-ink', n.read ? 'font-semibold' : 'font-bold')}>
            {n.title}
          </p>
          {n.message && <p className="mt-0.5 line-clamp-3 text-xs leading-relaxed text-gray-500">{n.message}</p>}
          <PartnerInviteNotificationAction
            notification={n}
            onResolved={() => { if (!n.read) markAsRead(n.id).catch(() => {}); }}
          />
          <NoticeTime notice={n} agora={agora} className="mt-1 block" />
        </div>
        {!n.read && (
          <>
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-acid" aria-hidden="true" />
            <span className="sr-only">Não lida</span>
          </>
        )}
      </DropdownMenuItem>
    ));
  }

  return (
    <DropdownMenu open={aberto} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-dica="botao-notificacoes"
          aria-label={bellAccessibleLabel(unreadCount)}
          className="btn-press relative flex h-10 w-10 items-center justify-center rounded-full bg-white text-gray-500 shadow-sm transition-colors hover:text-ink"
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
          {selo && (
            <span
              aria-hidden="true"
              className="absolute -right-1 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-acid px-1 text-[10px] font-bold leading-none text-ink"
            >
              {selo}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        collisionPadding={8}
        className="flex w-[min(24rem,calc(100vw-1rem))] flex-col rounded-3xl p-0"
        // A caixa cabe no espaço que sobra abaixo do botão; quem rola é a lista.
        style={{ maxHeight: 'min(36rem, var(--radix-dropdown-menu-content-available-height, 80dvh))' }}
      >
        <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
          <div className="min-w-0">
            <p className="font-display text-base font-bold text-ink">Notificações</p>
            {unreadCount > 0 && (
              <p className="text-xs text-gray-500">
                {unreadCount} não {unreadCount === 1 ? 'lida' : 'lidas'}
              </p>
            )}
          </div>
          {unreadCount > 0 && !isError && (
            <button
              type="button"
              onClick={marcarTodas}
              disabled={marcando}
              className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-gray-500 transition-colors hover:bg-gray-50 hover:text-ink disabled:opacity-60"
            >
              <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
              {marcando ? 'Marcando…' : 'Marcar todas como lidas'}
            </button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5" data-lista-do-sino="">
          {corpo}
        </div>

        <div className="flex items-stretch gap-1 border-t border-gray-100 p-1.5">
          {centralOn && (
            <DropdownMenuItem asChild className="flex-1 cursor-pointer rounded-2xl px-3 py-2.5">
              <Link to={NOTIFICATIONS_PATH} className="flex items-center justify-between gap-2">
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-ink">Ver todas as notificações</span>
                  {restantes > 0 && (
                    <span className="block text-xs text-gray-500">
                      Mais {restantes} {restantes === 1 ? 'aviso' : 'avisos'}
                      {naoLidasFora > 0 && ` · ${naoLidasFora} não ${naoLidasFora === 1 ? 'lida' : 'lidas'}`}
                    </span>
                  )}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            asChild
            className={cn('cursor-pointer rounded-2xl px-3 py-2.5', !centralOn && 'flex-1')}
          >
            <Link
              to={NOTIFICATION_PREFS_PATH}
              aria-label="Preferências de notificação"
              title="Preferências de notificação"
              className="flex items-center justify-center gap-2 text-sm font-semibold text-gray-500"
            >
              <Settings className="h-4 w-4" aria-hidden="true" />
              {!centralOn && <span>Preferências de notificação</span>}
            </Link>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
