/**
 * O instante lido do banco.
 *
 * ⭐ O caso que importa é o `Timestamp` DE VERDADE do Firebase — o que o
 * banco devolve. `Number(timestamp)` dá segundos desde o ano 1, e foi isso que
 * fez todo pacote de horas e toda chamada da fila parecerem vencidos.
 */
import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { instanteEmMs } from './instant';

const AGORA = Date.UTC(2026, 8, 25, 12, 0, 0);

describe('instanteEmMs', () => {
  it('⭐ Timestamp do Firebase vira milissegundos (e não segundos desde o ano 1)', () => {
    const t = Timestamp.fromMillis(AGORA + 30 * 86_400_000);
    expect(instanteEmMs(t)).toBe(AGORA + 30 * 86_400_000);
    // O defeito, para ficar registrado: `Number` não falha — erra por 1972.
    expect(Number(t)).toBeLessThan(AGORA);
  });

  it('Timestamp serializado, dos dois jeitos', () => {
    expect(instanteEmMs({ seconds: 100, nanoseconds: 500_000_000 })).toBe(100_500);
    expect(instanteEmMs({ _seconds: 100, _nanoseconds: 0 })).toBe(100_000);
  });

  it('qualquer coisa com toDate()', () => {
    expect(instanteEmMs({ toDate: () => new Date(AGORA) })).toBe(AGORA);
  });

  it('Date, número em ms e texto', () => {
    expect(instanteEmMs(new Date(AGORA))).toBe(AGORA);
    expect(instanteEmMs(AGORA)).toBe(AGORA);
    expect(instanteEmMs(String(AGORA))).toBe(AGORA);
    expect(instanteEmMs('2026-09-25T12:00:00Z')).toBe(AGORA);
  });

  it('sem instante: NaN — nunca zero, que seria 1970 e "venceu"', () => {
    for (const v of [null, undefined, '', 'amanhã', {}, Number.NaN, Infinity]) {
      expect(Number.isNaN(instanteEmMs(v))).toBe(true);
    }
  });
});
