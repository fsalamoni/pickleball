import { describe, expect, it } from 'vitest';
import {
  ALL_PERMISSIONS, DEFAULT_STAFF_ROLES, effectiveRoles, grantActive, isLastMaster, roleHas, roleHolders, staffActionAllowed, staffHas, staffIsMaster, staffPerms, staffRoleName,
  staffTermActive, storeFederations, termStatus, validateStaffRole, validateTerm,
} from './staff.js';
import { FED_PERMISSION, STAFF_ROLE, STAFF_ROLE_PERMISSIONS } from './constants.js';

const AGORA = Date.UTC(2026, 9, 21, 15);
const DIA = 86_400_000;

describe('papéis de modelo', () => {
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
  it('todo papel tem permissões; só o presidente é admin master; mandato de 4 anos para presidente e diretor', () => {
    Object.values(STAFF_ROLE).forEach((r) => expect(STAFF_ROLE_PERMISSIONS[r].length).toBeGreaterThan(0));
    expect(DEFAULT_STAFF_ROLES.filter((r) => r.is_master).map((r) => r.id)).toEqual(['president']);
    expect(DEFAULT_STAFF_ROLES.find((r) => r.id === 'director').term_months).toBe(48);
    expect(DEFAULT_STAFF_ROLES.find((r) => r.id === 'secretary').term_months).toBe(0);
  });
  it('sem cargos gravados valem os modelos; com cargos, os da federação', () => {
    expect(effectiveRoles({})).toBe(DEFAULT_STAFF_ROLES);
    const proprios = [{ id: 'cons', name: 'Conselheiro', perms: ['members'], is_master: false, term_months: 24 }];
    expect(effectiveRoles({ staff_roles: proprios })).toBe(proprios);
  });
});

describe('permissões e mandato', () => {
  it('documento antigo (sem perms) vale pelo papel; presidente antigo é master', () => {
    expect(staffPerms({ role: 'secretary' }, AGORA)).toEqual(STAFF_ROLE_PERMISSIONS.secretary);
    expect(staffIsMaster({ role: 'president' })).toBe(true);
    expect(staffIsMaster({ role: 'director' })).toBe(false);
  });
  it('a cópia das permissões vence o papel', () => {
    expect(staffPerms({ role: 'secretary', perms: ['finance'] }, AGORA)).toEqual(['finance']);
  });
  it('mandato vencido não dá permissão — salvo ao admin master', () => {
    const vencido = { role: 'cons', perms: ['members'], term_end_ms: AGORA - 1 };
    expect(staffTermActive(vencido, AGORA)).toBe(false);
    expect(staffPerms(vencido, AGORA)).toEqual([]);
    expect(staffPerms({ ...vencido, term_end_ms: AGORA + 1 }, AGORA)).toEqual(['members']);
    expect(staffPerms({ ...vencido, term_end_ms: 0 }, AGORA)).toEqual(['members']);
    expect(staffPerms({ role: 'pres', is_master: true, perms: ALL_PERMISSIONS, term_end_ms: AGORA - DIA }, AGORA)).toEqual(ALL_PERMISSIONS);
  });
  it('estado do mandato para a tela', () => {
    expect(termStatus({}, AGORA).kind).toBe('open');
    expect(termStatus({ term_end_ms: AGORA + 90 * DIA }, AGORA).kind).toBe('active');
    expect(termStatus({ term_end_ms: AGORA + 5 * DIA }, AGORA)).toEqual({ kind: 'ending', days: 5 });
    expect(termStatus({ term_end_ms: AGORA - DIA }, AGORA).kind).toBe('expired');
    expect(termStatus({ term_end_ms: AGORA - DIA, is_master: true }, AGORA).kind).toBe('held');
  });
  it('nome do cargo: o gravado, o modelo traduzido', () => {
    expect(staffRoleName({ role: 'cons', role_name: 'Conselheiro fiscal' })).toBe('Conselheiro fiscal');
    expect(staffRoleName({ role: 'treasurer' })).toBe('Financeiro');
    expect(staffRoleName(null)).toBe('');
  });
});

describe('quem pode o quê', () => {
  const master = { user_id: 'm', is_master: true, perms: ALL_PERMISSIONS };
  const gestor = { user_id: 'g', is_master: false, perms: ['staff', 'members', 'finance'] };
  const secretario = { user_id: 's', is_master: false, perms: ['members'] };
  const cargoMaster = { id: 'pres', perms: ALL_PERMISSIONS, is_master: true };
  const cargoSec = { id: 'sec', perms: ['members'], is_master: false };
  const cargoTudo = { id: 'dir', perms: ALL_PERMISSIONS, is_master: false };
  it('admin master faz tudo', () => {
    expect(staffActionAllowed({ actor: master, role: cargoMaster, nowMs: AGORA })).toBe(true);
    expect(staffActionAllowed({ actor: master, target: gestor, role: cargoSec, nowMs: AGORA })).toBe(true);
  });
  it('com "staff": nomeia fora dos cargos master, só com permissões que tem, nunca a si', () => {
    expect(staffActionAllowed({ actor: gestor, role: cargoSec, nowMs: AGORA })).toBe(true);
    expect(staffActionAllowed({ actor: gestor, role: cargoMaster, nowMs: AGORA })).toBe(false);
    expect(staffActionAllowed({ actor: gestor, role: cargoTudo, nowMs: AGORA })).toBe(false);
    expect(staffActionAllowed({ actor: gestor, target: master, nowMs: AGORA })).toBe(false);
    expect(staffActionAllowed({ actor: gestor, target: gestor, role: cargoSec, nowMs: AGORA })).toBe(false);
  });
  it('sem "staff" ou com mandato vencido, nada', () => {
    expect(staffActionAllowed({ actor: secretario, role: cargoSec, nowMs: AGORA })).toBe(false);
    expect(staffActionAllowed({ actor: { ...gestor, term_end_ms: AGORA - 1 }, role: cargoSec, nowMs: AGORA })).toBe(false);
    expect(staffActionAllowed({ actor: null, role: cargoSec })).toBe(false);
  });
  it('a federação nunca fica sem admin master', () => {
    const outro = { user_id: 'n', is_master: true };
    expect(isLastMaster(master, [master, gestor])).toBe(true);
    expect(isLastMaster(master, [master, outro])).toBe(false);
    expect(isLastMaster(gestor, [master, gestor])).toBe(false);
  });
  it('ocupantes do cargo (pelo id novo ou pelo papel antigo)', () => {
    expect(roleHolders('secretary', [{ role: 'secretary' }, { role: 'x', role_id: 'secretary' }, { role: 'treasurer' }])).toBe(2);
  });
});

describe('validações', () => {
  it('mandato: início obrigatório, fim depois do início, alerta acima de 4 anos', () => {
    expect(validateTerm({ term_start: '2026-01-01' }).ok).toBe(true);
    expect(validateTerm({ term_start: '' }).errors.term_start).toBeTruthy();
    expect(validateTerm({ term_start: '2026-05-01', term_end: '2026-04-01' }).errors.term_end).toBeTruthy();
    expect(validateTerm({ term_start: '2026-01-01', term_end: '2030-01-01' }).longTerm).toBe(false);
    expect(validateTerm({ term_start: '2026-01-01', term_end: '2030-02-01' })).toMatchObject({ ok: true, longTerm: true });
  });
  it('cargo: nome, permissões conhecidas, master leva todas', () => {
    expect(validateStaffRole({ name: 'X', perms: ['members'] }).errors.name).toBeTruthy();
    expect(validateStaffRole({ name: 'Conselheiro', perms: ['xpto'] }).errors.perms).toBeTruthy();
    expect(validateStaffRole({ name: 'Conselheiro', perms: ['members', 'members', 'xpto'] }).value.perms).toEqual(['members']);
    expect(validateStaffRole({ name: 'Vice', is_master: true }).value.perms).toEqual(ALL_PERMISSIONS);
    expect(validateStaffRole({ name: 'Vice', perms: ['members'], term_months: 200 }).errors.term_months).toBeTruthy();
    expect(validateStaffRole({ id: 'Não vale', name: 'Vice', perms: ['members'] }).errors.id).toBeTruthy();
  });
  it('acesso de suporte vale até o prazo', () => {
    expect(grantActive({ expires_ms: AGORA + 1 }, AGORA)).toBe(true);
    expect(grantActive({ expires_ms: AGORA }, AGORA)).toBe(false);
    expect(grantActive(null, AGORA)).toBe(false);
  });
});

describe('storeFederations', () => {
  const fed = (id, store = true) => ({ id, name: id, modules: { store } });
  it('só admin/financeiro com o mandato valendo, só com a loja ligada, sem repetir', () => {
    const roles = [
      { federation_id: 'a', role: 'treasurer' }, { federation_id: 'b', role: 'secretary' },
      { federation_id: 'c', role: 'president' }, { federation_id: 'a', role: 'director' }, { federation_id: 'x', role: 'president' },
      { federation_id: 'd', role: 'cons', perms: ['finance'], term_end_ms: AGORA - 1 },
    ];
    expect(storeFederations(roles, [fed('a'), fed('b'), fed('c', false), fed('d')], AGORA).map((f) => f.id)).toEqual(['a']);
  });
});
