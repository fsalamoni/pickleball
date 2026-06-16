import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Check, Search, Users, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useAthletes } from '@/modules/athletes/hooks/useAthletes';
import { toMember } from '@/modules/chat/domain/conversations';

/**
 * Diálogo para iniciar uma nova conversa (direta ou em grupo) ou para chamar
 * mais atletas para um novo grupo a partir de uma conversa existente.
 *
 * Props:
 *  - open, onOpenChange
 *  - onConfirm(people, title): Promise — recebe os atletas escolhidos
 *  - excludeIds: uids a ocultar da lista (ex.: membros já presentes)
 *  - mode: 'new' | 'add'
 *  - busy: desabilita ações enquanto a operação ocorre
 */
export default function NewChatDialog({ open, onOpenChange, onConfirm, excludeIds = [], mode = 'new', busy = false }) {
  const { user } = useAuth();
  const { data: athletes = [], isLoading } = useAthletes();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState({});
  const [title, setTitle] = useState('');

  const exclude = useMemo(() => new Set([user?.uid, ...excludeIds].filter(Boolean)), [user?.uid, excludeIds]);

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return athletes
      .filter((a) => a.id && !exclude.has(a.id))
      .filter((a) => {
        if (!q) return true;
        const haystack = [a.platform_name, a.city, a.state, a.level].filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => String(a.platform_name || '').localeCompare(String(b.platform_name || ''), 'pt-BR'));
  }, [athletes, search, exclude]);

  const selectedList = useMemo(() => Object.values(selected), [selected]);
  const isGroup = selectedList.length > 1 || (mode === 'add' && selectedList.length >= 1);

  const toggle = (athlete) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[athlete.id]) delete next[athlete.id];
      else next[athlete.id] = toMember(athlete);
      return next;
    });
  };

  const reset = () => {
    setSearch('');
    setSelected({});
    setTitle('');
  };

  const handleConfirm = async () => {
    if (selectedList.length === 0) {
      toast.error('Selecione pelo menos um atleta.');
      return;
    }
    try {
      await onConfirm(selectedList, title);
      reset();
    } catch (err) {
      toast.error(err.message || 'Não foi possível iniciar a conversa.');
    }
  };

  const handleOpenChange = (value) => {
    if (!value) reset();
    onOpenChange?.(value);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-emerald-700" />
            {mode === 'add' ? 'Chamar atletas para um novo grupo' : 'Nova conversa'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'add'
              ? 'Os participantes atuais e os atletas selecionados formarão um novo grupo.'
              : 'Selecione um atleta para conversa direta ou vários para criar um grupo.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar atleta por nome, cidade ou nível"
              className="pl-9"
            />
          </div>

          {selectedList.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedList.map((m) => (
                <button
                  key={m.uid}
                  type="button"
                  onClick={() => setSelected((prev) => {
                    const next = { ...prev };
                    delete next[m.uid];
                    return next;
                  })}
                  className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 py-1 pl-1 pr-2 text-xs font-medium text-emerald-900 hover:bg-emerald-200"
                >
                  <UserAvatar name={m.name} photoUrl={m.photo_url} size="xs" />
                  {m.name}
                  <X className="h-3 w-3" />
                </button>
              ))}
            </div>
          )}

          <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-emerald-950/10 p-1">
            {isLoading ? (
              <div className="space-y-2 p-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
              </div>
            ) : candidates.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-slate-500">
                {athletes.length <= 1 ? 'Ainda não há outros atletas no diretório.' : 'Nenhum atleta encontrado para a busca.'}
              </p>
            ) : (
              candidates.map((athlete) => {
                const isChecked = !!selected[athlete.id];
                return (
                  <button
                    key={athlete.id}
                    type="button"
                    onClick={() => toggle(athlete)}
                    className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors ${isChecked ? 'bg-emerald-50' : 'hover:bg-secondary/60'}`}
                  >
                    <UserAvatar name={athlete.platform_name} photoUrl={athlete.photo_url} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-900">{athlete.platform_name}</span>
                      <span className="block truncate text-xs text-slate-500">
                        {[athlete.city, athlete.level].filter(Boolean).join(' · ') || 'Atleta'}
                      </span>
                    </span>
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${isChecked ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300'}`}>
                      {isChecked && <Check className="h-3.5 w-3.5" />}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {isGroup && (
            <div className="space-y-1.5">
              <Label htmlFor="group-title">Nome do grupo (opcional)</Label>
              <Input
                id="group-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={80}
                placeholder="Ex.: Treino de quinta, Dupla do torneio…"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={busy}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={busy || selectedList.length === 0}>
            {busy ? 'Abrindo…' : mode === 'add' ? 'Criar grupo' : selectedList.length > 1 ? 'Criar grupo' : 'Conversar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
