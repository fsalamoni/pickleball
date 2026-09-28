/**
 * Testes de safeLog — o guard de PII nos logs de produção.
 *
 * Esses testes NÃO são burocracia. Cada um blinda um caminho real de
 * vazamento que aconteceu (ou quase aconteceu) em produção. Burlá-los
 * significa reintroduzir a regressão.
 */

import { describe, it, expect } from 'vitest';
import { sanitize, safeLog, safePayload, REDACTION } from './safeLog.js';

describe('safeLog — sanitiza payloads antes do console em produção', () => {
  describe('redação de chaves sensíveis', () => {
    it('substitui e-mail por [REDACTED] em qualquer nível', () => {
      const out = sanitize({
        user: { email: 'a@b.com', displayName: 'Ana' },
        nested: { primaryEmail: 'c@d.com' },
      });
      expect(out.user.email).toBe(REDACTION);
      expect(out.user.displayName).toBe('Ana');
      expect(out.nested.primaryEmail).toBe(REDACTION);
    });

    it('cobre telefone, cpf, rg, birth_date, address, cep', () => {
      const out = sanitize({
        phone: '11999',
        telefone: '11888',
        cpf: '123',
        rg_number: '456',
        birth_date: '1990-01-01',
        data_nascimento: 'x',
        address: { rua: 'A' },
        endereco_completo: 'B',
        zip_code: '01310',
        cep: '01310',
      });
      expect(out.phone).toBe(REDACTION);
      expect(out.telefone).toBe(REDACTION);
      expect(out.cpf).toBe(REDACTION);
      expect(out.rg_number).toBe(REDACTION);
      expect(out.birth_date).toBe(REDACTION);
      expect(out.data_nascimento).toBe(REDACTION);
      expect(out.address).toBe(REDACTION);
      expect(out.endereco_completo).toBe(REDACTION);
      expect(out.zip_code).toBe(REDACTION);
      expect(out.cep).toBe(REDACTION);
    });

    it('cobre credenciais: password, token, secret, apiKey, session, cookie', () => {
      const out = sanitize({
        password: 'p',
        senha: 'p',
        token: 't',
        session_id: 's',
        apiKey: 'k',
        authorization: 'Bearer x',
        cookie: 'c',
      });
      for (const key of Object.keys(out)) {
        expect(out[key]).toBe(REDACTION);
      }
    });

    it('cobre variantes com prefixo e sufixo (user_email, emailVerified, phoneNumber)', () => {
      const out = sanitize({
        user_email: 'a@b',
        emailVerified: true, // key contém 'email' → REDACTED, mesmo se o valor é boolean
        primaryEmailAddress: 'c@d',
        phoneNumber: '99',
      });
      expect(out.user_email).toBe(REDACTION);
      expect(out.emailVerified).toBe(REDACTION);
      expect(out.primaryEmailAddress).toBe(REDACTION);
      expect(out.phoneNumber).toBe(REDACTION);
    });

    it('NÃO confunde `target_user` com `rg` (falso-positivo de substring)', () => {
      // Regressão: substring match ingênuo faz `target_user` casar com `rg`
      // (porque "**rg**et" está dentro). Com word-boundary, fica seguro.
      const out = sanitize({ target_user: { uid: 'u1' } });
      expect(out.target_user).toEqual({ uid: 'u1' });
      // E `rg_number` (chave real de RG) ainda é redacted:
      const out2 = sanitize({ rg_number: '12345' });
      expect(out2.rg_number).toBe(REDACTION);
    });

    it('NÃO redacta campos operacionais (uid, id, status, code, type, created_at)', () => {
      const out = sanitize({
        uid: 'u1', id: 'r1', status: 'pending', code: 'X', type: 'booking',
        created_at: '2026-09-28', updated_at: '2026-09-28', arena_id: 'a1',
        tournament_id: 't1',
      });
      expect(out.uid).toBe('u1');
      expect(out.id).toBe('r1');
      expect(out.status).toBe('pending');
      expect(out.code).toBe('X');
      expect(out.type).toBe('booking');
      expect(out.created_at).toBe('2026-09-28');
      expect(out.arena_id).toBe('a1');
      expect(out.tournament_id).toBe('t1');
    });
  });

  describe('truncamento de strings longas', () => {
    it('preserva string até 500 chars', () => {
      const s = 'a'.repeat(500);
      expect(sanitize(s)).toBe(s);
    });

    it('trunca string > 500 chars com sufixo legível', () => {
      const s = 'a'.repeat(800);
      const out = sanitize(s);
      expect(typeof out).toBe('string');
      expect(out.length).toBeLessThan(s.length);
      expect(out.endsWith('…[truncated 300 chars]')).toBe(true);
    });

    it('trunca recursivamente dentro de objetos e arrays', () => {
      const out = sanitize({
        notes: 'x'.repeat(600),
        list: ['y'.repeat(600), { body: 'z'.repeat(600) }],
      });
      expect(out.notes.endsWith('…[truncated 100 chars]')).toBe(true);
      expect(out.list[0].endsWith('…[truncated 100 chars]')).toBe(true);
      expect(out.list[1].body.endsWith('…[truncated 100 chars]')).toBe(true);
    });
  });

  describe('tipos especiais', () => {
    it('Error vira { message, code?, name? } SEM stack', () => {
      const e = new Error('boom');
      e.code = 'PERMISSION_DENIED';
      e.name = 'FirebaseError';
      const out = sanitize(e);
      expect(out.message).toBe('boom');
      expect(out.code).toBe('PERMISSION_DENIED');
      expect(out.name).toBe('FirebaseError');
      expect(out).not.toHaveProperty('stack');
    });

    it('Date vira ISO string', () => {
      const d = new Date('2026-09-28T12:00:00.000Z');
      expect(sanitize(d)).toBe('2026-09-28T12:00:00.000Z');
    });

    it('RegExp vira toString', () => {
      expect(sanitize(/foo/gi)).toBe('/foo/gi');
    });

    it('null e undefined passam intactos', () => {
      expect(sanitize(null)).toBeNull();
      expect(sanitize(undefined)).toBeUndefined();
    });

    it('primitivos passam intactos (com truncamento de string)', () => {
      expect(sanitize(42)).toBe(42);
      expect(sanitize(true)).toBe(true);
      expect(sanitize(false)).toBe(false);
      expect(sanitize('curto')).toBe('curto');
    });

    it('arrays são percorridos recursivamente', () => {
      const out = sanitize([{ email: 'a@b' }, { cpf: '1' }, 'ok']);
      expect(out[0].email).toBe(REDACTION);
      expect(out[1].cpf).toBe(REDACTION);
      expect(out[2]).toBe('ok');
    });

    it('corta em profundidade 4 para não estourar', () => {
      // payload com 6 níveis
      const deep = { a: { b: { c: { d: { e: { email: 'vaza' } } } } } };
      const out = sanitize(deep);
      // depth 5 = '[depth>max]', então retorna a STRING, não tenta redactar
      expect(out.a.b.c.d.e).toBe('[depth>max]');
    });

    it('detecta ciclo (objeto referenciando a si mesmo)', () => {
      const a = { uid: 'u1', email: 'a@b' };
      a.self = a; // ciclo
      const out = sanitize(a);
      expect(out.uid).toBe('u1');
      expect(out.email).toBe(REDACTION);
      expect(out.self).toBe('[circular]');
    });
  });

  describe('safeLog e safePayload — atalhos de uso', () => {
    it('safeLog devolve tupla [scope, payload]', () => {
      const [scope, payload] = safeLog('booking', { user: { email: 'a@b' } });
      expect(scope).toBe('booking');
      expect(payload.user.email).toBe(REDACTION);
    });

    it('safeLog aceita scope undefined e cai para "log"', () => {
      const [scope, payload] = safeLog(undefined, { id: 'r1' });
      expect(scope).toBe('log');
      expect(payload.id).toBe('r1');
    });

    it('safeLog aceita payload undefined e devolve [scope, undefined]', () => {
      const [scope, payload] = safeLog('auth');
      expect(scope).toBe('auth');
      expect(payload).toBeUndefined();
    });

    it('safePayload só devolve o payload sanitizado (sem scope)', () => {
      const out = safePayload({ email: 'a@b' });
      expect(out.email).toBe(REDACTION);
    });

    it('não muta o input original', () => {
      const input = { user: { email: 'a@b' } };
      const copy = JSON.parse(JSON.stringify(input));
      sanitize(input);
      expect(input).toEqual(copy);
    });
  });

  describe('regressão: caminhos que JÁ vazaram PII em outros apps', () => {
    it('objeto Firestore genérico vindo de doc.data()', () => {
      // O caso real: logger.error('algo', doc.data()) em vários services.
      const docData = {
        uid: 'u1',
        email: 'vaza@empresa.com',
        phone: '11999',
        display_name: 'Fulano',
        created_at: { seconds: 1234, nanoseconds: 0 },
      };
      const out = sanitize(docData);
      expect(out.email).toBe(REDACTION);
      expect(out.phone).toBe(REDACTION);
      // display_name passa (não está na lista)
      expect(out.display_name).toBe('Fulano');
      // created_at como Timestamp-like vira objeto — não vaza
      expect(out.created_at).toEqual({ seconds: 1234, nanoseconds: 0 });
    });

    it('payload de audit log com user, actor e dados sensíveis misturados', () => {
      const auditPayload = {
        actor_id: 'u_admin',
        actor_email: 'admin@picklerush.web.app',
        action: 'tournament_archived',
        target_user: {
          uid: 'u_target',
          email: 'target@example.com',
          cpf: '999',
        },
        metadata: { tournament_id: 't1' },
      };
      const out = sanitize(auditPayload);
      expect(out.actor_email).toBe(REDACTION);
      expect(out.target_user.email).toBe(REDACTION);
      expect(out.target_user.cpf).toBe(REDACTION);
      expect(out.actor_id).toBe('u_admin'); // uid não vaza
      expect(out.action).toBe('tournament_archived');
      expect(out.metadata.tournament_id).toBe('t1');
    });
  });
});
