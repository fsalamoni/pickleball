import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Star, MessageSquareWarning, Lightbulb, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/core/lib/utils';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import ConfirmDialog from '@/components/ConfirmDialog';
import { REVIEW_TYPE, REVIEW_TYPE_LABELS } from '../domain/constants.js';
import { aggregateRatings } from '../domain/arena.js';
import { useArenaReviews, useAddReview, useDeleteReview } from '../hooks/useArenas.js';

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

export default function ArenaReviews({ arena, canModerate = false }) {
  const { user, isAuthenticated } = useAuth();
  const { data: reviews = [], isLoading } = useArenaReviews(arena.id);
  const addReview = useAddReview();
  const deleteReview = useDeleteReview();
  const [type, setType] = useState(REVIEW_TYPE.REVIEW);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

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
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">Avaliações e retornos</h3>
            {summary.average != null && (
              <span className="flex items-center gap-1 text-sm font-medium text-amber-600">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" /> {summary.average}
                <span className="text-xs text-gray-400">({summary.count})</span>
              </span>
            )}
          </div>

          {isAuthenticated && (
            <form onSubmit={handleSubmit} className="mt-3 space-y-3 rounded-lg border border-gray-200 p-3">
              <div className="flex flex-wrap gap-2">
                {Object.values(REVIEW_TYPE).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                      type === t ? 'border-ink bg-ink text-white' : 'border-gray-200 text-gray-500 hover:bg-paper',
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
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <div className="flex justify-end">
                <Button type="submit" size="sm" disabled={addReview.isPending}>
                  {addReview.isPending ? 'Enviando…' : 'Enviar'}
                </Button>
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
                  <div key={r.id} className="rounded-lg border border-gray-100 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {r.user_photo ? (
                          <img src={r.user_photo} alt="" className="h-7 w-7 rounded-full object-cover" />
                        ) : (
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white/70">
                            {String(r.user_name || 'A')[0]?.toUpperCase()}
                          </span>
                        )}
                        <div>
                          <div className="text-sm font-medium text-ink">{r.user_name}</div>
                          <div className="flex items-center gap-1 text-xs text-gray-400">
                            <Icon className="h-3 w-3" />
                            {(r.type ?? 'review') !== 'review'
                              ? REVIEW_TYPE_LABELS[r.type]
                              : `${r.rating}★`}
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
                            <Button size="icon" variant="ghost" aria-label="Remover" className="h-7 w-7">
                              <Trash2 className="h-3.5 w-3.5 text-gray-400" />
                            </Button>
                          )}
                        />
                      )}
                    </div>
                    {r.comment && <p className="mt-2 text-sm text-gray-500">{r.comment}</p>}
                    {canModerate && (r.type ?? 'review') !== 'review' && (
                      <Badge variant="secondary" className="mt-2 text-[11px]">Requer atenção da arena</Badge>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
