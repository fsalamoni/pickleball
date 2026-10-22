/**
 * Regularidade do filiado no SERVIDOR contra um Firestore falso: nível oficial
 * (quem define, o aviso, o histórico), o pedido de revisão (só o dono, um por
 * vez, aceitar e recusar), as autorizações, as ocorrências do seguro (módulo,
 * dono × equipe, o sinistro exige número), o resumo dos documentos com a trava
 * e a varredura de validade (avisa uma vez por marco).
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const rg = require('./federationRegularity.js');
const { createFakeDb } = require('../tests/fakes/fakeFirestore.cjs');

const NOW = Date.UTC(2026, 9, 22, 15, 0, 0); // 22/10/2026, meio-dia em Brasília
const DIA = 86400000;
const SEC = { uid: 'sec', name: 'Secretaria' };
const TES = { uid: 'tes', name: 'Tesouraria' };
const ANA = { uid: 'ana', name: 'Ana' };
const ZE = { uid: 'ze', name: 'Zé' };
const MAE = { uid: 'mae', name: 'Mãe' };

function cenario({ mods = { insurance: true }, rules = { block_expired_docs: true }, extra = {} } = {}) {
  return {
    db: createFakeDb({
      'platform_settings/global': { feature_flags: { federations: true } },
      'federations/fgp': { name: 'Federação Gaúcha', acronym: 'FGP', slug: 'fgp', status: 'approved', published: true, modules: mods, rules, insurance: { insurer: 'Seguradora X', policy: 'AP-1', valid_until: '2027-06-30', covers: 'active_members' } },
      'federation_staff/fgp_sec': { federation_id: 'fgp', user_id: 'sec', role: 'secretary' },
      'federation_staff/fgp_tes': { federation_id: 'fgp', user_id: 'tes', role: 'treasurer' },
      'federation_plans/p1': { federation_id: 'fgp', requires_docs: ['atestado'], doc_validity: { atestado: 12 } },
      'federation_members/fgp_ana': { federation_id: 'fgp', user_id: 'ana', user_name: 'Ana', status: 'active', tier: 'federated', plan_id: 'p1', valid_until: '2027-01-01' },
      'federation_members/fgp_dep_x': { federation_id: 'fgp', user_id: null, guardian_uid: 'mae', user_name: 'Pedrinho', status: 'active', tier: 'federated', plan_id: 'p1', valid_until: '2027-01-01' },
      ...extra,
    }),
  };
}
const ctx = ({ db }, now = NOW) => ({ db, now, Timestamp: { fromMillis: (ms) => ({ ms }) }, logger: { info() {}, warn() {} } });
const chamar = (c, actor, data, now) => rg.regularity(ctx(c, now), actor, { federationId: 'fgp', ...data });
const doc = (c, path) => c.db.store.docs.get(path);
const avisos = (c, uid) => [...c.db.store.docs.entries()].filter(([p, d]) => p.startsWith('notifications/') && (!uid || d.user_id === uid)).map(([, d]) => d);
const ocorrencias = (c) => [...c.db.store.docs.entries()].filter(([p]) => p.startsWith('federation_incidents/')).map(([p, d]) => ({ id: p.split('/')[1], ...d }));

describe('nível oficial', () => {
  it('a equipe define com motivo; vai para o histórico e avisa o atleta; o financeiro não pode', async () => {
    const c = cenario();
    await expect(chamar(c, TES, { action: 'level_set', memberId: 'fgp_ana', label: '4.0', reason: 'Resultados do circuito' })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(chamar(c, SEC, { action: 'level_set', memberId: 'fgp_ana', label: '9.9', reason: 'Resultados do circuito' })).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(chamar(c, SEC, { action: 'level_set', memberId: 'fgp_ana', label: '4.0', reason: 'x' })).rejects.toMatchObject({ code: 'invalid-argument' });
    await chamar(c, SEC, { action: 'level_set', memberId: 'fgp_ana', label: '4.0', reason: 'Resultados do circuito' });
    await chamar(c, SEC, { action: 'level_set', memberId: 'fgp_ana', label: '4.5', reason: 'Campeã estadual' });
    const m = doc(c, 'federation_members/fgp_ana');
    expect(m.official_level).toMatchObject({ label: '4.5', reason: 'Campeã estadual', set_by: 'sec' });
    expect(m.official_level_history.map((h) => [h.label, h.previous])).toEqual([['4.5', '4.0'], ['4.0', null]]);
    expect(avisos(c, 'ana')).toHaveLength(2);
  });

  it('o dependente: o aviso vai ao responsável', async () => {
    const c = cenario();
    await chamar(c, SEC, { action: 'level_set', memberId: 'fgp_dep_x', label: '3.0', reason: 'Avaliação da escolinha' });
    expect(avisos(c, 'mae')).toHaveLength(1);
  });

  it('revisão: só o dono pede, uma por vez; a equipe recusa com motivo ou aceita definindo o nível', async () => {
    const c = cenario();
    await expect(chamar(c, ZE, { action: 'level_review', memberId: 'fgp_ana', reason: 'Ganhei o estadual, mereço subir.' })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(chamar(c, ANA, { action: 'level_review', memberId: 'fgp_ana', reason: 'curto' })).rejects.toMatchObject({ code: 'invalid-argument' });
    await chamar(c, ANA, { action: 'level_review', memberId: 'fgp_ana', reason: 'Ganhei o estadual, mereço subir.', wanted: '4.5' });
    expect(doc(c, 'federation_members/fgp_ana').level_review).toMatchObject({ status: 'pending', wanted: '4.5', requested_by: 'ana' });
    expect(avisos(c, 'sec')).toHaveLength(1);
    await expect(chamar(c, ANA, { action: 'level_review', memberId: 'fgp_ana', reason: 'De novo, por favor, revisem.' })).rejects.toMatchObject({ code: 'failed-precondition' });

    await expect(chamar(c, SEC, { action: 'level_review_decide', memberId: 'fgp_ana', decision: 'reject', reason: '' })).rejects.toMatchObject({ code: 'invalid-argument' });
    await chamar(c, SEC, { action: 'level_review_decide', memberId: 'fgp_ana', decision: 'reject', reason: 'Falta outro torneio' });
    expect(doc(c, 'federation_members/fgp_ana').level_review).toMatchObject({ status: 'rejected', decided_reason: 'Falta outro torneio' });
    expect(doc(c, 'federation_members/fgp_ana').official_level).toBeUndefined();

    await chamar(c, ANA, { action: 'level_review', memberId: 'fgp_ana', reason: 'Joguei mais um torneio e ganhei.' });
    await chamar(c, SEC, { action: 'level_review_decide', memberId: 'fgp_ana', decision: 'accept', label: '4.5', reason: 'Dois títulos no ano' });
    const m = doc(c, 'federation_members/fgp_ana');
    expect(m.level_review).toMatchObject({ status: 'accepted' });
    expect(m.official_level).toMatchObject({ label: '4.5' });
    expect(m.official_level_history[0]).toMatchObject({ origin: 'review' });
  });

  it('clube/arena não tem nível', async () => {
    const c = cenario({ extra: { 'federation_members/fgp_club_c1': { federation_id: 'fgp', user_id: null, org_kind: 'club', org_id: 'c1', status: 'active' } } });
    await expect(chamar(c, SEC, { action: 'level_set', memberId: 'fgp_club_c1', label: '4.0', reason: 'Qualquer coisa' })).rejects.toMatchObject({ code: 'failed-precondition' });
  });
});

describe('autorizações', () => {
  it('o dono (ou o responsável) marca; só o que mudou entra no registro; outra pessoa, não', async () => {
    const c = cenario();
    await expect(chamar(c, ZE, { action: 'consents', memberId: 'fgp_ana', consents: { image: true } })).rejects.toMatchObject({ code: 'permission-denied' });
    await chamar(c, ANA, { action: 'consents', memberId: 'fgp_ana', consents: { image: true, comms: false } });
    let m = doc(c, 'federation_members/fgp_ana');
    expect(m.consents.image).toMatchObject({ granted: true, at_ms: NOW });
    expect(m.consents.comms).toMatchObject({ granted: false });
    const n = m.consents_log.length;
    const r = await chamar(c, ANA, { action: 'consents', memberId: 'fgp_ana', consents: { image: true } });
    expect(r.changed).toBe(0);
    await chamar(c, ANA, { action: 'consents', memberId: 'fgp_ana', consents: { image: false } });
    m = doc(c, 'federation_members/fgp_ana');
    expect(m.consents.image.granted).toBe(false);
    expect(m.consents_log.length).toBe(n + 1);
    await chamar(c, MAE, { action: 'consents', memberId: 'fgp_dep_x', consents: { share: true } });
    expect(doc(c, 'federation_members/fgp_dep_x').consents.share.granted).toBe(true);
  });
});

describe('ocorrências do seguro', () => {
  const relato = { date: '2026-10-20', kind: 'injury', description: 'Torceu o tornozelo no jogo', body_part: 'Tornozelo' };

  it('módulo desligado é recusado', async () => {
    await expect(chamar(cenario({ mods: {} }), ANA, { action: 'incident_create', memberId: 'fgp_ana', ...relato })).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('o atleta registra (avisa a equipe, coberto pela apólice); estranho não; data futura não', async () => {
    const c = cenario();
    await expect(chamar(c, ZE, { action: 'incident_create', memberId: 'fgp_ana', ...relato })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(chamar(c, ANA, { action: 'incident_create', memberId: 'fgp_ana', ...relato, date: '2026-12-01' })).rejects.toMatchObject({ code: 'invalid-argument' });
    await chamar(c, ANA, { action: 'incident_create', memberId: 'fgp_ana', ...relato });
    const [o] = ocorrencias(c);
    expect(o).toMatchObject({ federation_id: 'fgp', user_id: 'ana', status: 'open', reported_role: 'athlete', insured: true, insurance_snapshot: { insurer: 'Seguradora X', policy: 'AP-1' } });
    expect(avisos(c, 'sec')).toHaveLength(1);
  });

  it('a equipe registra para o dependente (avisa o responsável) e acompanha; sinistro exige número', async () => {
    const c = cenario();
    await chamar(c, SEC, { action: 'incident_create', memberId: 'fgp_dep_x', ...relato });
    const [o] = ocorrencias(c);
    expect(o).toMatchObject({ guardian_uid: 'mae', reported_role: 'staff' });
    expect(avisos(c, 'mae')).toHaveLength(1);
    await expect(chamar(c, TES, { action: 'incident_update', incidentId: o.id, status: 'closed' })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(chamar(c, SEC, { action: 'incident_update', incidentId: o.id, status: 'claim' })).rejects.toMatchObject({ code: 'invalid-argument' });
    await chamar(c, SEC, { action: 'incident_update', incidentId: o.id, status: 'claim', claimNumber: 'SIN-77' });
    expect(doc(c, `federation_incidents/${o.id}`)).toMatchObject({ status: 'claim', claim_number: 'SIN-77' });
    expect(avisos(c, 'mae')).toHaveLength(2);
    const r = await chamar(c, SEC, { action: 'incident_update', incidentId: o.id, status: 'claim' });
    expect(r.changed).toBe(false);
    await chamar(c, SEC, { action: 'incident_update', incidentId: o.id, status: 'closed', note: 'Alta médica' });
    expect(doc(c, `federation_incidents/${o.id}`).history.map((h) => h.status)).toEqual(['open', 'claim', 'closed']);
  });
});

describe('documentos: resumo, trava e varredura', () => {
  const atestado = (over = {}) => ({ federation_id: 'fgp', member_id: 'fgp_ana', user_id: 'ana', kind: 'atestado', status: 'approved', created_at_ms: NOW - 300 * DIA, ...over });

  it('vencido com a trava ligada → docs_block; sem a trava só o estado; regularizado solta', async () => {
    const c = cenario({ extra: { 'federation_documents_submitted/d1': atestado({ valid_until: '2026-10-01' }) } });
    await rg.syncMemberDocs(ctx(c), 'fgp_ana');
    expect(doc(c, 'federation_members/fgp_ana')).toMatchObject({ docs_state: { state: 'expired', expired: 1 }, docs_block: true });
    await rg.onDocumentWritten(ctx(c), null, { member_id: 'fgp_ana' });
    c.db.store.docs.set('federation_documents_submitted/d2', atestado({ valid_until: '2027-10-20', created_at_ms: NOW }));
    const r = await rg.syncMemberDocs(ctx(c), 'fgp_ana');
    expect(r.changed).toBe(true);
    expect(doc(c, 'federation_members/fgp_ana')).toMatchObject({ docs_state: { state: 'ok', next_expiry: '2027-10-20' }, docs_block: false });
    expect((await rg.syncMemberDocs(ctx(c), 'fgp_ana')).changed).toBe(false);

    const s = cenario({ rules: {}, extra: { 'federation_documents_submitted/d1': atestado({ valid_until: '2026-10-01' }) } });
    await rg.syncMemberDocs(ctx(s), 'fgp_ana');
    expect(doc(s, 'federation_members/fgp_ana')).toMatchObject({ docs_state: { state: 'expired' }, docs_block: false });
  });

  it('a varredura avisa 30 dias antes uma vez, de novo aos 7, e aplica o vencido', async () => {
    const c = cenario({ extra: { 'federation_documents_submitted/d1': atestado({ valid_until: '2026-11-15' }) } });
    expect(await rg.sweep(ctx(c))).toMatchObject({ avisos: 1 });
    expect(doc(c, 'federation_documents_submitted/d1').expiry_notified).toEqual({ 30: true });
    expect(doc(c, 'federation_members/fgp_ana').docs_state).toMatchObject({ state: 'expiring' });
    expect(await rg.sweep(ctx(c, NOW + DIA))).toMatchObject({ avisos: 0 });
    expect(await rg.sweep(ctx(c, NOW + 17 * DIA))).toMatchObject({ avisos: 1 });
    expect(avisos(c, 'ana')).toHaveLength(2);
    await rg.sweep(ctx(c, NOW + 25 * DIA));
    expect(doc(c, 'federation_documents_submitted/d1').expired_applied).toBe(true);
    expect(doc(c, 'federation_members/fgp_ana')).toMatchObject({ docs_state: { state: 'expired' }, docs_block: true });
  });

  it('flag desligada: a varredura não faz nada', async () => {
    const c = cenario({ extra: { 'platform_settings/global': { feature_flags: {} } } });
    expect(await rg.sweep(ctx(c))).toEqual({ skipped: 'flag' });
  });
});
