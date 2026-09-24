/**
 * Exclusão de cadastro no servidor — as partes PURAS.
 *
 * O que estes testes protegem, em ordem de importância:
 *
 *  1. as três portas fechadas (a própria conta, admin, e-mail de dono) valem
 *     no SERVIDOR, não só na tela;
 *  2. a lista de donos daqui é a MESMA do cliente — o pacote de Functions é
 *     publicado isolado, então é uma cópia, e cópia diverge;
 *  3. a pseudonimização troca só o que é da pessoa, e não inventa campo;
 *  4. o pedido do navegador é validado aqui de novo (limite, motivo, EXCLUIR).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  OWNER_EMAILS, DELETION_BATCH_MAX, REMOVED_ATHLETE,
  DELETE_BY_ID, DELETE_BY_QUERY,
  isOwnerEmail, targetBlockedReason, validateRequest,
  patchFlatFields, patchArrayItems, patchParallelNames, buildReport,
} = require('../functions/accountDeletion.js');

describe('a lista de donos é a mesma dos dois lados', () => {
  it('⭐ cada e-mail de dono do cliente está no servidor, e vice-versa', () => {
    const fonte = readFileSync('src/core/config/owners.js', 'utf8');
    const bloco = fonte.match(/PLATFORM_OWNER_EMAILS\s*=\s*Object\.freeze\(\[([\s\S]*?)\]\)/);
    expect(bloco, 'não achei PLATFORM_OWNER_EMAILS em owners.js').toBeTruthy();
    const doCliente = [...bloco[1].matchAll(/'([^']+)'/g)].map((m) => m[1].toLowerCase()).sort();
    expect([...OWNER_EMAILS].map((e) => e.toLowerCase()).sort()).toEqual(doCliente);
  });

  it('reconhece o dono sem diferenciar maiúsculas', () => {
    expect(isOwnerEmail(OWNER_EMAILS[0].toUpperCase())).toBe(true);
    expect(isOwnerEmail('alguem@gmail.com')).toBe(false);
    expect(isOwnerEmail('')).toBe(false);
  });
});

describe('targetBlockedReason — conferido no servidor', () => {
  it('conta comum passa', () => {
    expect(targetBlockedReason({ uid: 'u1', email: 'a@b.com' }, { actorUid: 'eu' })).toBe('');
  });
  it('⭐ a própria conta não', () => {
    expect(targetBlockedReason({ uid: 'eu' }, { actorUid: 'eu' })).toMatch(/própria/);
  });
  it('⭐ admin não', () => {
    expect(targetBlockedReason({ uid: 'u2', role: 'platform_admin' }, {})).toMatch(/Acessos/);
  });
  it('⭐ e-mail de dono não, mesmo sem o papel', () => {
    expect(targetBlockedReason({ uid: 'u3', email: OWNER_EMAILS[0] }, {})).toMatch(/dono/);
  });
});

describe('validateRequest — o pedido do navegador não é confiável', () => {
  it('prévia não exige motivo nem confirmação', () => {
    const r = validateRequest({ uids: ['a'], mode: 'preview' });
    expect(r.error).toBeUndefined();
    expect(r.mode).toBe('preview');
  });
  it('modo desconhecido vira prévia — nunca execução por acidente', () => {
    expect(validateRequest({ uids: ['a'], mode: 'apagar-tudo' }).mode).toBe('preview');
    expect(validateRequest({ uids: ['a'] }).mode).toBe('preview');
  });
  it('⭐ execução exige motivo e EXCLUIR', () => {
    expect(validateRequest({ uids: ['a'], mode: 'execute', reason: 'x', confirm: 'EXCLUIR' }).error).toMatch(/motivo/);
    expect(validateRequest({ uids: ['a'], mode: 'execute', reason: 'contas de teste', confirm: 'sim' }).error).toMatch(/EXCLUIR/);
    expect(validateRequest({ uids: ['a'], mode: 'execute', reason: 'contas de teste', confirm: 'excluir' }).error).toBeUndefined();
  });
  it('⭐ limite por execução, contando uid repetido uma vez', () => {
    const muitos = Array.from({ length: DELETION_BATCH_MAX + 1 }, (_, i) => `u${i}`);
    expect(validateRequest({ uids: muitos }).error).toMatch(/No máximo/);
    expect(validateRequest({ uids: Array(50).fill('u1') }).uids).toEqual(['u1']);
  });
  it('lista vazia ou lixo é recusada', () => {
    expect(validateRequest({ uids: [] }).error).toBeTruthy();
    expect(validateRequest({ uids: ['', null, '  '] }).error).toBeTruthy();
    expect(validateRequest({}).error).toBeTruthy();
  });
});

describe('patchFlatFields — inscrição de dupla', () => {
  const specs = [
    { idField: 'player_a_user_id', name: ['player_a_name'], clear: ['player_a_photo'] },
    { idField: 'player_b_user_id', name: ['player_b_name'], clear: ['player_b_photo'] },
  ];

  it('troca só o lado que é da pessoa', () => {
    const doc = {
      player_a_user_id: 'x', player_a_name: 'Ana', player_a_photo: 'http://f',
      player_b_user_id: 'y', player_b_name: 'Bia', player_b_photo: 'http://g',
    };
    expect(patchFlatFields(doc, 'x', specs)).toEqual({ player_a_name: REMOVED_ATHLETE, player_a_photo: null });
  });

  it('não inventa campo que o documento não tem', () => {
    const doc = { player_a_user_id: 'x', player_a_name: 'Ana' };
    expect(patchFlatFields(doc, 'x', specs)).toEqual({ player_a_name: REMOVED_ATHLETE });
  });

  it('nada a fazer devolve null (e o lote não grava à toa)', () => {
    expect(patchFlatFields({ player_a_user_id: 'y', player_a_name: 'Bia' }, 'x', specs)).toBeNull();
    expect(patchFlatFields({ player_a_user_id: 'x', player_a_name: REMOVED_ATHLETE }, 'x', specs)).toBeNull();
  });
});

describe('patchArrayItems — vetores de objetos', () => {
  it('troca o item da pessoa e preserva os outros', () => {
    const arr = [{ uid: 'x', name: 'Ana', photo: 'p' }, { uid: 'y', name: 'Bia', photo: 'q' }];
    const novo = patchArrayItems(arr, 'x', { name: ['name'], clear: ['photo'] });
    expect(novo).toEqual([{ uid: 'x', name: REMOVED_ATHLETE, photo: null }, { uid: 'y', name: 'Bia', photo: 'q' }]);
    expect(arr[0].name).toBe('Ana'); // não muta a entrada
  });
  it('reconhece a pessoa por qualquer das chaves de id', () => {
    const novo = patchArrayItems([{ user_id: 'x', name: 'Ana' }], 'x', { name: ['name'] });
    expect(novo[0].name).toBe(REMOVED_ATHLETE);
  });
  it('sem mudança devolve null', () => {
    expect(patchArrayItems([{ uid: 'y', name: 'Bia' }], 'x', { name: ['name'] })).toBeNull();
    expect(patchArrayItems(null, 'x', { name: ['name'] })).toBeNull();
  });
});

describe('patchParallelNames — nomes alinhados a ids', () => {
  it('troca a posição certa', () => {
    expect(patchParallelNames(['a', 'x', 'b'], ['A', 'X', 'B'], 'x')).toEqual(['A', REMOVED_ATHLETE, 'B']);
  });
  it('sem a pessoa, null', () => {
    expect(patchParallelNames(['a'], ['A'], 'x')).toBeNull();
  });
});

describe('buildReport', () => {
  const base = { uid: 'u1', user: { full_name: 'Teste Um', email: 't@example.com' }, actorUid: 'eu' };

  it('sem impedimento, pode excluir e soma os totais', () => {
    const r = buildReport({
      ...base,
      deletes: [{ label: 'Notificações', count: 3 }, { label: 'Vazio', count: 0 }],
      pseudonyms: [{ label: 'Inscrições', count: 2 }],
      retained: [{ label: 'Reservas', count: 1 }],
    });
    expect(r.canDelete).toBe(true);
    expect(r.deletes.map((d) => d.label)).toEqual(['Notificações']); // zeros somem
    expect(r.totals).toEqual({ apagar: 4, pseudonimizar: 2, reter: 1 });
  });

  it('⭐ impedimento vindo das portas fechadas entra no relatório', () => {
    const r = buildReport({ ...base, user: { ...base.user, role: 'platform_admin' } });
    expect(r.canDelete).toBe(false);
    expect(r.blockers[0].label).toMatch(/admin/);
  });

  it('⭐ impedimento de negócio (dono de arena) bloqueia', () => {
    const r = buildReport({ ...base, blockers: [{ label: 'Dono da arena Central' }] });
    expect(r.canDelete).toBe(false);
  });

  it('cadastro já sem documento ainda gera relatório (para terminar uma limpeza parcial)', () => {
    const r = buildReport({ uid: 'u9', user: null, deletes: [{ label: 'Notificações', count: 1 }] });
    expect(r.exists).toBe(false);
    expect(r.canDelete).toBe(true);
    expect(r.name).toBe('(sem nome)');
  });

  it('avisa quando uma consulta bateu no limite', () => {
    const r = buildReport({ ...base, deletes: [{ label: 'Notificações', count: 400, truncated: true }] });
    expect(r.truncated).toBe(true);
  });
});

describe('as especificações', () => {
  it('toda especificação tem rótulo em português e coleção', () => {
    [...DELETE_BY_ID, ...DELETE_BY_QUERY].forEach((s) => {
      expect(s.col).toBeTruthy();
      expect(s.label).toBeTruthy();
    });
  });

  it('⭐ auditoria e consentimentos NUNCA estão na lista de apagar', () => {
    const cols = [...DELETE_BY_ID, ...DELETE_BY_QUERY].map((s) => s.col);
    expect(cols).not.toContain('audit_logs');
    expect(cols).not.toContain('legal_consents');
    // e o que é financeiro fica (retido com o nome trocado), não some
    ['arena_bookings', 'arena_sales', 'arena_payments', 'arena_wallets', 'arena_subscriptions']
      .forEach((c) => expect(cols).not.toContain(c));
  });

  it('`users` não está nas listas: ele é apagado POR ÚLTIMO, à parte', () => {
    const cols = [...DELETE_BY_ID, ...DELETE_BY_QUERY].map((s) => s.col);
    expect(cols).not.toContain('users');
  });
});

describe('evaluateBlockers — excluir quebraria o serviço de outra pessoa?', () => {
  const { evaluateBlockers } = require('../functions/accountDeletion.js');
  const HOJE = '2026-09-24';

  it('conta sem vínculo nenhum não tem impedimento', () => {
    expect(evaluateBlockers({}, 'x', HOJE)).toEqual([]);
  });

  it('⭐ dona de arena e de rede bloqueia', () => {
    const r = evaluateBlockers({ arenas: [{ id: 'a1', name: 'Central' }], networks: [{ id: 'n1', name: 'Rede' }] }, 'x', HOJE);
    expect(r.map((b) => b.label).join(' | ')).toMatch(/arena "Central".*rede de arenas "Rede"/);
  });

  it('⭐ única admin de clube bloqueia; com outro admin, não', () => {
    expect(evaluateBlockers({ clubAdminships: [{ club_id: 'c1', club_name: 'Clube', otherAdmins: 0 }] }, 'x', HOJE)).toHaveLength(1);
    expect(evaluateBlockers({ clubAdminships: [{ club_id: 'c1', otherAdmins: 1 }] }, 'x', HOJE)).toEqual([]);
  });

  it('⭐ torneio vivo bloqueia; encerrado, cancelado ou RASCUNHO não', () => {
    const t = (status) => ({ id: 't', name: 'Aberto', status });
    expect(evaluateBlockers({ tournaments: [t('registrations_open')] }, 'x', HOJE)).toHaveLength(1);
    expect(evaluateBlockers({ tournaments: [t('in_progress')] }, 'x', HOJE)).toHaveLength(1);
    expect(evaluateBlockers({ tournaments: [t('finished'), t('cancelled'), t('draft')] }, 'x', HOJE)).toEqual([]);
  });

  it('⭐ dia de jogo só bloqueia se ativo, futuro e com outras pessoas', () => {
    const g = (over) => ({ id: 'g', status: 'active', date: '2026-10-01', member_uids: ['x', 'y'], ...over });
    expect(evaluateBlockers({ gameDays: [g()] }, 'x', HOJE)).toHaveLength(1);
    expect(evaluateBlockers({ gameDays: [g({ date: '2026-09-01' })] }, 'x', HOJE)).toEqual([]); // passou
    expect(evaluateBlockers({ gameDays: [g({ status: 'archived' })] }, 'x', HOJE)).toEqual([]);
    expect(evaluateBlockers({ gameDays: [g({ member_uids: ['x'] })] }, 'x', HOJE)).toEqual([]); // sozinho
    expect(evaluateBlockers({ gameDays: [g({ date: null })] }, 'x', HOJE)).toEqual([]); // sem data
    expect(evaluateBlockers({ gameDays: [g({ date: HOJE })] }, 'x', HOJE)).toHaveLength(1); // hoje conta
  });

  it('⭐ saldo positivo em carteira bloqueia, e diz quanto', () => {
    const r = evaluateBlockers({ wallets: [{ balance: 12.5 }, { balance: 0 }] }, 'x', HOJE);
    expect(r).toHaveLength(1);
    expect(r[0].label).toContain('R$ 12,50');
  });

  it('todo impedimento diz o que fazer', () => {
    const r = evaluateBlockers({
      arenas: [{ id: 'a' }], networks: [{ id: 'n' }],
      clubAdminships: [{ club_id: 'c', otherAdmins: 0 }],
      tournaments: [{ id: 't', status: 'in_progress' }],
      gameDays: [{ id: 'g', status: 'active', date: '2027-01-01', member_uids: ['x', 'y'] }],
      wallets: [{ balance: 1 }],
    }, 'x', HOJE);
    expect(r).toHaveLength(6);
    r.forEach((b) => expect(b.detail).toBeTruthy());
  });
});
