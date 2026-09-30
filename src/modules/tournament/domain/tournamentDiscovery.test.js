import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { discoverTournaments, sortMyTournaments } from './tournamentDiscovery.js';

const hoje = '2026-09-30';
const t = (id, status, starts, ends = starts, over = {}) => ({
  id, name: id, status, starts_at: starts, ends_at: ends, ...over,
});

describe('discoverTournaments', () => {
  const lista = [
    t('longe', 'registrations_open', '2027-03-01'),
    t('amanha', 'registrations_open', '2026-10-01'),
    t('rolando', 'in_progress', '2026-09-29', '2026-10-02'),
    t('encerrado', 'finished', '2026-08-01'),
    t('esquecido', 'in_progress', '2026-09-01', '2026-09-02'),
    t('cancelado', 'cancelled', '2026-10-10'),
    t('rascunho', 'draft', '2026-11-01'),
    t('fechado', 'registrations_closed', '2026-10-05'),
  ];
  it('⭐ atuais: o que está rolando primeiro, depois o mais próximo; nada que já passou', () => {
    const { atuais } = discoverTournaments(lista, hoje);
    expect(atuais.map((x) => x.id)).toEqual(['rolando', 'amanha', 'longe', 'fechado']);
  });
  it('encerrados, cancelados e esquecidos saem da lista principal (mais recente primeiro)', () => {
    const { encerrados } = discoverTournaments(lista, hoje);
    expect(encerrados.map((x) => x.id)).toEqual(['cancelado', 'esquecido', 'encerrado']);
  });
  it('rascunho de outra pessoa não é vitrine', () => {
    expect(discoverTournaments(lista, hoje).rascunhos.map((x) => x.id)).toEqual(['rascunho']);
  });
  it('lê a data do banco (Timestamp) sem virar o dia errado', () => {
    const ts = Timestamp.fromDate(new Date(2026, 9, 1, 12, 0));
    const { atuais } = discoverTournaments([t('ts', 'registrations_open', ts, ts)], hoje);
    expect(atuais).toHaveLength(1);
  });
});

describe('sortMyTournaments', () => {
  it('o que pede atenção primeiro; o histórico continua, depois', () => {
    const lista = [
      t('velho', 'finished', '2025-01-01'),
      t('prox', 'registrations_open', '2026-10-20'),
      t('esquecido', 'in_progress', '2026-09-01', '2026-09-02'),
      t('recente', 'finished', '2026-09-10'),
      t('rolando', 'in_progress', '2026-09-29', '2026-10-02'),
    ];
    expect(sortMyTournaments(lista, hoje).map((x) => x.id)).toEqual(['rolando', 'esquecido', 'prox', 'recente', 'velho']);
  });
});
