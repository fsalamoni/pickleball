import { describe, it, expect } from 'vitest';
import {
  PLAY_STATUS, PLAY_GAME_STATUS,
  playLevelValue, inCourtIdsFromGames, playParticipantStatus,
  computePlayOrder, buildPlayNextMatch, nextAvailableExcluding, pickSwapReplacement,
  eligibleSwapReplacements, isEligibleSwapReplacement,
  assignPlayTeams, freePlayCourts, nextFreePlayCourt, forecastPlayMatches,
} from './gamePlay.js';

// Helper: participante disponível com espera crescente por índice.
const P = (id, over = {}) => ({
  id,
  name: id.toUpperCase(),
  available_since: 1000 + (over.wait ?? 0),
  available_tie: over.tie ?? 0,
  created_at_ms: 1000 + (over.wait ?? 0),
  skip_remaining: over.skip ?? 0,
  partner_id: over.partner ?? null,
  play_level: over.level,
  play_gender: over.gender,
});

const openGame = (court, ids) => ({
  court,
  status: PLAY_GAME_STATUS.OPEN,
  side_a: ids.slice(0, 2).map((id) => ({ id, name: id })),
  side_b: ids.slice(2, 4).map((id) => ({ id, name: id })),
});

describe('gamePlay — utilidades', () => {
  it('playLevelValue aceita número, string USAP e cai no padrão', () => {
    expect(playLevelValue({ play_level: 3.5 })).toBe(3.5);
    expect(playLevelValue({ play_level: '2.5' })).toBe(2.5);
    expect(playLevelValue({ play_level: '3.0 – 3.5' })).toBe(3.0);
    expect(playLevelValue({ play_level: '3,5' })).toBe(3.5);
    expect(playLevelValue({})).toBe(3.0);
  });

  it('inCourtIdsFromGames ignora jogos finalizados', () => {
    const games = [
      openGame(1, ['a', 'b', 'c', 'd']),
      { ...openGame(2, ['e', 'f', 'g', 'h']), status: PLAY_GAME_STATUS.FINISHED },
    ];
    const ids = inCourtIdsFromGames(games);
    expect([...ids].sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('playParticipantStatus deriva in_court / unavailable / available', () => {
    const inCourt = new Set(['a']);
    expect(playParticipantStatus({ id: 'a' }, inCourt)).toBe(PLAY_STATUS.IN_COURT);
    expect(playParticipantStatus({ id: 'b', skip_remaining: 2 }, inCourt)).toBe(PLAY_STATUS.UNAVAILABLE);
    expect(playParticipantStatus({ id: 'c' }, inCourt)).toBe(PLAY_STATUS.AVAILABLE);
  });
});

describe('computePlayOrder', () => {
  it('ordena disponíveis por espera e numera 1..k; separa em quadra e indisponíveis', () => {
    const participants = [
      P('a', { wait: 3 }),
      P('b', { wait: 1 }),
      P('c', { wait: 2 }),
      P('d', { skip: 1 }), // indisponível
      P('e', { wait: 0 }), // em quadra (via games)
    ];
    const games = [openGame(1, ['e', 'x', 'y', 'z'])];
    const { order, inCourt, unavailable } = computePlayOrder({ participants, games });
    expect(order.map((p) => p.id)).toEqual(['b', 'c', 'a']); // por espera
    expect(order.map((p) => p.orderNo)).toEqual([1, 2, 3]);
    expect(inCourt.map((p) => p.id)).toEqual(['e']);
    expect(unavailable.map((p) => p.id)).toEqual(['d']);
  });

  it('empate de available_since é desempatado por available_tie (sorteio embutido)', () => {
    const participants = [
      P('a', { wait: 5, tie: 0.9 }),
      P('b', { wait: 5, tie: 0.1 }),
      P('c', { wait: 5, tie: 0.5 }),
    ];
    const { order } = computePlayOrder({ participants, games: [] });
    expect(order.map((p) => p.id)).toEqual(['b', 'c', 'a']);
  });
});

describe('buildPlayNextMatch', () => {
  it('pega os 4 primeiros da ordem quando não há duplas', () => {
    const order = ['a', 'b', 'c', 'd', 'e', 'f'].map((id, i) => P(id, { wait: i }));
    expect(buildPlayNextMatch(order)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('retorna null quando faltam jogadores', () => {
    const order = ['a', 'b', 'c'].map((id, i) => P(id, { wait: i }));
    expect(buildPlayNextMatch(order)).toBeNull();
  });

  it('mantém a dupla fixa junta quando ela cabe na frente', () => {
    // ordem: x(par y), y, a, b
    const order = [
      P('x', { wait: 0, partner: 'y' }),
      P('y', { wait: 1, partner: 'x' }),
      P('a', { wait: 2 }),
      P('b', { wait: 3 }),
    ];
    expect(buildPlayNextMatch(order)).toEqual(['x', 'y', 'a', 'b']);
  });

  it('empurra a dupla que furaria a ordem e antecipa um solo (exemplo do enunciado)', () => {
    // E,F,G,H,I,J com H em dupla com I -> jogo vira E,F,G,J; dupla H,I fica p/ a próxima
    const order = ['e', 'f', 'g', 'h', 'i', 'j'].map((id, idx) => {
      if (id === 'h') return P('h', { wait: idx, partner: 'i' });
      if (id === 'i') return P('i', { wait: idx, partner: 'h' });
      return P(id, { wait: idx });
    });
    expect(buildPlayNextMatch(order)).toEqual(['e', 'f', 'g', 'j']);
  });

  it('não antecipa o parceiro por cima de quem está na frente (inclui os do meio)', () => {
    // x(par y), a, b, c, y, d -> dupla furaria a ordem (y muito atrás) => {a,b,c,d}
    const order = [
      P('x', { wait: 0, partner: 'y' }),
      P('a', { wait: 1 }),
      P('b', { wait: 2 }),
      P('c', { wait: 3 }),
      P('y', { wait: 4, partner: 'x' }),
      P('d', { wait: 5 }),
    ];
    expect(buildPlayNextMatch(order)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('a dupla empurrada entra na partida seguinte, na frente', () => {
    // Após empurrar h,i, a próxima ordem tem h,i na frente
    const order = [
      P('h', { wait: 0, partner: 'i' }),
      P('i', { wait: 1, partner: 'h' }),
      P('k', { wait: 2 }),
      P('l', { wait: 3 }),
    ];
    expect(buildPlayNextMatch(order)).toEqual(['h', 'i', 'k', 'l']);
  });

  it('quem tem parceiro indisponível aguarda (não joga sozinho)', () => {
    // x quer jogar com y, mas y não está na ordem (em quadra). x aguarda.
    const order = [
      P('x', { wait: 0, partner: 'y' }),
      P('a', { wait: 1 }),
      P('b', { wait: 2 }),
      P('c', { wait: 3 }),
      P('d', { wait: 4 }),
    ];
    expect(buildPlayNextMatch(order)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('nextAvailableExcluding pega o primeiro fora da exclusão', () => {
    const order = ['a', 'b', 'c'].map((id, i) => P(id, { wait: i }));
    expect(nextAvailableExcluding(order, ['a']).id).toBe('b');
    expect(nextAvailableExcluding(order, ['a', 'b', 'c'])).toBeNull();
  });

  it('pickSwapReplacement exclui quem está no jogo E quem já saiu deste jogo', () => {
    const order = ['a', 'b', 'c', 'd'].map((id, i) => P(id, { wait: i }));
    // 'a' está no jogo → substituto é o próximo da fila, 'b'.
    expect(pickSwapReplacement(order, { inGameIds: ['a'] }).id).toBe('b');
    // 'a' já foi substituído para FORA deste jogo: mesmo disponível na fila, não
    // volta; o substituto da vez é 'c' (pula 'a' e o atual 'b').
    expect(pickSwapReplacement(order, { inGameIds: ['b'], swappedOutIds: ['a'] }).id).toBe('c');
    // Sem ninguém elegível → null (não recoloca um já-substituído).
    expect(pickSwapReplacement(order, { inGameIds: ['c'], swappedOutIds: ['a', 'b', 'd'] })).toBeNull();
  });

  it('eligibleSwapReplacements devolve TODOS os elegíveis, na ordem de participação', () => {
    const order = ['a', 'b', 'c', 'd', 'e'].map((id, i) => P(id, { wait: i }));
    // 'a' está em quadra; 'b' já saiu desta partida antes. Sobram c, d, e.
    const elegiveis = eligibleSwapReplacements(order, { inGameIds: ['a'], swappedOutIds: ['b'] });
    expect(elegiveis.map((p) => p.id)).toEqual(['c', 'd', 'e']);
    // Sem contexto, todo mundo é elegível — e a ordem recebida é preservada.
    expect(eligibleSwapReplacements(order, {}).map((p) => p.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
    // Lista vazia/ausente não quebra.
    expect(eligibleSwapReplacements([], { inGameIds: ['a'] })).toEqual([]);
    expect(eligibleSwapReplacements(null)).toEqual([]);
  });

  it('⭐ pickSwapReplacement é SEMPRE o primeiro de eligibleSwapReplacements', () => {
    // Esta é a garantia que impede a tela e o serviço de discordarem: escolher
    // "o próximo da ordem" na lista oferecida tem de dar exatamente o mesmo
    // jogador que a substituição automática escolheria sozinha.
    const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
    const order = ids.map((id, i) => P(id, { wait: i }));
    let combinacoes = 0;
    for (let mascaraJogo = 0; mascaraJogo < 64; mascaraJogo += 1) {
      for (let mascaraFora = 0; mascaraFora < 64; mascaraFora += 1) {
        const inGameIds = ids.filter((_, i) => mascaraJogo & (1 << i));
        const swappedOutIds = ids.filter((_, i) => mascaraFora & (1 << i));
        const ctx = { inGameIds, swappedOutIds };
        const auto = pickSwapReplacement(order, ctx);
        const lista = eligibleSwapReplacements(order, ctx);
        expect(auto ? auto.id : null).toBe(lista.length ? lista[0].id : null);
        combinacoes += 1;
      }
    }
    expect(combinacoes).toBe(4096);
  });

  it('isEligibleSwapReplacement recusa quem está em quadra, quem já saiu e id vazio', () => {
    const order = ['a', 'b', 'c'].map((id, i) => P(id, { wait: i }));
    const ctx = { inGameIds: ['a'], swappedOutIds: ['b'] };
    expect(isEligibleSwapReplacement(order, 'c', ctx)).toBe(true);
    expect(isEligibleSwapReplacement(order, 'a', ctx)).toBe(false); // está em quadra
    expect(isEligibleSwapReplacement(order, 'b', ctx)).toBe(false); // já saiu desta partida
    expect(isEligibleSwapReplacement(order, 'zzz', ctx)).toBe(false); // nem está na fila
    expect(isEligibleSwapReplacement(order, '', ctx)).toBe(false);
    expect(isEligibleSwapReplacement(order, null, ctx)).toBe(false);
  });
});

describe('assignPlayTeams', () => {
  const rng = () => 0; // determinístico

  it('prioriza duplas mistas', () => {
    const four = [
      P('m1', { gender: 'male', level: 3 }),
      P('m2', { gender: 'male', level: 3 }),
      P('f1', { gender: 'female', level: 3 }),
      P('f2', { gender: 'female', level: 3 }),
    ];
    const { side_a, side_b } = assignPlayTeams(four, { rng });
    const mixed = (pair) => {
      const g = pair.map((id) => four.find((p) => p.id === id).play_gender);
      return g.includes('male') && g.includes('female');
    };
    expect(mixed(side_a)).toBe(true);
    expect(mixed(side_b)).toBe(true);
  });

  it('equilibra o nível dos lados quando não dá para ser misto', () => {
    // todos homens; níveis 4,4,2,2 -> lados equilibrados 4+2 vs 4+2
    const four = [
      P('a', { gender: 'male', level: 4 }),
      P('b', { gender: 'male', level: 4 }),
      P('c', { gender: 'male', level: 2 }),
      P('d', { gender: 'male', level: 2 }),
    ];
    const { side_a, side_b } = assignPlayTeams(four, { rng });
    const sum = (pair) => pair.reduce((s, id) => s + four.find((p) => p.id === id).play_level, 0);
    expect(sum(side_a)).toBe(sum(side_b)); // 6 e 6
  });

  it('respeita a dupla fixa (mesmo lado)', () => {
    const four = [
      P('x', { partner: 'y', level: 4, gender: 'male' }),
      P('y', { partner: 'x', level: 2, gender: 'male' }),
      P('c', { level: 3, gender: 'female' }),
      P('d', { level: 3, gender: 'female' }),
    ];
    const { side_a, side_b } = assignPlayTeams(four, { rng });
    const together = (pair) => pair.includes('x') && pair.includes('y');
    expect(together(side_a) || together(side_b)).toBe(true);
  });
});

describe('forecastPlayMatches', () => {
  // n disponíveis, em ordem
  const avail = (n) => Array.from({ length: n }, (_, i) => P(`p${i}`, { wait: i }));

  it('2 quadras, 2 disponíveis: 1 bloco parcial (2 + 2 aguardando)', () => {
    const blocks = forecastPlayMatches(avail(2), { courts: 2 });
    expect(blocks).toHaveLength(1);
    expect(blocks[0].players.map((p) => p.id)).toEqual(['p0', 'p1']);
    expect(blocks[0].waiting).toBe(2);
    expect(blocks[0].full).toBe(false);
  });

  it('2 quadras, 10 disponíveis: 2 blocos completos (sobra 2 fora da previsão)', () => {
    const blocks = forecastPlayMatches(avail(10), { courts: 2 });
    expect(blocks).toHaveLength(2);
    expect(blocks.every((b) => b.full && b.waiting === 0)).toBe(true);
    expect(blocks[0].players.map((p) => p.id)).toEqual(['p0', 'p1', 'p2', 'p3']);
    expect(blocks[1].players.map((p) => p.id)).toEqual(['p4', 'p5', 'p6', 'p7']);
  });

  it('2 quadras, 6 disponíveis: 1 bloco completo + 1 parcial (2 + 2 aguardando)', () => {
    const blocks = forecastPlayMatches(avail(6), { courts: 2 });
    expect(blocks).toHaveLength(2);
    expect(blocks[0].full).toBe(true);
    expect(blocks[1].full).toBe(false);
    expect(blocks[1].players.map((p) => p.id)).toEqual(['p4', 'p5']);
    expect(blocks[1].waiting).toBe(2);
  });

  it('sem disponíveis: previsão vazia', () => {
    expect(forecastPlayMatches([], { courts: 2 })).toEqual([]);
  });

  it('respeita a dupla que fura a ordem também na previsão', () => {
    // e,f,g,h(par i),i,j,k,l -> bloco1: e,f,g,j ; bloco2 começa com h,i
    const order = ['e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'].map((id, idx) => {
      if (id === 'h') return P('h', { wait: idx, partner: 'i' });
      if (id === 'i') return P('i', { wait: idx, partner: 'h' });
      return P(id, { wait: idx });
    });
    const blocks = forecastPlayMatches(order, { courts: 2 });
    expect(blocks[0].players.map((p) => p.id)).toEqual(['e', 'f', 'g', 'j']);
    expect(blocks[1].players.map((p) => p.id).slice(0, 2)).toEqual(['h', 'i']);
  });
});

describe('quadras', () => {
  it('freePlayCourts / nextFreePlayCourt consideram só jogos abertos', () => {
    const games = [
      openGame(1, ['a', 'b', 'c', 'd']),
      { ...openGame(2, ['e', 'f', 'g', 'h']), status: PLAY_GAME_STATUS.FINISHED },
    ];
    expect(freePlayCourts({ courts: 3, games })).toEqual([2, 3]);
    expect(nextFreePlayCourt({ courts: 3, games })).toBe(2);
    expect(nextFreePlayCourt({ courts: 1, games: [openGame(1, ['a', 'b', 'c', 'd'])] })).toBeNull();
  });
});
