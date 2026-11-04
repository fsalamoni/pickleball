import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * MINHA CARREIRA (docs/54): o resultado DECLARADO pela pessoa (torneio de
 * fora, `career_events`) nunca entra em ranking, rating nem XP — "fui
 * campeão" digitado não pode virar ponto de ninguém.
 *
 * Este guarda lê o código dos motores e reprova qualquer menção a `career_`
 * neles: o ranking e o rating do servidor, o ranking oficial das federações,
 * os motores de rating (cliente e servidor) e o motor de XP. Testes ficam de
 * fora (podem citar a coleção para provar que ela não entra).
 */
const ARQUIVOS = ['functions/ranking.js', 'functions/platformRankings.js', 'functions/federationRanking.js'];
const PASTAS = ['src/modules/rating/domain', 'functions/engines'];
// O motor de XP já tem conquistas chamadas `career_*` (a carreira DENTRO da
// plataforma), então ali o guarda olha a coleção e o módulo, não o prefixo.
// A métrica de META `career_events_played` (docs/54 §4.10) é só um nome: os
// valores saem de `career/domain/careerGoals.js`, nunca do motor de XP.
const XP = 'src/modules/progression';

function listar(dir, out = []) {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) listar(p, out);
    else if (/\.(m?js|jsx)$/.test(nome) && !/\.test\./.test(nome)) out.push(p);
  }
  return out;
}

const alvos = [...ARQUIVOS, ...PASTAS.flatMap((d) => listar(d))];

describe('o resultado declarado da carreira não pontua', () => {
  it('há motores para examinar', () => {
    expect(alvos.length).toBeGreaterThan(10);
  });

  it.each(alvos)('%s não menciona career_', (arq) => {
    expect(readFileSync(arq, 'utf8')).not.toMatch(/career_/);
  });

  it('o motor de XP não lê os torneios de fora (nem a coleção, nem o módulo)', () => {
    const fora = listar(XP).filter((arq) => /career_events\b|modules\/career\//.test(readFileSync(arq, 'utf8')));
    expect(fora).toEqual([]);
  });
});
