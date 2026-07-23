/**
 * CoachContentSection — biblioteca de conteúdo do professor (Fase D — PRO-18).
 * Gestão (criar/editar/excluir) dentro do hub do professor (V2CoachAgenda).
 */

import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  BookOpen, Plus, Trash2, Pencil, Video, Lock, Globe,
} from 'lucide-react';
import {
  CONTENT_CATEGORY, CONTENT_CATEGORY_LABELS, CONTENT_VISIBILITY,
  contentCategoryLabel, sortContent,
} from '../domain/content.js';
import {
  useCoachContent, useCreateContent, useUpdateContent, useDeleteContent,
} from '../hooks/useContent.js';
import ConfirmDialog from '@/components/ConfirmDialog';
import {
  V2Badge, V2Button, V2EmptyState, V2Field, V2Input, V2Select, V2Skeleton,
  V2Surface, V2Textarea,
} from '@/v2/ui/primitives';

function ContentForm({ coachId, content, onClose }) {
  const create = useCreateContent();
  const update = useUpdateContent();
  const editing = !!content;
  const [form, setForm] = useState({
    title: content?.title || '',
    body: content?.body || '',
    video_url: content?.video_url || '',
    category: content?.category || CONTENT_CATEGORY.DRILL,
    visibility: content?.visibility || CONTENT_VISIBILITY.PUBLIC,
  });
  const pending = create.isPending || update.isPending;

  const submit = async (e) => {
    e.preventDefault();
    try {
      if (editing) await update.mutateAsync({ content, input: form });
      else await create.mutateAsync({ coachId, input: form });
      toast.success(editing ? 'Conteúdo atualizado.' : 'Conteúdo publicado.');
      onClose();
    } catch (err) {
      toast.error(err?.message || 'Não foi possível salvar.');
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-gray-100 bg-paper p-4">
      <h3 className="font-display text-base font-bold text-ink">{editing ? 'Editar conteúdo' : 'Novo conteúdo'}</h3>
      <V2Field label="Título">
        <V2Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={120} placeholder="Ex.: Drill de dink cruzado" />
      </V2Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <V2Field label="Categoria">
          <V2Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {Object.entries(CONTENT_CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </V2Select>
        </V2Field>
        <V2Field label="Visibilidade">
          <V2Select value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value })}>
            <option value={CONTENT_VISIBILITY.PUBLIC}>Público</option>
            <option value={CONTENT_VISIBILITY.STUDENTS}>Só alunos</option>
          </V2Select>
        </V2Field>
      </div>
      <V2Field label="Conteúdo (texto)">
        <V2Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={4} maxLength={5000} placeholder="Descreva o drill/dica. Você pode usar quebras de linha." />
      </V2Field>
      <V2Field label="Link de vídeo (opcional)">
        <V2Input value={form.video_url} onChange={(e) => setForm({ ...form, video_url: e.target.value })} placeholder="https://youtu.be/…" />
      </V2Field>
      <div className="flex justify-end gap-2 pt-1">
        <V2Button type="button" variant="ghost" onClick={onClose}>Cancelar</V2Button>
        <V2Button type="submit" disabled={pending}>{pending ? 'Salvando…' : editing ? 'Salvar' : 'Publicar'}</V2Button>
      </div>
    </form>
  );
}

export default function CoachContentSection({ coachId }) {
  const { data: content = [], isLoading } = useCoachContent(coachId, { full: true });
  const del = useDeleteContent();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const items = useMemo(() => sortContent(content), [content]);

  const handleDelete = async (item) => {
    try { await del.mutateAsync({ content: item }); toast.success('Conteúdo excluído.'); }
    catch (err) { toast.error(err?.message || 'Não foi possível excluir.'); }
  };

  const openNew = () => { setEditing(null); setShowForm(true); };
  const openEdit = (item) => { setEditing(item); setShowForm(true); };
  const close = () => { setShowForm(false); setEditing(null); };

  return (
    <V2Surface>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-ink" />
          <h2 className="font-display text-lg font-bold text-ink">Biblioteca de conteúdo</h2>
        </div>
        {!showForm && <V2Button size="sm" onClick={openNew}><Plus className="mr-1 h-4 w-4" /> Novo</V2Button>}
      </div>

      {showForm && (
        <div className="mb-4">
          <ContentForm coachId={coachId} content={editing} onClose={close} />
        </div>
      )}

      {isLoading ? (
        <V2Skeleton lines={3} />
      ) : items.length === 0 ? (
        <V2EmptyState icon={BookOpen} title="Nenhum conteúdo" description="Publique drills e dicas (texto e/ou vídeo). Aparecem no seu perfil público." />
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="rounded-2xl border border-gray-100 bg-paper p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-ink">{item.title}</p>
                    <V2Badge tone="blue">{contentCategoryLabel(item.category)}</V2Badge>
                    {item.visibility === CONTENT_VISIBILITY.STUDENTS
                      ? <V2Badge tone="amber"><Lock className="mr-1 inline h-3 w-3" />Só alunos</V2Badge>
                      : <V2Badge tone="neutral"><Globe className="mr-1 inline h-3 w-3" />Público</V2Badge>}
                  </div>
                  {item.body && <p className="mt-1 whitespace-pre-line text-xs text-gray-600 line-clamp-3">{item.body}</p>}
                  {item.video_url && (
                    <a href={item.video_url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-ink hover:underline">
                      <Video className="h-3 w-3" /> Ver vídeo
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => openEdit(item)} className="rounded-full border border-gray-200 p-1.5 text-gray-500 hover:bg-white" aria-label="Editar">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <ConfirmDialog
                    title="Excluir conteúdo?"
                    description={`"${item.title}" será removido da sua biblioteca.`}
                    confirmLabel="Excluir"
                    onConfirm={() => handleDelete(item)}
                    trigger={(
                      <button type="button" className="rounded-full border border-red-200 p-1.5 text-red-500 hover:bg-red-50" aria-label="Excluir">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </V2Surface>
  );
}
