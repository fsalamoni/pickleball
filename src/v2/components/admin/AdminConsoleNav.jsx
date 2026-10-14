/**
 * A navegação do Painel admin: lateral agrupada no computador, lista
 * recolhível no celular, com a busca de configuração no topo ("flags",
 * "cadastros", "biblioteca" — toda aba em até 3 letras).
 *
 * Uma linha por tarefa do admin (9 seções); só a seção aberta mostra as abas,
 * com o selo de pendências ("Precisa de você") nas que esperam decisão. Antes
 * eram 25 itens sempre visíveis; quem procurava "onde ligo X?" varria tudo. A âncora `data-dica` de cada seção
 * continua (as dicas guiadas apontam para ela).
 */
import React, { useMemo, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { searchAdminTabs } from '@/modules/admin/domain/consoleNav';
import { cn } from '@/core/lib/utils';
import { t, tn } from '@/core/i18n';

function Busca({ sections, onTab }) {
  const [q, setQ] = useState('');
  const achados = useMemo(() => searchAdminTabs(sections, q), [sections, q]);
  const abrir = (id) => { onTab(id); setQ(''); };
  return (
    <div className="relative">
      <label className="sr-only" htmlFor="admin-busca">{t('Buscar no painel')}</label>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" aria-hidden />
      <input
        id="admin-busca"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && achados[0]) { e.preventDefault(); abrir(achados[0].id); } }}
        placeholder={t('Buscar: flags, cadastros, biblioteca…')}
        autoComplete="off"
        className="h-10 w-full rounded-2xl border border-gray-200 bg-paper-pure pl-9 pr-3 text-sm text-ink placeholder:text-gray-500"
      />
      {q.trim() && (
        <ul className="absolute left-0 right-0 top-11 z-30 max-h-72 overflow-auto rounded-2xl border border-gray-100 bg-paper-pure p-1 shadow-organic" role="listbox" aria-label={t('Resultados da busca')}>
          {achados.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-500">{t('Nada com esse nome. Tente outra palavra.')}</li>
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

function Selo({ n, className }) {
  if (!n) return null;
  return (
    <span className={cn('ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-amber-100 px-1.5 text-2xs font-bold text-amber-800', className)}>
      <span className="sr-only">{tn(n, '{n} pendente', '{n} pendentes')}</span>
      <span aria-hidden>{n > 99 ? '99+' : n}</span>
    </span>
  );
}

/**
 * Uma linha por seção. Só a seção ATIVA mostra as abas; seção de uma aba só é
 * link direto. Tocar numa seção fechada abre a primeira aba dela.
 */
function Lista({ sections, tab, onTab, onEscolheu, badges = {} }) {
  const ir = (id) => { onTab(id); onEscolheu?.(); };
  return (
    <nav aria-label={t('Seções do painel')} data-dica="admin-secoes">
      <ul className="space-y-0.5">
        {sections.map((s) => {
          const ativa = s.tabs.some((aba) => aba.id === tab);
          const unica = s.tabs.length === 1;
          const pendentes = s.tabs.reduce((a, aba) => a + (badges[aba.id] || 0), 0);
          return (
            <li key={s.id} data-dica={s.dica} className={cn(s.quieta && 'mt-3 border-t border-gray-100 pt-3')}>
              <button
                type="button"
                aria-current={unica && ativa ? 'page' : undefined}
                aria-expanded={unica ? undefined : ativa}
                onClick={() => { if (!ativa) ir(s.tabs[0].id); }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm coarse:min-h-11',
                  unica && ativa ? 'bg-ink font-bold text-white'
                    : ativa ? 'font-bold text-ink'
                      : cn('font-semibold hover:bg-paper', s.quieta ? 'text-gray-500' : 'text-ink'),
                )}
              >
                {s.icon && <s.icon className="h-4 w-4 shrink-0 opacity-70" aria-hidden />}
                {s.label}
                <Selo n={pendentes} />
                {!unica && <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 opacity-50 transition-transform', pendentes ? 'ml-1' : 'ml-auto', ativa && 'rotate-180')} aria-hidden />}
              </button>
              {!unica && ativa && (
                <ul className="mb-1 ml-5 mt-0.5 space-y-0.5 border-l border-gray-100 pl-2">
                  {s.tabs.map((aba) => (
                    <li key={aba.id}>
                      <button
                        type="button"
                        aria-current={aba.id === tab ? 'page' : undefined}
                        onClick={() => ir(aba.id)}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-sm coarse:min-h-11',
                          aba.id === tab ? 'bg-ink font-bold text-white' : 'text-ink hover:bg-paper',
                        )}
                      >
                        {aba.label}
                        <Selo n={badges[aba.id]} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default function AdminConsoleNav({ sections, tab, onTab, badges }) {
  const [aberta, setAberta] = useState(false);
  const atual = sections.find((s) => s.tabs.some((aba) => aba.id === tab));
  const abaAtual = atual?.tabs.find((aba) => aba.id === tab);
  return (
    <>
      {/* Computador: lateral fixa, com a busca no topo. */}
      <aside className="hidden lg:block">
        <div className="sticky top-4 space-y-4">
          <Busca sections={sections} onTab={onTab} />
          <Lista sections={sections} tab={tab} onTab={onTab} badges={badges} />
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
            <Lista sections={sections} tab={tab} onTab={onTab} onEscolheu={() => setAberta(false)} badges={badges} />
          </div>
        </details>
      </div>
    </>
  );
}
