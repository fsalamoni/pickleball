import React, { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { LEVEL_OPTIONS } from '@/modules/leveling/data/levels';
import { OPEN_GAME_FORMAT_LABELS, normalizeOpenGameInput } from '../domain/openGames.js';
import { useCreateOpenGame } from '../hooks/useOpenGames.js';

export default function CreateOpenGameDialog({ open, onOpenChange }) {
  const { user, userProfile } = useAuth();
  const create = useCreateOpenGame();
  const [whenText, setWhenText] = useState('');
  const [city, setCity] = useState(userProfile?.city || '');
  const [stateUf, setStateUf] = useState(userProfile?.state || '');
  const [level, setLevel] = useState(userProfile?.leveling_level || '');
  const [format, setFormat] = useState('any');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState({});

  async function handleSubmit(e) {
    e.preventDefault();
    const input = { when_text: whenText, city, state: stateUf, level, format, notes };
    const check = normalizeOpenGameInput(input);
    if (!check.valid) {
      setErrors(check.errors);
      return;
    }
    try {
      await create.mutateAsync({
        ...input,
        creator_name: userProfile?.platform_name || user?.displayName || null,
        creator_photo: userProfile?.photo_url || user?.photoURL || null,
      });
      toast.success('Convite publicado no mural.');
      setWhenText('');
      setNotes('');
      setErrors({});
      onOpenChange(false);
    } catch (err) {
      toast.error(err?.message || 'Não foi possível publicar o convite.');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Procuro jogo</DialogTitle>
          <DialogDescription>Publique um convite e encontre parceiros para jogar.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="when_text">Quando</Label>
            <Input
              id="when_text"
              value={whenText}
              onChange={(e) => setWhenText(e.target.value)}
              placeholder="Ex.: Sábado de manhã, ou 12/07 às 19h"
              maxLength={100}
            />
            {errors.when_text && <p className="text-xs text-red-600">{errors.when_text}</p>}
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-3">
            <div className="space-y-2">
              <Label htmlFor="city">Cidade</Label>
              <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} maxLength={60} placeholder="Sua cidade" />
              {errors.city && <p className="text-xs text-red-600">{errors.city}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">UF</Label>
              <Input id="state" value={stateUf} onChange={(e) => setStateUf(e.target.value)} maxLength={2} placeholder="SP" className="w-16" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="level">Nível</Label>
              <select
                id="level"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Qualquer nível</option>
                {LEVEL_OPTIONS.map((o) => (
                  <option key={o.code} value={o.code}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="format">Formato</Label>
              <select
                id="format"
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {Object.entries(OPEN_GAME_FORMAT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações (opcional)</Label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={400}
              rows={3}
              placeholder="Ex.: Tenho quadra reservada, procuro mais 2 pessoas nível intermediário."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          <Button type="submit" disabled={create.isPending} className="w-full">
            {create.isPending ? 'Publicando…' : 'Publicar convite'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
