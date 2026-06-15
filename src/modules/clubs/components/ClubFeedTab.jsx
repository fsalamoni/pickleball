import React, { useState } from 'react';
import { toast } from 'sonner';
import { MessageSquare, Send, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useClubPosts, useCreateClubPost, useDeleteClubPost } from '@/modules/clubs/hooks/useClubs';

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
  const [content, setContent] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  const handlePost = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    try {
      await createPost.mutateAsync(content);
      setContent('');
    } catch (err) {
      toast.error(err.message || 'Não foi possível publicar.');
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deletePost.mutateAsync(confirmDelete.id);
      setConfirmDelete(null);
    } catch (err) {
      toast.error(err.message || 'Não foi possível remover.');
    }
  };

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
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={createPost.isPending || !content.trim()}>
                <Send className="mr-1.5 h-4 w-4" /> {createPost.isPending ? 'Publicando…' : 'Publicar'}
              </Button>
            </div>
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
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{post.content}</p>
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
        description="Tem certeza que deseja remover esta publicação do mural?"
        confirmLabel="Remover"
        destructive
        loading={deletePost.isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
