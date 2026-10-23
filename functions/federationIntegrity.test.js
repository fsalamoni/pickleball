/**
 * Equipamentos homologados no SERVIDOR contra um Firestore falso: quem grava
 * (competições/admin; o financeiro não), o módulo ligado, a situação com data
 * e motivo no histórico, e apagar só pelo admin.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ig = require('./federationIntegrity.js');
const { createFakeDb, FakeFieldValue } = require('../tests/fakes/fakeFirestore.cjs');

const NOW = Date.UTC(2026, 9, 23, 15, 0, 0); // 23/10/2026, meio-dia em Brasília
const PRES = { uid: 'pres', name: 'Presidente' };
const COMP = { uid: 'comp', name: 'Competições' };
const FIN = { uid: 'fin', name: 'Financeiro' };

function cenario(mods = { equipment: true }) {
  return {
    db: createFakeDb({
      'platform_settings/global': { feature_flags: { federations: true } },
      'federations/fgp': { name: 'Federação Gaúcha', acronym: 'FGP', status: 'approved', published: true, modules: mods },
      'federation_staff/fgp_pres': { federation_id: 'fgp', user_id: 'pres', role: 'president' },
      'federation_staff/fgp_comp': { federation_id: 'fgp', user_id: 'comp', role: 'custom', perms: ['competitions'] },
      'federation_staff/fgp_fin': { federation_id: 'fgp', user_id: 'fin', role: 'custom', perms: ['finance'] },
    }),
  };
}
const ctx = (c) => ({ db: c.db, now: NOW, FieldValue: FakeFieldValue, Timestamp: { fromMillis: (ms) => ({ ms }) }, logger: { info() {}, warn() {} } });
const chamar = (c, actor, data) => ig.integrity(ctx(c), actor, { federationId: 'fgp', ...data });
const doc = (c, path) => c.db.store.docs.get(path);
const RAQUETE = { kind: 'paddle', brand: 'Selkirk', model: 'Vanguard Power Air', source: 'USA Pickleball' };

describe('equipamentos homologados', () => {
  it('competições cadastra homologado com a data de hoje; o financeiro e o módulo desligado não', async () => {
    const c = cenario();
    const { equipmentId } = await chamar(c, COMP, { action: 'equipment_save', item: RAQUETE });
    expect(doc(c, `federation_equipment/${equipmentId}`)).toMatchObject({ federation_id: 'fgp', status: 'approved', status_at: '2026-10-23', brand: 'Selkirk', created_by: 'comp' });
    await expect(chamar(c, FIN, { action: 'equipment_save', item: RAQUETE })).rejects.toThrow(/competições/);
    await expect(chamar(cenario({}), COMP, { action: 'equipment_save', item: RAQUETE })).rejects.toThrow(/módulo/);
    await expect(chamar(c, COMP, { action: 'equipment_save', item: { ...RAQUETE, brand: 'x' } })).rejects.toThrow(/marca/);
  });

  it('cadastrar já reprovado pede motivo', async () => {
    const c = cenario();
    await expect(chamar(c, COMP, { action: 'equipment_save', item: { ...RAQUETE, status: 'rejected' } })).rejects.toThrow(/motivo/);
    const { equipmentId } = await chamar(c, COMP, { action: 'equipment_save', item: { ...RAQUETE, status: 'rejected', reason: 'Superfície acima do limite de aspereza.' } });
    expect(doc(c, `federation_equipment/${equipmentId}`)).toMatchObject({ status: 'rejected', status_reason: 'Superfície acima do limite de aspereza.' });
  });

  it('descertificar pede motivo, não aceita data futura e fica no histórico; editar não muda a situação', async () => {
    const c = cenario();
    const { equipmentId } = await chamar(c, COMP, { action: 'equipment_save', item: RAQUETE });
    await expect(chamar(c, COMP, { action: 'equipment_status', equipmentId, status: 'decertified' })).rejects.toThrow(/motivo/);
    await expect(chamar(c, COMP, { action: 'equipment_status', equipmentId, status: 'decertified', reason: 'Falhou no reteste.', date: '2026-12-01' })).rejects.toThrow(/futuro/);
    await expect(chamar(c, COMP, { action: 'equipment_status', equipmentId, status: 'approved' })).rejects.toThrow(/já está/);
    await chamar(c, COMP, { action: 'equipment_status', equipmentId, status: 'decertified', reason: 'Falhou no reteste.' });
    await chamar(c, COMP, { action: 'equipment_save', equipmentId, item: { ...RAQUETE, model: 'Vanguard Power Air 16' } });
    const d = doc(c, `federation_equipment/${equipmentId}`);
    expect(d).toMatchObject({ status: 'decertified', status_reason: 'Falhou no reteste.', model: 'Vanguard Power Air 16' });
    expect(d.history.map((h) => h.action)).toEqual(['create', 'status', 'update']);
    expect(d.history[1]).toMatchObject({ from: 'approved', status: 'decertified', by: 'comp' });
    await expect(chamar(c, COMP, { action: 'equipment_status', equipmentId, status: 'approved' })).rejects.toThrow(/motivo/);
  });

  it('apagar só o admin', async () => {
    const c = cenario();
    const { equipmentId } = await chamar(c, COMP, { action: 'equipment_save', item: RAQUETE });
    await expect(chamar(c, COMP, { action: 'equipment_delete', equipmentId })).rejects.toThrow(/administração/);
    await chamar(c, PRES, { action: 'equipment_delete', equipmentId });
    expect(doc(c, `federation_equipment/${equipmentId}`)).toBeUndefined();
  });
});
