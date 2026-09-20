import React, { useMemo, useState } from 'react';
import { SlidersHorizontal, ChevronDown, ChevronRight, Pencil } from 'lucide-react';
import { describePhaseRules } from '@/modules/tournament/domain/phaseRules';

/**
 * O que está EM VIGOR nesta fase, ao lado do botão que age sobre ela.
 *
 * A configuração mora em **Modalidades** e o sorteio acontece em **Sorteio**:
 * quem organiza clicava em "Sortear" e em "Gerar próxima fase" sem nenhum eco
 * do que tinha configurado. E esses botões fazem uma conta invisível —
 * classificar pela ordem de desempate escolhida, comparar grupos de tamanhos
 * diferentes, chamar repescados, encaixar quem entra direto.
 *
 * Por padrão mostra só o que o organizador MUDOU (o resto é o padrão da
 * plataforma, e repetir o padrão para todo mundo vira paredão de texto que
 * ninguém lê). "Ver todas as regras" abre a lista inteira com o porquê de
 * cada uma.
 */
export default function PhaseRulesSummary({ phase, isFirst, isLast, groupCount, onEdit }) {
  const [aberto, setAberto] = useState(false);
  const { rows, changedCount } = useMemo(
    () => describePhaseRules(phase, { isFirst, isLast, groupCount }),
    [phase, isFirst, isLast, groupCount],
  );
  if (rows.length === 0) return null;

  const visiveis = aberto ? rows : rows.filter((r) => r.changed);
  const Chevron = aberto ? ChevronDown : ChevronRight;

  return (
    <div className="rounded-md border border-gray-200 bg-paper/60 p-2.5 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 font-semibold text-gray-700">
          <SlidersHorizontal className="h-3.5 w-3.5 text-gray-400" />
          Regras desta fase
          {changedCount > 0 && (
            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
              {changedCount} ajustada{changedCount > 1 ? 's' : ''}
            </span>
          )}
        </span>
        <span className="flex items-center gap-2">
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1 text-[11px] text-gray-500 underline-offset-2 hover:underline"
            >
              <Pencil className="h-3 w-3" /> Editar
            </button>
          )}
          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            className="inline-flex items-center gap-1 text-[11px] text-gray-500 underline-offset-2 hover:underline"
          >
            <Chevron className="h-3 w-3" />
            {aberto ? 'Ocultar' : 'Ver todas as regras'}
          </button>
        </span>
      </div>

      {visiveis.length === 0 ? (
        <p className="mt-1.5 text-gray-500">
          Tudo nos padrões da plataforma — desempate oficial, classificação por aproveitamento
          e sem repescagem.
        </p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {visiveis.map((r) => (
            <li key={r.key} className="flex flex-wrap items-baseline gap-x-1.5">
              <span className="text-gray-500">{r.label}:</span>
              <span className={r.changed ? 'font-semibold text-amber-900' : 'font-medium text-gray-800'}>
                {r.value}
              </span>
              {aberto && <span className="w-full text-[11px] leading-snug text-gray-500">{r.help}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
