/**
 * Os atalhos da tela inicial — cada um leva DIRETO aonde a pessoa vai (a
 * Central da arena dela, o painel de professor, "criar torneio"), com o
 * número do que espera por ela quando há (pedidos de reserva).
 *
 * Os atalhos saem de `homeShortcuts` (domínio): a ordem e o que entra é regra
 * testada, não decisão desta tela.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import {
  Building2, CalendarCheck, CalendarClock, ClipboardList, Dices, GraduationCap, Handshake,
  LayoutDashboard, Medal, Megaphone, Sparkles, TrendingUp, Trophy, Users, Zap,
} from 'lucide-react';

const ICONES = {
  Building2, CalendarCheck, CalendarClock, ClipboardList, Dices, GraduationCap, Handshake,
  LayoutDashboard, Medal, Megaphone, TrendingUp, Trophy, Users, Zap,
};

export default function HomeShortcuts({ atalhos = [] }) {
  if (atalhos.length === 0) return null;
  return (
    <nav aria-label="Atalhos para você" className="mb-6">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {atalhos.map((a) => {
          const Icon = ICONES[a.icon] || Sparkles;
          return (
            <li key={a.id}>
              <Link
                to={a.to}
                className="btn-press group relative flex h-full items-center gap-3 rounded-3xl border border-gray-100 bg-paper-pure p-4 shadow-organic-sm transition-all hover:border-gray-300 hover:shadow-organic focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acid/30"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-paper text-ink transition-colors group-hover:bg-acid" aria-hidden="true">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-display text-sm font-bold text-ink sm:text-base">{a.label}</span>
                  {a.hint && <span className="block truncate text-xs text-gray-500">{a.hint}</span>}
                </span>
                {a.badge > 0 && (
                  <span className="absolute right-3 top-3 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-acid px-1.5 text-[10px] font-bold text-ink">
                    {a.badge > 99 ? '99+' : a.badge}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
