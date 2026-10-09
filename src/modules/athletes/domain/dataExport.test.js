import { describe, it, expect } from 'vitest';
import { buildDataExport, dataExportFilename } from './dataExport.js';

describe('buildDataExport', () => {
  it('monta o pacote com contagens e metadados', () => {
    const out = buildDataExport({
      uid: 'u1',
      profile: { id: 'u1', platform_name: 'Ana', city: 'Floripa' },
      registrations: [{ id: 'r1' }, { id: 'r2' }],
      bookings: [{ id: 'b1' }],
      lessons: [],
    });
    expect(out.schema).toBe('picklerush.data-export.v1');
    expect(out.user_id).toBe('u1');
    expect(out.profile.platform_name).toBe('Ana');
    expect(out.profile.id).toBeUndefined(); // id removido do perfil
    expect(out.counts).toEqual({ registrations: 2, bookings: 1, lessons: 0 });
  });

  it('converte Timestamps (toDate) para ISO', () => {
    const ts = { toDate: () => new Date('2026-08-01T10:00:00Z') };
    const out = buildDataExport({ uid: 'u1', profile: {}, registrations: [{ id: 'r', created_at: ts }] });
    expect(out.registrations[0].created_at).toBe('2026-08-01T10:00:00.000Z');
  });

  it('tolera entradas ausentes', () => {
    const out = buildDataExport({});
    expect(out.counts).toEqual({ registrations: 0, bookings: 0, lessons: 0 });
  });
});

describe('buildDataExport — treino, metas e o que ficou de fora', () => {
  const ts = { toDate: () => new Date('2026-10-01T12:00:00Z') };

  it('sem treino nem metas, o pacote é o de sempre', () => {
    const out = buildDataExport({ uid: 'u1' });
    expect(out).not.toHaveProperty('training');
    expect(out).not.toHaveProperty('goals');
    expect(out.incomplete).toEqual([]);
  });

  it('⭐ inclui o treino com as contagens, e converte datas em qualquer profundidade', () => {
    const out = buildDataExport({
      uid: 'u1',
      goals: [{ id: 'g1', created_at: ts }],
      training: {
        items: [{ id: 'i1', media: [{ path: 'treino/u1/a.webp', added_at: ts }] }],
        sessions: [{ id: 's1', comments: [{ id: 'c1', created_at: ts }] }],
        plans: [{ id: 'p1' }],
        meta: { routine: { days: [1] }, updated_at: ts },
        shares: { sent: [{ id: 'e1' }], received: [{ id: 'e2' }, { id: 'e3' }] },
        questions: [{ id: 'q1', messages: [{ id: 'm1' }] }],
        reports: [{ id: 'r1' }],
        media_paths: ['treino/u1/a.webp', null],
      },
    });
    expect(out.goals[0].created_at).toBe('2026-10-01T12:00:00.000Z');
    expect(out.training.items[0].media[0].added_at).toBe('2026-10-01T12:00:00.000Z');
    expect(out.training.sessions[0].comments[0].created_at).toBe('2026-10-01T12:00:00.000Z');
    expect(out.training.meta.updated_at).toBe('2026-10-01T12:00:00.000Z');
    expect(out.training.media_paths).toEqual(['treino/u1/a.webp']);
    expect(out.training.not_included[0]).toMatch(/diário dos seus alunos/);
    expect(out.training.counts).toEqual({
      items: 1, sessions: 1, plans: 1, shares_sent: 1, shares_received: 2, questions: 1, reports: 1, media: 1,
    });
  });

  it('⭐ o que falhou vai escrito, sem repetir', () => {
    const out = buildDataExport({ uid: 'u1', incomplete: ['Diário de treino', 'Diário de treino', '', 'Reservas de quadra'] });
    expect(out.incomplete).toEqual(['Diário de treino', 'Reservas de quadra']);
  });

  it('treino vazio vem com listas vazias, não ausente', () => {
    const out = buildDataExport({ uid: 'u1', training: {} });
    expect(out.training.meta).toBeNull();
    expect(out.training.shares).toEqual({ sent: [], received: [] });
    expect(out.training.counts.items).toBe(0);
  });
});

describe('dataExportFilename', () => {
  it('normaliza o nome e inclui a data', () => {
    const fn = dataExportFilename('Ana Clára');
    expect(fn).toMatch(/^picklerush-ana-clara-\d{4}-\d{2}-\d{2}\.json$/);
  });
});
