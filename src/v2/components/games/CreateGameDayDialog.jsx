import React, { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { V2Button } from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';
import { GAME_DAY_VISIBILITY, GAME_DAY_VISIBILITY_LABELS } from '@/modules/games/domain/gameDay';
import { GAME_DAY_FORMAT, GAME_DAY_FORMAT_LABELS } from '@/modules/clubs/domain/gameDayFormats';
import { useCreateGameDay } from '@/modules/games/hooks/useGameDays';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';

/** Diálogo para o atleta criar um dia de jogo (público ou privado). */
export default function CreateGameDayDialog({ open, onOpenChange, onCreated }) {
  const create = useCreateGameDay();
  const formatsOn = useFeatureFlag(FEATURE_FLAG.GAMEDAY_FORMATS);
  const [form, setForm] = useState({
    title: '', visibility: GAME_DAY_VISIBILITY.PRIVATE, date: '', time: '',
    location: '', city: '', state: '', notes: '', format: GAME_DAY_FORMAT.AMERICANO,
  });

  const set = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  const handleSubmit = async () => {
    if (!form.title.trim()) { toast.error('Dê um nome ao seu dia de jogo.'); return; }
    try {
      const { id } = await create.mutateAsync(form);
      toast.success(
        form.visibility === GAME_DAY_VISIBILITY.PUBLIC
          ? 'Dia de jogo criado! Um convite foi publicado em "Procura-se jogo".'
          : 'Dia de jogo criado!',
      );
      onOpenChange(false);
      setForm({
        title: '', visibility: GAME_DAY_VISIBILITY.PRIVATE, date: '', time: '',
        location: '', city: '', state: '', notes: '', format: GAME_DAY_FORMAT.AMERICANO,
      });
      onCreated?.(id);
    } catch (err) {
      toast.error(err?.message || 'Não foi possível criar o dia de jogo.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo dia de jogo</DialogTitle>
          <DialogDescription>
            Organize sua rodada, convide atletas e (se quiser) publique os resultados no ranking.
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

          {formatsOn && (
            <div>
              <Label className="text-xs">Formato do sorteio</Label>
              <select
                value={form.format}
                onChange={(e) => set('format', e.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {Object.values(GAME_DAY_FORMAT).map((f) => (
                  <option key={f} value={f}>{GAME_DAY_FORMAT_LABELS[f]}</option>
                ))}
              </select>
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
          <V2Button onClick={handleSubmit} disabled={create.isPending || !form.title.trim()}>
            {create.isPending ? 'Criando…' : 'Criar dia de jogo'}
          </V2Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
