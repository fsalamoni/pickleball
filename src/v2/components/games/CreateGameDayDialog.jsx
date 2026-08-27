import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { V2Button } from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';
import { GAME_DAY_VISIBILITY, GAME_DAY_VISIBILITY_LABELS, normalizePlayCourts } from '@/modules/games/domain/gameDay';
import {
  GAME_DAY_FORMAT, GAME_DAY_FORMAT_LABELS, DRAW_FORMATS, isPlayFormat,
} from '@/modules/clubs/domain/gameDayFormats';
import { useCreateGameDay, useUpdateGameDay } from '@/modules/games/hooks/useGameDays';
import { useAuth } from '@/core/lib/FirebaseAuthContext';

const EMPTY_FORM = {
  title: '', visibility: GAME_DAY_VISIBILITY.PRIVATE, date: '', time: '',
  location: '', city: '', state: '', notes: '', format: GAME_DAY_FORMAT.AMERICANO,
  play_courts: 1,
};

function formFromGameDay(gd) {
  if (!gd) return { ...EMPTY_FORM };
  return {
    title: gd.title || '',
    visibility: gd.visibility || GAME_DAY_VISIBILITY.PRIVATE,
    date: gd.date || '',
    time: gd.time || '',
    location: gd.location || '',
    city: gd.city || '',
    state: gd.state || '',
    notes: gd.notes || '',
    format: gd.format || GAME_DAY_FORMAT.AMERICANO,
    play_courts: normalizePlayCourts(gd.play_courts),
  };
}

/**
 * Diálogo para criar OU editar um dia de jogo (público/privado). Quando recebe
 * `gameDay`, entra em modo edição.
 */
export default function CreateGameDayDialog({ open, onOpenChange, onCreated, gameDay = null }) {
  const isEdit = !!gameDay;
  const create = useCreateGameDay();
  const update = useUpdateGameDay();
  const { userProfile } = useAuth();
  const formatsOn = true;
  const playOn = true;

  // Na CRIAÇÃO, os padrões são: visibilidade pública + cidade/UF do usuário.
  const defaultsForNew = () => ({
    ...EMPTY_FORM,
    visibility: GAME_DAY_VISIBILITY.PUBLIC,
    city: userProfile?.city || '',
    state: (userProfile?.state || '').toUpperCase().slice(0, 2),
  });
  const [form, setForm] = useState(() => (gameDay ? formFromGameDay(gameDay) : defaultsForNew()));

  // Reabre sempre sincronizado com o dia de jogo (edição) ou com os padrões (criação).
  useEffect(() => {
    if (open) setForm(gameDay ? formFromGameDay(gameDay) : defaultsForNew());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, gameDay, userProfile?.city, userProfile?.state]);

  // Formatos oferecidos na criação: os de sorteio + Play (se a flag estiver on).
  const formatOptions = playOn ? [...DRAW_FORMATS, GAME_DAY_FORMAT.PLAY] : DRAW_FORMATS;
  const showFormatSelect = formatsOn || playOn;

  const set = (k, v) => setForm((s) => ({ ...s, [k]: v }));
  const busy = create.isPending || update.isPending;

  const handleSubmit = async () => {
    if (!form.title.trim()) { toast.error('Dê um nome ao seu dia de jogo.'); return; }
    try {
      if (isEdit) {
        await update.mutateAsync({ id: gameDay.id, patch: form });
        toast.success('Dia de jogo atualizado.');
      } else {
        const { id } = await create.mutateAsync(form);
        toast.success(
          form.visibility === GAME_DAY_VISIBILITY.PUBLIC
            ? 'Dia de jogo criado! Um convite foi publicado em "Procura-se jogo".'
            : 'Dia de jogo criado!',
        );
        onCreated?.(id);
      }
      onOpenChange(false);
      if (!isEdit) setForm(defaultsForNew());
    } catch (err) {
      toast.error(err?.message || (isEdit ? 'Não foi possível salvar.' : 'Não foi possível criar o dia de jogo.'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar dia de jogo' : 'Novo dia de jogo'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Atualize as informações e detalhes do seu dia de jogo.'
              : 'Organize sua rodada, convide atletas e (se quiser) publique os resultados no ranking.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs">Nome*</Label>
            <Input value={form.title} onChange={(e) => set('title', e.target.value)} maxLength={80} placeholder="Ex.: Dia de jogo de sábado" />
          </div>

          <div>
            <Label className="text-xs">Visibilidade</Label>
            <div className="mt-1 grid gap-2 sm:grid-cols-2">
              {Object.values(GAME_DAY_VISIBILITY).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => set('visibility', v)}
                  className={cn(
                    'rounded-xl border px-3 py-2 text-left text-sm transition-colors',
                    form.visibility === v ? 'border-ink bg-ink text-white' : 'border-gray-200 text-gray-600 hover:bg-paper',
                  )}
                >
                  {GAME_DAY_VISIBILITY_LABELS[v]}
                </button>
              ))}
            </div>
            {isEdit && (
              <p className="mt-1 text-[11px] text-gray-500">
                Mudar para público publica um convite em &quot;Procura-se jogo&quot;; mudar para privado remove esse convite.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Data</Label>
              <Input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Horário</Label>
              <Input type="time" value={form.time} onChange={(e) => set('time', e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="text-xs">Local</Label>
            <Input value={form.location} onChange={(e) => set('location', e.target.value)} maxLength={160} placeholder="Arena, quadra, endereço…" />
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-3">
            <div>
              <Label className="text-xs">Cidade</Label>
              <Input value={form.city} onChange={(e) => set('city', e.target.value)} maxLength={80} />
            </div>
            <div className="w-20">
              <Label className="text-xs">UF</Label>
              <Input value={form.state} onChange={(e) => set('state', e.target.value)} maxLength={2} placeholder="SP" />
            </div>
          </div>

          {showFormatSelect && (
            <div>
              <Label className="text-xs">Formato do dia de jogo</Label>
              <select
                value={form.format}
                onChange={(e) => set('format', e.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {formatOptions.map((f) => (
                  <option key={f} value={f}>{GAME_DAY_FORMAT_LABELS[f]}</option>
                ))}
              </select>
              {playOn && isPlayFormat(form.format) && (
                <p className="mt-1 text-[11px] text-gray-500">
                  No Play, os jogos são criados por ordem de chegada, quadra a quadra, sem sorteio de grade e sem
                  resultados. Ao concluir um jogo, o próximo entra automaticamente na quadra liberada.
                </p>
              )}
            </div>
          )}

          {playOn && isPlayFormat(form.format) && (
            <div className="w-40">
              <Label className="text-xs">Quadras disponíveis</Label>
              <Input
                type="number"
                min={1}
                max={12}
                value={form.play_courts}
                onChange={(e) => set('play_courts', normalizePlayCourts(e.target.value))}
              />
            </div>
          )}

          <div>
            <Label className="text-xs">Observações (opcional)</Label>
            <textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              rows={2}
              maxLength={1000}
              placeholder="Nível, valor da quadra, o que levar…"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>

        <DialogFooter>
          <V2Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</V2Button>
          <V2Button onClick={handleSubmit} disabled={busy || !form.title.trim()}>
            {busy ? 'Salvando…' : (isEdit ? 'Salvar alterações' : 'Criar dia de jogo')}
          </V2Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
