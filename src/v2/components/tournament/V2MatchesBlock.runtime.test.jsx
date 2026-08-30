/**
 * Teste de RUNTIME do placar público de um confronto de EQUIPES.
 *
 * Cobre o problema: na aba de Jogos (visão do público), o placar de um
 * confronto de equipes deve exibir TODAS as etapas separadamente, com os pontos
 * de cada game de cada etapa, além do agregado "X–Y etapas" — não apenas o total
 * de etapas vencidas.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  TEAM_GENDER, TEAM_ETAPA_TYPE, TEAM_WIN_RULE, normalizeTeamConfig,
} from '@/modules/tournament/domain/teamFormat';
import { TeamConfrontationScore } from './V2MatchesBlock.jsx';

const config = normalizeTeamConfig({
  team_size: 4,
  gender: TEAM_GENDER.MIXED,
  win_rule: TEAM_WIN_RULE.ALL,
  etapas: [
    { type: TEAM_ETAPA_TYPE.MENS_DOUBLES },
    { type: TEAM_ETAPA_TYPE.WOMENS_DOUBLES },
  ],
}).value;

let container;
let root;

function mount(match, cfg = config) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  React.act(() => {
    root.render(<TeamConfrontationScore match={match} config={cfg} />);
  });
}

afterEach(() => {
  React.act(() => root.unmount());
  container.remove();
});

describe('TeamConfrontationScore (runtime)', () => {
  beforeEach(() => {
    container = null;
    root = null;
  });

  it('mostra cada etapa com seus games e o agregado de etapas', () => {
    const match = {
      id: 'm1',
      team_confrontation: true,
      etapa_wins_a: 1,
      etapa_wins_b: 1,
      etapas: [
        { id: config.etapas[0].id, type: 'mens_doubles', games: [{ a: 11, b: 4 }] },
        { id: config.etapas[1].id, type: 'womens_doubles', games: [{ a: 9, b: 11 }] },
      ],
    };
    mount(match);
    const text = container.textContent;
    // Rótulo de cada etapa aparece.
    expect(text).toContain('Dupla masculina');
    expect(text).toContain('Dupla feminina');
    // Os pontos de cada game de cada etapa aparecem.
    expect(text).toContain('11');
    expect(text).toContain('4');
    expect(text).toContain('9');
    // O agregado por etapas aparece.
    expect(text).toContain('1–1 etapas');
  });

  it('etapa de melhor-de-3 lista todos os games disputados', () => {
    const cfg3 = normalizeTeamConfig({
      team_size: 4,
      gender: TEAM_GENDER.MALE,
      win_rule: TEAM_WIN_RULE.ALL,
      etapas: [{ type: TEAM_ETAPA_TYPE.MENS_DOUBLES, sets_per_match: 3, target_score: 11 }],
    }).value;
    const match = {
      id: 'm2',
      team_confrontation: true,
      etapa_wins_a: 1,
      etapa_wins_b: 0,
      etapas: [{
        id: cfg3.etapas[0].id,
        type: 'mens_doubles',
        games: [{ a: 11, b: 8 }, { a: 7, b: 11 }, { a: 11, b: 6 }],
      }],
    };
    mount(match, cfg3);
    const text = container.textContent;
    // Os três games da etapa constam do placar.
    expect(text).toContain('11');
    expect(text).toContain('8');
    expect(text).toContain('7');
    expect(text).toContain('6');
    expect(text).toContain('1–0 etapas');
  });

  it('sem nenhum game lançado, mostra travessão', () => {
    const match = {
      id: 'm3',
      team_confrontation: true,
      etapa_wins_a: 0,
      etapa_wins_b: 0,
      etapas: [
        { id: config.etapas[0].id, type: 'mens_doubles', games: [] },
        { id: config.etapas[1].id, type: 'womens_doubles', games: [] },
      ],
    };
    mount(match);
    expect(container.textContent).toContain('—');
    expect(container.textContent).not.toContain('etapas');
  });
});
