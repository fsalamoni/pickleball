import { describe, it, expect } from 'vitest';
import {
  groupClubsByUser,
  buildAthleteProfilesResyncPlan,
  RESYNC_MANUAL_FIELDS,
} from './directoryResync.js';

describe('groupClubsByUser', () => {
  it('agrupa membros por user_id no formato { id, name }', () => {
    const map = groupClubsByUser([
      { user_id: 'u1', club_id: 'c1', club_name: 'Clube A', role: 'admin' },
      { user_id: 'u1', club_id: 'c2', club_name: 'Clube B', role: 'member' },
      { user_id: 'u2', club_id: 'c1', club_name: 'Clube A' },
    ]);
    expect(map.get('u1')).toEqual([
      { id: 'c1', name: 'Clube A' },
      { id: 'c2', name: 'Clube B' },
    ]);
    expect(map.get('u2')).toEqual([{ id: 'c1', name: 'Clube A' }]);
  });

  it('ignora membros incompletos e entradas nulas', () => {
    const map = groupClubsByUser([
      { user_id: 'u1', club_id: 'c1' }, // sem club_name
      { user_id: 'u1', club_name: 'Clube B' }, // sem club_id
      { club_id: 'c3', club_name: 'Clube C' }, // sem user_id
      null,
      undefined,
      { user_id: 'u1', club_id: 'c9', club_name: 'Clube Z' },
    ]);
    expect(map.get('u1')).toEqual([{ id: 'c9', name: 'Clube Z' }]);
    expect(map.size).toBe(1);
  });

  it('retorna mapa vazio para entrada vazia/ausente', () => {
    expect(groupClubsByUser().size).toBe(0);
    expect(groupClubsByUser([]).size).toBe(0);
  });
});

describe('buildAthleteProfilesResyncPlan', () => {
  it('só gera escrita para uids que já têm espelho (interseção)', () => {
    const users = [
      { uid: 'u1', platform_name: 'Ana', dupr_id: 'AAA111' },
      { uid: 'u2', platform_name: 'Beto', dupr_id: 'BBB222' }, // sem espelho
    ];
    const { writes, summary } = buildAthleteProfilesResyncPlan({
      users,
      mirrorIds: new Set(['u1']),
    });
    expect(writes).toHaveLength(1);
    expect(writes[0].uid).toBe('u1');
    expect(writes[0].payload.dupr_id).toBe('AAA111');
    expect(summary.eligible).toBe(1);
    expect(summary.totalUsers).toBe(2);
    expect(summary.totalMirrors).toBe(1);
  });

  it('nunca cria entrada nova: usuário sem espelho é ignorado', () => {
    const { writes } = buildAthleteProfilesResyncPlan({
      users: [{ uid: 'novo', platform_name: 'Novo', dupr_id: 'NEW999' }],
      mirrorIds: new Set([]),
    });
    expect(writes).toHaveLength(0);
  });

  it('aceita mirrorIds como array (além de Set)', () => {
    const { writes } = buildAthleteProfilesResyncPlan({
      users: [{ uid: 'u1', platform_name: 'Ana' }],
      mirrorIds: ['u1'],
    });
    expect(writes).toHaveLength(1);
  });

  it('propaga os campos manuais (dupr_id/gender/competition_gender/court_side)', () => {
    const users = [{
      uid: 'u1',
      platform_name: 'Ana',
      dupr_id: '  DUPR-1  ',
      gender: 'female',
      competition_gender: 'feminino',
      court_side: 'esquerda',
    }];
    const { writes, summary } = buildAthleteProfilesResyncPlan({ users, mirrorIds: ['u1'] });
    const p = writes[0].payload;
    expect(p.dupr_id).toBe('DUPR-1'); // trim aplicado por buildAthletePublicProfile
    expect(p.gender).toBe('female');
    expect(p.competition_gender).toBe('feminino');
    expect(p.court_side).toBe('esquerda');
    expect(summary).toMatchObject({
      withDupr: 1, withGender: 1, withCompetitionGender: 1, withCourtSide: 1,
    });
  });

  it('conta corretamente campos manuais parcialmente preenchidos', () => {
    const users = [
      { uid: 'u1', dupr_id: 'X1' },
      { uid: 'u2', gender: 'male' },
      { uid: 'u3', court_side: 'direita' },
      { uid: 'u4' }, // nada
    ];
    const { summary } = buildAthleteProfilesResyncPlan({
      users,
      mirrorIds: ['u1', 'u2', 'u3', 'u4'],
    });
    expect(summary.eligible).toBe(4);
    expect(summary.withDupr).toBe(1);
    expect(summary.withGender).toBe(1);
    expect(summary.withCourtSide).toBe(1);
    expect(summary.withCompetitionGender).toBe(0);
  });

  it('não sobrescreve foto/campos com string vazia (filterEmptyStringFields)', () => {
    const users = [{ uid: 'u1', platform_name: 'Ana' }]; // sem photo_url
    const { writes } = buildAthleteProfilesResyncPlan({ users, mirrorIds: ['u1'] });
    // photo_url vazia foi filtrada — o merge não apaga a foto existente no espelho.
    expect('photo_url' in writes[0].payload).toBe(false);
    // Campos preenchidos permanecem.
    expect(writes[0].payload.platform_name).toBe('Ana');
  });

  it('inclui os clubes do usuário quando fornecidos', () => {
    const users = [{ uid: 'u1', platform_name: 'Ana' }];
    const clubsByUser = new Map([['u1', [{ id: 'c1', name: 'Clube A' }]]]);
    const { writes } = buildAthleteProfilesResyncPlan({ users, mirrorIds: ['u1'], clubsByUser });
    expect(writes[0].payload.clubs).toEqual([{ id: 'c1', name: 'Clube A' }]);
    expect(writes[0].payload.club_ids).toEqual(['c1']);
  });

  it('usa doc.id como uid quando o campo uid está ausente', () => {
    const users = [{ id: 'docId1', platform_name: 'Ana' }];
    const { writes } = buildAthleteProfilesResyncPlan({ users, mirrorIds: ['docId1'] });
    expect(writes).toHaveLength(1);
    expect(writes[0].uid).toBe('docId1');
    expect(writes[0].payload.uid).toBe('docId1');
  });

  it('tolera entradas sem uid/id e parâmetros ausentes', () => {
    const { writes, summary } = buildAthleteProfilesResyncPlan({
      users: [{ platform_name: 'Sem uid' }, null],
      mirrorIds: ['x'],
    });
    expect(writes).toHaveLength(0);
    expect(summary.eligible).toBe(0);
    // Chamada sem argumentos não deve lançar.
    expect(() => buildAthleteProfilesResyncPlan()).not.toThrow();
  });

  it('expõe a lista de campos manuais monitorados', () => {
    expect(RESYNC_MANUAL_FIELDS).toEqual(['dupr_id', 'gender', 'competition_gender', 'court_side']);
  });
});
