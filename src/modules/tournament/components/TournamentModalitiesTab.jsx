import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Pencil, Plus, Trash2 } from 'lucide-react';
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
  MAX_REGISTRATIONS_PER_MODALITY,
} from '@/modules/tournament/domain/constants';
import { DEFAULT_MAX_ENTRIES, hasUnlimitedEntries } from '@/modules/tournament/domain/capacity';
import {
  DEFAULT_COURT_COUNT,
  DEFAULT_MATCH_DURATION_MINUTES,
  MAX_COURT_COUNT,
  computeWindowSlots,
} from '@/modules/tournament/domain/scheduling';
import StageExplanation from './StageExplanation';

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
    court_count: modality.court_count || DEFAULT_COURT_COUNT,
    match_duration_minutes: modality.match_duration_minutes || DEFAULT_MATCH_DURATION_MINUTES,
    play_date: modality.play_date || '',
    play_start_time: modality.play_start_time || '',
    play_end_time: modality.play_end_time || '',
    notes: modality.notes || '',
  };
}

export default function TournamentModalitiesTab({ tournament, isAdmin }) {
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

  // O formato de inscrição (Simples/Duplas) define quais estruturas são
  // possíveis. Ao trocar o formato, se a estrutura atual deixar de ser
  // compatível (ex.: Duplas + Americano), reverte para a primeira válida.
  function setFormat(value) {
    setForm((f) => {
      const allowed = STAGE_TYPES_BY_FORMAT[value] || [];
      const stage_type = allowed.includes(f.stage_type) ? f.stage_type : allowed[0];
      return { ...f, format: value, stage_type };
    });
  }

  // Estruturas válidas para o formato atual. O fallback usa os valores do enum
  // (mesma forma das entradas de STAGE_TYPES_BY_FORMAT) para casos de dados
  // legados com formato desconhecido.
  const stageOptions = Object.fromEntries(
    (STAGE_TYPES_BY_FORMAT[form.format] || Object.values(TOURNAMENT_STAGE_TYPE)).map(
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

  function closeDialog(nextOpen) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setEditingModality(null);
      setForm(emptyForm);
    }
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
    const payload = {
      name: form.name,
      format: form.format,
      skill_level: form.skill_level,
      gender_category: form.gender_category,
      age_category: form.age_category,
      max_entries: form.has_unlimited_entries ? null : form.max_entries,
      entry_fee_cents: Math.round(Number(form.entry_fee_brl || 0) * 100),
      court_count: form.court_count,
      match_duration_minutes: form.match_duration_minutes,
      play_date: form.play_date,
      play_start_time: form.play_start_time,
      play_end_time: form.play_end_time,
      stages: [
        {
          type: form.stage_type,
          name: TOURNAMENT_STAGE_TYPE_LABELS[form.stage_type],
          group_count: Number(form.group_count) || 1,
          seed_count: Number(form.seed_count) || 0,
        },
      ],
      notes: form.notes,
    };
    try {
      if (isEditing) {
        await updateMutation.mutateAsync({ id: editingModality.id, updates: payload });
        toast.success('Modalidade atualizada.');
      } else {
        await createMutation.mutateAsync(payload);
        toast.success('Modalidade criada.');
      }
      closeDialog(false);
    } catch (err) {
      toast.error(err.message || 'Falha ao salvar.');
    }
  }

  async function handleDelete(id) {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success('Modalidade excluída.');
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="flex justify-end">
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1" /> Nova modalidade
          </Button>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-500">Carregando…</p>
      ) : modalities.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-slate-500">
            Nenhuma modalidade cadastrada ainda.
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {modalities.map((m) => (
            <Card key={m.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-semibold">{m.name}</h4>
                    <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-1">
                      <Badge variant="secondary">{MODALITY_FORMAT_LABELS[m.format]}</Badge>
                      <Badge variant="secondary">{SKILL_LEVEL_LABELS[m.skill_level]}</Badge>
                      <Badge variant="secondary">{GENDER_CATEGORY_LABELS[m.gender_category]}</Badge>
                      <Badge variant="secondary">{AGE_CATEGORY_LABELS[m.age_category]}</Badge>
                    </div>
                    <div className="text-xs text-slate-600 mt-2">
                      Vagas: {hasUnlimitedEntries(m.max_entries) ? 'abertas' : m.max_entries} · Taxa: R${' '}
                      {((m.entry_fee_cents || 0) / 100).toFixed(2).replace('.', ',')} · Fase:{' '}
                      {TOURNAMENT_STAGE_TYPE_LABELS[m.stages?.[0]?.type] || '—'}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {m.court_count || DEFAULT_COURT_COUNT} quadra(s) ·{' '}
                      {m.match_duration_minutes || DEFAULT_MATCH_DURATION_MINUTES} min/jogo
                      {m.play_start_time ? ` · ${m.play_start_time}` : ''}
                      {m.play_start_time && m.play_end_time ? `–${m.play_end_time}` : ''}
                      {m.play_date ? ` · ${m.play_date}` : ''}
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" title="Editar modalidade" onClick={() => openEdit(m)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Excluir modalidade" onClick={() => setDeleteTarget(m)}>
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title={`Excluir modalidade "${deleteTarget?.name}"?`}
        description="Os inscritos e os jogos associados continuarão registrados, mas ficarão órfãos — sem modalidade pai. Esta ação não pode ser desfeita."
        confirmLabel="Excluir modalidade"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget.id)}
      />

      <Dialog open={open} onOpenChange={closeDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Editar modalidade' : 'Nova modalidade'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto">
            <div>
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ex.: Duplas Mistas Intermediário" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <SelectRow label="Formato" value={form.format} options={MODALITY_FORMAT_LABELS} onChange={setFormat} />
              <SelectRow label="Nível" value={form.skill_level} options={SKILL_LEVEL_LABELS} onChange={(v) => set('skill_level', v)} />
              <SelectRow label="Gênero" value={form.gender_category} options={GENDER_CATEGORY_LABELS} onChange={(v) => set('gender_category', v)} />
              <SelectRow label="Idade" value={form.age_category} options={AGE_CATEGORY_LABELS} onChange={(v) => set('age_category', v)} />
              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 p-3">
                  <div>
                    <Label className="text-sm">Quantidade de participantes</Label>
                    <p className="text-xs text-slate-500">
                      Use vagas abertas para fechar as inscrições primeiro e organizar a chave com o total efetivo de inscritos.
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.has_unlimited_entries}
                      onChange={(e) => set('has_unlimited_entries', e.target.checked)}
                    />
                    Vagas abertas
                  </label>
                </div>
                {!form.has_unlimited_entries && (
                  <div>
                    <Label>Vagas (até {MAX_REGISTRATIONS_PER_MODALITY})</Label>
                    <Input
                      type="number"
                      min={2}
                      max={MAX_REGISTRATIONS_PER_MODALITY}
                      value={form.max_entries}
                      onChange={(e) => set('max_entries', e.target.value)}
                    />
                  </div>
                )}
              </div>
              <div>
                <Label>Taxa de inscrição (R$)</Label>
                <Input type="number" min={0} step="0.01" value={form.entry_fee_brl} onChange={(e) => set('entry_fee_brl', e.target.value)} />
              </div>
              <SelectRow
                label="Formato da fase"
                value={form.stage_type}
                options={stageOptions}
                onChange={(v) => set('stage_type', v)}
              />
              {form.stage_type === TOURNAMENT_STAGE_TYPE.GROUPS && (
                <div>
                  <Label>Quantidade de grupos</Label>
                  <Input type="number" min={1} value={form.group_count} onChange={(e) => set('group_count', e.target.value)} />
                </div>
              )}
              {(form.stage_type === TOURNAMENT_STAGE_TYPE.GROUPS ||
                form.stage_type === TOURNAMENT_STAGE_TYPE.KNOCKOUT ||
                form.stage_type === TOURNAMENT_STAGE_TYPE.DOUBLE_KNOCKOUT) && (
                <div>
                  <Label>Cabeças-de-chave</Label>
                  <Input type="number" min={0} value={form.seed_count} onChange={(e) => set('seed_count', e.target.value)} />
                </div>
              )}
              <div className="md:col-span-2 space-y-1">
                <Label className="text-sm">
                  Como o campeonato vai rodar
                  {!form.has_unlimited_entries && ` (com ${Number(form.max_entries) || 0} jogadores)`}
                </Label>
                {form.has_unlimited_entries && (
                  <p className="text-xs text-slate-500">
                    Prévia para {PREVIEW_PLAYER_COUNT} jogadores (vagas abertas). Os números exatos
                    serão recalculados com o total efetivo de inscritos ao encerrar as inscrições.
                  </p>
                )}
                <StageExplanation
                  stageType={form.stage_type}
                  playerCount={
                    form.has_unlimited_entries
                      ? PREVIEW_PLAYER_COUNT
                      : Number(form.max_entries) || 0
                  }
                  groupCount={Number(form.group_count) || 1}
                  seedCount={Number(form.seed_count) || 0}
                />
              </div>
            </div>

            <div className="rounded-md border border-slate-200 p-3 space-y-3">
              <div>
                <Label className="text-sm font-semibold">Quadras e horários</Label>
                <p className="text-xs text-slate-500">
                  O sorteio usa estes dados para marcar cada jogo em uma quadra e horário, sem
                  conflito de jogadores e equilibrando a participação ao longo do dia.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Quadras disponíveis</Label>
                  <Input
                    type="number"
                    min={1}
                    max={MAX_COURT_COUNT}
                    value={form.court_count}
                    onChange={(e) => set('court_count', e.target.value)}
                  />
                </div>
                <div>
                  <Label>Duração média do jogo (min)</Label>
                  <Input
                    type="number"
                    min={5}
                    max={600}
                    value={form.match_duration_minutes}
                    onChange={(e) => set('match_duration_minutes', e.target.value)}
                  />
                </div>
                <div>
                  <Label>Data dos jogos (opcional)</Label>
                  <Input
                    type="date"
                    value={form.play_date}
                    onChange={(e) => set('play_date', e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Início</Label>
                    <Input
                      type="time"
                      value={form.play_start_time}
                      onChange={(e) => set('play_start_time', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Término (opcional)</Label>
                    <Input
                      type="time"
                      value={form.play_end_time}
                      onChange={(e) => set('play_end_time', e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <ScheduleHint form={form} />
            </div>
            <div>
              <Label>Observações (opcional)</Label>
              <Input value={form.notes} onChange={(e) => set('notes', e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => closeDialog(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando…' : isEditing ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ScheduleHint({ form }) {
  const courts = Number(form.court_count) || 1;
  const duration = Number(form.match_duration_minutes) || 0;
  const slots = computeWindowSlots(form.play_start_time, form.play_end_time, duration);
  if (slots == null) {
    return (
      <p className="text-xs text-slate-500">
        {courts} quadra(s) · {duration || '—'} min por jogo
        {form.play_start_time ? ` · a partir das ${form.play_start_time}` : ''}.
      </p>
    );
  }
  const capacity = slots * courts;
  return (
    <p className="text-xs text-slate-600">
      Janela de {form.play_start_time}–{form.play_end_time}: cabem cerca de{' '}
      <strong>{capacity}</strong> jogo(s) ({slots} horário(s) × {courts} quadra(s), {duration} min cada).
    </p>
  );
}

function SelectRow({ label, value, options, onChange }) {
  return (
    <div>
      <Label>{label}</Label>
      <select
        className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {Object.entries(options).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>
    </div>
  );
}
