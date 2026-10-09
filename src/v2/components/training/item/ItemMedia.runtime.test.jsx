/**
 * A mídia enviada pode sumir (o autor apagou a mídia ou a conta, e a cópia de
 * outra pessoa guarda o link): a ficha diz que não carregou, nunca um player
 * preto mudo.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { MediaTile } from './ItemMedia';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let host;
let root;
afterEach(() => { act(() => root.unmount()); host.remove(); });

function montar(media) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(<MediaTile media={media} />));
}

describe('mídia que não carrega', () => {
  const url = 'https://firebasestorage.googleapis.com/v0/b/bkt/o/treino%2Fu1%2Fv.mp4?alt=media&token=t';

  it('vídeo enviado que falha vira o aviso', () => {
    montar({ type: 'video', source: 'upload', url });
    const video = host.querySelector('video');
    expect(video).not.toBeNull();
    act(() => { video.dispatchEvent(new Event('error')); });
    expect(host.querySelector('video')).toBeNull();
    expect(host.textContent).toContain('Não foi possível carregar o vídeo.');
  });

  it('imagem que falha vira o aviso', () => {
    montar({ type: 'image', source: 'upload', url: url.replace('v.mp4', 'a.webp') });
    act(() => { host.querySelector('img').dispatchEvent(new Event('error')); });
    expect(host.textContent).toContain('Não foi possível carregar a imagem.');
  });
});
