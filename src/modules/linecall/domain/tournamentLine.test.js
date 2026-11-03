import { describe, it, expect } from 'vitest';
import {
  tournamentCourts, tournamentLineHost, tournamentLinePage, isTournamentCourtId,
} from './tournamentLine';
import { hostPath } from '../services/lineCallSync';

describe('tournamentLine', () => {
  it('as quadras saem do maior court_count das modalidades, mais as que já têm documento', () => {
    expect(tournamentCourts([{ court_count: 2 }, { court_count: 4 }]).map((c) => c.id)).toEqual(['court-1', 'court-2', 'court-3', 'court-4']);
    expect(tournamentCourts([]).map((c) => c.id)).toEqual(['court-1']);
    expect(tournamentCourts([{ court_count: 1 }], [{ court_id: 'court-3' }, { court_id: 'x' }]).map((c) => c.id)).toEqual(['court-1', 'court-3']);
  });

  it('caminhos: anfitrião, página e validação da quadra', () => {
    expect(tournamentLineHost('T1', 'court-2')).toBe('tournament_line_courts/T1_court-2');
    expect(hostPath(tournamentLineHost('T1', 'court-2'))).toBe('tournament_line_courts/T1_court-2');
    expect(hostPath('GD1')).toBe('game_days/GD1');
    expect(tournamentLinePage('T1', 'court-2')).toBe('/torneios/T1/linhas?quadra=court-2');
    expect(tournamentLinePage('T1')).toBe('/torneios/T1/linhas');
    expect(isTournamentCourtId('court-12')).toBe(true);
    expect(isTournamentCourtId('court-x')).toBe(false);
  });
});
