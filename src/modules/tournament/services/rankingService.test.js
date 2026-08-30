import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  TOURNAMENT_STAGE_TYPE,
  PHASE_DIVISION_MODE,
} from '../domain/constants.js';

// I/O mockado. A regra sob teste (colapso de "grupo único") é pura e roda de
// verdade; só o acesso ao Firestore é simulado.
const h = vi.hoisted(() => ({
  getModality: vi.fn(),
  getTournament: vi.fn(),
  listRegistrations: vi.fn(),
  listAllMatchesForModality: vi.fn(),
  getDocs: vi.fn(),
}));

vi.mock('./modalityService.js', () => ({ getModality: h.getModality }));
vi.mock('./tournamentService.js', () => ({ getTournament: h.getTournament }));
vi.mock('./registrationService.js', () => ({ listRegistrations: h.listRegistrations }));
vi.mock('./matchService.js', () => ({ listAllMatchesForModality: h.listAllMatchesForModality }));
vi.mock('@/core/config/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({})),
  query: vi.fn(() => ({})),
  where: vi.fn(() => ({})),
  getDocs: h.getDocs,
}));

const { computeModalityRankingStructured } = await import('./rankingService.js');

const MID = 'mod1';

function regs(ids) {
  return ids.map((id) => ({ id, athlete_name: id.toUpperCase() }));
}

// Dois jogos, um por "grupo" marcado nos dados (resquício de sorteio antigo).
function twoGroupMatches() {
  return [
    { id: 'm1', stage_index: 0, group: 'A', side_a_ids: ['p1'], side_b_ids: ['p2'], status: 'pending' },
    { id: 'm2', stage_index: 0, group: 'B', side_a_ids: ['p3'], side_b_ids: ['p4'], status: 'pending' },
  ];
}

describe('computeModalityRankingStructured — grupo único segue a modalidade', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.getTournament.mockResolvedValue({ id: 'trn1' });
    h.listRegistrations.mockResolvedValue(regs(['p1', 'p2', 'p3', 'p4']));
    h.getDocs.mockResolvedValue({ docs: [] }); // sem grupos persistidos
  });

  it('division_mode single: colapsa numa única tabela mesmo com m.group antigo', async () => {
    h.getModality.mockResolvedValue({
      id: MID,
      tournament_id: 'trn1',
      stages: [{ type: TOURNAMENT_STAGE_TYPE.GROUPS, division_mode: PHASE_DIVISION_MODE.SINGLE }],
    });
    h.listAllMatchesForModality.mockResolvedValue(twoGroupMatches());

    const { phases } = await computeModalityRankingStructured(MID);

    expect(phases).toHaveLength(1);
    expect(phases[0].groups).toHaveLength(1);
    expect(phases[0].groups[0].name).toBeNull();
  });

  it('legado {type:groups} sem division_mode: mantém os grupos marcados nos jogos', async () => {
    h.getModality.mockResolvedValue({
      id: MID,
      tournament_id: 'trn1',
      stages: [{ type: TOURNAMENT_STAGE_TYPE.GROUPS }],
    });
    h.listAllMatchesForModality.mockResolvedValue(twoGroupMatches());

    const { phases } = await computeModalityRankingStructured(MID);

    expect(phases).toHaveLength(1);
    expect(phases[0].groups).toHaveLength(2);
    expect(phases[0].groups.map((g) => g.name).sort()).toEqual(['A', 'B']);
  });
});
