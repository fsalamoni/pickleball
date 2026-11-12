import { describe, it, expect } from 'vitest';
import {
  canPublishShowcase, publishablePhotos, showcaseItem, showcasePartnerships, showcasePodium,
  showcaseTrophyContextId, sortShowcase,
} from './careerPublic.js';

const EV = {
  id: 'ana111_ev1', uid: 'ana111', name: 'Copa', start_date: '2026-05-01', notes: 'PRIVADO', link: 'https://x.y',
  cost_cents: 100, aim: 'META', focus_aspect: 'dink', shared_coach_id: 'prof', partner_uids: ['bia222'],
  entries: [
    { format: 'doubles', placement: 'champion', partner: { uid: 'bia222', name: 'Bia (digitado)' }, points_declared: 500, matches: [{ round: 'F' }] },
    { format: 'doubles', placement: 'quarters', partner: { name: 'Sem conta' } },
    { format: 'teams', team: { name: 'Time X', members: [{ uid: 'cau', name: 'Cau' }] } },
  ],
  photos: [{ path: 'carreira/ana111/a.jpg', alt: 'A medalha' }, { path: 'carreira/ana111/b.jpg', alt: '' }, { path: 'carreira/outro/c.jpg', alt: 'x' }],
};

describe('showcaseItem: só a lista fechada', () => {
  it('⭐ nada de anotação, link, custo, meta, foco, professor, pontos, jogos nem equipe', () => {
    const txt = JSON.stringify(showcaseItem(EV, { seal: 'declared' }));
    ['PRIVADO', 'x.y', 'META', 'dink', 'prof', 'points_declared', 'matches', 'Time X', 'Cau', 'partner_uids'].forEach((x) => expect(txt).not.toContain(x));
  });

  it('⭐ a dupla sem consentimento vira "com dupla"; com ele, o nome do PERFIL (não o digitado)', () => {
    expect(showcaseItem(EV, { seal: 'declared' }).entries[0]).toEqual({ format: 'doubles', placement: 'champion', with_partner: true });
    expect(showcaseItem(EV, { seal: 'declared', partners: { bia222: { name: 'Bia Lima' } } }).entries[0].partner)
      .toEqual({ uid: 'bia222', name: 'Bia Lima', photo_url: null });
    expect(showcaseItem(EV, { seal: 'declared', partners: { bia222: { name: 'Bia' } } }).entries[1]).toEqual({ format: 'doubles', placement: 'quarters', with_partner: true });
  });

  it('dupla em formato de EQUIPE segue a mesma regra das duplas (e o time continua fora)', () => {
    const ev = { ...EV, entries: [{ format: 'teams', partner: { uid: 'bia222', name: 'Bia' }, team: { name: 'Time X' } }] };
    expect(showcaseItem(ev, { seal: 'declared' }).entries[0]).toEqual({ format: 'teams', with_partner: true });
    const com = showcaseItem(ev, { seal: 'declared', partners: { bia222: { name: 'Bia Lima' } } });
    expect(com.entries[0].partner).toEqual({ uid: 'bia222', name: 'Bia Lima', photo_url: null });
    expect(com.named_uids).toEqual(['bia222']);
    expect(JSON.stringify(com)).not.toContain('Time X');
  });

  it('selo desconhecido vira declarado', () => {
    expect(showcaseItem(EV, { seal: 'forjado' }).seal).toBe('declared');
  });

  it('⭐ selo Oficial não leva a colocação DECLARADA (a oficial é a do pódio)', () => {
    const it0 = showcaseItem(EV, { seal: 'official' }).entries[0];
    expect(it0.placement).toBeUndefined();
    expect(it0.format).toBe('doubles');
  });
});

describe('o resto', () => {
  it('fotos publicáveis: da própria pasta e com descrição', () => {
    expect(publishablePhotos(EV).map((p) => p.path)).toEqual(['carreira/ana111/a.jpg']);
  });

  it('menor ou nascimento desconhecido não publica', () => {
    expect(canPublishShowcase({ birth_date: '1990-01-01' }, '2026-11-04')).toBe(true);
    expect(canPublishShowcase({ birth_date: '2010-01-01' }, '2026-11-04')).toBe(false);
    expect(canPublishShowcase({}, '2026-11-04')).toBe(false);
  });

  it('ordem, pódio e o contextId do parabéns (um por participação no pódio)', () => {
    expect(sortShowcase([{ start_date: '2025-01-01' }, { start_date: '2026-01-01' }])[0].start_date).toBe('2026-01-01');
    const item = showcaseItem(EV, { seal: 'declared' });
    expect(showcasePodium(item.entries[0])).toBe(1);
    expect(showcasePodium(item.entries[1])).toBeNull();
    expect(showcaseTrophyContextId(item, 0)).toBe('trofeu:ext:ana111_ev1:0:1');
    expect(showcaseTrophyContextId(item, 1)).toBe('');
  });

  it('⭐ parcerias: só as duplas com nome publicado, por torneio, quem mais jogou primeiro; lista que falhou não vira vazio', () => {
    const a = { event_id: 'e1', entries: [{ partner: { uid: 'b', name: 'Bia' } }, { partner: { uid: 'b', name: 'Bia' } }] };
    const b = { event_id: 'e2', entries: [{ partner: { uid: 'b', name: 'Bia' } }, { with_partner: true }] };
    const d = { event_id: 'e3', entries: [{ partner: { uid: 'c', name: 'Cau' } }] };
    expect(showcasePartnerships([a, b, d])).toEqual([
      { uid: 'b', name: 'Bia', photo_url: null, together: 2 },
      { uid: 'c', name: 'Cau', photo_url: null, together: 1 },
    ]);
    expect(showcasePartnerships(undefined)).toBeUndefined();
    expect(showcasePartnerships([])).toEqual([]);
  });
});
