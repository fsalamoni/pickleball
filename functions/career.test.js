/**
 * A DUPLA da Minha carreira no SERVIDOR, contra um Firestore falso: só quem
 * foi citado confirma; menor de 18 (ou nascimento desconhecido) não convida
 * nem é convidado; mudar a data pede nova confirmação e mudar o nome não; a
 * visão da dupla, a decisão do dono, a denúncia e a moderação com motivo,
 * auditoria e aviso; o vínculo das duas fichas ("Pôr na minha carreira também").
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const c = require('./career.js');
const { createFakeDb } = require('../tests/fakes/fakeFirestore.cjs');

const NOW = Date.UTC(2026, 10, 4, 15, 0, 0);
const ANA = { uid: 'ana111', name: 'Ana' };
const BIA = { uid: 'bia222', name: 'Bia' };
const CAU = { uid: 'cau333', name: 'Cau' };
const ADM = { uid: 'adm999', name: 'Admin', isPlatformAdmin: true };
const EV_ID = 'ana111_ev1';
const DOC = `${EV_ID}__bia222`;

const evento = (extra = {}) => ({
  uid: 'ana111', name: 'Copa Sul', start_date: '2026-10-10', status: 'played', city: 'Curitiba', state: 'PR',
  notes: 'privado', entries: [{ format: 'doubles', gender: 'mixed', placement: 'champion', partner: { uid: 'bia222', name: 'Bia' } }],
  ...extra,
});

function cenario({ flag = true, biaNasc = '1995-01-01', anaNasc = '1990-06-01', ev = evento() } = {}) {
  return {
    db: createFakeDb({
      'platform_settings/global': { feature_flags: { athlete_career: flag } },
      'users/ana111': { platform_name: 'Ana Souza', birth_date: anaNasc },
      'users/bia222': { platform_name: 'Bia Lima', ...(biaNasc ? { birth_date: biaNasc } : {}) },
      'users/cau333': { platform_name: 'Cau', birth_date: '1990-01-01' },
      [`career_events/${EV_ID}`]: ev,
    }),
  };
}
const ctx = ({ db }, now = NOW) => ({ db, now, Timestamp: { fromMillis: (ms) => ({ ms }) }, logger: { info() {}, warn() {} } });
const chamar = (k, actor, data, now) => c.career(ctx(k, now), actor, data);
const doc = (k, id = DOC) => k.db.store.docs.get(`career_partner/${id}`);
const denuncia = (k, papel, id = DOC) => k.db.store.docs.get(`career_partner_reports/${id}__${papel}`);
const avisos = (k) => [...k.db.store.docs.entries()].filter(([p]) => p.startsWith('notifications/')).map(([, d]) => d);
const auditorias = (k) => [...k.db.store.docs.entries()].filter(([p]) => p.startsWith('audit_logs/')).map(([, d]) => d);
const convidar = (k) => chamar(k, ANA, { action: 'invite', eventId: EV_ID, partnerUid: 'bia222' });
const gatilho = (k, before, after, id = EV_ID) => {
  if (after) k.db.store.docs.set(`career_events/${id}`, after); else k.db.store.docs.delete(`career_events/${id}`);
  return c.eventWritten(ctx(k), id, before, after);
};

describe('convite: só a quem foi citado, nunca menor', () => {
  it('o dono convida a dupla citada: pedido com o resumo (sem anotações), aviso do servidor e auditoria', async () => {
    const k = cenario();
    expect(await convidar(k)).toEqual({ id: DOC, status: 'invited' });
    const d = doc(k);
    expect(d).toMatchObject({ owner_uid: 'ana111', partner_uid: 'bia222', event_id: EV_ID, owner_name: 'Ana Souza', partner_name: 'Bia Lima', entry_indexes: [0], status: 'invited' });
    expect(d.summary).toEqual({ name: 'Copa Sul', start_date: '2026-10-10', end_date: null, date_precision: 'day', city: 'Curitiba', state: 'PR', entries: [{ format: 'doubles', gender: 'mixed', placement: 'champion' }] });
    expect(JSON.stringify(d)).not.toContain('privado');
    const [a] = avisos(k);
    expect(a).toMatchObject({ user_id: 'bia222', origin: 'server', type: 'career', link: `/carreira?dupla=${encodeURIComponent(DOC)}` });
    expect(a.link).not.toContain('#');
    expect(auditorias(k)[0]).toMatchObject({ action: 'career_partner_invited', actor_id: 'ana111' });
  });

  it('convidar de novo enquanto espera não manda outro aviso', async () => {
    const k = cenario();
    await convidar(k);
    await convidar(k);
    expect(avisos(k)).toHaveLength(1);
  });

  it('quem não foi citado, torneio de outra pessoa, planejado e a si mesmo: recusado', async () => {
    const k = cenario();
    await expect(chamar(k, ANA, { action: 'invite', eventId: EV_ID, partnerUid: 'cau333' })).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(chamar(k, CAU, { action: 'invite', eventId: EV_ID, partnerUid: 'bia222' })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(chamar(k, ANA, { action: 'invite', eventId: EV_ID, partnerUid: 'ana111' })).rejects.toMatchObject({ code: 'invalid-argument' });
    const fut = cenario({ ev: evento({ start_date: '2026-12-01', status: 'planned' }) });
    await expect(convidar(fut)).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('⭐ menor de 18 não é convidado (sem virar sonda de idade), nascimento desconhecido conta como menor, e menor não convida', async () => {
    for (const biaNasc of ['2010-01-01', null]) {
      const k = cenario({ biaNasc });
      // A MESMA resposta do convite que saiu: a idade da outra pessoa não vaza.
      expect(await convidar(k)).toEqual({ id: DOC, status: 'invited' });
      expect(doc(k)).toBeUndefined();
      expect(avisos(k)).toHaveLength(0);
      expect(auditorias(k)[0]).toMatchObject({ action: 'career_partner_invite_held', details: { user_id: 'bia222' } });
    }
    await expect(convidar(cenario({ anaNasc: '2009-12-01' }))).rejects.toMatchObject({ code: 'failed-precondition', message: expect.stringContaining('Menores de 18') });
  });

  it('com a flag desligada nada é criado', async () => {
    const k = cenario({ flag: false });
    await expect(convidar(k)).rejects.toMatchObject({ code: 'failed-precondition' });
    expect(doc(k)).toBeUndefined();
  });
});

describe('resposta: só quem foi citado confirma', () => {
  it('⭐ só a dupla responde; o dono e um terceiro não', async () => {
    const k = cenario();
    await convidar(k);
    await expect(chamar(k, ANA, { action: 'respond', docId: DOC, answer: 'confirm' })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(chamar(k, CAU, { action: 'respond', docId: DOC, answer: 'confirm' })).rejects.toMatchObject({ code: 'permission-denied' });
    expect(await chamar(k, BIA, { action: 'respond', docId: DOC, answer: 'confirm' })).toMatchObject({ status: 'confirmed' });
    expect(avisos(k).at(-1)).toMatchObject({ user_id: 'ana111', origin: 'server', link: `/carreira?evento=${EV_ID}` });
    await expect(chamar(k, BIA, { action: 'respond', docId: DOC, answer: 'confirm' })).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('"Não foi assim": recusado; pedir de novo sem corrigir é recusado, depois de corrigir pode', async () => {
    const k = cenario();
    await convidar(k);
    await chamar(k, BIA, { action: 'respond', docId: DOC, answer: 'decline' });
    expect(doc(k).status).toBe('declined');
    await expect(convidar(k)).rejects.toMatchObject({ code: 'failed-precondition' });
    k.db.store.docs.set(`career_events/${EV_ID}`, evento({ entries: [{ ...evento().entries[0], placement: 'runner_up' }] }));
    expect(await convidar(k)).toMatchObject({ status: 'invited' });
  });

  it('a dupla tirada do registro antes de responder: o pedido some', async () => {
    const k = cenario();
    await convidar(k);
    k.db.store.docs.set(`career_events/${EV_ID}`, evento({ entries: [{ format: 'doubles', partner: { name: 'Outra' } }] }));
    await expect(chamar(k, BIA, { action: 'respond', docId: DOC, answer: 'confirm' })).rejects.toMatchObject({ code: 'failed-precondition' });
    expect(doc(k)).toBeUndefined();
  });
});

describe('gatilho: a impressão do que foi confirmado', () => {
  async function confirmado() {
    const k = cenario();
    await convidar(k);
    await chamar(k, BIA, { action: 'respond', docId: DOC, answer: 'confirm' });
    return k;
  }

  it('⭐ mudar só o NOME não pede nova confirmação (o resumo acompanha)', async () => {
    const k = await confirmado();
    const n = avisos(k).length;
    await gatilho(k, evento(), evento({ name: 'Copa do Sul' }));
    expect(doc(k)).toMatchObject({ status: 'confirmed', summary: { name: 'Copa do Sul' } });
    expect(avisos(k)).toHaveLength(n);
  });

  it('⭐ mudar a DATA (ou a colocação) pede nova confirmação, com aviso à dupla', async () => {
    const k = await confirmado();
    await gatilho(k, evento(), evento({ start_date: '2026-10-11' }));
    expect(doc(k).status).toBe('reconfirm');
    expect(avisos(k).at(-1)).toMatchObject({ user_id: 'bia222', origin: 'server', link: `/carreira?dupla=${encodeURIComponent(DOC)}` });
    expect(await chamar(k, BIA, { action: 'respond', docId: DOC, answer: 'confirm' })).toMatchObject({ status: 'confirmed' });
    const k2 = await confirmado();
    await gatilho(k2, evento(), evento({ entries: [{ ...evento().entries[0], placement: 'third' }] }));
    expect(doc(k2).status).toBe('reconfirm');
  });

  it('tirar a dupla do registro apaga o pedido; apagar o registro apaga os pedidos', async () => {
    const k = await confirmado();
    await gatilho(k, evento(), evento({ entries: [{ format: 'doubles', partner: { name: 'Bia' } }] }));
    expect(doc(k)).toBeUndefined();
    const k2 = await confirmado();
    await gatilho(k2, evento(), null);
    expect(doc(k2)).toBeUndefined();
  });

  it('"Pôr na minha carreira também": o vínculo confirmado liga as fichas; o forjado é desfeito', async () => {
    const k = await confirmado();
    const espelho = { ...evento({ uid: 'bia222', entries: [{ format: 'doubles', partner: { uid: 'ana111', name: 'Ana' } }] }), linked_event: { uid: 'ana111', id: EV_ID } };
    await gatilho(k, null, espelho, 'bia222_m1');
    expect(doc(k).partner_event_id).toBe('bia222_m1');
    // Cau aponta para o torneio da Ana sem ter sido confirmado: o vínculo some.
    const forjado = { ...evento({ uid: 'cau333' }), linked_event: { uid: 'ana111', id: EV_ID } };
    await gatilho(k, null, forjado, 'cau333_m1');
    expect(k.db.store.docs.get('career_events/cau333_m1').linked_event).toBeNull();
    // O registro da Ana apagado: o espelho da Bia perde o vínculo.
    await gatilho(k, evento(), null);
    expect(k.db.store.docs.get('career_events/bia222_m1').linked_event).toBeNull();
  });
});

describe('a visão da dupla, a decisão e a moderação', () => {
  async function comVisao() {
    const k = cenario();
    await convidar(k);
    await chamar(k, BIA, { action: 'respond', docId: DOC, answer: 'confirm' });
    await chamar(k, BIA, { action: 'feedback', docId: DOC, feedback: { strengths: ['dink'], improve: ['devolucao', 'xx'], text_improve: 'Devolver mais fundo.' } });
    return k;
  }

  it('só a dupla, só depois de confirmar; a visão chega ao dono e a auditoria não leva o texto', async () => {
    const k = cenario();
    await convidar(k);
    await expect(chamar(k, BIA, { action: 'feedback', docId: DOC, feedback: { strengths: ['dink'] } })).rejects.toMatchObject({ code: 'failed-precondition' });
    const k2 = await comVisao();
    expect(doc(k2).feedback).toMatchObject({ strengths: ['dink'], improve: ['devolucao'], text_improve: 'Devolver mais fundo.' });
    expect(doc(k2).owner_decision).toBe('pending');
    expect(avisos(k2).at(-1)).toMatchObject({ user_id: 'ana111', origin: 'server' });
    expect(JSON.stringify(auditorias(k2))).not.toContain('Devolver');
    await expect(chamar(k2, ANA, { action: 'feedback', docId: DOC, feedback: { strengths: ['dink'] } })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(chamar(k2, BIA, { action: 'feedback', docId: DOC, feedback: {} })).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('o dono decide ("Usar no meu treino"); depois disso a dupla não edita, mas retira', async () => {
    const k = await comVisao();
    await expect(chamar(k, BIA, { action: 'decide', docId: DOC, decision: 'use' })).rejects.toMatchObject({ code: 'permission-denied' });
    await chamar(k, ANA, { action: 'decide', docId: DOC, decision: 'use' });
    expect(doc(k)).toMatchObject({ owner_decision: 'use', decided_at_ms: NOW });
    await expect(chamar(k, BIA, { action: 'feedback', docId: DOC, feedback: { strengths: ['saque'] } })).rejects.toMatchObject({ code: 'failed-precondition' });
    await chamar(k, BIA, { action: 'remove', docId: DOC });
    expect(doc(k)).toMatchObject({ feedback: null, owner_decision: null, status: 'confirmed' });
  });

  it('o dono apaga o pedido; um terceiro não', async () => {
    const k = await comVisao();
    await expect(chamar(k, CAU, { action: 'remove', docId: DOC })).rejects.toMatchObject({ code: 'permission-denied' });
    await chamar(k, ANA, { action: 'remove', docId: DOC });
    expect(doc(k)).toBeUndefined();
  });

  it('⭐ denúncia → fila do admin → retirar a visão, com motivo, auditoria e aviso ao autor', async () => {
    const k = await comVisao();
    await expect(chamar(k, CAU, { action: 'report', docId: DOC, reason: 'offensive' })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(chamar(k, ANA, { action: 'report', docId: DOC, reason: 'xx' })).rejects.toMatchObject({ code: 'invalid-argument' });
    await chamar(k, ANA, { action: 'report', docId: DOC, reason: 'offensive', note: 'Desrespeitoso' });
    await expect(chamar(k, ANA, { action: 'queue' })).rejects.toMatchObject({ code: 'permission-denied' });
    const { items } = await chamar(k, ADM, { action: 'queue' });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: DOC, report_reason: 'offensive', reported_by: 'owner', feedback: { text_improve: 'Devolver mais fundo.' } });
    expect(items[0]).not.toHaveProperty('owner_uid');
    await expect(chamar(k, ADM, { action: 'moderate', docId: DOC, decision: 'remove_feedback', reason: 'x' })).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(chamar(k, ANA, { action: 'moderate', docId: DOC, decision: 'remove_feedback', reason: 'Ofensivo demais' })).rejects.toMatchObject({ code: 'permission-denied' });
    await chamar(k, ADM, { action: 'moderate', docId: DOC, decision: 'remove_feedback', reason: 'Ofensivo demais' });
    expect(doc(k)).toMatchObject({ feedback: null });
    expect(denuncia(k, 'owner')).toMatchObject({ open: false, moderation: { decision: 'remove_feedback', reason: 'Ofensivo demais' } });
    expect(denuncia(k, 'owner').moderation).not.toHaveProperty('by');
    expect(avisos(k).at(-1)).toMatchObject({ user_id: 'bia222', origin: 'server' });
    expect(avisos(k).at(-1).message).toContain('Ofensivo demais');
    expect(auditorias(k).at(-1)).toMatchObject({ action: 'career_partner_moderated', actor_id: 'adm999', details: { decision: 'remove_feedback', reason: 'Ofensivo demais' } });
    expect((await chamar(k, ADM, { action: 'queue' })).items).toHaveLength(0);
  });

  it('"Não jogamos juntos": a dupla denuncia e a moderação retira o pedido, avisando quem o fez', async () => {
    const k = cenario();
    await convidar(k);
    await chamar(k, BIA, { action: 'report', docId: DOC, reason: 'false_claim' });
    await chamar(k, ADM, { action: 'moderate', docId: DOC, decision: 'remove_link', reason: 'A dupla disse que não jogou' });
    expect(doc(k)).toBeUndefined();
    expect(avisos(k).at(-1)).toMatchObject({ user_id: 'ana111' });
    // Pedir de novo logo depois não desfaz a decisão da moderação.
    await expect(convidar(k)).rejects.toMatchObject({ code: 'failed-precondition' });
    expect(doc(k)).toBeUndefined();
  });

  it('⭐ a denúncia não fica no pedido que o denunciado lê (motivo, nota e quem denunciou)', async () => {
    const k = await comVisao();
    await chamar(k, ANA, { action: 'report', docId: DOC, reason: 'offensive', note: 'Nota secreta' });
    expect(JSON.stringify(doc(k))).not.toMatch(/Nota secreta|offensive|reported/);
    expect(denuncia(k, 'owner')).toMatchObject({ reporter_uid: 'ana111', reason: 'offensive', note: 'Nota secreta', open: true });
  });

  it('⭐ editar a visão denunciada é recusado: a denúncia segue na fila', async () => {
    const k = await comVisao();
    await chamar(k, ANA, { action: 'report', docId: DOC, reason: 'offensive' });
    await expect(chamar(k, BIA, { action: 'feedback', docId: DOC, feedback: { strengths: ['dink'] } })).rejects.toMatchObject({ code: 'failed-precondition' });
    expect((await chamar(k, ADM, { action: 'queue' })).items).toHaveLength(1);
  });

  it('a mesma denúncia sobre a mesma visão, depois de descartada, não volta à fila', async () => {
    const k = await comVisao();
    await chamar(k, ANA, { action: 'report', docId: DOC, reason: 'offensive' });
    await chamar(k, ADM, { action: 'moderate', docId: DOC, decision: 'dismiss', reason: 'Não é ofensivo' });
    await chamar(k, ANA, { action: 'report', docId: DOC, reason: 'offensive' });
    expect((await chamar(k, ADM, { action: 'queue' })).items).toHaveLength(0);
  });

  it('a dupla desfaz a confirmação: o pedido some (não vira "não foi assim") e quem registrou é avisado', async () => {
    const k = cenario();
    await convidar(k);
    await chamar(k, BIA, { action: 'respond', docId: DOC, answer: 'confirm' });
    await chamar(k, BIA, { action: 'remove', docId: DOC });
    expect(doc(k)).toBeUndefined();
    expect(avisos(k).at(-1)).toMatchObject({ user_id: 'ana111', origin: 'server' });
  });

  it('apagar o pedido solta o vínculo do registro espelhado da dupla', async () => {
    const k = cenario();
    await convidar(k);
    await chamar(k, BIA, { action: 'respond', docId: DOC, answer: 'confirm' });
    const espelho = { ...evento({ uid: 'bia222', entries: [{ format: 'doubles', partner: { uid: 'ana111', name: 'Ana' } }] }), linked_event: { uid: 'ana111', id: EV_ID } };
    await gatilho(k, null, espelho, 'bia222_m1');
    await chamar(k, ANA, { action: 'remove', docId: DOC });
    expect(k.db.store.docs.get('career_events/bia222_m1').linked_event).toBeNull();
  });

  it('ação desconhecida é recusada', async () => {
    await expect(chamar(cenario(), ANA, { action: 'publish' })).rejects.toMatchObject({ code: 'invalid-argument' });
  });
});

describe('lembretes do planejado (varredura diária)', () => {
  const plano = (extra) => ({ uid: 'ana111', name: 'Open Floripa', status: 'planned', start_date: '2026-11-20', ...extra });
  const base = (flag = true) => ({
    db: createFakeDb({
      'platform_settings/global': { feature_flags: { athlete_career: flag } },
      'career_events/ana111_p1': plano({ registration_deadline: '2026-11-07' }),
      'career_events/ana111_p2': plano({ registration_deadline: '2026-11-07', registered: true }),
      'career_events/ana111_p3': plano({ start_date: '2026-11-03', focus_aspect: 'third_shot' }),
      'career_events/ana111_p4': plano({ start_date: '2026-11-01', end_date: '2026-11-03' }),
      'career_events/ana111_p5': plano({ start_date: '2026-11-03', end_date: '2026-11-04' }),
      // O plano de um torneio DAQUI não pergunta "Como foi?": vale o oficial.
      'career_events/ana111_p6': plano({ start_date: '2026-11-03', origin_ref: 'tor:t1' }),
      'career_events/ana111_j1': evento({ start_date: '2026-11-03', status: 'played' }),
    }),
  });
  it('D-3 só para quem não se inscreveu; D+1 do planejado que terminou ontem; sem repetir', async () => {
    const k = base();
    expect(await c.reminders(ctx(k))).toEqual({ avisos: 3 });
    const ids = [...k.db.store.docs.keys()].filter((p) => p.startsWith('notifications/')).sort();
    expect(ids).toEqual([
      'notifications/carreira_d1_ana111_p3', 'notifications/carreira_d1_ana111_p4', 'notifications/carreira_prazo_ana111_p1_2026-11-07',
    ]);
    avisos(k).forEach((a) => expect(a).toMatchObject({ user_id: 'ana111', type: 'career', origin: 'server', read: false }));
    expect(avisos(k).every((a) => !a.link.includes('#'))).toBe(true);
    expect(await c.reminders(ctx(k))).toEqual({ avisos: 0 });
  });
  it('sem a flag, nada', async () => {
    const k = base(false);
    expect(await c.reminders(ctx(k))).toMatchObject({ avisos: 0, desligada: true });
    expect(avisos(k)).toHaveLength(0);
  });
});
