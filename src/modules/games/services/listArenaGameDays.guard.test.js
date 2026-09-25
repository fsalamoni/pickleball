/**
 * Guarda de fonte: `listArenaGameDays` tem de filtrar por visibilidade.
 *
 * 🐞 Filtrando só por `arena_id`, a consulta era RECUSADA pelas regras para
 * todo mundo menos o admin da plataforma — o gestor da própria arena
 * inclusive (a regra de `game_days` só é provável numa consulta que diga
 * `visibility == 'public'`). O admin testava com a conta de admin e nada
 * aparecia errado; para quem de fato usa, a lista de dias de jogo da Central,
 * a seção da página da arena e o ranking da casa falhavam.
 *
 * O emulador prova o comportamento (`tests/rules/houseRanking.rules.test.js`);
 * este guarda impede que alguém "simplifique" a consulta de volta — tirar o
 * filtro parece inofensivo lendo o código, e os testes de serviço, com banco
 * falso, nunca recusam nada.
 */
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

const fonte = readFileSync('src/modules/games/services/arenaGameDayService.js', 'utf8');

function corpoDe(nome) {
  const inicio = fonte.indexOf(`export async function ${nome}(`);
  if (inicio < 0) return '';
  const proximo = fonte.indexOf('\nexport ', inicio + 1);
  return fonte.slice(inicio, proximo < 0 ? undefined : proximo);
}

describe('listArenaGameDays', () => {
  it('filtra por arena E por visibilidade pública (senão a regra recusa a consulta)', () => {
    const corpo = corpoDe('listArenaGameDays');
    expect(corpo).toMatch(/where\('arena_id', '==', arenaId\)/);
    expect(corpo).toMatch(/where\('visibility', '==', GAME_DAY_VISIBILITY\.PUBLIC\)/);
  });

  it('todo dia de jogo de arena nasce público (é o que torna o filtro inofensivo)', () => {
    const corpo = corpoDe('buildArenaGameDayPayload') || fonte;
    expect(corpo).toMatch(/visibility: GAME_DAY_VISIBILITY\.PUBLIC/);
  });
});
