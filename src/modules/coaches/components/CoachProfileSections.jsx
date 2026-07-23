/**
 * Seções de perfil do professor para o hub admin: Informações (editor inline)
 * e Fotos. Espelham o "Perfil" da arena.
 */

import React, { useState } from 'react';
import { toast } from 'sonner';
import { Trash2, UserCircle, Image as ImageIcon } from 'lucide-react';
import { useUpsertCoachProfile } from '../hooks/useCoaches.js';
import { COACH_PHOTOS_MAX } from '../domain/coach.js';
import { ImageUpload } from '@/components/ui/image-upload';
import { PhotoLightbox } from '@/components/ui/photo-lightbox';
import {
  V2Button, V2Field, V2Input, V2Surface, V2Textarea,
} from '@/v2/ui/primitives';

const splitCsv = (s) => String(s ?? '').split(',').map((x) => x.trim()).filter(Boolean);

/** Editor inline das informações do professor (persistente, sem toggle). */
export function CoachInfoSection({ coach }) {
  const upsert = useUpsertCoachProfile();
  const [form, setForm] = useState({
    display_name: coach?.display_name || '',
    bio: coach?.bio || '',
    hourly_rate: coach?.hourly_rate ?? '',
    regions: (coach?.regions || []).join(', '),
    modalities: (coach?.modalities || []).join(', '),
    certifications: (coach?.certifications || []).join(', '),
    contact_whatsapp: coach?.contact_whatsapp || '',
    contact_email: coach?.contact_email || '',
    accepting_students: coach?.accepting_students !== false,
    active: coach?.active !== false,
  });
  const setField = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    try {
      await upsert.mutateAsync({
        coachId: coach.id,
        input: {
          ...coach,
          ...form,
          hourly_rate: form.hourly_rate === '' ? null : Number(form.hourly_rate),
          regions: splitCsv(form.regions),
          modalities: splitCsv(form.modalities),
          certifications: splitCsv(form.certifications),
        },
      });
      toast.success('Informações salvas!');
    } catch (err) {
      toast.error(err?.message || 'Não foi possível salvar.');
    }
  };

  return (
    <V2Surface>
      <div className="mb-4 flex items-center gap-2">
        <UserCircle className="h-5 w-5 text-ink" />
        <h2 className="font-display text-lg font-bold text-ink">Informações</h2>
      </div>
      <form onSubmit={save} className="space-y-3">
        <V2Field label="Nome de exibição" required>
          <V2Input value={form.display_name} onChange={setField('display_name')} required maxLength={80} />
        </V2Field>
        <V2Field label="Bio" hint="Experiência, metodologia, diferenciais (máx. 1000).">
          <V2Textarea value={form.bio} onChange={setField('bio')} maxLength={1000} rows={3} />
        </V2Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <V2Field label="Valor/hora (R$)">
            <V2Input type="number" min="0" step="0.01" value={form.hourly_rate} onChange={setField('hourly_rate')} />
          </V2Field>
          <V2Field label="Regiões (vírgula)">
            <V2Input value={form.regions} onChange={setField('regions')} placeholder="São Paulo, Rio" />
          </V2Field>
        </div>
        <V2Field label="Modalidades (vírgula)" required>
          <V2Input value={form.modalities} onChange={setField('modalities')} required placeholder="Iniciantes, Avançado, DUPR 4.0+" />
        </V2Field>
        <V2Field label="Certificações (vírgula)">
          <V2Input value={form.certifications} onChange={setField('certifications')} placeholder="CBP Level 1, IFP" />
        </V2Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <V2Field label="WhatsApp (contato)" hint="Aparece no perfil público para os alunos.">
            <V2Input value={form.contact_whatsapp} onChange={setField('contact_whatsapp')} placeholder="+55 11 99999-9999" maxLength={40} />
          </V2Field>
          <V2Field label="E-mail (contato)">
            <V2Input type="email" value={form.contact_email} onChange={setField('contact_email')} maxLength={160} />
          </V2Field>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.accepting_students} onChange={setField('accepting_students')} className="h-4 w-4 rounded border-gray-300" />
            Aceitando novos alunos
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.active} onChange={setField('active')} className="h-4 w-4 rounded border-gray-300" />
            Perfil ativo (visível no diretório)
          </label>
        </div>
        <div className="flex justify-end">
          <V2Button type="submit" disabled={upsert.isPending}>{upsert.isPending ? 'Salvando…' : 'Salvar informações'}</V2Button>
        </div>
      </form>
    </V2Surface>
  );
}

/** Gestão de fotos do professor (salvas no array `photos` do perfil). */
export function CoachPhotosSection({ coach }) {
  const upsert = useUpsertCoachProfile();
  const photos = coach?.photos || [];

  const savePhotos = async (next) => {
    try {
      await upsert.mutateAsync({ coachId: coach.id, input: { ...coach, photos: next } });
    } catch (err) {
      toast.error(err?.message || 'Não foi possível salvar as fotos.');
    }
  };

  const addPhoto = async (url) => {
    if (!url) return;
    await savePhotos([...photos, url]);
    toast.success('Foto adicionada.');
  };
  const removePhoto = async (idx) => {
    await savePhotos(photos.filter((_, i) => i !== idx));
  };

  return (
    <V2Surface className="space-y-4">
      <div className="flex items-center gap-2">
        <ImageIcon className="h-5 w-5 text-ink" />
        <h2 className="font-display text-lg font-bold text-ink">Fotos</h2>
      </div>
      <p className="-mt-2 text-sm text-gray-500">A primeira foto é usada como destaque. Até {COACH_PHOTOS_MAX} fotos.</p>
      {photos.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {photos.map((url, i) => (
            <div key={url || i} className="group relative">
              <PhotoLightbox src={url} alt={`Foto ${i + 1} do professor`}
                trigger={<img src={url} alt="" className="h-28 w-full cursor-zoom-in rounded-2xl object-cover" />} />
              {i === 0 && <span className="absolute left-1 top-1 rounded bg-acid px-1.5 py-0.5 text-[10px] font-bold text-ink">Destaque</span>}
              <button type="button" onClick={() => removePhoto(i)} className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-red-600 opacity-0 transition-opacity group-hover:opacity-100" aria-label="Remover foto">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      {photos.length < COACH_PHOTOS_MAX && (
        <ImageUpload value="" onChange={(url) => addPhoto(url)} folder="coaches" label="Adicionar foto" hint="JPG/PNG de aulas, quadras, você em ação." />
      )}
    </V2Surface>
  );
}
