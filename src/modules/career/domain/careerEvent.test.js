import { describe, it, expect } from 'vitest';
import {
  CAREER_LIMITS, CAREER_STATUS, bestPosition, careerCompleteness, careerSeal, deriveCareerStatus, entryLabel,
  listRowsToEvents, matchPlatformTournament, newCareerEventId, normalizeCareerEvent, normalizeCareerLink,
  normalizeEntry, normalizePhoto, normalizeTournamentName, registeredProgress, repeatEvent, repeatableEvents,
} from './careerEvent.js';

const HOJE = '2026-11-04';
const UID = 'uid_dono_1';
const base = (extra = {}) => ({ name: 'Open de Floripa', start_date: '2026-05-10', entries: [{ format: 'doubles', gender: 'mixed' }], ...extra });

describe('status derivado da data local', () => {
  it('⭐ passada = jogado; futura = planejado; hoje = jogado', () => {
    expect(deriveCareerStatus('2026-11-03', { today: HOJE })).toBe(CAREER_STATUS.PLAYED);
    expect(deriveCareerStatus('2026-11-04', { today: HOJE })).toBe(CAREER_STATUS.PLAYED);
    expect(deriveCareerStatus('2026-11-05', { today: HOJE })).toBe(CAREER_STATUS.PLANNED);
  });
  it('cancelado fica cancelado', () => {
    expect(deriveCareerStatus('2027-01-01', { current: 'cancelled', today: HOJE })).toBe('cancelled');
  });
});

describe('normalizeCareerEvent', () => {
  it('⭐ nome, data e uma categoria bastam; status sai da data', () => {
    const r = normalizeCareerEvent(base(), { uid: UID, today: HOJE, nowMs: 5 });
    expect(r.valid).toBe(true);
    expect(r.value).toMatchObject({ uid: UID, status: 'played', name: 'Open de Floripa', start_date: '2026-05-10', created_at_ms: 5, updated_at_ms: 5 });
    expect(r.value.entries).toEqual([{ format: 'doubles', gender: 'mixed', age: null, level_bracket: null, placement: null }]);
    expect(r.value.priority).toBeUndefined();
  });
  it('futuro ganha prioridade (padrão "só para jogar")', () => {
    expect(normalizeCareerEvent(base({ start_date: '2027-02-01' }), { uid: UID, today: HOJE }).value).toMatchObject({ status: 'planned', priority: 'casual' });
  });
  it('recusa sem nome, sem data ou sem categoria', () => {
    expect(normalizeCareerEvent(base({ name: '  ' }), { today: HOJE }).valid).toBe(false);
    expect(normalizeCareerEvent(base({ start_date: '10/05/2026' }), { today: HOJE }).valid).toBe(false);
    expect(normalizeCareerEvent(base({ entries: [] }), { today: HOJE }).valid).toBe(false);
  });
  it('⭐ limites: texto cortado, até 6 categorias e 6 fotos, UF só da lista, fim antes do início some', () => {
    const r = normalizeCareerEvent(base({
      name: 'x'.repeat(500), notes: 'n'.repeat(3000), state: 'zz', end_date: '2026-05-01',
      entries: Array.from({ length: 9 }, () => ({ format: 'singles' })),
      photos: Array.from({ length: 9 }, (_, i) => ({ path: `carreira/${UID}/${i}.webp`, kind: 'medal', alt: 'a' })),
    }), { uid: UID, today: HOJE }).value;
    expect(r.name).toHaveLength(CAREER_LIMITS.name);
    expect(r.notes).toHaveLength(CAREER_LIMITS.notes);
    expect(r.entries).toHaveLength(6);
    expect(r.photos).toHaveLength(6);
    expect(r.state).toBe('');
    expect(r.end_date).toBeNull();
  });
  it('federação do diretório marca "federado"', () => {
    expect(normalizeCareerEvent(base({ federation_id: 'fgp', federation_acronym: 'FGP' }), { today: HOJE }).value).toMatchObject({ federated: true, federation_id: 'fgp' });
  });
});

describe('participação', () => {
  it('⭐ listas fechadas: valor desconhecido vira vazio, "equipes" vale só aqui', () => {
    expect(normalizeEntry({ format: 'teams', gender: 'x', age: '40plus', level_bracket: '9.9', placement: 'medalha' }))
      .toEqual({ format: 'teams', gender: null, age: null, level_bracket: null, placement: null });
  });
  it('"outro" leva o rótulo livre; pontuação declarada é número', () => {
    const e = normalizeEntry({ format: 'doubles', age: 'other', age_label: '40+', level_bracket: 'other', level_label: 'Iniciante', placement: 'other', placement_n: '5', points_declared: '250' });
    expect(e).toMatchObject({ age_label: '40+', level_label: 'Iniciante', placement_n: 5, points_declared: 250 });
  });
  it('simples não guarda dupla; dupla só guarda o uid quando ele parece um uid', () => {
    expect(normalizeEntry({ format: 'singles', partner: { name: 'Ana' } }).partner).toBeUndefined();
    expect(normalizeEntry({ format: 'doubles', partner: { name: 'Ana', uid: 'abcdef123' } }).partner).toEqual({ uid: 'abcdef123', name: 'Ana' });
    expect(normalizeEntry({ format: 'doubles', partner: { name: 'Ana', uid: '../x' } }).partner).toEqual({ name: 'Ana' });
  });
  it('rótulo e melhor degrau', () => {
    expect(entryLabel(normalizeEntry({ format: 'doubles', gender: 'mixed', level_bracket: '4.0' }))).toBe('Duplas Mista · 4.0');
    expect(bestPosition({ entries: [{ placement: 'semis' }, { placement: 'runner_up' }, { placement: 'third' }] })).toBe(2);
    expect(bestPosition({ entries: [{ placement: 'groups' }] })).toBeNull();
  });
});

describe('foto e link', () => {
  it('🔴 foto só da pasta do dono; tipo fora da lista vira "other"', () => {
    expect(normalizePhoto({ path: 'carreira/outro/a.webp' }, UID)).toBeNull();
    expect(normalizePhoto({ path: 'treino/uid_dono_1/a.webp' }, UID)).toBeNull();
    expect(normalizePhoto({ path: `carreira/${UID}/a.webp`, url: 'https://x/y', kind: 'selfie', alt: 'Medalha' }, UID))
      .toEqual({ path: `carreira/${UID}/a.webp`, url: 'https://x/y', kind: 'other', alt: 'Medalha' });
  });
  it('🔴 link só https, sem usuário, ≤ 300', () => {
    expect(normalizeCareerLink('https://fgp.com.br/etapa')).toBe('https://fgp.com.br/etapa');
    expect(normalizeCareerLink('http://fgp.com.br')).toBe('');
    expect(normalizeCareerLink('javascript:alert(1)')).toBe('');
    expect(normalizeCareerLink('https://a:b@fgp.com.br')).toBe('');
    expect(normalizeCareerLink(`https://fgp.com.br/${'a'.repeat(300)}`)).toBe('');
  });
});

describe('completude em camadas', () => {
  const ev = (extra) => normalizeCareerEvent(base(extra), { uid: UID, today: HOJE }).value;
  it('⭐ "0 de 3" com o ÚNICO próximo passo; o balanço só conta quando existe', () => {
    const c = careerCompleteness(ev());
    expect([c.done, c.total]).toEqual([0, 3]);
    expect(c.next.id).toBe('resultado');
    expect(careerCompleteness(ev(), { debrief: true }).total).toBe(4);
  });
  it('resultado + foto ⇒ falta a dupla; simples não precisa de dupla', () => {
    const c = careerCompleteness(ev({ entries: [{ format: 'doubles', placement: 'champion' }], photos: [{ path: `carreira/${UID}/a.webp` }] }));
    expect([c.done, c.next.id]).toEqual([2, 'dupla']);
    const s = careerCompleteness(ev({ entries: [{ format: 'singles', placement: 'champion' }], photos: [{ path: `carreira/${UID}/a.webp` }] }));
    expect([s.done, s.total, s.next]).toEqual([3, 3, null]);
  });
  it('planejado não tem o que completar', () => {
    expect(careerCompleteness(ev({ start_date: '2027-01-01' }))).toBeNull();
  });
});

describe('"É este?"', () => {
  const meus = [
    { id: 't1', name: 'Open Floripa 2026', starts_at: '2026-05-11', city: 'Florianópolis', is_player: true },
    { id: 't2', name: 'Open de Floripa', starts_at: '2026-05-10', city: 'Florianópolis', is_player: false },
    { id: 't3', name: 'Copa Sul', starts_at: '2026-05-10', is_player: true },
  ];
  const ev = { name: 'Open de Floripa', start_date: '2026-05-10', city: 'florianopolis' };
  it('⭐ nome normalizado + data ±3 dias + cidade, só onde a pessoa JOGOU', () => {
    expect(matchPlatformTournament(ev, meus)?.id).toBe('t1');
    expect(normalizeTournamentName('Open de Floripa 2026')).toEqual(['floripa']);
  });
  it('fora da janela, outra cidade ou nome diferente: nenhum', () => {
    expect(matchPlatformTournament({ ...ev, start_date: '2026-05-20' }, meus)).toBeNull();
    expect(matchPlatformTournament({ ...ev, city: 'Joinville' }, meus)).toBeNull();
    expect(matchPlatformTournament({ ...ev, name: 'Liga Norte' }, meus)).toBeNull();
  });
  it('🔴 lista que falhou não vira "não está na plataforma"', () => {
    expect(matchPlatformTournament(ev, undefined)).toBeNull();
  });
  it('selo oficial só com o torneio na lista de quem jogou', () => {
    expect(careerSeal({ platform_tournament_id: 't1' }, meus)).toBe('official');
    expect(careerSeal({ platform_tournament_id: 't2' }, meus)).toBe('declared');
    expect(careerSeal({ platform_tournament_id: 't1' }, undefined)).toBe('declared');
  });
});

describe('modo lista', () => {
  it('⭐ linhas → eventos de ano (1º de janeiro), linha sem nome ignorada, ano inválido dito', () => {
    const { events, errors } = listRowsToEvents([
      { year: 2023, name: 'Etapa Sul', format: 'doubles', gender: 'male', placement: 'champion' },
      { year: 2024, name: '' },
      { year: 2031, name: 'Futuro' },
    ], { uid: UID, today: HOJE, nowMs: 100, rand: () => 0.5 });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ uid: UID, start_date: '2023-01-01', date_precision: 'year', status: 'played' });
    expect(events[0].id.startsWith(`${UID}_`)).toBe(true);
    expect(errors).toEqual([{ row: 2, error: expect.any(String) }]);
  });
  it('"7 de ~20": só com a estimativa', () => {
    expect(registeredProgress([{ status: 'played' }, { status: 'planned' }], 20)).toEqual({ done: 1, estimate: 20, complete: false });
    expect(registeredProgress([], null)).toBeNull();
  });
  it('id novo leva o prefixo do dono', () => {
    expect(newCareerEventId(UID, 1000, 0.1).startsWith(`${UID}_`)).toBe(true);
  });
});

describe('repetir o do ano passado', () => {
  it('⭐ nome (com o ano somado), organizador, cidade e federação; resultado em branco', () => {
    const r = repeatEvent({ name: 'Open Floripa 2025', organizer: 'FCP', city: 'Floripa', state: 'SC', federation_id: 'f', federation_acronym: 'FCP', federated: true, start_date: '2025-05-10', entries: [{ placement: 'champion' }] });
    expect(r).toMatchObject({ name: 'Open Floripa 2026', organizer: 'FCP', city: 'Floripa', state: 'SC', federation_id: 'f', federated: true, start_date: '2026-05-09' });
    expect(r.entries).toBeUndefined();
  });
  it('só os jogados de anos anteriores', () => {
    const l = repeatableEvents([{ status: 'played', start_date: '2025-01-01' }, { status: 'played', start_date: '2026-03-01' }, { status: 'planned', start_date: '2024-01-01' }], HOJE);
    expect(l.map((e) => e.start_date)).toEqual(['2025-01-01']);
  });
});
