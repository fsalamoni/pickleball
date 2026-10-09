/**
 * Comentários de uma sessão do diário: o aluno e o professor com quem ela foi
 * compartilhada conversam sobre o treino. Usado no Diário (dono) e na aba
 * Alunos (professor). Cada um apaga só o que escreveu.
 */
import React, { useState } from 'react';
import { Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useSessionActions, useSessionComments } from '@/modules/training/hooks/useTrainingSessions';
import { V2Button, V2ErrorState, V2Skeleton, V2Textarea } from '@/v2/ui/primitives';

export default function SessionComments({ session, identity }) {
  const q = useSessionComments(session?.id);
  const { comment, deleteComment } = useSessionActions(identity);
  const [texto, setTexto] = useState('');

  const enviar = (e) => {
    e.preventDefault();
    if (!texto.trim()) return;
    comment.mutate({ session, text: texto }, {
      onSuccess: () => setTexto(''),
      onError: (err) => toast.error(err?.message || 'Não foi possível comentar.'),
    });
  };

  return (
    <div className="space-y-3">
      {q.isLoading && <V2Skeleton lines={2} />}
      {q.isError && <V2ErrorState inline title="Os comentários não carregaram" onRetry={() => q.refetch()} />}
      {q.isSuccess && q.data.length > 0 && (
        <ul className="space-y-2">
          {q.data.map((c) => (
            <li key={c.id} className="rounded-2xl bg-paper px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-bold text-ink">{c.uid === identity.uid ? 'Você' : (c.name || 'Professor')}</p>
                {c.uid === identity.uid && (
                  <button
                    type="button"
                    aria-label="Apagar comentário"
                    className="rounded-full p-1 text-gray-400 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
                    onClick={() => deleteComment.mutate({ sessionId: session.id, commentId: c.id }, {
                      onError: () => toast.error('Não foi possível apagar o comentário.'),
                    })}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
              <p className="mt-0.5 whitespace-pre-line text-sm text-gray-700">{c.text}</p>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={enviar} className="flex items-end gap-2">
        <label className="sr-only" htmlFor={`comentario-${session.id}`}>Comentário</label>
        <V2Textarea
          id={`comentario-${session.id}`}
          rows={2}
          maxLength={1000}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escreva um comentário sobre este treino"
          className="flex-1"
        />
        <V2Button type="submit" size="icon" variant="secondary" disabled={!texto.trim() || comment.isPending} aria-label="Enviar comentário">
          <Send className="h-4 w-4" aria-hidden="true" />
        </V2Button>
      </form>
    </div>
  );
}
