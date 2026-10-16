/**
 * A lista de espera do professor, no servidor.
 *
 *  1. ⭐ o professor abre horário novo → todos da lista são avisados, com o
 *     link para pedir a aula, e a entrada guarda quando foi avisada;
 *  2. ⭐ salvar de novo em seguida não avisa de novo (intervalo);
 *  3. salvar sem horário novo (ou tirando horário) não avisa ninguém;
 *  4. aula confirmada desfeita, ainda por vir, avisa; passada, pedida ou
 *     sem janelas no professor não avisa.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  abriuHorario, aulaLiberouHorario, aoMudarDisponibilidade, aoMudarAula, INTERVALO_HORAS,
} = require('./coachWaitlist.js');
const { createFakeDb } = require('../tests/fakes/fakeFirestore.cjs');

const AGORA = Date.parse('2026-10-16T15:00:00Z');
const HOJE = '2026-10-16';
const Timestamp = { fromMillis: (n) => n };
const janela = (over = {}) => ({ weekdays: [1, 3], start: '08:00', end: '10:00', ...over });

function banco(extra = {}) {
  return createFakeDb({
    'coaches/P': { display_name: 'Prof. Bia' },
    'coach_waitlist/P_ana': { coach_id: 'P', user_id: 'ana', student_name: 'Ana' },
    'coach_waitlist/P_rui': { coach_id: 'P', user_id: 'rui', student_name: 'Rui' },
    'coach_waitlist/X_eva': { coach_id: 'X', user_id: 'eva', student_name: 'Eva' },
    ...extra,
  });
}
const ctx = (db, agoraMs = AGORA) => ({ db, Timestamp, agoraMs });
const avisos = (db) => [...db.store.docs.entries()].filter(([k]) => k.startsWith('notifications/')).map(([, v]) => v);

describe('abriuHorario', () => {
  it('janela nova ou dia novo abre; mesma agenda, ou só tirar, não', () => {
    expect(abriuHorario(null, { windows: [janela()] }, HOJE)).toBe(true);
    expect(abriuHorario({ windows: [janela()] }, { windows: [janela({ weekdays: [1, 3, 5] })] }, HOJE)).toBe(true);
    expect(abriuHorario({ windows: [janela()] }, { windows: [janela()] }, HOJE)).toBe(false);
    expect(abriuHorario({ windows: [janela()] }, { windows: [janela({ weekdays: [1] })] }, HOJE)).toBe(false);
    expect(abriuHorario({ windows: [janela()] }, { windows: [] }, HOJE)).toBe(false);
  });
  it('folga futura retirada abre; folga passada não conta', () => {
    const w = [janela()];
    expect(abriuHorario({ windows: w, exceptions: [{ date: '2026-10-20' }] }, { windows: w, exceptions: [] }, HOJE)).toBe(true);
    expect(abriuHorario({ windows: w, exceptions: [{ date: '2026-10-01' }] }, { windows: w, exceptions: [] }, HOJE)).toBe(false);
  });
});

describe('aulaLiberouHorario', () => {
  const aula = (status, date = '2026-10-20') => ({ coach_id: 'P', status, slots: [{ date, start: '08:00', end: '09:00' }] });
  it('confirmada → cancelada/recusada, no futuro', () => {
    expect(aulaLiberouHorario(aula('confirmed'), aula('cancelled'), HOJE)).toBe(true);
    expect(aulaLiberouHorario(aula('confirmed'), aula('declined'), HOJE)).toBe(true);
    expect(aulaLiberouHorario(aula('requested'), aula('cancelled'), HOJE)).toBe(false);
    expect(aulaLiberouHorario(aula('confirmed'), aula('completed'), HOJE)).toBe(false);
    expect(aulaLiberouHorario(aula('confirmed', '2026-10-01'), aula('cancelled', '2026-10-01'), HOJE)).toBe(false);
  });
});

describe('avisos da lista', () => {
  it('⭐ abriu horário: avisa só a lista DESTE professor, com o link do pedido', async () => {
    const db = banco();
    const r = await aoMudarDisponibilidade(ctx(db), 'P', null, { windows: [janela()] });
    expect(r.avisados).toBe(2);
    const a = avisos(db);
    expect(a.map((x) => x.user_id).sort()).toEqual(['ana', 'rui']);
    expect(a[0]).toMatchObject({ title: 'Prof. Bia abriu horários de aula', link: '/coaches/P?marcar=1', read: false });
    expect(db.store.docs.get('coach_waitlist/P_ana')).toMatchObject({ notified_at: AGORA, notify_count: 1 });
  });

  it('⭐ salvar de novo dentro do intervalo não repete o aviso; depois dele, avisa', async () => {
    const db = banco();
    await aoMudarDisponibilidade(ctx(db), 'P', null, { windows: [janela()] });
    const r2 = await aoMudarDisponibilidade(ctx(db, AGORA + 3600000), 'P', { windows: [janela()] }, { windows: [janela(), janela({ weekdays: [6] })] });
    expect(r2.avisados).toBe(0);
    const r3 = await aoMudarDisponibilidade(ctx(db, AGORA + (INTERVALO_HORAS + 1) * 3600000), 'P', { windows: [janela()] }, { windows: [janela({ weekdays: [0] })] });
    expect(r3.avisados).toBe(2);
    expect(db.store.docs.get('coach_waitlist/P_rui').notify_count).toBe(2);
  });

  it('sem horário novo, ninguém é avisado', async () => {
    const db = banco();
    expect((await aoMudarDisponibilidade(ctx(db), 'P', { windows: [janela()] }, { windows: [janela()] })).avisados).toBe(0);
    expect(avisos(db)).toHaveLength(0);
  });

  it('aula desfeita avisa "abriu uma vaga" só se o professor tem janelas', async () => {
    const aula = (status) => ({ coach_id: 'P', status, slots: [{ date: '2026-10-20', start: '08:00', end: '09:00' }] });
    const semJanela = banco();
    expect((await aoMudarAula(ctx(semJanela), aula('confirmed'), aula('cancelled'))).avisados).toBe(0);
    const comJanela = banco({ 'coach_availability/P': { windows: [janela()] } });
    expect((await aoMudarAula(ctx(comJanela), aula('confirmed'), aula('cancelled'))).avisados).toBe(2);
    expect(avisos(comJanela)[0].title).toBe('Abriu uma vaga com Prof. Bia');
  });
});

describe('horários ocupados públicos (coach_busy_slots)', () => {
  const { recalcularOcupados, aulaMudouOcupacao } = require('./coachWaitlist.js');
  const aula = (status, date, start = '08:00', over = {}) => ({
    coach_id: 'P', student_id: 'ana', student_name: 'Ana', status, slots: [{ date, start, end: '09:00' }], ...over,
  });

  it('⭐ só as confirmadas por vir, só data e hora — sem aluno', async () => {
    const db = createFakeDb({
      'coach_lessons/a': aula('confirmed', '2026-10-20'),
      'coach_lessons/b': aula('requested', '2026-10-21'),
      'coach_lessons/c': aula('confirmed', '2026-10-01'),
      'coach_lessons/d': aula('confirmed', '2026-10-18', '07:00'),
      'coach_lessons/e': aula('confirmed', '2026-10-25', '08:00', { coach_id: 'X' }),
    });
    const r = await recalcularOcupados(ctx(db), 'P');
    expect(r.ocupados).toBe(2);
    const doc = db.store.docs.get('coach_busy_slots/P');
    expect(doc.slots).toEqual([
      { date: '2026-10-18', start: '07:00', end: '09:00' },
      { date: '2026-10-20', start: '08:00', end: '09:00' },
    ]);
    expect(JSON.stringify(doc)).not.toContain('Ana');
  });

  it('aula confirmada recalcula; mudança que não mexe em status nem horário, não', () => {
    expect(aulaMudouOcupacao(null, aula('requested', '2026-10-20'))).toBe(true);
    expect(aulaMudouOcupacao(aula('requested', '2026-10-20'), aula('confirmed', '2026-10-20'))).toBe(true);
    expect(aulaMudouOcupacao(aula('confirmed', '2026-10-20'), aula('confirmed', '2026-10-20', '08:00', { notes: 'x' }))).toBe(false);
  });

  it('confirmar uma aula pelo gatilho grava o ocupado', async () => {
    const db = banco({ 'coach_lessons/a': aula('confirmed', '2026-10-20') });
    await aoMudarAula(ctx(db), aula('requested', '2026-10-20'), aula('confirmed', '2026-10-20'));
    expect(db.store.docs.get('coach_busy_slots/P').slots).toHaveLength(1);
  });
});
