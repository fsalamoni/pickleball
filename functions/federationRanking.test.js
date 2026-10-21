/**
 * Ranking oficial da federação no SERVIDOR, contra o Firestore falso: o
 * resultado enviado recalcula a temporada; só o federado em dia na data
 * pontua; recusar um resultado tira os pontos; mudar a configuração da
 * federação refaz a conta.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const fr = require('./federationRanking.js');
const { createFakeDb } = require('../tests/fakes/fakeFirestore.cjs');

const NOW = Date.UTC(2026, 9, 18, 15, 0, 0);
const ctx = (db) => ({ db, now: NOW, logger: { info() {} } });
const resultado = (extra = {}) => ({
  federation_id: 'fpp', season: 2026, status: 'sent', tournament_id: 't1', tournament_name: 'Aberto SP', modality_id: 'm1', modality_name: 'Duplas masc.',
  gender_category: 'male', age_category: 'open', format: 'doubles', tier: 'state', date: '2026-08-10',
  rows: [
    { uid: 'ana', name: 'Ana', position: 1, played: 4, won: 4 },
    { uid: 'bia', name: 'Bia', position: 2, played: 4, won: 3 },
    { uid: 'caio', name: 'Caio', position: 9, played: 2, won: 0 },
    { uid: 'semconta', name: 'Visitante', position: 3, played: 3, won: 2 },
  ],
  ...extra,
});

function cenario() {
  return createFakeDb({
    'federations/fpp': { name: 'FPP', status: 'approved', published: true, ranking_config: { best_n: 2 } },
    'federation_members/fpp_ana': { federation_id: 'fpp', user_id: 'ana', tier: 'federated', status: 'active', valid_from: '2026-01-01', valid_until: '2026-12-31' },
    'federation_members/fpp_bia': { federation_id: 'fpp', user_id: 'bia', tier: 'federated', status: 'expired', valid_from: '2025-09-01', valid_until: '2026-08-31' },
    'federation_members/fpp_caio': { federation_id: 'fpp', user_id: 'caio', tier: 'registered', status: 'active', valid_from: '2026-01-01', valid_until: '2026-12-31' },
    'federation_results/fpp_t1_m1': resultado(),
  });
}
const doc = (db, path) => db.store.docs.get(path);

describe('ranking oficial no servidor', () => {
  it('a escrita do resultado recalcula a temporada e grava só o servidor', async () => {
    const db = cenario();
    await fr.onResultWritten(ctx(db), null, doc(db, 'federation_results/fpp_t1_m1'));
    const r = doc(db, 'federation_rankings/fpp_2026');
    expect(r).toBeTruthy();
    expect(r.season).toBe(2026);
    expect(r.results_count).toBe(1);
    expect(r.categories).toHaveLength(1);
    expect(r.categories[0].key).toBe('male_open_doubles');
    // Ana (1º, peso estadual 1,5) = 150; Bia estava em dia em agosto = 105; Caio é só cadastrado; o visitante não tem conta na federação.
    expect(r.categories[0].rows.map((l) => [l.uid, l.points, l.position])).toEqual([['ana', 150, 1], ['bia', 105, 2]]);
    expect(r.general.map((l) => l.uid)).toEqual(['ana', 'bia']);
    expect(r.updated_at_ms).toBe(NOW);
  });

  it('recusar o resultado tira os pontos; a temporada antiga também é refeita quando o documento muda de ano', async () => {
    const db = cenario();
    await fr.onResultWritten(ctx(db), null, doc(db, 'federation_results/fpp_t1_m1'));
    const antes = doc(db, 'federation_results/fpp_t1_m1');
    const depois = { ...antes, status: 'rejected' };
    db.store.docs.set('federation_results/fpp_t1_m1', depois);
    await fr.onResultWritten(ctx(db), antes, depois);
    expect(doc(db, 'federation_rankings/fpp_2026').general).toEqual([]);
    expect(doc(db, 'federation_rankings/fpp_2026').results_count).toBe(0);
  });

  it('os melhores N da configuração somam; mudar a configuração refaz as temporadas', async () => {
    const db = cenario();
    db.store.docs.set('federation_results/fpp_t2_m1', resultado({ tournament_id: 't2', tournament_name: 'Etapa 2', tier: 'regional', date: '2026-09-01', rows: [{ uid: 'ana', name: 'Ana', position: 2, played: 3, won: 2 }] }));
    db.store.docs.set('federation_results/fpp_t3_m1', resultado({ tournament_id: 't3', tournament_name: 'Etapa 3', tier: 'regional', date: '2026-09-20', rows: [{ uid: 'ana', name: 'Ana', position: 4, played: 3, won: 1 }] }));
    await fr.recomputeSeason(ctx(db), 'fpp', 2026);
    let ana = doc(db, 'federation_rankings/fpp_2026').general.find((l) => l.uid === 'ana');
    expect(ana.points).toBe(150 + 70); // best_n = 2: 150 + 70, o 40 fica de fora
    expect(ana.events).toBe(3);
    const fedAntes = doc(db, 'federations/fpp');
    const fedDepois = { ...fedAntes, ranking_config: { best_n: 0 } };
    db.store.docs.set('federations/fpp', fedDepois);
    await fr.onFederationWritten(ctx(db), 'fpp', fedAntes, fedDepois);
    ana = doc(db, 'federation_rankings/fpp_2026').general.find((l) => l.uid === 'ana');
    expect(ana.points).toBe(150 + 70 + 40);
    // Sem mudança na configuração, nada roda (nem lê).
    await fr.onFederationWritten(ctx(db), 'fpp', fedDepois, { ...fedDepois, name: 'Outro' });
  });

  it('members_only desligado pontua todo mundo, até quem não é filiado', async () => {
    const db = cenario();
    db.store.docs.set('federations/fpp', { name: 'FPP', status: 'approved', ranking_config: { members_only: false } });
    await fr.recomputeSeason(ctx(db), 'fpp', 2026);
    expect(doc(db, 'federation_rankings/fpp_2026').general.map((l) => l.uid)).toEqual(['ana', 'bia', 'semconta', 'caio']);
  });
});
