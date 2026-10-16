/**
 * A regra de QUEM recebe O QUÊ e POR ONDE (e-mail, WhatsApp, SMS, push).
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const P = require('./messagingPolicy.js');

const settings = (patch = {}) => P.normalizeSettings({
  email: { enabled: true, domain: 'picklerush.com.br' },
  whatsapp: { enabled: true },
  sms: { enabled: true },
  ...patch,
});
const prefs = (raw) => P.normalizeUserChannels(raw);
const user = { email: 'ana@x.com', emailVerified: true, phoneVerified: true };
// 12h em Brasília (15h UTC) — fora do horário silencioso.
const MEIO_DIA = Date.UTC(2026, 9, 16, 15, 0);
// 23h em Brasília.
const NOITE = Date.UTC(2026, 9, 17, 2, 0);
const aviso = (n, opts) => P.classifyNotice({ user_id: 'u1', origin: 'server', ...n }, opts);
const decide = (ch, n, ctx = {}) => P.decideChannel(ch, n, {
  settings: settings(), prefs: prefs(), user, now: MEIO_DIA, flagOn: true, ...ctx,
});

describe('normalizeSettings', () => {
  it('vazio vale o padrão, tudo desligado', () => {
    const s = P.normalizeSettings({});
    expect(s.email.enabled).toBe(false);
    expect(s.whatsapp.enabled).toBe(false);
    expect(s.email.domain).toBe('');
    expect(s.matrix.jogos.email).toEqual({ mode: 'optional', default: 'imediato' });
    expect(s.matrix.promocoes.email.default).toBe('nao');
  });
  it('domínio vira minúsculo e sem esquema; lixo vira vazio', () => {
    expect(P.normalizeDomain('https://PickleRush.com.br/')).toBe('picklerush.com.br');
    expect(P.normalizeDomain('não é domínio')).toBe('');
  });
  it('⭐ promoções nunca ficam "sempre": dependem do sim da pessoa', () => {
    const s = P.normalizeSettings({ matrix: { promocoes: { email: { mode: 'always', default: 'imediato' } } } });
    expect(s.matrix.promocoes.email.mode).toBe('optional');
  });
  it('limites têm piso e teto', () => {
    const s = P.normalizeSettings({ limits: { email_per_user_day: -5, monthly_budget_brl: 'abc' } });
    expect(s.limits.email_per_user_day).toBe(1);
    expect(s.limits.monthly_budget_brl).toBe(100);
  });
});

describe('classifyNotice', () => {
  it('servidor, pessoa (sent_by) e antigo', () => {
    expect(P.classifyNotice({ origin: 'server', type: 'market' }).trust).toBe('server');
    expect(P.classifyNotice({ sent_by: 'abc', type: 'chat_message' })).toMatchObject({ trust: 'user', area: 'social', sender: 'abc' });
    expect(P.classifyNotice({ type: 'generic' }).trust).toBe('legacy');
  });
  it('⭐ "essencial" só vale vindo do servidor', () => {
    expect(P.classifyNotice({ origin: 'server', essential: true }).essential).toBe(true);
    expect(P.classifyNotice({ sent_by: 'x', essential: true }).essential).toBe(false);
  });
  it('⭐ canais do aviso em massa só valem do admin; novidade vira promoção', () => {
    const n = { sent_by: 'adm', broadcast: { kind: 'novidade', channels: ['email', 'fax'] }, link: '/torneios' };
    expect(P.classifyNotice(n).broadcast).toBe(null);
    const c = P.classifyNotice(n, { senderIsAdmin: true });
    expect(c.broadcast).toEqual({ kind: 'novidade', channels: ['email'] });
    expect(c.area).toBe('promocoes');
  });
});

describe('decideChannel', () => {
  it('flag desligada, canal desligado, sem domínio', () => {
    expect(P.decideChannel('email', aviso({}), { settings: settings(), prefs: prefs(), user, flagOn: false }).reason).toBe('flag_off');
    expect(decide('email', aviso({}), { settings: settings({ email: { enabled: false, domain: 'a.com' } }) }).reason).toBe('channel_off');
    expect(decide('email', aviso({}), { settings: settings({ email: { enabled: true } }) }).reason).toBe('no_domain');
    expect(decide('email', aviso({}), { ready: { email: false } }).reason).toBe('not_ready');
  });
  it('⭐ aviso antigo (sem origem nem remetente) não sai da plataforma', () => {
    expect(decide('email', P.classifyNotice({ type: 'generic' })).reason).toBe('legacy_notice');
  });
  it('⭐ e-mail só para endereço confirmado; celular só para número confirmado', () => {
    expect(decide('email', aviso({}), { user: { email: 'a@b.com', emailVerified: false } }).reason).toBe('email_unverified');
    expect(decide('whatsapp', aviso({}), { user: { ...user, phoneVerified: false } }).reason).toBe('phone_unverified');
  });
  it('padrão: aviso de reserva vai por e-mail na hora; WhatsApp só com o sim da pessoa', () => {
    const n = aviso({ link: '/minhas-reservas' });
    expect(decide('email', n)).toMatchObject({ action: 'send', reason: 'chosen' });
    expect(decide('whatsapp', n).reason).toBe('no_opt_in');
    expect(decide('whatsapp', n, { prefs: prefs({ whatsapp: { on: true } }) }).action).toBe('send');
  });
  it('a pessoa desliga uma área ou o canal todo', () => {
    const n = aviso({ link: '/torneios' });
    expect(decide('email', n, { prefs: prefs({ email: { on: true, areas: { torneios: 'nao' } } }) }).reason).toBe('area_off_user');
    expect(decide('email', n, { prefs: prefs({ email: { on: false } }) }).reason).toBe('channel_off_user');
  });
  it('resumo diário e semanal', () => {
    const n = aviso({ type: 'event_invite' });
    expect(decide('email', n).action).toBe('digest_daily');
    expect(decide('email', n, { prefs: prefs({ email: { areas: { clubes: 'semanal' } } }) }).action).toBe('digest_weekly');
  });
  it('⭐ mensagem de chat espera para ver se a pessoa lê no app', () => {
    const d = decide('email', P.classifyNotice({ sent_by: 'b', type: 'chat_message' }));
    expect(d.action).toBe('delay');
    expect(d.reason).toBe('wait_unread');
    expect(d.sendAfter).toBe(MEIO_DIA + 15 * 60000);
  });
  it('⭐ admin "sempre" passa por cima da escolha; "desligado" vence tudo', () => {
    const s = settings({ matrix: { conta: { email: { mode: 'always', default: 'imediato' } }, jogos: { email: { mode: 'off' } } } });
    const p = prefs({ email: { on: false } });
    expect(decide('email', aviso({ link: '/configuracoes' }), { settings: s, prefs: p })).toMatchObject({ action: 'send', reason: 'admin_always' });
    expect(decide('email', aviso({ link: '/dia-de-jogo' }), { settings: s }).reason).toBe('area_off_admin');
  });
  it('⭐ essencial chega mesmo com tudo desligado (mas só a e-mail confirmado)', () => {
    const n = aviso({ essential: true, link: '/configuracoes' });
    expect(decide('email', n, { prefs: prefs({ email: { on: false } }) })).toMatchObject({ action: 'send', reason: 'essential' });
  });
  it('⭐ promoção só com o consentimento de novidades', () => {
    const n = aviso({ link: '/campanhas/1' });
    const p = prefs({ email: { areas: { promocoes: 'imediato' } } });
    expect(decide('email', n, { prefs: p }).reason).toBe('no_marketing_consent');
    expect(decide('email', n, { prefs: prefs({ marketing: true, email: { areas: { promocoes: 'imediato' } } }) }).action).toBe('send');
  });
  it('remetente bloqueado pela pessoa', () => {
    const n = P.classifyNotice({ sent_by: 'chato', link: '/torneios' });
    expect(decide('email', n, { prefs: prefs({ blocked_senders: ['chato'] }) }).reason).toBe('sender_blocked');
  });
  it('⭐ WhatsApp à noite espera o fim do horário silencioso; e-mail não', () => {
    const n = aviso({ link: '/minhas-reservas' });
    const p = prefs({ whatsapp: { on: true } });
    const d = decide('whatsapp', n, { prefs: p, now: NOITE });
    expect(d).toMatchObject({ action: 'delay', reason: 'quiet_hours' });
    // 23h → 7h: oito horas.
    expect(d.sendAfter - NOITE).toBe(8 * 3600000);
    expect(decide('email', n, { now: NOITE }).action).toBe('send');
  });
  it('aviso em massa: só os canais escolhidos', () => {
    const n = P.classifyNotice({ sent_by: 'adm', broadcast: { kind: 'servico', channels: ['email'] }, link: '/torneios' }, { senderIsAdmin: true });
    expect(decide('email', n).action).toBe('send');
    expect(decide('whatsapp', n, { prefs: prefs({ whatsapp: { on: true } }) }).reason).toBe('not_in_broadcast');
  });
});

describe('pushAllowed', () => {
  it('com a flag desligada o push segue como sempre', () => {
    expect(P.pushAllowed({ area: 'jogos' }, { settings: settings(), prefs: prefs({ push: { on: false } }), flagOn: false }).allowed).toBe(true);
  });
  it('área desligada e horário silencioso estendido ao push', () => {
    const s = settings();
    expect(P.pushAllowed({ area: 'jogos' }, { settings: s, prefs: prefs({ push: { areas: { jogos: false } } }), flagOn: true }).allowed).toBe(false);
    expect(P.pushAllowed({ area: 'jogos' }, { settings: s, prefs: prefs({ quiet: { push: true } }), now: NOITE, flagOn: true }).reason).toBe('quiet_hours');
    expect(P.pushAllowed({ area: 'jogos' }, { settings: s, prefs: prefs({}), now: NOITE, flagOn: true }).allowed).toBe(true);
  });
});

describe('capReason', () => {
  const s = settings();
  it('teto por pessoa, por remetente, por par e orçamento', () => {
    expect(P.capReason('email', { user: 20 }, s)).toBe('cap_user');
    expect(P.capReason('email', { sender: 300 }, s, { trust: 'user' })).toBe('cap_sender');
    expect(P.capReason('email', { sender: 300 }, s, { trust: 'server' })).toBe(null);
    expect(P.capReason('whatsapp', { pair: 5 }, s, { trust: 'user' })).toBe('cap_pair');
    expect(P.capReason('whatsapp', { month_cost: 99.98 }, s)).toBe('budget');
    expect(P.capReason('whatsapp', { month_cost: 50 }, s)).toBe(null);
  });
});

describe('telefone, máscaras e texto', () => {
  it('normaliza para E.164 com o Brasil como padrão', () => {
    expect(P.normalizePhone('(51) 99999-8888')).toBe('+5551999998888');
    expect(P.normalizePhone('051 99999-8888')).toBe('+5551999998888');
    expect(P.normalizePhone('+1 415 555 2671')).toBe('+14155552671');
    expect(P.normalizePhone('123')).toBe('');
  });
  it('máscaras', () => {
    expect(P.maskPhone('+5551999998888')).toBe('+55 51 •••••-8888');
    expect(P.maskEmail('ana.souza@gmail.com')).toBe('a•••a@gmail.com');
  });
  it('⭐ texto de pessoa perde os links', () => {
    expect(P.defangText('veja https://golpe.io/x e www.golpe.com ou pix.com.br agora')).toBe('veja [link] e [link] ou [link] agora');
  });
  it('partes do SMS', () => {
    expect(P.smsSegments('a'.repeat(160))).toBe(1);
    expect(P.smsSegments('a'.repeat(161))).toBe(2);
    expect(P.smsSegments('ã'.repeat(70))).toBe(1);
    expect(P.smsSegments('ã'.repeat(71))).toBe(2);
  });
  it('janela silenciosa que vira a meia-noite', () => {
    expect(P.inQuietWindow(23 * 60, '22:00', '07:00')).toBe(true);
    expect(P.inQuietWindow(6 * 60, '22:00', '07:00')).toBe(true);
    expect(P.inQuietWindow(12 * 60, '22:00', '07:00')).toBe(false);
  });
});

describe('chave pública do Web Push (VAPID)', () => {
  const PUBLICA = `B${'A1_-'.repeat(21)}xy`;
  it('⭐ aceita a pública (87 letras, começa por B), tirando espaços e "="', () => {
    expect(PUBLICA).toHaveLength(87);
    expect(P.vapidKeyProblem(PUBLICA)).toBe('');
    expect(P.normalizeVapidKey(`  ${PUBLICA}=\n`)).toBe(PUBLICA);
    expect(P.normalizeSettings({ push: { vapid_public_key: ` ${PUBLICA}=` } }).push.vapid_public_key).toBe(PUBLICA);
  });
  it('recusa a privada com motivo próprio e o resto como formato', () => {
    expect(P.vapidKeyProblem('k'.repeat(43))).toBe('private_key');
    expect(P.vapidKeyProblem(`A${PUBLICA.slice(1)}`)).toBe('format');
    expect(P.vapidKeyProblem(`${PUBLICA}+`)).toBe('format');
    expect(P.vapidKeyProblem('')).toBe('empty');
    expect(P.vapidKeyProblem(null)).toBe('empty');
    expect(P.normalizeSettings({ push: { vapid_public_key: 'k'.repeat(43) } }).push.vapid_public_key).toBe('');
  });
});
