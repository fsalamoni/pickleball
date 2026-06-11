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
  MAX_REGISTRATIONS_PER_MODALITY,
} from '@/modules/tournament/domain/constants';
import { DEFAULT_MAX_ENTRIES, hasUnlimitedEntries } from '@/modules/tournament/domain/capacity';
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
    const payload = {
      name: form.name,
      format: form.format,
      skill_level: form.skill_level,
      gender_category: form.gender_category,
      age_category: form.age_category,
      max_entries: form.has_unlimited_entries ? null : form.max_entries,
      entry_fee_cents: Math.round(Number(form.entry_fee_brl || 0) * 100),
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
              <SelectRow label="Formato" value={form.format} options={MODALITY_FORMAT_LABELS} onChange={(v) => set('format', v)} />
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
                options={TOURNAMENT_STAGE_TYPE_LABELS}
                onChange={(v) => set('stage_type', v)}
              />
              {form.stage_type === TOURNAMENT_STAGE_TYPE.GROUPS && (
                <div>
                  <Label>Quantidade de grupos</Label>
                  <Input type="number" min={1} value={form.group_count} onChange={(e) => set('group_count', e.target.value)} />
                </div>
              )}
              {(form.stage_type === TOURNAMENT_STAGE_TYPE.GROUPS || form.stage_type === TOURNAMENT_STAGE_TYPE.KNOCKOUT) && (
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
