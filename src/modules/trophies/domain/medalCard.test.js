import { describe, expect, it } from 'vitest';
import { buildMedalCard, buildSeasonCard, dataPorExtenso, placeSaying, SEASON_MODE } from './medalCard.js';

describe('buildSeasonCard (retrospectiva da temporada)', () => {
  it('⭐ números do ano, a parceria e o aviso de resultado declarado', () => {
    const c = buildSeasonCard({ year: 2025, tournaments: 6, gold: 2, silver: 1, bronze: 0, partner: { name: ' Ana ', together: 4, medals: 2 }, declared: true, name: 'Eu' });
    expect(c.mode).toBe(SEASON_MODE);
    expect(c.season).toMatchObject({ year: 2025, tournaments: 6, gold: 2, silver: 1, bronze: 0, partner: { name: 'Ana', together: 4, medals: 2 } });
    expect(c.event).toMatchObject({ kind: 'temporada', declared: true, title: 'Eu' });
    expect(c.shareText).toMatch(/2025/);
    expect(c.shareText).toMatch(/Ana/);
    expect(c.shareText).toMatch(/declarado/);
    expect(c.fileName).toBe('picklerush-temporada-2025.png');
    expect(c.url).toBe('');
  });
  it('sem parceria e sem declarado, o texto não os menciona; frase estável pelo ano', () => {
    const c = buildSeasonCard({ year: 2026, tournaments: 1, gold: 0, silver: 0, bronze: 1 });
    expect(c.season.partner).toBeNull();
    expect(c.shareText).not.toMatch(/declarado|Parceria/);
    expect(buildSeasonCard({ year: 2026 }).saying).toBe(c.saying);
  });
});

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

  it('⭐ torneio de fora (Minha carreira): o cartão e o texto dizem "resultado declarado"', () => {
    const c = buildMedalCard({ places, event: { ...event, declared: true }, position: 1 });
    expect(c.event.declared).toBe(true);
    expect(c.shareText).toContain('Resultado declarado');
    expect(buildMedalCard({ places, event, position: 1 }).event.declared).toBe(false);
  });

  it('⭐ data sem hora é o dia LOCAL (o torneio de 12/10 não vira 11/10)', () => {
    expect(dataPorExtenso('2026-10-12')).toBe('12 de outubro de 2026');
  });

  it('dataPorExtenso aceita Timestamp e devolve vazio sem data', () => {
    expect(dataPorExtenso({ seconds: 1791000000, nanoseconds: 0 })).toMatch(/de 2026$/);
    expect(dataPorExtenso(null)).toBe('');
  });
});
