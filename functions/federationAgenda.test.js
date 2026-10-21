/**
 * Calendário oficial no SERVIDOR contra um Firestore falso: quem marca o quê
 * (competições só a agenda esportiva), o evento divulgado não muda de data
 * nem some calado (motivo, histórico, aviso a quem segue), adiar/cancelar,
 * apagar só o que nunca foi divulgado, e a agenda assinável (ICS) só com o
 * que é público e os torneios chancelados.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ag = require('./federationAgenda.js');
const { createFakeDb } = require('../tests/fakes/fakeFirestore.cjs');

const NOW = Date.UTC(2026, 9, 21, 15, 0, 0);
const PRES = { uid: 'pres', name: 'Presidente' };
const SEC = { uid: 'sec', name: 'Secretaria' };
const COMP = { uid: 'comp', name: 'Competições' };
const FIN = { uid: 'fin' };

function cenario(mods = { calendar: true, official_docs: true, tournaments: true }) {
  return {
    db: createFakeDb({
      'platform_settings/global': { feature_flags: { federations: true } },
      'federations/fpp': { name: 'Federação Paulista', acronym: 'FPP', slug: 'fpp', status: 'approved', modules: mods },
      'federation_staff/fpp_pres': { federation_id: 'fpp', user_id: 'pres', role: 'president' },
      'federation_staff/fpp_sec': { federation_id: 'fpp', user_id: 'sec', role: 'secretary' },
      'federation_staff/fpp_comp': { federation_id: 'fpp', user_id: 'comp', role: 'competitions' },
      'federation_staff/fpp_fin': { federation_id: 'fpp', user_id: 'fin', role: 'treasurer' },
      'federation_members/fpp_ana': { federation_id: 'fpp', user_id: 'ana', status: 'active' },
      'federation_followers/fpp_ana': { federation_id: 'fpp', user_id: 'ana' },
      'federation_followers/fpp_bia': { federation_id: 'fpp', user_id: 'bia' },
      'federation_docs/edital1': { federation_id: 'fpp', status: 'published', code: 'Edital 1/2026', title: 'Convocação da AGO', type: 'notice', visibility: 'public' },
      'federation_docs/rasc1': { federation_id: 'fpp', status: 'draft', title: 'Rascunho', type: 'notice', visibility: 'public' },
      'tournaments/t1': { name: 'Open FPP', federation_id: 'fpp', federation_sanction: { status: 'approved' }, visibility: 'public', status: 'open', starts_at: '2026-11-07', ends_at: '2026-11-08', venue: 'Clube A', city: 'São Paulo' },
      'tournaments/t2': { name: 'Rascunho', federation_id: 'fpp', federation_sanction: { status: 'approved' }, visibility: 'public', status: 'draft', starts_at: '2026-11-07' },
    }),
  };
}
const ctx = ({ db }, now = NOW) => ({ db, now, Timestamp: { fromMillis: (ms) => ({ ms }) }, logger: { info() {}, warn() {} } });
const chamar = (c, actor, data, now) => ag.agenda(ctx(c, now), actor, { federationId: 'fpp', ...data });
const evento = (c, id) => c.db.store.docs.get(`federation_events/${id}`);
const avisos = (c) => [...c.db.store.docs.entries()].filter(([p]) => p.startsWith('notifications/')).map(([, d]) => d);
const ago = (extra = {}) => ({ kind: 'assembly_ordinary', title: 'AGO 2026', date: '2026-11-20', start_time: '19:00', end_time: '21:00', organ: 'Assembleia geral', visibility: 'public', ...extra });
const etapa = (extra = {}) => ({ kind: 'competition', title: 'Etapa 3', date: '2026-11-14', all_day: true, visibility: 'public', ...extra });

describe('calendário oficial: marcar', () => {
  it('docs e admin marcam qualquer evento; competições só a agenda esportiva; financeiro não marca', async () => {
    const c = cenario();
    await expect(chamar(c, FIN, { action: 'save', event: etapa() })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(chamar(c, COMP, { action: 'save', event: ago() })).rejects.toMatchObject({ code: 'permission-denied' });
    const r1 = await chamar(c, COMP, { action: 'save', event: etapa() });
    const r2 = await chamar(c, SEC, { action: 'save', event: ago() });
    expect(evento(c, r1.eventId)).toMatchObject({ federation_id: 'fpp', group: 'sport', status: 'scheduled', ever_visible: true, created_by: 'comp' });
    expect(evento(c, r2.eventId)).toMatchObject({ group: 'institutional', starts_at_ms: Date.UTC(2026, 10, 20, 22, 0), ends_at_ms: Date.UTC(2026, 10, 21, 0, 0) });
    await expect(chamar(c, COMP, { action: 'cancel', eventId: r2.eventId, reason: 'não é do meu setor' })).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('módulo desligado, federação não aprovada e dado inválido são recusados', async () => {
    await expect(chamar(cenario({}), SEC, { action: 'save', event: ago() })).rejects.toMatchObject({ code: 'failed-precondition' });
    const c = cenario();
    await expect(chamar(c, SEC, { action: 'save', event: ago({ date: '2026-02-30' }) })).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(chamar(c, SEC, { action: 'save', event: ago({ online_url: 'http://x.com' }) })).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(chamar(c, SEC, { action: 'nada' })).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('só liga documento PUBLICADO desta federação, guardando código e título', async () => {
    const c = cenario();
    await expect(chamar(c, SEC, { action: 'save', event: ago({ related_docs: [{ doc_id: 'rasc1' }] }) })).rejects.toMatchObject({ code: 'failed-precondition' });
    const r = await chamar(c, SEC, { action: 'save', event: ago({ related_docs: [{ doc_id: 'edital1' }] }) });
    expect(evento(c, r.eventId).related_docs).toEqual([{ doc_id: 'edital1', code: 'Edital 1/2026', title: 'Convocação da AGO', type: 'notice', visibility: 'public' }]);
  });

  it('avisa quem segue só quando a equipe pede; só filiados avisa só filiado; só equipe não avisa', async () => {
    const c = cenario();
    await chamar(c, SEC, { action: 'save', event: ago() });
    expect(avisos(c)).toHaveLength(0);
    const r = await chamar(c, SEC, { action: 'save', event: ago(), notify: true });
    expect(r.notified).toBe(2);
    expect(avisos(c).map((a) => a.title)).toEqual(expect.arrayContaining([expect.stringContaining('FPP')]));
    expect(avisos(c)[0].link).toBe(`/f/fpp/agenda/${r.eventId}`);
    const m = await chamar(c, SEC, { action: 'save', event: ago({ visibility: 'members' }), notify: true });
    expect(m.notified).toBe(1);
    const s = await chamar(c, SEC, { action: 'save', event: ago({ visibility: 'staff' }), notify: true });
    expect(s.notified).toBe(0);
    expect(evento(c, s.eventId).ever_visible).toBe(false);
  });
});

describe('calendário oficial: mudar o que já foi divulgado', () => {
  it('mudar a data de evento divulgado exige motivo, grava o histórico e avisa', async () => {
    const c = cenario();
    const { eventId } = await chamar(c, SEC, { action: 'save', event: ago() });
    await expect(chamar(c, SEC, { action: 'save', eventId, event: ago({ date: '2026-11-27' }) })).rejects.toMatchObject({ code: 'invalid-argument' });
    const r = await chamar(c, SEC, { action: 'save', eventId, event: ago({ date: '2026-11-27' }), reason: 'Sede indisponível no dia 20' });
    expect(r.notified).toBe(2);
    const ev = evento(c, eventId);
    expect(ev.date).toBe('2026-11-27');
    expect(ev.history).toEqual([expect.objectContaining({ kind: 'rescheduled', reason: 'Sede indisponível no dia 20', from_date: '2026-11-20', from_time: '19:00', to_date: '2026-11-27' })]);
    await chamar(c, SEC, { action: 'save', eventId, event: ago({ date: '2026-11-27', title: 'AGO 2026 — prestação de contas' }) });
    expect(evento(c, eventId).history).toHaveLength(1);
  });

  it('enquanto só a equipe viu, muda livre e apaga; depois de divulgado, não apaga', async () => {
    const c = cenario();
    const { eventId } = await chamar(c, SEC, { action: 'save', event: ago({ visibility: 'staff' }) });
    await chamar(c, SEC, { action: 'save', eventId, event: ago({ visibility: 'staff', date: '2026-12-01' }) });
    expect(evento(c, eventId).history).toEqual([]);
    await chamar(c, SEC, { action: 'delete', eventId });
    expect(evento(c, eventId)).toBeUndefined();
    const pub = await chamar(c, SEC, { action: 'save', event: ago() });
    await expect(chamar(c, SEC, { action: 'delete', eventId: pub.eventId })).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('adiar e cancelar pedem motivo, ficam no histórico e avisam; remarcar reabre', async () => {
    const c = cenario();
    const { eventId } = await chamar(c, PRES, { action: 'save', event: ago() });
    await expect(chamar(c, PRES, { action: 'postpone', eventId, reason: 'curto' })).rejects.toMatchObject({ code: 'invalid-argument' });
    await chamar(c, PRES, { action: 'postpone', eventId, reason: 'Aguardando a prestação de contas' });
    expect(evento(c, eventId)).toMatchObject({ status: 'postponed', status_reason: 'Aguardando a prestação de contas' });
    await expect(chamar(c, PRES, { action: 'postpone', eventId, reason: 'Aguardando de novo, outra vez' })).rejects.toMatchObject({ code: 'failed-precondition' });
    await chamar(c, PRES, { action: 'save', eventId, event: ago({ date: '2026-12-10' }), reason: 'Contas prontas, nova data' });
    expect(evento(c, eventId)).toMatchObject({ status: 'scheduled', date: '2026-12-10' });
    await chamar(c, PRES, { action: 'cancel', eventId, reason: 'Assembleia substituída pela extraordinária' });
    expect(evento(c, eventId).status).toBe('cancelled');
    await chamar(c, PRES, { action: 'save', eventId, event: ago({ date: '2026-12-10' }), reason: 'Retomada a pedido dos filiados' });
    expect(evento(c, eventId).history.map((h) => h.kind)).toEqual(['postponed', 'rescheduled', 'cancelled', 'reopened']);
    expect(avisos(c).length).toBe(8);
  });

  it('não adia o que já aconteceu', async () => {
    const c = cenario();
    const { eventId } = await chamar(c, SEC, { action: 'save', event: ago() });
    await expect(chamar(c, SEC, { action: 'postpone', eventId, reason: 'tarde demais para isso' }, Date.UTC(2026, 11, 1))).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('cada passo fica na auditoria', async () => {
    const c = cenario();
    const acoes = () => [...c.db.store.docs.entries()].filter(([p]) => p.startsWith('audit_logs/')).map(([, d]) => d.action);
    const { eventId } = await chamar(c, SEC, { action: 'save', event: ago({ visibility: 'staff' }) });
    expect(acoes()).toContain('federation_event_save');
    await chamar(c, SEC, { action: 'delete', eventId });
    expect(acoes()).toContain('federation_event_delete');
  });
});

describe('calendário oficial: agenda assinável', () => {
  it('só eventos públicos e torneios chancelados, pelo slug ou pelo id', async () => {
    const c = cenario();
    await chamar(c, SEC, { action: 'save', event: ago() });
    await chamar(c, SEC, { action: 'save', event: ago({ title: 'Reunião secreta', visibility: 'staff' }) });
    await chamar(c, SEC, { action: 'save', event: ago({ title: 'Só filiados', visibility: 'members' }) });
    const ics = await ag.feed(ctx(c), 'fpp');
    expect(ics).toContain('SUMMARY:AGO 2026');
    expect(ics).toContain('SUMMARY:Open FPP');
    expect(ics).not.toContain('secreta');
    expect(ics).not.toContain('Só filiados');
    expect(ics).not.toContain('Rascunho');
    expect(await ag.feed(ctx(c), 'nao-existe')).toBe(null);
    expect(await ag.feed(ctx(c), '../x')).toBe(null);
    expect(await ag.feed(ctx(cenario({})), 'fpp')).toBe(null);
  });
});
