import { describe, it, expect } from 'vitest';
import {
  deletionBlockedReason, canDeleteAccount, validateDeletionRequest,
  testAccountSignals, looksLikeTestAccount,
  DELETION_CONFIRM_WORD, DELETION_BATCH_MAX,
} from './accountDeletion.js';

const DONOS = ['dono@plataforma.com'];

describe('deletionBlockedReason — quem NUNCA pode ser escolhido', () => {
  it('uma conta comum pode', () => {
    expect(canDeleteAccount({ uid: 'u1', email: 'a@b.com' }, { actorUid: 'eu', ownerEmails: DONOS })).toBe(true);
  });

  it('⭐ a própria conta não pode', () => {
    const r = deletionBlockedReason({ uid: 'eu' }, { actorUid: 'eu' });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/própria conta/);
  });

  it('⭐ conta com poder de admin não pode — tirar poder tem caminho próprio', () => {
    const r = deletionBlockedReason({ uid: 'u2', role: 'platform_admin' }, { actorUid: 'eu' });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/Acessos/);
  });

  it('⭐ e-mail de dono não pode, mesmo sem o papel no documento', () => {
    // O papel pode ter sido corrompido por um bug; o e-mail é o que manda.
    const r = deletionBlockedReason({ uid: 'u3', email: 'DONO@plataforma.com' }, { ownerEmails: DONOS });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/dono/);
  });

  it('cadastro sem identificador não pode', () => {
    expect(canDeleteAccount({}, {})).toBe(false);
  });

  it('aceita `id` quando o documento vem sem `uid`', () => {
    expect(canDeleteAccount({ id: 'u9' }, { actorUid: 'eu' })).toBe(true);
  });
});

describe('validateDeletionRequest', () => {
  const ok = { uids: ['u1'], reason: 'contas de teste', confirmText: DELETION_CONFIRM_WORD };

  it('pedido completo passa', () => {
    expect(validateDeletionRequest(ok).isValid).toBe(true);
  });

  it('exige ao menos um cadastro', () => {
    expect(validateDeletionRequest({ ...ok, uids: [] }).errors.uids).toBeTruthy();
  });

  it('⭐ respeita o limite por execução', () => {
    const muitos = Array.from({ length: DELETION_BATCH_MAX + 1 }, (_, i) => `u${i}`);
    expect(validateDeletionRequest({ ...ok, uids: muitos }).errors.uids).toMatch(/No máximo/);
    const noLimite = muitos.slice(0, DELETION_BATCH_MAX);
    expect(validateDeletionRequest({ ...ok, uids: noLimite }).isValid).toBe(true);
  });

  it('uid repetido conta uma vez só', () => {
    const repetidos = Array.from({ length: DELETION_BATCH_MAX + 5 }, () => 'u1');
    expect(validateDeletionRequest({ ...ok, uids: repetidos }).isValid).toBe(true);
  });

  it('exige motivo', () => {
    expect(validateDeletionRequest({ ...ok, reason: 'x' }).errors.reason).toBeTruthy();
  });

  it('⭐ exige a palavra de confirmação — sem diferenciar maiúsculas', () => {
    expect(validateDeletionRequest({ ...ok, confirmText: 'excluir' }).isValid).toBe(true);
    expect(validateDeletionRequest({ ...ok, confirmText: ' Excluir ' }).isValid).toBe(true);
    expect(validateDeletionRequest({ ...ok, confirmText: 'sim' }).errors.confirmText).toBeTruthy();
    expect(validateDeletionRequest({ ...ok, confirmText: '' }).errors.confirmText).toBeTruthy();
  });
});

describe('testAccountSignals — o filtro SUGERE, o admin decide', () => {
  it('conta real não levanta suspeita', () => {
    expect(testAccountSignals({ full_name: 'Ana Souza', email: 'ana.souza@gmail.com' })).toEqual([]);
  });

  it('conta oculta na moderação é sugerida', () => {
    expect(testAccountSignals({ full_name: 'Ana', email: 'a@gmail.com', hidden: true }))
      .toContain('Oculto na moderação de atletas');
  });

  it('domínio de exemplo é sugerido, e diz qual', () => {
    const m = testAccountSignals({ full_name: 'Ana', email: 'ana@example.com' });
    expect(m.join(' ')).toContain('@example.com');
  });

  it('e-mail e nome com cara de teste', () => {
    expect(looksLikeTestAccount({ full_name: 'Usuário Teste 3', email: 'x@gmail.com' })).toBe(true);
    expect(looksLikeTestAccount({ full_name: 'Ana', email: 'mock12@gmail.com' })).toBe(true);
    expect(looksLikeTestAccount({ full_name: 'Atleta Demo', email: 'a@gmail.com' })).toBe(true);
  });

  it('⭐ olha palavras INTEIRAS — "Ernesto" e "Demóstenes" são nomes reais', () => {
    expect(looksLikeTestAccount({ full_name: 'Ernesto Lima', email: 'ernesto@gmail.com' })).toBe(false);
    expect(looksLikeTestAccount({ full_name: 'Demóstenes Rocha', email: 'dr@gmail.com' })).toBe(false);
    expect(looksLikeTestAccount({ full_name: 'Contestado Silva', email: 'cs@gmail.com' })).toBe(false);
  });

  it('ignora acento: "Exemplo" e "Éxemplo" são a mesma suspeita', () => {
    expect(looksLikeTestAccount({ full_name: 'Joao Exemplo', email: 'j@gmail.com' })).toBe(true);
  });

  it('cadastro sem nome e sem e-mail é suspeito', () => {
    expect(testAccountSignals({ uid: 'u1' })).toContain('Sem nome e sem e-mail');
  });
});
