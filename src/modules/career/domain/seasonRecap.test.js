import { describe, expect, it } from 'vitest';
import { bestPartnership, buildSeasonRecap, seasonRecapOffered } from './seasonRecap.js';
import { buildCareerTimeline } from './timeline.js';

const ME = { uid: 'eu', name: 'Eu' };
const ev = (id, extra = {}) => ({
  id, uid: 'eu', name: `Torneio ${id}`, status: 'played', start_date: '2025-05-10',
  entries: [{ format: 'doubles', placement: 'champion', partner: { name: 'Ana' } }], ...extra,
});
const ms = (iso) => new Date(`${iso}T12:00:00`).getTime();

describe('quando a retrospectiva aparece', () => {
  it('⭐ temporada fechada sempre; a corrente só a partir de dezembro', () => {
    expect(seasonRecapOffered(2025, '2026-11-04')).toBe(true);
    expect(seasonRecapOffered(2026, '2026-11-04')).toBe(false);
    expect(seasonRecapOffered(2026, '2026-12-01')).toBe(true);
    expect(seasonRecapOffered(2027, '2026-12-31')).toBe(false);
  });
});

describe('melhor parceria', () => {
  it('⭐ quem mais jogou junto; no empate, mais medalhas', () => {
    const career = [
      ev('a'), ev('b', { entries: [{ format: 'doubles', placement: 'quarters', partner: { name: 'ana ' } }] }),
      ev('c', { entries: [{ format: 'doubles', placement: 'champion', partner: { name: 'Bia' } }] }),
    ];
    expect(bestPartnership({ year: 2025, career, me: ME })).toEqual({ name: 'Ana', uid: null, together: 2, medals: 1 });
  });
  it('soma os pódios da plataforma (pela conta) e não conta duas vezes o torneio ligado', () => {
    const trophies = [{ tournamentId: 't1', date: ms('2025-08-01'), people: [{ user_id: 'eu', name: 'Eu' }, { user_id: 'u_bia', name: 'Bia' }] }];
    const career = [ev('x', { platform_tournament_id: 't1', entries: [{ format: 'doubles', placement: 'champion', partner: { name: 'Bia', uid: 'u_bia' } }] }), ev('y')];
    // Bia: só o pódio da plataforma (o "É este" não soma de novo); Ana: um de fora. Empate em 1 ⇒ medalhas, depois nome.
    expect(bestPartnership({ year: 2025, career, trophies, me: ME })).toMatchObject({ name: 'Ana', together: 1 });
    expect(bestPartnership({ year: 2025, career: [], trophies, me: ME })).toMatchObject({ name: 'Bia', uid: 'u_bia', together: 1, medals: 1 });
  });
  it('a mesma pessoa com conta (pódio daqui) e só com o nome (torneio de fora) é UMA', () => {
    const trophies = [{ tournamentId: 't1', date: ms('2025-08-01'), people: [{ user_id: 'u_bia', name: 'Bia' }] }];
    const career = [
      ev('x', { entries: [{ format: 'doubles', placement: 'quarters', partner: { name: 'bia' } }] }),
      ev('a'), ev('b'),
    ];
    expect(bestPartnership({ year: 2025, career, trophies, me: ME })).toMatchObject({ name: 'Ana', together: 2 });
    career.push(ev('y', { entries: [{ format: 'doubles', placement: 'champion', partner: { name: 'Bia' } }] }));
    expect(bestPartnership({ year: 2025, career, trophies, me: ME })).toEqual({ name: 'Bia', uid: 'u_bia', together: 3, medals: 2 });
  });
  it('sem dupla conhecida (simples) não inventa parceria; outro ano não entra', () => {
    expect(bestPartnership({ year: 2025, career: [ev('s', { entries: [{ format: 'singles', placement: 'champion' }] })], me: ME })).toBeNull();
    expect(bestPartnership({ year: 2024, career: [ev('a')], me: ME })).toBeNull();
  });
});

describe('o cartão da temporada', () => {
  const tl = (career) => buildCareerTimeline({ career, tournaments: [], trophies: { torneios: [], diasDeJogo: [] }, gameDayGames: [], federationPoints: [], today: '2026-11-04' });

  it('⭐ torneios, medalhas e a parceria; diz quando há resultado declarado', () => {
    const career = [ev('a'), ev('b', { entries: [{ format: 'doubles', placement: 'runner_up', partner: { name: 'Ana' } }] })];
    const timeline = tl(career);
    const r = buildSeasonRecap({ season: timeline.seasons[0], faltou: timeline.faltou, career, trophies: [], me: ME, today: '2026-11-04' });
    expect(r).toMatchObject({ year: 2025, tournaments: 2, gameDays: 0, gold: 1, silver: 1, bronze: 0, declared: true, partner: { name: 'Ana', together: 2, medals: 2 } });
  });

  it('não oferece com fonte faltando, antes de dezembro ou com a temporada vazia', () => {
    const career = [ev('a', { start_date: '2026-05-10' })];
    const timeline = tl(career);
    expect(buildSeasonRecap({ season: timeline.seasons[0], career, today: '2026-11-04' })).toBeNull();
    expect(buildSeasonRecap({ season: timeline.seasons[0], career, today: '2026-12-02' })).not.toBeNull();
    expect(buildSeasonRecap({ season: timeline.seasons[0], faltou: ['os pódios'], career, today: '2026-12-02' })).toBeNull();
    expect(buildSeasonRecap({ season: { year: 2025, items: [], summary: { events: 0 } }, today: '2026-11-04' })).toBeNull();
  });
});
