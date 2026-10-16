/**
 * Os modelos do que sai da plataforma: moldura fixa, texto escapado, sem
 * link de fora quando quem escreveu foi uma pessoa.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Tpl = require('./messagingTemplates.js');
const P = require('./messagingPolicy.js');

const settings = P.normalizeSettings({ email: { enabled: true, domain: 'picklerush.com.br', postal_address: 'Rua A, 1 — Porto Alegre/RS' } });
const urls = { settings: 'https://picklerush.web.app/configuracoes#email-e-celular', unsubscribe: 'https://picklerush.web.app/api/mensagens/sair?t=x', report: 'https://picklerush.web.app/api/mensagens/denunciar?t=y' };

describe('noticeEmail', () => {
  it('⭐ texto de pessoa: escapado, sem link de fora, com quem mandou e o botão de denunciar', () => {
    const notice = { title: 'Oi <script>', message: 'Paga no pix https://golpe.io agora', link: '/chat/1' };
    const m = Tpl.noticeEmail({ notice, classified: { trust: 'user', area: 'social', sender: 'u2' }, settings, senderName: 'Ana', urls });
    expect(m.html).not.toContain('<script>');
    expect(m.html).toContain('Oi &lt;script&gt;');
    expect(m.html).not.toContain('golpe.io');
    expect(m.html).toContain('[link]');
    expect(m.html).toContain('Enviado por Ana');
    expect(m.html).toContain('Denunciar este e-mail');
    expect(m.html).toContain('https://picklerush.web.app/chat/1');
    expect(m.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    expect(m.text).toContain('Rua A, 1');
  });
  it('⭐ link que não é do site vira a central de avisos', () => {
    expect(Tpl.internalUrl('https://picklerush.web.app', 'https://golpe.io')).toBe('https://picklerush.web.app/notificacoes');
    expect(Tpl.internalUrl('https://picklerush.web.app', '//golpe.io')).toBe('https://picklerush.web.app/notificacoes');
    expect(Tpl.internalUrl('https://picklerush.web.app', '/arenas/1?aba=x')).toBe('https://picklerush.web.app/arenas/1?aba=x');
  });
  it('essencial: sem descadastro (não dá para desligar) e diz por quê', () => {
    const m = Tpl.noticeEmail({ notice: { title: 'Conta suspensa', message: 'x', link: '/configuracoes' }, classified: { trust: 'server', area: 'conta', essential: true }, settings, urls });
    expect(m.headers).toEqual({});
    expect(m.html).toContain('não pode ser desligado');
    expect(m.html).not.toContain('Não quero mais avisos');
  });
  it('no idioma da pessoa quando o aviso tem tradução', () => {
    const notice = { title: 'Reserva confirmada', message: 'x', link: '/', i18n: { title: { key: 'Reserva confirmada', params: {} } } };
    const m = Tpl.noticeEmail({ notice, classified: { trust: 'server', area: 'arenas' }, settings, language: 'en', urls });
    expect(m.html).toContain('Open in PickleRush');
    expect(m.html).toContain('lang="en"');
  });
});

describe('digestEmail', () => {
  it('agrupa por área e conta os avisos', () => {
    const items = [
      { notice: { title: 'A', message: 'a', link: '/torneios' }, classified: { trust: 'server', area: 'torneios' } },
      { notice: { title: 'B', message: 'b', link: '/torneios' }, classified: { trust: 'server', area: 'torneios' } },
      { notice: { title: 'C', message: 'c', link: '/clubes' }, classified: { trust: 'server', area: 'clubes' } },
    ];
    const m = Tpl.digestEmail({ items, settings, urls });
    expect(m.subject).toBe('Seu resumo do dia no PickleRush (3)');
    expect(m.html).toContain('Você tem 3 avisos');
    expect(m.text).toContain('TORNEIOS');
  });
});

describe('WhatsApp e SMS', () => {
  it('parâmetros sem quebra de linha e o fim do link', () => {
    const w = Tpl.whatsappNotice({ notice: { title: 'Oi\nlá', message: 'a\n\nb', link: '/minhas-reservas' }, classified: { trust: 'server' } });
    expect(w.params).toEqual(['Oi lá', 'a b']);
    expect(w.button).toBe('minhas-reservas');
  });
  it('SMS cabe no limite e leva o link', () => {
    const s = Tpl.smsNotice({ notice: { title: 'Reserva', message: 'x'.repeat(500), link: '/minhas-reservas' }, classified: { trust: 'server' }, settings });
    expect(s.length).toBeLessThanOrEqual(settings.sms.max_chars);
    expect(s).toMatch(/^PickleRush: Reserva/);
    expect(s).toContain('https://picklerush.web.app/minhas-reservas');
  });
  it('código por SMS', () => {
    expect(Tpl.smsCode('123456')).toContain('123456');
  });
});
