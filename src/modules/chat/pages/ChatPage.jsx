import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { MessageCircle, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useConversations, useChatActions } from '@/modules/chat/hooks/useChat';
import { conversationTitle } from '@/modules/chat/domain/conversations';
import ConversationList from '@/modules/chat/components/ConversationList';
import ChatWindow from '@/modules/chat/components/ChatWindow';
import NewChatDialog from '@/modules/chat/components/NewChatDialog';
import { cn } from '@/core/lib/utils';

export default function ChatPage() {
  const { user, isAuthAvailable } = useAuth();
  const { conversations, isLoading } = useConversations();
  const actions = useChatActions();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState(searchParams.get('c') || null);
  const [newOpen, setNewOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const isPreviewMode = import.meta.env.DEV && !isAuthAvailable;

  // Sincroniza a seleção com o parâmetro ?c= da URL (deep-link das notificações).
  useEffect(() => {
    const param = searchParams.get('c');
    if (param && param !== selectedId) setSelectedId(param);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const selectConversation = (id) => {
    setSelectedId(id);
    const next = new URLSearchParams(searchParams);
    if (id) next.set('c', id);
    else next.delete('c');
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
      const id = people.length > 1
        ? await actions.createGroup(people, title)
        : await actions.startDirect(people[0]);
      toast.success('Conversa iniciada.');
      setNewOpen(false);
      selectConversation(id);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      {isPreviewMode && (
        <Card className="rounded-2xl border-amber-300/70 bg-amber-50/85 p-4 text-sm leading-6 text-amber-950">
          Prévia local sem Firebase: o chat não carrega conversas neste ambiente.
        </Card>
      )}

      <Card className="grid h-[calc(100dvh-11rem)] min-h-[30rem] grid-cols-1 overflow-hidden rounded-2xl border-white/80 bg-white/85 lg:grid-cols-[20rem,1fr] xl:grid-cols-[22rem,1fr]">
        {/* Lista de conversas */}
        <aside className={cn('flex min-h-0 flex-col border-r border-emerald-950/10', selectedConversation && 'hidden lg:flex')}>
          <div className="space-y-3 border-b border-emerald-950/10 p-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-900">Conversas</h2>
              <Button size="sm" onClick={() => setNewOpen(true)}>
                <Plus className="mr-1.5 h-4 w-4" /> Nova
              </Button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar conversa"
                className="h-9 pl-9"
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ConversationList
              conversations={filtered}
              isLoading={isLoading}
              selectedId={selectedId}
              currentUserId={user?.uid}
              onSelect={selectConversation}
            />
          </div>
        </aside>

        {/* Janela da conversa */}
        <section className={cn('min-h-0 flex-col', selectedConversation ? 'flex' : 'hidden lg:flex')}>
          {selectedConversation ? (
            <ChatWindow
              conversation={selectedConversation}
              currentUserId={user?.uid}
              onBack={() => selectConversation(null)}
              onClose={() => selectConversation(null)}
              onOpenConversation={selectConversation}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center text-slate-500">
              <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <MessageCircle className="h-8 w-8" />
              </span>
              <h3 className="text-lg font-semibold text-slate-900">Suas conversas</h3>
              <p className="mt-2 max-w-sm text-sm leading-6">
                Selecione uma conversa à esquerda ou inicie uma nova para falar com atletas e grupos da comunidade.
              </p>
              <Button className="mt-5" onClick={() => setNewOpen(true)}>
                <Plus className="mr-1.5 h-4 w-4" /> Nova conversa
              </Button>
            </div>
          )}
        </section>
      </Card>

      <NewChatDialog open={newOpen} onOpenChange={setNewOpen} mode="new" busy={creating} onConfirm={handleCreate} />
    </div>
  );
}
