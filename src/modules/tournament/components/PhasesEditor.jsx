import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { formatSetsPerMatchLabel, formatScoringSummary, normalizeStageScoringOverride } from '@/modules/tournament/domain/scoring';
import { Plus, Trash2, ArrowDown, Sparkles, Info, AlertTriangle, Users2, User } from 'lucide-react';
import { CollapsibleSection } from '@/components/ui/collapsible-section';
import {
  TOURNAMENT_STAGE_TYPE,
  TOURNAMENT_STAGE_TYPE_LABELS,
  availableStageTypes,
  PHASE_DIVISION_MODE,
  PHASE_DIVISION_MODE_LABELS,
  PHASE_QUALIFIER_MODE,
  PHASE_QUALIFIER_MODE_LABELS,
  PHASE_FEED_MODE,
  PHASE_FEED_MODE_LABELS,
  PHASE_PAIRING_MODE,
  PHASE_PAIRING_MODE_LABELS,
  PHASE_BRACKET_SEEDING_LABELS,
  MAX_PHASES_PER_MODALITY,
  TARGET_SCORE,
} from '@/modules/tournament/domain/constants';
import { normalizePhase, normalizePhases, supportsGroups, BRACKET_FORMATS } from '@/modules/tournament/domain/phases';
import { describeStage } from '@/modules/tournament/domain/formatExplain';
import { presetsForFormat, buildPreset } from '@/modules/tournament/domain/tournamentPresets';

const ROTATION_TYPES = [TOURNAMENT_STAGE_TYPE.AMERICANO, TOURNAMENT_STAGE_TYPE.MEXICANO];
const isRotation = (t) => ROTATION_TYPES.includes(t);

/* ----- Textos de ajuda (o que é cada opção e o que preencher a seguir) ----- */

const DIVISION_HELP = {
  [PHASE_DIVISION_MODE.SINGLE]: 'Todos jogam juntos, sem subdivisão.',
  [PHASE_DIVISION_MODE.GROUP_COUNT]: 'Você define quantos grupos; os atletas são repartidos de forma equilibrada (diferença máxima de 1 entre grupos).',
  [PHASE_DIVISION_MODE.MAX_PER_GROUP]: 'Você define o teto de atletas por grupo; o sistema cria o menor número de grupos equilibrados que respeita o teto.',
};
const QUALIFIER_HELP = {
  [PHASE_QUALIFIER_MODE.OVERALL]: 'Passam os N melhores classificados do grupo, sem distinção de gênero.',
  [PHASE_QUALIFIER_MODE.BY_GENDER]: 'Passam o(s) melhor(es) de cada gênero (M e F). Exige o gênero informado em cada inscrição.',
};
const FEED_HELP = {
  [PHASE_FEED_MODE.INHERIT_GROUPS]: 'Cada grupo da fase anterior segue como uma fonte (ex.: vencedor do A enfrenta o do B).',
  [PHASE_FEED_MODE.MERGE_GROUPS]: 'Junta grupos da fase anterior em novos grupos (ex.: A+B → AB).',
  [PHASE_FEED_MODE.POOL_ALL]: 'Junta todos os classificados em um pote e redistribui conforme a divisão desta fase.',
};
const PAIRING_HELP = {
  [PHASE_PAIRING_MODE.NONE]: 'Cada classificado avança individualmente.',
  [PHASE_PAIRING_MODE.MIXED_BY_GROUP]: 'Forma uma dupla mista (melhor homem + melhor mulher) por grupo. Exige classificação por gênero.',
  [PHASE_PAIRING_MODE.PAIR_TOP_TWO]: 'Forma uma dupla com os 2 melhores de cada grupo — é assim que um torneio individual vira de duplas na fase seguinte.',
};
const SEEDING_HELP = {
  standard: 'Cabeças-de-chave espalhadas: os primeiros colocados só se encontram nas fases finais.',
  adjacent: 'Cruzado por grupos: o classificado do grupo A enfrenta o do B, o do C enfrenta o do D, e assim por diante.',
};

function HelpText({ children }) {
  return <p className="text-[11px] leading-snug text-gray-500 mt-1">{children}</p>;
}

function MiniSelect({ label, value, options, onChange, help }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <select
        className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {Object.entries(options).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>
      {help && <HelpText>{help}</HelpText>}
    </div>
  );
}

/** Unidade de jogo de cada fase: Individual ou Duplas (e como evolui). */
function computePlayUnits(phases, format) {
  let formedDoubles = format === 'doubles';
  return phases.map((p, i) => {
    const unit = isRotation(p.type)
      ? 'Individual (rotação)'
      : formedDoubles
        ? 'Duplas'
        : 'Individual';
    const nextIsRotation = isRotation(phases[i + 1]?.type);
    if (p.pairing_mode && p.pairing_mode !== PHASE_PAIRING_MODE.NONE && !nextIsRotation) {
      formedDoubles = true;
    }
    return unit;
  });
}

/** Resumo de uma fase em linguagem simples (para o cabeçalho colapsado). */
function phaseSummary(phase, index, phases) {
  const parts = [TOURNAMENT_STAGE_TYPE_LABELS[phase.type]];
  if (phase.scoring_override) parts.push(formatScoringSummary(phase.scoring_override));
  if (supportsGroups(phase.type)) {
    if (phase.division_mode === PHASE_DIVISION_MODE.GROUP_COUNT) parts.push(`${phase.group_count} grupos`);
    else if (phase.division_mode === PHASE_DIVISION_MODE.MAX_PER_GROUP) parts.push(`até ${phase.max_per_group}/grupo`);
    else parts.push('grupo único');
  }
  const isLast = index === phases.length - 1;
  if (!isLast) {
    parts.push(`passam ${phase.qualifiers_per_group}/grupo`);
    if (phase.pairing_mode === PHASE_PAIRING_MODE.MIXED_BY_GROUP) parts.push('dupla mista');
    else if (phase.pairing_mode === PHASE_PAIRING_MODE.PAIR_TOP_TWO) parts.push('dupla dos 2 melhores');
  }
  return parts.join(' · ');
}

/** Avisos do que falta/está incoerente nesta fase (em tempo real). */
function phaseIssues(phase, index, phases, format) {
  const issues = [];
  const isLast = index === phases.length - 1;
  const allowed = availableStageTypes(format, true);
  if (!allowed.includes(phase.type)) {
    issues.push('Formato incompatível com o tipo de inscrição desta modalidade.');
  }
  if (phase.division_mode === PHASE_DIVISION_MODE.GROUP_COUNT && Number(phase.group_count) < 1) {
    issues.push('Defina um número de grupos válido (ao menos 1).');
  }
  if (phase.division_mode === PHASE_DIVISION_MODE.MAX_PER_GROUP && Number(phase.max_per_group) < 2) {
    issues.push('O máximo de atletas por grupo deve ser ao menos 2.');
  }
  if (!isLast && Number(phase.qualifiers_per_group) < 1) {
    issues.push('Defina quantos classificados avançam para a próxima fase (ao menos 1).');
  }
  if (phase.pairing_mode === PHASE_PAIRING_MODE.MIXED_BY_GROUP
      && phase.qualifier_mode !== PHASE_QUALIFIER_MODE.BY_GENDER) {
    issues.push('Para formar dupla mista por grupo, escolha a classificação “por gênero (M e F)”.');
  }
  if (!isLast && isRotation(phases[index + 1]?.type) && Number(phase.qualifiers_per_group) < 2) {
    issues.push(`A próxima fase (${TOURNAMENT_STAGE_TYPE_LABELS[phases[index + 1].type]}) exige ao menos 4 atletas por grupo — garanta classificados suficientes (ex.: 2 por grupo em 2 grupos = 4).`);
  }
  return issues;
}

/**
 * Editor das fases de uma modalidade (multi-fase). Cada fase escolhe o formato,
 * a divisão em grupos, a classificação para a próxima fase e como alimenta a
 * fase seguinte. Cada opção traz uma explicação e avisos do que falta preencher.
 */
export default function PhasesEditor({ phases, format, onChange }) {
  const stageOptions = Object.fromEntries(
    availableStageTypes(format, true).map((k) => [k, TOURNAMENT_STAGE_TYPE_LABELS[k]]),
  );
  const presets = presetsForFormat(format);
  const normalized = phases.map((p, i) => normalizePhase(p, { isFirst: i === 0 }));
  const units = computePlayUnits(normalized, format);

  function applyPreset(presetId) {
    if (!presetId) return;
    const built = buildPreset(presetId, format);
    if (built) onChange(normalizePhases(built));
  }

  function update(index, patch) {
    const next = phases.map((p, i) => (i === index ? normalizePhase({ ...p, ...patch }, { isFirst: index === 0 }) : p));
    onChange(next);
  }

  function updateScoring(index, patch) {
    const current = normalized[index]?.scoring_override || {};
    update(index, { scoring_override: normalizeStageScoringOverride({ ...current, ...patch }) });
  }

  function addPhase() {
    if (phases.length >= MAX_PHASES_PER_MODALITY) return;
    const allowed = availableStageTypes(format, true);
    onChange([
      ...phases,
      normalizePhase(
        { type: allowed[0], division_mode: PHASE_DIVISION_MODE.SINGLE, feed_mode: PHASE_FEED_MODE.POOL_ALL },
        { isFirst: false },
      ),
    ]);
  }

  function removePhase(index) {
    if (phases.length <= 1) return;
    onChange(phases.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <Label className="text-sm font-semibold">Fases do torneio</Label>
          <p className="text-xs text-gray-500">
            Encadeie fases (ex.: grupos → mata-mata). A inscrição é única; cada fase pode ter um
            formato diferente — inclusive virar de <strong>duplas</strong> a partir dos classificados.
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={addPhase} disabled={phases.length >= MAX_PHASES_PER_MODALITY}>
          <Plus className="w-4 h-4 mr-1" /> Adicionar fase
        </Button>
      </div>

      <div className="rounded-md border border-green-200 bg-green-50 p-2">
        <Label className="text-xs flex items-center gap-1 text-green-700">
          <Sparkles className="w-3.5 h-3.5" /> Começar a partir de um modelo
        </Label>
        <select
          className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm mt-1"
          value=""
          onChange={(e) => applyPreset(e.target.value)}
        >
          <option value="">— escolha um modelo pronto (opcional) —</option>
          {presets.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
        <p className="text-[11px] text-gray-500 mt-1">
          Preenche as fases automaticamente; você pode ajustar tudo depois. Veja o que cada modelo
          faz no{' '}
          <a
            href={`${import.meta.env.BASE_URL}torneios/guia`}
            target="_blank"
            rel="noreferrer"
            className="text-green-700 underline"
          >
            guia de formatos
          </a>.
        </p>
      </div>

      {normalized.map((phase, index) => {
        const isFirst = index === 0;
        const isLast = index === phases.length - 1;
        const grouped = supportsGroups(phase.type);
        const isBracket = BRACKET_FORMATS.has(phase.type);
        const isKnockout = phase.type === TOURNAMENT_STAGE_TYPE.KNOCKOUT;
        const nextIsRotation = isRotation(phases[index + 1]?.type);
        const issues = phaseIssues(phase, index, normalized, format);
        const unit = units[index];
        const unitIsDoubles = unit.startsWith('Duplas');

        return (
          <CollapsibleSection
            key={index}
            className="border-gray-200 bg-paper/40"
            headerClassName="py-1.5"
            title={`Fase ${index + 1}`}
            subtitle={phaseSummary(phase, index, normalized)}
            badges={(
              <>
                <Badge variant="secondary" className="gap-1">
                  {unitIsDoubles ? <Users2 className="w-3 h-3" /> : <User className="w-3 h-3" />}
                  {unit}
                </Badge>
                {issues.length > 0 && (
                  <Badge className="bg-amber-100 text-amber-800 gap-1">
                    <AlertTriangle className="w-3 h-3" /> {issues.length}
                  </Badge>
                )}
              </>
            )}
            actions={phases.length > 1 ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                title="Remover fase"
                onClick={() => removePhase(index)}
              >
                <Trash2 className="w-4 h-4 text-red-600" />
              </Button>
            ) : null}
            defaultOpen
          >
            <div className="space-y-3">
              <div className="rounded-md bg-green-50 border border-green-100 p-2 flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-green-600 mt-0.5 shrink-0" />
                <p className="text-[11px] leading-snug text-gray-500">
                  <strong>{TOURNAMENT_STAGE_TYPE_LABELS[phase.type]}:</strong> {describeStage(phase.type)}
                </p>
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
                    help={DIVISION_HELP[phase.division_mode]}
                  />
                )}

                {grouped && phase.division_mode === PHASE_DIVISION_MODE.GROUP_COUNT && (
                  <div>
                    <Label className="text-xs">Número de grupos</Label>
                    <Input type="number" min={1} value={phase.group_count} onChange={(e) => update(index, { group_count: e.target.value })} className="h-9" />
                  </div>
                )}
                {grouped && phase.division_mode === PHASE_DIVISION_MODE.MAX_PER_GROUP && (
                  <div>
                    <Label className="text-xs">Máx. de atletas por grupo</Label>
                    <Input type="number" min={2} value={phase.max_per_group} onChange={(e) => update(index, { max_per_group: e.target.value })} className="h-9" />
                  </div>
                )}

                {!grouped && isFirst && (
                  <div>
                    <Label className="text-xs">Cabeças-de-chave</Label>
                    <Input type="number" min={0} value={phase.seed_count} onChange={(e) => update(index, { seed_count: e.target.value })} className="h-9" />
                    <HelpText>Quantos melhores são espalhados na chave para não se cruzarem cedo (0 = sorteio livre).</HelpText>
                  </div>
                )}

                {isBracket && !isFirst && (
                  <MiniSelect
                    label="Chaveamento (a partir dos classificados)"
                    value={phase.bracket_seeding}
                    options={PHASE_BRACKET_SEEDING_LABELS}
                    onChange={(v) => update(index, { bracket_seeding: v })}
                    help={SEEDING_HELP[phase.bracket_seeding]}
                  />
                )}

                {isKnockout && (
                  <label className="flex items-start gap-2 text-xs text-gray-600 md:col-span-2">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={Boolean(phase.third_place)}
                      onChange={(e) => update(index, { third_place: e.target.checked })}
                    />
                    <span>Disputa de 3º lugar (medalha de bronze entre os perdedores das semifinais)</span>
                  </label>
                )}
              </div>

              <div className="rounded-md border border-gray-200 bg-white p-3 space-y-3">
                <div>
                  <div className="text-xs font-medium text-gray-600">Pontuação da fase</div>
                  <p className="text-[11px] leading-snug text-gray-500 mt-1">
                    Cada fase pode ter sua própria configuração de pontos por game e sets por partida.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Pontos por game</Label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {Object.values(TARGET_SCORE).map((score) => (
                        <button
                          key={score}
                          type="button"
                          onClick={() => updateScoring(index, { target_score: score })}
                          className={[
                            'rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-200',
                            Number(phase.scoring_override?.target_score) === score
                              ? 'border-green-500 bg-ink text-white'
                              : 'border-gray-100 bg-background text-gray-600 hover:border-green-400',
                          ].join(' ')}
                        >
                          {score} pontos
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Sets por partida</Label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {[1, 3, 5].map((sets) => (
                        <button
                          key={sets}
                          type="button"
                          onClick={() => updateScoring(index, { sets_per_match: sets })}
                          className={[
                            'rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-200',
                            Number(phase.scoring_override?.sets_per_match) === sets
                              ? 'border-green-500 bg-ink text-white'
                              : 'border-gray-100 bg-background text-gray-600 hover:border-green-400',
                          ].join(' ')}
                        >
                          {formatSetsPerMatchLabel(sets)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Classificação para a próxima fase (não aparece na última). */}
              {!isLast && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 rounded-md bg-white border border-gray-200 p-2">
                  <div className="md:col-span-2 text-xs font-medium text-gray-600">
                    Quem se classifica para a próxima fase
                  </div>
                  <div>
                    <Label className="text-xs">Classificados por grupo</Label>
                    <Input type="number" min={1} value={phase.qualifiers_per_group} onChange={(e) => update(index, { qualifiers_per_group: e.target.value })} className="h-9" />
                  </div>
                  <MiniSelect
                    label="Critério"
                    value={phase.qualifier_mode}
                    options={PHASE_QUALIFIER_MODE_LABELS}
                    onChange={(v) => update(index, { qualifier_mode: v })}
                    help={QUALIFIER_HELP[phase.qualifier_mode]}
                  />
                  {!nextIsRotation ? (
                    <MiniSelect
                      label="Formar duplas com os classificados?"
                      value={phase.pairing_mode}
                      options={PHASE_PAIRING_MODE_LABELS}
                      onChange={(v) => update(index, { pairing_mode: v })}
                      help={PAIRING_HELP[phase.pairing_mode]}
                    />
                  ) : (
                    <div className="md:col-span-1">
                      <Label className="text-xs">Formar duplas com os classificados?</Label>
                      <HelpText>
                        A próxima fase é de rotação (Americano/Mexicano): os classificados avançam
                        individualmente e as duplas são montadas a cada rodada.
                      </HelpText>
                    </div>
                  )}
                  {phase.pairing_mode !== PHASE_PAIRING_MODE.NONE && !nextIsRotation && (
                    <p className="md:col-span-2 text-[11px] text-green-700 inline-flex items-center gap-1">
                      <Users2 className="w-3.5 h-3.5" /> A partir da próxima fase joga-se em
                      <strong> duplas</strong> formadas pelos classificados.
                    </p>
                  )}
                </div>
              )}

              {/* Alimentação a partir da fase anterior (não aparece na primeira). */}
              {!isFirst && (
                <div className="rounded-md bg-white border border-gray-200 p-2 space-y-2">
                  <div className="flex items-center gap-1 text-xs font-medium text-gray-600">
                    <ArrowDown className="w-3.5 h-3.5" /> Como recebe os classificados
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <MiniSelect
                      label="Alimentação"
                      value={phase.feed_mode}
                      options={PHASE_FEED_MODE_LABELS}
                      onChange={(v) => update(index, { feed_mode: v })}
                      help={FEED_HELP[phase.feed_mode]}
                    />
                    {phase.feed_mode === PHASE_FEED_MODE.MERGE_GROUPS && (
                      <div>
                        <Label className="text-xs">Grupos por fusão (ex.: 2 → AB)</Label>
                        <Input type="number" min={2} value={phase.merge_size} onChange={(e) => update(index, { merge_size: e.target.value })} className="h-9" />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Avisos do que falta/está incoerente. */}
              {issues.length > 0 && (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-2">
                  <div className="flex items-center gap-1 text-xs font-medium text-amber-800">
                    <AlertTriangle className="w-3.5 h-3.5" /> Revise antes de salvar
                  </div>
                  <ul className="list-disc pl-5 mt-1 space-y-0.5 text-[11px] text-amber-900">
                    {issues.map((it, i) => <li key={i}>{it}</li>)}
                  </ul>
                </div>
              )}
            </div>
          </CollapsibleSection>
        );
      })}
    </div>
  );
}
