import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { buildActivityFacts, achievementUserFromFacts, FACT_SOURCES } from '@/modules/progression/domain/activityFacts.js';
import { computeAchievementsV2 } from '@/modules/achievements/domain/achievementsV2.js';
import { computeTotalXpV2 } from '@/modules/progression/domain/xpTotal.js';
import { PLACEMENT } from '@/modules/career/domain/careerEvent.js';

/**
 * MINHA CARREIRA (docs/54): o resultado DECLARADO pela pessoa (torneio de
 * fora, `career_events`) nunca entra em ranking, rating nem XP — "fui
 * campeão" digitado não pode virar ponto de ninguém.
 *
 * Este guarda lê o código dos motores e reprova qualquer menção a `career_`
 * neles: o ranking e o rating do servidor, o ranking oficial das federações,
 * os motores de rating (cliente e servidor) e o motor de XP. Testes ficam de
 * fora (podem citar a coleção para provar que ela não entra).
 *
 * Desde o PR 5 (gamificação da carreira) o motor de XP CONTA HÁBITOS da
 * carreira — registrar, completar a ficha, fazer o balanço — por UMA porta:
 * a fonte `careerEvents` do serviço de fatos e `career/domain/careerHabits.js`.
 * O guarda prova, por comportamento, que a colocação declarada não muda nem as
 * conquistas, nem o XP da ficha (servidor), nem o placar da temporada.
 */
const ARQUIVOS = ['functions/ranking.js', 'functions/platformRankings.js', 'functions/federationRanking.js', 'functions/seasonRanking.js'];
const PASTAS = ['src/modules/rating/domain', 'functions/engines'];
// O motor de XP já tem conquistas chamadas `career_*` (a carreira DENTRO da
// plataforma), então ali o guarda olha a coleção e o módulo, não o prefixo.
// A métrica de META `career_events_played` (docs/54 §4.10) é só um nome: os
// valores saem de `career/domain/careerGoals.js`, nunca do motor de XP.
const XP = 'src/modules/progression';
/** A única leitura da coleção no motor de XP (só com a flag). */
const FONTE = 'src/modules/progression/services/activityFactsService.js';
/** A única porta de domínio. */
const PORTA = 'modules/career/domain/careerHabits';

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

  it('o motor de XP só fala com a carreira pela fonte dos fatos e pela porta dos hábitos', () => {
    const fora = listar(XP).filter((arq) => {
      const s = readFileSync(arq, 'utf8');
      const colecao = /career_events\b/.test(s) && arq !== FONTE;
      const modulo = (s.match(/modules\/career\/[\w/.]+/g) || []).some((m) => !m.startsWith(PORTA));
      return colecao || modulo;
    });
    expect(fora).toEqual([]);
  });

  it('a porta dos hábitos não lê o VALOR da colocação (só se foi preenchida)', () => {
    const s = readFileSync(`src/${PORTA}.js`, 'utf8');
    expect(s).not.toMatch(/PLACEMENT|champion|runner_up|placement_n|placement\s*===/);
  });
});

describe('a colocação declarada não muda conquista, XP nem temporada', () => {
  const NOW = new Date('2026-11-04T15:00:00Z');
  const fontes = (placement) => ({
    ...Object.fromEntries(FACT_SOURCES.map((n) => [n, []])),
    careerEvents: Array.from({ length: 25 }, (_, i) => ({
      id: `u_e${i}`, uid: 'u', status: 'played', start_date: '2026-09-10',
      entries: [{ format: 'doubles', placement }], photos: [{ path: 'carreira/u/p.jpg' }],
    })),
    debriefs: Array.from({ length: 25 }, (_, i) => ({ uid: 'u', status: 'respondido', source: { type: 'externo', ref_id: `u_e${i}` } })),
  });
  const desbloqueadas = (placement) => {
    const facts = buildActivityFacts(fontes(placement), { now: NOW, profile: { uid: 'u' }, career: true });
    return computeAchievementsV2(achievementUserFromFacts(facts, { uid: 'u' }), { career: true }).unlocked.map((a) => a.id).sort();
  };

  it('campeão e fase de grupos desbloqueiam exatamente as mesmas conquistas', () => {
    const base = desbloqueadas(PLACEMENT.GROUPS);
    expect(base).toContain('mycareer_historian');
    Object.values(PLACEMENT).forEach((p) => expect(desbloqueadas(p)).toEqual(base));
  });

  it('o XP da ficha (servidor) é o mesmo para qualquer colocação', () => {
    const requerer = createRequire(import.meta.url);
    const x = requerer('../../../functions/careerXp.js');
    const ev = (placement) => ({ id: 'u_e1', uid: 'u', status: 'played', start_date: '2026-10-10', entries: [{ placement }], photos: [{ path: 'carreira/u/p.jpg' }] });
    const bal = { uid: 'u', status: 'respondido', source: { type: 'externo', ref_id: 'u_e1' } };
    Object.values(PLACEMENT).forEach((p) => expect(x.fichaPaga(ev(p), bal, '2026-11-04')).toBe(true));
    expect(readFileSync('functions/careerXp.js', 'utf8')).not.toMatch(/PLACEMENT|champion|runner_up|placement_n/);
  });

  it('o XP da ficha é concedido pelo servidor e sai do placar da temporada', () => {
    const requerer = createRequire(import.meta.url);
    const { buildRankingRows } = requerer('../../../functions/seasonRanking.js');
    const grants = [{ id: 'u_career_e1', uid: 'u', kind: 'career', xp: 25 }];
    const { xpTotal, breakdown } = computeTotalXpV2({ grantDocs: grants, uid: 'u' });
    expect(breakdown.grants).toBe(25);
    const config = { season: { publicMinTier: 'Calouro' } };
    const linhas = (p) => buildRankingRows({ progressoes: [p], existentes: new Map([['u', { baselineXp: 0 }]]), config });
    const com = linhas({ uid: 'u', xpTotal, grantsXp: breakdown.grants });
    const sem = linhas({ uid: 'u', xpTotal: 0, grantsXp: 0 });
    expect(com.temporada[0].xp).toBe(0);
    expect(com.temporada[0].xp).toBe(sem.temporada[0].xp);
  });
});
