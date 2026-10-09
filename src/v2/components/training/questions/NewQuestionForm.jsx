/**
 * Nova dúvida para um professor (vínculo ATIVO — a regra confere). O nome do
 * professor vem do perfil (`usePeople`): o vínculo não guarda o nome dele.
 * Com `itemId`, a dúvida já cita o item.
 */
import React, { useState } from 'react';
import { toast } from 'sonner';
import { BookOpen } from 'lucide-react';
import { useQuestionActions } from '@/modules/training/hooks/useTrainingQuestions';
import { useTrainingItem } from '@/modules/training/hooks/useTrainingItems';
import { usePeople } from '@/modules/progression/hooks/usePeople';
import { MESSAGE_MAX, QUESTION_SUBJECT_MAX, normalizeQuestion } from '@/modules/training/domain/question';
import {
  V2Button, V2Field, V2Input, V2Select, V2Textarea,
} from '@/v2/ui/primitives';
import { mensagemDeErro } from '@/v2/components/training/item/ItemActionDialogs';

export default function NewQuestionForm({ identity, itemId = null, onCriada, onCancelar }) {
  const acoes = useQuestionActions(identity);
  const { people } = usePeople(identity.activeCoachIds);
  const item = useTrainingItem(itemId);
  const citado = itemId ? item.data?.item : null;
  const [f, setF] = useState(() => ({
    coach_uid: identity.activeCoachIds.length === 1 ? identity.activeCoachIds[0] : '',
    subject: '',
    text: '',
  }));
  const [erro, setErro] = useState('');
  const set = (patch) => { setErro(''); setF((x) => ({ ...x, ...patch })); };
  const nome = (uid) => people.get(uid)?.name || 'Professor';

  const enviar = (e) => {
    e.preventDefault();
    const input = {
      ...f,
      coach_name: f.coach_uid ? nome(f.coach_uid) : '',
      item_id: itemId || null,
      item_title: citado?.title || '',
    };
    const { valid, error } = normalizeQuestion(input);
    if (!valid) { setErro(error); return; }
    acoes.create.mutate(input, {
      onSuccess: (id) => { toast.success('Dúvida enviada. O professor é avisado.'); onCriada(id); },
      onError: (err) => setErro(mensagemDeErro(err, 'Não foi possível enviar agora.')),
    });
  };

  return (
    <form onSubmit={enviar} className="space-y-4" noValidate>
      {itemId && (
        <p className="flex items-center gap-2 rounded-2xl bg-gray-50 px-3 py-2 text-sm text-gray-600">
          <BookOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Sobre: <span className="font-semibold text-ink">{citado?.title || (item.isPending ? 'carregando…' : 'o item citado')}</span></span>
        </p>
      )}
      <V2Field label="Professor" htmlFor="duvida-prof" required>
        <V2Select id="duvida-prof" value={f.coach_uid} onChange={(e) => set({ coach_uid: e.target.value })}>
          {identity.activeCoachIds.length !== 1 && <option value="">Escolha o professor</option>}
          {identity.activeCoachIds.map((uid) => <option key={uid} value={uid}>{nome(uid)}</option>)}
        </V2Select>
      </V2Field>
      <V2Field label="Assunto" htmlFor="duvida-assunto" required>
        <V2Input id="duvida-assunto" maxLength={QUESTION_SUBJECT_MAX} value={f.subject} onChange={(e) => set({ subject: e.target.value })} placeholder="Ex.: Meu dink está subindo demais" />
      </V2Field>
      <V2Field label="Sua dúvida" htmlFor="duvida-texto" required hint="Só você e o professor veem esta conversa.">
        <V2Textarea id="duvida-texto" rows={4} maxLength={MESSAGE_MAX} value={f.text} onChange={(e) => set({ text: e.target.value })} />
      </V2Field>
      {erro && <p role="alert" className="text-sm font-medium text-red-600">{erro}</p>}
      <div className="flex justify-end gap-2">
        <V2Button type="button" variant="ghost" onClick={onCancelar}>Cancelar</V2Button>
        <V2Button type="submit" disabled={acoes.create.isPending}>{acoes.create.isPending ? 'Enviando…' : 'Enviar dúvida'}</V2Button>
      </div>
    </form>
  );
}
