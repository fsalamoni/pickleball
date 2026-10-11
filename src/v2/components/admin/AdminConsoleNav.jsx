/**
 * A navegação do Painel admin: lateral agrupada no computador, lista
 * recolhível no celular, com a busca de configuração no topo ("flags",
 * "cadastros", "biblioteca" — toda aba em até 3 letras).
 *
 * Antes eram 8 seções e 26 abas numa barra horizontal em duas linhas; quem
 * procurava "onde ligo X?" varria tudo. A âncora `data-dica` de cada seção
 * continua (as dicas guiadas apontam para ela).
 */
import React, { useMemo, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { searchAdminTabs } from '@/modules/admin/domain/consoleNav';
import { cn } from '@/core/lib/utils';

function Busca({ sections, onTab }) {
  const [q, setQ] = useState('');
  const achados = useMemo(() => searchAdminTabs(sections, q), [sections, q]);
  const abrir = (id) => { onTab(id); setQ(''); };
  return (
    <div className="relative">
      <label className="sr-only" htmlFor="admin-busca">Buscar no painel</label>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" aria-hidden />
      <input
        id="admin-busca"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && achados[0]) { e.preventDefault(); abrir(achados[0].id); } }}
        placeholder="Buscar: flags, cadastros, biblioteca…"
        autoComplete="off"
        className="h-10 w-full rounded-2xl border border-gray-200 bg-paper-pure pl-9 pr-3 text-sm text-ink placeholder:text-gray-500"
      />
      {q.trim() && (
        <ul className="absolute left-0 right-0 top-11 z-30 max-h-72 overflow-auto rounded-2xl border border-gray-100 bg-paper-pure p-1 shadow-organic" role="listbox" aria-label="Resultados da busca">
          {achados.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-500">Nada com esse nome. Tente outra palavra.</li>
          ) : achados.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => abrir(r.id)} className="flex w-full items-baseline justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-paper">
                <span className="font-semibold text-ink">{r.label}</span>
                <span className="text-xs text-gray-500">{r.secao}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Lista({ sections, tab, onTab, onEscolheu }) {
  return (
    <nav aria-label="Seções do painel" data-dica="admin-secoes" className="space-y-3">
      {sections.map((s) => {
        const ativa = s.tabs.some((t) => t.id === tab);
        return (
          <div key={s.id} data-dica={s.dica}>
            <p className={cn('mb-1 flex items-center gap-1.5 px-2 text-2xs font-bold uppercase tracking-widest', ativa ? 'text-ink' : 'text-gray-500')}>
              {s.icon && <s.icon className="h-3.5 w-3.5" aria-hidden />} {s.label}
            </p>
            <ul className="space-y-0.5">
              {s.tabs.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    aria-current={t.id === tab ? 'page' : undefined}
                    onClick={() => { onTab(t.id); onEscolheu?.(); }}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-sm coarse:min-h-11',
                      t.id === tab ? 'bg-ink font-bold text-white' : 'text-ink hover:bg-paper',
                    )}
                  >
                    {t.icon && <t.icon className="h-4 w-4 shrink-0 opacity-70" aria-hidden />}
                    {t.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

export default function AdminConsoleNav({ sections, tab, onTab }) {
  const [aberta, setAberta] = useState(false);
  const atual = sections.find((s) => s.tabs.some((t) => t.id === tab));
  const abaAtual = atual?.tabs.find((t) => t.id === tab);
  return (
    <>
      {/* Computador: lateral fixa, com a busca no topo. */}
      <aside className="hidden lg:block">
        <div className="sticky top-4 space-y-4">
          <Busca sections={sections} onTab={onTab} />
          <Lista sections={sections} tab={tab} onTab={onTab} />
        </div>
      </aside>
      {/* Celular: a busca e uma lista que recolhe, com onde a pessoa está no resumo. */}
      <div className="space-y-2 lg:hidden">
        <Busca sections={sections} onTab={onTab} />
        <details open={aberta} onToggle={(e) => setAberta(e.currentTarget.open)} className="rounded-2xl border border-gray-100 bg-paper-pure">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-bold text-ink coarse:min-h-11">
            <span>{atual?.label}{abaAtual && atual.tabs.length > 1 ? ` › ${abaAtual.label}` : ''}</span>
            <ChevronDown className={cn('h-4 w-4 transition-transform', aberta && 'rotate-180')} aria-hidden />
          </summary>
          <div className="border-t border-gray-100 p-3">
            <Lista sections={sections} tab={tab} onTab={onTab} onEscolheu={() => setAberta(false)} />
          </div>
        </details>
      </div>
    </>
  );
}
