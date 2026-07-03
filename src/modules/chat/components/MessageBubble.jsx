import React, { useState } from 'react';
import { toast } from 'sonner';
import { Check, MoreVertical, Pencil, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/ui/user-avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { AttachmentGallery } from '@/components/ui/attachments';
import { cn } from '@/core/lib/utils';

function formatTime(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Bolha de mensagem do chat. Mostra avatar/nome em grupos, anexos, marcação de
 * editado e ações (editar/excluir) para mensagens do próprio usuário.
 */
export default function MessageBubble({ message, isOwn, showAuthor, onEdit, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.text || '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const startEdit = () => {
    setDraft(message.text || '');
    setEditing(true);
  };

  const saveEdit = async () => {
    const next = draft.trim();
    if (!next) {
      toast.error('A mensagem não pode ficar vazia. Para remover, exclua a mensagem.');
      return;
    }
    if (next === (message.text || '').trim()) {
      setEditing(false);
      return;
    }
    setBusy(true);
    try {
      await onEdit?.(message, next);
      setEditing(false);
    } catch (err) {
      toast.error(err.message || 'Não foi possível editar a mensagem.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      await onDelete?.(message);
      setConfirmDelete(false);
    } catch (err) {
      toast.error(err.message || 'Não foi possível excluir a mensagem.');
    } finally {
      setBusy(false);
    }
  };

  const hasText = !!(message.text && message.text.trim());
  const hasAttachments = (message.attachments || []).length > 0;

  return (
    <div className={cn('flex w-full gap-2', isOwn ? 'flex-row-reverse' : 'flex-row')}>
      {!isOwn && (
        <div className="w-8 shrink-0 self-end">
          {showAuthor && <UserAvatar name={message.sender_name} photoUrl={message.sender_photo} size="sm" />}
        </div>
      )}

      <div className={cn('group relative max-w-[78%] sm:max-w-[70%]', isOwn ? 'items-end' : 'items-start')}>
        {showAuthor && !isOwn && (
          <div className="mb-0.5 pl-1 text-xs font-medium text-green-700">{message.sender_name}</div>
        )}

        <div
          className={cn(
            'rounded-2xl px-3 py-2 text-sm shadow-sm',
            isOwn ? 'rounded-br-sm bg-ink text-white' : 'rounded-bl-sm bg-white text-ink border border-gray-100',
          )}
        >
          {editing ? (
            <div className="space-y-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={2}
                autoFocus
                className="w-full resize-y rounded-md border border-white/40 bg-white/95 px-2 py-1.5 text-sm text-ink outline-none"
              />
              <div className="flex justify-end gap-1.5">
                <Button size="sm" variant="ghost" className={cn('h-7', isOwn && 'text-white hover:bg-white/15 hover:text-white')} onClick={() => setEditing(false)} disabled={busy}>
                  <X className="mr-1 h-3.5 w-3.5" /> Cancelar
                </Button>
                <Button size="sm" className="h-7 bg-white text-green-700 hover:bg-acid/10" onClick={saveEdit} disabled={busy}>
                  <Check className="mr-1 h-3.5 w-3.5" /> Salvar
                </Button>
              </div>
            </div>
          ) : (
            <>
              {hasText && <p className="whitespace-pre-wrap break-words">{message.text}</p>}
              {hasAttachments && (
                <AttachmentGallery
                  attachments={message.attachments}
                  className={cn(hasText && 'mt-2', isOwn && '[&_a]:text-white')}
                />
              )}
              <div className={cn('mt-1 flex items-center justify-end gap-1 text-[10px]', isOwn ? 'text-white/70' : 'text-gray-400')}>
                {message.edited && <span>editada</span>}
                <span>{formatTime(message.created_at_ms)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {isOwn && !editing && (
        <div className="self-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {hasText && (
                <DropdownMenuItem onClick={startEdit}>
                  <Pencil className="mr-2 h-4 w-4" /> Editar
                </DropdownMenuItem>
              )}
              <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="mr-2 h-4 w-4" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Excluir mensagem"
        description="A mensagem será removida para todos os participantes. Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        destructive
        loading={busy}
        onConfirm={handleDelete}
      />
    </div>
  );
}
