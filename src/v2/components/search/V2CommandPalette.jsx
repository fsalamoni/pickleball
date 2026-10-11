/**
 * Paleta de comandos (plano de UX §5.4).
 *
 * Um campo, uma lista: ações por papel, telas do menu (o mesmo rótulo), atletas,
 * torneios, arenas e clubes (as consultas do `/buscar` — nenhuma nova) e os
 * artigos da Ajuda. Abre pelo ícone de busca, pelo campo do cabeçalho e por
 * Ctrl/⌘+K. É lazy: só monta (e só consulta) quando aberta.
 *
 * Teclado: setas, Enter e Esc (padrão combobox + listbox do WAI-ARIA). Sem
 * `cmdk` — a lista é curta e o padrão cabe em poucas linhas.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  Building2, ChevronRight, Dices, Dumbbell, LayoutDashboard, LifeBuoy, Search, Swords, Trophy, Users, Users2, Clock,
} from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useAthletes } from '@/modules/athletes/hooks/useAthletes';
import { usePublicTournaments } from '@/modules/tournament/hooks/useTournament';
import { useArenas } from '@/modules/arenas/hooks/useArenas';
import { useClubs } from '@/modules/clubs/hooks/useClubs';
import { searchAll } from '@/modules/athletes/domain/globalSearch';
import { searchHelp } from '@/modules/help/domain/helpCenter';
import { commandIndex, filtrarComandos, lembrarRecente } from '@/modules/search/domain/commandIndex';
import { readViewPreference, writeViewPreference } from '@/core/lib/viewPreference';
import { recordEvent } from '@/core/services/observabilityService';
import { cn } from '@/core/lib/utils';
import { V2Avatar } from '@/v2/ui/primitives';

const ICONES = { Building2, ChevronRight, Dices, Dumbbell, LayoutDashboard, Swords, LifeBuoy, Clock };
const ICONE_TIPO = { athlete: Users, tournament: Trophy, arena: Building2, club: Users2 };
const SEM_ITENS = [];
const PREF_RECENTES = 'busca:recentes';
const DEBOUNCE_MS = 250;

function useDebounced(valor, ms) {
  const [v, setV] = useState(valor);
  useEffect(() => { const t = setTimeout(() => setV(valor), ms); return () => clearTimeout(t); }, [valor, ms]);
  return v;
}

export default function V2CommandPalette({ open, onOpenChange, hubs = [], arenas = [], treinoOn = false, isPlatformAdmin = false }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [termo, setTermo] = useState('');
  const termoBusca = useDebounced(termo, DEBOUNCE_MS);
  const [ativo, setAtivo] = useState(0);
  const inputRef = useRef(null);
  const listaRef = useRef(null);

  const atletasQ = useAthletes(open);
  const torneiosQ = usePublicTournaments({ enabled: open });
  const arenasQ = useArenas();
  const clubesQ = useClubs();

  const indice = useMemo(
    () => commandIndex({ hubs, arenas, treinoOn, isPlatformAdmin }),
    [hubs, arenas, treinoOn, isPlatformAdmin],
  );
  const recentes = useMemo(() => (open ? readViewPreference(user?.uid, PREF_RECENTES) || [] : []), [open, user?.uid]);

  const grupos = useMemo(() => {
    const { acoes, telas } = filtrarComandos(termoBusca, indice);
    const dados = searchAll(termoBusca, {
      athletes: atletasQ.data ?? SEM_ITENS, tournaments: torneiosQ.data ?? SEM_ITENS,
      arenas: arenasQ.data ?? SEM_ITENS, clubs: clubesQ.data ?? SEM_ITENS,
    }, { perGroup: 4 });
    const ajuda = termoBusca.trim().length >= 2
      ? searchHelp(termoBusca).slice(0, 4).map((a) => ({
        id: `ajuda:${a.sectionId}:${a.id}`, label: a.title, sub: a.sectionLabel, to: `/ajuda?s=${a.sectionId}&a=${a.id}`, icon: 'LifeBuoy',
      }))
      : [];
    const lista = [
      !termoBusca && recentes.length > 0 && { grupo: 'recentes', label: 'Recentes', itens: recentes.map((r) => ({ ...r, id: `rec:${r.to}`, icon: 'Clock' })) },
      acoes.length > 0 && { grupo: 'acoes', label: 'Ações', itens: acoes },
      telas.length > 0 && { grupo: 'telas', label: 'Telas', itens: telas },
      ...dados.groups.map((g) => ({ grupo: g.type, label: g.label, itens: g.items.map((i) => ({ id: `${i.type}:${i.id}`, label: i.title, sub: i.subtitle, to: i.to, tipo: i.type, photo: i.photo })) })),
      ajuda.length > 0 && { grupo: 'ajuda', label: 'Ajuda', itens: ajuda },
    ].filter(Boolean);
    return lista;
  }, [termoBusca, indice, recentes, atletasQ.data, torneiosQ.data, arenasQ.data, clubesQ.data]);

  const planos = useMemo(() => grupos.flatMap((g) => g.itens.map((i) => ({ ...i, grupo: g.grupo }))), [grupos]);
  const fontes = [['atletas', atletasQ], ['torneios', torneiosQ], ['arenas', arenasQ], ['clubes', clubesQ]];
  const falharam = fontes.filter(([, q]) => q.isError).map(([n]) => n);
  const carregando = termoBusca.trim().length >= 2 && fontes.some(([, q]) => q.isLoading);

  useEffect(() => { if (open) { setTermo(''); setAtivo(0); } }, [open]);
  useEffect(() => { setAtivo(0); }, [termoBusca]);
  useEffect(() => {
    const el = listaRef.current?.querySelector(`[data-indice="${ativo}"]`);
    el?.scrollIntoView?.({ block: 'nearest' });
  }, [ativo]);

  const escolher = (item) => {
    if (!item) return;
    recordEvent('search_pick', { grupo: item.grupo });
    writeViewPreference(user?.uid, PREF_RECENTES, lembrarRecente(recentes, item));
    onOpenChange(false);
    navigate(item.to);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setAtivo((i) => Math.min(i + 1, planos.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAtivo((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); escolher(planos[ativo]); }
  };

  const idAtivo = planos[ativo] ? `cmd-${planos[ativo].id}` : undefined;
  let indice2 = -1;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/60 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          onOpenAutoFocus={(e) => { e.preventDefault(); inputRef.current?.focus(); }}
          className="fixed left-1/2 top-[8dvh] z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-3xl border border-gray-100 bg-paper-pure shadow-2xl data-[state=open]:animate-in data-[state=open]:fade-in-0"
        >
          <DialogPrimitive.Title className="sr-only">Buscar ou ir para</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">Digite para buscar ações, telas, atletas, torneios, arenas, clubes e ajuda. Use as setas e Enter.</DialogPrimitive.Description>
          <div className="flex items-center gap-3 border-b border-gray-100 px-4">
            <Search className="h-5 w-5 shrink-0 text-gray-500" aria-hidden="true" />
            <input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-expanded="true"
              aria-controls="cmd-lista"
              aria-activedescendant={idAtivo}
              aria-autocomplete="list"
              aria-label="Buscar ou ir para"
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Buscar ou ir para…"
              className="h-14 w-full bg-transparent text-base text-ink outline-none placeholder:text-gray-500"
              autoComplete="off"
            />
            <kbd className="hidden rounded-md border border-gray-200 px-1.5 py-0.5 text-2xs text-gray-500 sm:inline">Esc</kbd>
          </div>
          <div ref={listaRef} id="cmd-lista" role="listbox" aria-label="Resultados" className="max-h-[60dvh] overflow-y-auto overscroll-contain p-2">
            {grupos.map((g) => (
              <div key={g.grupo} role="group" aria-label={g.label} className="mb-1">
                <p className="px-3 pb-1 pt-2 text-2xs font-bold uppercase tracking-widest text-gray-500">{g.label}</p>
                {g.itens.map((item) => {
                  indice2 += 1;
                  const i = indice2;
                  const Icone = item.tipo ? ICONE_TIPO[item.tipo] : (ICONES[item.icon] || ChevronRight);
                  return (
                    <button type="button"
                      key={item.id}
                      id={`cmd-${item.id}`}
                      role="option"
                      aria-selected={i === ativo}
                      data-indice={i}
                      onMouseEnter={() => setAtivo(i)}
                      onClick={() => escolher({ ...item, grupo: g.grupo })}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left coarse:min-h-11',
                        i === ativo ? 'bg-ink text-paper-pure' : 'text-ink hover:bg-paper',
                      )}
                    >
                      {item.tipo === 'athlete'
                        ? <V2Avatar name={item.label} photoUrl={item.photo} size="sm" />
                        : <Icone className={cn('h-4 w-4 shrink-0', i === ativo ? 'text-acid' : 'text-gray-500')} aria-hidden="true" />}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{item.label}</span>
                        {item.sub && <span className={cn('block truncate text-xs', i === ativo ? 'text-paper-pure/70' : 'text-gray-500')}>{item.sub}</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
            {planos.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-gray-500" role="status">
                {carregando ? 'Buscando…' : termoBusca.trim().length < 2 ? 'Digite ao menos 2 letras para buscar atletas, torneios, arenas, clubes e ajuda.' : 'Nada encontrado.'}
              </p>
            )}
            {falharam.length > 0 && termoBusca.trim().length >= 2 && (
              <p className="px-3 py-2 text-xs text-amber-700" role="status">
                {falharam.join(', ')} não responderam — os resultados podem estar incompletos.
              </p>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
