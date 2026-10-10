/**
 * Escolher o que treinar num dia do plano: a biblioteca inteira que a pessoa
 * vê, com busca, tipo, "do meu nível" e "salvos", e vários itens de uma vez.
 *
 * A lista mostra o tempo de cada item e quanto do dia já foi usado — é o que
 * se decide ali ("cabe mais um drill de 15 min?"). Nível desconhecido nunca
 * esconde item (regra de `fitsLevel`).
 */
import React, { useMemo, useState } from 'react';
import { Check, Search, Star } from 'lucide-react';
import { cn } from '@/core/lib/utils';
import { ITEM_KINDS, ITEM_KIND_LABELS } from '@/modules/training/domain/taxonomy';
import { filterItems, itemMetaLine, sortLibrary } from '@/modules/training/domain/trainingItem';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { V2Button, V2FilterChip, V2SearchInput } from '@/v2/ui/primitives';
import { KindIcon } from '@/v2/components/training/ItemCard';

const LIMITE_LISTA = 60;

/**
 * @param {{ open: boolean, onOpenChange: (o: boolean) => void, items: object[],
 *   excludeIds?: string[], max: number, favorites?: string[], level?: number|null,
 *   incompleto?: boolean, onAdd: (ids: string[]) => void }} props
 */
export default function ItemPickerDialog({
  open, onOpenChange, items = [], excludeIds = [], max, favorites = [], level = null, incompleto = false, onAdd,
}) {
  const [q, setQ] = useState('');
  const [tipo, setTipo] = useState('');
  const [meuNivel, setMeuNivel] = useState(false);
  const [salvos, setSalvos] = useState(false);
  const [marcados, setMarcados] = useState([]);

  const fav = useMemo(() => new Set(favorites), [favorites]);
  const lista = useMemo(() => {
    const fora = new Set(excludeIds);
    const pool = items.filter((it) => !it.legacy && !fora.has(it.id) && (!salvos || fav.has(it.id)));
    return sortLibrary(filterItems(pool, { text: q, kind: tipo, level: meuNivel && Number.isFinite(level) ? level : null }));
  }, [items, excludeIds, salvos, fav, q, tipo, meuNivel, level]);

  const cheio = marcados.length >= max;
  const alternar = (id) => setMarcados((m) => (m.includes(id) ? m.filter((x) => x !== id) : (m.length < max ? [...m, id] : m)));
  const fechar = (o) => { if (!o) setMarcados([]); onOpenChange(o); };
  const confirmar = () => { onAdd(marcados); fechar(false); };

  return (
    <Dialog open={open} onOpenChange={fechar}>
      <DialogContent className="flex max-w-2xl flex-col gap-4">
        <DialogHeader>
          <DialogTitle>Acrescentar ao dia</DialogTitle>
          <DialogDescription>
            {max === 1 ? 'Cabe mais um item neste dia.' : `Escolha até ${max} itens.`} Toque para marcar; a ordem é a dos toques.
          </DialogDescription>
        </DialogHeader>

        <V2SearchInput
          icon={Search}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value.slice(0, 80))}
          placeholder="Buscar: dink, saque, voleio…"
          aria-label="Buscar na biblioteca"
        />
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar">
          <V2FilterChip active={!tipo} aria-pressed={!tipo} onClick={() => setTipo('')} className="px-3 py-1.5">Todos</V2FilterChip>
          {ITEM_KINDS.map((k) => (
            <V2FilterChip key={k} active={tipo === k} aria-pressed={tipo === k} onClick={() => setTipo(tipo === k ? '' : k)} className="px-3 py-1.5">
              {ITEM_KIND_LABELS[k]}
            </V2FilterChip>
          ))}
          {Number.isFinite(level) && (
            <V2FilterChip active={meuNivel} aria-pressed={meuNivel} onClick={() => setMeuNivel(!meuNivel)} className="px-3 py-1.5">Do meu nível</V2FilterChip>
          )}
          {favorites.length > 0 && (
            <V2FilterChip active={salvos} aria-pressed={salvos} onClick={() => setSalvos(!salvos)} className="px-3 py-1.5">
              <Star className="h-3.5 w-3.5" aria-hidden="true" /> Salvos
            </V2FilterChip>
          )}
        </div>

        {incompleto && <p className="text-xs text-amber-700">Parte da biblioteca não carregou; a lista pode estar incompleta.</p>}

        {lista.length === 0 ? (
          <p className="rounded-3xl bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
            Nada com esses filtros. Tente outra palavra ou tire um filtro.
          </p>
        ) : (
          <ul className="space-y-1.5" aria-label="Itens da biblioteca">
            {lista.slice(0, LIMITE_LISTA).map((it) => {
              const ordem = marcados.indexOf(it.id);
              const marcado = ordem >= 0;
              const bloqueado = !marcado && cheio;
              return (
                <li key={it.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={marcado}
                    aria-disabled={bloqueado}
                    onClick={() => !bloqueado && alternar(it.id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ink',
                      marcado ? 'border-ink bg-acid/20' : 'border-gray-100 bg-paper-pure hover:border-gray-300',
                      bloqueado && 'cursor-not-allowed opacity-50',
                    )}
                  >
                    <KindIcon kind={it.kind} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">
                        {fav.has(it.id) && <Star className="mr-1 inline h-3.5 w-3.5 text-amber-500" aria-label="Salvo" />}
                        {it.title}
                      </span>
                      <span className="block truncate text-xs text-gray-500">
                        {[ITEM_KIND_LABELS[it.kind], itemMetaLine(it)].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      className={cn(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold',
                        marcado ? 'border-ink bg-ink text-paper-pure' : 'border-gray-300 text-transparent',
                      )}
                    >
                      {marcado ? (max > 1 ? ordem + 1 : <Check className="h-4 w-4" />) : ''}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {lista.length > LIMITE_LISTA && (
          <p className="text-xs text-gray-500">Mostrando {LIMITE_LISTA} de {lista.length}. Use a busca para achar o resto.</p>
        )}

        <div className="sticky -bottom-6 -mx-6 -mb-6 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 bg-paper-pure px-6 py-4">
          <p className="text-sm text-gray-500" aria-live="polite">
            {marcados.length ? `${marcados.length} marcado${marcados.length > 1 ? 's' : ''}` : 'Nada marcado'}
          </p>
          <div className="flex gap-2">
            <V2Button variant="ghost" onClick={() => fechar(false)}>Cancelar</V2Button>
            <V2Button onClick={confirmar} disabled={!marcados.length}>
              {marcados.length > 1 ? `Acrescentar ${marcados.length}` : 'Acrescentar'}
            </V2Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
