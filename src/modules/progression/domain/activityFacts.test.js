import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import {
  buildActivityFacts, achievementUserFromFacts, monthsFromDates, lastWeekOfDecember,
  consecutiveSeasons, distinctDays, isAchievementTracked, ACHIEVEMENT_TRACKING, FACT_SOURCES,
} from './activityFacts.js';
import { ACHIEVEMENTS_V2, computeAchievementsV2 } from '@/modules/achievements/domain/achievementsV2.js';

const NOW = new Date('2026-10-02T15:00:00Z');
const ts = (iso) => Timestamp.fromDate(new Date(iso));
const completo = (extra = {}) => Object.fromEntries(FACT_SOURCES.map((n) => [n, []])) && ({
  ...Object.fromEntries(FACT_SOURCES.map((n) => [n, []])),
  kudosIndex: { givenCount: 0, receivedCount: 0 },
  referral: { totalActivated: 0, totalSignups: 0 },
  clubEventsCreated: 0,
  gameDaysCreated: 0,
  ...extra,
});

describe('buildActivityFacts', () => {
  it('fonte que não carregou vai para unknown — nunca vira zero afirmado', () => {
    const f = buildActivityFacts({ following: [{}, {}] }, { now: NOW });
    expect(f.counts.follows).toBe(2);
    expect(f.unknown).toContain('bookings');
    expect(f.known('following')).toBe(true);
    expect(f.known('bookings')).toBe(false);
  });

  it('data lida do banco (Timestamp) entra no recorte de datas', () => {
    const f = buildActivityFacts(
      completo({ following: [{ created_at: ts('2026-10-01T12:00:00Z') }] }),
      { now: NOW },
    );
    expect(f.dates.follows).toEqual([ts('2026-10-01T12:00:00Z').toMillis()]);
    expect(f.unknown).toEqual([]);
  });

  it('reserva só vale como jogada se concluída ou confirmada que já passou, e sem falta', () => {
    const f = buildActivityFacts(completo({
      bookings: [
        { status: 'completed', arena_id: 'a1', slots: [{ date: '2026-09-01' }] },
        { status: 'confirmed', arena_id: 'a2', slots: [{ date: '2026-09-20' }] },
        { status: 'confirmed', arena_id: 'a3', slots: [{ date: '2026-12-20' }] },
        { status: 'confirmed', arena_id: 'a4', slots: [{ date: '2026-09-02' }], no_show: true },
        { status: 'declined', arena_id: 'a5', slots: [{ date: '2026-09-02' }] },
      ],
    }), { now: NOW });
    expect(f.counts.bookings).toBe(4);
    expect(f.counts.bookingsPlayed).toBe(2);
    expect(f.counts.arenasVisited).toBe(2);
  });

  it('data civil da reserva vira meio-dia de Brasília (nunca o dia anterior)', () => {
    const f = buildActivityFacts(completo({
      bookings: [{ status: 'completed', arena_id: 'a', slots: [{ date: '2026-09-30' }] }],
    }), { now: NOW });
    expect(new Date(f.dates.bookings[0]).toISOString().slice(0, 10)).toBe('2026-09-30');
  });

  it('perfil: foto, nível e cidade/UF', () => {
    const f = buildActivityFacts(completo(), {
      now: NOW,
      profile: { uid: 'u', photo_url: 'x', city: 'Curitiba', state: 'PR', leveling_level: 'avancado', birth_date: '1990-03-10' },
    });
    expect(f.profile).toMatchObject({ hasPhoto: true, hasLevel: true, hasCityAndState: true, birthMonth: 3 });
  });

  it('clube: quem criou e o maior clube que administra', () => {
    const f = buildActivityFacts(completo({
      clubs: [
        { id: 'c1', my_role: 'owner', member_count: 61, created_by: 'u' },
        { id: 'c2', my_role: 'member', member_count: 400, created_by: 'x' },
      ],
    }), { now: NOW, profile: { uid: 'u' } });
    expect(f.counts.clubsJoined).toBe(2);
    expect(f.counts.clubsCreated).toBe(1);
    expect(f.counts.biggestClubAdminMembers).toBe(61);
  });
});

describe('achievementUserFromFacts', () => {
  const base = { uid: 'u', stats: { played: 30, wins: 12 }, rating: 1010 };

  it('destrava as conquistas que antes ficavam bloqueadas para sempre', () => {
    const facts = buildActivityFacts(completo({
      following: [{}], followers: Array(10).fill({}),
      clubs: [{ id: 'c', my_role: 'member', member_count: 5 }],
      arenaReviews: [{}],
      lessons: [{ status: 'completed' }],
    }), { now: NOW, profile: { uid: 'u', photo_url: 'f', city: 'X', state: 'PR' } });
    const user = achievementUserFromFacts(facts, base);
    const { unlocked } = computeAchievementsV2(user);
    const ids = new Set(unlocked.map((a) => a.id));
    ['social_first_follow', 'social_10_followers', 'community_first_club', 'discovery_first_arena_review',
      'discovery_first_lesson', 'discovery_photo', 'discovery_localized'].forEach((id) => expect(ids.has(id)).toBe(true));
  });

  it('fonte desconhecida: o campo fica ausente (a conquista segue bloqueada sem afirmar zero)', () => {
    const facts = buildActivityFacts({}, { now: NOW });
    const user = achievementUserFromFacts(facts, base);
    expect(user.follows_count).toBeUndefined();
    expect(user.bookings_count).toBeUndefined();
  });

  it('sazonais: vetor de 12 meses e datas de estação', () => {
    const jun = new Date('2026-06-10T15:00:00Z').getTime();
    const dez = new Date('2025-12-28T15:00:00Z').getTime();
    const facts = buildActivityFacts(completo(), { now: NOW, profile: { uid: 'u', birth_date: '1990-06-01' } });
    const user = achievementUserFromFacts(facts, { ...base, matchDates: [jun], gameDayDates: [dez] });
    const ids = new Set(computeAchievementsV2(user).unlocked.map((a) => a.id));
    expect(ids.has('seasonal_festa_junina')).toBe(true);
    expect(ids.has('seasonal_birthday_month')).toBe(true);
    expect(ids.has('seasonal_reveillon')).toBe(true);
  });

  it('toda conquista não rastreável aponta para um id real do catálogo', () => {
    const ids = new Set(ACHIEVEMENTS_V2.map((a) => a.id));
    Object.keys(ACHIEVEMENT_TRACKING).forEach((id) => expect(ids.has(id)).toBe(true));
    expect(isAchievementTracked('social_first_follow')).toBe(true);
    expect(isAchievementTracked('career_tri_champion')).toBe(false);
  });

  it('toda conquista rastreável tem o campo fornecido ou é de carreira/streak/xp', () => {
    // Fotografia: com tudo carregado, o que o catálogo lê e ninguém fornece é só o não rastreável.
    const facts = buildActivityFacts(completo(), { now: NOW, profile: { uid: 'u' } });
    const user = achievementUserFromFacts(facts, { uid: 'u' });
    const lidos = new Set();
    ACHIEVEMENTS_V2.forEach((a) => {
      const src = a.test.toString();
      [...src.matchAll(/u\??\.([a-zA-Z0-9_]+)/g)].forEach((m) => lidos.add({ campo: m[1], id: a.id }));
    });
    // Campos que o catálogo lê só como ALTERNATIVA de outro (`a || b`): o
    // predicado já funciona com o campo que fornecemos.
    const alternativas = new Set(['createdAt', 'leveling', 'profile_completeness']);
    const faltando = [...lidos].filter(({ campo, id }) => !(campo in user) && !alternativas.has(campo) && isAchievementTracked(id));
    expect(faltando).toEqual([]);
  });
});

describe('datas', () => {
  it('monthsFromDates devolve 12 posições com janeiro no índice 0', () => {
    const v = monthsFromDates([new Date('2026-01-10T15:00:00Z').getTime()]);
    expect(v).toHaveLength(12);
    expect(v[0]).toBe(1);
  });
  it('lastWeekOfDecember só conta de 25 a 31', () => {
    expect(lastWeekOfDecember([
      new Date('2025-12-24T15:00:00Z').getTime(), new Date('2025-12-26T15:00:00Z').getTime(),
    ])).toBe(1);
  });
  it('consecutiveSeasons acha a maior sequência de trimestres', () => {
    const d = (iso) => new Date(iso).getTime();
    expect(consecutiveSeasons([d('2026-01-10T15:00:00Z'), d('2026-04-10T15:00:00Z'), d('2026-07-10T15:00:00Z'), d('2027-01-10T15:00:00Z')])).toBe(3);
    expect(consecutiveSeasons([])).toBe(0);
  });
  it('distinctDays usa o dia de Brasília (23h local não vira o dia seguinte)', () => {
    const d = new Date('2026-10-03T01:30:00Z').getTime(); // 22h30 de 02/10 em Brasília
    expect([...distinctDays([d])]).toEqual(['2026-10-02']);
  });
});
