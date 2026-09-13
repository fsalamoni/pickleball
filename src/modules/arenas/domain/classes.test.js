import { describe, it, expect } from 'vitest';
import {
  COACH_LEVEL, CLASS_FORMAT, CLASS_STATUS,
  normalizeCoachInput, normalizeClassInput, calculateCommission,
} from './classes.js';

describe('normalizeCoachInput', () => {
  it('aceita coach válido', () => {
    const r = normalizeCoachInput({ name: 'João', level: 'pro', price_per_hour: 200 });
    expect(r.valid).toBe(true);
    expect(r.value.name).toBe('João');
    expect(r.value.level).toBe('pro');
  });
  it('rejeita sem nome', () => {
    expect(normalizeCoachInput({}).valid).toBe(false);
  });
  it('default intermediate', () => {
    const r = normalizeCoachInput({ name: 'X' });
    expect(r.value.level).toBe('intermediate');
  });
});

describe('normalizeClassInput', () => {
  it('aceita aula válida', () => {
    const r = normalizeClassInput({
      date: '2026-07-20', start: '19:00', end: '21:00',
      max_students: 6, price: 100, format: 'group',
    });
    expect(r.valid).toBe(true);
  });
  it('rejeita data inválida', () => {
    expect(normalizeClassInput({ date: 'xx', start: '19:00', end: '21:00' }).valid).toBe(false);
  });
  it('rejeita max_students fora do range', () => {
    expect(normalizeClassInput({ date: '2026-07-20', start: '19:00', end: '21:00', max_students: 0 }).valid).toBe(false);
    expect(normalizeClassInput({ date: '2026-07-20', start: '19:00', end: '21:00', max_students: 100 }).valid).toBe(false);
  });
});

describe('calculateCommission', () => {
  it('50%', () => {
    expect(calculateCommission(200, 50)).toBe(100);
  });
  it('0%', () => {
    expect(calculateCommission(200, 0)).toBe(0);
  });
  it('100%', () => {
    expect(calculateCommission(200, 100)).toBe(200);
  });
  it('rejeita pct inválido', () => {
    expect(calculateCommission(200, 150)).toBe(0);
  });
});

/* ================================================================== */
/*  Onda 5 — a aula ocupa a quadra, tem professor e divide o dinheiro  */
/* ================================================================== */

import {
  CLASS_PACKAGE_MAX, DEFAULT_ARENA_COMMISSION_PCT,
  classBlocks, classPackageLeft, classPackagePrice, classSeatsLeft, classSplit,
  isClassOpen, mergeClassBlocks,
} from './classes.js';

const aula = (over = {}) => ({
  id: 'c1', arena_id: 'a1', court_id: 'q1', date: '2026-10-01',
  start: '19:00', end: '20:00', status: 'scheduled', ...over,
});

describe('⭐ classBlocks — a aula OCUPA a quadra', () => {
  it('vira um bloqueio no formato de arena_unavailabilities', () => {
    const b = classBlocks([aula({ coach_name: 'Rafa' })]);
    expect(b).toHaveLength(1);
    expect(b[0]).toMatchObject({
      arena_id: 'a1', court_id: 'q1', date: '2026-10-01',
      start_time: '19:00', end_time: '20:00', source: 'class', class_id: 'c1',
    });
    expect(b[0].derivado).toBe(true);
  });

  it('⭐ aula SEM quadra não bloqueia nada', () => {
    // A arena pode registrar aula que acontece fora da quadra; fechar uma
    // quadra por causa dela seria inventar ocupação.
    expect(classBlocks([aula({ court_id: null })])).toEqual([]);
  });

  it('⭐ aula cancelada devolve a quadra', () => {
    expect(classBlocks([aula({ status: 'cancelled' })])).toEqual([]);
  });

  it('aula já dada também não ocupa mais', () => {
    expect(classBlocks([aula({ status: 'completed' })])).toEqual([]);
  });

  it('o nome do professor explica o horário fechado', () => {
    expect(classBlocks([aula({ coach_name: 'Rafa' })])[0].notes).toBe('Aula com Rafa');
    expect(classBlocks([aula()])[0].notes).toBe('Aula');
  });

  it('⭐ nome de ALUNO nunca entra no bloqueio (que é público)', () => {
    const b = classBlocks([aula({ coach_name: 'Rafa', students: ['Maria Silva'], notes: 'segredo' })]);
    expect(JSON.stringify(b)).not.toContain('Maria');
    expect(JSON.stringify(b)).not.toContain('segredo');
  });

  it('aula sem horário completo não vira bloqueio pela metade', () => {
    expect(classBlocks([aula({ end: null })])).toEqual([]);
  });
});

describe('mergeClassBlocks', () => {
  it('acrescenta os derivados aos gravados', () => {
    const gravados = [{ id: 'u1', date: '2026-10-01', court_id: 'q2', start_time: '08:00', end_time: '10:00' }];
    expect(mergeClassBlocks(gravados, [aula()])).toHaveLength(2);
  });

  it('⭐ não duplica o que já está gravado com o mesmo class_id', () => {
    const gravados = [{
      id: 'u1', class_id: 'c1', court_id: 'q1', date: '2026-10-01',
      start_time: '19:00', end_time: '20:00',
    }];
    expect(mergeClassBlocks(gravados, [aula()])).toHaveLength(1);
  });

  it('sem aulas, devolve exatamente a mesma lista', () => {
    const gravados = [{ id: 'u1' }];
    expect(mergeClassBlocks(gravados, [])).toBe(gravados);
  });
});

describe('classSeatsLeft e isClassOpen', () => {
  it('conta as vagas que sobram', () => {
    expect(classSeatsLeft({ max_students: 4, enrolled: 3 })).toBe(1);
  });
  it('nunca devolve negativo, mesmo com dado torto', () => {
    expect(classSeatsLeft({ max_students: 2, enrolled: 5 })).toBe(0);
  });
  it('aula sem status é uma aula marcada', () => {
    expect(isClassOpen({})).toBe(true);
  });
});

describe('⭐ classSplit — a comissão vem da CONFIGURAÇÃO, não do código', () => {
  it('divide pelo percentual informado', () => {
    expect(classSplit(100, { commissionPct: 20 })).toEqual({
      total: 100, arena: 20, coach: 80, pct: 20,
    });
  });

  it('⭐ professor da CASA não paga comissão', () => {
    // Cobrar comissão de si mesma faria o relatório da arena mentir.
    expect(classSplit(100, { commissionPct: 20, partner: false })).toEqual({
      total: 100, arena: 0, coach: 100, pct: 0,
    });
  });

  it('o padrão é 20%, não os 50% que estavam escritos no serviço', () => {
    expect(DEFAULT_ARENA_COMMISSION_PCT).toBe(20);
    expect(classSplit(100).arena).toBe(20);
  });

  it('não deixa a arena ficar com tudo', () => {
    expect(classSplit(100, { commissionPct: 200 }).pct).toBe(90);
  });

  it('percentual negativo vira zero', () => {
    expect(classSplit(100, { commissionPct: -50 }).arena).toBe(0);
  });

  it('aula de graça divide zero, sem NaN', () => {
    expect(classSplit(0)).toEqual({ total: 0, arena: 0, coach: 0, pct: 20 });
  });
});

describe('pacote de aulas', () => {
  it('⭐ mostra o preço POR AULA, que é o argumento de venda', () => {
    const p = classPackagePrice({ sessions: 4, price: 360, single_price: 110 });
    expect(p.perSession).toBe(90);
    expect(p.savingPct).toBe(18);
  });

  it('sem preço avulso para comparar, não inventa desconto', () => {
    expect(classPackagePrice({ sessions: 4, price: 360 }).savingPct).toBe(0);
  });

  it('pacote mais caro que o avulso não vira desconto negativo', () => {
    expect(classPackagePrice({ sessions: 2, price: 300, single_price: 100 }).savingPct).toBe(0);
  });

  it(`o pacote não passa de ${CLASS_PACKAGE_MAX} aulas`, () => {
    expect(classPackagePrice({ sessions: 100, price: 1000 }).sessions).toBe(CLASS_PACKAGE_MAX);
  });

  it('saldo do pacote nunca fica negativo', () => {
    expect(classPackageLeft({ sessions: 4, sessions_used: 9 })).toBe(0);
    expect(classPackageLeft({ sessions: 4, sessions_used: 1 })).toBe(3);
  });
});

describe('normalizeClassInput — o que faltava', () => {
  it('⭐ guarda o professor e a quadra', () => {
    const { value } = normalizeClassInput({
      date: '2026-10-01', start: '19:00', end: '20:00', max_students: 4,
      coach_id: 'p1', coach_name: 'Rafa', court_id: 'q1',
    });
    expect(value.coach_id).toBe('p1');
    expect(value.coach_name).toBe('Rafa');
    expect(value.court_id).toBe('q1');
  });

  it('⭐ recusa aula que termina antes de começar', () => {
    const r = normalizeClassInput({
      date: '2026-10-01', start: '20:00', end: '19:00', max_students: 4,
    });
    expect(r.valid).toBe(false);
  });

  it('quadra vazia vira null, não string vazia', () => {
    const { value } = normalizeClassInput({
      date: '2026-10-01', start: '19:00', end: '20:00', max_students: 4, court_id: '   ',
    });
    expect(value.court_id).toBeNull();
  });

  it('preserva o status ao editar (editar não ressuscita aula cancelada)', () => {
    const { value } = normalizeClassInput({
      date: '2026-10-01', start: '19:00', end: '20:00', max_students: 4, status: 'cancelled',
    });
    expect(value.status).toBe('cancelled');
  });
});

describe('normalizeCoachInput — o vínculo com a conta', () => {
  it('⭐ guarda o user_id, que é o que faz o professor ver a agenda dele', () => {
    expect(normalizeCoachInput({ name: 'Rafa', user_id: 'u9' }).value.user_id).toBe('u9');
  });
  it('sem vínculo, fica null e o cadastro continua valendo', () => {
    expect(normalizeCoachInput({ name: 'Rafa' }).value.user_id).toBeNull();
  });
  it('parceiro é opt-in — o padrão é professor da casa', () => {
    expect(normalizeCoachInput({ name: 'Rafa' }).value.partner).toBe(false);
  });
});
