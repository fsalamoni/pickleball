/**
 * Service I/O de clínicas/workshops do professor (flag coach_clinics).
 *
 * Coleções (aditivas):
 * - `coach_clinics/{clinicId}` — evento aberto criado pelo professor.
 * - `coach_clinic_signups/{clinicId_athleteId}` — inscrição do atleta (auto).
 *
 * Permissões (ver firestore.rules):
 * - Clínicas: leitura pública; escreve/remove o professor (coach_id)/admin.
 * - Inscrições: leitura pública (contagem de vagas); cria/remove o próprio
 *   atleta; o professor/admin também pode remover.
 */

import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, query,
  serverTimestamp, setDoc, updateDoc, where,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { createAuditLog } from '@/core/services/auditService';
import { notifyUsers, NOTIFICATION_TYPE } from '@/core/services/notificationService';
import {
  normalizeClinic, clinicSignupDocId, CLINIC_STATUS,
} from '../domain/clinic.js';

export const COACH_CLINIC_COLLECTION = 'coach_clinics';
export const COACH_CLINIC_SIGNUP_COLLECTION = 'coach_clinic_signups';

const str = (v) => String(v ?? '').trim();

/** Clínicas de um professor. */
export async function listCoachClinics(coachId) {
  if (!coachId) return [];
  const q = query(collection(db, COACH_CLINIC_COLLECTION), where('coach_id', '==', coachId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getClinic(clinicId) {
  if (!clinicId) return null;
  const snap = await getDoc(doc(db, COACH_CLINIC_COLLECTION, clinicId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/** Inscrições de uma clínica. */
export async function listClinicSignups(clinicId) {
  if (!clinicId) return [];
  const q = query(collection(db, COACH_CLINIC_SIGNUP_COLLECTION), where('clinic_id', '==', clinicId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Inscrições de um atleta (minhas clínicas). */
export async function listMyClinicSignups(athleteId) {
  if (!athleteId) return [];
  const q = query(collection(db, COACH_CLINIC_SIGNUP_COLLECTION), where('athlete_id', '==', athleteId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Cria uma clínica (só o professor/admin). */
export async function createClinic(input, actor) {
  if (!actor?.uid) throw new Error('Usuário não autenticado.');
  const { valid, error, value } = normalizeClinic(input);
  if (!valid) throw new Error(error);
  if (actor.uid !== value.coach_id && !actor.isPlatformAdmin) {
    throw new Error('Sem permissão para criar esta clínica.');
  }
  const ref = await addDoc(collection(db, COACH_CLINIC_COLLECTION), {
    ...value,
    signup_count: 0,
    created_at: serverTimestamp(),
    created_at_ms: Date.now(),
  });
  await createAuditLog({ action: 'coach_clinic_created', actor, details: { coach_id: value.coach_id, clinic_id: ref.id } });
  return ref.id;
}

/** Atualiza uma clínica (só o professor/admin). */
export async function updateClinic(clinicId, input, actor) {
  if (!actor?.uid) throw new Error('Usuário não autenticado.');
  const existing = await getClinic(clinicId);
  if (!existing) throw new Error('Clínica não encontrada.');
  if (actor.uid !== existing.coach_id && !actor.isPlatformAdmin) {
    throw new Error('Sem permissão.');
  }
  const { valid, error, value } = normalizeClinic({ ...existing, ...input, coach_id: existing.coach_id });
  if (!valid) throw new Error(error);
  await updateDoc(doc(db, COACH_CLINIC_COLLECTION, clinicId), {
    ...value,
    updated_at: serverTimestamp(),
  });
  await createAuditLog({ action: 'coach_clinic_updated', actor, details: { clinic_id: clinicId } });
}

/** Cancela uma clínica e avisa os inscritos (só o professor/admin). */
export async function cancelClinic(clinicId, actor) {
  if (!actor?.uid) throw new Error('Usuário não autenticado.');
  const existing = await getClinic(clinicId);
  if (!existing) throw new Error('Clínica não encontrada.');
  if (actor.uid !== existing.coach_id && !actor.isPlatformAdmin) {
    throw new Error('Sem permissão.');
  }
  await updateDoc(doc(db, COACH_CLINIC_COLLECTION, clinicId), {
    status: CLINIC_STATUS.CANCELLED,
    updated_at: serverTimestamp(),
  });
  const signups = await listClinicSignups(clinicId);
  const ids = signups.map((s) => s.athlete_id).filter(Boolean);
  if (ids.length > 0) {
    notifyUsers(ids, {
      title: 'Clínica cancelada',
      message: `A clínica "${existing.title}" foi cancelada pelo professor.`,
      type: NOTIFICATION_TYPE.GENERIC,
      actor: { uid: actor.uid },
    });
  }
  await createAuditLog({ action: 'coach_clinic_cancelled', actor, details: { clinic_id: clinicId } });
}

/** Remove uma clínica (só o professor/admin). */
export async function deleteClinic(clinicId, actor) {
  if (!actor?.uid) throw new Error('Usuário não autenticado.');
  const existing = await getClinic(clinicId);
  if (!existing) return;
  if (actor.uid !== existing.coach_id && !actor.isPlatformAdmin) {
    throw new Error('Sem permissão.');
  }
  await deleteDoc(doc(db, COACH_CLINIC_COLLECTION, clinicId));
  await createAuditLog({ action: 'coach_clinic_removed', actor, details: { clinic_id: clinicId } });
}

/** Inscreve o próprio atleta numa clínica (auto-inscrição). */
export async function enrollInClinic(clinic, athlete) {
  if (!athlete?.uid) throw new Error('Usuário não autenticado.');
  if (!clinic?.id || !clinic?.coach_id) throw new Error('Clínica inválida.');
  const id = clinicSignupDocId(clinic.id, athlete.uid);
  await setDoc(doc(db, COACH_CLINIC_SIGNUP_COLLECTION, id), {
    clinic_id: clinic.id,
    coach_id: clinic.coach_id,
    athlete_id: athlete.uid,
    athlete_name: str(athlete.displayName).slice(0, 140),
    created_at: serverTimestamp(),
    created_at_ms: Date.now(),
  });
  notifyUsers([clinic.coach_id], {
    title: 'Nova inscrição em clínica',
    message: `${str(athlete.displayName) || 'Um atleta'} se inscreveu em "${clinic.title}".`,
    type: NOTIFICATION_TYPE.GENERIC,
    link: '/aulas',
    actor: { uid: athlete.uid },
  });
  return id;
}

/** Cancela a inscrição (o próprio atleta ou o professor/admin). */
export async function cancelEnrollment(clinic, athleteId, actor) {
  if (!actor?.uid) throw new Error('Usuário não autenticado.');
  const isSelf = actor.uid === athleteId;
  const isCoach = actor.uid === clinic?.coach_id || actor.isPlatformAdmin;
  if (!isSelf && !isCoach) throw new Error('Sem permissão.');
  await deleteDoc(doc(db, COACH_CLINIC_SIGNUP_COLLECTION, clinicSignupDocId(clinic.id, athleteId)));
}
