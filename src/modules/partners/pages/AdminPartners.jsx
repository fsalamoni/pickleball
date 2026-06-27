import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Handshake, Pencil, Trash2, Plus, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ImageUpload } from '@/components/ui/image-upload';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import {
  AFFILIATE_CATEGORY_LABELS,
  normalizeAffiliateInput,
} from '../domain/affiliate.js';
import {
  useAffiliateLinks,
  useCreateAffiliateLink,
  useUpdateAffiliateLink,
  useDeleteAffiliateLink,
} from '../hooks/useAffiliates.js';

const EMPTY = { title: '', url: '', description: '', category: 'other', image_url: '', active: true, sort_order: 0 };

export default function AdminPartners() {
  const enabled = useFeatureFlag(FEATURE_FLAG.AFFILIATE_LINKS);
  const { data: links = [], isLoading } = useAffiliateLinks();
  const create = useCreateAffiliateLink();
  const update = useUpdateAffiliateLink();
  const remove = useDeleteAffiliateLink();
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [errors, setErrors] = useState({});

  if (!enabled) return <Navigate to="/admin/metricas" replace />;

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  function startEdit(link) {
    setEditingId(link.id);
    setForm({ ...EMPTY, ...link });
    setErrors({});
  }
  function resetForm() {
    setEditingId(null);
    setForm(EMPTY);
    setErrors({});
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const check = normalizeAffiliateInput(form);
    if (!check.valid) {
      setErrors(check.errors);
      return;
    }
    try {
      if (editingId) {
        await update.mutateAsync({ id: editingId, input: form });
        toast.success('Parceiro atualizado.');
      } else {
        await create.mutateAsync(form);
        toast.success('Parceiro cadastrado.');
      }
      resetForm();
    } catch (err) {
      toast.error(err?.message || 'Não foi possível salvar.');
    }
  }

  async function toggleActive(link) {
    try {
      await update.mutateAsync({ id: link.id, input: { ...link, active: !link.active } });
    } catch (err) {
      toast.error(err?.message || 'Não foi possível atualizar.');
    }
  }

  async function handleDelete(link) {
    try {
      await remove.mutateAsync(link.id);
      toast.success('Parceiro removido.');
      if (editingId === link.id) resetForm();
    } catch (err) {
      toast.error(err?.message || 'Não foi possível remover.');
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Handshake className="h-5 w-5 text-emerald-600" />
            <h2 className="text-lg font-semibold arena-heading">
              {editingId ? 'Editar parceiro' : 'Novo parceiro / afiliado'}
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="title">Título</Label>
                <Input id="title" value={form.title} onChange={(e) => set({ title: e.target.value })} maxLength={100} />
                {errors.title && <p className="text-xs text-red-600">{errors.title}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="url">URL (com https://)</Label>
                <Input id="url" value={form.url} onChange={(e) => set({ url: e.target.value })} placeholder="https://..." />
                {errors.url && <p className="text-xs text-red-600">{errors.url}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição (opcional)</Label>
              <textarea
                id="description"
                value={form.description}
                onChange={(e) => set({ description: e.target.value })}
                maxLength={300}
                rows={2}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="category">Categoria</Label>
                <select
                  id="category"
                  value={form.category}
                  onChange={(e) => set({ category: e.target.value })}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {Object.entries(AFFILIATE_CATEGORY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sort_order">Ordem</Label>
                <Input
                  id="sort_order"
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => set({ sort_order: e.target.value })}
                  className="w-28"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Imagem (opcional)</Label>
              <ImageUpload
                value={form.image_url}
                onChange={(url) => set({ image_url: url || '' })}
                folder="partners"
                label="Enviar imagem"
                hint="Logo ou banner do parceiro."
              />
            </div>

            <div className="flex items-center justify-between gap-4 rounded-md border border-slate-200 p-3">
              <div>
                <Label htmlFor="active" className="cursor-pointer text-sm">Ativo (visível na página de parceiros)</Label>
              </div>
              <Switch id="active" checked={form.active} onCheckedChange={(v) => set({ active: v })} />
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={create.isPending || update.isPending}>
                <Plus className="h-4 w-4" />
                <span className="ml-1">{editingId ? 'Salvar alterações' : 'Cadastrar'}</span>
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={resetForm}>Cancelar edição</Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Parceiros cadastrados</h2>
          {isLoading ? (
            <p className="text-sm text-slate-500">Carregando…</p>
          ) : links.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum parceiro cadastrado ainda.</p>
          ) : (
            <div className="space-y-2">
              {links.map((link) => (
                <div key={link.id} className="flex items-center justify-between gap-3 rounded-md border border-slate-200 p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-slate-900">{link.title}</span>
                      {!link.active && <Badge variant="secondary" className="text-[11px]">inativo</Badge>}
                    </div>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:underline"
                    >
                      {link.url} <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Switch checked={link.active !== false} onCheckedChange={() => toggleActive(link)} aria-label="Ativo" />
                    <Button size="sm" variant="outline" onClick={() => startEdit(link)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <ConfirmDialog
                      title="Remover parceiro?"
                      description={`"${link.title}" deixará de aparecer na página de parceiros.`}
                      confirmLabel="Remover"
                      onConfirm={() => handleDelete(link)}
                      trigger={(
                        <Button size="sm" variant="outline" aria-label="Remover parceiro">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
