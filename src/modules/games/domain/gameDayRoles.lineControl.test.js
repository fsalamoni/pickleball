import { describe, it, expect } from 'vitest';
import { canConfigureLineControl } from './gameDayRoles';

const gd = { created_by: 'dono', admin_uids: ['nomeado'], member_uids: ['dono', 'atleta'], manage_mode: 'participants', format: 'americano' };

describe('canConfigureLineControl', () => {
  it('criador, administrador nomeado, gestor da arena e admin do clube ligam', () => {
    expect(canConfigureLineControl(gd, 'dono')).toBe(true);
    expect(canConfigureLineControl(gd, 'nomeado')).toBe(true);
    expect(canConfigureLineControl({ ...gd, arena_id: 'a1' }, 'gestor', { arenaManager: true })).toBe(true);
    expect(canConfigureLineControl({ ...gd, club_id: 'c1' }, 'adminClube', { clubManager: true })).toBe(true);
  });

  it('o participante de um dia aberto e quem não tem conta não ligam', () => {
    expect(canConfigureLineControl(gd, 'atleta')).toBe(false);
    expect(canConfigureLineControl(gd, null)).toBe(false);
    expect(canConfigureLineControl(null, 'dono')).toBe(false);
  });
});
