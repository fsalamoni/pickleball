/**
 * V2Coaches — Diretório de professores + gestão do próprio perfil
 * (Sprint 4 PRO-15).
 *
 * Rota: /coaches
 * Mostra:
 *  - Lista de coaches (com filtros region/modality)
 *  - Botão "Sou professor" para criar/editar próprio perfil
 */

import React, { useState, useMemo } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { GraduationCap, MapPin, Plus, Edit3, Star, Award, Search } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useCoaches, useCoach, useUpsertCoachProfile } from '@/modules/coaches/hooks/useCoaches';
import { cn } from '@/core/lib/utils';
import {
  V2Badge, V2Button, V2EmptyState, V2Field, V2Input, V2Surface, V2Textarea,
  V2Skeleton,
} from '@/v2/ui/primitives';

function CoachForm({ existing, onClose }) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    display_name: existing?.display_name || user?.displayName || '',
    bio: existing?.bio || '',
    hourly_rate: existing?.hourly_rate ?? '',
    regions: (existing?.regions || []).join(', '),
    modalities: (existing?.modalities || []).join(', '),
    certifications: (existing?.certifications || []).join(', '),
    accepting_students: existing?.accepting_students !== false,
    active: existing?.active !== false,
  });
  const upsert = useUpsertCoachProfile();
  const setField = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const split = (s) => str(s).split(',').map((x) => x.trim()).filter(Boolean);
    try {
      await upsert.mutateAsync({
        coachId: user.uid,
        input: {
          ...form,
          hourly_rate: form.hourly_rate === '' ? null : Number(form.hourly_rate),
          regions: split(form.regions),
          modalities: split(form.modalities),
          certifications: split(form.certifications),
        },
      });
      toast.success('Perfil salvo!');
      onClose();
    } catch (err) {
      toast.error(err.message);
    }
  };

  function str(s) { return String(s ?? ''); }

  return (
    <V2Surface className="border-emerald-200 bg-emerald-50/40">
      <h3 className="font-display text-base font-bold text-ink">
        {existing ? 'Editar perfil de professor' : 'Tornar-se professor'}
      </h3>
      <form onSubmit={handleSubmit} className="mt-3 space-y-3">
        <V2Field label="Nome de exibição" required>
          <V2Input value={form.display_name} onChange={setField('display_name')} required maxLength={80} />
        </V2Field>
        <V2Field label="Bio" hint="Conte sua experiência, metodologia, etc. (max 1000 chars)">
          <V2Textarea value={form.bio} onChange={setField('bio')} maxLength={1000} rows={3} />
        </V2Field>
        <div className="grid grid-cols-2 gap-2">
          <V2Field label="Valor/hora (R$)">
            <input type="number" min="0" step="0.01" value={form.hourly_rate} onChange={setField('hourly_rate')}
              className="w-full rounded-2xl border border-gray-200 bg-paper px-4 py-3 text-sm outline-none focus-visible:ring-4 focus-visible:ring-acid/30" />
          </V2Field>
          <V2Field label="Regiões (separadas por vírgula)">
            <V2Input value={form.regions} onChange={setField('regions')} placeholder="São Paulo, Rio" />
          </V2Field>
        </div>
        <V2Field label="Modalidades (separadas por vírgula)" required>
          <V2Input value={form.modalities} onChange={setField('modalities')} required placeholder="Iniciantes, Avançado, DUPR 4.0+" />
        </V2Field>
        <V2Field label="Certificações (separadas por vírgula)">
          <V2Input value={form.certifications} onChange={setField('certifications')} placeholder="CBP Level 1, IFP" />
        </V2Field>
        <div className="flex flex-col gap-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.accepting_students} onChange={setField('accepting_students')} />
            Aceitando novos alunos
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.active} onChange={setField('active')} />
            Perfil ativo (visível no diretório)
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <V2Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancelar</V2Button>
          <V2Button type="submit" size="sm" disabled={upsert.isPending}>
            {upsert.isPending ? 'Salvando…' : 'Salvar'}
          </V2Button>
        </div>
      </form>
    </V2Surface>
  );
}

function CoachCard({ coach }) {
  return (
    <Link to={`/coaches/${coach.id}`} className="block transition-transform hover:scale-[1.01]">
      <V2Surface>
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-amber-500 text-lg font-bold text-white">
            {coach.display_name?.[0] || '?'}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-display text-base font-bold text-ink">{coach.display_name}</h3>
              {coach.accepting_students && <V2Badge tone="emerald">Aceitando</V2Badge>}
            </div>
            {coach.bio && <p className="mt-1 line-clamp-2 text-sm text-gray-600">{coach.bio}</p>}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(coach.modalities || []).map((m) => (
                <V2Badge key={m} tone="sky">{m}</V2Badge>
              ))}
            </div>
            {coach.regions?.length > 0 && (
              <div className="mt-2 flex items-center gap-1 text-xs text-gray-400">
                <MapPin className="h-3 w-3" /> {coach.regions.join(' · ')}
              </div>
            )}
            {coach.hourly_rate != null && (
              <div className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-emerald-700">
                <Award className="h-3 w-3" /> R$ {Number(coach.hourly_rate).toFixed(2)}/h
              </div>
            )}
          </div>
        </div>
      </V2Surface>
    </Link>
  );
}

export default function V2Coaches() {
  const { isAuthenticated, user } = useAuth();
  const [region, setRegion] = useState('');
  const [modality, setModality] = useState('');
  const { data: coaches = [], isLoading } = useCoaches({ region, modality, acceptingOnly: true });
  const { data: myProfile } = useCoach(user?.uid);
  const [editing, setEditing] = useState(false);

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-emerald-700" /> Professores
          </h1>
          <p className="mt-1 text-sm text-gray-500">Encontre coaches de pickleball ou cadastre-se como professor</p>
        </div>
        <V2Button size="sm" variant={myProfile ? 'ghost' : 'default'} onClick={() => setEditing(true)}>
          {myProfile ? <><Edit3 className="h-4 w-4" /> Editar perfil</> : <><Plus className="h-4 w-4" /> Sou professor</>}
        </V2Button>
      </div>

      {editing && <CoachForm existing={myProfile} onClose={() => setEditing(false)} />}

      {/* Filtros */}
      <V2Surface>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <V2Field label="Cidade / Estado">
            <V2Input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="São Paulo" />
          </V2Field>
          <V2Field label="Modalidade">
            <V2Input value={modality} onChange={(e) => setModality(e.target.value)} placeholder="Iniciantes" />
          </V2Field>
        </div>
      </V2Surface>

      {/* Lista */}
      {isLoading ? (
        <V2Skeleton lines={4} />
      ) : coaches.length === 0 ? (
        <V2EmptyState
          icon={GraduationCap}
          title="Nenhum professor encontrado"
          description="Ajuste os filtros ou volte mais tarde."
        />
      ) : (
        <div className="space-y-3">
          {coaches.map((c) => <CoachCard key={c.id} coach={c} />)}
        </div>
      )}
    </div>
  );
}
