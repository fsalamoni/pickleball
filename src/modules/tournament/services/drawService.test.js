import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  MODALITY_FORMAT,
  TOURNAMENT_STAGE_TYPE,
  PHASE_DIVISION_MODE,
  REGISTRATION_STATUS,
} from '../domain/constants.js';

// Colaboradores de I/O mockados: runDraw só orquestra (a lógica de nº de grupos
// é pura, via plannedGroupCount). Assim o teste roda sem Firestore real.
const h = vi.hoisted(() => ({
  getModality: vi.fn(),
  getTournament: vi.fn(),
  listRegistrations: vi.fn(),
  persistMatches: vi.fn(),
  clearStale: vi.fn(),
  createAuditLog: vi.fn(),
}));

vi.mock('./modalityService.js', () => ({ getModality: h.getModality }));
vi.mock('./tournamentService.js', () => ({ getTournament: h.getTournament }));
vi.mock('./registrationService.js', () => ({ listRegistrations: h.listRegistrations }));
vi.mock('./matchService.js', () => ({
  persistMatches: h.persistMatches,
  clearStaleSingleGroupMarkers: h.clearStale,
}));
vi.mock('@/core/services/auditService', () => ({ createAuditLog: h.createAuditLog }));
vi.mock('@/core/config/firebase', () => ({ db: {} }));

const { runDraw } = await import('./drawService.js');

const TID = 'trn1';
const MID = 'mod1';

function regs(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: `r${i + 1}`,
    status: REGISTRATION_STATUS.CONFIRMED,
  }));
}

function setup({ stage, format = MODALITY_FORMAT.DOUBLES, team = true, n = 6 } = {}) {
  h.getModality.mockResolvedValue({
    id: MID,
    tournament_id: TID,
    format,
    team_config: team ? {} : null,
    stages: [stage],
  });
  h.getTournament.mockResolvedValue({ id: TID, results_locked: false, starts_at: null });
  h.listRegistrations.mockResolvedValue(regs(n));
  h.persistMatches.mockResolvedValue({ scheduleWarnings: [] });
  h.clearStale.mockResolvedValue({ cleared: 0, groupsRemoved: 0 });
}

describe('runDraw — honra o modo de divisão da fase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('grupo único: gera 1 grupo mesmo com group_count antigo gravado', async () => {
    setup({
      stage: {
        type: TOURNAMENT_STAGE_TYPE.GROUPS,
        division_mode: PHASE_DIVISION_MODE.SINGLE,
        group_count: 3, // resquício antigo — deve ser ignorado
      },
    });

    const result = await runDraw(
      { tournamentId: TID, modalityId: MID, stageIndex: 0, seed: 's' },
      { uid: 'admin' },
    );

    expect(Array.isArray(result.groups)).toBe(true);
    expect(result.groups).toHaveLength(1);
    // persistMatches recebeu o mesmo desenho (1 grupo).
    expect(h.persistMatches).toHaveBeenCalledTimes(1);
    expect(h.persistMatches.mock.calls[0][3].groups).toHaveLength(1);
  });

  it('nº de grupos (legado sem division_mode): group_count > 1 gera vários grupos', async () => {
    setup({
      stage: {
        type: TOURNAMENT_STAGE_TYPE.GROUPS,
        group_count: 2, // sem division_mode → inferido GROUP_COUNT
      },
    });

    const result = await runDraw(
      { tournamentId: TID, modalityId: MID, stageIndex: 0, seed: 's' },
      { uid: 'admin' },
    );

    expect(result.groups).toHaveLength(2);
  });
});

describe('runDraw — limpa resíduos de grupo único automaticamente', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fase de grupo único: chama clearStaleSingleGroupMarkers após persistir', async () => {
    setup({
      stage: {
        type: TOURNAMENT_STAGE_TYPE.GROUPS,
        division_mode: PHASE_DIVISION_MODE.SINGLE,
      },
    });

    await runDraw(
      { tournamentId: TID, modalityId: MID, stageIndex: 0, seed: 's' },
      { uid: 'admin' },
    );

    expect(h.persistMatches).toHaveBeenCalledTimes(1);
    expect(h.clearStale).toHaveBeenCalledTimes(1);
    expect(h.clearStale).toHaveBeenCalledWith(MID, expect.objectContaining({ id: MID }), { uid: 'admin' });
  });

  it('fase de nº de grupos: NÃO chama a limpeza (não é grupo único)', async () => {
    setup({
      stage: {
        type: TOURNAMENT_STAGE_TYPE.GROUPS,
        division_mode: PHASE_DIVISION_MODE.GROUP_COUNT,
        group_count: 2,
      },
    });

    await runDraw(
      { tournamentId: TID, modalityId: MID, stageIndex: 0, seed: 's' },
      { uid: 'admin' },
    );

    expect(h.persistMatches).toHaveBeenCalledTimes(1);
    expect(h.clearStale).not.toHaveBeenCalled();
  });

  it('fase de grupos legada (sem division_mode): NÃO chama a limpeza', async () => {
    setup({
      stage: {
        type: TOURNAMENT_STAGE_TYPE.GROUPS,
        group_count: 2,
      },
    });

    await runDraw(
      { tournamentId: TID, modalityId: MID, stageIndex: 0, seed: 's' },
      { uid: 'admin' },
    );

    expect(h.clearStale).not.toHaveBeenCalled();
  });
});
