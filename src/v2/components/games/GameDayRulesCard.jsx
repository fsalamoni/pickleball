import React, { useMemo, useState } from 'react';
import { Info, ChevronDown, ChevronRight } from 'lucide-react';

import { V2Badge } from '@/v2/ui/primitives';
import { describeGameDayRules } from '@/modules/games/domain/gameDayRules';
import { useGameDayParticipants } from '@/modules/games/hooks/useGameDays';

/**
 * O que ESTE dia de jogo é — logo acima de onde se joga.
 *
 * O cabeçalho mostrava título, origem, data e observações. **Nem o formato.**
 * E o formato decide tudo o que importa para quem vai jogar: se há placar, se
 * há ranking do dia, se o resultado pode ir para o ranking da plataforma, se
 * dá para vincular uma dupla, se as partidas saem em rodadas ou quadra a
 * quadra.
 *
 * A lista de dias de jogo da ARENA já mostrava o formato num selo; a tela do
 * dia, não. A lista dizia mais que o detalhe.
 *
 * Fica dentro do `GameDayModule` de propósito: assim as TRÊS origens (atleta,
 * arena, clube) recebem o resumo por construção, sem ninguém precisar lembrar
 * de montá-lo em cada tela — que é exatamente como o clube ficou meses sem
 * Play e sem telão.
 *
 * Fechado, é uma linha: formato e o essencial. Aberto, cada linha explica o
 * porquê — porque quem já conhece o formato não precisa ler nada, e quem não
 * conhece precisa de mais do que um rótulo.
 */
export default function GameDayRulesCard({ gameDay, podeGerenciar = false }) {
  const [aberto, setAberto] = useState(false);
  // Já está no cache: as três origens carregam os participantes para decidir
  // permissões. Aqui só serve para dizer quantas vagas sobraram.
  const { data: participants = [] } = useGameDayParticipants(gameDay?.id);
  const { rows } = useMemo(
    () => describeGameDayRules(gameDay, { podeGerenciar, participantCount: participants.length }),
    [gameDay, podeGerenciar, participants.length],
  );
  if (rows.length === 0) return null;

  const [formato, ...resto] = rows;
  const Chevron = aberto ? ChevronDown : ChevronRight;

  return (
    <div className="rounded-2xl border border-gray-200 bg-paper/60 p-3">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full flex-wrap items-center justify-between gap-2 text-left"
        aria-expanded={aberto}
      >
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <Info className="h-4 w-4 shrink-0 text-gray-400" />
          <V2Badge tone="acid">{formato.value}</V2Badge>
          <span className="min-w-0 text-xs text-gray-500">{formato.help}</span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-gray-500">
          <Chevron className="h-3 w-3" />
          {aberto ? 'Ocultar' : 'Como funciona este dia'}
        </span>
      </button>

      {aberto && resto.length > 0 && (
        <ul className="mt-3 space-y-2 border-t border-gray-200 pt-3">
          {resto.map((r) => (
            <li key={r.key} className="text-xs">
              <span className="flex flex-wrap items-baseline gap-x-1.5">
                <span className="text-gray-500">{r.label}:</span>
                <span className="font-semibold text-ink">{r.value}</span>
              </span>
              <span className="mt-0.5 block leading-snug text-gray-500">{r.help}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
