/**
 * Ranking oficial da federação no SERVIDOR, contra o Firestore falso: o
 * resultado enviado LANÇA os pontos de cada atleta no histórico
 * (`federation_points`) e soma o ano; recusar/retirar CANCELA o lançamento
 * (com o motivo, sem apagar); o ponto lançado não muda quando a tabela muda;
 * a temporada fechada não se mexe.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const fr = require('./federationRanking.js');
const { createFakeDb } = require('../tests/fakes/fakeFirestore.cjs');

const NOW = Date.UTC(2026, 9, 18, 15, 0, 0);
const ctx = (db, now = NOW) => ({ db, now, logger: { info() {} } });
const RID = 'fpp_t1_m1';
const resultado = (extra = {}) => ({
  federation_id: 'fpp', federation_acronym: 'FPP', season: 2026, status: 'sent', tournament_id: 't1', tournament_name: 'Aberto SP', modality_id: 'm1', modality_name: 'Duplas masc.',
  gender_category: 'male', age_category: 'open', format: 'doubles', tier: 'state', date: '2026-08-10',
  rows: [
    { uid: 'ana', name: 'Ana', position: 1, played: 4, won: 4 },
    { uid: 'bia', name: 'Bia', position: 2, played: 4, won: 3 },
    { uid: 'caio', name: 'Caio', position: 9, played: 2, won: 0 },
    { uid: null, name: 'Visitante', position: 3, played: 3, won: 2 },
  ],
  ...extra,
});

function cenario() {
  return createFakeDb({
    'federations/fpp': { name: 'FPP', status: 'approved', published: true, ranking_config: { best_n: 2 } },
    'federation_members/fpp_ana': { federation_id: 'fpp', user_id: 'ana', tier: 'federated', status: 'active', valid_from: '2026-01-01', valid_until: '2026-12-31' },
    'federation_members/fpp_bia': { federation_id: 'fpp', user_id: 'bia', tier: 'federated', status: 'expired', valid_from: '2025-09-01', valid_until: '2026-08-31' },
    'federation_members/fpp_caio': { federation_id: 'fpp', user_id: 'caio', tier: 'registered', status: 'active', valid_from: '2026-01-01', valid_until: '2026-12-31' },
    [`federation_results/${RID}`]: resultado(),
  });
}
const doc = (db, path) => db.store.docs.get(path);
const enviar = async (db, id, depois, { antes = null, now = NOW } = {}) => {
  if (depois) db.store.docs.set(`federation_results/${id}`, depois); else db.store.docs.delete(`federation_results/${id}`);
  return fr.onResultWritten(ctx(db, now), antes, depois, id);
};

describe('ranking oficial no servidor: lançamento por torneio', () => {
  it('o resultado enviado lança os pontos no histórico de quem pontua e soma o ano', async () => {
    const db = cenario();
    await fr.onResultWritten(ctx(db), null, doc(db, `federation_results/${RID}`), RID);
    // Ana (1º, peso estadual 1,5) = 150; Bia estava em dia em agosto = 105; Caio é só cadastrado; o visitante não tem conta.
    const ana = doc(db, `federation_points/${RID}_ana`);
    expect(ana).toMatchObject({ federation_id: 'fpp', season: 2026, result_id: RID, tournament_id: 't1', tournament_name: 'Aberto SP', date: '2026-08-10', category: 'male_open_doubles', uid: 'ana', position: 1, base_points: 100, multiplier: 1.5, points: 150, status: 'awarded', awarded_at_ms: NOW });
    expect(doc(db, `federation_points/${RID}_bia`).points).toBe(105);
    expect(doc(db, `federation_points/${RID}_caio`)).toBeUndefined();
    const r = doc(db, 'federation_rankings/fpp_2026');
    expect(r.season).toBe(2026);
    expect(r.results_count).toBe(1);
    expect(r.entries_count).toBe(2);
    expect(r.categories[0].rows.map((l) => [l.uid, l.points, l.position])).toEqual([['ana', 150, 1], ['bia', 105, 2]]);
    expect(r.uids).toEqual(['ana', 'bia']);
    expect(r.last_day).toBe('2027-01-31');
    expect(r.closes_at_ms).toBe(Date.UTC(2027, 1, 1, 3));
    expect(r.updated_at_ms).toBe(NOW);
  });

  it('recusar CANCELA o lançamento com o motivo (não apaga); readmitir lança de novo', async () => {
    const db = cenario();
    const original = doc(db, `federation_results/${RID}`);
    await fr.onResultWritten(ctx(db), null, original, RID);
    const recusado = { ...original, status: 'rejected' };
    await enviar(db, RID, recusado, { antes: original });
    expect(doc(db, `federation_points/${RID}_ana`)).toMatchObject({ status: 'cancelled', cancel_reason: 'result_rejected', points: 150, cancelled_at_ms: NOW });
    expect(doc(db, 'federation_rankings/fpp_2026').general).toEqual([]);
    await enviar(db, RID, original, { antes: recusado, now: NOW + 1000 });
    expect(doc(db, `federation_points/${RID}_ana`)).toMatchObject({ status: 'awarded', cancel_reason: null, awarded_at_ms: NOW + 1000 });
    expect(doc(db, 'federation_rankings/fpp_2026').general.map((l) => l.uid)).toEqual(['ana', 'bia']);
  });

  it('retirar o resultado cancela; reenviar com outra colocação refaz o lançamento guardando o anterior', async () => {
    const db = cenario();
    const original = doc(db, `federation_results/${RID}`);
    await fr.onResultWritten(ctx(db), null, original, RID);
    const revisto = resultado({ rows: [{ uid: 'ana', name: 'Ana', position: 2, played: 4 }, { uid: 'caio', name: 'Caio', position: 1, played: 4 }] });
    await enviar(db, RID, revisto, { antes: original, now: NOW + 5 });
    expect(doc(db, `federation_points/${RID}_ana`)).toMatchObject({ status: 'awarded', position: 2, points: 105, previous: { position: 1, points: 150 }, revised_at_ms: NOW + 5, awarded_at_ms: NOW });
    expect(doc(db, `federation_points/${RID}_bia`)).toMatchObject({ status: 'cancelled', cancel_reason: 'not_in_result' });
    await enviar(db, RID, null, { antes: revisto, now: NOW + 9 });
    expect(doc(db, `federation_points/${RID}_ana`)).toMatchObject({ status: 'cancelled', cancel_reason: 'result_deleted' });
    expect(doc(db, 'federation_rankings/fpp_2026').general).toEqual([]);
  });

  it('o ponto lançado NÃO muda quando a tabela ou a filiação mudam; o "melhores N" vale só no ano aberto', async () => {
    const db = cenario();
    await fr.onResultWritten(ctx(db), null, doc(db, `federation_results/${RID}`), RID);
    await enviar(db, 'fpp_t2_m1', resultado({ tournament_id: 't2', tournament_name: 'Etapa 2', tier: 'regional', date: '2026-09-01', rows: [{ uid: 'ana', name: 'Ana', position: 2, played: 3 }] }));
    await enviar(db, 'fpp_t3_m1', resultado({ tournament_id: 't3', tournament_name: 'Etapa 3', tier: 'regional', date: '2026-09-20', rows: [{ uid: 'ana', name: 'Ana', position: 4, played: 3 }] }));
    let ana = doc(db, 'federation_rankings/fpp_2026').general.find((l) => l.uid === 'ana');
    expect(ana.points).toBe(150 + 70); // best_n = 2: o 40 fica de fora
    expect(ana.events).toBe(3);
    expect(ana.results.map((r) => r.counts)).toEqual([true, true, false]);
    // A federação troca a tabela (1º = 500) e o best_n: o lançado fica; o ano aberto soma de novo com o best_n novo.
    const fedAntes = doc(db, 'federations/fpp');
    const fedDepois = { ...fedAntes, ranking_config: { best_n: 0, points_by_place: { 1: 500 } } };
    db.store.docs.set('federations/fpp', fedDepois);
    await fr.onFederationWritten(ctx(db), 'fpp', fedAntes, fedDepois);
    ana = doc(db, 'federation_rankings/fpp_2026').general.find((l) => l.uid === 'ana');
    expect(ana.points).toBe(150 + 70 + 40);
    expect(doc(db, `federation_points/${RID}_ana`).points).toBe(150);
    // Bia perde a filiação depois; um reenvio com a MESMA colocação não tira o ponto dela.
    db.store.docs.set('federation_members/fpp_bia', { federation_id: 'fpp', user_id: 'bia', tier: 'federated', status: 'cancelled' });
    const atual = doc(db, `federation_results/${RID}`);
    await enviar(db, RID, { ...atual }, { antes: atual });
    expect(doc(db, `federation_points/${RID}_bia`)).toMatchObject({ status: 'awarded', points: 105 });
    // Sem mudança na configuração, nada roda.
    await fr.onFederationWritten(ctx(db), 'fpp', fedDepois, { ...fedDepois, name: 'Outro' });
  });

  it('⭐ temporada FECHADA é imutável: o gatilho não lança, não cancela e não regrava', async () => {
    const db = cenario();
    await fr.onResultWritten(ctx(db), null, doc(db, `federation_results/${RID}`), RID);
    const congelado = JSON.stringify(doc(db, 'federation_rankings/fpp_2026'));
    const depoisDoFim = Date.UTC(2027, 1, 1, 3, 0, 0); // 1º/fev/2027, 00:00 em Brasília
    const original = doc(db, `federation_results/${RID}`);
    await enviar(db, RID, { ...original, status: 'rejected' }, { antes: original, now: depoisDoFim });
    expect(doc(db, `federation_points/${RID}_ana`).status).toBe('awarded');
    await enviar(db, 'fpp_t9_m1', resultado({ tournament_id: 't9' }), { now: depoisDoFim });
    expect(doc(db, 'federation_points/fpp_t9_m1_ana')).toBeUndefined();
    const fedAntes = doc(db, 'federations/fpp');
    await fr.onFederationWritten(ctx(db, depoisDoFim), 'fpp', fedAntes, { ...fedAntes, ranking_config: { best_n: 1 } });
    expect(await fr.recomputeSeason(ctx(db, depoisDoFim), 'fpp', 2026)).toBeNull();
    expect(JSON.stringify(doc(db, 'federation_rankings/fpp_2026'))).toBe(congelado);
    // Até o último minuto de janeiro o ano ainda aceita (resultado de dezembro chegando).
    expect(fr.seasonClosed(2026, depoisDoFim - 1)).toBe(false);
    expect(fr.openSeasons(Date.UTC(2027, 0, 15))).toEqual([2026, 2027]);
    expect(fr.openSeasons(NOW)).toEqual([2026]);
  });

  it('members_only desligado lança para todo mundo com conta; ano sem lançamento não cria ranking vazio', async () => {
    const db = cenario();
    db.store.docs.set('federations/fpp', { name: 'FPP', status: 'approved', ranking_config: { members_only: false } });
    await fr.onResultWritten(ctx(db), null, doc(db, `federation_results/${RID}`), RID);
    expect(doc(db, 'federation_rankings/fpp_2026').general.map((l) => l.uid)).toEqual(['ana', 'bia', 'caio']);
    await fr.recomputeSeason(ctx(db, Date.UTC(2027, 0, 10)), 'fpp', 2027);
    expect(doc(db, 'federation_rankings/fpp_2027')).toBeUndefined();
  });

  it('resultado enviado antes do livro de pontos é lançado uma vez na próxima soma do ano aberto', async () => {
    const db = cenario();
    db.store.docs.set('federation_results/fpp_t0_m0', resultado({ tournament_id: 't0', modality_id: 'm0', tournament_name: 'Antigo', rows: [{ uid: 'ana', name: 'Ana', position: 2, played: 3, won: 2 }] }));
    db.store.docs.set('federation_results/fpp_t9_m9', resultado({ tournament_id: 't9', modality_id: 'm9', status: 'rejected', rows: [{ uid: 'ana', name: 'Ana', position: 1, played: 3, won: 3 }] }));
    await fr.onResultWritten(ctx(db), null, doc(db, `federation_results/${RID}`), RID);
    expect(doc(db, 'federation_points/fpp_t0_m0_ana')).toMatchObject({ points: 105, status: 'awarded', tournament_name: 'Antigo' });
    expect(doc(db, 'federation_points/fpp_t9_m9_ana')).toBeUndefined();
    expect(doc(db, 'federation_rankings/fpp_2026').results_count).toBe(2);
    const antes = doc(db, 'federation_points/fpp_t0_m0_ana');
    await fr.recomputeSeason(ctx(db, NOW + 1000), 'fpp', 2026);
    expect(doc(db, 'federation_points/fpp_t0_m0_ana')).toEqual(antes);
  });
});
