import { describe, it, expect } from 'vitest';
import {
  buildAccessRoster, classifyAccount, canRevokeAccount, revokeBlockedReason,
  buildRevokePayload, ALERT_LEVEL,
} from './accessRoster.js';

const DONO = 'fsalamoni@gmail.com';
const ctx = { ownerEmails: [DONO], currentUid: 'dono_uid' };

const u = (over = {}) => ({ uid: 'x', email: 'x@x.com', role: 'user', ...over });

// O caso real encontrado em produção, com os uids trocados por nomes legíveis.
const CENARIO_REAL = [
  u({ uid: 'dono_uid', email: DONO, role: 'platform_admin', can_create_pools: true, full_name: 'Dono' }),
  u({ uid: 'sobra1', email: '', role: 'platform_admin', hidden: true, hidden_by: 'dono_uid' }),
  u({ uid: 'sobra2', email: '', role: 'platform_admin', hidden: true, hidden_by: 'dono_uid' }),
  u({ uid: 'sobra3', email: '', role: 'platform_admin', hidden: true, hidden_by: 'dono_uid' }),
  u({ uid: 'atleta', email: 'atleta@x.com', role: 'user' }),
];

describe('classifyAccount', () => {
  it('reconhece o dono pelo e-mail', () => {
    const c = classifyAccount(u({ uid: 'dono_uid', email: DONO, role: 'platform_admin' }), ctx);
    expect(c.isAdmin).toBe(true);
    expect(c.isOwnerEmail).toBe(true);
    expect(c.unexpectedAdmin).toBe(false);
    expect(c.isSelf).toBe(true);
  });

  it('⭐ admin sem e-mail de dono é INESPERADO', () => {
    const c = classifyAccount(u({ uid: 'z', email: 'z@x.com', role: 'platform_admin' }), ctx);
    expect(c.unexpectedAdmin).toBe(true);
  });

  it('⭐ oculto NÃO tira o poder — é o erro que este módulo existe para mostrar', () => {
    const c = classifyAccount(u({ uid: 'z', role: 'platform_admin', hidden: true }), ctx);
    expect(c.hidden).toBe(true);
    expect(c.powers).toContain('platform_admin');
    expect(c.hiddenButPowerful).toBe(true);
  });

  it('e-mail é comparado sem depender de caixa nem espaço', () => {
    const c = classifyAccount(u({ email: `  ${DONO.toUpperCase()} `, role: 'platform_admin' }), ctx);
    expect(c.isOwnerEmail).toBe(true);
  });

  it('can_create_pools é poder, mesmo sem ser admin', () => {
    const c = classifyAccount(u({ role: 'user', can_create_pools: true }), ctx);
    expect(c.isAdmin).toBe(false);
    expect(c.powers).toEqual(['pool_creator']);
  });

  it('aceita documento sem nada, sem quebrar', () => {
    const c = classifyAccount({}, ctx);
    expect(c.powers).toEqual([]);
    expect(c.role).toBe('user');
  });
});

describe('buildAccessRoster — o cenário real', () => {
  const r = buildAccessRoster(CENARIO_REAL, ctx);

  it('⭐ acha os 4 admins e aponta os 3 inesperados', () => {
    expect(r.counts.admins).toBe(4);
    expect(r.counts.unexpectedAdmins).toBe(3);
    expect(r.unexpectedAdmins.map((c) => c.uid).sort()).toEqual(['sobra1', 'sobra2', 'sobra3']);
  });

  it('⭐ avisa que há contas OCULTAS ainda com poder', () => {
    const a = r.alerts.find((x) => x.code === 'ocultos_com_poder');
    expect(a).toBeTruthy();
    expect(a.level).toBe(ALERT_LEVEL.CRITICAL);
    expect(a.uids).toHaveLength(3);
  });

  it('avisa sobre admin sem e-mail no documento', () => {
    expect(r.alerts.some((x) => x.code === 'admin_sem_email')).toBe(true);
  });

  it('o quadro NÃO é saudável', () => {
    expect(r.healthy).toBe(false);
  });

  it('⭐ os problemáticos vêm primeiro na lista', () => {
    expect(r.admins[0].unexpectedAdmin).toBe(true);
    expect(r.admins[r.admins.length - 1].uid).toBe('dono_uid');
  });
});

describe('buildAccessRoster — depois de arrumado', () => {
  const arrumado = [
    u({ uid: 'dono_uid', email: DONO, role: 'platform_admin', can_create_pools: true }),
    u({ uid: 'sobra1', email: '', role: 'user', hidden: true, role_previous: 'platform_admin' }),
    u({ uid: 'atleta', email: 'atleta@x.com', role: 'user' }),
  ];
  const r = buildAccessRoster(arrumado, ctx);

  it('⭐ só o dono é admin e o quadro fica saudável', () => {
    expect(r.counts.admins).toBe(1);
    expect(r.counts.unexpectedAdmins).toBe(0);
    expect(r.counts.hiddenWithPower).toBe(0);
    expect(r.healthy).toBe(true);
    expect(r.alerts[0].code).toBe('ok');
  });

  it('conta oculta SEM poder não aparece como problema', () => {
    expect(r.hiddenWithPower).toHaveLength(0);
  });
});

describe('buildAccessRoster — casos de borda', () => {
  it('lista vazia avisa que não há administrador', () => {
    const r = buildAccessRoster([], ctx);
    expect(r.alerts[0].code).toBe('sem_admin');
    expect(r.healthy).toBe(false);
  });
  it('entradas nulas são ignoradas', () => {
    const r = buildAccessRoster([null, undefined, u({ email: DONO, role: 'platform_admin' })], ctx);
    expect(r.counts.total).toBe(1);
  });
  it('sem contexto de dono, todo admin vira inesperado (falha para o lado seguro)', () => {
    const r = buildAccessRoster([u({ email: DONO, role: 'platform_admin' })], {});
    expect(r.counts.unexpectedAdmins).toBe(1);
  });
});

describe('canRevokeAccount — as três negativas', () => {
  const dono = { isOwner: true };
  const conta = (over) => classifyAccount(u(over), ctx);

  it('o dono revoga uma conta inesperada com poder', () => {
    const c = conta({ uid: 'sobra1', email: 'sobra@x.com', role: 'platform_admin' });
    expect(canRevokeAccount(c, dono)).toBe(true);
    expect(revokeBlockedReason(c, dono)).toBe('');
  });

  it('⭐ NUNCA em si mesmo — é a proteção que a REGRA não dá', () => {
    // A regra do Firestore permite o dono escrever o próprio documento (é a
    // escotilha de emergência). Quem impede o clique errado é isto aqui.
    const eu = conta({ uid: 'dono_uid', email: DONO, role: 'platform_admin' });
    expect(canRevokeAccount(eu, dono)).toBe(false);
    expect(revokeBlockedReason(eu, dono)).toMatch(/sua conta/i);
  });

  it('⭐ NUNCA numa conta com e-mail de dono — o login devolveria o poder', () => {
    const outroDono = conta({ uid: 'outro', email: DONO, role: 'platform_admin' });
    expect(canRevokeAccount(outroDono, dono)).toBe(false);
    expect(revokeBlockedReason(outroDono, dono)).toMatch(/login/i);
  });

  it('quem não é dono nunca revoga', () => {
    const c = conta({ uid: 'sobra1', email: 'sobra@x.com', role: 'platform_admin' });
    expect(canRevokeAccount(c, { isOwner: false })).toBe(false);
    expect(revokeBlockedReason(c, { isOwner: false })).toMatch(/dono/i);
  });

  it('conta sem poder nenhum não tem o que revogar', () => {
    const c = conta({ uid: 'atleta', email: 'atleta@x.com', role: 'user' });
    expect(canRevokeAccount(c, dono)).toBe(false);
  });
});

describe('buildRevokePayload', () => {
  it('⭐ só REMOVE poder — e guarda o que era', () => {
    const c = classifyAccount(u({ uid: 'z', role: 'platform_admin', can_create_pools: true }), ctx);
    const p = buildRevokePayload(c, 'dono_uid');
    expect(p.role).toBe('user');
    expect(p.can_create_pools).toBe(false);
    expect(p.role_previous).toBe('platform_admin');
    expect(p.role_revoked_by).toBe('dono_uid');
    // Nada além disso: a regra do Firestore recusa qualquer outro campo.
    expect(Object.keys(p).sort()).toEqual(
      ['can_create_pools', 'role', 'role_previous', 'role_revoked_by'],
    );
  });
});
