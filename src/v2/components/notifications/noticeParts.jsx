/**
 * Peças comuns de um aviso, usadas pelo sino e pela central de notificações:
 * o ícone da ÁREA (de onde o aviso vem) e a hora. Assim as duas telas dizem a
 * mesma coisa do mesmo aviso.
 */
import React from 'react';
import {
  Bell, Building2, CalendarDays, GraduationCap, Megaphone, MessageSquare, Sparkles, Trophy, UserCog, Users,
} from 'lucide-react';
import { cn } from '@/core/lib/utils';
import {
  NOTICE_AREA, noticeArea, noticeAreaMeta, noticeFullDate, noticeTime, noticeTimeLabel,
} from '@/modules/notifications/domain/noticeFeed';

export const AREA_ICON = Object.freeze({
  [NOTICE_AREA.JOGOS]: CalendarDays,
  [NOTICE_AREA.TORNEIOS]: Trophy,
  [NOTICE_AREA.ARENAS]: Building2,
  [NOTICE_AREA.CLUBES]: Users,
  [NOTICE_AREA.AULAS]: GraduationCap,
  [NOTICE_AREA.SOCIAL]: MessageSquare,
  [NOTICE_AREA.PROMOCOES]: Megaphone,
  [NOTICE_AREA.GAMIFICACAO]: Sparkles,
  [NOTICE_AREA.CONTA]: UserCog,
  [NOTICE_AREA.OUTROS]: Bell,
});

/** O ícone da área do aviso, num círculo; destacado enquanto não lido. */
export function NoticeIcon({ notice, size = 'md', className }) {
  const area = noticeArea(notice);
  const Icon = AREA_ICON[area] || Bell;
  const lida = Boolean(notice?.read);
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full',
        size === 'sm' ? 'h-8 w-8' : 'h-10 w-10',
        lida ? 'bg-gray-100 text-gray-500' : 'bg-acid/20 text-ink',
        className,
      )}
      title={noticeAreaMeta(area).label}
      aria-hidden="true"
    >
      <Icon className={size === 'sm' ? 'h-4 w-4' : 'h-[18px] w-[18px]'} />
    </span>
  );
}

/** A hora do aviso: curta na tela, completa para o leitor de tela e o `title`. */
export function NoticeTime({ notice, agora, className }) {
  const ms = noticeTime(notice);
  const curto = noticeTimeLabel(ms, agora);
  if (!curto) return null;
  const completo = noticeFullDate(ms);
  return (
    <time
      dateTime={new Date(ms).toISOString()}
      title={completo}
      className={cn('text-[11px] font-medium text-gray-400', className)}
    >
      <span aria-hidden="true">{curto}</span>
      <span className="sr-only">{completo}</span>
    </time>
  );
}
