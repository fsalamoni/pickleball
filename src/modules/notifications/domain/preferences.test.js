import { describe, it, expect } from 'vitest';
import {
  NOTIFICATION_CATEGORIES,
  categoryOfType,
  defaultNotificationPrefs,
  normalizeNotificationPrefs,
  isNotificationMuted,
} from './preferences.js';

describe('notification preferences (domínio)', () => {
  it('mapeia tipos conhecidos para suas categorias', () => {
    expect(categoryOfType('chat_message')).toBe('social');
    expect(categoryOfType('tournament_open')).toBe('tournaments');
    expect(categoryOfType('partner_invite')).toBe('partners');
    expect(categoryOfType('club_invite')).toBe('clubs');
    expect(categoryOfType('profile_reminder')).toBe('reminders');
  });

  it('retorna null para tipos genéricos ou desconhecidos', () => {
    expect(categoryOfType('generic')).toBeNull();
    expect(categoryOfType('algo_inexistente')).toBeNull();
    expect(categoryOfType(undefined)).toBeNull();
  });

  it('cada tipo pertence a exatamente uma categoria', () => {
    const seen = new Set();
    NOTIFICATION_CATEGORIES.forEach((cat) => {
      cat.types.forEach((t) => {
        expect(seen.has(t)).toBe(false);
        seen.add(t);
      });
    });
    expect(seen.size).toBeGreaterThan(0);
  });

  it('padrão habilita todas as categorias', () => {
    const prefs = defaultNotificationPrefs();
    NOTIFICATION_CATEGORIES.forEach((cat) => {
      expect(prefs[cat.id]).toBe(true);
    });
  });

  it('normaliza sobrescrevendo só booleanos explícitos', () => {
    const prefs = normalizeNotificationPrefs({ social: false, clubs: 'sim', desconhecida: true });
    expect(prefs.social).toBe(false);
    expect(prefs.clubs).toBe(true); // valor não-booleano cai no padrão
    expect(prefs.desconhecida).toBeUndefined();
    expect(prefs.tournaments).toBe(true);
  });

  it('normaliza entradas inválidas para o padrão', () => {
    expect(normalizeNotificationPrefs(null)).toEqual(defaultNotificationPrefs());
    expect(normalizeNotificationPrefs(undefined)).toEqual(defaultNotificationPrefs());
    expect(normalizeNotificationPrefs('x')).toEqual(defaultNotificationPrefs());
  });

  it('silencia apenas categorias explicitamente desligadas', () => {
    const prefs = { social: false };
    expect(isNotificationMuted(prefs, 'chat_message')).toBe(true);
    expect(isNotificationMuted(prefs, 'forum_reply')).toBe(true);
    expect(isNotificationMuted(prefs, 'tournament_open')).toBe(false);
  });

  it('nunca silencia genéricos ou desconhecidos', () => {
    expect(isNotificationMuted({ social: false }, 'generic')).toBe(false);
    expect(isNotificationMuted({}, 'algo_novo')).toBe(false);
  });

  it('sem preferências, nada é silenciado', () => {
    expect(isNotificationMuted(undefined, 'chat_message')).toBe(false);
    expect(isNotificationMuted({}, 'tournament_open')).toBe(false);
  });
});
