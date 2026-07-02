import React, { useEffect, useState } from 'react';
import { BarChart3, MessageSquare, MessagesSquare, Paperclip, Pin, Plus } from 'lucide-react';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useForumThreads } from '@/modules/clubs/hooks/useClubForum';
import CreateThreadDialog from '@/modules/clubs/components/CreateThreadDialog';
import ForumThreadView from '@/modules/clubs/components/ForumThreadView';
import { V2Badge, V2Button, V2EmptyState, V2Skeleton } from '@/v2/ui/primitives';

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

function snippet(body) {
  const text = String(body || '').replace(/[#>*_`~|-]/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > 160 ? `${text.slice(0, 160)}…` : text;
}

export default function V2ClubForums({ clubId, isAdmin, initialThreadId, onThreadChange }) {
  const { data: threads = [], isLoading } = useForumThreads(clubId);
  const [selectedId, setSelectedId] = useState(initialThreadId || null);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (initialThreadId !== undefined && initialThreadId !== selectedId) {
      setSelectedId(initialThreadId || null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialThreadId]);

  const select = (id) => {
    setSelectedId(id);
    onThreadChange?.(id);
  };

  if (selectedId) {
    return (
      <ForumThreadView
        clubId={clubId}
        threadId={selectedId}
        isAdmin={isAdmin}
        onBack={() => select(null)}
        onDeleted={() => select(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-gray-500">Discussões do clube: combine jogos, faça enquetes e compartilhe avisos com formatação rica.</p>
        <V2Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Novo tópico</V2Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <V2Skeleton key={i} className="h-24 rounded-4xl" />)}</div>
      ) : threads.length === 0 ? (
        <V2EmptyState
          icon={MessagesSquare}
          title="Nenhum tópico ainda"
          description="Abra a primeira discussão do clube e convide os membros a participar."
          action={<V2Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Criar tópico</V2Button>}
        />
      ) : (
        <div className="space-y-3">
          {threads.map((thread) => {
            const attachmentsCount = (thread.attachments || []).length;
            return (
              <button
                key={thread.id}
                type="button"
                onClick={() => select(thread.id)}
                className="w-full rounded-4xl border border-gray-100 bg-paper-pure p-4 text-left shadow-organic-sm transition-colors hover:border-ink sm:p-5"
              >
                <div className="flex items-start gap-3">
                  <UserAvatar name={thread.author_name} photoUrl={thread.author_photo} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {thread.pinned && <V2Badge tone="amber"><Pin className="h-3 w-3" /> Fixado</V2Badge>}
                      <h4 className="font-display text-base font-bold text-ink">{thread.title}</h4>
                    </div>
                    <div className="mt-0.5 text-xs text-gray-400">{thread.author_name} · {timeAgo(thread.last_activity_ms || thread.created_at_ms)}</div>
                    {thread.body && <p className="mt-2 line-clamp-2 text-sm text-gray-600">{snippet(thread.body)}</p>}
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                      <span className="inline-flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" /> {thread.comment_count || 0}</span>
                      {thread.poll && <span className="inline-flex items-center gap-1 text-ink"><BarChart3 className="h-3.5 w-3.5" /> Enquete</span>}
                      {attachmentsCount > 0 && <span className="inline-flex items-center gap-1"><Paperclip className="h-3.5 w-3.5" /> {attachmentsCount}</span>}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <CreateThreadDialog clubId={clubId} open={createOpen} onOpenChange={setCreateOpen} onCreated={(id) => select(id)} />
    </div>
  );
}
