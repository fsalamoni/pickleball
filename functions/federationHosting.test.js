/**
 * Sedes e Copa no SERVIDOR contra um Firestore falso: o edital de sede (só
 * gestor de organização filiada manda carta, a seleção para a proposta, quem
 * gere não avalia a própria proposta, a média ponderada, vencedor fora do topo
 * exige motivo, o público sem uid, a varredura dos prazos) e a Copa das
 * Federações (só confederação abre, só estadual da rede com filiados em dia
 * inscreve, aprovar/devolver e o elenco público sem uid).
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const h = require('./federationHosting.js');
const { createFakeDb, FakeFieldValue } = require('../tests/fakes/fakeFirestore.cjs');

const NOW = Date.UTC(2026, 9, 23, 15, 0, 0); // 23/10/2026, meio-dia em Brasília
const DIA = 86400000;
const PRES = { uid: 'pres', name: 'Presidente' };
const COMP = { uid: 'comp', name: 'Competições' };
const SEC = { uid: 'sec', name: 'Secretaria' };
const GES = { uid: 'ges', name: 'Gestor da arena' };
const CLU = { uid: 'clu', name: 'Admin do clube' };
const ZE = { uid: 'ze', name: 'Zé' };
const EDITAL = { title: 'Sede do Estadual 2027', event_name: 'Estadual 2027', description: 'O estadual de duplas, em três dias.', intent_until: '2026-11-10', proposal_until: '2026-12-10', event_start: '2027-03-01', criteria: [{ id: 'quadras', label: 'Quadras', weight: 3 }, { id: 'hotel', label: 'Hospedagem', weight: 1 }] };
const PROPOSTA = 'Proposta completa: 8 quadras cobertas, hotel parceiro a 2 km e apoio da prefeitura.';

function cenario(extra = {}) {
  return {
    bucket: { file: () => ({ getMetadata: async () => [{ size: 10, contentType: 'application/pdf' }], download: async () => [Buffer.from('PDF')] }) },
    db: createFakeDb({
      'platform_settings/global': { feature_flags: { federations: true } },
      'federations/fgp': { name: 'Federação Gaúcha', acronym: 'FGP', status: 'approved', published: true, modules: { host_bids: true, affiliations: true } },
      'federations/cbp': { name: 'Confederação Brasileira', acronym: 'CBP', status: 'approved', published: true, confederation: true, modules: { host_bids: true, federation_cup: true } },
      'federations/fpp': { name: 'Federação Paulista', acronym: 'FPP', status: 'approved', published: true, modules: {} },
      'federation_staff/fgp_pres': { federation_id: 'fgp', user_id: 'pres', role: 'president' },
      'federation_staff/fgp_comp': { federation_id: 'fgp', user_id: 'comp', role: 'competitions' },
      'federation_staff/fgp_sec': { federation_id: 'fgp', user_id: 'sec', role: 'secretary' },
      'federation_staff/fgp_ges': { federation_id: 'fgp', user_id: 'ges', role: 'competitions' },
      'federation_staff/cbp_pres': { federation_id: 'cbp', user_id: 'pres', role: 'president' },
      'federation_staff/fpp_comp': { federation_id: 'fpp', user_id: 'comp', role: 'competitions' },
      'federation_national_links/cbp_fgp': { conf_id: 'cbp', federation_id: 'fgp', status: 'approved' },
      'arena_managers/ar1_ges': { arena_id: 'ar1', user_id: 'ges' },
      'club_members/c1_clu': { club_id: 'c1', user_id: 'clu', role: 'admin' },
      'federation_affiliations/fgp_arena_ar1': { federation_id: 'fgp', kind: 'arena', org_id: 'ar1', org_name: 'Arena Sul', org_city: 'Pelotas', status: 'approved', requested_by: 'ges' },
      'federation_affiliations/fgp_club_c1': { federation_id: 'fgp', kind: 'club', org_id: 'c1', org_name: 'Clube Norte', org_city: 'Caxias', status: 'approved', requested_by: 'clu' },
      'federation_members/fgp_ana': { federation_id: 'fgp', user_id: 'ana', user_name: 'Ana', status: 'active', tier: 'federated', plan_id: 'p1', valid_until: '2027-12-31' },
      'federation_members/fgp_bia': { federation_id: 'fgp', user_id: 'bia', user_name: 'Bia', status: 'active', tier: 'federated', plan_id: 'p1', valid_until: '2027-12-31' },
      'federation_members/fgp_old': { federation_id: 'fgp', user_id: 'old', user_name: 'Velho', status: 'expired', tier: 'federated', plan_id: 'p1', valid_until: '2025-01-01' },
      'federation_members/fpp_caio': { federation_id: 'fpp', user_id: 'caio', user_name: 'Caio', status: 'active', tier: 'federated', plan_id: 'p1', valid_until: '2027-12-31' },
      ...extra,
    }),
  };
}
const ctx = (c, now = NOW) => ({ db: c.db, bucket: c.bucket, now, FieldValue: FakeFieldValue, Timestamp: { fromMillis: (ms) => ({ ms }) }, logger: { info() {}, warn() {} } });
const chamar = (c, actor, data, now, fed = 'fgp') => h.hosting(ctx(c, now), actor, { federationId: fed, ...data });
const doc = (c, path) => c.db.store.docs.get(path);
const avisos = (c, uid) => [...c.db.store.docs.entries()].filter(([p, d]) => p.startsWith('notifications/') && (!uid || d.user_id === uid)).map(([, d]) => d);

async function editalPublicado(c) {
  const { bidId } = await chamar(c, COMP, { action: 'bid_save', ...EDITAL });
  await chamar(c, COMP, { action: 'bid_publish', bidId });
  return bidId;
}

describe('edital de sede', () => {
  it('rascunho: só competições/admin; publicar avisa os gestores filiados; publicado não muda', async () => {
    const c = cenario();
    await expect(chamar(c, SEC, { action: 'bid_save', ...EDITAL })).rejects.toThrow(/competições/);
    const bidId = await editalPublicado(c);
    expect(doc(c, `federation_host_bids/${bidId}`)).toMatchObject({ status: 'intent', scope: 'state', federation_acronym: 'FGP' });
    expect(avisos(c, 'ges')).toHaveLength(1);
    expect(avisos(c, 'clu')).toHaveLength(1);
    await expect(chamar(c, COMP, { action: 'bid_save', bidId, ...EDITAL })).rejects.toThrow(/não muda/);
    await expect(chamar(c, COMP, { action: 'bid_delete', bidId })).rejects.toThrow(/rascunho/);
  });

  it('carta: só quem gere organização filiada, no prazo', async () => {
    const c = cenario({ 'arena_managers/ar9_ze': { arena_id: 'ar9', user_id: 'ze' } });
    const bidId = await editalPublicado(c);
    const carta = { action: 'entry_intent', bidId, text: 'Queremos sediar o estadual com 8 quadras cobertas.' };
    await expect(chamar(c, ZE, { ...carta, kind: 'arena', orgId: 'ar1' })).rejects.toThrow(/gere a arena/);
    await expect(chamar(c, ZE, { ...carta, kind: 'arena', orgId: 'ar9' })).rejects.toThrow(/filiado/);
    await chamar(c, GES, { ...carta, kind: 'arena', orgId: 'ar1' });
    await expect(chamar(c, CLU, { ...carta, kind: 'club', orgId: 'c1' }, NOW + 20 * DIA)).rejects.toThrow(/não está recebendo/);
    await chamar(c, CLU, { ...carta, kind: 'club', orgId: 'c1' });
    expect(doc(c, `federation_host_entries/${bidId}_arena_ar1`)).toMatchObject({ stage: 'intent', org_name: 'Arena Sul', applicant_uid: 'ges', via_federation_id: 'fgp' });
    expect(doc(c, `federation_host_bids/${bidId}`).counts).toEqual({ intents: 2, proposals: 0 });
  });

  it('seleção → proposta → notas (quem gere não avalia a própria) → resultado com motivo fora do topo', async () => {
    const c = cenario();
    const bidId = await editalPublicado(c);
    const carta = { action: 'entry_intent', bidId, text: 'Queremos sediar o estadual com 8 quadras cobertas.' };
    await chamar(c, GES, { ...carta, kind: 'arena', orgId: 'ar1' });
    await chamar(c, CLU, { ...carta, kind: 'club', orgId: 'c1' });
    const eA = `${bidId}_arena_ar1`;
    const eC = `${bidId}_club_c1`;
    await expect(chamar(c, GES, { action: 'entry_proposal', bidId, kind: 'arena', orgId: 'ar1', text: PROPOSTA })).rejects.toThrow(/propostas/);
    await chamar(c, COMP, { action: 'bid_shortlist', bidId, entryIds: [eA, eC] });
    expect(doc(c, `federation_host_bids/${bidId}`).status).toBe('proposal');
    await expect(chamar(c, GES, { action: 'entry_proposal', bidId, kind: 'arena', orgId: 'ar1', text: PROPOSTA, files: [{ path: 'federacao/outro/a.pdf' }] })).rejects.toThrow(/arquivo/);
    await chamar(c, GES, { action: 'entry_proposal', bidId, kind: 'arena', orgId: 'ar1', text: PROPOSTA, files: [{ path: 'federacao/ges/a1.pdf', name: 'planta.pdf' }] });
    await chamar(c, CLU, { action: 'entry_proposal', bidId, kind: 'club', orgId: 'c1', text: PROPOSTA });
    const arq = await chamar(c, COMP, { action: 'entry_file', entryId: eA, index: 0 });
    expect(arq.name).toBe('planta.pdf');
    await expect(chamar(c, ZE, { action: 'entry_file', entryId: eA, index: 0 })).rejects.toThrow(/não pode abrir/);
    await chamar(c, COMP, { action: 'bid_review', bidId });
    await expect(chamar(c, GES, { action: 'bid_score', bidId, entryId: eA, scores: { quadras: 10, hotel: 10 } })).rejects.toThrow(/não avalia/);
    await chamar(c, COMP, { action: 'bid_score', bidId, entryId: eA, scores: { quadras: 9, hotel: 5 } });
    await expect(chamar(c, COMP, { action: 'bid_result', bidId, winnerEntryId: eA })).rejects.toThrow(/ao menos uma nota/);
    await chamar(c, COMP, { action: 'bid_score', bidId, entryId: eC, scores: { quadras: 6, hotel: 6 } });
    await chamar(c, PRES, { action: 'bid_score', bidId, entryId: eC, scores: { quadras: 8, hotel: 8 } });
    expect(doc(c, `federation_host_scores/${eA}_comp`).total).toBe(8);
    await expect(chamar(c, PRES, { action: 'bid_result', bidId, winnerEntryId: eC })).rejects.toThrow(/motivo/);
    await chamar(c, PRES, { action: 'bid_result', bidId, winnerEntryId: eC, reason: 'Logística melhor para a final.' });
    const b = doc(c, `federation_host_bids/${bidId}`);
    expect(b.status).toBe('result');
    expect(b.result.ranking).toEqual([
      { org_name: 'Arena Sul', org_city: 'Pelotas', org_state: '', total: 8, winner: false },
      { org_name: 'Clube Norte', org_city: 'Caxias', org_state: '', total: 7, winner: true },
    ]);
    expect(JSON.stringify(b.result)).not.toMatch(/"(ges|clu)"|applicant/);
    expect(doc(c, `federation_host_entries/${eC}`).stage).toBe('winner');
    expect(doc(c, `federation_host_entries/${eA}`).stage).toBe('not_selected');
    expect(avisos(c, 'clu').some((a) => /vai sediar/.test(a.title))).toBe(true);
  });

  it('varredura: avisa o fim das cartas uma vez e fecha as propostas no prazo', async () => {
    const c = cenario();
    const bidId = await editalPublicado(c);
    await chamar(c, GES, { action: 'entry_intent', bidId, kind: 'arena', orgId: 'ar1', text: 'Queremos sediar o estadual com 8 quadras cobertas.' });
    const antes = avisos(c, 'comp').length;
    await h.sweep(ctx(c, NOW + 20 * DIA));
    await h.sweep(ctx(c, NOW + 21 * DIA));
    expect(avisos(c, 'comp').length).toBe(antes + 1);
    await chamar(c, COMP, { action: 'bid_shortlist', bidId, entryIds: [`${bidId}_arena_ar1`] }, NOW + 21 * DIA);
    await h.sweep(ctx(c, NOW + 60 * DIA));
    expect(doc(c, `federation_host_bids/${bidId}`).status).toBe('review');
  });

  it('confederação: aceita organização filiada a uma estadual da rede', async () => {
    const c = cenario();
    const { bidId } = await chamar(c, PRES, { action: 'bid_save', ...EDITAL }, NOW, 'cbp');
    await chamar(c, PRES, { action: 'bid_publish', bidId }, NOW, 'cbp');
    expect(avisos(c, 'comp').length).toBeGreaterThan(0);
    await chamar(c, GES, { action: 'entry_intent', bidId, kind: 'arena', orgId: 'ar1', text: 'Queremos sediar o nacional com 8 quadras.' }, NOW, 'cbp');
    expect(doc(c, `federation_host_entries/${bidId}_arena_ar1`)).toMatchObject({ federation_id: 'cbp', via_federation_id: 'fgp' });
  });
});

const COPA = { title: 'Copa das Federações 2027', year: 2027, starts_at: '2027-04-10', location: 'Brasília', entries_until: '2027-03-01', categories: [{ id: 'dm', label: 'Duplas masculinas', roster_max: 2 }, { id: 'df', label: 'Duplas femininas', roster_max: 2 }] };

describe('Copa das Federações', () => {
  it('só a confederação abre; a estadual filiada inscreve filiados em dia; a confederação aprova; página sem uid', async () => {
    const c = cenario();
    await expect(chamar(c, COMP, { action: 'cup_save', ...COPA })).rejects.toThrow(/Copa das Federações ligada|confederação/);
    const { cupId } = await chamar(c, PRES, { action: 'cup_save', ...COPA }, NOW, 'cbp');
    await expect(chamar(c, COMP, { action: 'team_save', cupId, athletes: [{ member_id: 'fgp_ana', category_id: 'df' }] })).rejects.toThrow(/não estão abertas/);
    await chamar(c, PRES, { action: 'cup_publish', cupId }, NOW, 'cbp');
    expect(avisos(c, 'comp').length).toBeGreaterThan(0);
    await expect(chamar(c, COMP, { action: 'team_save', cupId, athletes: [{ member_id: 'fpp_caio', category_id: 'dm' }] }, NOW, 'fpp')).rejects.toThrow(/filiada à confederação/);
    await expect(chamar(c, COMP, { action: 'team_save', cupId, athletes: [{ member_id: 'fgp_old', category_id: 'dm' }] })).rejects.toThrow(/em dia/);
    await expect(chamar(c, COMP, { action: 'team_save', cupId, athletes: [{ member_id: 'fpp_caio', category_id: 'dm' }] })).rejects.toThrow(/em dia/);
    await expect(chamar(c, SEC, { action: 'team_save', cupId, athletes: [{ member_id: 'fgp_ana', category_id: 'df' }] })).rejects.toThrow(/competições/);
    await chamar(c, COMP, { action: 'team_save', cupId, athletes: [{ member_id: 'fgp_ana', category_id: 'df' }, { member_id: 'fgp_bia', category_id: 'df' }] });
    await chamar(c, COMP, { action: 'team_submit', cupId });
    await expect(chamar(c, COMP, { action: 'team_save', cupId, athletes: [{ member_id: 'fgp_ana', category_id: 'df' }] })).rejects.toThrow(/não muda/);
    await expect(chamar(c, PRES, { action: 'team_return', cupId, teamFederationId: 'fgp' }, NOW, 'cbp')).rejects.toThrow(/motivo/);
    await chamar(c, PRES, { action: 'team_approve', cupId, teamFederationId: 'fgp' }, NOW, 'cbp');
    const k = doc(c, `federation_cups/${cupId}`);
    expect(k.teams_public).toHaveLength(1);
    expect(k.teams_public[0].athletes.map((a) => [a.name, a.category_id])).toEqual([['Ana', 'df'], ['Bia', 'df']]);
    expect(k.teams_public[0].athletes[0].key).toMatch(/^[0-9a-f]{12}$/);
    expect(JSON.stringify(k.teams_public)).not.toMatch(/"(ana|bia)"|uid|member_id/);
    expect(doc(c, `federation_cup_teams/${cupId}_fgp`).athlete_uids).toEqual(['ana', 'bia']);
    expect(avisos(c, 'ana')).toHaveLength(1);
    expect(doc(c, `federation_cup_teams/${cupId}_fgp`)).toMatchObject({ status: 'approved', conf_id: 'cbp' });
    await chamar(c, COMP, { action: 'team_withdraw', cupId });
    expect(doc(c, `federation_cups/${cupId}`).teams_public).toEqual([]);
  });

  it('varredura: o prazo vencido encerra as inscrições', async () => {
    const c = cenario();
    const { cupId } = await chamar(c, PRES, { action: 'cup_save', ...COPA }, NOW, 'cbp');
    await chamar(c, PRES, { action: 'cup_publish', cupId }, NOW, 'cbp');
    await h.sweep(ctx(c, NOW + 140 * DIA));
    expect(doc(c, `federation_cups/${cupId}`).status).toBe('closed');
  });
});
