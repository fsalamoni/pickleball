/**
 * CoachAddArenaForm — Formulário para o professor vincular uma arena parceira
 * a partir do Painel do Professor (item 4.2).
 *
 * O professor busca uma arena (ativa + pública) por nome/cidade, escolhe
 * e cria o vínculo. A arena recebe notificação (arena_coach_invited) e
 * o status fica 'pending' até a arena aceitar.
 *
 * Reusa `useArenas` (lista) + `useAddCoachResidency` (create).
 */

import React, { useMemo, useState } from 'react';
import { Search, Plus, Loader2, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { useArenas } from '@/modules/arenas/hooks/useArenas';
import { useAddCoachResidency } from '../hooks/useCoaches.js';
import { V2Button, V2Field, V2Input } from '@/v2/ui/primitives';

export default function CoachAddArenaForm({ coachId, onClose }) {
  const { data: arenas = [], isLoading } = useArenas();
  const add = useAddCoachResidency();
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [notes, setNotes] = useState('');

  const results = useMemo(() => {
    if (!query) return arenas.slice(0, 10);
    const q = query.toLowerCase();
    return arenas
      .filter((a) =>
        String(a.name || '').toLowerCase().includes(q)
        || String(a.city || '').toLowerCase().includes(q)
        || String(a.state || '').toLowerCase().includes(q),
      )
      .slice(0, 20);
  }, [arenas, query]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedId) {
      toast.error('Selecione uma arena para vincular.');
      return;
    }
    try {
      await add.mutateAsync({ coach_id: coachId, arena_id: selectedId, notes });
      toast.success('Solicitação enviada! A arena vai avaliar.');
      onClose?.();
    } catch (err) {
      toast.error(err?.message || 'Não foi possível solicitar parceria.');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <V2Field label="Buscar arena">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <V2Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nome, cidade ou estado…"
            className="pl-9"
          />
        </div>
      </V2Field>

      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando arenas…
        </div>
      ) : results.length === 0 ? (
        <p className="text-xs text-gray-500">Nenhuma arena encontrada.</p>
      ) : (
        <div className="max-h-60 space-y-1.5 overflow-y-auto rounded-2xl border border-gray-100 bg-paper p-2">
          {results.map((a) => {
            const isSel = selectedId === a.id;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setSelectedId(a.id)}
                className={`flex w-full items-center gap-2 rounded-2xl border px-3 py-2 text-left text-sm transition-colors ${
                  isSel
                    ? 'border-ink bg-ink text-white'
                    : 'border-gray-100 bg-white text-ink hover:bg-paper'
                }`}
              >
                <Building2 className="h-4 w-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{a.name}</p>
                  {a.city && <p className={`text-xs ${isSel ? 'text-white/70' : 'text-gray-500'}`}>{a.city}{a.state && `, ${a.state}`}</p>}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <V2Field label="Mensagem para a arena (opcional)">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="Apresente-se, diga onde e como pode atender…"
          className="w-full rounded-2xl border border-gray-200 bg-paper px-3 py-2 text-sm"
        />
      </V2Field>

      <div className="flex justify-end gap-2">
        <V2Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Cancelar
        </V2Button>
        <V2Button type="submit" size="sm" disabled={add.isPending || !selectedId}>
          {add.isPending ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Enviando…</>
          ) : (
            <><Plus className="h-4 w-4" /> Solicitar parceria</>
          )}
        </V2Button>
      </div>
    </form>
  );
}
