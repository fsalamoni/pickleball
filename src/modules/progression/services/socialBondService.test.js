import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockDocData = {};
const mockGetDoc = vi.fn(async (ref) => ({
  exists: () => mockDocData[ref._path] !== undefined,
  data: () => mockDocData[ref._path],
}));
const mockSetDoc = vi.fn(async (ref, data, opts) => {
  if (opts && opts.merge && mockDocData[ref._path]) {
    mockDocData[ref._path] = { ...mockDocData[ref._path], ...data };
  } else {
    mockDocData[ref._path] = data;
  }
});
const mockRunTransaction = vi.fn(async (_db, fn) => {
  const txGet = async (ref) => {
    if (ref._path in mockDocData) {
      return { exists: () => true, data: () => mockDocData[ref._path] };
    }
    return { exists: () => false, data: () => undefined };
  };
  const tx = {
    get: txGet,
    set: async (ref, data, opts) => {
      if (opts && opts.merge && mockDocData[ref._path]) {
        mockDocData[ref._path] = { ...mockDocData[ref._path], ...data };
      } else {
        mockDocData[ref._path] = data;
      }
    },
    update: (ref, data) => { mockDocData[ref._path] = { ...mockDocData[ref._path], ...data }; },
    delete: (ref) => { delete mockDocData[ref._path]; },
  };
  return fn(tx);
});

const mockNotify = vi.fn(async () => 1);
vi.mock('@/core/services/notificationService', () => ({
  notifyUsers: (...a) => mockNotify(...a),
  NOTIFICATION_TYPE: { GAMIFICATION: 'gamification' },
}));

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
  getDocs: () => ({ docs: [] }),
  serverTimestamp: () => ({ _isServerTimestamp: true }),
  runTransaction: (...args) => mockRunTransaction(...args),
}));

import {
  getOrCreateRivalry,
  recordRivalGame,
  createCrew,
  joinCrew,
  leaveCrew,
  startMentorship,
  respondMentorship,
  recordMentorLesson,
  endMentorship,
} from './socialBondService';

describe('socialBondService · rivals', () => {
  beforeEach(() => {
    Object.keys(mockDocData).forEach((k) => delete mockDocData[k]);
    mockSetDoc.mockClear();
    mockGetDoc.mockClear();
  });

  it('getOrCreateRivalry rejeita mesmo uid', async () => {
    expect(await getOrCreateRivalry('u1', 'u1')).toBeNull();
  });

  it('getOrCreateRivalry cria novo doc', async () => {
    const res = await getOrCreateRivalry('u1', 'u2');
    expect(res).toBeTruthy();
    expect(res.pairKey).toBe('u1_u2');
    expect(res.userA).toBe('u1');
  });

  it('recordRivalGame atualiza contadores', async () => {
    const res = await recordRivalGame({ uidA: 'u1', uidB: 'u2', winnerUid: 'u1' });
    expect(res.gamesA).toBe(1);
    expect(res.gamesB).toBe(1);
    expect(res.winsA).toBe(1);
    expect(res.winsB).toBe(0);
  });
});

describe('socialBondService · crews', () => {
  beforeEach(() => {
    Object.keys(mockDocData).forEach((k) => delete mockDocData[k]);
    mockSetDoc.mockClear();
    mockGetDoc.mockClear();
  });

  it('createCrew cria crew + adiciona owner', async () => {
    const res = await createCrew({ createdBy: 'u1', name: 'Smash Bros' });
    expect(res).toBeTruthy();
    expect(res.createdBy).toBe('u1');
    expect(res.membersCount).toBe(1);
    expect(res.name).toBe('Smash Bros');
    // owner é adicionado
    const memberKey = Object.keys(mockDocData).find((k) => k.startsWith('crew_members/c'));
    expect(mockDocData[memberKey].role).toBe('owner');
  });

  it('joinCrew adiciona member', async () => {
    const crew = await createCrew({ createdBy: 'u1', name: 'Smash' });
    const res = await joinCrew({ crewId: crew.crewId, uid: 'u2' });
    expect(res.role).toBe('member');
    expect(mockDocData[`crews/${crew.crewId}`].membersCount).toBe(2);
  });

  it('joinCrew rejeita duplicado', async () => {
    const crew = await createCrew({ createdBy: 'u1', name: 'Smash' });
    await joinCrew({ crewId: crew.crewId, uid: 'u2' });
    const r2 = await joinCrew({ crewId: crew.crewId, uid: 'u2' });
    expect(r2.role).toBe('member');
    expect(mockDocData[`crews/${crew.crewId}`].membersCount).toBe(2);
  });

  it('leaveCrew remove member', async () => {
    const crew = await createCrew({ createdBy: 'u1', name: 'Smash' });
    await joinCrew({ crewId: crew.crewId, uid: 'u2' });
    const ok = await leaveCrew({ crewId: crew.crewId, uid: 'u2' });
    expect(ok).toBe(true);
    expect(mockDocData[`crews/${crew.crewId}`].membersCount).toBe(1);
  });

  it('leaveCrew rejeita owner', async () => {
    const crew = await createCrew({ createdBy: 'u1', name: 'Smash' });
    await expect(leaveCrew({ crewId: crew.crewId, uid: 'u1' }))
      .rejects.toThrow('owner não pode sair');
  });
});

describe('socialBondService · mentorships', () => {
  beforeEach(() => {
    Object.keys(mockDocData).forEach((k) => delete mockDocData[k]);
    mockSetDoc.mockClear();
    mockGetDoc.mockClear();
  });

  it('startMentorship rejeita mesmo uid', async () => {
    expect(await startMentorship({ mentorUid: 'u1', apprenticeUid: 'u1' })).toBeNull();
  });

  it('startMentorship cria nova', async () => {
    const res = await startMentorship({ mentorUid: 'm1', apprenticeUid: 'a1' });
    expect(res).toBeTruthy();
    expect(res.status).toBe('active');
    expect(res.lessonsCompleted).toBe(0);
  });

  it('recordMentorLesson incrementa lessonsCompleted', async () => {
    const m = await startMentorship({ mentorUid: 'm1', apprenticeUid: 'a1' });
    const res = await recordMentorLesson(m.pairKey);
    expect(res.lessonsCompleted).toBe(1);
  });

  it('endMentorship marca como completed', async () => {
    const m = await startMentorship({ mentorUid: 'm1', apprenticeUid: 'a1' });
    const res = await endMentorship(m.pairKey, 'completed');
    expect(res.status).toBe('completed');
    expect(res.endedAt).toBeGreaterThan(0);
  });
});

describe('socialBondService · convite de mentoria (ninguém entra sem aceitar)', () => {
  beforeEach(() => {
    Object.keys(mockDocData).forEach((k) => delete mockDocData[k]);
    mockSetDoc.mockClear();
    mockNotify.mockClear();
  });

  it('com `proposedBy` o vínculo nasce PENDENTE e assinado, e a outra pessoa é avisada', async () => {
    const m = await startMentorship({ mentorUid: 'm1', apprenticeUid: 'a1', proposedBy: 'm1', proposerName: 'Mara' });
    expect(m).toMatchObject({ status: 'pending', proposedBy: 'm1' });
    expect(mockNotify).toHaveBeenCalledTimes(1);
    const [alvos, msg] = mockNotify.mock.calls[0];
    expect(alvos).toEqual(['a1']);
    expect(msg.message).toContain('Mara convidou você para ser aprendiz');
    expect(msg.link).toBe('/vinculos?aba=mentorias');
  });

  it('quem convida o aprendiz avisa o mentor, com o papel certo', async () => {
    await startMentorship({ mentorUid: 'm1', apprenticeUid: 'a1', proposedBy: 'a1', proposerName: 'Ari' });
    expect(mockNotify.mock.calls[0][0]).toEqual(['m1']);
    expect(mockNotify.mock.calls[0][1].message).toContain('ser mentor');
  });

  it('um terceiro não convida por outros', async () => {
    expect(await startMentorship({ mentorUid: 'm1', apprenticeUid: 'a1', proposedBy: 'intruso' })).toBeNull();
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('a falha do aviso não derruba o convite', async () => {
    mockNotify.mockRejectedValueOnce(new Error('rede'));
    const m = await startMentorship({ mentorUid: 'm1', apprenticeUid: 'a1', proposedBy: 'm1' });
    expect(m.status).toBe('pending');
  });

  it('convite em aberto não se duplica', async () => {
    await startMentorship({ mentorUid: 'm1', apprenticeUid: 'a1', proposedBy: 'm1' });
    mockSetDoc.mockClear();
    const de = await startMentorship({ mentorUid: 'm1', apprenticeUid: 'a1', proposedBy: 'a1' });
    expect(de.proposedBy).toBe('m1');
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('quem foi convidado aceita: vira ativa e começa a contar', async () => {
    const m = await startMentorship({ mentorUid: 'm1', apprenticeUid: 'a1', proposedBy: 'm1' });
    const r = await respondMentorship(m.pairKey, true, 'a1');
    expect(r.status).toBe('active');
  });

  it('quem convidou NÃO aceita o próprio convite', async () => {
    const m = await startMentorship({ mentorUid: 'm1', apprenticeUid: 'a1', proposedBy: 'm1' });
    await expect(respondMentorship(m.pairKey, true, 'm1')).rejects.toThrow(/próprio convite/);
  });

  it('recusar (ou retirar) cancela; terceiro não responde', async () => {
    const m = await startMentorship({ mentorUid: 'm1', apprenticeUid: 'a1', proposedBy: 'm1' });
    await expect(respondMentorship(m.pairKey, false, 'intruso')).rejects.toThrow(/não é seu/);
    const r = await respondMentorship(m.pairKey, false, 'm1');
    expect(r.status).toBe('cancelled');
    expect(r.endedAt).toBeGreaterThan(0);
  });

  it('aula só se registra em mentoria ativa (convite sem resposta não conta)', async () => {
    const m = await startMentorship({ mentorUid: 'm1', apprenticeUid: 'a1', proposedBy: 'm1' });
    expect(await recordMentorLesson(m.pairKey)).toBeNull();
    await respondMentorship(m.pairKey, true, 'a1');
    expect((await recordMentorLesson(m.pairKey)).lessonsCompleted).toBe(1);
  });

  it('convite recusado pode ser refeito mais tarde', async () => {
    const m = await startMentorship({ mentorUid: 'm1', apprenticeUid: 'a1', proposedBy: 'm1' });
    await respondMentorship(m.pairKey, false, 'a1');
    const novo = await startMentorship({ mentorUid: 'm1', apprenticeUid: 'a1', proposedBy: 'm1' });
    expect(novo.status).toBe('pending');
  });
});
