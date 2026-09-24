/**
 * Recuperação dos rankings — o gatilho que não disparou.
 *
 * O caso real (2026-09-22): as funções foram apagadas pelo deploy de outro
 * aplicativo do mesmo projeto Firebase, um dia de jogo foi publicado nessa
 * janela e o ranking 2.0–8.0 ficou sem ele. Quando as funções voltaram, nada
 * recalculou, porque nada novo foi escrito.
 *
 * O que estes testes prendem:
 *  1. a primeira execução depois do deploy (sem impressão gravada) RECALCULA;
 *  2. resultado novo, resultado apagado ou torneio que mudou de elegibilidade
 *     RECALCULA;
 *  3. em dia, NÃO recalcula — passada à toa custa escrita e suja o histórico;
 *  4. a passada e a recuperação medem do MESMO jeito (uma função só).
 */
import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  impressaoDosResultados, precisaRecuperar, recuperarSeFaltou,
} = require('./rankingCatchUp.js');

const impressao = (over = {}) => impressaoDosResultados({
  partidasTorneio: 120, jogosEvento: 232, assinatura: 't1:1|t2:2', ...over,
});

describe('impressaoDosResultados', () => {
  it('guarda as duas contagens e um hash curto da assinatura', () => {
    const i = impressao();
    expect(i.tournament_matches).toBe(120);
    expect(i.club_event_games).toBe(232);
    expect(i.signature_hash).toMatch(/^[0-9a-f]{40}$/);
  });

  it('mesma entrada, mesma impressão (a passada e a recuperação batem)', () => {
    expect(impressao()).toEqual(impressao());
  });

  it('assinatura longa não vira documento gigante', () => {
    const longa = Array.from({ length: 500 }, (_, k) => `t${k}:${k}:0`).join('|');
    expect(impressao({ assinatura: longa }).signature_hash).toHaveLength(40);
  });

  it('entrada ausente vira zero, nunca NaN', () => {
    const i = impressaoDosResultados({});
    expect(i.tournament_matches).toBe(0);
    expect(i.club_event_games).toBe(0);
  });
});

describe('precisaRecuperar', () => {
  it('⭐ sem impressão anterior (primeira vez depois do deploy) recupera', () => {
    expect(precisaRecuperar(null, impressao())).toBe(true);
    expect(precisaRecuperar(undefined, impressao())).toBe(true);
  });

  it('⭐ dia de jogo publicado sem passada (12 jogos a mais) recupera', () => {
    expect(precisaRecuperar(impressao({ jogosEvento: 220 }), impressao())).toBe(true);
  });

  it('jogo apagado também recupera (a contagem desceu)', () => {
    expect(precisaRecuperar(impressao({ jogosEvento: 240 }), impressao())).toBe(true);
  });

  it('partida de torneio decidida sem passada recupera', () => {
    expect(precisaRecuperar(impressao({ partidasTorneio: 119 }), impressao())).toBe(true);
  });

  it('torneio que mudou de elegibilidade recupera', () => {
    expect(precisaRecuperar(impressao({ assinatura: 't1:1' }), impressao())).toBe(true);
  });

  it('⭐ em dia, NÃO recupera', () => {
    expect(precisaRecuperar(impressao(), impressao())).toBe(false);
  });
});

/** Banco mínimo: só o documento do trabalhador de ranking. */
function bancoCom(worker) {
  return {
    collection: (nome) => ({
      doc: (id) => ({
        get: async () => {
          const existe = nome === 'platform_settings' && id === 'ranking_worker' && worker !== undefined;
          return { exists: existe, data: () => worker };
        },
      }),
    }),
  };
}

const silencioso = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

describe('recuperarSeFaltou', () => {
  it('⭐ em dia: não chama o recálculo', async () => {
    const requestRankingRecompute = vi.fn();
    const res = await recuperarSeFaltou(bancoCom({ last_result: { fingerprint: impressao() } }), {
      requestRankingRecompute, lerImpressao: async () => impressao(), logger: silencioso,
    });
    expect(res).toEqual({ ran: false, reason: 'em-dia' });
    expect(requestRankingRecompute).not.toHaveBeenCalled();
  });

  it('⭐ faltou passada: pede o recálculo com motivo próprio (vai para o log)', async () => {
    const requestRankingRecompute = vi.fn(async () => ({ ran: true, passadas: 1 }));
    const db = bancoCom({ last_result: { fingerprint: impressao({ jogosEvento: 220 }) } });
    const res = await recuperarSeFaltou(db, {
      requestRankingRecompute, lerImpressao: async () => impressao(), logger: silencioso,
    });
    expect(res).toEqual({ ran: true, reason: 'recalculado' });
    expect(requestRankingRecompute).toHaveBeenCalledWith(db, 'recuperacao-agendada', { logger: silencioso });
  });

  it('⭐ worker nunca gravou impressão (passadas antigas): recalcula uma vez', async () => {
    const requestRankingRecompute = vi.fn(async () => ({ ran: true }));
    await recuperarSeFaltou(bancoCom({ last_result: { matchesUsed: 328 } }), {
      requestRankingRecompute, lerImpressao: async () => impressao(), logger: silencioso,
    });
    expect(requestRankingRecompute).toHaveBeenCalledTimes(1);
  });

  it('sem documento de worker nenhum: recalcula', async () => {
    const requestRankingRecompute = vi.fn(async () => ({ ran: true }));
    await recuperarSeFaltou(bancoCom(undefined), {
      requestRankingRecompute, lerImpressao: async () => impressao(), logger: silencioso,
    });
    expect(requestRankingRecompute).toHaveBeenCalledTimes(1);
  });

  it('recálculo já em curso (lease): devolve coalesced, sem erro', async () => {
    const requestRankingRecompute = vi.fn(async () => ({ ran: false, reason: 'coalesced' }));
    const res = await recuperarSeFaltou(bancoCom({}), {
      requestRankingRecompute, lerImpressao: async () => impressao(), logger: silencioso,
    });
    expect(res).toEqual({ ran: false, reason: 'coalesced' });
  });
});
