import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Star, MessageSquareWarning, Lightbulb, Trash2, Reply, Edit3, X } from 'lucide-react';
import { cn } from '@/core/lib/utils';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import ConfirmDialog from '@/components/ConfirmDialog';
import { UserAvatar } from '@/components/ui/user-avatar';
import { REVIEW_TYPE, REVIEW_TYPE_LABELS } from '@/modules/arenas/domain/constants';
import { aggregateRatings } from '@/modules/arenas/domain/arena';
import { normalizeReviewResponse, hasResponse, responseAgeHours } from '@/modules/arenas/domain/review_response';
import { useArenaReviews, useAddReview, useDeleteReview, useRespondToReview, useDeleteReviewResponse } from '@/modules/arenas/hooks/useArenas';
import { V2Badge, V2Button, V2Surface } from '@/v2/ui/primitives';

const TYPE_ICON = {
  [REVIEW_TYPE.REVIEW]: Star,
  [REVIEW_TYPE.COMPLAINT]: MessageSquareWarning,
  [REVIEW_TYPE.SUGGESTION]: Lightbulb,
};

function StarPicker({ value, onChange }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)} aria-label={`${n} estrela(s)`} className="p-0.5">
          <Star className={cn('h-6 w-6', n <= value ? 'fill-amber-400 text-amber-400' : 'text-gray-300')} />
        </button>
      ))}
    </div>
  );
}

export default function V2ArenaReviews({ arena, canModerate = false }) {
  const { user, isAuthenticated } = useAuth();
  const { data: reviews = [], isLoading } = useArenaReviews(arena.id);
  const addReview = useAddReview();
  const deleteReview = useDeleteReview();
  const [type, setType] = useState(REVIEW_TYPE.REVIEW);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [respondingTo, setRespondingTo] = useState(null); // review.id ou null
  const respondMutation = useRespondToReview();
  const deleteResponseMutation = useDeleteReviewResponse();

  const summary = useMemo(() => aggregateRatings(reviews), [reviews]);

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      await addReview.mutateAsync({ arena, input: { type, rating, comment } });
      toast.success('Enviado. Obrigado pelo retorno!');
      setRating(0);
      setComment('');
      setType(REVIEW_TYPE.REVIEW);
    } catch (err) {
      toast.error(err?.message || 'Não foi possível enviar.');
    }
  }

  return (
    <V2Surface>
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base font-bold text-ink">Avaliações e retornos</h3>
        {summary.average != null && (
          <span className="flex items-center gap-1 text-sm font-bold text-amber-600">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" /> {summary.average}
            <span className="text-xs text-gray-400">({summary.count})</span>
          </span>
        )}
      </div>

      {isAuthenticated && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3 rounded-3xl border border-gray-100 bg-paper p-4">
          <div className="flex flex-wrap gap-2">
            {Object.values(REVIEW_TYPE).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-bold transition-colors',
                  type === t ? 'border-ink bg-ink text-white' : 'border-gray-200 text-gray-600 hover:bg-paper-dark',
                )}
              >
                {REVIEW_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
          {type === REVIEW_TYPE.REVIEW && <StarPicker value={rating} onChange={setRating} />}
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder={type === REVIEW_TYPE.REVIEW ? 'Conte como foi sua experiência (opcional)' : 'Descreva sua mensagem'}
            className="w-full rounded-2xl border border-gray-200 bg-paper-pure px-4 py-2.5 text-sm text-ink placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acid/30"
          />
          <div className="flex justify-end">
            <V2Button type="submit" size="sm" disabled={addReview.isPending}>
              {addReview.isPending ? 'Enviando…' : 'Enviar'}
            </V2Button>
          </div>
        </form>
      )}

      <div className="mt-4 space-y-2">
        {isLoading ? (
          <p className="text-sm text-gray-500">Carregando…</p>
        ) : reviews.length === 0 ? (
          <p className="text-sm text-gray-500">Ainda não há avaliações. Seja o primeiro a comentar.</p>
        ) : (
          reviews.map((r) => {
            const Icon = TYPE_ICON[r.type] || Star;
            const mine = r.user_id === user?.uid;
            return (
              <div key={r.id} className="rounded-3xl border border-gray-100 bg-paper-pure p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <UserAvatar name={r.user_name} photoUrl={r.user_photo} size="sm" />
                    <div>
                      <div className="text-sm font-bold text-ink">{r.user_name}</div>
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <Icon className="h-3 w-3" />
                        {(r.type ?? 'review') !== 'review' ? REVIEW_TYPE_LABELS[r.type] : `${r.rating}★`}
                      </div>
                    </div>
                  </div>
                  {(mine || canModerate) && (
                    <ConfirmDialog
                      title="Remover este item?"
                      description="A mensagem será removida permanentemente."
                      confirmLabel="Remover"
                      onConfirm={() => deleteReview.mutate(r)}
                      trigger={(
                        <button aria-label="Remover" className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-paper hover:text-red-500">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    />
                  )}
                </div>
                {r.comment && <p className="mt-2 text-sm text-gray-600">{r.comment}</p>}
                {canModerate && (r.type ?? 'review') !== 'review' && (
                  <V2Badge tone="amber" className="mt-2">Requer atenção da arena</V2Badge>
                )}

                {/* Resposta da arena (Sprint 3 ARE-09) */}
                {hasResponse(r) && respondingTo !== r.id && (
                  <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
                        <Reply className="h-3 w-3" /> Resposta da arena
                        {responseAgeHours(r) != null && (
                          <span className="text-emerald-600/70">· há {responseAgeHours(r)}h</span>
                        )}
                      </div>
                      {canModerate && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setRespondingTo(r.id)}
                            className="flex h-7 w-7 items-center justify-center rounded-full text-emerald-700 hover:bg-emerald-100"
                            aria-label="Editar resposta"
                            title="Editar resposta"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <ConfirmDialog
                            title="Remover resposta?"
                            description="A resposta da arena será removida. O comentário original permanece."
                            confirmLabel="Remover"
                            onConfirm={() => deleteResponseMutation.mutate(r.id)}
                            trigger={(
                              <button
                                type="button"
                                className="flex h-7 w-7 items-center justify-center rounded-full text-red-500 hover:bg-red-50"
                                aria-label="Remover resposta"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}
                          />
                        </div>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-emerald-900">{r.response}</p>
                  </div>
                )}

                {/* Form de resposta (apenas se canModerate E respondingTo === r.id) */}
                {canModerate && respondingTo === r.id && (
                  <ResponseForm
                    initial={r.response || ''}
                    busy={respondMutation.isPending}
                    onCancel={() => setRespondingTo(null)}
                    onSubmit={async (text) => {
                      try {
                        await respondMutation.mutateAsync({ reviewId: r.id, response: text });
                        toast.success('Resposta publicada.');
                        setRespondingTo(null);
                      } catch (err) {
                        toast.error(err?.message || 'Não foi possível publicar a resposta.');
                      }
                    }}
                  />
                )}

                {!hasResponse(r) && canModerate && respondingTo !== r.id && (
                  <button
                    type="button"
                    onClick={() => setRespondingTo(r.id)}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                  >
                    <Reply className="h-3 w-3" /> Responder
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </V2Surface>
  );
}

function ResponseForm({ initial = '', busy, onCancel, onSubmit }) {
  const [text, setText] = useState(initial);
  const [error, setError] = useState(null);
  const handleSubmit = (e) => {
    e?.preventDefault?.();
    const r = normalizeReviewResponse({ response: text });
    if (!r.valid) { setError(r.error); return; }
    setError(null);
    onSubmit(r.value);
  };
  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-2 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        maxLength={500}
        placeholder="Escreva a resposta pública da arena…"
        className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm outline-none focus-visible:border-emerald-400"
      />
      <div className="flex items-center justify-between text-xs">
        <span className={cn(text.length > 500 ? 'text-red-600' : 'text-gray-400')}>
          {text.length}/500
        </span>
        {error && <span className="text-red-600">{error}</span>}
      </div>
      <div className="flex justify-end gap-2">
        <V2Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
          Cancelar
        </V2Button>
        <V2Button type="submit" size="sm" disabled={busy}>
          {busy ? 'Publicando…' : initial ? 'Atualizar resposta' : 'Publicar resposta'}
        </V2Button>
      </div>
    </form>
  );
}
