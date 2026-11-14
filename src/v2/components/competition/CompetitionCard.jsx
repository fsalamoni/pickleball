/**
 * O cartão da LISTA, o mesmo para torneio e liga: ícone, nome, situação,
 * local, descrição, selos e a chamada do rodapé.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';

/**
 * @param {{
 *   to: string,
 *   icon: React.ComponentType<any>,
 *   title: string,
 *   status?: React.ReactNode,
 *   location: string,
 *   description?: string,
 *   badges?: React.ReactNode,
 *   footer: React.ReactNode,
 * }} props
 */
export default function CompetitionCard({ to, icon: Icon, title, status, location, description, badges, footer }) {
  return (
    <Link
      to={to}
      className="group flex h-full flex-col rounded-4xl border border-gray-100 bg-paper-pure p-6 shadow-organic-sm transition-all hover:shadow-organic sm:p-7"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-ink text-white transition-colors group-hover:bg-acid group-hover:text-ink">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <h3 className="truncate font-display text-lg font-bold text-ink">{title}</h3>
        </div>
        {status && <div className="flex shrink-0 flex-col items-end gap-1.5">{status}</div>}
      </div>

      <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
        <MapPin className="h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" /> <span className="truncate">{location}</span>
      </div>

      {description && <p className="mt-3 line-clamp-2 text-sm leading-6 text-gray-500">{description}</p>}

      {badges && <div className="mt-4 flex flex-wrap gap-2 text-xs">{badges}</div>}

      <div className="mt-auto flex items-center justify-between pt-6 text-sm font-bold text-ink">
        <span>{footer}</span>
        <span className="transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>
      </div>
    </Link>
  );
}
