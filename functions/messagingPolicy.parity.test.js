/**
 * PARIDADE cliente × servidor da regra dos avisos por e-mail e celular.
 *
 * O servidor decide o envio (`functions/messagingPolicy.js`); as
 * Configurações da pessoa e o painel do admin mostram o que vale pela cópia
 * em `src/modules/messaging/domain/policy.js`. Duas cópias divergem calado: a
 * tela diria "vai por e-mail na hora" e o servidor mandaria no resumo. Aqui o
 * CÓDIGO das duas tem de ser o mesmo (menos import/export) e o resultado
 * também, sobre os mesmos casos.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as cliente from '@/modules/messaging/domain/policy.js';

const require = createRequire(import.meta.url);
const servidor = require('./messagingPolicy.js');

const corpo = (arquivo, inicio) => {
  const s = readFileSync(arquivo, 'utf8');
  return s.slice(s.indexOf(inicio), s.lastIndexOf('export {') >= 0 ? s.lastIndexOf('export {') : s.lastIndexOf('module.exports'))
    .split('\n').slice(1).join('\n');
};

describe('paridade da regra de e-mail e celular', () => {
  it('⭐ o código é o mesmo nas duas cópias', () => {
    const s = corpo('functions/messagingPolicy.js', "const { noticeArea } = require('./notificationPrefs');");
    const c = corpo('src/modules/messaging/domain/policy.js', "import { noticeArea } from '@/modules/notifications/domain/noticeFeed';");
    expect(c).toBe(s);
    expect(Object.keys(cliente).sort()).toEqual(Object.keys(servidor).sort());
  });

  it('o mesmo resultado sobre os mesmos casos (inclusive a área do aviso)', () => {
    const settings = [{}, { email: { enabled: true, domain: 'a.com.br' }, whatsapp: { enabled: true }, matrix: { jogos: { email: { mode: 'always' } } } }];
    const prefs = [undefined, {}, { email: { on: false }, marketing: true, quiet: { push: true } }, { whatsapp: { on: true, areas: { jogos: true } } }];
    const avisos = [
      { origin: 'server', link: '/minhas-reservas' }, { sent_by: 'x', type: 'chat_message' }, { type: 'generic' },
      { origin: 'server', link: '/campanhas/1' }, { origin: 'server', type: 'market', essential: true },
      { sent_by: 'adm', broadcast: { kind: 'novidade', channels: ['email', 'sms'] } },
    ];
    const NOITE = Date.UTC(2026, 9, 17, 2, 0);
    settings.forEach((rs) => prefs.forEach((rp) => avisos.forEach((n) => ['email', 'whatsapp', 'sms'].forEach((ch) => {
      const ctx = (P) => ({
        settings: P.normalizeSettings(rs), prefs: P.normalizeUserChannels(rp),
        user: { email: 'a@b.com', emailVerified: true, phoneVerified: true }, now: NOITE, flagOn: true,
      });
      const a = cliente.classifyNotice(n, { senderIsAdmin: true });
      expect(a).toEqual(servidor.classifyNotice(n, { senderIsAdmin: true }));
      expect(cliente.decideChannel(ch, a, ctx(cliente))).toEqual(servidor.decideChannel(ch, a, ctx(servidor)));
      expect(cliente.pushAllowed(a, ctx(cliente))).toEqual(servidor.pushAllowed(a, ctx(servidor)));
    }))));
  });
});
