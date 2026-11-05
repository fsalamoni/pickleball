import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Users } from 'lucide-react';
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
import PersonPicker from '@/v2/components/people/PersonPicker';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useAthletes } from '@/modules/athletes/hooks/useAthletes';
import { toMember } from '@/modules/chat/domain/conversations';
import { t } from '@/core/i18n';

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
  const { data: athletes = [], isLoading, isError, refetch } = useAthletes();
  const [selected, setSelected] = useState({});
  const [title, setTitle] = useState('');

  const exclude = useMemo(() => new Set([user?.uid, ...excludeIds].filter(Boolean)), [user?.uid, excludeIds]);

  const selectedList = useMemo(() => Object.values(selected), [selected]);
  const isGroup = selectedList.length > 1 || (mode === 'add' && selectedList.length >= 1);

  const reset = () => {
    setSelected({});
    setTitle('');
  };

  const handleConfirm = async () => {
    if (selectedList.length === 0) {
      toast.error(t('Selecione pelo menos um atleta.'));
      return;
    }
    try {
      await onConfirm(selectedList, title);
      reset();
    } catch (err) {
      toast.error(err.message || t('Não foi possível iniciar a conversa.'));
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
            <Users className="h-5 w-5 text-ink" />
            {mode === 'add' ? t('Chamar atletas para um novo grupo') : t('Nova conversa')}
          </DialogTitle>
          <DialogDescription>
            {mode === 'add'
              ? t('Os participantes atuais e os atletas selecionados formarão um novo grupo.')
              : t('Selecione um atleta para conversa direta ou vários para criar um grupo.')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <PersonPicker
            multiple
            pessoas={athletes}
            carregando={isLoading}
            falhou={isError}
            onRetry={() => refetch()}
            ocultar={exclude}
            selecionados={selectedList}
            onChange={(lista) => setSelected(Object.fromEntries(lista.map((p) => {
              const m = p.platform_name !== undefined ? toMember(p) : p;
              return [m.uid, m];
            })))}
            detalhe={(a) => [a.city, a.level].filter(Boolean).join(' · ')}
            vazio={athletes.length <= 1 ? t('Ainda não há outros atletas no diretório.') : t('Nenhum atleta encontrado para a busca.')}
            rotulo={t('Atletas do diretório')}
          />

          {isGroup && (
            <div className="space-y-1.5">
              <Label htmlFor="group-title">{t('Nome do grupo (opcional)')}</Label>
              <Input
                id="group-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={80}
                placeholder={t('Ex.: Treino de quinta, Dupla do torneio…')}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={busy}>{t('Cancelar')}</Button>
          <Button onClick={handleConfirm} disabled={busy || selectedList.length === 0}>
            {busy ? t('Abrindo…') : mode === 'add' ? t('Criar grupo') : selectedList.length > 1 ? t('Criar grupo') : t('Conversar')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
