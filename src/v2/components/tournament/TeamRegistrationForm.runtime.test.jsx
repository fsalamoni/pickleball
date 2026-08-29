/**
 * Teste de RUNTIME do formulário de inscrição de equipe (corpo do modal).
 *
 * Monta o componente de verdade (React DOM em jsdom), com Firebase/React Query
 * mockados, e cobre o que o usuário faz: ver as vagas que a modalidade define,
 * preencher nome + elenco e salvar com o payload certo.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  TEAM_GENDER, TEAM_ETAPA_TYPE, TEAM_WIN_RULE, normalizeTeamConfig,
} from '@/modules/tournament/domain/teamFormat';

const registerMutate = vi.fn(() => Promise.resolve('reg1'));
const updateMutate = vi.fn(() => Promise.resolve());
let teamsInModality = [];
let directory = [];

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('@/core/lib/FirebaseAuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'me', displayName: 'Eu Mesmo' },
    userProfile: { platform_name: 'Eu Mesmo', competition_gender: 'male' },
  }),
}));

vi.mock('@/modules/athletes/services/athleteService', () => ({
  listAthletes: () => Promise.resolve([]),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: directory, isLoading: false }),
}));

vi.mock('@/modules/tournament/hooks/useTeams', () => ({
  useTeamRegistrations: () => ({ data: teamsInModality, isLoading: false }),
  useRegisterTeam: () => ({ mutateAsync: registerMutate, isPending: false }),
  useUpdateTeamRoster: () => ({ mutateAsync: updateMutate, isPending: false }),
}));

const { default: TeamRegistrationForm } = await import('./TeamRegistrationForm.jsx');
const { toast } = await import('sonner');

/** Modalidade do exemplo: equipe mista de 4 (2M + 2F), 5 etapas, melhor de 3. */
function teamModality() {
  return {
    id: 'mod1',
    name: 'Equipes Mistas',
    team_config: normalizeTeamConfig({
      team_size: 4,
      gender: TEAM_GENDER.MIXED,
      win_rule: TEAM_WIN_RULE.BEST_OF,
      win_target: 3,
      etapas: [
        { type: TEAM_ETAPA_TYPE.MENS_DOUBLES },
        { type: TEAM_ETAPA_TYPE.WOMENS_DOUBLES },
        { type: TEAM_ETAPA_TYPE.MIXED_DOUBLES },
        { type: TEAM_ETAPA_TYPE.MIXED_DOUBLES },
        { type: TEAM_ETAPA_TYPE.SINGLES },
      ],
    }).value,
  };
}

let container;
let root;

function mount(props) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  React.act(() => {
    root.render(<TeamRegistrationForm modality={teamModality()} tournament={{ id: 't1' }} {...props} />);
  });
}

/** Clica no primeiro botão cujo texto contém `label`. */
function clickButton(label, index = 0) {
  const matches = [...container.querySelectorAll('button')]
    .filter((b) => (b.textContent || '').includes(label));
  const target = matches[index];
  if (!target) throw new Error(`Botão "${label}" (#${index}) não encontrado`);
  React.act(() => { target.click(); });
  return target;
}

/** Digita num input (dispara o onChange do React). */
function type(input, value) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  React.act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function inputByLabel(label) {
  return container.querySelector(`input[aria-label="${label}"]`);
}

function saveButton() {
  return [...container.querySelectorAll('button')].find((b) => /Inscrever equipe|Salvar equipe/.test(b.textContent));
}

/** Preenche as 4 vagas com convidados. */
function fillRosterWithGuests(names) {
  names.forEach((name, i) => {
    clickButton('Convidado', 0); // a 1ª vaga livre é sempre a próxima
    const slotLabels = ['Atleta masculino 1', 'Atleta masculino 2', 'Atleta feminina 1', 'Atleta feminina 2'];
    type(inputByLabel(`${slotLabels[i]} — nome do convidado`), name);
  });
}

beforeEach(() => {
  teamsInModality = [];
  directory = [];
  registerMutate.mockClear();
  updateMutate.mockClear();
  toast.error.mockClear();
});

afterEach(() => {
  React.act(() => root.unmount());
  container.remove();
});

describe('TeamRegistrationForm (runtime)', () => {
  it('mostra uma vaga por atleta, rotulada pela composição da modalidade', () => {
    mount({});
    const text = container.textContent;
    expect(text).toContain('Atleta masculino 1');
    expect(text).toContain('Atleta masculino 2');
    expect(text).toContain('Atleta feminina 1');
    expect(text).toContain('Atleta feminina 2');
    // Resumo do que a modalidade exige.
    expect(text).toContain('4 atletas');
    expect(text).toContain('2M + 2F');
    expect(text).toContain('Melhor de 3');
    expect(text).toContain('Elenco (0/4)');
  });

  it('só habilita salvar com nome da equipe e elenco completo', () => {
    mount({});
    expect(saveButton().disabled).toBe(true);

    type(container.querySelector('#team-name'), 'Fera do Ataque');
    expect(saveButton().disabled).toBe(true);

    fillRosterWithGuests(['Bruno', 'Diego', 'Ana', 'Carla']);
    expect(container.textContent).toContain('Elenco completo');
    expect(saveButton().disabled).toBe(false);
  });

  it('salva nome + elenco com o gênero de cada vaga', async () => {
    mount({});
    type(container.querySelector('#team-name'), 'Fera do Ataque');
    fillRosterWithGuests(['Bruno', 'Diego', 'Ana', 'Carla']);
    await React.act(async () => { saveButton().click(); });

    expect(registerMutate).toHaveBeenCalledTimes(1);
    const { input } = registerMutate.mock.calls[0][0];
    expect(input.team_name).toBe('Fera do Ataque');
    expect(input.members).toEqual([
      { user_id: null, name: 'Bruno', gender: 'male', photo_url: null, level: null },
      { user_id: null, name: 'Diego', gender: 'male', photo_url: null, level: null },
      { user_id: null, name: 'Ana', gender: 'female', photo_url: null, level: null },
      { user_id: null, name: 'Carla', gender: 'female', photo_url: null, level: null },
    ]);
  });

  it('bloqueia nome de equipe repetido na modalidade', () => {
    teamsInModality = [{ id: 'outra', team_name: 'Fera do Ataque', member_uids: [] }];
    mount({});
    type(container.querySelector('#team-name'), 'fera do ataque');
    fillRosterWithGuests(['Bruno', 'Diego', 'Ana', 'Carla']);
    expect(container.textContent).toContain('Já existe uma equipe com esse nome');
    expect(saveButton().disabled).toBe(true);
  });

  it('na edição, carrega nome e elenco nas vagas e salva a atualização', async () => {
    const editingTeam = {
      id: 'time1',
      team_name: 'Águia',
      members: [
        { user_id: 'f1', name: 'Ana', gender: 'female' },
        { user_id: 'm1', name: 'Bruno', gender: 'male' },
        { user_id: 'm2', name: 'Diego', gender: 'male' },
        { user_id: 'f2', name: 'Carla', gender: 'female' },
      ],
    };
    teamsInModality = [{ ...editingTeam, member_uids: ['f1', 'm1', 'm2', 'f2'] }];
    mount({ editingTeam });

    expect(container.querySelector('#team-name').value).toBe('Águia');
    expect(container.textContent).toContain('Elenco completo');
    // A própria equipe não conflita consigo mesma (nome nem atletas).
    expect(container.textContent).not.toContain('Já existe uma equipe');

    await React.act(async () => { saveButton().click(); });
    expect(updateMutate).toHaveBeenCalledTimes(1);
    const call = updateMutate.mock.calls[0][0];
    expect(call.regId).toBe('time1');
    expect(call.input.members.map((m) => m.name)).toEqual(['Bruno', 'Diego', 'Ana', 'Carla']);
  });

  it('não oferece na busca quem já está em outra equipe', () => {
    directory = [
      { uid: 'a1', platform_name: 'Livre', competition_gender: 'male' },
      { uid: 'a2', platform_name: 'Ocupado', competition_gender: 'male' },
      { uid: 'a3', platform_name: 'Feminina', competition_gender: 'female' },
    ];
    teamsInModality = [{ id: 'outra', team_name: 'Outra', member_uids: ['a2'] }];
    mount({});
    clickButton('Escolher', 0); // abre a busca da 1ª vaga (masculina)
    const list = container.textContent;
    expect(list).toContain('Livre');
    expect(list).not.toContain('Ocupado'); // já está em outra equipe
    expect(list).not.toContain('Feminina'); // gênero não serve à vaga masculina
  });
});
