import { describe, it, expect } from 'vitest';
import { canDiscardStageMatches, decidedMatchCount, isDecidedMatch } from './drawSafety.js';
import { MATCH_STATUS } from './constants.js';

const jogo = (status) => ({ status });
const disputado = jogo(MATCH_STATUS.FINISHED);
const wo = jogo(MATCH_STATUS.WALKOVER);
const pendente = jogo(MATCH_STATUS.SCHEDULED);

describe('isDecidedMatch — o que tem resultado', () => {
  it('disputado e W.O. contam; o resto não', () => {
    expect(isDecidedMatch(disputado)).toBe(true);
    expect(isDecidedMatch(wo)).toBe(true);
    expect(isDecidedMatch(pendente)).toBe(false);
    expect(isDecidedMatch(undefined)).toBe(false);
  });
});

describe('decidedMatchCount', () => {
  it('conta só o que tem resultado', () => {
    expect(decidedMatchCount([disputado, pendente, wo, pendente])).toBe(2);
  });
  it('lista vazia ou ausente não quebra', () => {
    expect(decidedMatchCount()).toBe(0);
    expect(decidedMatchCount([])).toBe(0);
  });
});

describe('canDiscardStageMatches — a segunda tranca', () => {
  it('⭐ fase COM resultado e SEM reconhecimento é recusada', () => {
    const r = canDiscardStageMatches([disputado, disputado, pendente]);
    expect(r.allowed).toBe(false);
    expect(r.decided).toBe(2);
    expect(r.reason).toMatch(/2 jogo\(s\) com resultado/);
  });

  it('⭐ a recusa DIZ o caminho: recarregar, e que o botão vira "Re-sortear"', () => {
    const { reason } = canDiscardStageMatches([disputado]);
    expect(reason).toMatch(/Recarregue a página/);
    expect(reason).toMatch(/Re-sortear/);
  });

  it('⭐ com reconhecimento explícito, segue — é o re-sorteio legítimo', () => {
    expect(canDiscardStageMatches([disputado], { acknowledged: true }).allowed).toBe(true);
  });

  it('⭐ fase sem resultado nenhum segue sem perguntar nada', () => {
    // Exigir confirmação aqui treinaria a pessoa a clicar em "sim" sem ler.
    expect(canDiscardStageMatches([pendente, pendente]).allowed).toBe(true);
    expect(canDiscardStageMatches([]).allowed).toBe(true);
  });

  it('W.O. é resultado — um W.O. apagado é uma decisão de mesa perdida', () => {
    expect(canDiscardStageMatches([wo]).allowed).toBe(false);
  });

  it('reconhecimento só vale se for exatamente true', () => {
    expect(canDiscardStageMatches([disputado], { acknowledged: 'sim' }).allowed).toBe(false);
    expect(canDiscardStageMatches([disputado], { acknowledged: 1 }).allowed).toBe(false);
  });
});
