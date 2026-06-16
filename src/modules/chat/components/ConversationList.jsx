import React from 'react';
import { Users } from 'lucide-react';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/core/lib/utils';
import { CONVERSATION_TYPE } from '@/modules/chat/domain/constants';
import { conversationTitle, directCounterpart, lastMessagePreview } from '@/modules/chat/domain/conversations';

function timeLabel(ms) {
  if (!ms) return '';
  const diff = Date.now() - ms;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export default function ConversationList({ conversations, isLoading, selectedId, currentUserId, onSelect }) {
  if (isLoading) {
    return (
      <div className="space-y-1 p-2">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Nenhuma conversa"
        description="Inicie uma conversa com atletas da comunidade."
        className="py-10"
      />
    );
  }

  return (
    <div className="space-y-0.5 p-1.5">
      {conversations.map((conversation) => {
        const isGroup = conversation.type === CONVERSATION_TYPE.GROUP;
        const counterpart = directCounterpart(conversation, currentUserId);
        const title = conversationTitle(conversation, currentUserId);
        const isSelected = conversation.id === selectedId;
        const last = conversation.last_message;
        return (
          <button
            key={conversation.id}
            type="button"
            onClick={() => onSelect?.(conversation.id)}
            className={cn(
              'flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors',
              isSelected ? 'bg-emerald-100/80' : 'hover:bg-secondary/60',
            )}
          >
            {isGroup ? (
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-emerald-50">
                <Users className="h-5 w-5" />
              </span>
            ) : (
              <UserAvatar name={counterpart?.name || title} photoUrl={counterpart?.photo_url} size="lg" className="h-11 w-11" />
            )}
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold text-slate-900">{title}</span>
                <span className="shrink-0 text-[11px] text-slate-400">{timeLabel(conversation.last_message_at_ms)}</span>
              </span>
              <span className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                {last?.sender_id === currentUserId && <span className="text-slate-400">Você:</span>}
                <span className="truncate">{lastMessagePreview(conversation)}</span>
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
