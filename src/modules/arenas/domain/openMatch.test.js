import { describe, it, expect } from 'vitest';
import {
  OPEN_SLOT_STATUS,
  OPEN_SLOT_FORMATS,
  isSlotOpenForJoin,
  slotStartMs,
  getAvailableSpots,
  getSlotFillPct,
  canJoinOpenSlot,
  normalizeOpenSlotInput,
  computeSlotStatus,
  isSlotFinished,
  openSlotBlocks,
  mergeOpenSlotBlocks,
  openSlotConflict,
  slotLevelRangeLabel,
  slotLevelFit,
} from './openMatch.js';

const now = new Date('2026-07-15T10:00:00Z');

describe('OPEN_SLOT_FORMATS', () => {
  it('inclui os formatos principais', () => {
    expect(OPEN_SLOT_FORMATS).toContain('simples');
    expect(OPEN_SLOT_FORMATS).toContain('duplas');
    expect(OPEN_SLOT_FORMATS).toContain('mistas');
    expect(OPEN_SLOT_FORMATS).toContain('open');
    expect(OPEN_SLOT_FORMATS).toContain('treino');
  });
});

describe('slotStartMs', () => {
  it('extrai de date+start', () => {
    const ms = slotStartMs({ date: '2026-07-20', start: '19:00' });
    expect(ms).toBe(new Date('2026-07-20T19:00:00').getTime());
  });
  it('usa start_at se fornecido', () => {
    const dt = new Date('2026-07-20T19:00:00Z');
    const ms = slotStartMs({ start_at: dt });
    expect(ms).toBe(dt.getTime());
  });
  it('usa start_ms se fornecido', () => {
    const ms = slotStartMs({ start_ms: 1234567890 });
    expect(ms).toBe(1234567890);
  });
  it('retorna NaN para slot inválido', () => {
    expect(slotStartMs({})).toBeNaN();
    expect(slotStartMs(null)).toBeNaN();
  });
});

describe('isSlotOpenForJoin', () => {
  it('slot futuro com status open é aberto', () => {
    const slot = { date: '2026-07-20', start: '19:00', end: '21:00', status: 'open', total_spots: 4 };
    expect(isSlotOpenForJoin(slot, now)).toBe(true);
  });
  it('slot cancelado não é aberto', () => {
    const slot = { date: '2026-07-20', start: '19:00', end: '21:00', status: 'cancelled', total_spots: 4 };
    expect(isSlotOpenForJoin(slot, now)).toBe(false);
  });
  it('slot no passado não é aberto', () => {
    const slot = { date: '2026-07-14', start: '10:00', end: '12:00', status: 'open', total_spots: 4 };
    expect(isSlotOpenForJoin(slot, now)).toBe(false);
  });
  it('slot sem data não é aberto', () => {
    expect(isSlotOpenForJoin({}, now)).toBe(false);
    expect(isSlotOpenForJoin(null, now)).toBe(false);
  });
});

describe('getAvailableSpots', () => {
  it('calcula corretamente com array de participants', () => {
    const slot = { total_spots: 4, participants: ['u1', 'u2'] };
    expect(getAvailableSpots(slot)).toBe(2);
  });
  it('calcula corretamente com filled_spots', () => {
    const slot = { total_spots: 4, filled_spots: 3 };
    expect(getAvailableSpots(slot)).toBe(1);
  });
  it('retorna 0 se lotado', () => {
    const slot = { total_spots: 4, participants: ['u1', 'u2', 'u3', 'u4'] };
    expect(getAvailableSpots(slot)).toBe(0);
  });
  it('retorna 0 se slot inválido', () => {
    expect(getAvailableSpots(null)).toBe(0);
  });
});

describe('getSlotFillPct', () => {
  it('calcula % corretamente', () => {
    const slot = { total_spots: 4, participants: ['u1'] };
    expect(getSlotFillPct(slot)).toBe(25);
  });
  it('retorna 100 se lotado', () => {
    const slot = { total_spots: 4, participants: ['u1', 'u2', 'u3', 'u4'] };
    expect(getSlotFillPct(slot)).toBe(100);
  });
  it('retorna 0 se total é 0', () => {
    expect(getSlotFillPct({ total_spots: 0 })).toBe(0);
  });
});

describe('canJoinOpenSlot', () => {
  const baseSlot = { date: '2026-07-20', start: '19:00', end: '21:00', status: 'open', total_spots: 4, participants: [] };
  const baseUser = { uid: 'u1' };

  it('permite entrar com user válido', () => {
    const r = canJoinOpenSlot(baseSlot, baseUser, { level: 3 }, now);
    expect(r.ok).toBe(true);
  });
  it('rejeita sem user', () => {
    const r = canJoinOpenSlot(baseSlot, null, null, now);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('login');
  });
  it('rejeita se já inscrito', () => {
    const r = canJoinOpenSlot({ ...baseSlot, participants: ['u1'] }, baseUser, null, now);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('já está inscrito');
  });
  it('rejeita se lotado', () => {
    const slot = { ...baseSlot, participants: ['a', 'b', 'c', 'd'] };
    const r = canJoinOpenSlot(slot, baseUser, null, now);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('vagas');
  });
  it('rejeita se cancelado', () => {
    const slot = { ...baseSlot, status: 'cancelled' };
    const r = canJoinOpenSlot(slot, baseUser, null, now);
    expect(r.ok).toBe(false);
  });
  it('rejeita se nível abaixo do mínimo, dizendo os DOIS números', () => {
    const slot = { ...baseSlot, min_level: 4 };
    const r = canJoinOpenSlot(slot, baseUser, { level: 2 }, now);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('4.0');
    expect(r.reason).toContain('2.0');
  });
  it('rejeita se nível acima do máximo, dizendo os DOIS números', () => {
    const slot = { ...baseSlot, max_level: 2 };
    const r = canJoinOpenSlot(slot, baseUser, { level: 4 }, now);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('2.0');
    expect(r.reason).toContain('4.0');
  });
  it('⭐ sem nível conhecido, a peneira NÃO barra', () => {
    const slot = { ...baseSlot, min_level: 4, max_level: 5 };
    expect(canJoinOpenSlot(slot, baseUser, null, now).ok).toBe(true);
    expect(canJoinOpenSlot(slot, baseUser, { level: null }, now).ok).toBe(true);
  });
  it('aceita se nível dentro da faixa', () => {
    const slot = { ...baseSlot, min_level: 2, max_level: 4 };
    const r = canJoinOpenSlot(slot, baseUser, { level: 3 }, now);
    expect(r.ok).toBe(true);
  });
});

describe('normalizeOpenSlotInput', () => {
  it('aceita input válido', () => {
    const r = normalizeOpenSlotInput({
      date: '2026-07-20',
      start: '19:00',
      end: '21:00',
      total_spots: 4,
      format: 'duplas',
    });
    expect(r.valid).toBe(true);
    expect(r.value.date).toBe('2026-07-20');
    expect(r.value.total_spots).toBe(4);
  });
  it('rejeita data inválida', () => {
    const r = normalizeOpenSlotInput({ date: 'xx', start: '19:00', end: '21:00', total_spots: 4 });
    expect(r.valid).toBe(false);
    expect(r.errors.date).toBeTruthy();
  });
  it('rejeita end <= start', () => {
    const r = normalizeOpenSlotInput({ date: '2026-07-20', start: '21:00', end: '19:00', total_spots: 4 });
    expect(r.valid).toBe(false);
  });
  it('rejeita total_spots fora de 2-20', () => {
    const r1 = normalizeOpenSlotInput({ date: '2026-07-20', start: '19:00', end: '21:00', total_spots: 1 });
    const r2 = normalizeOpenSlotInput({ date: '2026-07-20', start: '19:00', end: '21:00', total_spots: 25 });
    expect(r1.valid).toBe(false);
    expect(r2.valid).toBe(false);
  });
  it('rejeita formato desconhecido', () => {
    const r = normalizeOpenSlotInput({ date: '2026-07-20', start: '19:00', end: '21:00', total_spots: 4, format: 'foo' });
    expect(r.valid).toBe(false);
  });
  it('aceita min/max level opcionais', () => {
    const r = normalizeOpenSlotInput({
      date: '2026-07-20', start: '19:00', end: '21:00', total_spots: 4,
      min_level: 2, max_level: 4,
    });
    expect(r.valid).toBe(true);
    expect(r.value.min_level).toBe(2);
    expect(r.value.max_level).toBe(4);
  });
  it('rejeita max_level < min_level', () => {
    const r = normalizeOpenSlotInput({
      date: '2026-07-20', start: '19:00', end: '21:00', total_spots: 4,
      min_level: 4, max_level: 2,
    });
    expect(r.valid).toBe(false);
  });
  it('⭐ o nível vive na régua única: aceita 2.0–8.0 e recusa fora dela', () => {
    const base = { date: '2026-07-20', start: '19:00', end: '21:00', total_spots: 4 };
    expect(normalizeOpenSlotInput({ ...base, min_level: 2, max_level: 8 }).valid).toBe(true);
    expect(normalizeOpenSlotInput({ ...base, min_level: 3.5 }).value.min_level).toBe(3.5);
    // 1.5 e 10 estão fora da régua da plataforma.
    expect(normalizeOpenSlotInput({ ...base, min_level: 1.5 }).valid).toBe(false);
    expect(normalizeOpenSlotInput({ ...base, min_level: 10 }).valid).toBe(false);
  });

  it('guarda o court_id quando a arena escolhe a quadra', () => {
    const r = normalizeOpenSlotInput({
      date: '2026-07-20', start: '19:00', end: '21:00', total_spots: 4, court_id: 'q1',
    });
    expect(r.value.court_id).toBe('q1');
  });

  it('sem quadra escolhida, court_id é null (não string vazia)', () => {
    const r = normalizeOpenSlotInput({
      date: '2026-07-20', start: '19:00', end: '21:00', total_spots: 4,
    });
    expect(r.value.court_id).toBeNull();
  });
});

describe('computeSlotStatus', () => {
  it('retorna open se tem vagas', () => {
    expect(computeSlotStatus({ total_spots: 4, participants: [], status: 'open' })).toBe('open');
  });
  it('retorna full se lotado', () => {
    expect(computeSlotStatus({ total_spots: 2, participants: ['a', 'b'], status: 'open' })).toBe('full');
  });
  it('respeita cancelled', () => {
    expect(computeSlotStatus({ status: 'cancelled' })).toBe('cancelled');
  });
});

describe('isSlotFinished', () => {
  it('true se end_ms < now', () => {
    expect(isSlotFinished({ date: '2026-07-14', end: '21:00' }, now)).toBe(true);
  });
  it('false se end_ms > now', () => {
    expect(isSlotFinished({ date: '2026-07-20', end: '21:00' }, now)).toBe(false);
  });
  it('false se slot inválido', () => {
    expect(isSlotFinished(null, now)).toBe(false);
  });
});

/* ================================================================== */
/*  A vaga aberta OCUPA a quadra                                       */
/* ================================================================== */

describe('openSlotBlocks — a vaga fecha a quadra', () => {
  const vaga = (over = {}) => ({
    id: 'v1', arena_id: 'a1', court_id: 'q1', date: '2026-07-20',
    start: '19:00', end: '21:00', status: 'open', format: 'duplas', ...over,
  });

  it('deriva um bloqueio no formato de arena_unavailabilities', () => {
    const [b] = openSlotBlocks([vaga()]);
    expect(b).toMatchObject({
      arena_id: 'a1', court_id: 'q1', date: '2026-07-20',
      start_time: '19:00', end_time: '21:00',
      source: 'open_match', open_slot_id: 'v1', derivado: true,
    });
  });

  it('⭐ vaga sem quadra escolhida NÃO bloqueia (não dá para saber qual)', () => {
    expect(openSlotBlocks([vaga({ court_id: null })])).toEqual([]);
  });

  it('vaga cancelada não bloqueia mais', () => {
    expect(openSlotBlocks([vaga({ status: 'cancelled' })])).toEqual([]);
  });

  it('vaga LOTADA continua bloqueando — a quadra segue ocupada', () => {
    expect(openSlotBlocks([vaga({ status: 'full' })])).toHaveLength(1);
  });

  it('entrada inválida não quebra', () => {
    expect(openSlotBlocks(null)).toEqual([]);
    expect(openSlotBlocks([null, undefined, {}])).toEqual([]);
  });
});

describe('mergeOpenSlotBlocks', () => {
  const vaga = { id: 'v1', arena_id: 'a1', court_id: 'q1', date: '2026-07-20', start: '19:00', end: '21:00', status: 'open' };

  it('soma o derivado aos bloqueios que já existiam', () => {
    const gravado = { id: 'u1', arena_id: 'a1', court_id: 'q2', date: '2026-07-20', start_time: '08:00', end_time: '09:00' };
    const out = mergeOpenSlotBlocks([gravado], [vaga]);
    expect(out).toHaveLength(2);
    expect(out[0]).toBe(gravado);
  });

  it('não duplica o que já estiver gravado com o mesmo open_slot_id', () => {
    const gravado = {
      id: 'u1', arena_id: 'a1', court_id: 'q1', date: '2026-07-20',
      start_time: '19:00', end_time: '21:00', open_slot_id: 'v1',
    };
    expect(mergeOpenSlotBlocks([gravado], [vaga])).toHaveLength(1);
  });

  it('sem vagas, devolve a MESMA lista (sem copiar à toa)', () => {
    const base = [{ id: 'u1' }];
    expect(mergeOpenSlotBlocks(base, [])).toBe(base);
  });
});

describe('openSlotConflict — a arena não publica em cima do que já existe', () => {
  const vaga = { court_id: 'q1', date: '2026-07-20', start: '19:00', end: '21:00' };

  it('quadra livre: sem conflito', () => {
    expect(openSlotConflict(vaga, [], []).hasConflict).toBe(false);
  });

  it('em cima de um dia de jogo: recusa dizendo o motivo', () => {
    const blocos = [{ date: '2026-07-20', court_id: 'q1', start_time: '18:00', end_time: '22:00', source: 'game_day' }];
    const r = openSlotConflict(vaga, blocos, []);
    expect(r.hasConflict).toBe(true);
    expect(r.reason).toMatch(/dia de jogo/i);
  });

  it('em cima de outro jogo aberto: recusa', () => {
    const blocos = [{ date: '2026-07-20', court_id: 'q1', start_time: '20:00', end_time: '22:00', source: 'open_match' }];
    expect(openSlotConflict(vaga, blocos, []).reason).toMatch(/jogo aberto/i);
  });

  it('em cima de uma reserva: recusa', () => {
    const reservas = [{ court_id: 'q1', date: '2026-07-20', start: '20:00', end: '21:00' }];
    expect(openSlotConflict(vaga, [], reservas).reason).toMatch(/reserva/i);
  });

  it('⭐ ENCOSTAR não é sobrepor', () => {
    const blocos = [{ date: '2026-07-20', court_id: 'q1', start_time: '21:00', end_time: '23:00' }];
    expect(openSlotConflict(vaga, blocos, []).hasConflict).toBe(false);
    const antes = [{ date: '2026-07-20', court_id: 'q1', start_time: '17:00', end_time: '19:00' }];
    expect(openSlotConflict(vaga, antes, []).hasConflict).toBe(false);
  });

  it('outra quadra não conflita', () => {
    const blocos = [{ date: '2026-07-20', court_id: 'q2', start_time: '18:00', end_time: '22:00' }];
    expect(openSlotConflict(vaga, blocos, []).hasConflict).toBe(false);
  });

  it('bloqueio SEM quadra fecha a arena inteira', () => {
    const blocos = [{ date: '2026-07-20', court_id: null, start_time: '18:00', end_time: '22:00' }];
    expect(openSlotConflict(vaga, blocos, []).hasConflict).toBe(true);
  });

  it('outro dia não conflita', () => {
    const blocos = [{ date: '2026-07-21', court_id: 'q1', start_time: '18:00', end_time: '22:00' }];
    expect(openSlotConflict(vaga, blocos, []).hasConflict).toBe(false);
  });

  it('vaga sem quadra escolhida não é conferida (não há o que conferir)', () => {
    const blocos = [{ date: '2026-07-20', court_id: 'q1', start_time: '18:00', end_time: '22:00' }];
    expect(openSlotConflict({ ...vaga, court_id: null }, blocos, []).hasConflict).toBe(false);
  });
});

describe('slotLevelRangeLabel', () => {
  it('escreve a faixa em português, com uma casa', () => {
    expect(slotLevelRangeLabel({ min_level: 3, max_level: 4 })).toBe('3.0 a 4.0');
    expect(slotLevelRangeLabel({ min_level: 3 })).toBe('a partir de 3.0');
    expect(slotLevelRangeLabel({ max_level: 4 })).toBe('até 4.0');
  });

  it('sem faixa, devolve null (a vaga é aberta a todos)', () => {
    expect(slotLevelRangeLabel({})).toBeNull();
    expect(slotLevelRangeLabel(null)).toBeNull();
  });

  it('número fora da régua é ignorado', () => {
    expect(slotLevelRangeLabel({ min_level: 0, max_level: 99 })).toBeNull();
  });
});
