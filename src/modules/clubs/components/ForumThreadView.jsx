import React, { useState } from 'react';
import { toast } from 'sonner';
import {
  ArrowLeft,
  MessageSquare,
  MoreVertical,
  Pencil,
  Pin,
  PinOff,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { UserAvatar } from '@/components/ui/user-avatar';
import { MarkdownContent } from '@/components/ui/markdown-content';
import { MarkdownEditor } from '@/components/ui/markdown-editor';
import { AttachmentGallery, AttachmentAddButton, PendingAttachmentList, useAttachmentUploader } from '@/components/ui/attachments';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { FORUM_LIMITS } from '@/modules/clubs/domain/constants';
import {
  useForumThread,
  useForumComments,
  useAddComment,
  useUpdateComment,
  useDeleteComment,
  useUpdateThread,
  useDeleteThread,
  useSetThreadPinned,
} from '@/modules/clubs/hooks/useClubForum';
import ForumPoll from './ForumPoll';

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

export default function ForumThreadView({ clubId, threadId, isAdmin, onBack, onDeleted }) {
  const { user } = useAuth();
  const { data: thread, isLoading } = useForumThread(threadId);
  const { data: comments = [], isLoading: loadingComments } = useForumComments(threadId);
  const updateThread = useUpdateThread(clubId);
  const deleteThread = useDeleteThread(clubId);
  const setPinned = useSetThreadPinned(clubId);

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-40 rounded-lg" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar</Button>
        <Card className="rounded-xl"><CardContent className="p-6 text-center text-sm text-slate-500">Tópico não encontrado ou removido.</CardContent></Card>
      </div>
    );
  }

  const isAuthor = thread.author_id === user?.uid;
  const canManage = isAuthor || isAdmin;

  const startEdit = () => {
    setEditTitle(thread.title || '');
    setEditBody(thread.body || '');
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!editTitle.trim()) {
      toast.error('O título não pode ficar vazio.');
      return;
    }
    setSavingEdit(true);
    try {
      await updateThread.mutateAsync({ threadId, updates: { title: editTitle, body: editBody } });
      toast.success('Tópico atualizado.');
      setEditing(false);
    } catch (err) {
      toast.error(err.message || 'Não foi possível salvar.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handlePin = async () => {
    try {
      await setPinned.mutateAsync({ threadId, pinned: !thread.pinned });
      toast.success(thread.pinned ? 'Tópico desafixado.' : 'Tópico fixado.');
    } catch (err) {
      toast.error(err.message || 'Não foi possível fixar.');
    }
  };

  const handleDelete = async () => {
    try {
      await deleteThread.mutateAsync(thread);
      toast.success('Tópico excluído.');
      setConfirmDelete(false);
      onDeleted?.();
    } catch (err) {
      toast.error(err.message || 'Não foi possível excluir.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar aos tópicos
        </Button>
        {canManage && !editing && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9"><MoreVertical className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isAuthor && (
                <DropdownMenuItem onClick={startEdit}><Pencil className="mr-2 h-4 w-4" /> Editar</DropdownMenuItem>
              )}
              {isAdmin && (
                <DropdownMenuItem onClick={handlePin}>
                  {thread.pinned ? <><PinOff className="mr-2 h-4 w-4" /> Desafixar</> : <><Pin className="mr-2 h-4 w-4" /> Fixar no topo</>}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="mr-2 h-4 w-4" /> Excluir tópico
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Tópico */}
      <Card className="rounded-xl">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <UserAvatar name={thread.author_name} photoUrl={thread.author_photo} size="md" />
            <div className="min-w-0 flex-1">
              {editing ? (
                <div className="space-y-3">
                  <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} maxLength={FORUM_LIMITS.TITLE_MAX} placeholder="Título" />
                  <MarkdownEditor value={editBody} onChange={setEditBody} rows={6} maxLength={FORUM_LIMITS.BODY_MAX} />
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditing(false)} disabled={savingEdit}><X className="mr-1.5 h-4 w-4" /> Cancelar</Button>
                    <Button size="sm" onClick={saveEdit} disabled={savingEdit}>{savingEdit ? 'Salvando…' : 'Salvar'}</Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    {thread.pinned && <Badge variant="warning" className="rounded-full"><Pin className="mr-1 h-3 w-3" /> Fixado</Badge>}
                    <h2 className="text-xl font-bold text-slate-900">{thread.title}</h2>
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    {thread.author_name} · {timeAgo(thread.created_at_ms)}{thread.edited ? ' · editado' : ''}
                  </div>
                  {thread.body && <div className="mt-3"><MarkdownContent>{thread.body}</MarkdownContent></div>}
                  {(thread.attachments || []).length > 0 && <AttachmentGallery attachments={thread.attachments} className="mt-3" />}
                  {thread.poll && <div className="mt-4"><ForumPoll thread={thread} /></div>}
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comentários */}
      <div className="flex items-center gap-2 px-1 text-sm font-semibold text-slate-700">
        <MessageSquare className="h-4 w-4 text-emerald-700" />
        {comments.length} comentário(s)
      </div>

      {loadingComments ? (
        <div className="space-y-2">{[1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <ForumComment
              key={comment.id}
              comment={comment}
              clubId={clubId}
              threadId={threadId}
              canModerate={isAdmin}
            />
          ))}
        </div>
      )}

      <CommentComposer thread={thread} clubId={clubId} threadId={threadId} />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Excluir tópico"
        description={`Tem certeza que deseja excluir "${thread.title}"? Os comentários e a enquete também serão removidos.`}
        confirmLabel="Excluir"
        destructive
        loading={deleteThread.isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function ForumComment({ comment, clubId, threadId, canModerate }) {
  const { user } = useAuth();
  const updateComment = useUpdateComment(threadId);
  const deleteComment = useDeleteComment(clubId, threadId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body || '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const isAuthor = comment.author_id === user?.uid;
  const canDelete = isAuthor || canModerate;

  const saveEdit = async () => {
    if (!draft.trim()) {
      toast.error('O comentário não pode ficar vazio.');
      return;
    }
    setBusy(true);
    try {
      await updateComment.mutateAsync({ commentId: comment.id, body: draft });
      setEditing(false);
    } catch (err) {
      toast.error(err.message || 'Não foi possível editar.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      await deleteComment.mutateAsync(comment);
      setConfirmDelete(false);
    } catch (err) {
      toast.error(err.message || 'Não foi possível excluir.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="rounded-xl">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <UserAvatar name={comment.author_name} photoUrl={comment.author_photo} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 text-sm">
                <span className="font-medium text-slate-900">{comment.author_name}</span>
                <span className="ml-2 text-xs text-slate-400">{timeAgo(comment.created_at_ms)}{comment.edited ? ' · editado' : ''}</span>
              </div>
              {(isAuthor || canDelete) && !editing && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-slate-400"><MoreVertical className="h-4 w-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {isAuthor && comment.body && (
                      <DropdownMenuItem onClick={() => { setDraft(comment.body || ''); setEditing(true); }}>
                        <Pencil className="mr-2 h-4 w-4" /> Editar
                      </DropdownMenuItem>
                    )}
                    {canDelete && (
                      <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => setConfirmDelete(true)}>
                        <Trash2 className="mr-2 h-4 w-4" /> Excluir
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {editing ? (
              <div className="mt-2 space-y-2">
                <MarkdownEditor value={draft} onChange={setDraft} rows={3} maxLength={FORUM_LIMITS.COMMENT_MAX} />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditing(false)} disabled={busy}>Cancelar</Button>
                  <Button size="sm" onClick={saveEdit} disabled={busy}>Salvar</Button>
                </div>
              </div>
            ) : (
              <>
                {comment.body && <div className="mt-1"><MarkdownContent>{comment.body}</MarkdownContent></div>}
                {(comment.attachments || []).length > 0 && <AttachmentGallery attachments={comment.attachments} className="mt-2" />}
              </>
            )}
          </div>
        </div>

        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title="Excluir comentário"
          description="Esta ação não pode ser desfeita."
          confirmLabel="Excluir"
          destructive
          loading={busy}
          onConfirm={handleDelete}
        />
      </CardContent>
    </Card>
  );
}

function CommentComposer({ thread, clubId, threadId }) {
  const addComment = useAddComment(clubId, threadId);
  const attachments = useAttachmentUploader({ folder: 'forum', max: FORUM_LIMITS.MAX_ATTACHMENTS });
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = (body.trim() || attachments.items.length > 0) && !submitting && !attachments.uploading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await addComment.mutateAsync({ thread, input: { body, attachments: attachments.items } });
      setBody('');
      attachments.reset();
    } catch (err) {
      toast.error(err.message || 'Não foi possível comentar.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="rounded-xl">
      <CardContent className="space-y-3 p-4">
        <div className="text-sm font-semibold text-slate-700">Adicionar comentário</div>
        <MarkdownEditor value={body} onChange={setBody} rows={3} maxLength={FORUM_LIMITS.COMMENT_MAX} placeholder="Participe da discussão…" />
        <PendingAttachmentList items={attachments.items} onRemove={attachments.remove} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <AttachmentAddButton onFiles={attachments.pick} uploading={attachments.uploading} label="Anexar" />
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            <Send className="mr-1.5 h-4 w-4" /> {submitting ? 'Enviando…' : 'Comentar'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
