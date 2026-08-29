/**
 * Teste de RUNTIME do painel de CONFRONTO de equipes.
 *
 * Monta o componente de verdade (React DOM em jsdom), com o serviço mockado, e
 * cobre o que o organizador faz: escalar cada etapa respeitando o gênero,
 * lançar os games (jogo único ou melhor de 3), ver a apuração ao vivo e salvar
 * — além da visão pública, somente leitura.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  TEAM_GENDER, TEAM_ETAPA_TYPE, TEAM_WIN_RULE, TEAM_SINGLES_MODE, normalizeTeamConfig,
} from '@/modules/tournament/domain/teamFormat';

const recordMutate = vi.fn(() => Promise.resolve({}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/modules/tournament/hooks/useTeams', () => ({
  useRecordConfrontation: () => ({ mutateAsync: recordMutate, isPending: false }),
}));

const { default: TeamConfrontationPanel } = await import('./TeamConfrontationPanel.jsx');

/** Modalidade: equipe mista de 4, 3 etapas (masc, fem, mista), melhor de 2. */
function teamModality(overrides = {}) {
  return {
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
        { type: TEAM_ETAPA_TYPE.MIXED_DOUBLES },
      ],
      ...overrides,
    }).value,
  };
}

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

const baseMatch = {
  id: 'm1',
  tournament_id: 't1',
  side_a_ids: ['tA'],
  side_b_ids: ['tB'],
  team_confrontation: true,
  etapas: [],
  status: 'scheduled',
  group: 'Grupo A',
};

let container;
let root;

function mount(props = {}) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  React.act(() => {
    root.render(
      <TeamConfrontationPanel
        modality={teamModality()}
        match={baseMatch}
        teamA={teamA}
        teamB={teamB}
        isAdmin
        defaultOpen
        {...props}
      />,
    );
  });
}

function selectByLabel(label) {
  return container.querySelector(`select[aria-label="${label}"]`);
}
function inputByLabel(label) {
  return container.querySelector(`input[aria-label="${label}"]`);
}
function optionsOf(select) {
  return [...select.querySelectorAll('option')].map((o) => o.textContent).filter((t) => t !== '—');
}
function setValue(el, value) {
  const proto = el instanceof window.HTMLSelectElement
    ? window.HTMLSelectElement.prototype
    : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
  React.act(() => {
    setter.call(el, value);
    el.dispatchEvent(new Event(el instanceof window.HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
}
function buttonWith(text) {
  return [...container.querySelectorAll('button')].find((b) => (b.textContent || '').includes(text));
}

beforeEach(() => { recordMutate.mockClear(); });
afterEach(() => {
  React.act(() => root.unmount());
  container.remove();
});

describe('TeamConfrontationPanel (runtime)', () => {
  it('mostra uma linha por etapa, com a regra de placar de cada uma', () => {
    mount();
    const text = container.textContent;
    expect(text).toContain('Dupla masculina');
    expect(text).toContain('Dupla feminina');
    expect(text).toContain('Dupla mista');
    expect(text).toContain('11 pontos · game único');
    expect(text).toContain('Melhor de 2 etapas');
    expect(text).toContain('Grupo A');
  });

  it('cada vaga da escalação só oferece atletas do gênero que a etapa exige', () => {
    mount();
    // Dupla masculina: só homens da equipe A.
    expect(optionsOf(selectByLabel('Dupla masculina — Atleta 1'))).toEqual(['Bruno', 'Diego']);
    // Dupla feminina: só mulheres.
    expect(optionsOf(selectByLabel('Dupla feminina — Atleta 1'))).toEqual(['Ana', 'Carla']);
    // Mista: vaga masculina e vaga feminina, nessa ordem.
    expect(optionsOf(selectByLabel('Dupla mista — Masculino'))).toEqual(['Bruno', 'Diego']);
    expect(optionsOf(selectByLabel('Dupla mista — Feminina'))).toEqual(['Ana', 'Carla']);
    // Lado B tem o próprio elenco.
    expect(optionsOf(selectByLabel('Dupla masculina — Atleta 2'))).toEqual(['Bruno', 'Diego']);
  });

  it('a mesma pessoa não pode ocupar as duas vagas da mesma dupla', () => {
    mount();
    setValue(selectByLabel('Dupla masculina — Atleta 1'), 'a_m1');
    expect(optionsOf(selectByLabel('Dupla masculina — Atleta 2'))).toEqual(['Diego']);
  });

  it('“Escalação sugerida” preenche as etapas de forma válida', () => {
    mount();
    React.act(() => { buttonWith('Escalação sugerida').click(); });
    expect(selectByLabel('Dupla masculina — Atleta 1').value).toBe('a_m1');
    expect(selectByLabel('Dupla feminina — Atleta 1').value).toBe('a_f1');
    expect(selectByLabel('Dupla mista — Masculino').value).toBe('a_m1');
    expect(selectByLabel('Dupla mista — Feminina').value).toBe('a_f1');
  });

  it('lança os games e apura o confronto ao vivo, salvando o payload por etapa', async () => {
    mount();
    React.act(() => { buttonWith('Escalação sugerida').click(); });

    setValue(inputByLabel('Dupla masculina — game 1, Alfa'), '11');
    setValue(inputByLabel('Dupla masculina — game 1, Beta'), '7');
    setValue(inputByLabel('Dupla feminina — game 1, Alfa'), '9');
    setValue(inputByLabel('Dupla feminina — game 1, Beta'), '11');
    setValue(inputByLabel('Dupla mista — game 1, Alfa'), '11');
    setValue(inputByLabel('Dupla mista — game 1, Beta'), '5');

    // 2 etapas para a Alfa = melhor de 2 → confronto decidido.
    expect(container.textContent).toContain('2 – 1');

    await React.act(async () => { buttonWith('Salvar confronto').click(); });
    expect(recordMutate).toHaveBeenCalledTimes(1);
    const payload = recordMutate.mock.calls[0][0];
    expect(payload.matchId).toBe('m1');
    expect(payload.validate).toBe(true);
    expect(payload.etapas).toHaveLength(3);
    expect(payload.etapas[0]).toMatchObject({
      id: 'etapa_1', side_a: ['a_m1', 'a_m2'], side_b: ['b_m1', 'b_m2'],
      games: [{ a: 11, b: 7 }], sets_a: 1, sets_b: 0, winner_side: 'a',
    });
    expect(payload.etapas[1].winner_side).toBe('b');
    // Os uids reais das duas equipes habilitam o espelho no ranking individual.
    expect(payload.validUids).toContain('a_m1');
    expect(payload.validUids).toContain('b_f2');
  });

  it('etapa em melhor de 3 abre três games e só decide com 2 vencidos', () => {
    const modality = teamModality();
    modality.team_config = normalizeTeamConfig({
      team_size: 4,
      gender: TEAM_GENDER.MIXED,
      sets_per_etapa: 3,
      win_rule: TEAM_WIN_RULE.ALL,
      etapas: [{ type: TEAM_ETAPA_TYPE.MENS_DOUBLES }],
    }).value;
    mount({ modality });

    expect(container.textContent).toContain('11 pontos · melhor de 3');
    expect(inputByLabel('Dupla masculina — game 3, Alfa')).toBeTruthy();

    setValue(inputByLabel('Dupla masculina — game 1, Alfa'), '11');
    setValue(inputByLabel('Dupla masculina — game 1, Beta'), '5');
    expect(container.textContent).toContain('0 – 0'); // ainda não decidiu a etapa
    setValue(inputByLabel('Dupla masculina — game 2, Alfa'), '11');
    setValue(inputByLabel('Dupla masculina — game 2, Beta'), '8');
    expect(container.textContent).toContain('1 – 0');
  });

  it('simples em rodízio escala a ordem de entrada dos atletas', () => {
    const modality = teamModality();
    modality.team_config = normalizeTeamConfig({
      team_size: 4,
      gender: TEAM_GENDER.MIXED,
      singles_mode: TEAM_SINGLES_MODE.ROTATING,
      singles_rotation_points: 5,
      win_rule: TEAM_WIN_RULE.ALL,
      etapas: [{ type: TEAM_ETAPA_TYPE.SINGLES }],
    }).value;
    mount({ modality });

    expect(container.textContent).toContain('troca a cada 5 pontos');
    expect(selectByLabel('Simples — 1º a jogar')).toBeTruthy();
    expect(selectByLabel('Simples — 4º a jogar')).toBeTruthy();

    React.act(() => { buttonWith('Escalação sugerida').click(); });
    expect(selectByLabel('Simples — 1º a jogar').value).toBe('a_m1');
    expect(selectByLabel('Simples — 4º a jogar').value).toBe('a_f2');
  });

  it('avisa quando o placar não fecha a regra do game', () => {
    mount();
    setValue(inputByLabel('Dupla masculina — game 1, Alfa'), '11');
    setValue(inputByLabel('Dupla masculina — game 1, Beta'), '10');
    expect(container.textContent).toContain('2 pontos de vantagem');
  });

  it('visão pública é somente leitura, com a escalação e os games já lançados', () => {
    const match = {
      ...baseMatch,
      status: 'finished',
      etapas: [
        { id: 'etapa_1', side_a: ['a_m1', 'a_m2'], side_b: ['b_m1', 'b_m2'], games: [{ a: 11, b: 7 }] },
      ],
    };
    mount({ isAdmin: false, match });
    expect(container.querySelectorAll('select')).toHaveLength(0);
    expect(container.querySelectorAll('input')).toHaveLength(0);
    expect(buttonWith('Salvar confronto')).toBeUndefined();
    expect(container.textContent).toContain('Bruno / Diego');
    expect(container.textContent).toContain('11 × 7');
  });
});
