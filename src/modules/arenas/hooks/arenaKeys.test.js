/**
 * As chaves de cache da arena.
 *
 * O que estes testes protegem não é o formato das chaves — é o CONTRATO entre
 * quem pré-busca e quem consome. Chave escrita duas vezes é chave que um dia
 * diverge, e quando diverge o sintoma não é erro: é a tela buscando de novo o
 * que já estava em cache, em silêncio, para sempre. Por isso um dos testes lê
 * o código-fonte e proíbe a chave literal fora daqui.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { arenaKeys } from './arenaKeys.js';

const ler = (nome) => readFileSync(`src/modules/arenas/hooks/${nome}`, 'utf8');

describe('arenaKeys', () => {
  it('são estáveis e previsíveis', () => {
    expect(arenaKeys.lista()).toEqual(['arenas']);
    expect(arenaKeys.arena('a1')).toEqual(['arena', 'a1']);
    expect(arenaKeys.quadras('a1')).toEqual(['arena-courts', 'a1']);
    expect(arenaKeys.janelas('a1')).toEqual(['arena-court-schedules', 'a1']);
    expect(arenaKeys.reservas('a1')).toEqual(['arena-bookings', 'a1']);
  });

  it('o recorte de datas faz parte da chave dos bloqueios', () => {
    expect(arenaKeys.bloqueios('a1', undefined, undefined)).toEqual(['arena-unavailabilities', 'a1', undefined, undefined]);
    expect(arenaKeys.bloqueios('a1', '2026-09-01', '2026-09-30'))
      .toEqual(['arena-unavailabilities', 'a1', '2026-09-01', '2026-09-30']);
    // Recortes diferentes NÃO podem colidir: são consultas diferentes.
    expect(arenaKeys.bloqueios('a1', '2026-09-01', null))
      .not.toEqual(arenaKeys.bloqueios('a1', null, '2026-09-01'));
  });

  it('duas chamadas produzem vetores iguais (o hook e a pré-busca se encontram)', () => {
    expect(arenaKeys.reservas('a1')).toEqual(arenaKeys.reservas('a1'));
    expect(arenaKeys.bloqueios('a1')).toEqual(arenaKeys.bloqueios('a1'));
  });
});

describe('⭐ ninguém escreve a chave à mão', () => {
  const arquivos = ['useArenas.js', 'useBookings.js', 'arenaQueries.js', 'arenaPrefetch.js'];
  const COMPARTILHADAS = ['arenas', 'arena', 'arena-courts', 'arena-court-schedules', 'arena-bookings', 'arena-unavailabilities'];
  const literal = new RegExp(`queryKey:\\s*\\[\\s*'(${COMPARTILHADAS.join('|')})'`);
  // Invalidar/limpar PODE usar literal: ali a chave é só um prefixo a
  // combinar, e escrever menos do que a chave inteira é o comportamento
  // desejado. O que não pode é DEFINIR uma consulta com chave escrita à mão —
  // é aí que as duas pontas se desencontram e o cache deixa de se encontrar.
  const deCache = /invalidateQueries|removeQueries|cancelQueries|setQueryData|getQueryData|getQueryState/;

  arquivos.forEach((nome) => {
    it(`${nome} define consultas pelas chaves de arenaKeys`, () => {
      const suspeitas = ler(nome)
        .split('\n')
        .filter((linha) => literal.test(linha) && !deCache.test(linha));
      expect(suspeitas).toEqual([]);
    });
  });

  it('a pré-busca usa as MESMAS opções das consultas de verdade', () => {
    const src = ler('arenaPrefetch.js');
    // Se algum dia alguém montar a busca à mão aqui, o formato guardado pode
    // divergir do que o hook guarda (quadras e janelas saem ORDENADAS).
    expect(src).toContain('arenaQueries.quadras');
    expect(src).toContain('arenaQueries.janelas');
    expect(src).toContain('arenaBookingsQuery');
    expect(src).not.toContain('listArenaCourts(');
  });
});
