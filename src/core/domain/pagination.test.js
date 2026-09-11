import { describe, it, expect } from 'vitest';
import {
  PAGE_SIZES, DEFAULT_PAGE_SIZE, normalizePageSize, paginate, pageNumbers,
} from './pagination.js';

const lista = (n) => Array.from({ length: n }, (_, i) => ({ i }));

describe('PAGE_SIZES', () => {
  it('oferece 20, 50 e 100', () => {
    expect(PAGE_SIZES).toEqual([20, 50, 100]);
    expect(DEFAULT_PAGE_SIZE).toBe(20);
  });
  it('é congelado (ninguém altera a lista por engano em runtime)', () => {
    expect(Object.isFrozen(PAGE_SIZES)).toBe(true);
  });
});

describe('normalizePageSize', () => {
  it('aceita os tamanhos oferecidos', () => {
    expect(normalizePageSize(20)).toBe(20);
    expect(normalizePageSize(50)).toBe(50);
    expect(normalizePageSize(100)).toBe(100);
    expect(normalizePageSize('50')).toBe(50); // veio da URL, é string
  });
  it('⭐ qualquer outra coisa cai no padrão — inclusive lixo vindo da URL', () => {
    [0, -1, 7, 999999, 'abc', null, undefined, NaN, Infinity, {}]
      .forEach((v) => expect(normalizePageSize(v)).toBe(DEFAULT_PAGE_SIZE));
  });
});

describe('paginate', () => {
  it('recorta a página pedida e informa o intervalo mostrado', () => {
    const r = paginate(lista(137), 2, 20);
    expect(r.pageItems).toHaveLength(20);
    expect(r.pageItems[0].i).toBe(20);
    expect(r.page).toBe(2);
    expect(r.pageCount).toBe(7);
    expect(r.total).toBe(137);
    expect(r.from).toBe(21);
    expect(r.to).toBe(40);
  });

  it('a última página pode vir incompleta, e `to` respeita o total', () => {
    const r = paginate(lista(137), 7, 20);
    expect(r.pageItems).toHaveLength(17);
    expect(r.from).toBe(121);
    expect(r.to).toBe(137);
  });

  it('⭐ página acima do fim volta para a última (não devolve tela vazia)', () => {
    const r = paginate(lista(50), 99, 20);
    expect(r.page).toBe(3);
    expect(r.pageItems).toHaveLength(10);
  });

  it('⭐ página abaixo de 1, ou inválida, vira a primeira', () => {
    [0, -5, 'abc', null, undefined, NaN].forEach((p) => {
      expect(paginate(lista(50), p, 20).page).toBe(1);
    });
  });

  it('lista vazia tem 1 página vazia (não 0) e intervalo 0–0', () => {
    const r = paginate([], 1, 20);
    expect(r.pageCount).toBe(1);
    expect(r.total).toBe(0);
    expect(r.pageItems).toEqual([]);
    expect(r.from).toBe(0);
    expect(r.to).toBe(0);
  });

  it('aguenta entrada não-array sem quebrar', () => {
    expect(paginate(null).total).toBe(0);
    expect(paginate(undefined).pageItems).toEqual([]);
  });

  it('trocar o tamanho da página muda a contagem de páginas', () => {
    expect(paginate(lista(137), 1, 20).pageCount).toBe(7);
    expect(paginate(lista(137), 1, 50).pageCount).toBe(3);
    expect(paginate(lista(137), 1, 100).pageCount).toBe(2);
  });

  it('não muta a lista recebida', () => {
    const original = lista(30);
    const copia = original.slice();
    paginate(original, 2, 20);
    expect(original).toEqual(copia);
  });

  it('as páginas cobrem a lista inteira, sem buraco nem repetição', () => {
    const itens = lista(137);
    const vistos = [];
    for (let p = 1; p <= 7; p += 1) vistos.push(...paginate(itens, p, 20).pageItems);
    expect(vistos).toEqual(itens);
  });
});

describe('pageNumbers', () => {
  it('poucas páginas: mostra TODAS, sem reticências', () => {
    expect(pageNumbers(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageNumbers(3, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageNumbers(1, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]); // o limite
    // A partir de 8 a reticência passa a esconder mais de uma página.
    expect(pageNumbers(1, 8)).toEqual([1, 2, '…', 8]);
  });

  it('muitas páginas no meio: primeira, janela, última', () => {
    expect(pageNumbers(10, 20)).toEqual([1, '…', 9, 10, 11, '…', 20]);
  });

  it('no começo e no fim não sobra reticência solta', () => {
    expect(pageNumbers(1, 20)).toEqual([1, 2, '…', 20]);
    expect(pageNumbers(20, 20)).toEqual([1, '…', 19, 20]);
  });

  it('a primeira e a última estão SEMPRE presentes', () => {
    for (let p = 1; p <= 20; p += 1) {
      const n = pageNumbers(p, 20);
      expect(n[0]).toBe(1);
      expect(n[n.length - 1]).toBe(20);
    }
  });

  it('uma página só: devolve só ela, sem duplicar', () => {
    expect(pageNumbers(1, 1)).toEqual([1]);
  });

  it('entradas inválidas não quebram a barra de navegação', () => {
    expect(pageNumbers(NaN, NaN)).toEqual([1]);
    expect(pageNumbers(99, 3)).toEqual([1, 2, 3]);
    expect(pageNumbers(-4, 3)).toEqual([1, 2, 3]);
  });

  it('nunca repete um número', () => {
    const n = pageNumbers(2, 3);
    const numeros = n.filter((x) => typeof x === 'number');
    expect(new Set(numeros).size).toBe(numeros.length);
  });
});
