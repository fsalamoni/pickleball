import { describe, expect, it } from 'vitest';
import { rosterForTraining, studentsOverview } from './studentsView';

describe('rosterForTraining', () => {
  it('separa ativos e convidados, por nome; pausado e sem conta ficam de fora', () => {
    const r = rosterForTraining([
      { student_id: 'b', student_name: 'Bia', status: 'active' },
      { student_id: 'a', student_name: 'Ana', status: 'active' },
      { student_id: 'c', student_name: 'Caio', status: 'paused' },
      { student_id: '', student_name: 'Sem conta', status: 'active' },
      { student_id: 'd', student_name: 'Duda', status: 'invited' },
    ]);
    expect(r.ativos.map((s) => s.student_id)).toEqual(['a', 'b']);
    expect(r.convidados.map((s) => s.student_id)).toEqual(['d']);
  });
});

describe('studentsOverview', () => {
  it('conta a semana, o que falta confirmar e os envios pendentes por aluno', () => {
    const ativos = [{ student_id: 'a' }, { student_id: 'b' }];
    const o = studentsOverview({
      ativos,
      today: '2026-10-09',
      sessions: [
        { id: 1, uid: 'a', date: '2026-10-06', week_key: '2026-10-05' },
        { id: 2, uid: 'a', date: '2026-09-30', week_key: '2026-09-28', coach_confirmed_at: { seconds: 1 } },
        { id: 3, uid: 'x', date: '2026-10-06' },
      ],
      sent: [
        { to_uid: 'a', kind: 'aluno', done_at: null },
        { to_uid: 'b', kind: 'aluno', done_at: { seconds: 1 } },
        { to_uid: 'b', kind: 'indicacao', done_at: null },
      ],
    });
    expect(o.porAluno[0]).toMatchObject({ thisWeek: 1, toConfirm: 1, pending: 1 });
    expect(o.porAluno[0].sessions.map((s) => s.id)).toEqual([1, 2]);
    expect(o.porAluno[1]).toMatchObject({ thisWeek: 0, pending: 0 });
    expect(o.porAluno[1].sent).toHaveLength(1);
    expect(o.treinaramNaSemana).toBe(1);
    expect(o.enviosPendentes).toBe(1);
  });
});
