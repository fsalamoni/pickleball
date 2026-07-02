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
import V2ForumPoll from './V2ForumPoll';
import { V2Badge, V2Button, V2Skeleton } from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';

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

export default function V2ForumThreadView({ clubId, threadId, isAdmin, onBack, onDeleted }) {
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
        <V2Skeleton className="h-8 w-40 rounded-2xl" />
        <V2Skeleton className="h-48 rounded-4xl" />
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="space-y-3">
        <V2Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar</V2Button>
        <div className="rounded-4xl bg-paper p-6 text-center text-sm text-gray-500">Tópico não encontrado ou removido.</div>
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
        <V2Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Voltar aos tópicos
        </V2Button>
        {canManage && !editing && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-paper hover:text-ink"><MoreVertical className="h-4 w-4" /></button>
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

      <div className="rounded-4xl border border-gray-100 bg-paper-pure p-5 shadow-organic-sm sm:p-6">
        <div className="flex items-start gap-3">
          <UserAvatar name={thread.author_name} photoUrl={thread.author_photo} size="lg" />
          <div className="min-w-0 flex-1">
            {editing ? (
              <div className="space-y-3">
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  maxLength={FORUM_LIMITS.TITLE_MAX}
                  placeholder="Título"
                  className="w-full rounded-2xl border border-gray-200 bg-paper px-4 py-2 text-sm text-ink outline-none placeholder:text-gray-400 focus-visible:ring-4 focus-visible:ring-acid/30"
                />
                <MarkdownEditor value={editBody} onChange={setEditBody} rows={6} maxLength={FORUM_LIMITS.BODY_MAX} />
                <div className="flex justify-end gap-2">
                  <V2Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={savingEdit}><X className="h-3.5 w-3.5" /> Cancelar</V2Button>
                  <V2Button size="sm" onClick={saveEdit} disabled={savingEdit}>{savingEdit ? 'Salvando…' : 'Salvar'}</V2Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  {thread.pinned && <V2Badge tone="amber"><Pin className="h-3 w-3" /> Fixado</V2Badge>}
                  <h2 className="font-display text-2xl font-bold text-ink">{thread.title}</h2>
                </div>
                <div className="mt-0.5 text-xs text-gray-500">
                  {thread.author_name} · {timeAgo(thread.created_at_ms)}{thread.edited ? ' · editado' : ''}
                </div>
                {thread.body && <div className="mt-4"><MarkdownContent>{thread.body}</MarkdownContent></div>}
                {(thread.attachments || []).length > 0 && <AttachmentGallery attachments={thread.attachments} className="mt-4" />}
                {thread.poll && <div className="mt-6"><V2ForumPoll thread={thread} /></div>}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 px-1 font-display text-sm font-bold text-ink">
        <MessageSquare className="h-4 w-4 text-ink" />
        {comments.length} comentário(s)
      </div>

      {loadingComments ? (
        <div className="space-y-2">{[1, 2].map((i) => <V2Skeleton key={i} className="h-20 rounded-4xl" />)}</div>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <ForumComment key={comment.id} comment={comment} clubId={clubId} threadId={threadId} canModerate={isAdmin} />
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
    <div className="rounded-3xl border border-gray-100 bg-paper-pure p-4 shadow-organic-sm">
      <div className="flex items-start gap-3">
        <UserAvatar name={comment.author_name} photoUrl={comment.author_photo} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 text-sm">
              <span className="font-bold text-ink">{comment.author_name}</span>
              <span className="ml-2 text-xs text-gray-400">{timeAgo(comment.created_at_ms)}{comment.edited ? ' · editado' : ''}</span>
            </div>
            {(isAuthor || canDelete) && !editing && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-paper hover:text-ink"><MoreVertical className="h-4 w-4" /></button>
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
            <div className="mt-3 space-y-2">
              <MarkdownEditor value={draft} onChange={setDraft} rows={3} maxLength={FORUM_LIMITS.COMMENT_MAX} />
              <div className="flex justify-end gap-2">
                <V2Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={busy}>Cancelar</V2Button>
                <V2Button size="sm" onClick={saveEdit} disabled={busy}>Salvar</V2Button>
              </div>
            </div>
          ) : (
            <>
              {comment.body && <div className="mt-2"><MarkdownContent>{comment.body}</MarkdownContent></div>}
              {(comment.attachments || []).length > 0 && <AttachmentGallery attachments={comment.attachments} className="mt-3" />}
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
    </div>
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
    <div className="rounded-3xl border border-gray-100 bg-paper p-4 shadow-organic-sm">
      <div className="mb-2 font-display text-sm font-bold text-ink">Adicionar comentário</div>
      <MarkdownEditor value={body} onChange={setBody} rows={3} maxLength={FORUM_LIMITS.COMMENT_MAX} placeholder="Participe da discussão…" />
      <PendingAttachmentList items={attachments.items} onRemove={attachments.remove} />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <AttachmentAddButton onFiles={attachments.pick} uploading={attachments.uploading} label="Anexar" />
        <V2Button size="sm" onClick={handleSubmit} disabled={!canSubmit}>
          <Send className="h-4 w-4" /> {submitting ? 'Enviando…' : 'Comentar'}
        </V2Button>
      </div>
    </div>
  );
}
