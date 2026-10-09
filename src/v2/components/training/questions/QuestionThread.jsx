/**
 * Uma dúvida aberta: a conversa (com rolagem própria), responder, encerrar ou
 * reabrir e — para quem perguntou — apagar. O texto vem do banco e é sempre
 * mostrado como TEXTO (nada de HTML).
 */
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, BookOpen, Lock, RotateCcw, Send, Trash2 } from 'lucide-react';
import { cn } from '@/core/lib/utils';
import { useQuestionActions, useQuestionMessages } from '@/modules/training/hooks/useTrainingQuestions';
import { MESSAGE_MAX, QUESTION_STATUS, QUESTION_STATUS_LABELS } from '@/modules/training/domain/question';
import {
  V2Badge, V2Button, V2ErrorState, V2Skeleton, V2Surface, V2Textarea,
} from '@/v2/ui/primitives';
import { ConfirmDialog, mensagemDeErro } from '@/v2/components/training/item/ItemActionDialogs';
import { esperaPorMim, outroLado, quandoFoi, souProfessorDa } from './questionsView';

export default function QuestionThread({ question, identity, onVoltar }) {
  const msgs = useQuestionMessages(question.id);
  const acoes = useQuestionActions(identity);
  const [texto, setTexto] = useState('');
  const [apagar, setApagar] = useState(false);
  const logRef = useRef(null);
  const encerrada = question.status === QUESTION_STATUS.ENCERRADA;
  const professor = souProfessorDa(question, identity.uid);

  // Rola só a caixa da conversa (nunca `scrollIntoView`, que desloca o app inteiro).
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs.data?.length]);

  const enviar = (e) => {
    e.preventDefault();
    if (!texto.trim()) return;
    acoes.send.mutate({ question, text: texto }, {
      onSuccess: () => { setTexto(''); msgs.refetch(); },
      onError: (err) => toast.error(mensagemDeErro(err, 'Não foi possível enviar agora.')),
    });
  };
  const encerrar = (closed) => acoes.close.mutate({ question, closed }, {
    onSuccess: () => toast.success(closed ? 'Conversa encerrada.' : 'Conversa reaberta.'),
    onError: (err) => toast.error(mensagemDeErro(err, 'Não foi possível mudar agora.')),
  });

  return (
    <div className="space-y-4">
      <button type="button" onClick={onVoltar} className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Dúvidas
      </button>
      <V2Surface className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
              {professor ? `Dúvida de ${outroLado(question, identity.uid)}` : `Com ${outroLado(question, identity.uid)}`}
            </p>
            <h2 className="mt-1 font-display text-xl font-bold text-ink">{question.subject}</h2>
            {question.item_id && (
              <Link to={`/treino/item/${question.item_id}`} className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-ink underline underline-offset-4">
                <BookOpen className="h-4 w-4" aria-hidden="true" /> {question.item_title || 'Item citado'}
              </Link>
            )}
          </div>
          <V2Badge tone={esperaPorMim(question, identity.uid) ? 'acid' : encerrada ? 'neutral' : 'blue'}>
            {esperaPorMim(question, identity.uid) ? (professor ? 'Esperando a sua resposta' : 'Nova resposta') : QUESTION_STATUS_LABELS[question.status]}
          </V2Badge>
        </div>

        <div ref={logRef} className="max-h-[55vh] space-y-3 overflow-y-auto rounded-3xl bg-gray-50 p-3" aria-label="Conversa" role="log">
          {msgs.isPending && <V2Skeleton lines={3} />}
          {msgs.isError && <V2ErrorState inline title="A conversa não carregou" onRetry={() => msgs.refetch()} />}
          {msgs.isSuccess && msgs.data.map((m) => {
            const meu = m.uid === identity.uid;
            return (
              <div key={m.id} className={cn('flex', meu ? 'justify-end' : 'justify-start')}>
                <div className={cn('max-w-[85%] rounded-3xl px-4 py-2.5', meu ? 'bg-ink text-paper-pure' : 'bg-paper-pure text-ink')}>
                  <p className={cn('text-xs font-bold', meu ? 'text-paper-pure/70' : 'text-gray-500')}>
                    {meu ? 'Você' : (m.name || outroLado(question, identity.uid))}
                    {quandoFoi(m.created_at) ? ` · ${quandoFoi(m.created_at)}` : ''}
                  </p>
                  <p className="mt-0.5 whitespace-pre-line break-words text-sm">{m.text}</p>
                </div>
              </div>
            );
          })}
        </div>

        {encerrada ? (
          <p className="flex items-center gap-2 text-sm text-gray-500"><Lock className="h-4 w-4" aria-hidden="true" /> Conversa encerrada. Reabra para escrever de novo.</p>
        ) : (
          <form onSubmit={enviar} className="space-y-2">
            <label htmlFor={`resposta-${question.id}`} className="sr-only">{professor ? 'Sua resposta' : 'Sua mensagem'}</label>
            <V2Textarea
              id={`resposta-${question.id}`}
              rows={3}
              maxLength={MESSAGE_MAX}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder={professor ? 'Escreva a sua resposta' : 'Escreva para o professor'}
            />
            <div className="flex justify-end">
              <V2Button type="submit" size="sm" disabled={!texto.trim() || acoes.send.isPending}>
                <Send className="h-4 w-4" aria-hidden="true" /> {acoes.send.isPending ? 'Enviando…' : 'Enviar'}
              </V2Button>
            </div>
          </form>
        )}

        <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-3">
          {encerrada ? (
            <V2Button size="sm" variant="ghost" onClick={() => encerrar(false)} disabled={acoes.close.isPending}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" /> Reabrir
            </V2Button>
          ) : (
            <V2Button size="sm" variant="ghost" onClick={() => encerrar(true)} disabled={acoes.close.isPending}>
              <Lock className="h-4 w-4" aria-hidden="true" /> Encerrar a conversa
            </V2Button>
          )}
          {!professor && (
            <V2Button size="sm" variant="ghost" onClick={() => setApagar(true)}>
              <Trash2 className="h-4 w-4" aria-hidden="true" /> Apagar
            </V2Button>
          )}
        </div>
      </V2Surface>

      <ConfirmDialog
        open={apagar}
        onOpenChange={setApagar}
        title="Apagar esta dúvida?"
        description="A conversa some para você e para o professor."
        confirmLabel="Apagar"
        pending={acoes.remove.isPending}
        onConfirm={() => acoes.remove.mutate(question, {
          onSuccess: () => { toast.success('Dúvida apagada.'); setApagar(false); onVoltar(); },
          onError: (err) => toast.error(mensagemDeErro(err, 'Não foi possível apagar agora.')),
        })}
      />
    </div>
  );
}
