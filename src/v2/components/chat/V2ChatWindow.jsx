import React, { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Info,
  LogOut,
  MessagesSquare,
  MoreVertical,
  Pencil,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { UserAvatar } from '@/components/ui/user-avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { CONVERSATION_TYPE } from '@/modules/chat/domain/constants';
import { conversationTitle, directCounterpart } from '@/modules/chat/domain/conversations';
import { useMessages, useChatActions } from '@/modules/chat/hooks/useChat';
import NewChatDialog from '@/modules/chat/components/NewChatDialog';
import { V2Button, V2Skeleton } from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';
import V2MessageBubble from './V2MessageBubble';
import V2ChatComposer from './V2ChatComposer';

function dayLabel(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  if (sameDay(d, today)) return 'Hoje';
  if (sameDay(d, yesterday)) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
}

export default function V2ChatWindow({ conversation, currentUserId, onBack, onClose, onOpenConversation }) {
  const { messages, isLoading } = useMessages(conversation?.id);
  const actions = useChatActions();
  const scrollRef = useRef(null);
  const [addOpen, setAddOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [busy, setBusy] = useState(false);

  const isGroup = conversation?.type === CONVERSATION_TYPE.GROUP;
  const title = conversation ? conversationTitle(conversation, currentUserId) : '';
  const counterpart = conversation ? directCounterpart(conversation, currentUserId) : null;
  const memberCount = conversation?.member_ids?.length || 0;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, conversation?.id]);

  const rendered = useMemo(() => {
    const out = [];
    let lastDay = null;
    let lastSender = null;
    messages.forEach((m) => {
      const day = dayLabel(m.created_at_ms);
      if (day !== lastDay) {
        out.push({ type: 'day', id: `day-${m.id}`, label: day });
        lastDay = day;
        lastSender = null;
      }
      out.push({ type: 'message', id: m.id, message: m, showAuthor: isGroup && m.sender_id !== lastSender });
      lastSender = m.sender_id;
    });
    return out;
  }, [messages, isGroup]);

  const handleSend = (payload) => actions.send(conversation, payload);

  const handleAddPeople = async (people) => {
    setBusy(true);
    try {
      const newId = await actions.startGroupFrom(conversation, people);
      toast.success('Novo grupo criado.');
      setAddOpen(false);
      if (newId && newId !== conversation.id) onOpenConversation?.(newId);
    } finally {
      setBusy(false);
    }
  };

  const handleRename = async () => {
    setBusy(true);
    try {
      await actions.rename(conversation.id, renameValue);
      toast.success('Grupo renomeado.');
      setRenameOpen(false);
    } catch (err) {
      toast.error(err.message || 'Não foi possível renomear.');
    } finally {
      setBusy(false);
    }
  };

  const handleLeaveOrDelete = async () => {
    setBusy(true);
    try {
      if (isGroup) {
        await actions.leave(conversation);
        toast.success('Você saiu do grupo.');
      } else {
        await actions.hide(conversation);
        toast.success('Conversa excluída.');
      }
      setConfirmLeave(false);
      onClose?.();
    } catch (err) {
      toast.error(err.message || 'Não foi possível concluir a ação.');
    } finally {
      setBusy(false);
    }
  };

  if (!conversation) return null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-gray-100 bg-paper-pure px-3 py-2.5">
        {onBack && (
          <button className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-paper hover:text-ink lg:hidden" onClick={onBack} aria-label="Voltar">
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        {isGroup ? (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-acid">
            <Users className="h-5 w-5" />
          </span>
        ) : (
          <UserAvatar name={counterpart?.name || title} photoUrl={counterpart?.photo_url} size="md" />
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-ink">{title}</div>
          <div className="truncate text-xs text-gray-500">{isGroup ? `${memberCount} participantes` : 'Conversa direta'}</div>
        </div>

        <V2Button variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={() => setAddOpen(true)}>
          <UserPlus className="h-4 w-4" /> Chamar atletas
        </V2Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-paper hover:text-ink">
              <MoreVertical className="h-5 w-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => setAddOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" /> Chamar atletas
            </DropdownMenuItem>
            {isGroup && (
              <DropdownMenuItem onClick={() => { setRenameValue(conversation.title || ''); setRenameOpen(true); }}>
                <Pencil className="mr-2 h-4 w-4" /> Renomear grupo
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => setConfirmLeave(true)}>
              {isGroup ? <><LogOut className="mr-2 h-4 w-4" /> Sair do grupo</> : <><Trash2 className="mr-2 h-4 w-4" /> Excluir conversa</>}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-1.5 overflow-y-auto bg-paper px-3 py-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <V2Skeleton key={i} className={`h-12 max-w-[60%] rounded-2xl ${i % 2 ? '' : 'ml-auto'}`} />)}
          </div>
        ) : rendered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-gray-500">
            <MessagesSquare className="mb-3 h-10 w-10 text-gray-300" />
            <p className="text-sm">Nenhuma mensagem ainda. Diga olá! 👋</p>
          </div>
        ) : (
          rendered.map((item) =>
            item.type === 'day' ? (
              <div key={item.id} className="my-3 flex justify-center">
                <span className="rounded-full border border-gray-100 bg-paper-pure px-3 py-1 text-[11px] font-medium text-gray-500 shadow-organic-sm">{item.label}</span>
              </div>
            ) : (
              <V2MessageBubble
                key={item.id}
                message={item.message}
                isOwn={item.message.sender_id === currentUserId}
                showAuthor={item.showAuthor}
                onEdit={actions.edit}
                onDelete={actions.remove}
              />
            ),
          )
        )}
      </div>

      <V2ChatComposer onSend={handleSend} />

      {/* Chamar atletas → novo grupo */}
      <NewChatDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        mode="add"
        excludeIds={conversation.member_ids || []}
        busy={busy}
        onConfirm={handleAddPeople}
      />

      {/* Renomear grupo */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Info className="h-5 w-5 text-ink" /> Renomear grupo</DialogTitle>
            <DialogDescription>Escolha um nome para identificar o grupo.</DialogDescription>
          </DialogHeader>
          <input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            maxLength={80}
            placeholder="Nome do grupo"
            className="w-full rounded-2xl border border-gray-200 bg-paper px-4 py-2.5 text-sm text-ink outline-none placeholder:text-gray-400 focus-visible:ring-4 focus-visible:ring-acid/30"
          />
          <DialogFooter>
            <V2Button variant="ghost" onClick={() => setRenameOpen(false)} disabled={busy}>Cancelar</V2Button>
            <V2Button onClick={handleRename} disabled={busy}>Salvar</V2Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmLeave}
        onOpenChange={setConfirmLeave}
        title={isGroup ? 'Sair do grupo' : 'Excluir conversa'}
        description={isGroup
          ? 'Você deixará de receber as mensagens deste grupo. Esta ação pode ser desfeita apenas sendo chamado novamente.'
          : 'A conversa será removida da sua lista. Ela reaparece se você receber uma nova mensagem.'}
        confirmLabel={isGroup ? 'Sair' : 'Excluir'}
        destructive
        loading={busy}
        onConfirm={handleLeaveOrDelete}
      />
    </div>
  );
}
