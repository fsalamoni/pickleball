/**
 * PARIDADE cliente × servidor da VITRINE pública da Carreira: a lista
 * fechada de campos (o que pode ser público), os limites, o caminho da foto
 * pública, o selo (a mesma conta de `careerSeal` + `partnerSealFor`) e a
 * retirada do EXIF do JPEG (a mesma de `stripJpegMetadataBytes`).
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import * as c from '@/modules/career/domain/careerPublic.js';
import { careerSeal } from '@/modules/career/domain/careerEvent.js';
import { partnerSealFor } from '@/modules/career/domain/careerPartner.js';
import { stripJpegMetadataBytes } from '@/core/lib/imageMetadata.js';

const require = createRequire(import.meta.url);
const s = require('./careerPublicPolicy.js');

const EV = {
  id: 'ana111_ev1', uid: 'ana111', name: 'Copa', start_date: '2026-05-01', end_date: '2026-05-02', city: 'Floripa', state: 'SC',
  federated: true, federation_acronym: 'FCP', notes: 'x', link: 'https://x.y', aim: 'meta',
  entries: [
    { format: 'doubles', gender: 'mixed', placement: 'champion', partner: { uid: 'bia222', name: 'Bia' } },
    { format: 'doubles', gender: 'female', placement: 'third', partner: { name: 'Sem conta' } },
    { format: 'singles', age: 'other', age_label: '40+', placement: 'other', placement_n: 5 },
    { format: 'teams', team: { name: 'Time', members: [{ name: 'Z' }] } },
    // Equipe com dupla fixa: o nome da dupla segue a mesma regra das duplas (`formatHasPartner`).
    { format: 'teams', placement: 'runner_up', partner: { uid: 'cau333', name: 'Cau' }, team: { name: 'Time', members: [{ name: 'Z' }] } },
  ],
};
const FOTOS = [{ path: 'carreira-publica/ana111/a__1.jpg', url: 'u', kind: 'medal', alt: 'A' }, { path: 'p2', url: 'u2', alt: 'B' }];
const PARTNERS = [{}, { bia222: { name: 'Bia Lima', photo_url: 'f' } }, { bia222: { name: 'Bia', photo_url: null } },
  { bia222: { name: 'Bia Lima' }, cau333: { name: 'Cau Reis', photo_url: 'g' } }];

describe('a vitrine aplica a mesma régua nos dois lados', () => {
  it('limites e listas de campos', () => {
    expect(s.SHOWCASE_LIMITS).toEqual({ ...c.SHOWCASE_LIMITS });
    expect([...s.SHOWCASE_EVENT_FIELDS]).toEqual([...c.SHOWCASE_EVENT_FIELDS]);
    expect([...s.SHOWCASE_ENTRY_FIELDS]).toEqual([...c.SHOWCASE_ENTRY_FIELDS]);
  });

  it('a projeção pública', () => {
    ['official', 'confirmed', 'declared', 'forjado'].forEach((seal) => PARTNERS.forEach((partners) => {
      expect(s.showcaseItem(EV, { seal, partners, photos: FOTOS })).toEqual(c.showcaseItem(EV, { seal, partners, photos: FOTOS }));
    }));
    expect(s.showcaseItem(null)).toEqual(c.showcaseItem(null));
  });

  it('dupla em formato de equipe: com o "sim" sai o nome, sem ele "com dupla"; o time nunca sai', () => {
    const sem = s.showcaseItem(EV, { seal: 'declared', partners: {} }).entries[4];
    expect(sem).toMatchObject({ format: 'teams', with_partner: true });
    const com = s.showcaseItem(EV, { seal: 'declared', partners: PARTNERS[3] });
    expect(com.entries[4].partner).toEqual({ uid: 'cau333', name: 'Cau Reis', photo_url: 'g' });
    expect(com.named_uids).toEqual(['bia222', 'cau333']);
    expect(JSON.stringify(com)).not.toContain('Time');
  });

  it('inscrição que não vale para o selo Oficial: as mesmas que o torneio trata como inativas', async () => {
    const { summarizeMyRegistrations } = await import('@/modules/tournament/domain/participation.js');
    const { REGISTRATION_STATUS } = await import('@/modules/tournament/domain/constants.js');
    Object.values(REGISTRATION_STATUS).forEach((status) => {
      expect(s.INACTIVE_REGISTRATION.includes(status)).toBe(!summarizeMyRegistrations([{ status }]).isPlayer);
    });
  });

  it('o caminho da foto pública e a volta para a origem', () => {
    const p = c.publicPhotoPath('ana111', 'ana111_ev1', 'carreira/ana111/1-a.jpg');
    expect(s.publicPhotoPath('ana111', 'ana111_ev1', 'carreira/ana111/1-a.jpg')).toBe(p);
    expect(s.sourceOfPublicPhoto('ana111', p)).toBe(c.sourceOfPublicPhoto('ana111', p));
    expect(c.sourceOfPublicPhoto('ana111', p)).toBe('carreira/ana111/1-a.jpg');
  });

  it('o torneio pode ir à vitrine: a mesma pergunta na tela e no servidor', () => {
    const HOJE = '2026-11-04';
    [null, { status: 'played', start_date: '2026-10-01' }, { status: 'played', start_date: '2026-12-01' }, { status: 'planned', start_date: '2026-10-01' },
      { status: 'played', planned_passed: true, start_date: '2026-10-01' }, { status: 'cancelled', start_date: '2026-10-01' },
      { status: 'played', start_date: '2026-10-01', origin_ref: 'tor:t1' }, { status: 'played' }]
      .forEach((ev) => expect(s.canShowcaseEvent(ev, HOJE)).toBe(c.canShowcaseEvent(ev, HOJE)));
    expect(c.canShowcaseEvent({ status: 'played', start_date: '2026-10-01' }, HOJE)).toBe(true);
    expect(c.canShowcaseEvent({ status: 'played', planned_passed: true, start_date: '2026-10-01' }, HOJE)).toBe(false);
    expect(c.canShowcaseEvent({ status: 'played', start_date: '2026-10-01', origin_ref: 'tor:t1' }, HOJE)).toBe(false);
  });

  it('o selo do servidor é o do cliente', () => {
    const fp = '2026-05-01|2026-05-02|day|doubles:mixed:::::champion:';
    const docs = [
      [],
      [{ event_id: EV.id, partner_uid: 'bia222', status: 'confirmed', fingerprint: fp }],
      [{ event_id: EV.id, partner_uid: 'bia222', status: 'confirmed', fingerprint: 'velha' }],
      [{ event_id: EV.id, partner_uid: 'bia222', status: 'reconfirm', fingerprint: fp }],
      [{ event_id: EV.id, partner_uid: 'bia222', status: 'declined', fingerprint: fp }],
    ];
    docs.forEach((d) => {
      expect(s.showcaseSeal(EV, d, false)).toBe(careerSeal(EV, [], partnerSealFor(EV, d)));
      expect(s.showcaseSeal(EV, d, true)).toBe('official');
    });
  });

  it('o EXIF sai do JPEG do mesmo jeito', () => {
    const seg = (m, p) => [0xff, m, (p.length + 2) >> 8, (p.length + 2) & 0xff, ...p];
    const amostras = [
      Uint8Array.from([0xff, 0xd8, ...seg(0xe0, [1, 2]), ...seg(0xe1, [0x45, 0x78, 0x69, 0x66, 0, 0, 7]), ...seg(0xed, [3]), 0xff, 0xda, 0, 2, 5, 0xff, 0xd9]),
      Uint8Array.from([0xff, 0xd8, ...seg(0xe0, [1, 2]), 0xff, 0xda, 0, 2, 5, 0xff, 0xd9]),
      Uint8Array.from([1, 2, 3, 4]),
    ];
    amostras.forEach((b) => expect(s.stripJpegMetadataBytes(b)).toEqual(stripJpegMetadataBytes(b)));
  });
});
