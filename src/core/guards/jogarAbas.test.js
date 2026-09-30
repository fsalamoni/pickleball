/**
 * Guarda de fonte: o "Jogar" abre no DIA DE JOGO, e as abas seguem a ordem
 * pedida — Dia de jogo, Procura-se jogo, Encontrar jogadores.
 *
 * *"Em jogar, a ordem de abas deve ser a seguinte: dia de jogo, procura-se
 * jogo, encontrar jogadores. Em regra, ao clicar em jogar, o usuário deve
 * entrar direto na aba dia de jogo."*
 *
 * A ordem é só a posição de três linhas num vetor, e o destino é um `? :` —
 * nada disso dá erro quando alguém "arruma" o menu. Este guarda lê o código.
 */
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

const fonte = readFileSync('src/v2/components/V2Layout.jsx', 'utf8');

function blocoDoHubJogar() {
  const inicio = fonte.indexOf("id: 'jogar'");
  expect(inicio, 'o hub "jogar" sumiu do menu').toBeGreaterThan(-1);
  // Até o fim da lista de abas (o `to: jogarHubTo({…}),` também tem "}),").
  const fim = fonte.indexOf('],', fonte.indexOf('children: [', inicio));
  return fonte.slice(inicio, fim);
}

describe('o "Jogar" do menu', () => {
  it('⭐ as abas vêm na ordem: Dia de jogo, Procura-se jogo, Encontrar jogadores', () => {
    const bloco = blocoDoHubJogar();
    const dia = bloco.indexOf("to: '/dia-de-jogo'");
    const procura = bloco.indexOf("to: '/procura-jogo'");
    const encontrar = bloco.indexOf("to: '/encontrar-jogadores'");
    expect(dia).toBeGreaterThan(-1);
    expect(procura).toBeGreaterThan(dia);
    expect(encontrar).toBeGreaterThan(procura);
  });

  it('⭐ tocar em "Jogar" leva ao Dia de jogo (sem ele, Procura-se jogo)', () => {
    expect(blocoDoHubJogar()).toMatch(/to: jogarHubTo\(/);
    const corpo = fonte.slice(fonte.indexOf('function jogarHubTo('), fonte.indexOf('function resolvePageTitle('));
    const primeiro = corpo.indexOf("'/dia-de-jogo'");
    expect(primeiro).toBeGreaterThan(-1);
    expect(corpo.indexOf("'/procura-jogo'")).toBeGreaterThan(primeiro);
    expect(corpo).toMatch(/if \(gameDayOn\) return '\/dia-de-jogo'/);
  });
});
