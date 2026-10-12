/**
 * V2BracketTree — árvore visual do mata-mata (flag bracket_tree).
 *
 * Renderiza as rodadas da chave dos vencedores como colunas (rolagem horizontal),
 * cada coluna com seus confrontos espaçados. Puro de UI: recebe os jogos e o mapa
 * de rótulos por inscrição.
 */

import React from 'react';
import { cn } from '@/core/lib/utils';
import { buildBracketColumns } from '@/modules/tournament/domain/bracketLayout';

function sideScore(m, side) {
  // Confronto de EQUIPES: o placar do jogo é o número de ETAPAS vencidas.
  if (m.team_confrontation) return Number(side === 'a' ? m.etapa_wins_a : m.etapa_wins_b) || 0;
  const games = Array.isArray(m.games) ? m.games : [];
  return games.reduce((s, g) => s + (Number(g[side]) || 0), 0);
}

function SideRow({ label, score, won, decided, vazio = false }) {
  return (
    <div className={cn('flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs',
      won ? 'font-bold text-ink' : 'text-gray-600',
      vazio && 'italic text-gray-400')}>
      <span className="truncate">{label || '—'}</span>
      {decided && !vazio && <span className="tabular-nums text-gray-500">{score}</span>}
    </div>
  );
}

function MatchCard({ m, nameOf, ladoVazio }) {
  if (m.placeholder) {
    const [x, y] = m.from || [];
    return (
      <div className="overflow-hidden rounded-2xl border border-dashed border-gray-200 bg-paper">
        {m.number && <div className="px-2.5 pt-1.5 text-2xs font-semibold uppercase tracking-wider text-gray-500">Jogo {m.number}</div>}
        <SideRow label={x ? `Vencedor do jogo ${x}` : 'A definir'} vazio />
        <div className="h-px bg-gray-100" />
        <SideRow label={y ? `Vencedor do jogo ${y}` : 'A definir'} vazio />
      </div>
    );
  }
  const decided = m.winner_side === 'a' || m.winner_side === 'b';
  const aNome = nameOf(m.side_a_ids, m.side_a);
  const bNome = nameOf(m.side_b_ids, m.side_b);
  // Um lado só preenchido + bye ⇒ o outro passou direto.
  const passouDireto = (m.bye === true || m.status === 'walkover')
    && (Boolean(aNome) !== Boolean(bNome));
  const aLabel = aNome || ladoVazio(m);
  const bLabel = bNome || ladoVazio(m);
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-paper-pure">
      {m.number && <div className="px-2.5 pt-1.5 text-2xs font-semibold uppercase tracking-wider text-gray-500">Jogo {m.number}</div>}
      <SideRow
        label={aLabel}
        score={sideScore(m, 'a')}
        won={m.winner_side === 'a' || (passouDireto && Boolean(aNome))}
        decided={decided || passouDireto}
        vazio={!aNome}
      />
      <div className="h-px bg-gray-100" />
      <SideRow
        label={bLabel}
        score={sideScore(m, 'b')}
        won={m.winner_side === 'b' || (passouDireto && Boolean(bNome))}
        decided={decided || passouDireto}
        vazio={!bNome}
      />
    </div>
  );
}

export default function V2BracketTree({ matches = [], labelById, title }) {
  // As colunas são as fases finais de uma CHAVE (inteira, com as vagas que
  // ainda vão nascer), ou as RODADAS de um grupo — `buildBracketColumns`
  // decide pelo tipo da fase e já devolve os rótulos.
  const { columns, kind, thirdPlace } = buildBracketColumns(matches);
  if (columns.length === 0) {
    return <p className="rounded-2xl border border-gray-100 bg-paper p-4 text-sm text-gray-500">Sem jogos em rodadas para exibir.</p>;
  }
  const nameOf = (ids, fallback) => (ids || []).map((id) => labelById?.get?.(id) || id).join(' + ') || fallback || '';

  /**
   * Um lado VAZIO numa chave incompleta não é "a definir": é um BYE — alguém
   * passou direto porque o número de inscritos não é potência de 2. Mostrar
   * "A definir" nos dois casos faz parecer que falta sortear um adversário
   * que nunca vai existir. O bye vai para os melhores cabeças (ver
   * `buildKnockoutBracket`), então dizer isso também explica POR QUE foi
   * aquela pessoa.
   */
  const ladoVazio = (m) => {
    const ehBye = m.bye === true || m.status === 'walkover';
    return ehBye ? 'Passa direto (bye)' : 'A definir';
  };

  return (
    <div className="overflow-x-auto">
      <div className="mb-2 text-2xs font-semibold uppercase tracking-widest text-gray-500">
        {title || (kind === 'bracket' ? 'Chave — fases finais' : 'Rodadas')}
      </div>
      <div className="flex min-w-max gap-4 pb-2">
        {columns.map((col) => (
          <div key={col.round} className="flex min-w-[190px] flex-1 flex-col">
            <div className="mb-2 text-center text-2xs font-bold uppercase tracking-widest text-gray-500">{col.label}</div>
            <div className="flex flex-1 flex-col justify-around gap-3">
              {col.matches.map((m) => <MatchCard key={m.id} m={m} nameOf={nameOf} ladoVazio={ladoVazio} />)}
            </div>
          </div>
        ))}
      </div>
      {thirdPlace && (
        <div className="mt-3 max-w-[240px]">
          <div className="mb-2 text-2xs font-bold uppercase tracking-widest text-gray-500">Disputa de 3º lugar</div>
          <MatchCard m={thirdPlace} nameOf={nameOf} ladoVazio={ladoVazio} />
        </div>
      )}
      {kind === 'bracket' && (
        <p className="mt-2 text-xs text-gray-500">
          O próximo confronto nasce sozinho assim que os dois jogos que o alimentam terminam.
        </p>
      )}
    </div>
  );
}
