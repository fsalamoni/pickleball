/**
 * AthleteMultiPicker — seleciona vários atletas da plataforma (diretório).
 * Reutilizável: convites de reserva compartilhada, alunos etc.
 *
 * value: Array<{ athlete_id, name, photo }>
 * onChange: (next) => void
 * exclude: Array<uid> a ocultar (ex.: o próprio solicitante / já participantes)
 */

import React, { useMemo, useState } from 'react';
import { Search, X, UserPlus } from 'lucide-react';
import { useAthletes } from '../hooks/useAthletes';
import { V2Avatar, V2SearchInput } from '@/v2/ui/primitives';

export default function AthleteMultiPicker({ value = [], onChange, exclude = [], placeholder = 'Buscar atleta…' }) {
  const { data: athletes = [], isLoading } = useAthletes();
  const [q, setQ] = useState('');
  const excludeSet = useMemo(() => new Set([...exclude, ...value.map((v) => v.athlete_id)]), [exclude, value]);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    return athletes
      .filter((a) => !excludeSet.has(a.id))
      .filter((a) => `${a.platform_name || ''} ${a.full_name || ''}`.toLowerCase().includes(term))
      .slice(0, 6);
  }, [athletes, q, excludeSet]);

  const add = (a) => {
    onChange([...value, { athlete_id: a.id, name: a.platform_name || a.full_name || 'Atleta', photo: a.photo_url || '' }]);
    setQ('');
  };
  const remove = (id) => onChange(value.filter((v) => v.athlete_id !== id));

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((v) => (
            <span key={v.athlete_id} className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-paper px-2.5 py-1 text-xs font-semibold text-ink">
              <V2Avatar name={v.name} photoUrl={v.photo} size="xs" />
              {v.name}
              <button type="button" onClick={() => remove(v.athlete_id)} className="text-gray-400 hover:text-red-500" aria-label="Remover">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <V2SearchInput icon={Search} value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} />
      {q.trim() && (
        <div className="rounded-2xl border border-gray-100 bg-paper-pure p-1.5">
          {isLoading ? (
            <p className="px-2 py-1.5 text-xs text-gray-400">Carregando…</p>
          ) : results.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-gray-400">Nenhum atleta encontrado.</p>
          ) : (
            results.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => add(a)}
                className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-sm hover:bg-paper"
              >
                <V2Avatar name={a.platform_name || a.full_name} photoUrl={a.photo_url} size="sm" />
                <span className="flex-1 font-semibold text-ink">{a.platform_name || a.full_name || 'Atleta'}</span>
                <UserPlus className="h-4 w-4 text-gray-400" />
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
