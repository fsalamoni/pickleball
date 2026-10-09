/**
 * O vínculo aluno↔professor vale enquanto o professor for professor do aluno:
 * qualquer um encerra, e o encerrado só volta pelo aceite do aluno.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockUpdate = vi.fn(async () => {});
const mockDelete = vi.fn(async () => {});
const mockNotify = vi.fn(async () => 1);

vi.mock('@/core/config/firebase', () => ({ db: {} }));
vi.mock('@/core/services/auditService', () => ({ createAuditLog: vi.fn(async () => {}) }));
vi.mock('@/core/services/notificationService', () => ({
  notifyUsers: (...a) => mockNotify(...a),
  NOTIFICATION_TYPE: { GENERIC: 'generic' },
}));
vi.mock('firebase/firestore', () => ({
  collection: () => ({}),
  query: () => ({}),
  where: () => ({}),
  getDocs: async () => ({ docs: [] }),
  getDoc: async () => ({ exists: () => false }),
  setDoc: async () => {},
  doc: (db, col, id) => ({ id }),
  updateDoc: (...a) => mockUpdate(...a),
  deleteDoc: (...a) => mockDelete(...a),
  deleteField: () => ({ _delete: true }),
  serverTimestamp: () => ({ _ts: true }),
}));

import { removeStudent, setStudentStatus } from './studentService';

const PROF = { uid: 'prof', displayName: 'Prof. Rui' };
const ANA = { uid: 'ana', displayName: 'Ana' };
const link = (status, extra = {}) => ({ coach_id: 'prof', student_id: 'ana', student_name: 'Ana', status, ...extra });

beforeEach(() => {
  mockUpdate.mockClear();
  mockDelete.mockClear();
  mockNotify.mockClear();
});

describe('setStudentStatus — enquanto for professor do aluno', () => {
  it('o aluno encerra: grava quando e quem, e o professor é avisado', async () => {
    await setStudentStatus(link('active'), 'ended', ANA);
    const [ref, patch] = mockUpdate.mock.calls[0];
    expect(ref.id).toBe('prof_ana');
    expect(patch).toMatchObject({ status: 'ended', ended_by: 'ana', ended_at: { _ts: true } });
    expect(Object.keys(patch).sort()).toEqual(['ended_at', 'ended_by', 'status', 'updated_at']);
    expect(mockNotify.mock.calls[0][0]).toEqual(['prof']);
    expect(mockNotify.mock.calls[0][1].title).toBe('Vínculo de aluno encerrado');
  });

  it('o aluno recusa o convite (convidado → encerrado)', async () => {
    await setStudentStatus(link('invited'), 'ended', ANA);
    expect(mockNotify.mock.calls[0][1].title).toBe('Convite recusado');
  });

  it('o aluno não pausa nem reativa', async () => {
    await expect(setStudentStatus(link('active'), 'paused', ANA)).rejects.toThrow();
    await expect(setStudentStatus(link('paused'), 'active', ANA)).rejects.toThrow();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('o professor encerra e o aluno é avisado', async () => {
    await setStudentStatus(link('active'), 'ended', PROF);
    expect(mockUpdate.mock.calls[0][1]).toMatchObject({ status: 'ended', ended_by: 'prof' });
    expect(mockNotify.mock.calls[0][0]).toEqual(['ana']);
  });

  it('encerrado: o professor não reativa — só convida de novo', async () => {
    const fim = link('ended', { ended_at: 1, ended_by: 'ana' });
    await expect(setStudentStatus(fim, 'active', PROF)).rejects.toThrow(/novo convite/);
    await setStudentStatus(fim, 'invited', PROF);
    expect(mockUpdate.mock.calls[0][1]).toEqual({ status: 'invited', updated_at: { _ts: true } });
    expect(mockNotify.mock.calls[0][1].title).toBe('Convite de professor');
  });

  it('reconvidado: o professor não ativa por conta própria; o aluno aceita e o histórico de fim sai', async () => {
    const convite = link('invited', { ended_at: 1, ended_by: 'ana' });
    await expect(setStudentStatus(convite, 'active', PROF)).rejects.toThrow();
    await setStudentStatus(convite, 'active', ANA);
    expect(mockUpdate.mock.calls[0][1]).toMatchObject({ status: 'active', ended_at: { _delete: true }, ended_by: { _delete: true } });
  });
});

describe('removeStudent', () => {
  it('a ficha encerrada fica no histórico do professor; o admin ainda apaga', async () => {
    await expect(removeStudent(link('ended', { ended_at: 1 }), PROF)).rejects.toThrow(/histórico/);
    await removeStudent(link('ended', { ended_at: 1 }), { uid: 'adm', isPlatformAdmin: true });
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });
  it('a ficha aberta o professor ainda remove', async () => {
    await removeStudent(link('active'), PROF);
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });
});
