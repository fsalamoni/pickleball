/**
 * As abas FAVORITAS da Central (até 5, por pessoa e por arena, no navegador).
 * Com 41 abas possíveis, a que a recepção abre trinta vezes por dia merece
 * um toque. Zero banco: `v2:view:<uid>:arena:<id>:favoritas`.
 */
import React, { useMemo, useState } from 'react';
import { Star } from 'lucide-react';
import { readViewPreference, writeViewPreference } from '@/core/lib/viewPreference';
import { MAX_FAVORITAS, parseFavoriteTabs, toggleFavoriteTab } from '@/modules/arenas/domain/arenaToday';

export default function ArenaFavoriteTabs({ uid, arenaId, sections, activeTab, onOpen }) {
  const prefId = `arena:${arenaId}:favoritas`;
  const abas = useMemo(() => sections.flatMap((s) => s.tabs.map((t) => ({ ...t, secao: s.label }))), [sections]);
  const validas = useMemo(() => abas.map((t) => t.value), [abas]);
  const [favoritas, setFavoritas] = useState(() => parseFavoriteTabs(readViewPreference(uid, prefId), validas));
  const lista = favoritas.filter((v) => validas.includes(v));
  const ehFavorita = lista.includes(activeTab);
  const cheia = !ehFavorita && lista.length >= MAX_FAVORITAS;
  const podeFavoritar = activeTab !== 'hoje';

  const alternar = () => {
    const nova = toggleFavoriteTab(lista, activeTab);
    setFavoritas(nova);
    writeViewPreference(uid, prefId, nova.length ? JSON.stringify(nova) : null);
  };

  if (lista.length === 0 && !podeFavoritar) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 px-1" aria-label="Abas favoritas">
      {lista.length > 0 && <Star className="h-3.5 w-3.5 text-amber-500" aria-hidden />}
      {lista.map((v) => {
        const aba = abas.find((t) => t.value === v);
        return (
          <button
            key={v}
            type="button"
            onClick={() => onOpen(v)}
            aria-current={v === activeTab ? 'page' : undefined}
            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${v === activeTab ? 'border-ink bg-ink text-white' : 'border-gray-200 bg-paper text-ink hover:bg-white'}`}
          >
            {aba.label}
          </button>
        );
      })}
      {podeFavoritar && (
        <button
          type="button"
          onClick={alternar}
          disabled={cheia}
          title={cheia ? `Até ${MAX_FAVORITAS} favoritas: tire uma para pôr outra` : undefined}
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-gray-500 hover:text-ink disabled:opacity-50"
        >
          <Star className={`h-3.5 w-3.5 ${ehFavorita ? 'fill-amber-400 text-amber-500' : ''}`} aria-hidden />
          {ehFavorita ? 'Tirar das favoritas' : 'Favoritar esta aba'}
        </button>
      )}
    </div>
  );
}
