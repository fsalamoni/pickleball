import { describe, it, expect } from 'vitest';
import {
  awaitsOwner, awaitsPartner, careerFingerprint, careerPartnerPending, citedEntryIndexes, eventPartnerUids,
  isAdult, mirrorEventDraft, declinedNeedsChange, normalizePartnerFeedback, partnerDocFor, partnerDocId, partnerSealFor,
  partnerVoices, pastPartners,
} from './careerPartner.js';
import { careerSeal, normalizeCareerEvent } from './careerEvent.js';
import { buildCareerTimeline } from './timeline.js';
import { debriefFocus } from '@/modules/training/domain/debrief.js';

const EV = {
  id: 'eu_1', uid: 'eu', name: 'Open', start_date: '2025-05-10', status: 'played',
  entries: [
    { format: 'doubles', gender: 'mixed', placement: 'champion', partner: { uid: 'bia', name: 'Bia' } },
    { format: 'singles', partner: { uid: 'bia', name: 'Bia' } },
    { format: 'doubles', gender: 'female', partner: { uid: 'cau', name: 'Cau' } },
  ],
};

describe('a dupla citada', () => {
  it('só as categorias de dupla contam; simples não', () => {
    expect(citedEntryIndexes(EV, 'bia')).toEqual([0]);
    expect(citedEntryIndexes(EV, 'cau')).toEqual([2]);
    expect(citedEntryIndexes(EV, 'x')).toEqual([]);
    expect(eventPartnerUids(EV)).toEqual(['bia', 'cau']);
    expect(partnerDocId('eu_1', 'bia')).toBe('eu_1__bia');
  });

  it('⭐ trocar o nome NÃO muda a impressão; trocar a data ou a colocação muda', () => {
    const base = careerFingerprint(EV, [0]);
    const nome = { ...EV, name: 'Open de Floripa', entries: EV.entries.map((e, i) => (i === 0 ? { ...e, partner: { uid: 'bia', name: 'Beatriz' } } : e)) };
    expect(careerFingerprint(nome, [0])).toBe(base);
    expect(careerFingerprint({ ...EV, start_date: '2025-05-11' }, [0])).not.toBe(base);
    const vice = { ...EV, entries: EV.entries.map((e, i) => (i === 0 ? { ...e, placement: 'runner_up' } : e)) };
    expect(careerFingerprint(vice, [0])).not.toBe(base);
    // Apagar ou reordenar OUTRA categoria não muda o que esta dupla confirmou.
    const reordenado = { ...EV, entries: [{ format: 'doubles', partner: { uid: 'cau' } }, EV.entries[0]] };
    expect(careerFingerprint(reordenado, [1])).toBe(base);
  });

  it('nascimento desconhecido conta como menor; 18 anos no dia já é adulto', () => {
    expect(isAdult('', '2026-11-04')).toBe(false);
    expect(isAdult('2008-11-04', '2026-11-04')).toBe(true);
    expect(isAdult('2008-11-05', '2026-11-04')).toBe(false);
  });

  it('a visão precisa de algo e fica nos limites', () => {
    expect(normalizePartnerFeedback({}).valid).toBe(false);
    const { valid, value } = normalizePartnerFeedback({ strengths: ['saque', 'saque', 'xx', 'dink', 'drive', 'mental'], text_drill: 'x'.repeat(400) });
    expect(valid).toBe(true);
    expect(value.strengths).toEqual(['saque', 'dink', 'drive']);
    expect(value.text_drill.length).toBe(280);
  });
});

describe('o que a tela deriva', () => {
  const docs = [
    { id: 'eu_1__bia', event_id: 'eu_1', owner_uid: 'eu', partner_uid: 'bia', partner_name: 'Bia', status: 'confirmed', feedback: { improve: ['dink'] }, owner_decision: 'pending' },
    { id: 'eu_1__cau', event_id: 'eu_1', owner_uid: 'eu', partner_uid: 'cau', status: 'invited' },
    { id: 'ze_9__eu', event_id: 'ze_9', owner_uid: 'ze', partner_uid: 'eu', status: 'reconfirm' },
  ];

  it('⭐ selo: pedido em aberto = aguardando; confirmado só sem nada esperando', () => {
    expect(partnerSealFor('eu_1', docs)).toBe('awaiting');
    expect(partnerSealFor('eu_1', docs.slice(0, 1))).toBe('confirmed');
    expect(partnerSealFor('outro', docs)).toBeNull();
    expect(careerSeal(EV, [], 'confirmed')).toBe('confirmed');
    expect(careerSeal(EV, [], 'awaiting')).toBe('declared');
    expect(partnerDocFor(docs, 'eu_1', 'cau').id).toBe('eu_1__cau');
  });

  it('⭐ "Precisa de você": lista que não carregou não vira zero', () => {
    expect(careerPartnerPending(undefined, 'eu')).toBeUndefined();
    expect(careerPartnerPending(docs, 'eu')).toEqual({ convites: 1, visoes: 1, convite: 'ze_9__eu', visaoEvento: 'eu_1' });
    expect(awaitsPartner(docs[2])).toBe(true);
    expect(awaitsOwner(docs[0])).toBe(true);
  });

  it('a voz da dupla: só as visões marcadas "Usar no meu treino"', () => {
    expect(partnerVoices(docs, 'eu')).toEqual([]);
    const usada = [{ ...docs[0], owner_decision: 'use', decided_at_ms: 2 }];
    expect(partnerVoices(usada, 'eu')).toEqual([{ name: 'Bia', aspects: ['dink'] }]);
    expect(partnerVoices(usada, 'bia')).toEqual([]);
  });

  it('⭐ a voz da dupla entra no foco do balanço e diz que veio dela', () => {
    const { focus } = debriefFocus({ weaknesses: [], strengths: [] }, [], { partnerVoices: [{ name: 'Bia', aspects: ['dink'] }] });
    expect(focus[0]).toMatchObject({ id: 'dink', partner: ['Bia'] });
    expect(focus[0].reason).toContain('Bia');
    const sem = debriefFocus({ weaknesses: [], strengths: [] }, []);
    expect(sem.focus).toEqual([]);
  });

  it('"Pôr na minha carreira também": a dupla invertida e o vínculo', () => {
    const d = mirrorEventDraft({ owner_uid: 'dono123', owner_name: 'Eu', event_id: 'dono123_1', summary: { name: 'Open', start_date: '2025-05-10', entries: [{ format: 'doubles', placement: 'champion' }] } });
    expect(d.entries[0].partner).toEqual({ uid: 'dono123', name: 'Eu' });
    expect(d.linked_event).toEqual({ uid: 'dono123', id: 'dono123_1' });
    const { valid, value } = normalizeCareerEvent(d, { uid: 'bia123' });
    expect(valid).toBe(true);
    expect(value.partner_uids).toEqual(['dono123']);
    expect(value.linked_event).toEqual({ uid: 'dono123', id: 'dono123_1' });
    expect(mirrorEventDraft({})).toBeNull();
  });

  it('"Com quem você já jogou": quem mais jogou junto primeiro, sem a própria pessoa', () => {
    const lista = pastPartners({
      career: [EV, { id: 'eu_2', entries: [{ partner: { uid: 'cau', name: 'Cau' } }] }],
      trophies: [{ id: 't1', people: [{ user_id: 'eu', name: 'Eu' }, { user_id: 'dani', name: 'Dani', photo_url: 'f' }] }],
      me: 'eu',
    });
    expect(lista.map((p) => [p.uid, p.together])).toEqual([['cau', 2], ['bia', 1], ['dani', 1]]);
  });

  it('a linha do tempo diz quando as confirmações não carregaram, e mostra o selo', () => {
    const fontes = { career: [EV], tournaments: [], trophies: { torneios: [], diasDeJogo: [] }, gameDayGames: [], federationPoints: [] };
    expect(buildCareerTimeline({ ...fontes, partners: undefined }).faltou.join(' ')).toContain('duplas');
    const conf = { event_id: 'eu_1', partner_uid: 'bia', status: 'confirmed', fingerprint: careerFingerprint(EV, citedEntryIndexes(EV, 'bia')) };
    const tl = buildCareerTimeline({ ...fontes, partners: [conf] });
    expect(tl.faltou).toEqual([]);
    const item = tl.seasons.flatMap((s) => s.items)[0];
    expect(item.seal).toBe('confirmed');
  });

  it('⭐ o selo só vale se o registro é o que a dupla confirmou; "pedir de novo" só com a ficha corrigida', () => {
    const conf = { event_id: 'eu_1', partner_uid: 'bia', status: 'confirmed', fingerprint: careerFingerprint(EV, citedEntryIndexes(EV, 'bia')) };
    expect(partnerSealFor(EV, [conf])).toBe('confirmed');
    const mudou = { ...EV, start_date: '2020-01-02' };
    expect(partnerSealFor(mudou, [conf])).toBeNull();
    const recusado = { ...conf, status: 'declined' };
    expect(declinedNeedsChange(EV, recusado)).toBe(true);
    expect(declinedNeedsChange(mudou, recusado)).toBe(false);
  });
});
