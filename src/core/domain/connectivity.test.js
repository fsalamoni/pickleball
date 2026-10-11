import { describe, it, expect } from 'vitest';
import { AVISO_DE_VOLTA_MS, estadoDeConexao } from './connectivity.js';

describe('estadoDeConexao', () => {
  it('sem conexão avisa; com conexão e sem volta recente, nada', () => {
    expect(estadoDeConexao({ online: false })).toMatchObject({ tipo: 'offline' });
    expect(estadoDeConexao({ online: true })).toBeNull();
  });
  it('ao voltar, "tentando de novo" por alguns segundos e depois some', () => {
    const t = 1_000_000;
    expect(estadoDeConexao({ online: true, voltouEm: t, agora: t + 1000 })).toMatchObject({ tipo: 'voltou' });
    expect(estadoDeConexao({ online: true, voltouEm: t, agora: t + AVISO_DE_VOLTA_MS })).toBeNull();
  });
});
