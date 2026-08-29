/**
 * Teste de RUNTIME dos dois diálogos do organizador num CONFRONTO de equipes:
 * INICIAR PARTIDA (escalação) e LANÇAR RESULTADO (games de cada etapa).
 *
 * Os diálogos são Radix (portal): as consultas são no `document.body`.
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

const { TeamLineupDialog, TeamResultDialog } = await import('./TeamConfrontationDialogs.jsx');

/** Modalidade: equipe mista de 4, 3 etapas (masc, fem, mista), melhor de 2. */
function teamModality(configOverrides = null) {
  return {
    id: 'mod1',
    name: 'Equipes Mistas',
    team_config: configOverrides || normalizeTeamConfig({
      team_size: 4,
      gender: TEAM_GENDER.MIXED,
      win_rule: TEAM_WIN_RULE.BEST_OF,
      win_target: 2,
      etapas: [
        { type: TEAM_ETAPA_TYPE.MENS_DOUBLES },
        { type: TEAM_ETAPA_TYPE.WOMENS_DOUBLES },
        { type: TEAM_ETAPA_TYPE.MIXED_DOUBLES },
      ],
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

/** Confronto já escalado (sem placar). */
const escalado = {
  id: 'm1',
  tournament_id: 't1',
  side_a_ids: ['tA'],
  side_b_ids: ['tB'],
  team_confrontation: true,
  status: 'in_progress',
  etapas: [
    { id: 'etapa_1', type: 'mens_doubles', side_a: ['a_m1', 'a_m2'], side_b: ['b_m1', 'b_m2'], games: [] },
    { id: 'etapa_2', type: 'womens_doubles', side_a: ['a_f1', 'a_f2'], side_b: ['b_f1', 'b_f2'], games: [] },
    { id: 'etapa_3', type: 'mixed_doubles', side_a: ['a_m1', 'a_f1'], side_b: ['b_m1', 'b_f1'], games: [] },
  ],
};

const vazio = {
  id: 'm1', tournament_id: 't1', side_a_ids: ['tA'], side_b_ids: ['tB'],
  team_confrontation: true, status: 'scheduled', etapas: [],
};

let host;
let root;

function mount(Component, props = {}) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  React.act(() => {
    root.render(
      <Component
        open
        modality={teamModality()}
        teamA={teamA}
        teamB={teamB}
        onClose={() => {}}
        {...props}
      />,
    );
  });
}

const body = () => document.body;
const selectByLabel = (label) => body().querySelector(`select[aria-label="${label}"]`);
const inputByLabel = (label) => body().querySelector(`input[aria-label="${label}"]`);
const buttonWith = (text) => [...body().querySelectorAll('button')].find((b) => (b.textContent || '').includes(text));
const optionsOf = (sel) => [...sel.querySelectorAll('option')].map((o) => o.textContent).filter((t) => t !== '—');

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

beforeEach(() => { recordMutate.mockClear(); });
afterEach(() => {
  React.act(() => root.unmount());
  host.remove();
  document.body.innerHTML = '';
});

describe('TeamLineupDialog — iniciar partida (escalação)', () => {
  it('abre como “Iniciar partida” num confronto ainda não escalado', () => {
    mount(TeamLineupDialog, { match: vazio });
    expect(body().textContent).toContain('Iniciar partida');
    expect(body().textContent).toContain('O placar é lançado depois');
    // Uma vaga por posição, dos dois lados, em cada etapa.
    expect(selectByLabel('Dupla masculina — Alfa — Atleta 1')).toBeTruthy();
    expect(selectByLabel('Dupla masculina — Beta — Atleta 2')).toBeTruthy();
    expect(selectByLabel('Dupla mista — Alfa — Masculino')).toBeTruthy();
    expect(selectByLabel('Dupla mista — Beta — Feminina')).toBeTruthy();
  });

  it('cada vaga só oferece quem serve a ela', () => {
    mount(TeamLineupDialog, { match: vazio });
    expect(optionsOf(selectByLabel('Dupla masculina — Alfa — Atleta 1'))).toEqual(['Bruno', 'Diego']);
    expect(optionsOf(selectByLabel('Dupla feminina — Alfa — Atleta 1'))).toEqual(['Ana', 'Carla']);
    expect(optionsOf(selectByLabel('Dupla mista — Beta — Feminina'))).toEqual(['Gabi', 'Helena']);
  });

  it('num confronto já escalado, vira “Editar escalação” com os nomes carregados', () => {
    mount(TeamLineupDialog, { match: escalado });
    expect(body().textContent).toContain('Editar escalação');
    expect(selectByLabel('Dupla masculina — Alfa — Atleta 1').value).toBe('a_m1');
    expect(selectByLabel('Dupla mista — Beta — Feminina').value).toBe('b_f1');
  });

  it('salva a escalação sem tocar no placar', async () => {
    mount(TeamLineupDialog, { match: vazio });
    React.act(() => { buttonWith('Escalação sugerida').click(); });
    await React.act(async () => { buttonWith('Iniciar partida').click(); });

    expect(recordMutate).toHaveBeenCalledTimes(1);
    const payload = recordMutate.mock.calls[0][0];
    expect(payload.matchId).toBe('m1');
    expect(payload.etapas).toHaveLength(3);
    expect(payload.etapas[0].side_a).toEqual(['a_m1', 'a_m2']);
    expect(payload.etapas[0].games).toEqual([]);
    expect(payload.etapas[0].winner_side).toBeNull();
  });

  it('simples em rodízio pede a ORDEM de entrada', () => {
    const config = normalizeTeamConfig({
      team_size: 4, gender: TEAM_GENDER.MIXED, win_rule: TEAM_WIN_RULE.ALL,
      singles_mode: TEAM_SINGLES_MODE.ROTATING, singles_rotation_points: 5,
      etapas: [{ type: TEAM_ETAPA_TYPE.SINGLES }],
    }).value;
    mount(TeamLineupDialog, { match: vazio, modality: teamModality(config) });
    expect(body().textContent).toContain('ORDEM de entrada');
    expect(body().textContent).toContain('troca a cada 5 pontos');
    expect(selectByLabel('Simples — Alfa — 1º a jogar')).toBeTruthy();
    expect(selectByLabel('Simples — Alfa — 4º a jogar')).toBeTruthy();
  });
});

describe('TeamResultDialog — lançar resultado (games)', () => {
  it('mostra a escalação em leitura e um campo por game', () => {
    mount(TeamResultDialog, { match: escalado });
    expect(body().textContent).toContain('Lançar resultado');
    expect(body().textContent).toContain('Bruno / Diego');
    // Escalação não é editável aqui.
    expect(body().querySelectorAll('select')).toHaveLength(0);
    expect(inputByLabel('Dupla masculina — game 1, Alfa')).toBeTruthy();
  });

  it('apura ao vivo e salva os games de cada etapa', async () => {
    mount(TeamResultDialog, { match: escalado });
    setValue(inputByLabel('Dupla masculina — game 1, Alfa'), '11');
    setValue(inputByLabel('Dupla masculina — game 1, Beta'), '7');
    setValue(inputByLabel('Dupla feminina — game 1, Alfa'), '11');
    setValue(inputByLabel('Dupla feminina — game 1, Beta'), '9');

    // Melhor de 2 etapas: a Alfa já venceu o confronto.
    expect(body().textContent).toContain('Vencedor: Alfa');

    await React.act(async () => { buttonWith('Salvar resultado').click(); });
    const payload = recordMutate.mock.calls[0][0];
    expect(payload.etapas[0]).toMatchObject({
      games: [{ a: 11, b: 7 }], sets_a: 1, sets_b: 0, winner_side: 'a', score_a: 11, score_b: 7,
    });
    expect(payload.etapas[2].games).toEqual([]); // a mista não foi disputada
  });

  it('avisa quando o confronto ainda não foi escalado e oferece o atalho', () => {
    const onEditLineup = vi.fn();
    mount(TeamResultDialog, { match: vazio, onEditLineup });
    expect(body().textContent).toContain('ainda não foi escalado');
    React.act(() => { buttonWith('Iniciar partida').click(); });
    expect(onEditLineup).toHaveBeenCalled();
  });

  it('aponta placar fora da regra do game', () => {
    mount(TeamResultDialog, { match: escalado });
    setValue(inputByLabel('Dupla masculina — game 1, Alfa'), '11');
    setValue(inputByLabel('Dupla masculina — game 1, Beta'), '10');
    expect(body().textContent).toContain('2 pontos de vantagem');
  });

  it('melhor de 3: abre três games na etapa', () => {
    const config = normalizeTeamConfig({
      team_size: 4, gender: TEAM_GENDER.MIXED, sets_per_etapa: 3, win_rule: TEAM_WIN_RULE.ALL,
      etapas: [{ type: TEAM_ETAPA_TYPE.MENS_DOUBLES }],
    }).value;
    mount(TeamResultDialog, { match: escalado, modality: teamModality(config) });
    expect(body().textContent).toContain('11 pontos · melhor de 3');
    expect(inputByLabel('Dupla masculina — game 3, Beta')).toBeTruthy();
  });
});
