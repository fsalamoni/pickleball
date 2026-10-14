/**
 * V2BracketTree — o DIAGRAMA do mata-mata.
 *
 * A chave inteira desde o sorteio: os classificados na 1ª rodada, as vagas
 * futuras com o título do confronto ("Vencedor do jogo 3"), as linhas ligando
 * cada jogo ao seguinte e, no fim, o campeão. Na dupla eliminação, a
 * repescagem vem desenhada embaixo, com as mesmas ligações.
 *
 * Mata-mata nunca vira tabela: grupo e rodadas continuam nas tabelas de
 * sempre (`buildKnockoutDiagram` devolve `null` para eles).
 *
 * Puro de UI: recebe os jogos da FASE e o mapa de rótulos por inscrição.
 * `onMatchClick` torna cada jogo um botão (quem organiza lança o resultado).
 */

import React, { useMemo } from 'react';
import { Trophy } from 'lucide-react';
import { cn } from '@/core/lib/utils';
import {
  buildKnockoutDiagram, layoutBracketColumns, refLabel,
} from '@/modules/tournament/domain/bracketLayout';
import { t } from '@/core/i18n';

const CARD_W = 212;
const CARD_H = 88;
const GAP_X = 40;
const GAP_Y = 16;
const HEAD_H = 28; // rótulo da coluna (Quartas, Semifinal…)

function sideGames(m, side) {
  // Confronto de EQUIPES: o placar do jogo é o número de ETAPAS vencidas.
  if (m.team_confrontation) return [Number(side === 'a' ? m.etapa_wins_a : m.etapa_wins_b) || 0];
  return (Array.isArray(m.games) ? m.games : []).map((g) => Number(g[side]) || 0);
}

function Side({ label, games, won, lost, vazio }) {
  return (
    <div className={cn(
      'relative flex h-[30px] items-center justify-between gap-2 pl-3 pr-2.5 text-xs',
      won && 'bg-acid/15 font-bold text-ink',
      lost && 'text-gray-500',
      !won && !lost && !vazio && 'text-ink',
      vazio && 'italic text-gray-500',
    )}>
      {won && <span aria-hidden className="absolute inset-y-1 left-0 w-1 rounded-r-full bg-acid" />}
      <span className="truncate" title={label}>{label}</span>
      {games.length > 0 && (
        <span className="flex shrink-0 gap-1.5 tabular-nums">
          {games.map((g, i) => <span key={i}>{g}</span>)}
        </span>
      )}
    </div>
  );
}

function statusChip(m) {
  if (m.placeholder) return null;
  if (m.status === 'in_progress') {
    return (
      <span className="inline-flex items-center gap-1 text-ink">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-acid ring-2 ring-acid/30" /> {t('Em quadra')}
      </span>
    );
  }
  if (m.bye) return t('Passa direto');
  if (m.status === 'walkover') return 'W.O.';
  if (m.winner_side) return t('Encerrado');
  return m.court ? String(m.court) : null;
}

function MatchCard({ m, nameOf, onClick }) {
  const decided = m.winner_side === 'a' || m.winner_side === 'b';
  const aNome = m.placeholder ? '' : nameOf(m.side_a_ids, m.side_a);
  const bNome = m.placeholder ? '' : nameOf(m.side_b_ids, m.side_b);
  const ehBye = m.bye === true || m.status === 'walkover';
  // Lado vazio: num bye é "passa direto"; senão é a vaga de quem ainda vai
  // chegar — e aí o título diz DE ONDE ("Vencedor do jogo 3").
  const vazioDe = (i) => (ehBye && !m.placeholder ? t('Passa direto (bye)') : refLabel(m.refs?.[i]));
  const passouDireto = ehBye && (Boolean(aNome) !== Boolean(bNome));
  const aWon = m.winner_side === 'a' || (passouDireto && Boolean(aNome));
  const bWon = m.winner_side === 'b' || (passouDireto && Boolean(bNome));
  const chip = statusChip(m);
  const clicavel = onClick && !m.placeholder && !(ehBye && passouDireto);
  const Tag = clicavel ? 'button' : 'div';
  const titulo = m.third_place ? t('Disputa de 3º lugar') : t('Jogo {number}', { number: m.number });

  return (
    <Tag
      {...(clicavel ? {
        type: 'button',
        onClick: () => onClick(m),
        'aria-label': t('{titulo}: {v2} contra {v3}. Abrir ações do jogo', { titulo, v2: aNome || vazioDe(0), v3: bNome || vazioDe(1) }),
      } : {})}
      style={{ width: CARD_W, height: CARD_H }}
      className={cn(
        'flex flex-col overflow-hidden rounded-xl border text-left',
        m.placeholder ? 'border-dashed border-gray-300 bg-paper' : 'border-gray-200 bg-paper-pure shadow-sm',
        m.status === 'in_progress' && 'border-acid ring-2 ring-acid/30',
        clicavel && 'transition hover:border-ink hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink',
      )}
    >
      <div className="flex h-[26px] shrink-0 items-center justify-between gap-2 border-b border-gray-100 px-3 text-2xs font-semibold uppercase tracking-wider text-gray-500">
        <span className="truncate">{titulo}</span>
        {chip && <span className="shrink-0 normal-case tracking-normal">{chip}</span>}
      </div>
      <Side
        label={aNome || vazioDe(0)}
        games={decided ? sideGames(m, 'a') : []}
        won={aWon}
        lost={decided && !aWon}
        vazio={!aNome}
      />
      <div className="h-px shrink-0 bg-gray-100" />
      <Side
        label={bNome || vazioDe(1)}
        games={decided ? sideGames(m, 'b') : []}
        won={bWon}
        lost={decided && !bWon}
        vazio={!bNome}
      />
    </Tag>
  );
}

function ChampionCard({ nome, aguardando }) {
  return (
    <div
      style={{ width: CARD_W, height: CARD_H }}
      className={cn(
        'flex flex-col items-center justify-center gap-1 rounded-xl px-3 text-center',
        nome ? 'bg-ink text-white shadow-md' : 'border border-dashed border-gray-300 bg-paper',
      )}
    >
      <span className={cn('inline-flex items-center gap-1.5 text-2xs font-bold uppercase tracking-widest', nome ? 'text-acid' : 'text-gray-500')}>
        <Trophy className="h-3.5 w-3.5" aria-hidden /> {t('Campeão')}
      </span>
      <span className={cn('w-full truncate font-display text-sm font-bold', nome ? 'text-white' : 'italic text-gray-500')} title={nome || aguardando}>
        {nome || aguardando}
      </span>
    </div>
  );
}

/** Uma seção desenhada: colunas posicionadas + as linhas entre elas. */
function Section({ section, nameOf, onMatchClick, champion, thirdPlace }) {
  const cols = section.columns;
  const { ys, height: baseH } = layoutBracketColumns(cols, { cardH: CARD_H, gapY: GAP_Y });
  const x = (ci) => ci * (CARD_W + GAP_X);
  const ultima = cols.length - 1;
  const finalY = ys[ultima]?.[0] ?? CARD_H / 2;
  const thirdY = thirdPlace ? finalY + CARD_H + 32 : null;
  const champCol = champion ? cols.length : null;
  const height = Math.max(baseH, thirdPlace ? thirdY + CARD_H / 2 : 0);
  const width = x(cols.length + (champion ? 1 : 0)) - GAP_X;

  const linhas = [];
  cols.forEach((col, ci) => {
    if (ci === 0) return;
    col.cells.forEach((cell, i) => {
      (cell.feeders || []).forEach((k) => {
        const y1 = ys[ci - 1][k];
        if (y1 == null) return;
        const origem = cols[ci - 1].cells[k];
        linhas.push({
          key: `${ci}-${i}-${k}`,
          d: `M ${x(ci - 1) + CARD_W} ${y1} H ${x(ci) - GAP_X / 2} V ${ys[ci][i]} H ${x(ci)}`,
          // O caminho de quem AVANÇOU fica marcado: dá para ler a chave
          // seguindo a linha escura até o campeão.
          forte: Boolean(origem?.winner_side) && !origem?.placeholder,
        });
      });
    });
  });
  if (champion) {
    const fin = cols[ultima].cells[0];
    linhas.push({
      key: 'campeao',
      d: `M ${x(ultima) + CARD_W} ${finalY} H ${x(champCol)}`,
      forte: Boolean(champion.nome),
    });
    if (fin?.placeholder) linhas[linhas.length - 1].forte = false;
  }

  return (
    <div>
      {section.title && (
        <div className="mb-2 font-display text-sm font-bold text-ink">{section.title}</div>
      )}
      <div className="relative" style={{ width, height: height + HEAD_H }}>
        {cols.map((col, ci) => (
          <div
            key={`h-${col.round}`}
            className="absolute top-0 truncate text-center text-2xs font-bold uppercase tracking-widest text-gray-500"
            style={{ left: x(ci), width: CARD_W }}
          >
            {col.label}
          </div>
        ))}
        <svg
          aria-hidden
          data-linhas
          className="pointer-events-none absolute left-0"
          style={{ top: HEAD_H }}
          width={width}
          height={height}
          fill="none"
        >
          {linhas.map((l) => (
            <path
              key={l.key}
              d={l.d}
              strokeWidth={l.forte ? 2 : 1.5}
              strokeLinejoin="round"
              className={l.forte ? 'stroke-ink' : 'stroke-gray-300'}
            />
          ))}
        </svg>
        {cols.map((col, ci) => col.cells.map((m, i) => (
          <div key={m.id} className="absolute" style={{ left: x(ci), top: HEAD_H + ys[ci][i] - CARD_H / 2 }}>
            <MatchCard m={m} nameOf={nameOf} onClick={onMatchClick} />
          </div>
        )))}
        {thirdPlace && (
          <div className="absolute" style={{ left: x(ultima), top: HEAD_H + thirdY - CARD_H / 2 }}>
            <MatchCard m={thirdPlace} nameOf={nameOf} onClick={onMatchClick} />
          </div>
        )}
        {champion && (
          <div className="absolute" style={{ left: x(champCol), top: HEAD_H + finalY - CARD_H / 2 }}>
            <ChampionCard nome={champion.nome} aguardando={refLabel(champion.ref)} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function V2BracketTree({
  matches = [], labelById, title, onMatchClick, thirdPlace = false, double = false, larguraMax,
}) {
  const diagram = useMemo(
    () => buildKnockoutDiagram(matches, { thirdPlace, double }),
    [matches, thirdPlace, double],
  );
  if (!diagram) return null;
  const nameOf = (ids, fallback) => (ids || []).map((id) => labelById?.get?.(id) || id).join(' + ') || fallback || '';
  const champion = {
    nome: diagram.champion.ids ? nameOf(diagram.champion.ids) : '',
    ref: diagram.champion.ref,
  };
  // Impressão: a folha tem largura fixa — a chave inteira encolhe para caber.
  const larguraTotal = (diagram.sections[0].columns.length + 1) * (CARD_W + GAP_X);
  const zoom = larguraMax ? Math.min(1, larguraMax / larguraTotal) : 1;

  return (
    <div>
      {title && (
        <div className="mb-2 text-2xs font-semibold uppercase tracking-widest text-gray-500">{title}</div>
      )}
      <div className="overflow-x-auto overscroll-x-contain rounded-2xl border border-gray-100 bg-paper/60 p-4">
        <div className="min-w-max space-y-8" style={zoom < 1 ? { zoom } : undefined}>
          {diagram.sections.map((s, si) => (
            <Section
              key={s.key}
              section={s}
              nameOf={nameOf}
              onMatchClick={onMatchClick}
              champion={si === 0 ? champion : null}
              thirdPlace={si === 0 ? diagram.thirdPlace : null}
            />
          ))}
        </div>
      </div>
      <p className="mt-2 text-xs text-gray-500">
        {t('O próximo confronto nasce sozinho assim que os dois jogos que o alimentam terminam.')}
        <span className="sm:hidden"> {t('Arraste para o lado para ver a chave inteira.')}</span>
      </p>
    </div>
  );
}
