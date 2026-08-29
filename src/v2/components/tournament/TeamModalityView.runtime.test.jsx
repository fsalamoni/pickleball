/**
 * Teste de RUNTIME da visão da modalidade de EQUIPES.
 *
 * Cobre a estrutura da competição na tela: os confrontos organizados como
 * foram sorteados (grupo único, grupos ou chave), a tabela de classificação de
 * cada grupo e a árvore do mata-mata — nas visões admin e pública.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  TEAM_GENDER, TEAM_ETAPA_TYPE, TEAM_WIN_RULE, normalizeTeamConfig,
} from '@/modules/tournament/domain/teamFormat';

let matches = [];
let teams = [];

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({
  useAuth: () => ({ user: { uid: 'me' }, userProfile: null }),
}));
vi.mock('@/modules/tournament/hooks/useTournament', () => ({
  useAllModalityMatches: () => ({ data: matches, isLoading: false }),
}));
vi.mock('@/modules/tournament/hooks/useTeams', () => ({
  useTeamRegistrations: () => ({ data: teams, isLoading: false }),
  useRecordConfrontation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('./TeamRegistrationDialog', () => ({ default: () => null }));

const { default: TeamModalityView } = await import('./TeamModalityView.jsx');

const config = normalizeTeamConfig({
  team_size: 2,
  gender: TEAM_GENDER.MALE,
  win_rule: TEAM_WIN_RULE.ALL,
  etapas: [{ type: TEAM_ETAPA_TYPE.MENS_DOUBLES }],
}).value;

const modality = {
  id: 'mod1', name: 'Copa por Equipes', team_config: config, stages: [{ type: 'groups' }],
};

function team(id, name) {
  return {
    id,
    team_name: name,
    members: [
      { user_id: `${id}_1`, name: `${name} 1`, gender: 'male' },
      { user_id: `${id}_2`, name: `${name} 2`, gender: 'male' },
    ],
  };
}

/** Confronto já decidido: o lado A venceu a única etapa por 11x4. */
function playedMatch({ id, a, b, group = null, round = 1, position = 1, stageIndex = 0, stageType = 'groups' }) {
  return {
    id,
    stage_index: stageIndex,
    stage_type: stageType,
    group,
    round,
    position,
    side_a_ids: [a],
    side_b_ids: [b],
    team_confrontation: true,
    status: 'finished',
    winner_side: 'a',
    etapa_wins_a: 1,
    etapa_wins_b: 0,
    points_a: 11,
    points_b: 4,
    etapas: [{
      id: 'etapa_1', type: 'mens_doubles',
      side_a: [`${a}_1`, `${a}_2`], side_b: [`${b}_1`, `${b}_2`],
      games: [{ a: 11, b: 4 }],
    }],
  };
}

let container;
let root;

function mount(props = {}) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  React.act(() => {
    root.render(
      <MemoryRouter>
        <TeamModalityView tournament={{ id: 't1' }} modality={modality} isAdmin={false} {...props} />
      </MemoryRouter>,
    );
  });
}

function clickTab(label) {
  const btn = [...container.querySelectorAll('button')].find((b) => (b.textContent || '').includes(label));
  if (!btn) throw new Error(`Aba "${label}" não encontrada`);
  React.act(() => { btn.click(); });
}

beforeEach(() => {
  matches = [];
  teams = [team('t1', 'Alfa'), team('t2', 'Beta'), team('t3', 'Gama'), team('t4', 'Delta')];
});
afterEach(() => {
  React.act(() => root.unmount());
  container.remove();
});

describe('TeamModalityView (runtime)', () => {
  it('mostra o que a modalidade define e as etapas do confronto', () => {
    mount();
    const text = container.textContent;
    expect(text).toContain('2 atletas/equipe');
    expect(text).toContain('1 etapas/confronto');
    expect(text).toContain('Todas as etapas');
    expect(text).toContain('1. Dupla masculina · 11 pontos · game único');
  });

  it('sem sorteio, orienta o organizador a sortear no painel', () => {
    mount({ isAdmin: true });
    clickTab('Confrontos');
    expect(container.textContent).toContain('Confrontos ainda não sorteados');
    expect(container.textContent).toContain('painel do organizador');
  });

  it('é somente leitura — nem o admin edita resultados por aqui', () => {
    matches = [playedMatch({ id: 'm1', a: 't1', b: 't2', group: 'Grupo A' })];
    mount({ isAdmin: true });
    clickTab('Confrontos');
    // Abre o confronto para ver as etapas.
    const card = [...container.querySelectorAll('button')].find((b) => (b.textContent || '').includes('Alfa'));
    React.act(() => { card.click(); });

    expect(container.textContent).toContain('Dupla masculina');
    // Nenhum campo editável: nem escalação, nem placar, nem salvar.
    expect(container.querySelectorAll('select')).toHaveLength(0);
    expect(container.querySelectorAll('input')).toHaveLength(0);
    expect([...container.querySelectorAll('button')].some((b) => /Salvar|Escalação sugerida/.test(b.textContent))).toBe(false);
  });

  it('o admin recebe o atalho para o painel do organizador', () => {
    mount({ isAdmin: true });
    expect(container.textContent).toContain('visão do atleta');
    const link = [...container.querySelectorAll('a')].find((a) => a.getAttribute('href') === '/torneios/t1/gerenciar');
    expect(link).toBeTruthy();
  });

  it('o atleta não vê o aviso de organizador nem botão de gestão de equipes', () => {
    mount({ isAdmin: false });
    expect(container.textContent).not.toContain('painel do organizador');
    expect([...container.querySelectorAll('button')].some((b) => b.textContent.includes('Nova equipe'))).toBe(false);
    // Mas pode inscrever a sua equipe.
    expect([...container.querySelectorAll('button')].some((b) => b.textContent.includes('Inscrever equipe'))).toBe(true);
  });

  it('com grupos, separa os confrontos por grupo', () => {
    matches = [
      playedMatch({ id: 'm1', a: 't1', b: 't2', group: 'Grupo A' }),
      playedMatch({ id: 'm2', a: 't3', b: 't4', group: 'Grupo B' }),
    ];
    mount();
    clickTab('Confrontos');
    const text = container.textContent;
    expect(text).toContain('Grupo A');
    expect(text).toContain('Grupo B');
    expect(text).toContain('Alfa');
    expect(text).toContain('Delta');
    // Cada seção anuncia quantos confrontos tem.
    expect(text).toContain('1 confronto(s)');
  });

  it('classificação: uma tabela por grupo, com posição e saldos', () => {
    matches = [
      playedMatch({ id: 'm1', a: 't1', b: 't2', group: 'Grupo A' }),
      playedMatch({ id: 'm2', a: 't3', b: 't4', group: 'Grupo B' }),
    ];
    mount();
    clickTab('Classificação');
    const text = container.textContent;
    expect(text).toContain('Grupo A');
    expect(text).toContain('Grupo B');
    expect(text).toContain('Saldo etapas');
    expect(text).toContain('Critérios de desempate');
    // A tabela do Grupo A tem Alfa em 1º (venceu) e Beta em 2º.
    const tabelas = [...container.querySelectorAll('table')];
    expect(tabelas).toHaveLength(2);
    const linhasA = [...tabelas[0].querySelectorAll('tbody tr')].map((tr) => tr.textContent);
    expect(linhasA[0]).toContain('Alfa');
    expect(linhasA[1]).toContain('Beta');
  });

  it('classificação em GRUPO ÚNICO: uma tabela só, ainda que o sorteio tenha marcado grupos', () => {
    // Regressão do problema: modalidade definida como "grupo único"
    // (division_mode: 'single') não pode exibir vários grupos na classificação,
    // mesmo que um sorteio antigo tenha gravado `m.group`.
    matches = [
      playedMatch({ id: 'm1', a: 't1', b: 't2', group: 'Grupo A' }),
      playedMatch({ id: 'm2', a: 't3', b: 't4', group: 'Grupo B' }),
    ];
    mount({ modality: { ...modality, stages: [{ type: 'groups', division_mode: 'single' }] } });
    clickTab('Classificação');
    const tabelas = [...container.querySelectorAll('table')];
    expect(tabelas).toHaveLength(1);
    const text = container.textContent;
    expect(text).not.toContain('Grupo A');
    expect(text).not.toContain('Grupo B');
    // Todas as quatro equipes numa única tabela.
    ['Alfa', 'Beta', 'Gama', 'Delta'].forEach((n) => expect(text).toContain(n));
  });

  it('em chave, nomeia as rodadas e mostra a árvore na classificação', () => {
    matches = [
      playedMatch({ id: 's1', a: 't1', b: 't2', round: 1, position: 1, stageType: 'knockout' }),
      playedMatch({ id: 's2', a: 't3', b: 't4', round: 1, position: 2, stageType: 'knockout' }),
      playedMatch({ id: 'f1', a: 't1', b: 't3', round: 2, position: 1, stageType: 'knockout' }),
    ];
    mount();
    clickTab('Confrontos');
    expect(container.textContent).toContain('Semifinais');
    expect(container.textContent).toContain('Final');

    clickTab('Classificação');
    // Árvore: sem tabela de grupo, e com as colunas de rodada.
    expect(container.querySelectorAll('table')).toHaveLength(0);
    expect(container.textContent).toContain('Alfa');
  });

  it('conta os confrontos na aba e lista as equipes inscritas', () => {
    matches = [playedMatch({ id: 'm1', a: 't1', b: 't2', group: 'Grupo A' })];
    mount();
    expect(container.textContent).toContain('Equipes (4)');
    expect(container.textContent).toContain('Confrontos (1)');
    expect(container.textContent).toContain('Alfa 1');
  });

  it('aponta elenco incompleto no card da equipe', () => {
    teams = [{ id: 't9', team_name: 'Incompleta', members: [{ user_id: 'x', name: 'Só um', gender: 'male' }] }];
    mount();
    expect(container.textContent).toContain('Elenco incompleto: 1/2');
  });
});
