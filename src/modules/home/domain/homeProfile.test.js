import { describe, it, expect } from 'vitest';
import {
  HOME_FOCUS, FOCUS_REASON, DEFAULT_FOCI, resolveHomeFoci, hasFocus, focusReasonText,
  HOME_SECTION, homeSectionsFor,
} from './homeProfile.js';

const focos = (r) => r.map((f) => f.focus);

describe('resolveHomeFoci — o que a tela inicial mostra primeiro', () => {
  it('sem interesse e sem papel: um começo comum, nunca uma tela vazia', () => {
    const r = resolveHomeFoci({ interests: [], sinais: {} });
    expect(focos(r)).toEqual([...DEFAULT_FOCI]);
    expect(r.every((f) => f.reason === FOCUS_REASON.PADRAO)).toBe(true);
  });

  it('interesse declarado decide a tela de quem ainda não faz nada', () => {
    const r = resolveHomeFoci({ interests: ['organize_tournaments', 'ranking'] });
    expect(focos(r)).toEqual([HOME_FOCUS.ORGANIZAR, HOME_FOCUS.RANKING]);
    expect(r[0].reason).toBe(FOCUS_REASON.INTERESSE);
  });

  it('⭐ o papel real vence o interesse: quem gere arena vê a arena primeiro, mesmo sem ter marcado', () => {
    const r = resolveHomeFoci({ interests: ['play_tournaments'], sinais: { arenasGeridas: 1 } });
    expect(r[0]).toMatchObject({ focus: HOME_FOCUS.ARENA, reason: FOCUS_REASON.PAPEL });
    expect(focos(r)).toContain(HOME_FOCUS.COMPETIR);
    // Com interesse declarado, o começo padrão NÃO entra.
    expect(focos(r)).not.toContain(HOME_FOCUS.RESERVAR);
  });

  it('professor e organizador ativos sobem como papel', () => {
    const r = resolveHomeFoci({ interests: ['ranking'], sinais: { ehProfessor: true, torneiosOrganizando: 2 } });
    expect(focos(r).slice(0, 2)).toEqual([HOME_FOCUS.ENSINAR, HOME_FOCUS.ORGANIZAR]);
  });

  it('organizar só conta como papel com torneio que ainda vale', () => {
    const r = resolveHomeFoci({ interests: ['ranking'], sinais: { torneiosOrganizando: 0 } });
    expect(hasFocus(r, HOME_FOCUS.ORGANIZAR)).toBe(false);
  });

  it('atividade traz a seção sem passar na frente do que a pessoa escolheu', () => {
    const r = resolveHomeFoci({ interests: ['community'], sinais: { temReservas: true, temClubes: true } });
    expect(focos(r)).toEqual([HOME_FOCUS.COMUNIDADE, HOME_FOCUS.RESERVAR, HOME_FOCUS.CLUBES]);
  });

  it('um mesmo foco fica com o MAIOR motivo e aparece uma vez só', () => {
    const r = resolveHomeFoci({ interests: ['random_partners', 'training_partners', 'personal_training'], sinais: { temDiasDeJogo: true } });
    expect(focos(r)).toEqual([HOME_FOCUS.JOGAR]);
    expect(r[0].reason).toBe(FOCUS_REASON.INTERESSE);
  });

  it('ignora interesse desconhecido (lixo gravado não quebra a tela)', () => {
    const r = resolveHomeFoci({ interests: ['xyz', null, 'ranking'] });
    expect(focos(r)).toEqual([HOME_FOCUS.RANKING]);
  });

  it('interesses fora de lista (não-array) caem no começo comum', () => {
    expect(focos(resolveHomeFoci({ interests: 'ranking' }))).toEqual([...DEFAULT_FOCI]);
    expect(focos(resolveHomeFoci())).toEqual([...DEFAULT_FOCI]);
  });

  it('todo motivo tem um texto para "por que estou vendo isto"', () => {
    Object.values(FOCUS_REASON).forEach((m) => expect(focusReasonText(m)).toMatch(/\w/));
  });
});

describe('homeSectionsFor', () => {
  it('a agenda vem sempre primeiro; depois as seções na ordem das frentes, sem repetir', () => {
    const foci = resolveHomeFoci({ interests: ['ranking', 'play_tournaments'], sinais: { arenasGeridas: 1 } });
    const ids = homeSectionsFor(foci).map((s) => s.id);
    expect(ids).toEqual([
      HOME_SECTION.AGENDA, HOME_SECTION.ARENA, HOME_SECTION.TORNEIOS,
      HOME_SECTION.RESULTADO, HOME_SECTION.RANKING,
    ]);
  });

  it('cada seção leva o motivo da frente que a trouxe', () => {
    const [, arena] = homeSectionsFor(resolveHomeFoci({ sinais: { arenasGeridas: 2 }, interests: ['clubs'] }));
    expect(arena).toMatchObject({ id: HOME_SECTION.ARENA, reason: FOCUS_REASON.PAPEL });
  });

  it('sem frentes, só a agenda', () => {
    expect(homeSectionsFor([]).map((s) => s.id)).toEqual([HOME_SECTION.AGENDA]);
  });
});
