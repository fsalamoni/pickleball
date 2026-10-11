/**
 * O interruptor do admin para o início de todo mundo (`platform_settings/global.inicio`).
 * A regra que não pode regredir: SEM o campo, a área de promoções está LIGADA.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/core/config/firebase', () => ({ db: null }));
vi.mock('@/core/services/auditService', () => ({ createAuditLog: vi.fn() }));

const { DEFAULT_PLATFORM_HOME, normalizePlatformHome, getPlatformSettings } = await import('./platformSettingsService.js');

describe('normalizePlatformHome', () => {
  it('nasce ligada: sem campo, com lixo ou com o campo ausente vale true', () => {
    expect(normalizePlatformHome(undefined)).toEqual({ promocoes: true });
    expect(normalizePlatformHome(null)).toEqual({ promocoes: true });
    expect(normalizePlatformHome('x')).toEqual({ promocoes: true });
    expect(normalizePlatformHome({})).toEqual({ promocoes: true });
    expect(normalizePlatformHome({ promocoes: 'não' })).toEqual({ promocoes: true });
    expect(DEFAULT_PLATFORM_HOME).toEqual({ promocoes: true });
  });

  it('só o false explícito desliga', () => {
    expect(normalizePlatformHome({ promocoes: false })).toEqual({ promocoes: false });
    expect(normalizePlatformHome({ promocoes: true })).toEqual({ promocoes: true });
  });

  it('sem banco, as configurações trazem o início com os padrões', async () => {
    const cfg = await getPlatformSettings();
    expect(cfg.inicio).toEqual({ promocoes: true });
    expect(cfg.feature_flags).toBeTruthy();
  });
});
