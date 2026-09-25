/**
 * O jogo aberto que é um dia de jogo (Onda CA).
 *
 * O que protege:
 *  1. ⭐ um formulário só gera as DUAS metades, e elas nunca discordam: data,
 *     horário, quadras e vagas saem do mesmo campo para a vitrine e para o
 *     dia de jogo;
 *  2. ⭐ sem quadra não há dia de jogo (a quadra não fecharia no calendário);
 *  3. formato fora da lista oferecida é recusado;
 *  4. ⭐ o convidado que a arena inseriu no dia de jogo ocupa lugar;
 *  5. ⭐ a vaga ligada não deriva bloqueio próprio (quem fecha é o dia de jogo),
 *     e o conflito confere quadra a quadra;
 *  6. o espelho da vaga a partir do dia de jogo: só contas na lista, e
 *     "lotado" contando os convidados.
 */
import { describe, it, expect } from 'vitest';
import {
  normalizeOpenMatchInput, isLinkedOpenSlot, isOpenMatchGameDay, openSlotCourtIds,
  linkedOccupancy, canJoinLinkedGameDay, slotMirrorFromGameDay, openMatchGameSummary,
  suggestedCourtCount, openMatchFormatLabel, OPEN_MATCH_DEFAULT_TITLE,
} from './openMatchGameDay.js';
import { openSlotBlocks, openSlotConflict } from './openMatch.js';

const COURTS = [{ id: 'q1', name: 'Quadra 1' }, { id: 'q2', name: 'Quadra 2' }];
const base = {
  date: '2026-10-10', start: '19:00', end: '21:00', total_spots: 8, format: 'duplas',
  court_ids: ['q1', 'q2'], game_format: 'americano', min_level: 3, max_level: 4, price: 25,
};

describe('⭐ um formulário, duas metades que não discordam', () => {
  it('a vitrine e o dia de jogo saem dos mesmos campos', () => {
    const { valid, slot, gameDay } = normalizeOpenMatchInput(base, { courts: COURTS });
    expect(valid).toBe(true);
    expect(slot).toMatchObject({
      date: '2026-10-10', start: '19:00', end: '21:00', total_spots: 8,
      court_id: 'q1', court_ids: ['q1', 'q2'], court: 'Quadra 1, Quadra 2', min_level: 3, max_level: 4, price: 25,
    });
    expect(gameDay).toMatchObject({
      title: OPEN_MATCH_DEFAULT_TITLE, date: '2026-10-10', format: 'americano',
      signup_mode: 'day', capacity: 8, manage_mode: 'owner_only',
    });
    expect(gameDay.arena_slots).toEqual([
      { court_id: 'q1', court_name: 'Quadra 1', start_time: '19:00', end_time: '21:00', capacity: null },
      { court_id: 'q2', court_name: 'Quadra 2', start_time: '19:00', end_time: '21:00', capacity: null },
    ]);
  });

  it('título e quem conduz passam; quadra repetida conta uma vez', () => {
    const { gameDay, slot } = normalizeOpenMatchInput({
      ...base, title: '  Terça do Americano ', manage_mode: 'participants', court_ids: ['q1', 'q1'],
    }, { courts: COURTS });
    expect(gameDay.title).toBe('Terça do Americano');
    expect(gameDay.manage_mode).toBe('participants');
    expect(slot.court_ids).toEqual(['q1']);
  });

  it('⭐ sem quadra, não há dia de jogo', () => {
    const r = normalizeOpenMatchInput({ ...base, court_ids: [] }, { courts: COURTS });
    expect(r.valid).toBe(false);
    expect(r.errors.court_ids).toMatch(/pelo menos uma quadra/);
  });

  it('formato fora da lista oferecida é recusado', () => {
    const r = normalizeOpenMatchInput({ ...base, game_format: 'americano_live' }, {
      courts: COURTS, formats: ['americano', 'play'],
    });
    expect(r.valid).toBe(false);
    expect(r.errors.game_format).toBeTruthy();
  });

  it('as regras de sempre da vitrine continuam valendo', () => {
    const r = normalizeOpenMatchInput({ ...base, end: '18:00', total_spots: 1 }, { courts: COURTS });
    expect(r.errors.end).toBeTruthy();
    expect(r.errors.total_spots).toBeTruthy();
  });
});

describe('leituras', () => {
  it('ligado / não ligado', () => {
    expect(isLinkedOpenSlot({ game_day_id: 'gd1' })).toBe(true);
    expect(isLinkedOpenSlot({})).toBe(false);
    expect(isOpenMatchGameDay({ open_slot_id: 's1' })).toBe(true);
    expect(isOpenMatchGameDay({ arena_id: 'a' })).toBe(false);
  });

  it('as quadras: a vaga nova tem lista, a antiga tem uma', () => {
    expect(openSlotCourtIds({ court_ids: ['q1', 'q2', 'q1'] })).toEqual(['q1', 'q2']);
    expect(openSlotCourtIds({ court_id: 'q9' })).toEqual(['q9']);
    expect(openSlotCourtIds({})).toEqual([]);
  });

  it('quadras sugeridas para as vagas', () => {
    expect(suggestedCourtCount(4)).toBe(1);
    expect(suggestedCourtCount(8)).toBe(2);
    expect(suggestedCourtCount(10)).toBe(3);
  });

  it('o resumo de uma linha', () => {
    expect(openMatchGameSummary({ format: 'americano_live', arena_slots: [{}, {}], manage_mode: 'owner_only' }))
      .toBe('Americano aprimorado · 2 quadras · a arena conduz');
    expect(openMatchFormatLabel('play')).toBe('Play');
  });
});

describe('⭐ quem ocupa lugar', () => {
  const slot = { total_spots: 4, participants: ['a', 'b', 'c'], status: 'open' };

  it('o convidado do dia de jogo ocupa lugar', () => {
    const noDia = [{ user_id: 'a' }, { user_id: 'b' }, { user_id: 'c' }, { user_id: null, name: 'Convidado' }];
    expect(linkedOccupancy(slot, noDia)).toMatchObject({ usados: 4, livres: 0, cheio: true });
    expect(canJoinLinkedGameDay({ slot, gameDay: { status: 'active' }, participants: noDia, uid: 'z' }))
      .toEqual({ ok: false, reason: 'As vagas deste jogo acabaram.' });
  });

  it('com lugar, entra; quem já está no dia (inserido pela arena) entra na vitrine', () => {
    const noDia = [{ user_id: 'a' }, { user_id: 'b' }, { user_id: 'c' }];
    expect(canJoinLinkedGameDay({ slot, gameDay: { status: 'active' }, participants: noDia, uid: 'z' }).ok).toBe(true);
    const cheia = { total_spots: 3, participants: ['a', 'b'], status: 'open' };
    expect(canJoinLinkedGameDay({
      slot: cheia, gameDay: {}, participants: [{ user_id: 'a' }, { user_id: 'b' }, { user_id: 'z' }], uid: 'z',
    }).ok).toBe(true);
  });

  it('dia de jogo encerrado ou sumido não recebe ninguém', () => {
    expect(canJoinLinkedGameDay({ slot, gameDay: { status: 'archived' }, participants: [], uid: 'z' }).ok).toBe(false);
    expect(canJoinLinkedGameDay({ slot, gameDay: null, participants: [], uid: 'z' }).ok).toBe(false);
  });

  it('o espelho da vaga: só contas na lista; "lotado" conta os convidados', () => {
    const r = slotMirrorFromGameDay({ total_spots: 4 }, [
      { user_id: 'a' }, { user_id: 'b' }, { user_id: 'b' }, { user_id: null }, { user_id: null },
    ]);
    expect(r).toEqual({ participants: ['a', 'b'], filled_spots: 2, status: 'full' });
    expect(slotMirrorFromGameDay({ total_spots: 4 }, [{ user_id: 'a' }]).status).toBe('open');
  });
});

describe('⭐ a quadra: quem fecha é o dia de jogo', () => {
  const vaga = { id: 's1', arena_id: 'A', court_id: 'q1', date: '2026-10-10', start: '19:00', end: '21:00', status: 'open' };

  it('vaga ligada não deriva bloqueio próprio (senão seriam dois no mesmo horário)', () => {
    expect(openSlotBlocks([vaga])).toHaveLength(1);
    expect(openSlotBlocks([{ ...vaga, game_day_id: 'gd1' }])).toHaveLength(0);
  });

  it('o conflito confere quadra a quadra', () => {
    const blocos = [{ court_id: 'q2', date: '2026-10-10', start_time: '20:00', end_time: '22:00', source: 'game_day' }];
    const r = openSlotConflict({ ...vaga, court_ids: ['q1', 'q2'] }, blocos, []);
    expect(r).toEqual({ hasConflict: true, reason: 'Já existe um dia de jogo nesta quadra e horário.' });
    expect(openSlotConflict({ ...vaga, court_ids: ['q1'] }, blocos, []).hasConflict).toBe(false);
  });
});
