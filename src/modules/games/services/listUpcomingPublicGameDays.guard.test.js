/**
 * Guarda de fonte: a consulta dos dias de jogo públicos do "Jogar".
 *
 * Duas coisas nela parecem detalhe e não são:
 *  - `visibility == 'public'` é o que a regra de `game_days` consegue provar
 *    para uma CONSULTA — sem ele, o Firestore recusa para todo mundo menos o
 *    admin (e o admin, testando com a própria conta, nunca veria o defeito);
 *  - a data vai numa lista (`in`), nunca numa faixa (`>=`): igualdades são
 *    servidas juntando os índices de campo único, e a faixa pediria um índice
 *    composto NOVO — ou seja, mexer no banco. Sem ele a consulta FALHA, e o
 *    "Jogar" de todo mundo viraria "não carregou".
 *
 * O emulador prova a regra (`tests/rules/publicGameDaysAhead.rules.test.js`);
 * este guarda impede a "simplificação" que os testes de serviço, com banco
 * falso, nunca pegariam.
 */
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

const fonte = readFileSync('src/modules/games/services/gameDayService.js', 'utf8');

function corpoDe(nome) {
  const inicio = fonte.indexOf(`export async function ${nome}(`);
  if (inicio < 0) return '';
  const proximo = fonte.indexOf('\nexport ', inicio + 1);
  return fonte.slice(inicio, proximo < 0 ? undefined : proximo);
}

describe('listUpcomingPublicGameDays', () => {
  const corpo = corpoDe('listUpcomingPublicGameDays');
  const codigo = corpo.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

  it('existe', () => {
    expect(corpo).not.toBe('');
  });
  it('filtra por visibilidade pública (senão a regra recusa a consulta)', () => {
    expect(codigo).toMatch(/where\('visibility', '==', GAME_DAY_VISIBILITY\.PUBLIC\)/);
  });
  it('a data vai numa LISTA de dias, nunca numa faixa (faixa + igualdade pede índice composto)', () => {
    expect(codigo).toMatch(/where\('date', 'in', janela\)/);
    expect(codigo).not.toMatch(/where\('date', '(>=|>|<=|<)'/);
    expect(codigo).not.toMatch(/orderBy\(/);
  });
  it('a lista nunca passa de 30 dias (o limite do `in`)', () => {
    expect(codigo).toMatch(/\.slice\(0, 30\)/);
  });
});

/**
 * A mesma armadilha na consulta dos dias de jogo do CLUBE (privados): o
 * `club_id` fixo é o que deixa a regra provar `isClubMember(club_id)` para a
 * consulta inteira — sem ele, recusada para todo mundo. E a data, de novo,
 * numa lista. Prova no emulador: `tests/rules/clubGameDaysAhead.rules.test.js`.
 */
describe('listUpcomingClubGameDays', () => {
  const corpo = corpoDe('listUpcomingClubGameDays');
  const codigo = corpo.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

  it('existe', () => {
    expect(corpo).not.toBe('');
  });
  it('filtra pelo clube (é o campo que a regra confere)', () => {
    expect(codigo).toMatch(/where\('club_id', '==', clubId\)/);
  });
  it('a data vai numa LISTA de dias, nunca numa faixa, e sem ordenação no servidor', () => {
    expect(codigo).toMatch(/where\('date', 'in', janela\)/);
    expect(codigo).not.toMatch(/where\('date', '(>=|>|<=|<)'/);
    expect(codigo).not.toMatch(/orderBy\(/);
    expect(codigo).toMatch(/\.slice\(0, 30\)/);
  });
});
