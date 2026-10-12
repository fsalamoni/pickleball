/**
 * O cartão desenha o que o modelo diz: degrau, nomes, evento, QR — e a arte
 * é a mesma nos dois modos (`tema-claro` no elemento capturado).
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { buildMedalCard, CARD_MODE } from '@/modules/trophies/domain/medalCard.js';
import MedalCard from './MedalCard';

const places = [
  { position: 1, label: 'Campeões', entries: [{ label: 'Ana / Bia', people: [{ user_id: 'a', name: 'Ana', photo_url: 'https://x/a.jpg' }, { user_id: 'b', name: 'Bia', photo_url: null }] }] },
  { position: 2, label: 'Vice-campeões', entries: [{ label: 'Caio / Davi', people: [{ user_id: 'c', name: 'Caio' }, { user_id: 'd', name: 'Davi' }] }] },
];
const event = { title: 'Open de Verão', subtitle: 'Mista 3.5', date: '2026-10-11', city: 'Curitiba', state: 'PR', kind: 'torneio' };

let root; let el;
afterEach(() => { act(() => root?.unmount()); el?.remove(); });

function render(card) {
  el = document.createElement('div'); document.body.appendChild(el);
  root = createRoot(el);
  act(() => root.render(<MedalCard card={card} qrDataUrl="data:image/png;base64,AA==" />));
  return el;
}

describe('MedalCard', () => {
  it('o degrau: nomes, evento, data por extenso, quem sediou e o QR', () => {
    const card = buildMedalCard({ mode: CARD_MODE.PLACE, position: 1, places, event, host: { name: 'Sol', kind: 'arena' }, link: '/p/t1', origin: 'https://picklerush.web.app' });
    const out = render(card);
    const txt = out.textContent;
    expect(txt).toContain('Campeões');
    expect(txt).toContain('Ana');
    expect(txt).toContain('Bia');
    expect(txt).toContain('Open de Verão');
    expect(txt).toContain('11 de outubro de 2026');
    expect(txt).toContain('Arena Sol');
    expect(out.querySelector('img[alt="QR Code"]')).not.toBeNull();
    expect(out.querySelector('[data-testid="medal-card"]').className).toContain('tema-claro');
    // A foto entra com CORS, para a captura em PNG não falhar.
    expect(out.querySelector('img[crossorigin]')).not.toBeNull();
  });

  it('sem fotos, só os nomes (iniciais no anel)', () => {
    const card = buildMedalCard({ places, event, showPhotos: false });
    const out = render(card);
    expect(out.querySelector('img[crossorigin]')).toBeNull();
    expect(out.textContent).toContain('A');
  });

  it('o pódio inteiro lista os degraus na ordem', () => {
    const card = buildMedalCard({ mode: CARD_MODE.PODIUM, places, event });
    const out = render(card);
    expect(out.textContent).toMatch(/1º.*Ana.*Bia.*2º.*Caio.*Davi/s);
  });
});
