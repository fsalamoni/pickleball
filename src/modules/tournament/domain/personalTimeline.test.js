import { describe, it, expect } from 'vitest';
import { buildPersonalTimeline, tournamentPeople, registrationShortLabel } from './personalTimeline.js';

const KO = { type: 'knockout' };
const GRUPOS = { type: 'groups' };

// Duas categorias: Duplas (grupos → chave) e Simples (chave de 4).
const modalities = [
  { id: 'dup', name: 'Duplas mistas', stages: [GRUPOS, KO] },
  { id: 'sim', name: 'Simples', stages: [KO] },
];

const registrations = [
  { id: 'r1', modality_id: 'dup', status: 'confirmed', player_a_user_id: 'eu', player_a_name: 'Ana', player_b_user_id: 'bia', player_b_name: 'Bia' },
  { id: 'r2', modality_id: 'dup', status: 'confirmed', player_a_user_id: 'caio', player_a_name: 'Caio', player_b_name: 'Davi' },
  { id: 'r3', modality_id: 'dup', status: 'cancelled', player_a_user_id: 'saiu', player_a_name: 'Saiu' },
  { id: 'r4', modality_id: 'dup', status: 'confirmed', is_placeholder: true, player_a_name: 'Atleta 9' },
  { id: 's1', modality_id: 'sim', status: 'confirmed', user_id: 'eu', player_a_user_id: 'eu', player_a_name: 'Ana' },
  { id: 's2', modality_id: 'sim', status: 'confirmed', player_a_user_id: 'caio', player_a_name: 'Caio' },
  { id: 's3', modality_id: 'sim', status: 'confirmed', player_a_user_id: 'edu', player_a_name: 'Edu' },
  { id: 's4', modality_id: 'sim', status: 'confirmed', player_a_user_id: 'fe', player_a_name: 'Fê' },
];

const hoje10 = new Date(2026, 10, 7, 10, 0).toISOString();
const hoje14 = new Date(2026, 10, 7, 14, 0).toISOString();
const amanha9 = new Date(2026, 10, 8, 9, 0).toISOString();

const matches = [
  // Simples: semifinais (a minha às 14h, decidida — eu venci) e a outra sem resultado.
  { id: 'sf1', modality_id: 'sim', stage_index: 0, stage_type: 'knockout', round: 1, position: 1, side_a_ids: ['s1'], side_b_ids: ['s2'], status: 'finished', winner_side: 'a', games: [{ a: 11, b: 7 }], scheduled_at: hoje14, court: 'Quadra 2' },
  { id: 'sf2', modality_id: 'sim', stage_index: 0, stage_type: 'knockout', round: 1, position: 2, side_a_ids: ['s3'], side_b_ids: ['s4'], status: 'scheduled', scheduled_at: hoje14, court: 'Quadra 3' },
  // Duplas: fase de grupos, um jogo às 10h e um sem horário.
  { id: 'g1', modality_id: 'dup', stage_index: 0, stage_type: 'groups', group: 'A', round: 1, position: 1, side_a_ids: ['r1'], side_b_ids: ['r2'], status: 'in_progress', scheduled_at: hoje10, court: 'Quadra 1' },
  { id: 'g2', modality_id: 'dup', stage_index: 0, stage_type: 'groups', group: 'A', round: 2, position: 1, side_a_ids: ['r2'], side_b_ids: ['r1'], status: 'scheduled' },
  // Jogo de outras pessoas: fica de fora.
  { id: 'x', modality_id: 'dup', stage_index: 0, group: 'B', round: 1, side_a_ids: ['r8'], side_b_ids: ['r9'], status: 'scheduled', scheduled_at: amanha9 },
  { id: 'cancelado', modality_id: 'dup', stage_index: 0, group: 'A', round: 3, side_a_ids: ['r1'], side_b_ids: ['r2'], status: 'cancelled' },
];

const pessoas = tournamentPeople(registrations, modalities);
const eu = pessoas.find((p) => p.id === 'eu');

describe('tournamentPeople', () => {
  it('uma pessoa por conta, juntando as categorias; sem conta, uma por vaga', () => {
    expect(eu.registrationIds.sort()).toEqual(['r1', 's1']);
    expect(eu.modalityNames.sort()).toEqual(['Duplas mistas', 'Simples']);
    expect(pessoas.find((p) => p.id === 'reg:r2:b')).toMatchObject({ name: 'Davi', user_id: null });
  });

  it('não lista quem saiu nem atleta fictício', () => {
    expect(pessoas.some((p) => p.id === 'saiu')).toBe(false);
    expect(pessoas.some((p) => p.name === 'Atleta 9')).toBe(false);
  });

  it('em ordem alfabética', () => {
    const nomes = pessoas.map((p) => p.name);
    expect(nomes).toEqual([...nomes].sort((a, b) => a.localeCompare(b, 'pt-BR')));
  });

  it('equipe: os membros entram, com ou sem conta', () => {
    const lista = tournamentPeople([{ id: 't1', modality_id: 'eq', kind: 'team', team_name: 'Raquetes', status: 'confirmed', members: [{ user_id: 'u9', name: 'Gil' }, { name: 'Hugo' }] }]);
    expect(lista.map((p) => p.id).sort()).toEqual(['reg:t1:m1', 'u9']);
    expect(registrationShortLabel({ kind: 'team', team_name: 'Raquetes' })).toBe('Raquetes');
  });
});

describe('buildPersonalTimeline', () => {
  const tl = buildPersonalTimeline({ people: [eu], registrations, matches, modalities });

  it('junta os jogos de todas as categorias, em ordem de horário, sem horário no fim', () => {
    expect(tl.items.map((i) => i.id)).toEqual(['g1', 'sf1', 'g2']);
  });

  it('agrupa por dia, com "sem horário" por último', () => {
    expect(tl.days.map((d) => d.items.map((i) => i.id))).toEqual([['g1', 'sf1'], ['g2']]);
    expect(tl.days[1].key).toBe('sem-horario');
  });

  it('ignora jogo cancelado e jogo de outras pessoas', () => {
    expect(tl.items.some((i) => i.id === 'x' || i.id === 'cancelado')).toBe(false);
  });

  it('diz o resultado do ponto de vista de quem é acompanhado', () => {
    const sf1 = tl.items.find((i) => i.id === 'sf1');
    expect(sf1).toMatchObject({ outcome: 'won', perspective: 'a', court: 'Quadra 2', roundLabel: 'Semifinal' });
    expect(sf1.sideB.label).toBe('Caio');
    const g2 = tl.items.find((i) => i.id === 'g2');
    expect(g2).toMatchObject({ perspective: 'b', outcome: null, phaseLabel: 'Fase 1 · Fase de grupos' });
    expect(g2.roundLabel).toBe('Grupo A · rodada 2');
  });

  it('o próximo é o que está em quadra', () => {
    expect(tl.next.id).toBe('g1');
    expect(tl.stats).toMatchObject({ total: 3, played: 1, won: 1, lost: 0, upcoming: 2 });
  });

  it('na chave, projeta o próximo confronto possível', () => {
    const p = tl.projections.find((x) => x.modalityId === 'sim');
    expect(p).toMatchObject({ kind: 'waiting', roundLabel: 'Final' });
    expect(p.text).toBe('Próximo: Final contra Edu ou Fê.');
  });

  it('nos grupos, diz que a próxima fase sai da classificação', () => {
    const p = tl.projections.find((x) => x.modalityId === 'dup');
    expect(p).toMatchObject({ kind: 'next_phase', roundLabel: 'Fase 2 · Chaves (mata-mata)' });
  });

  it('um resumo por inscrição', () => {
    expect(tl.entries.map((e) => [e.modalityName, e.total, e.won])).toEqual([['Duplas mistas', 2, 0], ['Simples', 1, 1]]);
  });

  it('com o adversário da semifinal ainda por jogar, o próximo é "se vencer"', () => {
    const fe = pessoas.find((p) => p.id === 'fe');
    const t2 = buildPersonalTimeline({ people: [fe], registrations, matches, modalities });
    expect(t2.projections[0]).toMatchObject({ kind: 'if_win', roundLabel: 'Final', opponent: 'Ana' });
  });

  it('categoria encerrada mostra a colocação e não projeta nada', () => {
    const comFinal = [
      ...matches.map((m) => (m.id === 'sf2' ? { ...m, status: 'finished', winner_side: 'b', games: [{ a: 3, b: 11 }] } : m)),
      { id: 'fin', modality_id: 'sim', stage_index: 0, stage_type: 'knockout', round: 2, position: 1, side_a_ids: ['s1'], side_b_ids: ['s4'], status: 'finished', winner_side: 'b', games: [{ a: 9, b: 11 }] },
    ];
    const t3 = buildPersonalTimeline({ people: [eu], registrations, matches: comFinal, modalities });
    const simples = t3.entries.find((e) => e.modality.id === 'sim');
    expect(simples).toMatchObject({ complete: true, position: 2, won: 1, lost: 1 });
    expect(t3.projections.some((x) => x.modalityId === 'sim')).toBe(false);
    expect(t3.items.find((i) => i.id === 'fin')).toMatchObject({ outcome: 'lost', roundLabel: 'Final' });
  });

  it('acompanhando duas pessoas do mesmo jogo, não aponta vencedor "de quem"', () => {
    const caio = pessoas.find((p) => p.id === 'caio');
    const t4 = buildPersonalTimeline({ people: [eu, caio], registrations, matches, modalities });
    const sf1 = t4.items.find((i) => i.id === 'sf1');
    expect(sf1.perspective).toBe(null);
    expect(sf1.outcome).toBe(null);
    expect(sf1.personIds.sort()).toEqual(['caio', 'eu']);
  });

  it('bye aparece como "passa direto" e não conta como jogo', () => {
    const t5 = buildPersonalTimeline({
      people: [eu], registrations, modalities,
      matches: [{ id: 'bye', modality_id: 'sim', stage_index: 0, round: 1, position: 1, side_a_ids: ['s1'], side_b_ids: [], status: 'walkover' }],
    });
    expect(t5.items[0]).toMatchObject({ bye: true, outcome: 'bye' });
    expect(t5.stats.total).toBe(0);
    expect(t5.next).toBe(null);
  });

  it('sem pessoas, nada', () => {
    const vazio = buildPersonalTimeline({ people: [], registrations, matches, modalities });
    expect(vazio.items).toEqual([]);
    expect(vazio.entries).toEqual([]);
  });
});
