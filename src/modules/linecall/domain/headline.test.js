/**
 * O lance que a tela ANUNCIA — o mesmo na câmera, na central e no telão — e o
 * que acabou de CHEGAR (para o aviso sair uma vez só por lance).
 *
 * O pé do saque é marcado na hora da BATIDA e só sai quando o saque segue (no
 * quique dele); a falta de impulso na cozinha sai até `momentumMaxS` depois do
 * voleio. Pela hora do lance eles nunca são "o último", e pela ordem do lote o
 * pé limpo vinha antes do saque fora. A manchete é por GRAVIDADE dentro de uma
 * janela.
 */
import { describe, it, expect } from 'vitest';
import { createLineCallEngine, ENGINE_DEFAULTS } from './lineCallEngine.js';
import { COURT } from './court.js';
import { CAMS, ballPath, bounce, player, frames } from './testkit/courtSim.js';
import { pickHeadline, headlineFirst, newArrivals, lanceKeys, HEADLINE_WINDOW_MS } from './fusion.js';

const { LENGTH: L } = COURT;

const lance = (id, call, tMs, extra = {}) => ({ id, kind: 'bounce', call, t_ms: tMs, decided: false, calls: [{ id }], ...extra });

describe('pickHeadline: o lance que a tela anuncia', () => {
  it('sem lance, nada', () => {
    expect(pickHeadline([])).toBeNull();
    expect(pickHeadline(null)).toBeNull();
  });

  it('o pé do saque em revisão vence o quique do saque que chegou depois (docs/53 §5)', () => {
    const pe = lance('pe', 'review', 1000, { kind: 'serve_foot' });
    const quique = lance('q', 'in', 1900, { serve: true });
    expect(pickHeadline([quique, pe])).toBe(pe);
  });

  it('a falta mais antiga dentro da janela vence o "dentro" mais novo', () => {
    const falta = lance('f', 'fault', 1000, { kind: 'volley' });
    expect(pickHeadline([lance('a', 'in', 3500), falta])).toBe(falta);
  });

  it('fora da janela vale o mais recente', () => {
    const novo = lance('n', 'in', 1000 + HEADLINE_WINDOW_MS + 1);
    expect(pickHeadline([novo, lance('f', 'out', 1000)])).toBe(novo);
  });

  it('o "revisar" sem decisão passa na frente do decidido, e a falta decidida, na frente do "dentro" mais novo', () => {
    const pendente = lance('r', 'review', 1000);
    expect(pickHeadline([lance('d', 'out', 1900, { decided: true }), pendente])).toBe(pendente);
    // Decidida a falta do pé no saque, o "Saque: dentro" que veio depois não a apaga da tela.
    const faltaDecidida = lance('p', 'fault', 1000, { kind: 'serve_foot', decided: true });
    expect(pickHeadline([lance('q', 'in', 1900, { serve: true }), faltaDecidida])).toBe(faltaDecidida);
    // Decidido "sem falta", o lance volta a pesar como um "dentro": vale o mais novo.
    const semFalta = lance('p2', 'clean', 1000, { kind: 'serve_foot', decided: true });
    const quique = lance('q2', 'in', 1900, { serve: true });
    expect(pickHeadline([quique, semFalta])).toBe(quique);
  });

  it('empate de gravidade: o mais recente, em qualquer ordem da lista', () => {
    const a = lance('a', 'out', 1000);
    const b = lance('b', 'out', 1500);
    expect(pickHeadline([a, b])).toBe(b);
    expect(pickHeadline([b, a])).toBe(b);
  });

  it('serve para o evento do motor (hora em segundos do vídeo)', () => {
    const pe = { id: '1', type: 'serve_foot', call: 'clean', t: 0 };
    const fora = { id: '2', type: 'bounce', call: 'out', t: 1, serve: true };
    expect(pickHeadline([pe, fora])).toBe(fora);
    expect(headlineFirst([pe, fora])).toEqual([fora, pe]);
  });

  it('a janela cobre a falta de impulso, que sai até momentumMaxS depois do voleio (11.A.2)', () => {
    expect(HEADLINE_WINDOW_MS).toBeGreaterThanOrEqual(ENGINE_DEFAULTS.momentumMaxS * 1000);
  });
});

describe('newArrivals: o que chegou desde a última olhada', () => {
  const a = lance('a', 'in', 1000);
  const b = lance('b', 'out', 2000);

  it('a primeira olhada é a base: nada é novo (o que já estava na tela não toca)', () => {
    const r = newArrivals([b, a], null);
    expect(r.fresh).toEqual([]);
    expect([...r.seen].sort()).toEqual(['a', 'b']);
  });

  it('marcação nova é lance novo', () => {
    const { seen } = newArrivals([b, a], null);
    const c = lance('c', 'out', 3000);
    expect(newArrivals([c, b, a], seen).fresh).toEqual([c]);
  });

  it('o lance que trocou de id porque uma câmera atrasada entrou ANTES na junção não chega de novo', () => {
    const { seen } = newArrivals([{ id: 'c2', calls: [{ id: 'c2' }] }], null);
    const junto = { id: 'c1', calls: [{ id: 'c1' }, { id: 'c2' }] };
    expect(newArrivals([junto], seen).fresh).toEqual([]);
  });

  it('o lance que se dividiu também não', () => {
    const { seen } = newArrivals([{ id: 'x', calls: [{ id: 'x' }, { id: 'y' }] }], null);
    const r = newArrivals([{ id: 'x', calls: [{ id: 'x' }] }, { id: 'y', calls: [{ id: 'y' }] }], seen);
    expect(r.fresh).toEqual([]);
  });

  it('evento do motor (sem marcações) pela própria chave; lista limpa recomeça', () => {
    expect(lanceKeys({ id: 'e1' })).toEqual(['e1']);
    const { seen } = newArrivals([{ id: 'e1' }], null);
    const vazio = newArrivals([], seen);
    expect(vazio.fresh).toEqual([]);
    const e2 = { id: 'e2' };
    expect(newArrivals([e2], vazio.seen).fresh).toEqual([e2]);
  });
});

/**
 * Os lotes que o motor solta, quadro a quadro, no saque de A visto do fundo A
 * (o arranjo de uma câmera só): o pé de quem saca, limpo, e o saque que cai
 * LONGO. Quem está atrás de quem saca não vê a bola "seguir" antes do quique,
 * e o pé sai junto com o quique, no mesmo lote.
 */
function serveLongBatches(fps) {
  const cam = CAMS.fundoA();
  const sA = player({ x: 1.5, y: -0.3 });
  const w = sA.wrist(0);
  const hit = { t: 0, p: [w[0], w[1] + sA.facing * 0.2, 0.6] };
  const ball = [{ t: -0.35, p: [hit.p[0], hit.p[1], hit.p[2] + 0.5] }, hit, bounce(1.0, 4.5, 13.8), { t: 1.3, p: [4.6, 15.0, 0.8] }];
  const e = createLineCallEngine({ H: cam.H, options: { imageSize: cam.size } });
  const fr = frames({ cam, ball: ballPath(ball), players: [sA, player({ x: 4.6, y: L + 0.3 })], fps, from: -0.65, to: 4.8, seed: 3 });
  return fr.map((f) => e.push(f)).filter((lote) => lote.length);
}

describe('a câmera que filma: o lote de um quadro', () => {
  it.each([60, 30])('%i quadros/s: o saque fora é o que se anuncia, não o pé limpo que veio junto', (fps) => {
    const lotes = serveLongBatches(fps);
    const lote = lotes.find((l) => l.some((e) => e.type === 'bounce' && e.call === 'out'));
    expect(lote).toBeTruthy();
    expect(pickHeadline(lote)).toMatchObject({ type: 'bounce', call: 'out', reason: 'long' });
    expect(headlineFirst(lote)[0]).toMatchObject({ type: 'bounce', call: 'out' });
    expect(headlineFirst(lote)).toHaveLength(lote.length);
  });
});
