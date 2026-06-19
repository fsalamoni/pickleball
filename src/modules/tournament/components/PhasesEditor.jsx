import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, ArrowDown } from 'lucide-react';
import {
  TOURNAMENT_STAGE_TYPE_LABELS,
  STAGE_TYPES_BY_FORMAT,
  PHASE_DIVISION_MODE,
  PHASE_DIVISION_MODE_LABELS,
  PHASE_QUALIFIER_MODE,
  PHASE_QUALIFIER_MODE_LABELS,
  PHASE_FEED_MODE,
  PHASE_FEED_MODE_LABELS,
  PHASE_PAIRING_MODE_LABELS,
  MAX_PHASES_PER_MODALITY,
} from '@/modules/tournament/domain/constants';
import { normalizePhase, supportsGroups } from '@/modules/tournament/domain/phases';

function MiniSelect({ label, value, options, onChange, disabled }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <select
        className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm disabled:opacity-50"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        {Object.entries(options).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>
    </div>
  );
}

/**
 * Editor das fases de uma modalidade (multi-fase). Recebe e devolve o array de
 * fases já normalizadas. Cada fase escolhe o formato, a divisão em grupos, a
 * classificação para a próxima fase e como alimenta a fase seguinte.
 */
export default function PhasesEditor({ phases, format, onChange }) {
  const stageOptions = Object.fromEntries(
    (STAGE_TYPES_BY_FORMAT[format] || []).map((k) => [k, TOURNAMENT_STAGE_TYPE_LABELS[k]]),
  );

  function update(index, patch) {
    const next = phases.map((p, i) => (i === index ? normalizePhase({ ...p, ...patch }, { isFirst: index === 0 }) : p));
    onChange(next);
  }

  function addPhase() {
    if (phases.length >= MAX_PHASES_PER_MODALITY) return;
    const allowed = STAGE_TYPES_BY_FORMAT[format] || [];
    const next = [
      ...phases,
      normalizePhase(
        { type: allowed[0], division_mode: PHASE_DIVISION_MODE.SINGLE, feed_mode: PHASE_FEED_MODE.POOL_ALL },
        { isFirst: false },
      ),
    ];
    onChange(next);
  }

  function removePhase(index) {
    if (phases.length <= 1) return;
    onChange(phases.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-semibold">Fases do torneio</Label>
          <p className="text-xs text-slate-500">
            Encadeie fases (ex.: grupos → mata-mata). A inscrição é única; a organização de
            grupos/chaves acontece na aba Sorteio.
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={addPhase} disabled={phases.length >= MAX_PHASES_PER_MODALITY}>
          <Plus className="w-4 h-4 mr-1" /> Adicionar fase
        </Button>
      </div>

      {phases.map((rawPhase, index) => {
        const phase = normalizePhase(rawPhase, { isFirst: index === 0 });
        const isFirst = index === 0;
        const isLast = index === phases.length - 1;
        const grouped = supportsGroups(phase.type);
        return (
          <div key={index} className="rounded-md border border-slate-200 p-3 space-y-3 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <Badge variant="secondary">Fase {index + 1}</Badge>
              {phases.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  title="Remover fase"
                  onClick={() => removePhase(index)}
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <MiniSelect
                label="Formato da fase"
                value={phase.type}
                options={stageOptions}
                onChange={(v) => update(index, { type: v })}
              />

              {grouped && (
                <MiniSelect
                  label="Divisão em grupos"
                  value={phase.division_mode}
                  options={PHASE_DIVISION_MODE_LABELS}
                  onChange={(v) => update(index, { division_mode: v })}
                />
              )}

              {grouped && phase.division_mode === PHASE_DIVISION_MODE.GROUP_COUNT && (
                <div>
                  <Label className="text-xs">Número de grupos</Label>
                  <Input
                    type="number"
                    min={1}
                    value={phase.group_count}
                    onChange={(e) => update(index, { group_count: e.target.value })}
                    className="h-9"
                  />
                </div>
              )}
              {grouped && phase.division_mode === PHASE_DIVISION_MODE.MAX_PER_GROUP && (
                <div>
                  <Label className="text-xs">Máx. de atletas por grupo</Label>
                  <Input
                    type="number"
                    min={2}
                    value={phase.max_per_group}
                    onChange={(e) => update(index, { max_per_group: e.target.value })}
                    className="h-9"
                  />
                </div>
              )}

              {!grouped && (
                <div>
                  <Label className="text-xs">Cabeças-de-chave</Label>
                  <Input
                    type="number"
                    min={0}
                    value={phase.seed_count}
                    onChange={(e) => update(index, { seed_count: e.target.value })}
                    className="h-9"
                  />
                </div>
              )}
            </div>

            {/* Classificação para a próxima fase (não aparece na última). */}
            {!isLast && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 rounded-md bg-white border border-slate-200 p-2">
                <div className="md:col-span-2 text-xs font-medium text-slate-600">
                  Quem se classifica para a próxima fase
                </div>
                <div>
                  <Label className="text-xs">Classificados por grupo</Label>
                  <Input
                    type="number"
                    min={1}
                    value={phase.qualifiers_per_group}
                    onChange={(e) => update(index, { qualifiers_per_group: e.target.value })}
                    className="h-9"
                  />
                </div>
                <MiniSelect
                  label="Critério"
                  value={phase.qualifier_mode}
                  options={PHASE_QUALIFIER_MODE_LABELS}
                  onChange={(v) => update(index, { qualifier_mode: v })}
                />
                <MiniSelect
                  label="Formar duplas com os classificados?"
                  value={phase.pairing_mode}
                  options={PHASE_PAIRING_MODE_LABELS}
                  onChange={(v) => update(index, { pairing_mode: v })}
                />
                {phase.qualifier_mode === PHASE_QUALIFIER_MODE.BY_GENDER && (
                  <p className="md:col-span-2 text-[11px] text-slate-500">
                    Passa o(s) melhor(es) de cada gênero (M e F) — útil para formar duplas mistas.
                  </p>
                )}
              </div>
            )}

            {/* Alimentação a partir da fase anterior (não aparece na primeira). */}
            {!isFirst && (
              <div className="rounded-md bg-white border border-slate-200 p-2 space-y-2">
                <div className="flex items-center gap-1 text-xs font-medium text-slate-600">
                  <ArrowDown className="w-3.5 h-3.5" /> Como recebe os classificados
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <MiniSelect
                    label="Alimentação"
                    value={phase.feed_mode}
                    options={PHASE_FEED_MODE_LABELS}
                    onChange={(v) => update(index, { feed_mode: v })}
                  />
                  {phase.feed_mode === PHASE_FEED_MODE.MERGE_GROUPS && (
                    <div>
                      <Label className="text-xs">Grupos por fusão (ex.: 2 → AB)</Label>
                      <Input
                        type="number"
                        min={2}
                        value={phase.merge_size}
                        onChange={(e) => update(index, { merge_size: e.target.value })}
                        className="h-9"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
