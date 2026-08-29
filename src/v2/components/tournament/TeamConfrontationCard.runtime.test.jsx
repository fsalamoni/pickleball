/**
 * Teste de RUNTIME do cartão de confronto da visão PÚBLICA.
 *
 * O contrato aqui é curto e inegociável: mostra tudo, não edita nada.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  TEAM_GENDER, TEAM_ETAPA_TYPE, TEAM_WIN_RULE, normalizeTeamConfig,
} from '@/modules/tournament/domain/teamFormat';
import TeamConfrontationCard from './TeamConfrontationCard.jsx';

const modality = {
  id: 'mod1',
  name: 'Equipes Mistas',
  team_config: normalizeTeamConfig({
    team_size: 4,
    gender: TEAM_GENDER.MIXED,
    win_rule: TEAM_WIN_RULE.BEST_OF,
    win_target: 2,
    etapas: [
      { type: TEAM_ETAPA_TYPE.MENS_DOUBLES },
      { type: TEAM_ETAPA_TYPE.WOMENS_DOUBLES },
    ],
  }).value,
};

const teamA = {
  id: 'tA',
  team_name: 'Alfa',
  members: [
    { user_id: 'a_m1', name: 'Bruno', gender: 'male' },
    { user_id: 'a_m2', name: 'Diego', gender: 'male' },
    { user_id: 'a_f1', name: 'Ana', gender: 'female' },
    { user_id: 'a_f2', name: 'Carla', gender: 'female' },
  ],
};
const teamB = {
  id: 'tB',
  team_name: 'Beta',
  members: [
    { user_id: 'b_m1', name: 'Erik', gender: 'male' },
    { user_id: 'b_m2', name: 'Fábio', gender: 'male' },
    { user_id: 'b_f1', name: 'Gabi', gender: 'female' },
    { user_id: 'b_f2', name: 'Helena', gender: 'female' },
  ],
};

const jogado = {
  id: 'm1',
  group: 'Grupo A',
  side_a_ids: ['tA'],
  side_b_ids: ['tB'],
  team_confrontation: true,
  status: 'finished',
  winner_side: 'a',
  etapa_wins_a: 2,
  etapa_wins_b: 0,
  etapas: [
    { id: 'etapa_1', type: 'mens_doubles', side_a: ['a_m1', 'a_m2'], side_b: ['b_m1', 'b_m2'], games: [{ a: 11, b: 7 }] },
    { id: 'etapa_2', type: 'womens_doubles', side_a: ['a_f1', 'a_f2'], side_b: ['b_f1', 'b_f2'], games: [{ a: 11, b: 9 }] },
  ],
};

let container;
let root;

function mount(props = {}) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  React.act(() => {
    root.render(
      <TeamConfrontationCard modality={modality} match={jogado} teamA={teamA} teamB={teamB} {...props} />,
    );
  });
}

beforeEach(() => {});
afterEach(() => {
  React.act(() => root.unmount());
  container.remove();
});

describe('TeamConfrontationCard (runtime)', () => {
  it('fechado, mostra as equipes, o placar em etapas e o vencedor', () => {
    mount();
    const text = container.textContent;
    expect(text).toContain('Alfa');
    expect(text).toContain('Beta');
    expect(text).toContain('2 – 0');
    // Detalhe só aparece ao ampliar.
    expect(text).not.toContain('Dupla masculina');
  });

  it('ampliado, mostra etapa a etapa: quem jogou, games e vencedor', () => {
    mount({ defaultOpen: true });
    const text = container.textContent;
    expect(text).toContain('Grupo A');
    expect(text).toContain('Dupla masculina');
    expect(text).toContain('Bruno / Diego');
    expect(text).toContain('Erik / Fábio');
    expect(text).toContain('11 × 7');
    expect(text).toContain('Pontos somados');
  });

  it('não tem NENHUM campo editável', () => {
    mount({ defaultOpen: true });
    expect(container.querySelectorAll('input')).toHaveLength(0);
    expect(container.querySelectorAll('select')).toHaveLength(0);
    expect(container.querySelectorAll('textarea')).toHaveLength(0);
    // O único botão é o de ampliar/recolher.
    expect(container.querySelectorAll('button')).toHaveLength(1);
  });

  it('confronto ainda não escalado avisa o estado, sem oferecer ação', () => {
    mount({ match: { ...jogado, status: 'scheduled', winner_side: null, etapa_wins_a: 0, etapa_wins_b: 0, etapas: [] } });
    expect(container.textContent).toContain('Aguardando escalação');
    expect(container.querySelectorAll('button')).toHaveLength(1);
  });

  it('equipe ainda indefinida (aguarda fase anterior) aparece como “A definir”', () => {
    mount({ teamB: undefined, match: { ...jogado, etapas: [] } });
    expect(container.textContent).toContain('A definir');
  });
});
