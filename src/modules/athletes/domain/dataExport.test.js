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

describe('dataExportFilename', () => {
  it('normaliza o nome e inclui a data', () => {
    const fn = dataExportFilename('Ana Clára');
    expect(fn).toMatch(/^picklerush-ana-clara-\d{4}-\d{2}-\d{2}\.json$/);
  });
});
