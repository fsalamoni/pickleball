import React, { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Download, ImagePlus, Loader2, MessageSquare, Send, Trash2, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useClubPosts, useCreateClubPost, useDeleteClubPost } from '@/modules/clubs/hooks/useClubs';
import {
  uploadImage,
  downloadImage,
  deleteImage,
  maxImageMb,
  ACCEPTED_IMAGE_ATTR,
} from '@/core/services/storageService';

const MAX_IMAGES_PER_POST = 10;

function initials(name) {
  return String(name || 'A').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || 'A';
}

function timeAgo(ms) {
  if (!ms) return '';
  const diff = Date.now() - ms;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `há ${days} d`;
  return new Date(ms).toLocaleDateString('pt-BR');
}

export default function ClubFeedTab({ clubId, isAdmin }) {
  const { user } = useAuth();
  const { data: posts = [], isLoading } = useClubPosts(clubId);
  const createPost = useCreateClubPost(clubId);
  const deletePost = useDeleteClubPost(clubId);
  const fileInputRef = useRef(null);
  const [content, setContent] = useState('');
  const [pendingImages, setPendingImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const handlePickImages = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (files.length === 0) return;
    const remaining = MAX_IMAGES_PER_POST - pendingImages.length;
    if (remaining <= 0) {
      toast.error(`Máximo de ${MAX_IMAGES_PER_POST} imagens por publicação.`);
      return;
    }
    setUploading(true);
    try {
      for (const file of files.slice(0, remaining)) {
        try {
          const meta = await uploadImage(file, { uid: user?.uid, folder: 'posts' });
          setPendingImages((prev) => [...prev, meta]);
        } catch (err) {
          toast.error(err.message || `Falha ao enviar ${file.name}.`);
        }
      }
    } finally {
      setUploading(false);
    }
  };

  const removePending = async (image) => {
    setPendingImages((prev) => prev.filter((img) => img.path !== image.path));
    // Remove do Storage o anexo que não será publicado (best-effort).
    deleteImage(image.path);
  };

  const handlePost = async (e) => {
    e.preventDefault();
    if (!content.trim() && pendingImages.length === 0) return;
    try {
      await createPost.mutateAsync({ content, images: pendingImages });
      setContent('');
      setPendingImages([]);
    } catch (err) {
      toast.error(err.message || 'Não foi possível publicar.');
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deletePost.mutateAsync(confirmDelete.id);
      // Remove as imagens da publicação do Storage (best-effort).
      (confirmDelete.images || []).forEach((img) => img.path && deleteImage(img.path));
      setConfirmDelete(null);
    } catch (err) {
      toast.error(err.message || 'Não foi possível remover.');
    }
  };

  const canSubmit = (content.trim() || pendingImages.length > 0) && !createPost.isPending && !uploading;

  return (
    <div className="space-y-4">
      <Card className="rounded-xl">
        <CardContent className="p-4">
          <form onSubmit={handlePost} className="space-y-3">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Compartilhe um aviso, combine um jogo, comemore uma vitória…"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />

            {pendingImages.length > 0 && (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {pendingImages.map((image) => (
                  <div key={image.path} className="group relative aspect-square overflow-hidden rounded-lg border border-emerald-950/10">
                    <img src={image.url} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePending(image)}
                      aria-label="Remover imagem"
                      className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-slate-950/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_IMAGE_ATTR}
              multiple
              onChange={handlePickImages}
              className="hidden"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || pendingImages.length >= MAX_IMAGES_PER_POST}
              >
                {uploading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-1.5 h-4 w-4" />}
                {uploading ? 'Enviando…' : 'Adicionar imagens'}
              </Button>
              <Button type="submit" size="sm" disabled={!canSubmit}>
                <Send className="mr-1.5 h-4 w-4" /> {createPost.isPending ? 'Publicando…' : 'Publicar'}
              </Button>
            </div>
            <p className="text-xs text-slate-500">
              Até {MAX_IMAGES_PER_POST} imagens por publicação, {maxImageMb()} MB cada. As imagens podem ser baixadas em alta qualidade pelos membros.
            </p>
          </form>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3">{[1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : posts.length === 0 ? (
        <EmptyState icon={MessageSquare} title="Mural vazio" description="Seja o primeiro a publicar algo para o clube." />
      ) : (
        <div className="space-y-3">
          {posts.map((post) => {
            const canDelete = isAdmin || post.author_id === user?.uid;
            return (
              <Card key={post.id} className="rounded-xl">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {post.author_photo ? (
                      <img src={post.author_photo} alt="" className="h-9 w-9 shrink-0 rounded-full border border-emerald-900/10 object-cover" />
                    ) : (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-900 text-sm font-semibold text-emerald-50">
                        {initials(post.author_name)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <span className="font-medium text-slate-900">{post.author_name}</span>
                          <span className="ml-2 text-xs text-slate-400">{timeAgo(post.created_at_ms)}</span>
                        </div>
                        {canDelete && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-red-500 hover:text-red-600" onClick={() => setConfirmDelete(post)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                      {post.content && (
                        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{post.content}</p>
                      )}
                      <PostImages images={post.images} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(v) => !v && setConfirmDelete(null)}
        title="Remover publicação"
        description="Tem certeza que deseja remover esta publicação do mural? As imagens anexadas também serão removidas."
        confirmLabel="Remover"
        destructive
        loading={deletePost.isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function PostImages({ images }) {
  const list = Array.isArray(images) ? images.filter((img) => img && img.url) : [];
  if (list.length === 0) return null;

  const handleDownload = (image) => {
    toast.promise(downloadImage(image.url, image.name), {
      loading: 'Baixando imagem…',
      success: 'Download iniciado.',
      error: 'Não foi possível baixar a imagem.',
    });
  };

  return (
    <div className={`mt-3 grid gap-2 ${list.length === 1 ? 'grid-cols-1 sm:max-w-md' : 'grid-cols-2 sm:grid-cols-3'}`}>
      {list.map((image) => (
        <div key={image.path || image.url} className="group relative overflow-hidden rounded-lg border border-emerald-950/10 bg-slate-50">
          <a href={image.url} target="_blank" rel="noopener noreferrer" className="block">
            <img
              src={image.url}
              alt={image.name || ''}
              loading="lazy"
              className={`w-full object-cover ${list.length === 1 ? 'max-h-96' : 'aspect-square'}`}
            />
          </a>
          <button
            type="button"
            onClick={() => handleDownload(image)}
            aria-label="Baixar imagem"
            title="Baixar em alta qualidade"
            className="absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full bg-slate-950/60 text-white opacity-0 transition-opacity hover:bg-slate-950/80 group-hover:opacity-100"
          >
            <Download className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
