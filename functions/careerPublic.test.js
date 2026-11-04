/**
 * A VITRINE pública da Minha carreira no SERVIDOR, contra um Firestore e um
 * Storage falsos: menor não publica (a mesma resposta, nada gravado); caminho de
 * foto de outra pessoa é recusado; a foto sai sem EXIF para `carreira-publica/`;
 * a crítica, a anotação e o link nunca aparecem; o nome da dupla só com o "sim"
 * dela; o selo é recalculado; tirar da vitrine, apagar e deixar de jogar removem
 * o documento E a foto pública.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const c = require('./careerPublic.js');
const { createFakeDb } = require('../tests/fakes/fakeFirestore.cjs');

const NOW = Date.UTC(2026, 10, 4, 15, 0, 0);
const ANA = { uid: 'ana111', name: 'Ana' };
const BIA = { uid: 'bia222', name: 'Bia' };
const EV_ID = 'ana111_ev1';
const PEDIDO = `${EV_ID}__bia222`;
const FOTO = 'carreira/ana111/1-a.jpg';

// JPEG mínimo com um APP1 Exif (GPS) — o servidor tem de tirá-lo.
const seg = (m, payload) => [0xff, m, (payload.length + 2) >> 8, (payload.length + 2) & 0xff, ...payload];
const JPEG_COM_EXIF = Uint8Array.from([0xff, 0xd8, ...seg(0xe0, [0x4a, 0x46, 0x49, 0x46, 0]), ...seg(0xe1, [0x45, 0x78, 0x69, 0x66, 0, 0, 1, 2, 3]), 0xff, 0xda, 0, 2, 9, 9, 0xff, 0xd9]);

function fakeBucket(seed = {}) {
  const arquivos = new Map(Object.entries(seed));
  const file = (name) => ({
    name,
    async getMetadata() { if (!arquivos.has(name)) throw new Error('404'); const f = arquivos.get(name); return [{ contentType: f.contentType, size: f.bytes.length }]; },
    async download() { return [Buffer.from(arquivos.get(name).bytes)]; },
    async save(buf, opts) { arquivos.set(name, { bytes: Uint8Array.from(buf), contentType: opts.contentType, meta: opts.metadata }); },
    async delete() { arquivos.delete(name); },
  });
  return { name: 'balde', arquivos, file };
}

const evento = (extra = {}) => ({
  uid: 'ana111', name: 'Copa Sul', start_date: '2026-10-10', status: 'played', city: 'Curitiba', state: 'PR',
  notes: 'ANOTACAO-PRIVADA', link: 'https://exemplo.com/privado', cost_cents: 9900, aim: 'META-PRIVADA',
  entries: [{ format: 'doubles', gender: 'mixed', placement: 'champion', partner: { uid: 'bia222', name: 'Bia' } }],
  photos: [{ path: FOTO, url: 'https://token-privado', kind: 'medal', alt: 'A medalha' }],
  ...extra,
});

const confirmado = (extra = {}) => ({
  owner_uid: 'ana111', partner_uid: 'bia222', event_id: EV_ID, owner_name: 'Ana Souza', partner_name: 'Bia Lima',
  status: 'confirmed', fingerprint: '2026-10-10||day|doubles:mixed:::::champion:',
  feedback: { strengths: ['dink'], improve: ['saque'], text_strength: 'FORTE', text_improve: 'CRITICA-PRIVADA', text_drill: 'DRILL' },
  ...extra,
});

function cenario({ anaNasc = '1990-06-01', biaNasc = '1995-01-01', ev = evento(), pedido = null, extra = {} } = {}) {
  return {
    db: createFakeDb({
      'platform_settings/global': { feature_flags: { athlete_career: true } },
      'users/ana111': { platform_name: 'Ana Souza', ...(anaNasc ? { birth_date: anaNasc } : {}) },
      'users/bia222': { platform_name: 'Bia Lima', photo_url: 'https://foto/bia', ...(biaNasc ? { birth_date: biaNasc } : {}) },
      [`career_events/${EV_ID}`]: ev,
      ...(pedido ? { [`career_partner/${PEDIDO}`]: pedido } : {}),
      ...extra,
    }),
    bucket: fakeBucket({ [FOTO]: { bytes: JPEG_COM_EXIF, contentType: 'image/jpeg' } }),
  };
}
const ctx = (k) => ({ db: k.db, bucket: k.bucket, now: NOW, Timestamp: { fromMillis: (ms) => ({ ms }) } });
const chamar = (k, actor, data) => c.careerPublic(ctx(k), actor, data);
const vitrine = (k, id = EV_ID) => k.db.store.docs.get(`career_public/${id}`);
const publico = (k) => [...k.bucket.arquivos.keys()].filter((p) => p.startsWith('carreira-publica/'));
const avisos = (k) => [...k.db.store.docs.entries()].filter(([p]) => p.startsWith('notifications/')).map(([, d]) => d);
const gravacoes = (k) => k.db.store.docs.size;
const publicar = (k, photos = [FOTO]) => chamar(k, ANA, { action: 'publish', eventId: EV_ID, photos });

describe('publicar: só maior, só a própria foto, só os campos da lista', () => {
  it('⭐ o dono publica: a cópia escolhida, sem anotação/link/custo/meta, a foto sem EXIF na pasta pública', async () => {
    const k = cenario();
    expect(await publicar(k)).toEqual({ id: EV_ID, published: true });
    const v = vitrine(k);
    expect(v).toMatchObject({ uid: 'ana111', event_id: EV_ID, name: 'Copa Sul', seal: 'declared', city: 'Curitiba' });
    const txt = JSON.stringify(v);
    ['ANOTACAO-PRIVADA', 'exemplo.com', '9900', 'META-PRIVADA', 'token-privado', 'carreira/ana111/'].forEach((x) => expect(txt).not.toContain(x));
    expect(v.entries[0]).toEqual({ format: 'doubles', gender: 'mixed', placement: 'champion', with_partner: true });
    expect(v.photos).toHaveLength(1);
    expect(v.photos[0].path).toMatch(/^carreira-publica\/ana111\/ana111_ev1__[0-9a-f]{8}__1-a\.jpg$/);
    const copia = k.bucket.arquivos.get(v.photos[0].path);
    expect(Buffer.from(copia.bytes).includes(Buffer.from('Exif'))).toBe(false);
    expect(copia.meta.metadata.firebaseStorageDownloadTokens).toBeTruthy();
  });

  it('🔴 menor de 18 (ou sem nascimento): a MESMA resposta, e nada é gravado — nem documento, nem foto, nem auditoria', async () => {
    for (const anaNasc of ['2010-01-01', null]) {
      const k = cenario({ anaNasc });
      const antes = gravacoes(k);
      expect(await publicar(k)).toEqual({ id: EV_ID, published: true });
      expect(gravacoes(k)).toBe(antes);
      expect(vitrine(k)).toBeUndefined();
      expect(publico(k)).toEqual([]);
    }
  });

  it('🔴 caminho de foto de outra pessoa (ou com "..") é recusado, e nada é copiado', async () => {
    const k = cenario({ ev: evento({ photos: [{ path: 'carreira/bia222/x.jpg', kind: 'medal', alt: 'Dela' }] }) });
    await expect(publicar(k, ['carreira/bia222/x.jpg'])).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(publicar(k, ['carreira/ana111/../bia222/x.jpg'])).rejects.toMatchObject({ code: 'permission-denied' });
    expect(vitrine(k)).toBeUndefined();
    expect(publico(k)).toEqual([]);
  });

  it('torneio de outra pessoa, planejado, foto fora da ficha e foto sem descrição: recusados', async () => {
    await expect(chamar(cenario(), BIA, { action: 'publish', eventId: EV_ID })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(publicar(cenario({ ev: evento({ status: 'planned', start_date: '2026-12-01' }) }), [])).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(publicar(cenario(), ['carreira/ana111/nao-esta.jpg'])).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(publicar(cenario({ ev: evento({ photos: [{ path: FOTO, kind: 'medal', alt: ' ' }] }) }))).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('PNG com bloco de texto/EXIF é recusado (não dá para garantir que sai limpo)', async () => {
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 1, 0x74, 0x45, 0x58, 0x74, 0x41, 0, 0, 0, 0]);
    const k = cenario({ ev: evento({ photos: [{ path: 'carreira/ana111/p.png', kind: 'medal', alt: 'x' }] }) });
    k.bucket.arquivos.set('carreira/ana111/p.png', { bytes: png, contentType: 'image/png' });
    await expect(publicar(k, ['carreira/ana111/p.png'])).rejects.toMatchObject({ code: 'failed-precondition' });
    expect(publico(k)).toEqual([]);
  });

  it('🔴 JPEG com EXIF que o percurso não entende (segmento truncado, imagem extra no fim) é recusado — nunca sai como veio', async () => {
    const truncado = Uint8Array.from([0xff, 0xd8, ...seg(0xe1, [0x45, 0x78, 0x69, 0x66, 0, 0, 1]), 0x00, 0xff, 0xda, 0, 2, 9, 0xff, 0xd9]);
    const rabo = Uint8Array.from([0xff, 0xd8, ...seg(0xe0, [1, 2]), 0xff, 0xda, 0, 2, 9, 0xff, 0xd9, 0xff, 0xd8, ...seg(0xe1, [0x45, 0x78, 0x69, 0x66, 0, 0, 7])]);
    for (const bytes of [truncado, rabo]) {
      const k = cenario();
      k.bucket.arquivos.set(FOTO, { bytes, contentType: 'image/jpeg' });
      // eslint-disable-next-line no-await-in-loop
      await expect(publicar(k)).rejects.toMatchObject({ code: 'failed-precondition' });
      expect(publico(k)).toEqual([]);
    }
  });

  it('o limite de 20 torneios na vitrine vale', async () => {
    const extra = {};
    for (let i = 0; i < 20; i += 1) extra[`career_public/ana111_x${i}`] = { uid: 'ana111', photos: [] };
    await expect(publicar(cenario({ extra }), [])).rejects.toMatchObject({ code: 'failed-precondition' });
  });
});

describe('a dupla: nome só com o "sim" dela; a crítica nunca', () => {
  it('⭐ confirmada sem decidir: "com dupla" sem nome, selo confirmado e UM aviso perguntando', async () => {
    const k = cenario({ pedido: confirmado() });
    await publicar(k);
    const v = vitrine(k);
    expect(v.seal).toBe('confirmed');
    expect(v.entries[0].with_partner).toBe(true);
    expect(v.entries[0].partner).toBeUndefined();
    ['FORTE', 'CRITICA-PRIVADA', 'DRILL', 'Bia Lima'].forEach((x) => expect(JSON.stringify(v)).not.toContain(x));
    const [a] = avisos(k);
    expect(a).toMatchObject({ user_id: 'bia222', origin: 'server', type: 'career' });
    expect(a.link).not.toContain('#');
    await publicar(k);
    expect(avisos(k)).toHaveLength(1);
  });

  it('⭐ a dupla permite: nome e foto aparecem; retira: somem de novo', async () => {
    const k = cenario({ pedido: confirmado() });
    await publicar(k);
    await chamar(k, BIA, { action: 'public_consent', docId: PEDIDO, ok: true });
    expect(vitrine(k).entries[0].partner).toEqual({ uid: 'bia222', name: 'Bia Lima', photo_url: 'https://foto/bia' });
    await chamar(k, BIA, { action: 'public_consent', docId: PEDIDO, ok: false });
    expect(vitrine(k).entries[0].partner).toBeUndefined();
    expect(vitrine(k).entries[0].with_partner).toBe(true);
  });

  it('🔴 só a dupla decide; menor não permite; sem confirmação não permite', async () => {
    await expect(chamar(cenario({ pedido: confirmado() }), ANA, { action: 'public_consent', docId: PEDIDO, ok: true })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(chamar(cenario({ pedido: confirmado(), biaNasc: '2012-01-01' }), BIA, { action: 'public_consent', docId: PEDIDO, ok: true })).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(chamar(cenario({ pedido: confirmado({ status: 'invited' }) }), BIA, { action: 'public_consent', docId: PEDIDO, ok: true })).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('🔴 a dupla que consentiu mas virou "confirmar de novo" (ou a impressão não confere) some do nome e o selo cai', async () => {
    const k = cenario({ pedido: confirmado() });
    await publicar(k);
    await chamar(k, BIA, { action: 'public_consent', docId: PEDIDO, ok: true });
    expect(vitrine(k).entries[0].partner.name).toBe('Bia Lima');
    expect(vitrine(k).named_uids).toEqual(['bia222']);
    const fp = k.db.store.docs.get(`career_partner/${PEDIDO}`).public_fp;
    k.db.store.docs.set(`career_partner/${PEDIDO}`, confirmado({ public_ok_partner: true, public_fp: fp, status: 'reconfirm' }));
    await c.onPartner(ctx(k), null, { event_id: EV_ID });
    expect(vitrine(k).entries[0].partner).toBeUndefined();
    expect(vitrine(k).named_uids).toEqual([]);
    expect(vitrine(k).seal).toBe('declared');
  });

  it('🔴 o "sim" vale para o que a dupla viu: trocar o nome ou a cidade do torneio tira o nome dela e pergunta de novo', async () => {
    const k = cenario({ pedido: confirmado() });
    await publicar(k);
    await chamar(k, BIA, { action: 'public_consent', docId: PEDIDO, ok: true });
    expect(vitrine(k).entries[0].partner.name).toBe('Bia Lima');
    const antes = avisos(k).length;
    k.db.store.docs.set(`career_events/${EV_ID}`, evento({ name: 'Campeonato Nacional', city: 'Outra' }));
    await c.onEvent(ctx(k), EV_ID);
    expect(vitrine(k).entries[0].partner).toBeUndefined();
    expect(vitrine(k).entries[0].with_partner).toBe(true);
    expect(k.db.store.docs.get(`career_partner/${PEDIDO}`)).toMatchObject({ public_ok_partner: null, public_fp: null });
    expect(avisos(k).length).toBe(antes + 1);
    // Permitir de novo, agora com o nome novo, devolve o nome.
    await chamar(k, BIA, { action: 'public_consent', docId: PEDIDO, ok: true });
    expect(vitrine(k).entries[0].partner.name).toBe('Bia Lima');
  });

  it('⭐ a dupla que confirma DEPOIS de publicado também é perguntada (uma vez)', async () => {
    const k = cenario({ pedido: confirmado({ status: 'invited' }) });
    await publicar(k);
    expect(avisos(k)).toHaveLength(0);
    const antes = k.db.store.docs.get(`career_partner/${PEDIDO}`);
    k.db.store.docs.set(`career_partner/${PEDIDO}`, { ...antes, status: 'confirmed' });
    await c.onPartner(ctx(k), antes, k.db.store.docs.get(`career_partner/${PEDIDO}`));
    expect(avisos(k)).toHaveLength(1);
    await c.onPartner(ctx(k), antes, k.db.store.docs.get(`career_partner/${PEDIDO}`));
    expect(avisos(k)).toHaveLength(1);
  });
});

describe('o selo é do servidor', () => {
  it('"É este" só é oficial com o torneio público e a pessoa INSCRITA nele', async () => {
    const base = { ev: evento({ platform_tournament_id: 't1' }) };
    const semInscricao = cenario({ ...base, extra: { 'tournaments/t1': { status: 'finished', visibility: 'public' } } });
    await publicar(semInscricao, []);
    expect(vitrine(semInscricao).seal).toBe('declared');
    const inscrita = cenario({ ...base, extra: { 'tournaments/t1': { status: 'finished', visibility: 'public' }, 'tournament_registrations/r1': { tournament_id: 't1', player_b_user_id: 'ana111' } } });
    await publicar(inscrita, []);
    expect(vitrine(inscrita).seal).toBe('official');
  });
});

describe('editar, apagar e tirar: a vitrine segue o registro', () => {
  it('⭐ tirar da vitrine apaga o documento E a foto pública (com a flag desligada também)', async () => {
    const k = cenario();
    await publicar(k);
    k.db.store.docs.set('platform_settings/global', { feature_flags: { athlete_career: false } });
    expect(await chamar(k, ANA, { action: 'unpublish', eventId: EV_ID })).toEqual({ id: EV_ID, published: false });
    expect(vitrine(k)).toBeUndefined();
    expect(publico(k)).toEqual([]);
    await expect(chamar(k, BIA, { action: 'unpublish', eventId: EV_ID })).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('⭐ apagar o registro tira a vitrine e a foto pública (gatilho)', async () => {
    const k = cenario();
    await publicar(k);
    k.db.store.docs.delete(`career_events/${EV_ID}`);
    expect(await c.onEvent(ctx(k), EV_ID)).toBe('removed');
    expect(vitrine(k)).toBeUndefined();
    expect(publico(k)).toEqual([]);
  });

  it('editar atualiza (nome, colocação) e tirar a foto da ficha tira a cópia pública; editar de novo igual não regrava', async () => {
    const k = cenario();
    await publicar(k);
    k.db.store.docs.set(`career_events/${EV_ID}`, evento({ name: 'Copa do Sul', photos: [], entries: [{ format: 'singles', placement: 'runner_up' }] }));
    expect(await c.onEvent(ctx(k), EV_ID)).toBe('written');
    expect(vitrine(k)).toMatchObject({ name: 'Copa do Sul', photos: [], entries: [{ format: 'singles', placement: 'runner_up' }] });
    expect(publico(k)).toEqual([]);
    expect(await c.onEvent(ctx(k), EV_ID)).toBe('unchanged');
    // O Firestore devolve o mapa com as chaves em ordem alfabética: continua "igual".
    const ordena = (v) => (Array.isArray(v) ? v.map(ordena) : v && typeof v === 'object'
      ? Object.fromEntries(Object.keys(v).sort().map((x) => [x, ordena(v[x])])) : v);
    k.db.store.docs.set(`career_public/${EV_ID}`, ordena(vitrine(k)));
    expect(await c.onEvent(ctx(k), EV_ID)).toBe('unchanged');
  });

  it('🔴 o id com o prefixo de quem chama não basta: tirar confere o dono gravado', async () => {
    const k = cenario({ extra: { 'career_public/ana111_x': { uid: 'ana111_x', event_id: 'ana111_x', photos: [] } } });
    await expect(chamar(k, ANA, { action: 'unpublish', eventId: 'ana111_x' })).rejects.toMatchObject({ code: 'permission-denied' });
    expect(vitrine(k, 'ana111_x')).toBeTruthy();
  });

  it('virar planejado ou cancelado tira a vitrine; quem nunca publicou não ganha uma', async () => {
    const k = cenario();
    await publicar(k);
    k.db.store.docs.set(`career_events/${EV_ID}`, evento({ status: 'cancelled' }));
    expect(await c.onEvent(ctx(k), EV_ID)).toBe('removed');
    expect(await c.onEvent(ctx(cenario()), EV_ID)).toBe('absent');
  });
});
