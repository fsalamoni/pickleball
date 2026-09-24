import { describe, it, expect } from 'vitest';
import {
  AGENDA_ROLE, splitClassAgenda, nextOpenClasses, enrollmentRows, taughtClassRows,
} from './classAgenda.js';
import { commissionPctFrom, DEFAULT_ARENA_COMMISSION_PCT } from './classes.js';

const HOJE = '2026-09-24';
const aula = (id, date, over = {}) => ({
  id, arena_id: 'a1', date, start: '19:00', end: '20:00', status: 'scheduled', coach_id: 'c1', ...over,
});

describe('splitClassAgenda — a arena', () => {
  const aulas = [
    aula('ontem', '2026-09-23'),
    aula('dada', '2026-09-20', { status: 'completed' }),
    aula('amanha', '2026-09-25'),
    aula('cancelada', '2026-09-26', { status: 'cancelled' }),
    aula('hoje', HOJE, { start: '08:00' }),
  ];

  it('⭐ a aula DADA continua na lista (é onde se registra o pagamento)', () => {
    const { passadas } = splitClassAgenda(aulas, { hoje: HOJE, role: AGENDA_ROLE.ARENA });
    expect(passadas.map((a) => a.id)).toEqual(['ontem', 'dada']);
  });

  it('hoje conta como próxima, e a ordem é do mais cedo ao mais tarde', () => {
    const { futuras } = splitClassAgenda(aulas, { hoje: HOJE, role: AGENDA_ROLE.ARENA });
    expect(futuras.map((a) => a.id)).toEqual(['hoje', 'amanha', 'cancelada']);
  });
});

describe('splitClassAgenda — o professor', () => {
  it('vê só as DELE', () => {
    const { futuras } = splitClassAgenda(
      [aula('minha', '2026-09-25'), aula('outra', '2026-09-25', { coach_id: 'c2' })],
      { hoje: HOJE, role: AGENDA_ROLE.COACH, coachId: 'c1' },
    );
    expect(futuras.map((a) => a.id)).toEqual(['minha']);
  });

  it('sem cadastro de professor, não vê nada (nunca a agenda inteira)', () => {
    const r = splitClassAgenda([aula('x', '2026-09-25')], { hoje: HOJE, role: AGENDA_ROLE.COACH, coachId: null });
    expect(r.futuras).toEqual([]);
  });
});

describe('splitClassAgenda — o atleta', () => {
  const aulas = [
    aula('aberta', '2026-09-25'),
    aula('cancelada-minha', '2026-09-26', { status: 'cancelled' }),
    aula('cancelada-alheia', '2026-09-26', { status: 'cancelled' }),
    aula('passada-minha', '2026-09-10'),
    aula('passada-alheia', '2026-09-11'),
  ];
  const r = splitClassAgenda(aulas, {
    hoje: HOJE, role: AGENDA_ROLE.ATHLETE, myClassIds: ['cancelada-minha', 'passada-minha'],
  });

  it('⭐ a aula cancelada em que ele estava aparece — o aviso de cancelamento leva até ela', () => {
    expect(r.futuras.map((a) => a.id)).toEqual(['aberta', 'cancelada-minha']);
  });

  it('a cancelada de outros não aparece: não é assunto dele', () => {
    expect(r.futuras.map((a) => a.id)).not.toContain('cancelada-alheia');
  });

  it('as passadas são o histórico DELE, não a agenda da arena', () => {
    expect(r.passadas.map((a) => a.id)).toEqual(['passada-minha']);
  });

  it('aceita Set ou lista', () => {
    const comSet = splitClassAgenda(aulas, { hoje: HOJE, myClassIds: new Set(['passada-minha']) });
    expect(comSet.passadas).toHaveLength(1);
  });
});

describe('nextOpenClasses — a vitrine da página da arena', () => {
  it('só abertas, de hoje em diante, as mais próximas primeiro', () => {
    const r = nextOpenClasses([
      aula('d3', '2026-09-28'),
      aula('passou', '2026-09-01'),
      aula('cancelada', '2026-09-25', { status: 'cancelled' }),
      aula('d1', '2026-09-25'),
      aula('d2', '2026-09-26'),
      aula('d4', '2026-09-29'),
    ], { hoje: HOJE, limit: 3 });
    expect(r.map((a) => a.id)).toEqual(['d1', 'd2', 'd3']);
  });

  it('lista vazia não quebra', () => {
    expect(nextOpenClasses(undefined, { hoje: HOJE })).toEqual([]);
  });
});

describe('enrollmentRows — "minhas aulas" em todas as arenas', () => {
  const aulas = new Map([
    ['k1', aula('k1', '2026-09-30')],
    ['k2', aula('k2', '2026-09-25', { arena_id: 'a2' })],
    ['k3', aula('k3', '2026-09-01', { status: 'completed' })],
    ['k4', aula('k4', '2026-09-27', { status: 'cancelled' })],
  ]);
  const arenas = new Map([['a1', { name: 'Arena Um' }], ['a2', { name: 'Arena Dois' }]]);
  const bookings = ['k1', 'k2', 'k3', 'k4', 'sumiu'].map((c) => ({ id: `b_${c}`, class_id: c, arena_id: 'a1' }));
  const rows = enrollmentRows(bookings, aulas, arenas, HOJE);

  it('⭐ a próxima vem primeiro; as passadas depois', () => {
    expect(rows.map((r) => r.aula.id)).toEqual(['k2', 'k4', 'k1', 'k3']);
  });

  it('matrícula de aula apagada sai da lista', () => {
    expect(rows.some((r) => r.booking.class_id === 'sumiu')).toBe(false);
  });

  it('diz o nome da arena e o estado da aula', () => {
    expect(rows[0]).toMatchObject({ arenaId: 'a2', arenaName: 'Arena Dois', upcoming: true });
    expect(rows.find((r) => r.aula.id === 'k4').cancelled).toBe(true);
    expect(rows.find((r) => r.aula.id === 'k3').given).toBe(true);
  });
});

describe('taughtClassRows — a agenda do professor nas arenas', () => {
  const perfis = [{ id: 'c1', arena_id: 'a1' }, { id: 'c9', arena_id: 'a2' }];
  const porPerfil = new Map([
    ['c1', [aula('x1', '2026-09-26'), aula('x2', '2026-09-02', { status: 'completed' })]],
    ['c9', [aula('y1', '2026-09-25', { arena_id: 'a2' }), aula('y2', '2026-09-27', { status: 'cancelled' })]],
  ]);
  const r = taughtClassRows(perfis, porPerfil, new Map([['a2', { name: 'Arena Dois' }]]), HOJE);

  it('junta as arenas e ordena as próximas pela data', () => {
    expect(r.proximas.map((l) => l.aula.id)).toEqual(['y1', 'x1']);
  });

  it('a cancelada não ocupa a agenda do professor', () => {
    expect(r.proximas.some((l) => l.aula.id === 'y2')).toBe(false);
  });

  it('as passadas trazem o que ele já deu', () => {
    expect(r.passadas.map((l) => l.aula.id)).toEqual(['x2']);
    expect(r.proximas[0].arenaName).toBe('Arena Dois');
    expect(r.proximas[1].arenaName).toBe('Arena');
  });
});

describe('🐞 commissionPctFrom — zero é um valor, não "vazio"', () => {
  it('⭐ a arena que configurou 0% não cobra comissão', () => {
    expect(commissionPctFrom({ commission_pct: 0 })).toBe(0);
    expect(commissionPctFrom({ commission_pct: '0' })).toBe(0);
  });
  it('ausente ou inválido vale o padrão', () => {
    expect(commissionPctFrom(undefined)).toBe(DEFAULT_ARENA_COMMISSION_PCT);
    expect(commissionPctFrom({})).toBe(DEFAULT_ARENA_COMMISSION_PCT);
    expect(commissionPctFrom({ commission_pct: '' })).toBe(DEFAULT_ARENA_COMMISSION_PCT);
    expect(commissionPctFrom({ commission_pct: 'abc' })).toBe(DEFAULT_ARENA_COMMISSION_PCT);
  });
  it('respeita os limites (0 a 90)', () => {
    expect(commissionPctFrom({ commission_pct: 150 })).toBe(90);
    expect(commissionPctFrom({ commission_pct: -5 })).toBe(0);
    expect(commissionPctFrom({ commission_pct: 35 })).toBe(35);
  });
});
