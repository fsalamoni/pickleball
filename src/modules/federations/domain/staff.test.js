import { describe, expect, it } from 'vitest';
import { assignableRoles, canChangeStaff, roleHas, staffHas, storeFederations } from './staff.js';
import { FED_PERMISSION, STAFF_ROLE, STAFF_ROLE_PERMISSIONS } from './constants.js';

describe('papéis e permissões', () => {
  it('presidente e diretor têm tudo; os demais, só a sua área', () => {
    Object.values(FED_PERMISSION).forEach((p) => {
      expect(roleHas('president', p)).toBe(true);
      expect(roleHas('director', p)).toBe(true);
    });
    expect(roleHas('secretary', 'members')).toBe(true);
    expect(roleHas('secretary', 'finance')).toBe(false);
    expect(roleHas('treasurer', 'finance')).toBe(true);
    expect(roleHas('xpto', 'members')).toBe(false);
    expect(staffHas(null, 'members')).toBe(false);
  });
  it('todo papel tem permissões definidas', () => {
    Object.values(STAFF_ROLE).forEach((r) => expect(STAFF_ROLE_PERMISSIONS[r].length).toBeGreaterThan(0));
  });
});

describe('canChangeStaff', () => {
  it('só o presidente mexe no presidente, e não se rebaixa sozinho', () => {
    expect(canChangeStaff({ actorRole: 'director', targetRole: 'president', newRole: 'director' })).toBe(false);
    expect(canChangeStaff({ actorRole: 'director', targetRole: 'secretary', newRole: 'president' })).toBe(false);
    expect(canChangeStaff({ actorRole: 'president', targetRole: 'secretary', newRole: 'president' })).toBe(true);
    expect(canChangeStaff({ actorRole: 'president', targetRole: 'president', newRole: 'director', isSelf: true })).toBe(false);
    expect(canChangeStaff({ actorRole: 'secretary', targetRole: 'treasurer', newRole: 'secretary' })).toBe(false);
  });
  it('papéis atribuíveis', () => {
    expect(assignableRoles('director')).not.toContain('president');
    expect(assignableRoles('president')).toContain('president');
    expect(assignableRoles('secretary')).toEqual([]);
  });
});

describe('storeFederations', () => {
  const fed = (id, store = true) => ({ id, name: id, modules: { store } });
  it('só admin/financeiro, só com a loja ligada, sem repetir', () => {
    const roles = [
      { federation_id: 'a', role: 'treasurer' }, { federation_id: 'b', role: 'secretary' },
      { federation_id: 'c', role: 'president' }, { federation_id: 'a', role: 'director' }, { federation_id: 'x', role: 'president' },
    ];
    expect(storeFederations(roles, [fed('a'), fed('b'), fed('c', false)]).map((f) => f.id)).toEqual(['a']);
  });
});
