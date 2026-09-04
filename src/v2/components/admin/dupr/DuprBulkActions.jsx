/**
 * Barra de AÇÕES EM MASSA das tabelas da governança DUPR.
 *
 * Aparece só quando há partidas selecionadas e diz, em português claro, sobre
 * QUANTAS partidas a ação vai valer — incluindo as que estão selecionadas mas
 * fora do recorte visível (a seleção sobrevive à troca de filtros de propósito).
 *
 * Só apresentação: quem grava é a página, pelos callbacks.
 */

import React from 'react';
import { Ban, CheckCheck, Clock, Download, X } from 'lucide-react';
import { ADMIN_ASSIGNABLE_STATUSES, EXPORT_STATUS, EXPORT_STATUS_LABELS } from '@/modules/rating/domain/duprReconcile';
import { V2Button } from '@/v2/ui/primitives';

/** Ícone de cada situação atribuível pelo admin. */
const STATUS_ICON = {
  [EXPORT_STATUS.PENDING]: Clock,
  [EXPORT_STATUS.EXPORTED]: Download,
  [EXPORT_STATUS.SUBMITTED]: CheckCheck,
  [EXPORT_STATUS.EXCLUDED]: Ban,
};

/**
 * @param {object} props
 * @param {number} props.count        total de partidas selecionadas
 * @param {number} props.hiddenCount  quantas dessas estão fora desta lista
 * @param {(status:string)=>void} props.onStatus
 * @param {()=>void} props.onClear
 * @param {Array<{key:string,label:string,icon:Function,onClick:Function,variant?:string}>} [props.extraActions]
 * @param {boolean} [props.disabled]
 */
export default function DuprBulkActions({
  count = 0,
  hiddenCount = 0,
  onStatus,
  onClear,
  extraActions = [],
  disabled = false,
}) {
  if (count <= 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-gray-100 bg-acid/10 px-4 py-3">
      <span className="text-sm font-semibold text-ink">
        {count} partida(s) selecionada(s)
      </span>
      {hiddenCount > 0 && (
        <span className="text-xs text-gray-500">
          ({hiddenCount} fora do recorte atual — a ação também vale para ela(s))
        </span>
      )}
      <span className="text-xs uppercase tracking-wide text-gray-400">Tornar</span>
      {ADMIN_ASSIGNABLE_STATUSES.map((status) => {
        const Icon = STATUS_ICON[status];
        return (
          <V2Button
            key={status}
            variant={status === EXPORT_STATUS.EXCLUDED ? 'danger' : 'ghost'}
            size="sm"
            onClick={() => onStatus(status)}
            disabled={disabled}
          >
            {Icon && <Icon className="mr-1.5 h-3.5 w-3.5" />}
            {EXPORT_STATUS_LABELS[status]}
          </V2Button>
        );
      })}
      {extraActions.map(({ key, label, icon: Icon, onClick, variant = 'secondary' }) => (
        <V2Button key={key} variant={variant} size="sm" onClick={onClick} disabled={disabled}>
          {Icon && <Icon className="mr-1.5 h-3.5 w-3.5" />}
          {label}
        </V2Button>
      ))}
      <V2Button variant="ghost" size="sm" onClick={onClear} disabled={disabled}>
        <X className="mr-1.5 h-3.5 w-3.5" /> Limpar seleção
      </V2Button>
    </div>
  );
}
