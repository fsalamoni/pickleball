import { describe, it, expect } from 'vitest';
import {
  buildPublicTournamentUrl,
  buildTournamentShareText,
  buildWhatsAppShareUrl,
  buildTournamentSharePayload,
} from './shareLinks.js';

describe('buildPublicTournamentUrl', () => {
  it('monta a URL pública no formato /p/<id>', () => {
    expect(buildPublicTournamentUrl('https://picklerush.web.app', 'abc')).toBe(
      'https://picklerush.web.app/p/abc',
    );
  });

  it('remove barra final da origin para evitar //', () => {
    expect(buildPublicTournamentUrl('https://x.com/', 't1')).toBe('https://x.com/p/t1');
  });

  it('retorna vazio quando falta origin ou id', () => {
    expect(buildPublicTournamentUrl('', 't1')).toBe('');
    expect(buildPublicTournamentUrl('https://x.com', '')).toBe('');
  });
});

describe('buildTournamentShareText', () => {
  it('inclui nome, local, código e URL', () => {
    const text = buildTournamentShareText(
      { name: 'Aberto SP', city: 'São Paulo', state: 'SP', invite_code: 'XYZ' },
      'https://x.com/p/1',
    );
    expect(text).toContain('Aberto SP');
    expect(text).toContain('São Paulo / SP');
    expect(text).toContain('XYZ');
    expect(text).toContain('https://x.com/p/1');
    expect(text).toContain('Pickleholics');
  });

  it('omite linhas ausentes sem quebrar', () => {
    const text = buildTournamentShareText({ name: 'Só nome' }, '');
    expect(text).toContain('Só nome');
    expect(text).not.toContain('📍');
    expect(text).not.toContain('🔑');
  });

  it('usa um título padrão quando não há nome', () => {
    expect(buildTournamentShareText({}, '')).toContain('Torneio de Pickleball');
  });
});

describe('buildWhatsAppShareUrl', () => {
  it('codifica o texto no parâmetro wa.me', () => {
    expect(buildWhatsAppShareUrl('oi mundo')).toBe('https://wa.me/?text=oi%20mundo');
  });

  it('retorna vazio para texto vazio', () => {
    expect(buildWhatsAppShareUrl('  ')).toBe('');
  });
});

describe('buildTournamentSharePayload', () => {
  it('monta url, texto e link do WhatsApp coerentes', () => {
    const { url, text, whatsappUrl } = buildTournamentSharePayload({
      origin: 'https://x.com',
      tournament: { id: 't1', name: 'Aberto', city: 'Rio' },
    });
    expect(url).toBe('https://x.com/p/t1');
    expect(text).toContain('Aberto');
    expect(whatsappUrl).toContain('https://wa.me/?text=');
    expect(decodeURIComponent(whatsappUrl)).toContain('https://x.com/p/t1');
  });
});
