/**
 * CoachClinicsPublic — descoberta e inscrição em clínicas do professor.
 * Exibida no perfil público do professor. Gated por coach_clinics.
 */

import React, { useMemo } from 'react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { Sparkles, Check } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import {
  upcomingClinics, spotsLeft, canEnroll, clinicWhenLabel,
} from '../domain/clinic.js';
import {
  useCoachClinics, useClinicSignups, useMyClinicSignups,
  useEnrollInClinic, useCancelEnrollment,
} from '../hooks/useClinics.js';
import { V2Badge, V2Button, V2Surface } from '@/v2/ui/primitives';

function ClinicCard({ clinic, mySignups, onEnroll, onCancel, isPending, isAuthenticated }) {
  const { data: signups = [] } = useClinicSignups(clinic.id);
  const left = spotsLeft(clinic, signups.length);
  const enrolled = mySignups.some((s) => s.clinic_id === clinic.id);
  const check = canEnroll({ clinic, signupCount: signups.length, alreadyEnrolled: enrolled });

  return (
    <div className="rounded-2xl border border-gray-100 bg-paper p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-bold text-ink">{clinic.title}</p>
            {clinic.level && <V2Badge tone="blue">{clinic.level}</V2Badge>}
            <V2Badge tone={left > 0 ? 'green' : 'neutral'}>{left} vaga(s)</V2Badge>
          </div>
          <p className="mt-0.5 text-xs text-gray-500">
            {clinicWhenLabel(clinic)}
            {clinic.location ? ` · ${clinic.location}` : ''}
            {Number(clinic.price) > 0 ? ` · R$ ${Number(clinic.price).toFixed(2)}` : ' · Gratuita'}
          </p>
          {clinic.description && <p className="mt-1 whitespace-pre-line text-sm text-gray-600">{clinic.description}</p>}
        </div>
        <div className="shrink-0">
          {enrolled ? (
            <V2Button size="sm" variant="ghost" disabled={isPending} onClick={() => onCancel(clinic)}>
              <Check className="h-4 w-4 text-green-600" /> Inscrito · cancelar
            </V2Button>
          ) : !isAuthenticated ? (
            <V2Button asChild size="sm" variant="secondary"><Link to="/login">Entrar para se inscrever</Link></V2Button>
          ) : (
            <V2Button size="sm" disabled={isPending || !check.ok} onClick={() => onEnroll(clinic)} title={check.ok ? '' : check.reason}>
              {check.ok ? 'Inscrever-se' : check.reason}
            </V2Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CoachClinicsPublic({ coachId }) {
  const { user, isAuthenticated } = useAuth();
  const { data: clinics = [] } = useCoachClinics(coachId);
  const { data: mySignups = [] } = useMyClinicSignups(isAuthenticated ? user?.uid : null);
  const enroll = useEnrollInClinic();
  const cancel = useCancelEnrollment();

  const open = useMemo(() => upcomingClinics(clinics), [clinics]);

  if (open.length === 0) return null;

  const handleEnroll = async (clinic) => {
    try { await enroll.mutateAsync(clinic); toast.success('Inscrição confirmada!'); }
    catch (err) { toast.error(err?.message || 'Não foi possível inscrever.'); }
  };
  const handleCancel = async (clinic) => {
    try { await cancel.mutateAsync({ clinic, athleteId: user?.uid }); toast.success('Inscrição cancelada.'); }
    catch (err) { toast.error(err?.message || 'Não foi possível cancelar.'); }
  };

  return (
    <V2Surface>
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-ink" />
        <h3 className="font-display text-base font-bold text-ink">Clínicas e workshops abertos</h3>
      </div>
      <div className="mt-3 space-y-2">
        {open.map((c) => (
          <ClinicCard
            key={c.id}
            clinic={c}
            mySignups={mySignups}
            onEnroll={handleEnroll}
            onCancel={handleCancel}
            isPending={enroll.isPending || cancel.isPending}
            isAuthenticated={isAuthenticated}
          />
        ))}
      </div>
    </V2Surface>
  );
}
