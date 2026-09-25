import React from 'react';
import { cn } from '@/core/lib/utils';

/**
 * A navegação em dois níveis das centrais (arena, professor, torneio).
 *
 * Nasceu de um relato olhando a tela: a Central da arena, com os módulos
 * integrados, chegou a TREZE seções numa linha só, com rolagem para o lado — e
 * o que não cabia simplesmente não era visto. Quem procura "Marketing" não
 * rola uma barra horizontal esperando que ele esteja lá; conclui que não
 * existe.
 *
 * Por isso aqui nada rola para o lado: as seções QUEBRAM em linhas. E, quando
 * a tela informa `grupos`, cada grupo é uma linha com o seu nome — na arena,
 * "Atender" (o trabalho do dia) e "Gerir" (como a arena é configurada). Duas
 * linhas com sentido se aprendem; duas linhas que só dividem a lista ao meio,
 * não.
 *
 * O nível 2 (`V2SubTabs`) é o mesmo desenho, menor: as abas da seção ativa,
 * também quebrando em linhas.
 */

/**
 * As seções separadas pelos grupos, na ordem dos grupos. Seção sem grupo (ou
 * com um grupo que a tela não declarou) vai para o fim, num grupo sem nome —
 * nunca some. Grupo sem seção não aparece.
 * @param {Array<{ id: string, grupo?: string }>} sections
 * @param {Array<{ id: string, label: string }>} [grupos]
 * @returns {Array<{ id: string, label: string|null, secoes: Array<object> }>}
 */
export function agruparSecoes(sections = [], grupos = []) {
  if (!grupos?.length) return [{ id: 'todas', label: null, secoes: sections }];
  const conhecidos = new Set(grupos.map((g) => g.id));
  const linhas = grupos
    .map((g) => ({ id: g.id, label: g.label, secoes: sections.filter((s) => s.grupo === g.id) }))
    .filter((g) => g.secoes.length > 0);
  const soltas = sections.filter((s) => !conhecidos.has(s.grupo));
  if (soltas.length) linhas.push({ id: 'outras', label: null, secoes: soltas });
  return linhas;
}

export function V2SectionNav({ sections, activeId, onSelect, grupos, ariaLabel = 'Seções' }) {
  const linhas = agruparSecoes(sections, grupos);
  const comNome = linhas.some((l) => l.label);
  return (
    <nav aria-label={ariaLabel} className="rounded-3xl border border-gray-100 bg-paper-pure p-1.5 shadow-sm">
      {linhas.map((linha, i) => (
        <div
          key={linha.id}
          className={cn(
            'flex flex-col gap-1 sm:flex-row sm:items-center',
            i > 0 && 'mt-1.5 border-t border-gray-100 pt-1.5',
          )}
        >
          {comNome && (
            <span className="px-2.5 pt-1 text-[10px] font-bold uppercase tracking-widest text-gray-400 sm:w-[4.5rem] sm:shrink-0 sm:pt-0">
              {linha.label}
            </span>
          )}
          <div className="flex min-w-0 flex-1 flex-wrap gap-1">
            {linha.secoes.map((section) => {
              const Icon = section.icon;
              const active = section.id === activeId;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => onSelect(section)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ink sm:py-2 sm:text-sm',
                    active ? 'bg-ink text-white shadow-md' : 'text-gray-500 hover:bg-paper hover:text-ink',
                  )}
                >
                  {Icon && <Icon className={cn('h-3.5 w-3.5 sm:h-4 sm:w-4', active ? 'text-acid' : 'text-gray-400')} />}
                  {section.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function V2SubTabs({ tabs, activeValue, onSelect, ariaLabel = 'Abas da seção' }) {
  return (
    <nav aria-label={ariaLabel} className="flex flex-wrap gap-1.5 px-1">
      {tabs.map((t) => {
        const Icon = t.icon;
        const active = activeValue === t.value;
        return (
          <button
            key={t.value}
            type="button"
            onClick={() => onSelect(t)}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ink sm:px-3.5 sm:text-sm',
              active ? 'border-ink bg-ink/5 text-ink' : 'border-gray-200 text-gray-500 hover:border-ink/40 hover:text-ink',
            )}
          >
            {Icon && <Icon className={cn('h-3.5 w-3.5', active ? 'text-ink' : 'text-gray-400')} />}
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}
