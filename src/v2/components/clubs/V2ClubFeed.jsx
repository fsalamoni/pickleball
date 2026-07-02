import React, { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Download, ImagePlus, Loader2, MessageSquare, Send, Trash2, X } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useClubPosts, useCreateClubPost, useDeleteClubPost } from '@/modules/clubs/hooks/useClubs';
import {
  uploadImage,
  downloadImage,
  deleteImage,
  maxImageMb,
  ACCEPTED_IMAGE_ATTR,
} from '@/core/services/storageService';
import { V2Button, V2EmptyState, V2Skeleton } from '@/v2/ui/primitives';

const MAX_IMAGES_PER_POST = 10;

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

export default function V2ClubFeed({ clubId, isAdmin }) {
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
      (confirmDelete.images || []).forEach((img) => img.path && deleteImage(img.path));
      setConfirmDelete(null);
    } catch (err) {
      toast.error(err.message || 'Não foi possível remover.');
    }
  };

  const canSubmit = (content.trim() || pendingImages.length > 0) && !createPost.isPending && !uploading;

  return (
    <div className="space-y-4">
      <div className="rounded-4xl border border-gray-100 bg-paper-pure p-4 shadow-organic-sm sm:p-5">
        <form onSubmit={handlePost} className="space-y-3">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Compartilhe um aviso, combine um jogo, comemore uma vitória…"
            className="w-full rounded-2xl border border-gray-200 bg-paper px-4 py-3 text-sm text-ink placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acid/30"
          />

          {pendingImages.length > 0 && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {pendingImages.map((image) => (
                <div key={image.path} className="group relative aspect-square overflow-hidden rounded-2xl border border-gray-100">
                  <img src={image.url} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePending(image)}
                    aria-label="Remover imagem"
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-ink/70 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <input ref={fileInputRef} type="file" accept={ACCEPTED_IMAGE_ATTR} multiple onChange={handlePickImages} className="hidden" />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <V2Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || pendingImages.length >= MAX_IMAGES_PER_POST}
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
              {uploading ? 'Enviando…' : 'Adicionar imagens'}
            </V2Button>
            <V2Button type="submit" size="sm" disabled={!canSubmit}>
              <Send className="h-4 w-4" /> {createPost.isPending ? 'Publicando…' : 'Publicar'}
            </V2Button>
          </div>
          <p className="text-xs text-gray-400">
            Até {MAX_IMAGES_PER_POST} imagens por publicação, {maxImageMb()} MB cada. As imagens podem ser baixadas em alta qualidade pelos membros.
          </p>
        </form>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2].map((i) => <V2Skeleton key={i} className="h-24 rounded-4xl" />)}</div>
      ) : posts.length === 0 ? (
        <V2EmptyState icon={MessageSquare} title="Mural vazio" description="Seja o primeiro a publicar algo para o clube." />
      ) : (
        <div className="space-y-3">
          {posts.map((post) => {
            const canDelete = isAdmin || post.author_id === user?.uid;
            return (
              <div key={post.id} className="rounded-4xl border border-gray-100 bg-paper-pure p-4 shadow-organic-sm sm:p-5">
                <div className="flex items-start gap-3">
                  <UserAvatar name={post.author_name} photoUrl={post.author_photo} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-bold text-ink">{post.author_name}</span>
                        <span className="ml-2 text-xs text-gray-400">{timeAgo(post.created_at_ms)}</span>
                      </div>
                      {canDelete && (
                        <button className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-red-500 transition-colors hover:bg-red-50" onClick={() => setConfirmDelete(post)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    {post.content && <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-gray-700">{post.content}</p>}
                    <PostImages images={post.images} />
                  </div>
                </div>
              </div>
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
        <div key={image.path || image.url} className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-paper">
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
            className="absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full bg-ink/70 text-white opacity-0 transition-opacity hover:bg-ink/90 group-hover:opacity-100"
          >
            <Download className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
