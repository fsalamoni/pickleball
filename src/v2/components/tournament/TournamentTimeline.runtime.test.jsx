/**
 * Runtime de "Minha participação" e "Acompanhar" (docs/55): a tela mostra
 * os jogos de todas as categorias em ordem de horário, diz quem não está
 * inscrito, distingue falha de vazio e escolhe quem acompanhar só entre os
 * inscritos do torneio.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { tournamentPeople } from '@/modules/tournament/domain/personalTimeline';

const estado = { uid: 'eu', data: null };

vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => ({ user: { uid: estado.uid } }) }));
vi.mock('@/modules/tournament/hooks/usePersonalTimeline', () => ({
  useTournamentTimelineData: () => estado.data,
  useMeInTournament: () => ({ ...estado.data, eu: estado.data.people.find((p) => p.user_id === estado.uid) || null }),
}));

const { V2MyParticipation, V2FollowPlayers, MyNextMatchStrip } = await import('./TournamentTimeline.jsx');

const modalities = [
  { id: 'dup', name: 'Duplas mistas', stages: [{ type: 'groups' }] },
  { id: 'sim', name: 'Simples', stages: [{ type: 'knockout' }] },
];
const registrations = [
  { id: 'r1', modality_id: 'dup', status: 'confirmed', player_a_user_id: 'eu', player_a_name: 'Ana Souza', player_b_name: 'Bia' },
  { id: 'r2', modality_id: 'dup', status: 'confirmed', player_a_user_id: 'caio', player_a_name: 'Caio Lima', player_b_name: 'Davi' },
  { id: 's1', modality_id: 'sim', status: 'confirmed', player_a_user_id: 'eu', player_a_name: 'Ana Souza' },
  { id: 's2', modality_id: 'sim', status: 'confirmed', player_a_user_id: 'caio', player_a_name: 'Caio Lima' },
];
const matches = [
  { id: 'm-tarde', modality_id: 'sim', stage_index: 0, stage_type: 'knockout', round: 1, position: 1, side_a_ids: ['s1'], side_b_ids: ['s2'], status: 'scheduled', scheduled_at: new Date(2030, 0, 5, 15, 0).toISOString(), court: 'Quadra 4' },
  { id: 'm-manha', modality_id: 'dup', stage_index: 0, group: 'A', round: 1, position: 1, side_a_ids: ['r1'], side_b_ids: ['r2'], status: 'finished', winner_side: 'a', games: [{ a: 11, b: 6 }], scheduled_at: new Date(2030, 0, 5, 9, 30).toISOString(), court: 'Quadra 1' },
];

function dados(over = {}) {
  return {
    modalities, registrations, matches,
    people: tournamentPeople(registrations, modalities),
    isLoading: false, isError: false, peopleReady: true, refetch: vi.fn(),
    ...over,
  };
}

const tournament = { id: 't1', name: 'Aberto' };
let container;
let root;

function mount(el, url = '/torneios/t1/minha-participacao') {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  React.act(() => { root.render(<MemoryRouter initialEntries={[url]}>{el}</MemoryRouter>); });
}

beforeEach(() => { estado.uid = 'eu'; estado.data = dados(); });
afterEach(() => { React.act(() => root.unmount()); container.remove(); });

describe('Minha participação', () => {
  it('lista os jogos das duas categorias em ordem de horário, com quadra e resultado', () => {
    mount(<V2MyParticipation tournament={tournament} />);
    const texto = container.textContent;
    expect(texto).toContain('Suas categorias');
    expect(texto).toContain('Duplas mistas');
    expect(texto).toContain('Simples');
    expect(texto.indexOf('Quadra 1')).toBeLessThan(texto.indexOf('Quadra 4'));
    expect(texto).toContain('Vitória');
    expect(texto).toContain('11-6');
    // O jogo por vir é o "Próximo".
    expect(container.querySelector('li[aria-current="true"]').textContent).toContain('Quadra 4');
  });

  it('na chave, mostra "Ver a chave" e o que vem pela frente', () => {
    mount(<V2MyParticipation tournament={tournament} />);
    expect(container.textContent).toContain('Se vencer, é campeão.');
    const ver = [...container.querySelectorAll('button')].find((b) => b.textContent.includes('Ver a chave'));
    expect(ver).toBeTruthy();
    React.act(() => { ver.click(); });
    expect(container.querySelector('[data-linhas]')).toBeTruthy();
  });

  it('quem não está inscrito vê o convite, não uma lista vazia', () => {
    estado.uid = 'outra';
    mount(<V2MyParticipation tournament={tournament} />);
    expect(container.textContent).toContain('Você não está inscrito neste torneio');
  });

  it('falha não vira "sem jogos"', () => {
    estado.data = dados({ isError: true });
    mount(<V2MyParticipation tournament={tournament} />);
    expect(container.textContent).toContain('Não foi possível carregar os jogos');
    expect(container.textContent).not.toContain('Você não está inscrito');
  });

  it('a faixa do topo diz o próximo jogo', () => {
    const abrir = vi.fn();
    mount(<MyNextMatchStrip tournament={tournament} onOpen={abrir} />);
    expect(container.textContent).toContain('Seu próximo jogo');
    expect(container.textContent).toContain('Quadra 4');
    expect(container.textContent).toContain('contra Caio Lima');
  });
});

describe('Acompanhar', () => {
  it('a lista é só de inscritos do torneio, sem a própria pessoa', () => {
    mount(<V2FollowPlayers tournament={tournament} />, '/torneios/t1/acompanhar');
    const texto = container.textContent;
    expect(texto).toContain('Caio Lima');
    expect(texto).toContain('Davi');
    expect(texto).not.toContain('Ana Souza');
  });

  it('com gente escolhida na URL, mostra a linha do tempo dela', () => {
    mount(<V2FollowPlayers tournament={tournament} />, '/torneios/t1/acompanhar?pessoas=caio');
    expect(container.textContent).toContain('Inscrições');
    expect(container.textContent).toContain('Derrota');
  });

  it('avisa quando alguém do link não está mais inscrito', () => {
    mount(<V2FollowPlayers tournament={tournament} />, '/torneios/t1/acompanhar?pessoas=caio,sumiu');
    expect(container.textContent).toContain('1 pessoa do link não está mais inscrita neste torneio.');
  });
});
