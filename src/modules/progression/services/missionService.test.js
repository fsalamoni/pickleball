/**
 * Teste do service missionService com Firestore mockado.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockDocData = {};
const mockGetDoc = vi.fn(async (ref) => ({
  exists: () => mockDocData[ref._path] !== undefined,
  data: () => mockDocData[ref._path],
}));
const mockSetDoc = vi.fn(async (ref, data) => { mockDocData[ref._path] = data; });
const mockGetDocs = vi.fn(async () => ({ docs: [] }));

vi.mock('@/core/config/firebase', () => ({ db: {} }));

vi.mock('firebase/firestore', () => ({
  getFirestore: () => ({}),
  doc: (db, path) => ({ _path: path }),
  getDoc: (...args) => mockGetDoc(...args),
  setDoc: (...args) => mockSetDoc(...args),
  onSnapshot: () => () => {},
  collection: (db, name) => ({ _name: name }),
  query: (...args) => ({ _q: args }),
  where: (...args) => ({ _w: args }),
  getDocs: (...args) => mockGetDocs(...args),
  serverTimestamp: () => ({ _isServerTimestamp: true }),
}));

import {
  getMissionsForDate,
  getOrCreateDailyMissions,
  syncMissionProgress,
  claimDailyBonus,
} from './missionService';

describe('missionService', () => {
  beforeEach(() => {
    Object.keys(mockDocData).forEach((k) => delete mockDocData[k]);
    mockSetDoc.mockClear();
    mockGetDoc.mockClear();
  });

  it('getMissionsForDate retorna null se uid vazio', async () => {
    expect(await getMissionsForDate(null, new Date('2026-09-02'))).toBeNull();
  });

  it('getMissionsForDate retorna null se doc não existe', async () => {
    expect(await getMissionsForDate('u1', new Date('2026-09-02'))).toBeNull();
  });

  it('getOrCreateDailyMissions cria doc novo se não existe', async () => {
    const res = await getOrCreateDailyMissions('u1', 'Aprendiz', new Date('2026-09-02T12:00:00Z'));
    expect(res).toBeTruthy();
    expect(res.scope).toBe('daily');
    expect(res.missions.length).toBeGreaterThan(0);
    expect(res.bonusClaimed).toBe(false);
    expect(res.completedAt).toBeNull();
    expect(mockSetDoc).toHaveBeenCalled();
  });

  it('getOrCreateDailyMissions retorna existente sem recriar', async () => {
    const existing = {
      uid: 'u1', date: '2026-09-02', scope: 'daily',
      missions: [{ id: 'm1', title: 't', description: 't', metric: 'm', target: 1, current: 0, xp: 30, bonus: 15, bonusClaimed: false, seed: 1 }],
      bonusClaimed: false, completedAt: null, createdAt: 1, updatedAt: 1,
    };
    mockDocData[`user_missions/u1_${new Date('2026-09-02').toISOString().slice(0, 10)}`] = existing;
    mockSetDoc.mockClear();
    const res = await getOrCreateDailyMissions('u1', 'Aprendiz', new Date('2026-09-02T12:00:00Z'));
    expect(res).toBeTruthy();
    expect(res.missions[0].id).toBe('m1');
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('syncMissionProgress aplica a atividade real e não estoura o alvo', async () => {
    const dateKey = '2026-09-02';
    mockDocData[`user_missions/u1_${dateKey}`] = {
      uid: 'u1', date: dateKey, scope: 'daily',
      missions: [
        { id: 'm1', title: 't', description: 't', metric: 'game_played', target: 3, current: 1, xp: 30, bonus: 15, bonusClaimed: false, seed: 1 },
      ],
      bonusClaimed: false, completedAt: null, createdAt: 1, updatedAt: 1,
    };
    const updated = await syncMissionProgress('u1', { game_played: 9 }, new Date('2026-09-02T12:00:00Z'));
    expect(updated.missions[0].current).toBe(3); // grampeado no alvo
    expect(updated.completedAt).toBeTruthy();
  });

  it('syncMissionProgress NÃO grava quando nada mudou', async () => {
    const dateKey = '2026-09-02';
    mockDocData[`user_missions/u1_${dateKey}`] = {
      uid: 'u1', date: dateKey, scope: 'daily',
      missions: [
        { id: 'm1', title: 't', description: 't', metric: 'game_played', target: 3, current: 2, xp: 30, bonus: 15, bonusClaimed: false, seed: 1 },
      ],
      bonusClaimed: false, completedAt: null, createdAt: 1, updatedAt: 1,
    };
    mockSetDoc.mockClear();
    await syncMissionProgress('u1', { game_played: 2 }, new Date('2026-09-02T12:00:00Z'));
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('syncMissionProgress nunca regride uma missão já concluída', async () => {
    const dateKey = '2026-09-02';
    mockDocData[`user_missions/u1_${dateKey}`] = {
      uid: 'u1', date: dateKey, scope: 'daily',
      missions: [
        { id: 'm1', title: 't', description: 't', metric: 'game_played', target: 2, current: 2, xp: 30, bonus: 15, bonusClaimed: false, seed: 1 },
      ],
      bonusClaimed: false, completedAt: 999, createdAt: 1, updatedAt: 1,
    };
    const res = await syncMissionProgress('u1', { game_played: 0 }, new Date('2026-09-02T12:00:00Z'));
    expect(res.missions[0].current).toBe(2);
  });

  it('syncMissionProgress retorna null se não há doc do dia', async () => {
    const res = await syncMissionProgress('u1', { game_played: 3 }, new Date('2026-09-02T12:00:00Z'));
    expect(res).toBeNull();
  });

  it('claimDailyBonus marca bonusClaimed=true', async () => {
    const dateKey = new Date('2026-09-02T12:00:00Z').toISOString().slice(0, 10);
    mockDocData[`user_missions/u1_${dateKey}`] = {
      uid: 'u1', date: dateKey, scope: 'daily',
      missions: [{ id: 'm1', title: 't', description: 't', metric: 'm', target: 1, current: 1, xp: 30, bonus: 15, bonusClaimed: false, seed: 1 }],
      bonusClaimed: false, completedAt: null, createdAt: 1, updatedAt: 1,
    };
    const res = await claimDailyBonus('u1', new Date('2026-09-02T12:00:00Z'));
    expect(res.bonusClaimed).toBe(true);
  });
});

import {
  getOrCreateScopedMissions, syncScopedProgress, claimScopedBonus, getScopedMissions,
} from './missionService';

describe('missões da semana e do mês', () => {
  const sexta = new Date('2026-10-02T15:00:00Z');

  beforeEach(() => {
    Object.keys(mockDocData).forEach((k) => delete mockDocData[k]);
    mockSetDoc.mockClear();
  });

  it('cria as da semana com o id marcado pela segunda-feira, e não recria', async () => {
    const doc1 = await getOrCreateScopedMissions('u1', 'weekly', 'Aprendiz', sexta);
    expect(doc1.scope).toBe('weekly');
    expect(doc1.date).toBe('2026-09-28');
    expect(doc1.missions).toHaveLength(5);
    expect(Object.keys(mockDocData)).toEqual(['user_missions/u1_w_2026-09-28']);
    mockSetDoc.mockClear();
    const doc2 = await getOrCreateScopedMissions('u1', 'weekly', 'Aprendiz', sexta);
    expect(doc2.date).toBe('2026-09-28');
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('as do mês: chave do dia 1 e 8 missões', async () => {
    const m = await getOrCreateScopedMissions('u1', 'monthly', 'Aprendiz', sexta);
    expect(m.date).toBe('2026-10-01');
    expect(m.missions).toHaveLength(8);
    expect(Object.keys(mockDocData)).toEqual(['user_missions/u1_m_2026-10-01']);
  });

  it('o diário continua no id de sempre (compatível com o que já está no banco)', async () => {
    await getOrCreateScopedMissions('u1', 'daily', 'Calouro', sexta);
    expect(Object.keys(mockDocData)).toEqual(['user_missions/u1_2026-10-02']);
  });

  it('o módulo desligado pelo admin tira as missões que dependem dele', async () => {
    for (let dia = 1; dia <= 20; dia += 1) {
      Object.keys(mockDocData).forEach((k) => delete mockDocData[k]);
      const m = await getOrCreateScopedMissions('u1', 'weekly', 'Aprendiz', new Date(Date.UTC(2026, 9, dia, 15)), { modules: { match_reviews: false, partner_letters: false } });
      expect(m.missions.some((x) => /review|letter/.test(x.id))).toBe(false);
    }
  });

  it('sincroniza progresso real e nunca regride', async () => {
    const criado = await getOrCreateScopedMissions('u1', 'weekly', 'Aprendiz', sexta);
    const primeira = criado.missions[0];
    const subiu = await syncScopedProgress('u1', 'weekly', { [primeira.metric]: 2 }, sexta);
    expect(subiu.missions[0].current).toBe(Math.min(2, primeira.target));
    const regrediu = await syncScopedProgress('u1', 'weekly', { [primeira.metric]: 0 }, sexta);
    expect(regrediu.missions[0].current).toBe(Math.min(2, primeira.target));
  });

  it('o bônus só é resgatado com TODAS as missões cumpridas', async () => {
    const criado = await getOrCreateScopedMissions('u1', 'weekly', 'Aprendiz', sexta);
    await expect(claimScopedBonus('u1', 'weekly', sexta)).rejects.toThrow(/Cumpra todas/);
    const tudo = Object.fromEntries(criado.missions.map((m) => [m.metric, 999]));
    await syncScopedProgress('u1', 'weekly', tudo, sexta);
    const r = await claimScopedBonus('u1', 'weekly', sexta);
    expect(r.bonusClaimed).toBe(true);
    expect((await getScopedMissions('u1', 'weekly', sexta)).bonusClaimed).toBe(true);
  });
});
