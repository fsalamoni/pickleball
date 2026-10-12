import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { validateRevealRequest, revealFields } = require('../functions/supportAccess.js');

describe('validateRevealRequest', () => {
  const ok = { uid: 'u', fields: ['email', 'phone'], reason_category: 'suporte_solicitado', reason_text: 'A pessoa pediu ajuda para trocar o telefone.' };
  it('aceita o pedido completo', () => { expect(validateRevealRequest(ok).error).toBeUndefined(); });
  it('🔴 campo fora da lista fechada é recusado', () => {
    expect(validateRevealRequest({ ...ok, fields: ['role'] }).error).toMatch(/revelar/);
  });
  it('exige categoria conhecida e texto ≥ 20', () => {
    expect(validateRevealRequest({ ...ok, reason_category: 'x' }).error).toMatch(/categoria/);
    expect(validateRevealRequest({ ...ok, reason_text: 'curto' }).error).toMatch(/motivo/);
  });
});

describe('revealFields', () => {
  function fakeDb(user) {
    const adds = [];
    return {
      adds,
      collection: (col) => ({
        doc: () => ({ get: async () => ({ exists: Boolean(user), data: () => user }) }),
        add: async (d) => adds.push({ col, d }),
      }),
    };
  }
  it('⭐ registra (com hash, nunca o valor) e só então devolve — sem avisar o titular', async () => {
    const db = fakeDb({ email: 'ana@x.com', phone: '51999', platform_name: 'Ana' });
    const pedido = validateRevealRequest({ uid: 'u', fields: ['email'], reason_category: 'outro', reason_text: 'motivo longo o bastante para passar' });
    const res = await revealFields({ db }, pedido, { actor: { uid: 'admin', email: 'a@x.com' }, ip: '1.2.3.4', now: 5 });
    expect(res.values).toEqual({ email: 'ana@x.com' });
    const log = db.adds.find((a) => a.col === 'admin_access_logs').d;
    expect(log).toMatchObject({ admin_uid: 'admin', target_uid: 'u', fields: ['email'], action: 'reveal_field' });
    expect(JSON.stringify(log)).not.toContain('ana@x.com');
    expect(log.value_hashes.email).toHaveLength(24);
    // Registro interno: nenhum aviso é gravado para a pessoa.
    expect(db.adds.filter((a) => a.col === 'notifications')).toHaveLength(0);
    expect(db.adds).toHaveLength(1);
  });
  it('conta inexistente não registra nada', async () => {
    const db = fakeDb(null);
    const pedido = validateRevealRequest({ uid: 'u', fields: ['email'], reason_category: 'outro', reason_text: 'motivo longo o bastante para passar' });
    await expect(revealFields({ db }, pedido, { actor: { uid: 'a' } })).rejects.toThrow(/não encontrado/);
    expect(db.adds).toHaveLength(0);
  });
});
