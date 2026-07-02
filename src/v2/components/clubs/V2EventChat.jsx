import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Send } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import V2MessageBubble from '@/v2/components/chat/V2MessageBubble';
import {
  useEventMessages,
  useSendEventMessage,
  useUpdateEventMessage,
  useDeleteEventMessage,
} from '@/modules/clubs/hooks/useClubs';
import { V2Button, V2Skeleton } from '@/v2/ui/primitives';

function dayLabel(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default function V2EventChat({ eventId }) {
  const { user } = useAuth();
  const { data: messages = [], isLoading } = useEventMessages(eventId);
  const send = useSendEventMessage(eventId);
  const update = useUpdateEventMessage(eventId);
  const remove = useDeleteEventMessage(eventId);
  const [draft, setDraft] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  const handleSend = async (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    try {
      await send.mutateAsync(text);
    } catch (err) {
      setDraft(text);
      toast.error(err.message || 'Não foi possível enviar a mensagem.');
    }
  };

  const handleEdit = (message, text) => update.mutateAsync({ messageId: message.id, text });
  const handleDelete = (message) => remove.mutateAsync(message.id);

  return (
    <div className="flex h-[60vh] flex-col overflow-hidden rounded-4xl border border-gray-100 bg-paper">
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {isLoading ? (
          <div className="space-y-3">{[1, 2, 3].map((i) => <V2Skeleton key={i} className="h-12 w-2/3 rounded-2xl" />)}</div>
        ) : messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">Nenhuma mensagem ainda. Comece a conversa com os participantes.</p>
        ) : (
          messages.map((m, i) => {
            const prev = messages[i - 1];
            const isOwn = m.sender_id === user?.uid;
            const showAuthor = !prev || prev.sender_id !== m.sender_id;
            const showDay = !prev || dayLabel(prev.created_at_ms) !== dayLabel(m.created_at_ms);
            return (
              <React.Fragment key={m.id}>
                {showDay && (
                  <div className="my-2 text-center">
                    <span className="rounded-full border border-gray-100 bg-paper-pure px-3 py-1 text-[11px] font-medium text-gray-500 shadow-organic-sm">
                      {dayLabel(m.created_at_ms)}
                    </span>
                  </div>
                )}
                <V2MessageBubble message={m} isOwn={isOwn} showAuthor={showAuthor} onEdit={handleEdit} onDelete={handleDelete} />
              </React.Fragment>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSend} className="flex items-end gap-2 border-t border-gray-100 bg-paper-pure p-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend(e);
            }
          }}
          rows={1}
          placeholder="Escreva uma mensagem…"
          className="max-h-32 flex-1 resize-none rounded-2xl border border-gray-200 bg-paper px-4 py-2.5 text-sm text-ink outline-none placeholder:text-gray-400 focus-visible:ring-4 focus-visible:ring-acid/30"
        />
        <V2Button type="submit" size="icon" disabled={send.isPending || !draft.trim()}>
          <Send className="h-4 w-4" />
        </V2Button>
      </form>
    </div>
  );
}
