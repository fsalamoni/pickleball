/**
 * MERCADO — perguntas do anúncio. Públicas: quem compra lê o que os outros já
 * perguntaram antes de perguntar de novo. Quem vende responde ali mesmo; quem
 * perguntou vê a própria pergunta "aguardando resposta" (as abertas dos
 * outros não aparecem — pergunta sem resposta não ajuda quem lê).
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircleQuestion } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { askQuestion, answerQuestion } from '@/modules/marketplace/services/marketService';
import { validateAnswer, validateQuestion } from '@/modules/marketplace/domain/settings';
import { TEXT_LIMITS } from '@/modules/marketplace/domain/constants';
import { marketKeys, useQuestions } from '@/modules/marketplace/hooks/useMarket';
import { V2Button, V2ErrorState, V2Skeleton, V2Textarea } from '@/v2/ui/primitives';
import { t, fmtData } from '@/core/i18n';

const quando = (ms) => (ms ? fmtData(ms, { day: '2-digit', month: 'short' }) : '');

function AnswerForm({ question, onDone }) {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  const enviar = async (e) => {
    e.preventDefault();
    const r = validateAnswer(text);
    if (r.error) { setErro(r.error); return; }
    setBusy(true);
    try {
      await answerQuestion(question, { uid: user.uid, text: r.value });
      toast.success(t('Resposta publicada.'));
      onDone();
    } catch (err) {
      setErro(err.message || t('Não foi possível responder.'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={enviar} className="mt-2 space-y-2">
      <label htmlFor={`resp-${question.id}`} className="sr-only">{t('Sua resposta')}</label>
      <V2Textarea id={`resp-${question.id}`} rows={2} value={text} maxLength={TEXT_LIMITS.answer} onChange={(e) => { setText(e.target.value); setErro(''); }} placeholder={t('Responda para todos verem')} />
      {erro && <p className="text-xs font-medium text-red-500">{erro}</p>}
      <V2Button type="submit" size="sm" disabled={busy}>{busy ? t('Publicando…') : t('Responder')}</V2Button>
    </form>
  );
}

/**
 * @param {{ listing: object, isOperator: boolean }} p
 */
export default function ListingQuestions({ listing, isOperator }) {
  const { user, userProfile } = useAuth();
  const qc = useQueryClient();
  const q = useQuestions(listing.id);
  const [text, setText] = useState('');
  const [erro, setErro] = useState('');
  const [busy, setBusy] = useState(false);
  const refazer = () => qc.invalidateQueries({ queryKey: marketKeys.questions(listing.id) });

  const todas = q.data || [];
  const visiveis = todas.filter((x) => x.status === 'answered' || isOperator || x.asker_uid === user?.uid);

  const perguntar = async (e) => {
    e.preventDefault();
    const r = validateQuestion(text);
    if (r.error) { setErro(r.error); return; }
    setBusy(true);
    try {
      await askQuestion({ listing, uid: user.uid, name: userProfile?.platform_name || user.displayName, text: r.value });
      setText('');
      toast.success(t('Pergunta enviada. Você recebe um aviso quando o vendedor responder.'));
      refazer();
    } catch (err) {
      setErro(err.message || t('Não foi possível enviar a pergunta.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="perguntas-titulo" className="space-y-4">
      <h2 id="perguntas-titulo" className="font-display text-xl font-bold text-ink">{t('Perguntas ao vendedor')}</h2>

      {!isOperator && (user ? (
        <form onSubmit={perguntar} className="space-y-2">
          <label htmlFor="nova-pergunta" className="sr-only">{t('Sua pergunta')}</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <V2Textarea
              id="nova-pergunta"
              rows={2}
              value={text}
              maxLength={TEXT_LIMITS.question}
              onChange={(e) => { setText(e.target.value); setErro(''); }}
              placeholder={t('Pergunte sobre tamanho, estado, entrega…')}
              className="min-h-0 flex-1"
            />
            <V2Button type="submit" disabled={busy} className="sm:self-end">{busy ? t('Enviando…') : t('Perguntar')}</V2Button>
          </div>
          {erro ? <p className="text-xs font-medium text-red-500">{erro}</p>
            : <p className="text-xs text-gray-500">{t('A pergunta é pública. Não coloque telefone, e-mail nem chave Pix.')}</p>}
        </form>
      ) : (
        <p className="text-sm text-gray-500"><Link to="/login" className="font-bold text-ink underline">{t('Entre')}</Link> {t('para perguntar ao vendedor.')}</p>
      ))}

      {q.isError && <V2ErrorState inline onRetry={() => q.refetch()} />}
      {q.isLoading && <V2Skeleton lines={3} />}
      {q.isSuccess && !visiveis.length && (
        <p className="flex items-center gap-2 text-sm text-gray-500"><MessageCircleQuestion className="h-4 w-4" /> {t('Ninguém perguntou ainda. Seja o primeiro.')}</p>
      )}
      {visiveis.length > 0 && (
        <ul className="divide-y divide-gray-100">
          {visiveis.map((x) => (
            <li key={x.id} className="py-3">
              <p className="text-sm font-medium text-ink">{x.text}</p>
              {x.status === 'answered' ? (
                <p className="mt-1 border-l-2 border-acid pl-3 text-sm text-gray-600">{x.answer} <span className="text-xs text-gray-500">· {quando(x.answered_at?.toMillis?.() || x.created_at_ms)}</span></p>
              ) : isOperator ? (
                <AnswerForm question={x} onDone={refazer} />
              ) : (
                <p className="mt-1 text-xs font-medium text-amber-700">{t('Aguardando resposta do vendedor')}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
