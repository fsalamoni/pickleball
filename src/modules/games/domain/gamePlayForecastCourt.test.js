/**
 * Previsão da próxima partida POR QUADRA.
 *
 * A amarração leva-quadra precisa seguir exatamente a ordem em que
 * `createNextPlayGame` criaria os jogos: quadras livres primeiro, da menor para
 * a maior; as ocupadas só depois, quando liberarem.
 */
import { describe, it, expect } from 'vitest';
import { forecastPlayByCourt } from './gamePlay.js';

/** Fila de disponíveis, na ordem de espera. */
const fila = (n) => Array.from({ length: n }, (_, i) => ({
  id: `p${i + 1}`, name: `Atleta ${i + 1}`, orderNo: i + 1,
}));

const jogoAberto = (court) => ({ id: `g${court}`, court, status: 'open' });
const jogoFinalizado = (court) => ({ id: `f${court}`, court, status: 'finished' });

const nomes = (entrada) => entrada.players.map((p) => p.name);

describe('forecastPlayByCourt', () => {
  it('devolve UMA entrada por quadra existente, em ordem de quadra', () => {
    const r = forecastPlayByCourt(fila(8), { courts: 3, games: [] });
    expect(r.map((e) => e.court)).toEqual([1, 2, 3]);
  });

  it('com todas as quadras livres, enche da menor para a maior', () => {
    const r = forecastPlayByCourt(fila(8), { courts: 2, games: [] });
    expect(nomes(r[0])).toEqual(['Atleta 1', 'Atleta 2', 'Atleta 3', 'Atleta 4']);
    expect(nomes(r[1])).toEqual(['Atleta 5', 'Atleta 6', 'Atleta 7', 'Atleta 8']);
    expect(r.every((e) => e.free && e.full)).toBe(true);
  });

  it('quadra ocupada recebe a leva SEGUINTE, não a primeira', () => {
    // Quadra 1 ocupada, quadra 2 livre: os 4 primeiros vão para a 2 (a livre),
    // e a 1 só recebe os próximos quando o jogo dela terminar.
    const r = forecastPlayByCourt(fila(8), { courts: 2, games: [jogoAberto(1)] });
    const q1 = r.find((e) => e.court === 1);
    const q2 = r.find((e) => e.court === 2);
    expect(q2.free).toBe(true);
    expect(nomes(q2)).toEqual(['Atleta 1', 'Atleta 2', 'Atleta 3', 'Atleta 4']);
    expect(q1.free).toBe(false);
    expect(nomes(q1)).toEqual(['Atleta 5', 'Atleta 6', 'Atleta 7', 'Atleta 8']);
  });

  it('jogo já FINALIZADO não ocupa a quadra', () => {
    const r = forecastPlayByCourt(fila(4), { courts: 1, games: [jogoFinalizado(1)] });
    expect(r[0].free).toBe(true);
    expect(r[0].full).toBe(true);
  });

  it('fila curta: a última quadra fica sem gente, e isso aparece', () => {
    const r = forecastPlayByCourt(fila(5), { courts: 2, games: [] });
    expect(r[0].full).toBe(true);
    expect(nomes(r[1])).toEqual(['Atleta 5']);
    expect(r[1].full).toBe(false);
    expect(r[1].waiting).toBe(3);
  });

  it('fila vazia: todas as quadras aparecem, todas sem gente', () => {
    const r = forecastPlayByCourt([], { courts: 3, games: [] });
    expect(r).toHaveLength(3);
    expect(r.every((e) => e.players.length === 0 && !e.full)).toBe(true);
  });

  it('todas as quadras ocupadas: a previsão continua valendo para quando liberarem', () => {
    const r = forecastPlayByCourt(fila(8), { courts: 2, games: [jogoAberto(1), jogoAberto(2)] });
    expect(r.every((e) => e.free === false)).toBe(true);
    // Sem quadra livre, a ordem de criação é 1 depois 2.
    expect(nomes(r[0])).toEqual(['Atleta 1', 'Atleta 2', 'Atleta 3', 'Atleta 4']);
    expect(nomes(r[1])).toEqual(['Atleta 5', 'Atleta 6', 'Atleta 7', 'Atleta 8']);
  });

  it('respeita a ordem de espera da fila (não reordena ninguém)', () => {
    const r = forecastPlayByCourt(fila(4), { courts: 1, games: [] });
    expect(nomes(r[0])).toEqual(['Atleta 1', 'Atleta 2', 'Atleta 3', 'Atleta 4']);
  });

  it('entradas degeneradas não quebram', () => {
    expect(() => forecastPlayByCourt(undefined, {})).not.toThrow();
    expect(forecastPlayByCourt([], { courts: 0 })).toHaveLength(1);
    expect(forecastPlayByCourt([], { courts: -3 })).toHaveLength(1);
  });
});
