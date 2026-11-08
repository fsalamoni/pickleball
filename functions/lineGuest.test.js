/**
 * A câmera CONVIDADA do controle de linhas (docs/53 §5c), contra um Firestore
 * falso: o QR vale só com o convite gravado (pelo hash do token), dentro da
 * validade e com o controle ligado na quadra; a câmera grava exatamente os
 * campos da câmera com conta, na posição DO CONVITE (nunca na que o aparelho
 * pede), e vencido, inexistente e quadra desligada respondem igual.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const g = require('./lineGuest.js');
const { createFakeDb, FakeFieldValue } = require('../tests/fakes/fakeFirestore.cjs');

const NOW = Date.UTC(2026, 10, 7, 18, 0, 0);
const TOKEN = 'abcdefghijklmnopqrstuvwxyzABCDEF0123456789';
const HASH = g.hashToken(TOKEN);
const HOST = 'game_days/G1/line_courts/court-1';
const UID = `guest_${HASH.slice(0, 16)}`;

function cenario({ flag = true, line = true, exp = NOW + 3600000, host = HOST, extra = {} } = {}) {
  return createFakeDb({
    'platform_settings/global': { feature_flags: { line_control: flag } },
    'game_days/G1': { title: 'Quinta à noite' },
    [host]: { line_control: line, line_control_layout: 'duas_fundos' },
    [`${host}/line_invites/${HASH}`]: { position: 'fundo_a', exp_ms: exp, created_at: 1 },
    ...extra,
  });
}
const chamar = (db, data, now = NOW) => g.lineGuest({ db, now, FieldValue: FakeFieldValue }, { host: HOST, token: TOKEN, ...data });
const docs = (db, prefix) => [...db.store.docs.entries()].filter(([p]) => p.startsWith(prefix));

describe('o convite', () => {
  it('⭐ vale: devolve a posição do convite, o arranjo e o nome do dia', async () => {
    const r = await chamar(cenario(), { action: 'peek' });
    expect(r).toEqual({ position: 'fundo_a', layout: 'duas_fundos', exp_ms: NOW + 3600000, title: 'Quinta à noite' });
  });

  it('🔴 vencido, inexistente, quadra desligada e token errado respondem igual', async () => {
    const casos = [
      [cenario({ exp: NOW - 1 }), {}],
      [cenario({ line: false }), {}],
      [cenario({ flag: false }), {}],
      [cenario(), { token: 'Z'.repeat(40) }],
      [cenario({ exp: NOW + 13 * 3600000 }), {}],
    ];
    for (const [db, data] of casos) {
      // eslint-disable-next-line no-await-in-loop
      await expect(chamar(db, { action: 'peek', ...data })).rejects.toMatchObject({ message: g.NEUTRO });
    }
  });

  it('🔴 caminho de quadra fora do formato é recusado antes de ler o banco', async () => {
    await expect(chamar(cenario(), { action: 'peek', host: 'users/ana' })).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('quadra de torneio: o nome vem da quadra', async () => {
    const host = 'tournament_line_courts/T1_q1';
    const db = createFakeDb({
      'platform_settings/global': { feature_flags: { line_control: true } },
      [host]: { line_control: true, court_name: 'Quadra central' },
      [`${host}/line_invites/${HASH}`]: { position: 'rede_1', exp_ms: NOW + 60000 },
    });
    const r = await chamar(db, { action: 'peek', host });
    expect(r).toMatchObject({ position: 'rede_1', title: 'Quadra central', layout: null });
  });
});

describe('a câmera no ar e as marcações', () => {
  it('⭐ o sinal grava só os campos da câmera com conta, na posição do convite, como "Convidado"', async () => {
    const db = cenario();
    await chamar(db, { action: 'beat', cam: { calibrated: true, analyzing: true, fps: 59.6, battery: 81.4, charging: false, checkCm: 1.23, position: 'topo' } });
    const [[path, d]] = docs(db, `${HOST}/line_cams/`);
    expect(path).toBe(`${HOST}/line_cams/${UID}_fundo_a`);
    expect(Object.keys(d).sort()).toEqual(['analyzing', 'battery', 'calibrated', 'charging', 'check_cm', 'fps', 'layout', 'name', 'position', 'seen_ms', 'uid', 'updated_at']);
    expect(d).toMatchObject({ uid: UID, name: 'Convidado', position: 'fundo_a', fps: 60, battery: 81, check_cm: 1.2, seen_ms: NOW });
    await chamar(db, { action: 'leave' });
    expect(docs(db, `${HOST}/line_cams/`)).toHaveLength(0);
  });

  it('o aviso da câmera (mexeu / escura) passa; outro texto não', async () => {
    const db = cenario();
    await chamar(db, { action: 'beat', cam: { calibrated: true, alert: 'moved' } });
    expect(docs(db, `${HOST}/line_cams/`)[0][1].alert).toBe('moved');
    await chamar(db, { action: 'beat', cam: { calibrated: true, alert: '<script>' } });
    expect(docs(db, `${HOST}/line_cams/`)[0][1].alert).toBeUndefined();
  });

  it('a marcação vai para line_calls com a posição do convite', async () => {
    const db = cenario();
    await chamar(db, { action: 'call', call: { kind: 'bounce', call: 'out', reason: 'long', t_ms: NOW - 500, margin_m: -0.39123, x: 1, y: 2, uid: 'outra', position: 'topo' } });
    const [[, d]] = docs(db, `${HOST}/line_calls/`);
    expect(d).toMatchObject({ uid: UID, position: 'fundo_a', kind: 'bounce', call: 'out', reason: 'long', margin_m: -0.391 });
    expect(d.t_ms).toBe(NOW - 500);
  });

  it('com a hora do aparelho no envio, a do lance vira a do servidor (relógio 20 min atrasado)', async () => {
    const db = cenario();
    const atraso = 20 * 60000;
    // Antes seria recusada por "fora de hora"; agora entra na hora certa.
    await chamar(db, { action: 'call', client_ms: NOW - atraso, call: { kind: 'bounce', call: 'in', t_ms: NOW - atraso - 800 } });
    const [[, d]] = docs(db, `${HOST}/line_calls/`);
    expect(d.t_ms).toBe(NOW - 800);
  });

  it('🔴 marcação de tipo desconhecido ou fora de hora é recusada', async () => {
    const db = cenario();
    await expect(chamar(db, { action: 'call', call: { kind: 'pulo', call: 'out', t_ms: NOW } })).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(chamar(db, { action: 'call', call: { kind: 'bounce', call: 'in', t_ms: NOW - 3600000 } })).rejects.toMatchObject({ code: 'invalid-argument' });
    expect(docs(db, `${HOST}/line_calls/`)).toHaveLength(0);
  });

  it('🔴 convite apagado derruba a câmera: o próximo sinal é recusado', async () => {
    const db = cenario();
    db.store.docs.delete(`${HOST}/line_invites/${HASH}`);
    await expect(chamar(db, { action: 'beat', cam: {} })).rejects.toMatchObject({ message: g.NEUTRO });
  });
});

describe('a calibração pela central (sem conta)', () => {
  const FOTO = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
  const CAL = `${HOST}/line_calib/${UID}_fundo_a`;

  it('⭐ grava a foto na posição do convite e devolve o que quem organiza mandou', async () => {
    const db = cenario();
    await chamar(db, { action: 'calib', fields: { snap: FOTO, vw: 1920, vh: 1080, cur: { corners: [{ x: 1, y: 2 }], zone: 'full', hue: 60 }, position: 'topo', uid: 'x' } });
    expect(db.store.docs.get(CAL)).toMatchObject({ uid: UID, position: 'fundo_a', snap: FOTO, snap_ms: NOW, vw: 1920, vh: 1080, cur: { corners: [{ x: 1, y: 2 }], zone: 'full', hue: 60 } });
    db.store.docs.set(CAL, { ...db.store.docs.get(CAL), calib: { corners: [] }, calib_ms: 7, run: true, run_ms: 8, snap_req_ms: 9 });
    const r = await chamar(db, { action: 'calib' });
    expect(r).toMatchObject({ calib: { corners: [] }, calib_ms: 7, run: true, run_ms: 8, snap_req_ms: 9, vw: 1920 });
    expect(r.snap).toBeUndefined();
  });

  it('🔴 foto que não é JPEG ou grande demais é recusada; sair apaga a foto', async () => {
    const db = cenario();
    await expect(chamar(db, { action: 'calib', fields: { snap: 'data:text/html,<b>' } })).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(chamar(db, { action: 'calib', fields: { snap: `${FOTO}${'A'.repeat(g.SNAP_MAX)}` } })).rejects.toMatchObject({ code: 'invalid-argument' });
    await chamar(db, { action: 'calib', fields: { snap: FOTO } });
    await chamar(db, { action: 'leave' });
    expect(db.store.docs.has(CAL)).toBe(false);
  });

  it('🔴 sem convite válido, nada da calibração passa', async () => {
    const db = cenario({ line: false });
    await expect(chamar(db, { action: 'calib', fields: { snap: FOTO } })).rejects.toMatchObject({ message: g.NEUTRO });
    expect(db.store.docs.has(CAL)).toBe(false);
  });
});
