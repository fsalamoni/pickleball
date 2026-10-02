import { describe, it, expect } from 'vitest';
import {
  deletedAccountsFromAudit, suggestMergeTargets, validateMergeRequest, normalizarNome,
} from './accountMerge.js';

describe('deletedAccountsFromAudit — quem foi excluído', () => {
  it('uma linha por conta, a mais recente primeiro, e marca as já unificadas', () => {
    const r = deletedAccountsFromAudit([
      { action: 'admin_account_deleted', user_id: 'a', user_name: 'Leonardo S.', user_email: 'leo@x.com', created_at_ms: 10 },
      { action: 'admin_account_deleted', user_id: 'b', user_name: 'Teste', created_at_ms: 20 },
      { action: 'admin_account_deleted', user_id: 'a', user_name: 'Leonardo S.', created_at_ms: 5 },
      { action: 'admin_account_history_merged', user_id: 'novo', details: { from_uid: 'b', into_uid: 'novo' } },
      { action: 'outra_coisa', user_id: 'c' },
    ]);
    expect(r.map((x) => x.uid)).toEqual(['b', 'a']);
    expect(r[0].mergedInto).toBe('novo');
    expect(r[1]).toMatchObject({ name: 'Leonardo S.', email: 'leo@x.com', deletedAtMs: 10, mergedInto: null });
  });

  it('entrada vazia não quebra', () => {
    expect(deletedAccountsFromAudit(undefined)).toEqual([]);
  });
});

describe('suggestMergeTargets — quem provavelmente é a mesma pessoa', () => {
  const usuarios = [
    { uid: '1', full_name: 'Leonardo Silva', email: 'leo.silva@gmail.com' },
    { uid: '2', full_name: 'Leonardo Costa', email: 'lcosta@x.com' },
    { uid: '3', full_name: 'Ana Silva', email: 'ana@x.com' },
    { uid: '4', full_name: 'Bruno', email: 'bruno@x.com' },
  ];

  it('nome igual e e-mail parecido vêm primeiro', () => {
    const r = suggestMergeTargets({ name: 'Leonardo Silva', email: 'leosilva22@hotmail.com' }, usuarios);
    expect(r[0].user.uid).toBe('1');
    expect(r[0].motivos).toEqual(['mesmo nome', 'e-mail parecido']);
    expect(r.map((x) => x.user.uid)).toContain('2'); // mesmo primeiro nome
    expect(r.map((x) => x.user.uid)).not.toContain('4');
  });

  it('acento e caixa não atrapalham', () => {
    expect(normalizarNome('  LEÔNARDO   Sílva ')).toBe('leonardo silva');
    const r = suggestMergeTargets({ name: 'leônardo silva' }, usuarios);
    expect(r[0].user.uid).toBe('1');
  });

  it('sem nada parecido, nenhuma sugestão (sugestão errada ensina a ignorar)', () => {
    expect(suggestMergeTargets({ name: 'Zé', email: 'z@x.com' }, usuarios)).toEqual([]);
  });
});

describe('validateMergeRequest', () => {
  it('exige as duas contas, motivo e a palavra', () => {
    expect(validateMergeRequest({}).isValid).toBe(false);
    expect(validateMergeRequest({ fromUid: 'a', intoUid: 'a', reason: 'xxxxx', confirmText: 'UNIFICAR' }).errors.intoUid).toBeTruthy();
    expect(validateMergeRequest({ fromUid: 'a', intoUid: 'b', reason: 'segunda conta', confirmText: 'unificar' }).isValid).toBe(true);
  });
});
