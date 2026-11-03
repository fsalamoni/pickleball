/**
 * LineCourtsBoard — o controle de linhas QUADRA POR QUADRA: cada quadra liga o
 * seu e escolhe o seu arranjo (uma quadra pode ter uma câmera e a do lado
 * cinco). O mesmo quadro no cartão do dia de jogo, na página de linhas do dia
 * e na do torneio; muda só onde grava (`onSave`) e para onde cada quadra leva
 * (`pageFor`).
 *
 * Quem organiza (`staff`) liga, desliga e troca o arranjo ali mesmo; os
 * demais veem só as quadras ligadas, com a câmera (quando podem ser câmera) e
 * a central.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { Camera, MonitorPlay, Settings2 } from 'lucide-react';

import { V2Button, V2Badge, V2Select, V2Toggle } from '@/v2/ui/primitives';
import { layoutById, layoutsByCount, layoutJudges } from '@/modules/linecall/domain/cameraLayouts';
import { cn } from '@/core/lib/utils';
import { t } from '@/core/i18n';

const GROUPS = layoutsByCount();

/** O que o arranjo julga, em poucas palavras (o pé exige câmera que vê pés). */
function judgesText(layoutId) {
  return layoutJudges(layoutId).feet
    ? t('linhas, saque, cozinha e pé no saque')
    : t('linhas e saque (não julga pé)');
}

/**
 * @param {{
 *   courts: Array<{ id: string, index: number }>,
 *   docs: Record<string, { line_control?: boolean, line_control_layout?: string }>,
 *   staff: boolean, camera?: boolean,
 *   pageFor: (courtId: string) => string,
 *   onSave: (items: Array<{ courtId: string, patch: object, exists: boolean }>) => void,
 *   saving?: boolean, newTab?: boolean,
 * }} props `camera`: esta pessoa pode ser câmera; `newTab`: câmera e central abrem em outra aba
 */
export default function LineCourtsBoard({ courts, docs, staff, camera = staff, pageFor, onSave, saving = false, newTab = false }) {
  const visiveis = staff ? courts : courts.filter((c) => docs[c.id]?.line_control === true);
  const ligadas = courts.filter((c) => docs[c.id]?.line_control === true);
  const aba = newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {};
  const todas = (on) => onSave(
    courts.filter((c) => (docs[c.id]?.line_control === true) !== on)
      .map((c) => ({ courtId: c.id, patch: { line_control: on }, exists: Boolean(docs[c.id]) })),
  );

  return (
    <div className="space-y-2">
      <ul className="space-y-2" data-dica="linhas-quadras">
        {visiveis.map((c) => {
          const d = docs[c.id];
          const on = d?.line_control === true;
          const layout = layoutById(d?.line_control_layout);
          const nome = t('Quadra {n}', { n: c.index });
          return (
            <li key={c.id} className={cn('rounded-2xl border p-3', on ? 'border-acid/40 bg-acid/10' : 'border-gray-100')}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">{nome}</p>
                  <p className="text-xs text-gray-500">
                    {on
                      ? t('{n} câmera(s) · {j}', { n: layout.positions.length, j: judgesText(layout.id) })
                      : t('Desligado')}
                  </p>
                </div>
                {staff ? (
                  <V2Toggle
                    id={`linhas-${c.id}`}
                    checked={on}
                    disabled={saving}
                    ariaLabel={t('Controle de linhas na {q}', { q: nome })}
                    onChange={(v) => onSave([{ courtId: c.id, patch: { line_control: v }, exists: Boolean(d) }])}
                  />
                ) : (
                  <V2Badge tone="green">{t('Ligado')}</V2Badge>
                )}
              </div>
              {on && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {staff && (
                    <V2Select
                      aria-label={t('Arranjo das câmeras da {q}', { q: nome })}
                      value={layout.id}
                      disabled={saving}
                      onChange={(e) => onSave([{ courtId: c.id, patch: { line_control_layout: e.target.value }, exists: true }])}
                      className="h-10 min-w-0 flex-1 basis-56 text-sm"
                    >
                      {GROUPS.map(([n, list]) => (
                        <optgroup key={n} label={t('{n} câmera(s)', { n })}>
                          {list.map((l) => <option key={l.id} value={l.id}>{t(l.label)}</option>)}
                        </optgroup>
                      ))}
                    </V2Select>
                  )}
                  {camera && (
                    <V2Button asChild size="sm">
                      <Link to={`${pageFor(c.id)}&modo=camera`} {...aba}><Camera className="h-4 w-4" /> {t('Abrir câmera')}</Link>
                    </V2Button>
                  )}
                  <V2Button asChild size="sm" variant="secondary">
                    <Link to={`${pageFor(c.id)}&modo=central`} {...aba}><MonitorPlay className="h-4 w-4" /> {t('Abrir central')}</Link>
                  </V2Button>
                  {staff && (
                    <V2Button asChild size="sm" variant="ghost">
                      <Link to={pageFor(c.id)} {...aba}><Settings2 className="h-4 w-4" /> {t('Onde pôr as câmeras')}</Link>
                    </V2Button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {staff && courts.length > 1 && (
        <div className="flex flex-wrap gap-2 pt-1">
          <V2Button size="sm" variant="secondary" disabled={saving || ligadas.length === courts.length} onClick={() => todas(true)}>
            {t('Ligar em todas as quadras')}
          </V2Button>
          <V2Button size="sm" variant="ghost" disabled={saving || !ligadas.length} onClick={() => todas(false)}>
            {t('Desligar todas')}
          </V2Button>
        </div>
      )}
    </div>
  );
}
