import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { MessageCircle, Plus, Search } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useConversations, useChatActions } from '@/modules/chat/hooks/useChat';
import { conversationTitle } from '@/modules/chat/domain/conversations';
import V2ConversationList from '@/v2/components/chat/V2ConversationList';
import V2ChatWindow from '@/v2/components/chat/V2ChatWindow';
import NewChatDialog from '@/modules/chat/components/NewChatDialog';
import { V2Button } from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';

export default function V2Chat() {
  const { user } = useAuth();
  const { conversations, isLoading } = useConversations();
  const actions = useChatActions();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState(searchParams.get('c') || null);
  const [newOpen, setNewOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const param = searchParams.get('c');
    if (param && param !== selectedId) setSelectedId(param);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const selectConversation = (id) => {
    setSelectedId(id);
    const next = new URLSearchParams(searchParams);
    if (id) next.set('c', id); else next.delete('c');
    setSearchParams(next, { replace: true });
  };

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === selectedId) || null,
    [conversations, selectedId],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => {
      const title = conversationTitle(c, user?.uid).toLowerCase();
      const lastText = (c.last_message?.text || '').toLowerCase();
      return title.includes(q) || lastText.includes(q);
    });
  }, [conversations, search, user?.uid]);

  const handleCreate = async (people, title) => {
    setCreating(true);
    try {
      const id = people.length > 1 ? await actions.createGroup(people, title) : await actions.startDirect(people[0]);
      toast.success('Conversa iniciada.');
      setNewOpen(false);
      selectConversation(id);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1200px]">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl">Mensagens</h1>
        <p className="mt-2 font-medium text-gray-500">Converse com atletas e grupos da comunidade em tempo real.</p>
      </div>

      <div className="grid h-[calc(100dvh-14rem)] min-h-[30rem] grid-cols-1 overflow-hidden rounded-4xl border border-gray-100 bg-paper-pure shadow-organic-sm lg:grid-cols-[20rem,1fr] xl:grid-cols-[22rem,1fr]">
        <aside className={cn('flex min-h-0 flex-col border-r border-gray-100', selectedConversation && 'hidden lg:flex')}>
          <div className="space-y-3 border-b border-gray-100 p-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-base font-bold text-ink">Conversas</h2>
              <V2Button size="sm" onClick={() => setNewOpen(true)}><Plus className="h-4 w-4" /> Nova</V2Button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar conversa"
                className="h-9 w-full rounded-full border border-gray-200 bg-paper-pure pl-9 pr-3 text-sm text-ink focus:border-gray-300 focus:ring-4 focus:ring-gray-100" />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <V2ConversationList
              conversations={filtered}
              isLoading={isLoading}
              selectedId={selectedId}
              currentUserId={user?.uid}
              onSelect={selectConversation}
            />
          </div>
        </aside>

        <section className={cn('min-h-0 flex-col', selectedConversation ? 'flex' : 'hidden lg:flex')}>
          {selectedConversation ? (
            <V2ChatWindow
              conversation={selectedConversation}
              currentUserId={user?.uid}
              onBack={() => selectConversation(null)}
              onClose={() => selectConversation(null)}
              onOpenConversation={selectConversation}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center text-gray-500">
              <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-acid/15 text-ink"><MessageCircle className="h-8 w-8" /></span>
              <h3 className="font-display text-lg font-bold text-ink">Suas conversas</h3>
              <p className="mt-2 max-w-sm text-sm leading-6">Selecione uma conversa à esquerda ou inicie uma nova para falar com atletas e grupos.</p>
              <V2Button className="mt-5" onClick={() => setNewOpen(true)}><Plus className="h-4 w-4" /> Nova conversa</V2Button>
            </div>
          )}
        </section>
      </div>

      <NewChatDialog open={newOpen} onOpenChange={setNewOpen} mode="new" busy={creating} onConfirm={handleCreate} />
    </div>
  );
}
