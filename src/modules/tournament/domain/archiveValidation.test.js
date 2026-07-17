import { describe, it, expect } from 'vitest';
import {
  validateArchiveRequest,
  validateUnarchiveRequest,
} from './archiveValidation.js';
import { TOURNAMENT_STATUS } from './constants.js';

describe('validateArchiveRequest', () => {
  it('retorna ok quando o torneio está cancelado e não arquivado', () => {
    const tournament = { status: TOURNAMENT_STATUS.CANCELLED, archived: false };
    expect(validateArchiveRequest(tournament)).toEqual({ ok: true });
  });

  it('retorna ok mesmo se `archived` for undefined (torneio antigo sem o campo)', () => {
    const tournament = { status: TOURNAMENT_STATUS.CANCELLED };
    expect(validateArchiveRequest(tournament)).toEqual({ ok: true });
  });

  it('rejeita torneio nulo/undefined com NOT_FOUND', () => {
    expect(validateArchiveRequest(null)).toMatchObject({ ok: false, code: 'NOT_FOUND' });
    expect(validateArchiveRequest(undefined)).toMatchObject({ ok: false, code: 'NOT_FOUND' });
  });

  it('rejeita torneio já arquivado com ALREADY_ARCHIVED', () => {
    const tournament = { status: TOURNAMENT_STATUS.CANCELLED, archived: true };
    expect(validateArchiveRequest(tournament)).toMatchObject({
      ok: false,
      code: 'ALREADY_ARCHIVED',
    });
  });

  it('rejeita torneio com status diferente de cancelled com NOT_CANCELLED', () => {
    const cases = [
      TOURNAMENT_STATUS.DRAFT,
      TOURNAMENT_STATUS.REGISTRATIONS_OPEN,
      TOURNAMENT_STATUS.REGISTRATIONS_CLOSED,
      TOURNAMENT_STATUS.IN_PROGRESS,
      TOURNAMENT_STATUS.FINISHED,
      'qualquer-outro-status',
    ];
    for (const status of cases) {
      const result = validateArchiveRequest({ status, archived: false });
      expect(result).toMatchObject({ ok: false, code: 'NOT_CANCELLED' });
      // a mensagem deve mencionar o cancelamento
      expect(result.reason.toLowerCase()).toContain('cancelad');
    }
  });
});

describe('validateUnarchiveRequest', () => {
  it('retorna ok quando o torneio está arquivado', () => {
    const tournament = { status: TOURNAMENT_STATUS.FINISHED, archived: true };
    expect(validateUnarchiveRequest(tournament)).toEqual({ ok: true });
  });

  it('rejeita torneio nulo/undefined com NOT_FOUND', () => {
    expect(validateUnarchiveRequest(null)).toMatchObject({ ok: false, code: 'NOT_FOUND' });
    expect(validateUnarchiveRequest(undefined)).toMatchObject({ ok: false, code: 'NOT_FOUND' });
  });

  it('rejeita torneio não arquivado com NOT_ARCHIVED', () => {
    const cases = [
      { archived: false, status: TOURNAMENT_STATUS.DRAFT },
      { archived: false, status: TOURNAMENT_STATUS.IN_PROGRESS },
      { archived: undefined, status: TOURNAMENT_STATUS.CANCELLED },
    ];
    for (const tournament of cases) {
      expect(validateUnarchiveRequest(tournament)).toMatchObject({
        ok: false,
        code: 'NOT_ARCHIVED',
      });
    }
  });
});

describe('archiveValidation — invariantes gerais', () => {
  it('arquivar exige cancelled; desarquivar não exige status específico', () => {
    // Arquivar com qualquer status que não seja cancelled falha
    for (const status of Object.values(TOURNAMENT_STATUS)) {
      if (status === TOURNAMENT_STATUS.CANCELLED) continue;
      expect(validateArchiveRequest({ status, archived: false }).ok).toBe(false);
    }
    // Desarquivar não olha o status
    for (const status of Object.values(TOURNAMENT_STATUS)) {
      expect(validateUnarchiveRequest({ status, archived: true })).toEqual({ ok: true });
    }
  });
});
