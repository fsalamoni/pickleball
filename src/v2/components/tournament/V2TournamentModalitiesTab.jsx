import React, { useState } from 'react';
import { Pencil, Plus, Trash2, BookOpen, CalendarClock, Layers, Settings2, Ticket } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  useModalities,
  useCreateModality,
  useDeleteModality,
  useUpdateModality,
} from '@/modules/tournament/hooks/useTournament';
import {
  MODALITY_FORMAT,
  MODALITY_FORMAT_LABELS,
  SKILL_LEVEL,
  SKILL_LEVEL_LABELS,
  GENDER_CATEGORY,
  GENDER_CATEGORY_LABELS,
  AGE_CATEGORY,
  AGE_CATEGORY_LABELS,
  TOURNAMENT_STAGE_TYPE,
  TOURNAMENT_STAGE_TYPE_LABELS,
  STAGE_TYPES_BY_FORMAT,
  availableStageTypes,
  MAX_REGISTRATIONS_PER_MODALITY,
  TARGET_SCORE,
} from '@/modules/tournament/domain/constants';
import { DEFAULT_MAX_ENTRIES, hasUnlimitedEntries } from '@/modules/tournament/domain/capacity';
import {
  DEFAULT_COURT_COUNT,
  DEFAULT_MATCH_DURATION_MINUTES,
  MAX_COURT_COUNT,
  computeWindowSlots,
} from '@/modules/tournament/domain/scheduling';
import { normalizePhases, validatePhases, defaultPhase } from '@/modules/tournament/domain/phases';
import { formatScoringSummary } from '@/modules/tournament/domain/scoring';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import StageExplanation from '@/modules/tournament/components/StageExplanation';
import PhasesEditor from '@/modules/tournament/components/PhasesEditor';
import { V2Badge, V2Button, V2EmptyState, V2Surface } from '@/v2/ui/primitives';

const PREVIEW_PLAYER_COUNT = 8;

const emptyForm = {
  name: '',  format: MODALITY_FORMAT.DOUBLES,
  skill_level: SKILL_LEVEL.INTERMEDIATE,
  gender_category: GENDER_CATEGORY.OPEN,
  age_category: AGE_CATEGORY.OPEN,
  max_entries: DEFAULT_MAX_ENTRIES,
  has_unlimited_entries: false,
  entry_fee_brl: 0,
  stage_type: TOURNAMENT_STAGE_TYPE.ROUND_ROBIN,
  group_count: 1,
  seed_count: 0,
  phases: [defaultPhase(MODALITY_FORMAT.DOUBLES, true)],
  court_count: DEFAULT_COURT_COUNT,
  match_duration_minutes: DEFAULT_MATCH_DURATION_MINUTES,
  play_date: '',
  play_start_time: '',
  play_end_time: '',
  notes: '',
};

function buildFormState(modality) {
  if (!modality) return emptyForm;
  const stage = modality.stages?.[0] || {};
  return {
    name: modality.name || '',
    format: modality.format || MODALITY_FORMAT.DOUBLES,
    skill_level: modality.skill_level || SKILL_LEVEL.INTERMEDIATE,
    gender_category: modality.gender_category || GENDER_CATEGORY.OPEN,
    age_category: modality.age_category || AGE_CATEGORY.OPEN,
    max_entries: hasUnlimitedEntries(modality.max_entries) ? DEFAULT_MAX_ENTRIES : modality.max_entries,
    has_unlimited_entries: hasUnlimitedEntries(modality.max_entries),
    entry_fee_brl: ((Number(modality.entry_fee_cents || 0)) / 100).toFixed(2),
    stage_type: stage.type || TOURNAMENT_STAGE_TYPE.ROUND_ROBIN,
    group_count: stage.group_count || 1,
    seed_count: stage.seed_count || 0,
    phases: normalizePhases(modality.stages),
    court_count: modality.court_count || DEFAULT_COURT_COUNT,
    match_duration_minutes: modality.match_duration_minutes || DEFAULT_MATCH_DURATION_MINUTES,
    play_date: modality.play_date || '',
    play_start_time: modality.play_start_time || '',
    play_end_time: modality.play_end_time || '',
    notes: modality.notes || '',
  };
}

export default function V2TournamentModalitiesTab({ tournament, isAdmin }) {
  const multiPhaseEnabled = useFeatureFlag(FEATURE_FLAG.MULTI_PHASE_TOURNAMENTS);
  const { data: modalities = [], isLoading } = useModalities(tournament.id);
  const createMutation = useCreateModality(tournament.id);
  const updateMutation = useUpdateModality(tournament.id);
  const deleteMutation = useDeleteModality(tournament.id);
  const [open, setOpen] = useState(false);
  const [editingModality, setEditingModality] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const isEditing = Boolean(editingModality);
  const saving = createMutation.isPending || updateMutation.isPending;

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function setSinglePhaseScoring(patch) {
    setForm((current) => {
      const firstPhase = current.phases?.[0] || defaultPhase(current.format, true);
      const phases = [
        {
          ...firstPhase,
          scoring_override: {
            ...(firstPhase.scoring_override || {}),
            ...patch,
          },
        },
      ];
      return { ...current, phases };
    });
  }

  function setFormat(value) {
    setForm((f) => {
      const allowed = STAGE_TYPES_BY_FORMAT[value] || [];
      const stage_type = allowed.includes(f.stage_type) ? f.stage_type : allowed[0];
      const phases = normalizePhases(
        (f.phases || []).map((p) => ({
          ...p,
          type: allowed.includes(p.type) ? p.type : allowed[0],
        })),
      );
      return { ...f, format: value, stage_type, phases };
    });
  }

  const stageOptions = Object.fromEntries(
    availableStageTypes(form.format, multiPhaseEnabled).map(
      (key) => [key, TOURNAMENT_STAGE_TYPE_LABELS[key]],
    ),
  );

  function openCreate() {
    setEditingModality(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(modality) {
    setEditingModality(modality);
    setForm(buildFormState(modality));
    setOpen(true);
  }

  function closeDialog() {
    setOpen(false);
    setEditingModality(null);
    setForm(emptyForm);
  }

  async function handleSave() {
    if (!form.name.trim()) return toast.error('Informe um nome.');
    if (
      form.play_start_time &&
      form.play_end_time &&
      form.play_end_time <= form.play_start_time
    ) {
      return toast.error('O horário de término deve ser depois do horário de início.');
    }

    let stages;
    if (multiPhaseEnabled) {
      const { valid, errors } = validatePhases(form.phases, form.format);
      if (!valid) return toast.error(errors[0] || 'Configuração de fases inválida.');
      stages = form.phases;
    } else {
      stages = [
        {
          type: form.stage_type,
          group_count: Number(form.group_count) || 1,
          seed_count: Number(form.seed_count) || 0,
          scoring_override: form.phases[0]?.scoring_override || {},
        },
      ];
    }

    const payload = {
      name: form.name.trim(),
      format: form.format,
      skill_level: form.skill_level,
      gender_category: form.gender_category,
      age_category: form.age_category,
      max_entries: form.has_unlimited_entries ? -1 : (Number(form.max_entries) || DEFAULT_MAX_ENTRIES),
      entry_fee_cents: Math.round(Number(form.entry_fee_brl) * 100) || 0,
      stages,
      court_count: Number(form.court_count) || DEFAULT_COURT_COUNT,
      match_duration_minutes: Number(form.match_duration_minutes) || DEFAULT_MATCH_DURATION_MINUTES,
      play_date: form.play_date || null,
      play_start_time: form.play_start_time || null,
      play_end_time: form.play_end_time || null,
      notes: form.notes.trim() || null,
    };

    try {
      if (isEditing) {
        await updateMutation.mutateAsync({ id: editingModality.id, updates: payload });
        toast.success('Modalidade atualizada.');
      } else {
        await createMutation.mutateAsync(payload);
        toast.success('Modalidade criada.');
      }
      closeDialog();
    } catch (err) {
      toast.error(err.message || 'Erro ao salvar modalidade.');
    }
  }

  async function handleDelete() {
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast.success('Modalidade removida.');
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err.message || 'Falha ao remover modalidade.');
    }
  }

  const scheduleSlots = computeWindowSlots(form.play_start_time, form.play_end_time, form.match_duration_minutes, form.court_count);

  if (open) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl font-bold text-ink">{isEditing ? 'Editar modalidade' : 'Nova modalidade'}</h3>
          <V2Button variant="ghost" size="sm" onClick={closeDialog}>Cancelar</V2Button>
        </div>

        <V2Surface className="p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Nome (ex.: Duplas Mistas Inic.) *</label>
              <input value={form.name} onChange={(e) => set(e.target.value)} maxLength={80} className="w-full rounded-2xl border border-gray-200 bg-paper px-4 py-3 text-sm text-ink outline-none focus-visible:ring-4 focus-visible:ring-acid/30" />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Formato</label>
              <select value={form.format} onChange={(e) => setFormat(e.target.value)} className="w-full rounded-2xl border border-gray-200 bg-paper px-4 py-3 text-sm text-ink outline-none focus-visible:ring-4 focus-visible:ring-acid/30">
                {Object.entries(MODALITY_FORMAT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
        </V2Surface>

        <V2Surface className="p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Nível / Perfil</label>
              <select value={form.skill_level} onChange={(e) => set('skill_level', e.target.value)} className="w-full rounded-2xl border border-gray-200 bg-paper px-4 py-3 text-sm text-ink outline-none focus-visible:ring-4 focus-visible:ring-acid/30">
                {Object.entries(SKILL_LEVEL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Gênero</label>
              <select value={form.gender_category} onChange={(e) => set('gender_category', e.target.value)} className="w-full rounded-2xl border border-gray-200 bg-paper px-4 py-3 text-sm text-ink outline-none focus-visible:ring-4 focus-visible:ring-acid/30">
                {Object.entries(GENDER_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Faixa Etária</label>
              <select value={form.age_category} onChange={(e) => set('age_category', e.target.value)} className="w-full rounded-2xl border border-gray-200 bg-paper px-4 py-3 text-sm text-ink outline-none focus-visible:ring-4 focus-visible:ring-acid/30">
                {Object.entries(AGE_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
        </V2Surface>

        <V2Surface className="p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-4 text-ink font-bold"><Ticket className="h-4 w-4" /> Vagas e Ingresso</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 flex justify-between">
                <span>Vagas (inscrições / {form.format === MODALITY_FORMAT.SINGLES ? 'atletas' : 'duplas'})</span>
                <label className="flex items-center gap-1.5 text-xs normal-case tracking-normal">
                  <input type="checkbox" checked={form.has_unlimited_entries} onChange={(e) => set('has_unlimited_entries', e.target.checked)} />
                  Sem limite
                </label>
              </label>
              <input type="number" min="2" max={MAX_REGISTRATIONS_PER_MODALITY} value={form.max_entries} onChange={(e) => set('max_entries', e.target.value)} disabled={form.has_unlimited_entries} className="w-full rounded-2xl border border-gray-200 bg-paper px-4 py-3 text-sm text-ink outline-none focus-visible:ring-4 focus-visible:ring-acid/30 disabled:opacity-50" />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Valor da inscrição (R$)</label>
              <input type="number" min="0" step="0.01" value={form.entry_fee_brl} onChange={(e) => set('entry_fee_brl', e.target.value)} className="w-full rounded-2xl border border-gray-200 bg-paper px-4 py-3 text-sm text-ink outline-none focus-visible:ring-4 focus-visible:ring-acid/30" />
            </div>
          </div>
        </V2Surface>

        <V2Surface className="p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-ink flex items-center gap-2"><Layers className="h-4 w-4" /> Formato da Competição</h3>
          </div>
          {multiPhaseEnabled ? (
            <PhasesEditor format={form.format} phases={form.phases} onChange={(phases) => set('phases', phases)} />
          ) : (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Modelo da chave</label>
                  <select value={form.stage_type} onChange={(e) => set('stage_type', e.target.value)} className="w-full rounded-2xl border border-gray-200 bg-paper px-4 py-3 text-sm text-ink outline-none focus-visible:ring-4 focus-visible:ring-acid/30">
                    {Object.entries(stageOptions).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                {[TOURNAMENT_STAGE_TYPE.ROUND_ROBIN, TOURNAMENT_STAGE_TYPE.AMERICAN_ROUND_ROBIN, TOURNAMENT_STAGE_TYPE.TWO_STAGE].includes(form.stage_type) && (
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Qtd. de grupos</label>
                    <input type="number" min="1" max="16" value={form.group_count} onChange={(e) => set('group_count', e.target.value)} className="w-full rounded-2xl border border-gray-200 bg-paper px-4 py-3 text-sm text-ink outline-none focus-visible:ring-4 focus-visible:ring-acid/30" />
                  </div>
                )}
                {[TOURNAMENT_STAGE_TYPE.SINGLE_ELIMINATION, TOURNAMENT_STAGE_TYPE.DOUBLE_ELIMINATION, TOURNAMENT_STAGE_TYPE.TWO_STAGE].includes(form.stage_type) && (
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Cabeças de chave (Seeds)</label>
                    <input type="number" min="0" max="32" value={form.seed_count} onChange={(e) => set('seed_count', e.target.value)} className="w-full rounded-2xl border border-gray-200 bg-paper px-4 py-3 text-sm text-ink outline-none focus-visible:ring-4 focus-visible:ring-acid/30" />
                  </div>
                )}
              </div>
              <div className="rounded-2xl border border-gray-100 bg-paper-pure p-4">
                <StageExplanation stageType={form.stage_type} playerCount={PREVIEW_PLAYER_COUNT} groupCount={Number(form.group_count) || 1} seedCount={Number(form.seed_count) || 0} previewMode />
              </div>
            </div>
          )}
        </V2Surface>

        <V2Surface className="p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-4 text-ink font-bold"><CalendarClock className="h-4 w-4" /> Horário e Quadras (Opcional)</div>
          <p className="mb-4 text-sm text-gray-500">Se preenchido, os jogos gerados calcularão automaticamente sua estimativa de horário e distribuição nas quadras.</p>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-5">
            <div className="space-y-2 md:col-span-1">
              <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Data Base</label>
              <input type="date" value={form.play_date} onChange={(e) => set('play_date', e.target.value)} className="w-full rounded-2xl border border-gray-200 bg-paper px-4 py-3 text-sm text-ink outline-none focus-visible:ring-4 focus-visible:ring-acid/30" />
            </div>
            <div className="space-y-2 md:col-span-1">
              <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Início</label>
              <input type="time" value={form.play_start_time} onChange={(e) => set('play_start_time', e.target.value)} className="w-full rounded-2xl border border-gray-200 bg-paper px-4 py-3 text-sm text-ink outline-none focus-visible:ring-4 focus-visible:ring-acid/30" />
            </div>
            <div className="space-y-2 md:col-span-1">
              <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Fim (Teto)</label>
              <input type="time" value={form.play_end_time} onChange={(e) => set('play_end_time', e.target.value)} className="w-full rounded-2xl border border-gray-200 bg-paper px-4 py-3 text-sm text-ink outline-none focus-visible:ring-4 focus-visible:ring-acid/30" />
            </div>
            <div className="space-y-2 md:col-span-1">
              <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Quadras</label>
              <input type="number" min="1" max={MAX_COURT_COUNT} value={form.court_count} onChange={(e) => set('court_count', e.target.value)} className="w-full rounded-2xl border border-gray-200 bg-paper px-4 py-3 text-sm text-ink outline-none focus-visible:ring-4 focus-visible:ring-acid/30" />
            </div>
            <div className="space-y-2 md:col-span-1">
              <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Min/Jogo</label>
              <input type="number" min="10" max="180" step="5" value={form.match_duration_minutes} onChange={(e) => set('match_duration_minutes', e.target.value)} className="w-full rounded-2xl border border-gray-200 bg-paper px-4 py-3 text-sm text-ink outline-none focus-visible:ring-4 focus-visible:ring-acid/30" />
            </div>
          </div>
        </V2Surface>

        <V2Surface className="p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-4 text-ink font-bold"><BookOpen className="h-4 w-4" /> Instruções (Opcional)</div>
          <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} maxLength={500} placeholder="Recomendações visíveis para os atletas na aba Informações desta modalidade." className="w-full resize-y rounded-2xl border border-gray-200 bg-paper px-4 py-3 text-sm text-ink outline-none focus-visible:ring-4 focus-visible:ring-acid/30" />
        </V2Surface>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <V2Button variant="ghost" onClick={closeDialog} disabled={saving}>Cancelar</V2Button>
          <V2Button onClick={handleSave} disabled={saving}>{saving ? 'Salvando…' : 'Salvar modalidade'}</V2Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Defina as categorias, perfis, regras e horários de cada bloco de jogos.</p>
        {isAdmin && <V2Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" /> Nova modalidade</V2Button>}
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2].map((i) => <div key={i} className="h-32 animate-pulse rounded-4xl bg-gray-100" />)}
        </div>
      ) : modalities.length === 0 ? (
        <V2EmptyState icon={Layers} title="Nenhuma modalidade" description="Comece criando a primeira modalidade para abrir inscrições." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {modalities.map((m) => (
            <V2Surface key={m.id} className="flex flex-col p-5 sm:p-6">
              <div className="flex flex-col justify-between flex-1">
                <div>
                  <div className="flex flex-wrap items-center gap-1.5 mb-2">
                    <V2Badge tone="neutral">{MODALITY_FORMAT_LABELS[m.format]}</V2Badge>
                    <V2Badge tone="neutral">{SKILL_LEVEL_LABELS[m.skill_level]}</V2Badge>
                    <V2Badge tone="neutral">{GENDER_CATEGORY_LABELS[m.gender_category]}</V2Badge>
                  </div>
                  <h4 className="font-display text-lg font-bold text-ink">{m.name}</h4>
                  <div className="mt-2 space-y-1">
                    <div className="text-sm text-gray-600">
                      <span className="font-semibold text-ink">
                        {hasUnlimitedEntries(m.max_entries) ? 'Ilimitado' : `${m.max_entries} vagas`}
                      </span>{' '}
                      · {Number(m.entry_fee_cents) > 0 ? `R$ ${(m.entry_fee_cents / 100).toFixed(2).replace('.', ',')}` : 'Gratuito'}
                    </div>
                    <div className="text-sm text-gray-600">
                      {(m.stages?.length || 0) > 1
                        ? `${m.stages.length} fases: ${m.stages.map((s) => TOURNAMENT_STAGE_TYPE_LABELS[s.type] || '—').join(' → ')}`
                        : `Fase: ${TOURNAMENT_STAGE_TYPE_LABELS[m.stages?.[0]?.type] || '—'}`}
                    </div>
                    <div className="text-xs text-gray-500 mt-1 leading-5">
                      {m.court_count || DEFAULT_COURT_COUNT} quadra(s) · {m.match_duration_minutes || DEFAULT_MATCH_DURATION_MINUTES} min/jogo
                      {m.play_start_time ? ` · ${m.play_start_time}` : ''}
                      {m.play_start_time && m.play_end_time ? `–${m.play_end_time}` : ''}
                      {m.play_date ? ` · ${m.play_date}` : ''}
                    </div>
                    {Array.isArray(m.stages) && m.stages.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {m.stages.map((stage, index) => (
                          <V2Badge key={`${m.id}-${index}`} tone="neutral" className="px-2 py-0.5 text-[10px]">
                            Fase {index + 1}: {formatScoringSummary(stage.scoring_override || {})}
                          </V2Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                    <V2Button variant="ghost" size="sm" onClick={() => openEdit(m)}><Pencil className="h-3.5 w-3.5" /> Editar</V2Button>
                    <V2Button variant="ghost" size="sm" onClick={() => setDeleteTarget(m)} className="text-red-500 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /> Remover</V2Button>
                  </div>
                )}
              </div>
            </V2Surface>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Excluir modalidade"
        description="Atenção: inscrições, jogos e resultados atrelados a esta modalidade serão removidos e o processo é irreversível."
        confirmLabel="Excluir"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}