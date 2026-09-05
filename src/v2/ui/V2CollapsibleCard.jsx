import React, { useCallback, useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/core/lib/utils';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { readCollapsePreference, writeCollapsePreference } from '@/core/lib/collapsePreference';

/**
 * Card de seção COLAPSÁVEL, com a preferência lembrada por usuário.
 *
 * É o card compacto usado nas seções do dia de jogo (ícone + título + contagem
 * no cabeçalho, ações à direita). O visual segue o mesmo desenho do
 * `V2Collapsible` das telas de torneio, para que as duas áreas da plataforma
 * se pareçam.
 *
 * Três cuidados que valem o comentário:
 *
 * 1. **As ações ficam FORA do botão.** Um `<button>` dentro de outro `<button>`
 *    é HTML inválido e o clique em "Sortear" recolheria a seção junto. Por isso
 *    o cabeçalho é uma linha com dois filhos irmãos: o botão que alterna e a
 *    área de ações.
 * 2. **`sectionId` não leva o id do dia de jogo.** A preferência é do TIPO de
 *    seção ("Jogos", "Participantes"), não daquele dia específico: quem recolhe
 *    "Participantes" quer encontrá-lo recolhido no próximo dia de jogo também.
 * 3. **Recolhido não pode virar mudo.** Com `summary`, o cabeçalho continua
 *    dizendo o essencial quando o corpo some.
 *
 * @param {object} props
 * @param {React.ElementType} [props.icon] ícone lucide do cabeçalho
 * @param {React.ReactNode} props.title
 * @param {number|string} [props.count] contagem exibida ao lado do título
 * @param {React.ReactNode} [props.summary] resumo curto visível só quando recolhido
 * @param {React.ReactNode} [props.actions] botões da seção (não alternam nada)
 * @param {string} props.sectionId identificador ESTÁVEL da seção
 * @param {boolean} [props.defaultCollapsed=false] estado na primeira vez
 * @param {string} [props.className] classes do card
 * @param {string} [props.bodyClassName] classes do corpo
 */
export default function V2CollapsibleCard({
  icon: Icon,
  title,
  count,
  summary,
  actions,
  sectionId,
  defaultCollapsed = false,
  className,
  bodyClassName,
  children,
}) {
  const { user } = useAuth();
  const uid = user?.uid || null;
  const bodyId = useId();

  // Lê a preferência UMA vez, na montagem. `null` = nunca salva → usa o padrão.
  const [collapsed, setCollapsed] = useState(() => {
    const saved = readCollapsePreference(uid, sectionId);
    return saved === null ? defaultCollapsed : saved;
  });

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      writeCollapsePreference(uid, sectionId, next);
      return next;
    });
  }, [uid, sectionId]);

  return (
    <div
      className={cn(
        'overflow-hidden rounded-4xl border border-gray-100 bg-paper-pure shadow-organic-sm',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 px-4 py-3 sm:px-5 sm:py-3.5">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-controls={bodyId}
          className="group flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <ChevronDown
            aria-hidden="true"
            className={cn(
              'h-4 w-4 shrink-0 text-gray-400 transition-transform group-hover:text-ink',
              collapsed ? '-rotate-90' : '',
            )}
          />
          {Icon && <Icon aria-hidden="true" className="h-5 w-5 shrink-0 text-green-600" />}
          <span className="min-w-0">
            <span className="block truncate text-base font-semibold text-ink">
              {title}
              {count != null && <span className="ml-1 font-normal text-gray-400">({count})</span>}
            </span>
            {collapsed && summary && (
              <span className="mt-0.5 block truncate text-xs text-gray-500">{summary}</span>
            )}
          </span>
        </button>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>

      {/* O corpo é DESMONTADO quando recolhido (não só escondido): evita manter
          tabelas grandes e inputs de placar no DOM sem necessidade. */}
      {!collapsed && (
        <div id={bodyId} className={cn('border-t border-gray-100 p-4 sm:p-5', bodyClassName)}>
          {children}
        </div>
      )}
    </div>
  );
}
