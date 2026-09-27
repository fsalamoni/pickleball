/**
 * 🐞 O aviso da campanha nunca chegava quando o destino tinha `#`.
 *
 * A regra de `notifications` (`isInternalLink`) recusa `#`, e os destinos que
 * rolam até uma seção da página da arena são `/arenas/X#arena-…`. `notifyUsers`
 * grava em lote e engole o erro: a campanha dizia "enviada para N pessoas" e
 * ninguém recebia. No aviso, esses destinos passam a levar à página da
 * campanha (que tem o banner e o botão certo).
 */
import { describe, it, expect, vi } from 'vitest';
import { isRuleSafeLink } from '@/core/domain/internalLink';
import { destinationLink, CAMPAIGN_DESTINATION } from '../domain/campaignBanner.js';

vi.mock('@/core/config/firebase', () => ({ db: {} }));
vi.mock('@/core/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/services/auditService', () => ({ createAuditLog: vi.fn(() => Promise.resolve()) }));
vi.mock('@/core/services/notificationService', () => ({
  notifyUsers: vi.fn(() => Promise.resolve()), NOTIFICATION_TYPE: { GENERIC: 'generic' },
}));
vi.mock('./v3SettingsService.js', () => ({ getOrCreateArenaSettings: vi.fn() }));

const { linkDoAviso } = await import('./campaignBannerService.js');

describe('linkDoAviso — todo destino de campanha gera um aviso que a regra aceita', () => {
  it.each(Object.values(CAMPAIGN_DESTINATION))('destino %s', (tipo) => {
    const ctx = { arenaId: 'arena1', campaignId: 'camp1' };
    const link = destinationLink({ type: tipo }, ctx);
    const aviso = linkDoAviso(link, ctx);
    expect(isRuleSafeLink(aviso)).toBe(true);
    if (!link.includes('#')) expect(aviso).toBe(link);
    else expect(aviso).toBe('/arenas/arena1/campanhas/camp1');
  });

  it('destino com alvo escolhido segue direto (sem #)', () => {
    const ctx = { arenaId: 'arena1', campaignId: 'camp1' };
    const link = destinationLink({ type: CAMPAIGN_DESTINATION.TOURNAMENT, target_id: 't9' }, ctx);
    expect(linkDoAviso(link, ctx)).toBe('/torneios/t9');
  });
});
