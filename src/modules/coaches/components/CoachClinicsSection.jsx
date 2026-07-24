/**
 * CoachClinicsSection — gestão de clínicas/workshops do professor.
 * Cria clínicas abertas, lista as existentes com contagem de inscritos e
 * permite cancelar/remover. Gated por coach_clinics (a página já é gated).
 */

import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { GraduationCap, Plus, Trash2, Users, Ban } from 'lucide-react';
import {
  normalizeClinic, sortClinics, spotsLeft, isClinicPast,
  clinicWhenLabel, CLINIC_STATUS, CLINIC_STATUS_LABELS,
} from '../domain/clinic.js';
import {
  useCoachClinics, useClinicSignups, useCreateClinic, useCancelClinic, useDeleteClinic,
} from '../hooks/useClinics.js';
import ConfirmDialog from '@/components/ConfirmDialog';
import {
  V2Badge, V2Button, V2EmptyState, V2Field, V2Input, V2Skeleton,
  V2Surface, V2Textarea,
} from '@/v2/ui/primitives';

function emptyForm() {
  return { title: '', description: '', date: '', start: '08:00', end: '10:00', location: '', capacity: '8', price: '', level: '' };
}

function ClinicForm({ coachId, coachName, onDone }) {
  const create = useCreateClinic();
  const [form, setForm] = useState(emptyForm);
  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const { valid, error } = normalizeClinic({ ...form, coach_id: coachId });
    if (!valid) { toast.error(error); return; }
    try {
      await create.mutateAsync({ ...form, coach_id: coachId, coach_name: coachName });
      toast.success('Clínica publicada.');
      setForm(emptyForm());
      onDone?.();
    } catch (err) {
      toast.error(err?.message || 'Não foi possível publicar.');
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-gray-100 bg-paper-pure p-4">
      <V2Field label="Título *">
        <V2Input value={form.title} onChange={set('title')} maxLength={120} placeholder="Ex.: Clínica de saque e devolução" />
      </V2Field>
      <V2Field label="Descrição">
        <V2Textarea value={form.description} onChange={set('description')} rows={3} maxLength={2000} placeholder="O que será trabalhado, para quem é, o que levar…" />
      </V2Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <V2Field label="Data *"><V2Input type="date" value={form.date} onChange={set('date')} /></V2Field>
        <V2Field label="Início *"><V2Input type="time" value={form.start} onChange={set('start')} /></V2Field>
        <V2Field label="Término *"><V2Input type="time" value={form.end} onChange={set('end')} /></V2Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <V2Field label="Local"><V2Input value={form.location} onChange={set('location')} maxLength={160} placeholder="Arena / endereço" /></V2Field>
        <V2Field label="Nível (opcional)"><V2Input value={form.level} onChange={set('level')} maxLength={40} placeholder="Ex.: iniciante, 3.0+" /></V2Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <V2Field label="Vagas *"><V2Input type="number" min="1" value={form.capacity} onChange={set('capacity')} /></V2Field>
        <V2Field label="Preço (R$)"><V2Input type="number" min="0" step="0.01" value={form.price} onChange={set('price')} placeholder="0 = gratuita" /></V2Field>
      </div>
      <div className="flex justify-end">
        <V2Button type="submit" size="sm" disabled={create.isPending}>
          <Plus className="h-4 w-4" /> {create.isPending ? 'Publicando…' : 'Publicar clínica'}
        </V2Button>
      </div>
    </form>
  );
}

function ClinicRow({ clinic }) {
  const { data: signups = [] } = useClinicSignups(clinic.id);
  const cancel = useCancelClinic();
  const remove = useDeleteClinic();
  const [showSignups, setShowSignups] = useState(false);

  const left = spotsLeft(clinic, signups.length);
  const past = isClinicPast(clinic);
  const cancelled = clinic.status === CLINIC_STATUS.CANCELLED;

  const doCancel = async () => {
    try { await cancel.mutateAsync({ clinicId: clinic.id }); toast.success('Clínica cancelada.'); }
    catch (err) { toast.error(err?.message || 'Não foi possível cancelar.'); }
  };
  const doRemove = async () => {
    try { await remove.mutateAsync({ clinicId: clinic.id }); toast.success('Clínica removida.'); }
    catch (err) { toast.error(err?.message || 'Não foi possível remover.'); }
  };

  return (
    <div className="rounded-2xl border border-gray-100 bg-paper p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-bold text-ink">{clinic.title}</p>
            {cancelled && <V2Badge tone="red">{CLINIC_STATUS_LABELS[CLINIC_STATUS.CANCELLED]}</V2Badge>}
            {!cancelled && past && <V2Badge tone="neutral">Realizada</V2Badge>}
            {!cancelled && !past && <V2Badge tone="green">{left} vaga(s)</V2Badge>}
          </div>
          <p className="mt-0.5 text-xs text-gray-500">
            {clinicWhenLabel(clinic)}{clinic.location ? ` · ${clinic.location}` : ''}
            {Number(clinic.price) > 0 ? ` · R$ ${Number(clinic.price).toFixed(2)}` : ' · Gratuita'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button type="button" onClick={() => setShowSignups((v) => !v)} className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-white">
            <Users className="h-3.5 w-3.5" /> {signups.length}
          </button>
          {!cancelled && !past && (
            <ConfirmDialog
              title="Cancelar clínica?"
              description="Os inscritos serão avisados. A clínica fica marcada como cancelada."
              confirmLabel="Cancelar clínica"
              onConfirm={doCancel}
              trigger={(
                <button type="button" className="rounded-full border border-amber-200 p-1.5 text-amber-600 hover:bg-amber-50" aria-label="Cancelar clínica">
                  <Ban className="h-3.5 w-3.5" />
                </button>
              )}
            />
          )}
          <ConfirmDialog
            title="Remover clínica?"
            description="A clínica e as inscrições serão removidas. Não pode ser desfeito."
            confirmLabel="Remover"
            onConfirm={doRemove}
            trigger={(
              <button type="button" className="rounded-full border border-red-200 p-1.5 text-red-500 hover:bg-red-50" aria-label="Remover clínica">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          />
        </div>
      </div>
      {showSignups && (
        <div className="mt-2 rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-600">
          {signups.length === 0 ? 'Nenhum inscrito ainda.' : (
            <ul className="space-y-0.5">
              {signups.map((s) => <li key={s.id}>{s.athlete_name || 'Atleta'}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default function CoachClinicsSection({ coachId, coachName }) {
  const { data: clinics = [], isLoading } = useCoachClinics(coachId);
  const [creating, setCreating] = useState(false);
  const sorted = useMemo(() => sortClinics(clinics), [clinics]);

  return (
    <V2Surface>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-ink" />
          <h2 className="font-display text-lg font-bold text-ink">Clínicas e workshops</h2>
        </div>
        <V2Button size="sm" variant={creating ? 'ghost' : 'primary'} onClick={() => setCreating((v) => !v)}>
          {creating ? 'Fechar' : <><Plus className="h-4 w-4" /> Nova clínica</>}
        </V2Button>
      </div>

      {creating && <div className="mb-4"><ClinicForm coachId={coachId} coachName={coachName} onDone={() => setCreating(false)} /></div>}

      {isLoading ? (
        <V2Skeleton lines={3} />
      ) : sorted.length === 0 ? (
        <V2EmptyState
          icon={GraduationCap}
          title="Nenhuma clínica publicada"
          description="Publique clínicas e workshops abertos; os atletas se inscrevem pelo seu perfil público."
        />
      ) : (
        <div className="space-y-2">
          {sorted.map((c) => <ClinicRow key={c.id} clinic={c} />)}
        </div>
      )}
    </V2Surface>
  );
}
