import { beforeEach, describe, it, expect, vi } from 'vitest';

vi.mock('./progressionV2Service.js');
vi.mock('./missionService.js');
vi.mock('./streakMetaService.js');
vi.mock('./referralService.js');
vi.mock('./kudoService.js');
vi.mock('./socialBondService.js');
vi.mock('./gamificationPrefsService.js');
vi.mock('./xpGrantService.js');
vi.mock('./socialGamificationService.js');
vi.mock('./hallOfFameService.js');
vi.mock('./challengeService.js');
vi.mock('./rewardService.js');
vi.mock('@/modules/achievements/services/achievementsV2Service');

import { listXpGrants } from './xpGrantService.js';
import { listReceivedLetters, listSentLetters } from './socialGamificationService.js';
import { listMyDuels, listMyEntries } from './challengeService.js';
import { TETO, collectGamificationExport } from './gamificationExportService.js';

describe('collectGamificationExport', () => {
  beforeEach(() => vi.resetAllMocks());

  it('⭐ a parte que falha vai para `incomplete` e não derruba as outras', async () => {
    listXpGrants.mockResolvedValue([{ id: 'g1', xp: 500 }]);
    listSentLetters.mockRejectedValue(new Error('rede'));
    const { gamification, incomplete } = await collectGamificationExport('u1');
    expect(gamification.xp_grants).toEqual([{ id: 'g1', xp: 500 }]);
    expect(gamification).not.toHaveProperty('letters_sent');
    expect(incomplete).toEqual(['Cartas ao companheiro enviadas']);
    expect(gamification.reputation).toBeNull();
  });

  it('⭐ a lista que enche o teto vai para `incomplete` (corte calado é buraco)', async () => {
    listMyDuels.mockResolvedValue(Array.from({ length: TETO }, (_, i) => ({ id: `d${i}`, uidA: 'u1', uidB: `x${i}` })));
    listMyEntries.mockResolvedValue([{ id: 'e1' }]);
    const { gamification, incomplete } = await collectGamificationExport('u1');
    expect(gamification.duels).toHaveLength(TETO);
    expect(listMyDuels).toHaveBeenCalledWith('u1', TETO);
    expect(incomplete).toEqual([`Duelos da semana (só os primeiros ${TETO})`]);
  });

  it('⭐ a carta ANÔNIMA recebida não leva o autor (nem no id do documento)', async () => {
    listReceivedLetters.mockResolvedValue([
      { id: 'g1__autorB__u1', fromUid: null, fromName: null, showName: false, toUid: 'u1', matchKey: 'g1', text: 'valeu' },
      { id: 'g2__autorC__u1', fromUid: 'autorC', fromName: 'Cris', showName: true, toUid: 'u1', matchKey: 'g2', text: 'oi' },
    ]);
    const { gamification } = await collectGamificationExport('u1');
    expect(JSON.stringify(gamification.letters_received)).not.toContain('autorB');
    expect(gamification.letters_received[0]).toMatchObject({ matchKey: 'g1', text: 'valeu' });
    expect(gamification.letters_received[1].fromUid).toBe('autorC');
  });
});
