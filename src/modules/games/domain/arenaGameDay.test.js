/**
 * Dia de jogo da arena — o que estes testes protegem.
 *
 *  1. ⭐ **Um dia de jogo sem `arena_id` não é tocado por nada aqui.** É a
 *     garantia de que os dias de jogo que já existem seguem idênticos;
 *  2. ⭐ **Mais de um dia de jogo na mesma quadra e no mesmo dia**, desde que
 *     em horários diferentes — e encostar (20:00 no fim de um, 20:00 no
 *     começo do outro) NÃO é sobrepor;
 *  3. as vagas: teto do dia, teto por quadra, e "sem limite" de verdade;
 *  4. quem pode se inscrever — e, quando não pode, POR QUÊ (a tela mostra o
 *     motivo em vez de só desabilitar o botão).
 */
import { describe, it, expect } from 'vitest';
import {
  ARENA_SIGNUP_MODE, ARENA_SIGNUP_MODE_LABELS,
  isArenaGameDay, arenaGameDaySlots, arenaSignupMode, arenaGameDayCourtIds,
  arenaGameDayTimeRange, arenaGameDaySingleWindow, arenaGameDayWhenText,
  timeRangesOverlap, findGameDayOverlaps, slotsAsBookingCandidates,
  unavailabilityPayloadsFor, normalizeCapacity, arenaGameDayVacancies,
  isSignedUp, canSignUpToArenaGameDay, normalizeArenaGameDayInput,
} from './arenaGameDay.js';
import { GAME_DAY_FORMAT } from '@/modules/clubs/domain/gameDayFormats.js';
import { GAME_DAY_MANAGE_MODE } from './gameDayRoles.js';

const slot = (court_id, start_time, end_time, extra = {}) => ({
  court_id, court_name: `Quadra ${court_id}`, start_time, end_time, capacity: null, ...extra,
});

const diaDaArena = (over = {}) => ({
  id: 'gd1',
  arena_id: 'a1',
  arena_name: 'Arena Teste',
  title: 'Sexta de Americano',
  date: '2026-10-02',
  status: 'active',
  signup_mode: ARENA_SIGNUP_MODE.DAY,
  capacity: null,
  arena_slots: [slot('c1', '18:00', '22:00'), slot('c2', '18:00', '22:00')],
  ...over,
});

/* ================================================== não é dia de arena === */

describe('⭐ dia de jogo SEM arena', () => {
  const doAtleta = { id: 'x', title: 'Rachão', date: '2026-10-02' };

  it('não é reconhecido como dia de arena', () => {
    expect(isArenaGameDay(doAtleta)).toBe(false);
    expect(isArenaGameDay(null)).toBe(false);
    expect(isArenaGameDay({ arena_id: '' })).toBe(false);
    expect(isArenaGameDay({ arena_id: 123 })).toBe(false);
  });

  it('não gera bloqueio nenhum no calendário', () => {
    expect(unavailabilityPayloadsFor(doAtleta)).toEqual([]);
  });

  it('não deixa ninguém "se inscrever" por este caminho', () => {
    const r = canSignUpToArenaGameDay({ gameDay: doAtleta, uid: 'u1' });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('not_arena');
  });

  it('leituras devolvem vazio em vez de quebrar', () => {
    expect(arenaGameDaySlots(doAtleta)).toEqual([]);
    expect(arenaGameDayCourtIds(doAtleta)).toEqual([]);
    expect(arenaGameDayTimeRange(doAtleta)).toBeNull();
    expect(arenaGameDaySingleWindow(doAtleta)).toBe(false);
  });
});

/* ============================================================= leituras === */

describe('leituras do dia de arena', () => {
  it('reconhece o dia de arena', () => {
    expect(isArenaGameDay(diaDaArena())).toBe(true);
  });

  it('lista as quadras sem repetir', () => {
    const gd = diaDaArena({ arena_slots: [slot('c1', '08:00', '10:00'), slot('c1', '10:00', '12:00')] });
    expect(arenaGameDayCourtIds(gd)).toEqual(['c1']);
  });

  it('a faixa do dia vai do início mais cedo ao fim mais tarde', () => {
    const gd = diaDaArena({
      arena_slots: [slot('c1', '19:00', '21:00'), slot('c2', '18:00', '23:00'), slot('c3', '20:00', '22:00')],
    });
    expect(arenaGameDayTimeRange(gd)).toEqual({ start: '18:00', end: '23:00' });
  });

  it('sabe se o horário é o mesmo em todas as quadras', () => {
    expect(arenaGameDaySingleWindow(diaDaArena())).toBe(true);
    const misto = diaDaArena({ arena_slots: [slot('c1', '18:00', '20:00'), slot('c2', '20:00', '22:00')] });
    expect(arenaGameDaySingleWindow(misto)).toBe(false);
  });

  it('o resumo diz data, faixa e quantas quadras', () => {
    const texto = arenaGameDayWhenText(diaDaArena());
    // ⭐ Data como gente lê. Nunca a ISO crua: este texto aparece em cinco
    // telas, e "2026-10-02" obriga a pessoa a traduzir mês e dia de cabeça.
    // (Sem o ano quando é o corrente — por isso a asserção é pelo dia/mês.)
    expect(texto).toContain('02/10');
    expect(texto).not.toContain('2026-10-02');
    expect(texto).toContain('18:00–22:00');
    expect(texto).toContain('2 quadras');
  });

  it('o resumo usa o singular com uma quadra só', () => {
    expect(arenaGameDayWhenText(diaDaArena({ arena_slots: [slot('c1', '18:00', '20:00')] })))
      .toContain('1 quadra');
  });

  it('modo de inscrição desconhecido cai em "no dia"', () => {
    expect(arenaSignupMode({ signup_mode: 'qualquer' })).toBe(ARENA_SIGNUP_MODE.DAY);
    expect(arenaSignupMode({})).toBe(ARENA_SIGNUP_MODE.DAY);
    expect(arenaSignupMode({ signup_mode: 'court' })).toBe(ARENA_SIGNUP_MODE.COURT);
  });

  it('todo modo tem rótulo', () => {
    Object.values(ARENA_SIGNUP_MODE).forEach((m) => expect(ARENA_SIGNUP_MODE_LABELS[m]).toBeTruthy());
  });
});

/* ========================================================= sobreposição === */

describe('timeRangesOverlap', () => {
  it('sobrepõe quando há interseção', () => {
    expect(timeRangesOverlap('18:00', '20:00', '19:00', '21:00')).toBe(true);
    expect(timeRangesOverlap('18:00', '22:00', '19:00', '20:00')).toBe(true);
  });

  it('⭐ ENCOSTAR não é sobrepor (é o que permite dois dias na mesma quadra)', () => {
    expect(timeRangesOverlap('18:00', '20:00', '20:00', '22:00')).toBe(false);
    expect(timeRangesOverlap('20:00', '22:00', '18:00', '20:00')).toBe(false);
  });

  it('faixas distantes não sobrepõem', () => {
    expect(timeRangesOverlap('08:00', '10:00', '18:00', '20:00')).toBe(false);
  });

  it('horário inválido não inventa conflito', () => {
    expect(timeRangesOverlap('xx', '10:00', '08:00', '09:00')).toBe(false);
    expect(timeRangesOverlap(null, null, null, null)).toBe(false);
  });
});

describe('findGameDayOverlaps', () => {
  const existente = diaDaArena({ id: 'gd-antigo', title: 'Play da manhã', arena_slots: [slot('c1', '08:00', '12:00')] });

  it('⭐ acusa a mesma quadra no mesmo dia em horário sobreposto', () => {
    const achados = findGameDayOverlaps(
      { date: '2026-10-02', slots: [slot('c1', '10:00', '14:00')] }, [existente],
    );
    expect(achados).toHaveLength(1);
    expect(achados[0].game_day_id).toBe('gd-antigo');
    expect(achados[0].title).toBe('Play da manhã');
  });

  it('⭐ LIBERA a mesma quadra no mesmo dia em horário diferente', () => {
    expect(findGameDayOverlaps(
      { date: '2026-10-02', slots: [slot('c1', '12:00', '16:00')] }, [existente],
    )).toEqual([]);
  });

  it('libera outra quadra no mesmo horário', () => {
    expect(findGameDayOverlaps(
      { date: '2026-10-02', slots: [slot('c2', '08:00', '12:00')] }, [existente],
    )).toEqual([]);
  });

  it('libera outra data', () => {
    expect(findGameDayOverlaps(
      { date: '2026-10-03', slots: [slot('c1', '08:00', '12:00')] }, [existente],
    )).toEqual([]);
  });

  it('ignora o próprio dia de jogo ao editar', () => {
    expect(findGameDayOverlaps(
      { date: '2026-10-02', slots: [slot('c1', '08:00', '12:00')] },
      [existente],
      { ignoreId: 'gd-antigo' },
    )).toEqual([]);
  });

  it('ignora dia de jogo arquivado (a quadra voltou a ficar livre)', () => {
    const arquivado = { ...existente, status: 'archived' };
    expect(findGameDayOverlaps(
      { date: '2026-10-02', slots: [slot('c1', '08:00', '12:00')] }, [arquivado],
    )).toEqual([]);
  });

  it('aguenta lista vazia, nula e item nulo', () => {
    expect(findGameDayOverlaps({ date: '2026-10-02', slots: [slot('c1', '08:00', '12:00')] })).toEqual([]);
    expect(findGameDayOverlaps({}, null)).toEqual([]);
    expect(findGameDayOverlaps({ date: 'x', slots: [] }, [null, undefined])).toEqual([]);
  });
});

/* ====================================== conversa com o resto da arena === */

describe('integração com reservas e calendário', () => {
  it('os slots viram candidatos no formato que checkBookingConflict espera', () => {
    const cands = slotsAsBookingCandidates({ date: '2026-10-02', slots: [slot('c1', '18:00', '22:00')] });
    expect(cands).toEqual([{ date: '2026-10-02', start: '18:00', end: '22:00', court_id: 'c1' }]);
  });

  it('slot incompleto não vira candidato (não inventa conflito)', () => {
    const cands = slotsAsBookingCandidates({
      date: '2026-10-02',
      slots: [{ court_id: null, start_time: '18:00', end_time: '22:00' }, slot('c1', '18:00', null)],
    });
    expect(cands).toEqual([]);
  });

  it('⭐ gera um bloqueio de calendário por quadra, marcado como dia de jogo', () => {
    const blocos = unavailabilityPayloadsFor(diaDaArena());
    expect(blocos).toHaveLength(2);
    blocos.forEach((b) => {
      expect(b.arena_id).toBe('a1');
      expect(b.date).toBe('2026-10-02');
      expect(b.source).toBe('game_day');
      expect(b.game_day_id).toBe('gd1');
      expect(b.notes).toContain('Sexta de Americano');
    });
    expect(blocos.map((b) => b.court_id)).toEqual(['c1', 'c2']);
  });

  it('sem data não bloqueia nada', () => {
    expect(unavailabilityPayloadsFor(diaDaArena({ date: null }))).toEqual([]);
  });
});

/* ================================================================ vagas === */

describe('normalizeCapacity', () => {
  it('sem limite é null', () => {
    [null, undefined, '', 0, -3, 'abc', NaN].forEach((v) => expect(normalizeCapacity(v)).toBeNull());
  });

  it('número vira inteiro positivo', () => {
    expect(normalizeCapacity(16)).toBe(16);
    expect(normalizeCapacity('24')).toBe(24);
    expect(normalizeCapacity(12.7)).toBe(12);
  });

  it('teto absurdo é aparado', () => {
    expect(normalizeCapacity(99999)).toBe(200);
  });
});

describe('arenaGameDayVacancies — inscrição NO DIA', () => {
  const inscritos = (n) => Array.from({ length: n }, (_, i) => ({ user_id: `u${i}` }));

  it('sem limite, nunca enche', () => {
    const v = arenaGameDayVacancies(diaDaArena({ capacity: null }), inscritos(500));
    expect(v.limit).toBeNull();
    expect(v.left).toBeNull();
    expect(v.full).toBe(false);
  });

  it('conta usados e restantes', () => {
    const v = arenaGameDayVacancies(diaDaArena({ capacity: 16 }), inscritos(10));
    expect(v.used).toBe(10);
    expect(v.left).toBe(6);
    expect(v.full).toBe(false);
  });

  it('enche ao bater o teto', () => {
    expect(arenaGameDayVacancies(diaDaArena({ capacity: 16 }), inscritos(16)).full).toBe(true);
  });

  it('estourado não devolve saldo negativo', () => {
    const v = arenaGameDayVacancies(diaDaArena({ capacity: 16 }), inscritos(20));
    expect(v.left).toBe(0);
    expect(v.full).toBe(true);
  });
});

describe('arenaGameDayVacancies — inscrição POR QUADRA', () => {
  const gd = diaDaArena({
    signup_mode: ARENA_SIGNUP_MODE.COURT,
    arena_slots: [
      slot('c1', '18:00', '20:00', { capacity: 8 }),
      slot('c2', '20:00', '22:00', { capacity: 4 }),
    ],
  });

  it('conta por quadra, não no total', () => {
    const parts = [
      { user_id: 'a', arena_court_id: 'c1' },
      { user_id: 'b', arena_court_id: 'c1' },
      { user_id: 'c', arena_court_id: 'c2' },
    ];
    const v = arenaGameDayVacancies(gd, parts);
    expect(v.byCourt.find((c) => c.court_id === 'c1')).toMatchObject({ used: 2, left: 6, full: false });
    expect(v.byCourt.find((c) => c.court_id === 'c2')).toMatchObject({ used: 1, left: 3, full: false });
  });

  it('⭐ o dia só está cheio quando TODAS as quadras estão', () => {
    const so_c2_cheia = [{ user_id: 'a', arena_court_id: 'c2' }, { user_id: 'b', arena_court_id: 'c2' },
      { user_id: 'c', arena_court_id: 'c2' }, { user_id: 'd', arena_court_id: 'c2' }];
    expect(arenaGameDayVacancies(gd, so_c2_cheia).full).toBe(false);

    const todas = [...so_c2_cheia, ...Array.from({ length: 8 }, (_, i) => ({ user_id: `x${i}`, arena_court_id: 'c1' }))];
    expect(arenaGameDayVacancies(gd, todas).full).toBe(true);
  });

  it('⭐ uma quadra sem limite impede o dia de encher', () => {
    const semLimite = diaDaArena({
      signup_mode: ARENA_SIGNUP_MODE.COURT,
      arena_slots: [slot('c1', '18:00', '20:00', { capacity: 2 }), slot('c2', '18:00', '20:00', { capacity: null })],
    });
    const parts = [{ user_id: 'a', arena_court_id: 'c1' }, { user_id: 'b', arena_court_id: 'c1' }];
    const v = arenaGameDayVacancies(semLimite, parts);
    expect(v.byCourt.find((c) => c.court_id === 'c1').full).toBe(true);
    expect(v.full).toBe(false);
  });

  it('cada quadra leva o próprio horário para a tela', () => {
    const v = arenaGameDayVacancies(gd, []);
    expect(v.byCourt.map((c) => `${c.start_time}-${c.end_time}`)).toEqual(['18:00-20:00', '20:00-22:00']);
  });
});

/* ========================================================== inscrição === */

describe('canSignUpToArenaGameDay', () => {
  it('deixa entrar quando há vaga', () => {
    expect(canSignUpToArenaGameDay({ gameDay: diaDaArena({ capacity: 16 }), participants: [], uid: 'u1' }))
      .toEqual({ ok: true, reason: null, message: null });
  });

  it('⭐ recusa SEMPRE com motivo em texto (a tela mostra o porquê)', () => {
    const casos = [
      [{ gameDay: diaDaArena(), uid: null }, 'anonymous'],
      [{ gameDay: diaDaArena({ status: 'archived' }), uid: 'u1' }, 'archived'],
      [{ gameDay: diaDaArena(), participants: [{ user_id: 'u1' }], uid: 'u1' }, 'already'],
      [{ gameDay: diaDaArena({ capacity: 1 }), participants: [{ user_id: 'z' }], uid: 'u1' }, 'full'],
    ];
    casos.forEach(([args, reason]) => {
      const r = canSignUpToArenaGameDay(args);
      expect(r.ok, reason).toBe(false);
      expect(r.reason).toBe(reason);
      expect(r.message, reason).toBeTruthy();
    });
  });

  it('sem limite, sempre cabe mais um', () => {
    const muitos = Array.from({ length: 300 }, (_, i) => ({ user_id: `u${i}` }));
    expect(canSignUpToArenaGameDay({ gameDay: diaDaArena(), participants: muitos, uid: 'novo' }).ok).toBe(true);
  });

  describe('por quadra', () => {
    const gd = diaDaArena({
      signup_mode: ARENA_SIGNUP_MODE.COURT,
      arena_slots: [slot('c1', '18:00', '20:00', { capacity: 2 }), slot('c2', '20:00', '22:00', { capacity: null })],
    });

    it('exige escolher a quadra', () => {
      const r = canSignUpToArenaGameDay({ gameDay: gd, uid: 'u1' });
      expect(r.reason).toBe('court_required');
    });

    it('recusa quadra que não é do dia de jogo', () => {
      expect(canSignUpToArenaGameDay({ gameDay: gd, uid: 'u1', courtId: 'c9' }).reason).toBe('court_unknown');
    });

    it('recusa quadra lotada, mas libera a outra', () => {
      const parts = [{ user_id: 'a', arena_court_id: 'c1' }, { user_id: 'b', arena_court_id: 'c1' }];
      expect(canSignUpToArenaGameDay({ gameDay: gd, participants: parts, uid: 'u1', courtId: 'c1' }).reason).toBe('court_full');
      expect(canSignUpToArenaGameDay({ gameDay: gd, participants: parts, uid: 'u1', courtId: 'c2' }).ok).toBe(true);
    });

    it('quem já está inscrito não entra de novo por outra quadra', () => {
      const parts = [{ user_id: 'u1', arena_court_id: 'c1' }];
      expect(canSignUpToArenaGameDay({ gameDay: gd, participants: parts, uid: 'u1', courtId: 'c2' }).reason).toBe('already');
    });
  });
});

describe('isSignedUp', () => {
  it('acha quem está e não inventa quem não está', () => {
    expect(isSignedUp([{ user_id: 'a' }], 'a')).toBe(true);
    expect(isSignedUp([{ user_id: 'a' }], 'b')).toBe(false);
    expect(isSignedUp([], 'a')).toBe(false);
    expect(isSignedUp(null, 'a')).toBe(false);
    expect(isSignedUp([{ user_id: 'a' }], null)).toBe(false);
  });
});

/* ========================================================== validação === */

describe('normalizeArenaGameDayInput', () => {
  const courts = [{ id: 'c1', name: 'Quadra 1' }, { id: 'c2', name: 'Quadra 2' }];
  const base = {
    title: ' Sexta de Americano ',
    date: '2026-10-02',
    format: GAME_DAY_FORMAT.AMERICANO,
    arena_slots: [{ court_id: 'c1', start_time: '18:00', end_time: '22:00' }],
  };

  it('aceita o mínimo e resolve o nome da quadra', () => {
    const { valid, value } = normalizeArenaGameDayInput(base, { courts });
    expect(valid).toBe(true);
    expect(value.title).toBe('Sexta de Americano');
    expect(value.arena_slots[0].court_name).toBe('Quadra 1');
    expect(value.manage_mode).toBe(GAME_DAY_MANAGE_MODE.OWNER_ONLY);
    expect(value.signup_mode).toBe(ARENA_SIGNUP_MODE.DAY);
  });

  it('exige nome, data e ao menos uma quadra', () => {
    const { valid, errors } = normalizeArenaGameDayInput({}, { courts });
    expect(valid).toBe(false);
    expect(errors.title).toBeTruthy();
    expect(errors.date).toBeTruthy();
    expect(errors.arena_slots).toBeTruthy();
  });

  it('recusa data mal formada', () => {
    expect(normalizeArenaGameDayInput({ ...base, date: '02/10/2026' }, { courts }).errors.date).toBeTruthy();
  });

  it('⭐ recusa fim antes do início', () => {
    const { valid, errors } = normalizeArenaGameDayInput(
      { ...base, arena_slots: [{ court_id: 'c1', start_time: '22:00', end_time: '18:00' }] }, { courts },
    );
    expect(valid).toBe(false);
    expect(errors.arena_slots).toContain('Quadra 1');
  });

  it('recusa horário vazio', () => {
    expect(normalizeArenaGameDayInput(
      { ...base, arena_slots: [{ court_id: 'c1' }] }, { courts },
    ).valid).toBe(false);
  });

  it('⭐ recusa a MESMA quadra duas vezes em horários sobrepostos', () => {
    const { valid, errors } = normalizeArenaGameDayInput({
      ...base,
      arena_slots: [
        { court_id: 'c1', start_time: '18:00', end_time: '22:00' },
        { court_id: 'c1', start_time: '20:00', end_time: '23:00' },
      ],
    }, { courts });
    expect(valid).toBe(false);
    expect(errors.arena_slots).toContain('duas vezes');
  });

  it('⭐ ACEITA a mesma quadra duas vezes em horários que só encostam', () => {
    const { valid } = normalizeArenaGameDayInput({
      ...base,
      arena_slots: [
        { court_id: 'c1', start_time: '18:00', end_time: '20:00' },
        { court_id: 'c1', start_time: '20:00', end_time: '22:00' },
      ],
    }, { courts });
    expect(valid).toBe(true);
  });

  it('descarta slot sem quadra', () => {
    const { value } = normalizeArenaGameDayInput({
      ...base,
      arena_slots: [{ court_id: '', start_time: '18:00', end_time: '20:00' }, ...base.arena_slots],
    }, { courts });
    expect(value.arena_slots).toHaveLength(1);
  });

  it('⭐ no modo "no dia", o limite POR QUADRA é apagado (não grava número morto)', () => {
    const { value } = normalizeArenaGameDayInput({
      ...base, signup_mode: ARENA_SIGNUP_MODE.DAY, capacity: 16,
      arena_slots: [{ court_id: 'c1', start_time: '18:00', end_time: '22:00', capacity: 8 }],
    }, { courts });
    expect(value.capacity).toBe(16);
    expect(value.arena_slots[0].capacity).toBeNull();
  });

  it('⭐ no modo "por quadra", o teto DO DIA é apagado', () => {
    const { value } = normalizeArenaGameDayInput({
      ...base, signup_mode: ARENA_SIGNUP_MODE.COURT, capacity: 16,
      arena_slots: [{ court_id: 'c1', start_time: '18:00', end_time: '22:00', capacity: 8 }],
    }, { courts });
    expect(value.capacity).toBeNull();
    expect(value.arena_slots[0].capacity).toBe(8);
  });

  it('formato desconhecido cai no Americano', () => {
    expect(normalizeArenaGameDayInput({ ...base, format: 'inventado' }, { courts }).value.format)
      .toBe(GAME_DAY_FORMAT.AMERICANO);
  });

  it('guarda o formato quando ele é válido', () => {
    Object.values(GAME_DAY_FORMAT).forEach((f) => {
      expect(normalizeArenaGameDayInput({ ...base, format: f }, { courts }).value.format).toBe(f);
    });
  });

  it('modo de gestão aberto é respeitado; qualquer outra coisa é restrito', () => {
    expect(normalizeArenaGameDayInput({ ...base, manage_mode: GAME_DAY_MANAGE_MODE.PARTICIPANTS }, { courts })
      .value.manage_mode).toBe(GAME_DAY_MANAGE_MODE.PARTICIPANTS);
    expect(normalizeArenaGameDayInput({ ...base, manage_mode: 'sei-la' }, { courts })
      .value.manage_mode).toBe(GAME_DAY_MANAGE_MODE.OWNER_ONLY);
  });

  it('apara texto longo demais', () => {
    const { value } = normalizeArenaGameDayInput(
      { ...base, title: 'x'.repeat(200), notes: 'y'.repeat(2000) }, { courts },
    );
    expect(value.title).toHaveLength(80);
    expect(value.notes).toHaveLength(1000);
  });

  it('limita a quantidade de slots', () => {
    const muitos = Array.from({ length: 30 }, (_, i) => ({ court_id: `c${i}`, start_time: '08:00', end_time: '09:00' }));
    const { value } = normalizeArenaGameDayInput({ ...base, arena_slots: muitos }, { courts });
    expect(value.arena_slots.length).toBeLessThanOrEqual(12);
  });

  it('não quebra sem contexto de quadras', () => {
    const { valid, value } = normalizeArenaGameDayInput(base);
    expect(valid).toBe(true);
    expect(value.arena_slots[0].court_name).toBeNull();
  });
});

/* ================================================= o que NÃO se normaliza === */

describe('⭐ a edição não mexe na visibilidade', () => {
  it('o normalizador não devolve `visibility`', () => {
    // Dia de jogo de arena é sempre público: é assim que o atleta o ENXERGA na
    // página da arena, e é o que faz a listagem por `arena_id` passar pela
    // regra de leitura. Se uma edição pudesse torná-lo privado, a lista da
    // arena inteira quebraria para quem não é membro — de uma vez, sem aviso.
    const { value } = normalizeArenaGameDayInput({
      title: 'X', date: '2026-10-02', visibility: 'private',
      arena_slots: [{ court_id: 'c1', start_time: '18:00', end_time: '20:00' }],
    });
    expect('visibility' in value).toBe(false);
  });

  it('o normalizador não devolve campos de dono nem de membros', () => {
    const { value } = normalizeArenaGameDayInput({
      title: 'X', date: '2026-10-02',
      created_by: 'invasor', member_uids: ['invasor'], admin_uids: ['invasor'],
      arena_id: 'outra', status: 'archived', publish_to_ranking: true,
      arena_slots: [{ court_id: 'c1', start_time: '18:00', end_time: '20:00' }],
    });
    ['created_by', 'member_uids', 'admin_uids', 'arena_id', 'status', 'publish_to_ranking']
      .forEach((k) => expect(k in value, k).toBe(false));
  });
});
