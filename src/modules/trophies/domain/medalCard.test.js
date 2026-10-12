import { describe, expect, it } from 'vitest';
import { buildMedalCard, dataPorExtenso, placeSaying } from './medalCard.js';

const places = [
  { position: 1, label: 'Campeões', entries: [{ label: 'Ana / Bia', people: [{ user_id: 'a', name: 'Ana', photo_url: 'https://x/a.png' }, { user_id: 'b', name: 'Bia', photo_url: null }] }] },
  { position: 2, label: 'Vice-campeões', entries: [{ label: 'Caio / Dudu', people: [{ name: 'Caio' }, { name: 'Dudu' }] }] },
  { position: 3, label: '3º lugar', entries: [{ label: 'Eva', people: [{ name: 'Eva' }] }, { label: 'Fê', people: [{ name: 'Fê' }] }] },
];
const event = { title: 'Open de Verão', subtitle: 'Duplas mistas 3.5', date: '2026-10-12T12:00:00Z', city: 'Curitiba', state: 'PR', kind: 'torneio' };

describe('buildMedalCard', () => {
  it('cartão de um degrau: título, nomes, frase estável, texto e arquivo', () => {
    const c = buildMedalCard({ places, event, position: 1, origin: 'https://picklerush.web.app/', link: '/p/t1' });
    expect(c.headline).toBe('Campeões');
    expect(c.names).toEqual(['Ana / Bia']);
    expect(c.people.map((p) => p.name)).toEqual(['Ana', 'Bia']);
    expect(c.showPhotos).toBe(true);
    expect(c.saying).toBe(placeSaying(1, 'Open de Verão|Duplas mistas 3.5|1'));
    expect(c.shareText).toContain('🏆 Campeões: Ana / Bia');
    expect(c.shareText).toContain('Veja no PickleRush:');
    // O link vai à parte: no texto, o WhatsApp o mostraria duas vezes.
    expect(c.shareText).not.toContain('https://');
    expect(c.url).toBe('https://picklerush.web.app/p/t1');
    expect(c.fileName).toBe('picklerush-open-de-verao-campeoes.png');
    expect(c.dateLabel).toBe('12 de outubro de 2026');
    expect(c.where).toBe('Curitiba · PR');
  });

  it('sem foto: as fotos saem e `showPhotos` vira falso', () => {
    const c = buildMedalCard({ places, event, position: 1, showPhotos: false });
    expect(c.people.every((p) => p.photo_url === null)).toBe(true);
    expect(c.showPhotos).toBe(false);
  });

  it('pódio inteiro: três linhas, 3º com duas inscrições', () => {
    const c = buildMedalCard({ places, event, mode: 'podio', host: { name: 'Vila Pickle', kind: 'arena' } });
    expect(c.headline).toBe('Pódio');
    expect(c.lines.map((l) => [l.short, l.names])).toEqual([['Ouro', ['Ana / Bia']], ['Prata', ['Caio / Dudu']], ['Bronze', ['Eva', 'Fê']]]);
    expect(c.hostLine).toBe('Arena Vila Pickle');
    expect(c.shareText).toContain('Bronze: Eva e Fê');
  });

  it('⭐ data sem hora é o dia LOCAL (o torneio de 12/10 não vira 11/10)', () => {
    expect(dataPorExtenso('2026-10-12')).toBe('12 de outubro de 2026');
  });

  it('dataPorExtenso aceita Timestamp e devolve vazio sem data', () => {
    expect(dataPorExtenso({ seconds: 1791000000, nanoseconds: 0 })).toMatch(/de 2026$/);
    expect(dataPorExtenso(null)).toBe('');
  });
});
