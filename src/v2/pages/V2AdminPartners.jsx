import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ExternalLink, Handshake, Pencil, Plus, Trash2 } from 'lucide-react';
import { ImageUpload } from '@/components/ui/image-upload';
import ConfirmDialog from '@/components/ConfirmDialog';
import { PhotoLightbox } from '@/components/ui/photo-lightbox';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { AFFILIATE_CATEGORY_LABELS, normalizeAffiliateInput } from '@/modules/partners/domain/affiliate';
import {
  useAffiliateLinks, useCreateAffiliateLink, useUpdateAffiliateLink, useDeleteAffiliateLink,
} from '@/modules/partners/hooks/useAffiliates';
import {
  V2Badge, V2Button, V2Field, V2Input, V2PageIntro, V2SectionHeader, V2Select, V2Surface, V2Textarea, V2Toggle,
} from '@/v2/ui/primitives';

const EMPTY = { title: '', url: '', description: '', category: 'other', image_url: '', active: true, sort_order: 0 };

export default function V2AdminPartners() {
  const enabled = useFeatureFlag(FEATURE_FLAG.AFFILIATE_LINKS);
  const { isPlatformAdmin } = useAuth();
  const { data: links = [], isLoading } = useAffiliateLinks();
  const create = useCreateAffiliateLink();
  const update = useUpdateAffiliateLink();
  const remove = useDeleteAffiliateLink();
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [errors, setErrors] = useState({});

  if (!isPlatformAdmin || !enabled) return <Navigate to="/" replace />;

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const startEdit = (link) => { setEditingId(link.id); setForm({ ...EMPTY, ...link }); setErrors({}); };
  const resetForm = () => { setEditingId(null); setForm(EMPTY); setErrors({}); };

  async function handleSubmit(e) {
    e.preventDefault();
    const check = normalizeAffiliateInput(form);
    if (!check.valid) { setErrors(check.errors); return; }
    try {
      if (editingId) { await update.mutateAsync({ id: editingId, input: form }); toast.success('Parceiro atualizado.'); }
      else { await create.mutateAsync(form); toast.success('Parceiro cadastrado.'); }
      resetForm();
    } catch (err) { toast.error(err?.message || 'Não foi possível salvar.'); }
  }

  async function toggleActive(link) {
    try { await update.mutateAsync({ id: link.id, input: { ...link, active: !link.active } }); }
    catch (err) { toast.error(err?.message || 'Não foi possível atualizar.'); }
  }

  async function handleDelete(link) {
    try {
      await remove.mutateAsync(link.id);
      toast.success('Parceiro removido.');
      if (editingId === link.id) resetForm();
    } catch (err) { toast.error(err?.message || 'Não foi possível remover.'); }
  }

  const activeCount = links.filter((l) => l.active !== false).length;

  return (
    <div className="mx-auto max-w-[1000px]">
      <V2PageIntro title="Parceiros e afiliados" subtitle="Cadastre e gerencie links de afiliado e patrocinadores." />

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatMini label="Total" value={links.length} />
        <StatMini label="Ativos" value={activeCount} />
        <StatMini label="Inativos" value={links.length - activeCount} />
      </div>

      <V2Surface className="mb-6">
        <div className="flex items-center gap-2"><Handshake className="h-5 w-5 text-ink" /><h2 className="font-display text-lg font-bold text-ink">{editingId ? 'Editar parceiro' : 'Novo parceiro / afiliado'}</h2></div>
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <V2Field label="Título" error={errors.title}><V2Input value={form.title} onChange={(e) => set({ title: e.target.value })} maxLength={100} /></V2Field>
            <V2Field label="URL (com https://)" error={errors.url}><V2Input value={form.url} onChange={(e) => set({ url: e.target.value })} placeholder="https://..." /></V2Field>
          </div>
          <V2Field label="Descrição (opcional)"><V2Textarea value={form.description} onChange={(e) => set({ description: e.target.value })} maxLength={300} rows={2} /></V2Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <V2Field label="Categoria">
              <V2Select value={form.category} onChange={(e) => set({ category: e.target.value })}>
                {Object.entries(AFFILIATE_CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </V2Select>
            </V2Field>
            <V2Field label="Ordem"><V2Input type="number" value={form.sort_order} onChange={(e) => set({ sort_order: e.target.value })} /></V2Field>
          </div>
          <V2Field label="Imagem (opcional)" hint="Logo ou banner do parceiro.">
            <ImageUpload value={form.image_url} onChange={(url) => set({ image_url: url || '' })} folder="partners" label="Enviar imagem" />
          </V2Field>
          <div className="rounded-2xl border border-gray-100 bg-paper p-4">
            <V2Toggle id="active" label="Ativo (visível na página de parceiros)" checked={form.active} onChange={(v) => set({ active: v })} />
          </div>
          <div className="flex gap-2">
            <V2Button type="submit" disabled={create.isPending || update.isPending}><Plus className="h-4 w-4" /> {editingId ? 'Salvar alterações' : 'Cadastrar'}</V2Button>
            {editingId && <V2Button type="button" variant="ghost" onClick={resetForm}>Cancelar edição</V2Button>}
          </div>
        </form>
      </V2Surface>

      <V2Surface>
        <V2SectionHeader eyebrow="Inventário" title="Parceiros cadastrados" titleClassName="text-lg" />
        {isLoading ? (
          <div className="mt-4 space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-gray-100" />)}</div>
        ) : links.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">Nenhum parceiro cadastrado ainda.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {links.map((link) => (
              <div key={link.id} className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-paper p-3">
                <div className="flex min-w-0 items-center gap-2">
                  {link.image_url && (
                    <PhotoLightbox src={link.image_url} alt={link.title} title={link.title}
                      trigger={<img src={link.image_url} alt="" className="h-10 w-10 cursor-zoom-in rounded-xl object-cover" />} />
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold text-ink">{link.title}</span>
                      {!link.active && <V2Badge tone="neutral">inativo</V2Badge>}
                    </div>
                    <a href={link.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-ink-lighter hover:underline">
                      {link.url} <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <V2Toggle checked={link.active !== false} onChange={() => toggleActive(link)} />
                  <button onClick={() => startEdit(link)} className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-paper-dark hover:text-ink"><Pencil className="h-4 w-4" /></button>
                  <ConfirmDialog
                    title="Remover parceiro?"
                    description={`"${link.title}" deixará de aparecer na página de parceiros.`}
                    confirmLabel="Remover"
                    onConfirm={() => handleDelete(link)}
                    trigger={<button className="flex h-9 w-9 items-center justify-center rounded-full text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </V2Surface>
    </div>
  );
}

function StatMini({ label, value }) {
  return (
    <div className="rounded-3xl border border-gray-100 bg-paper-pure p-5 text-center shadow-organic-sm">
      <p className="font-display text-3xl font-bold text-ink">{value}</p>
      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
    </div>
  );
}
