/**
 * Os cabeçalhos de segurança do site (`firebase.json`).
 *
 * O vídeo da ficha de treino toca por fachada (nada carrega antes do clique)
 * e, depois do clique, num `<iframe>` do YouTube sem cookies ou do Vimeo. Para
 * isso a política abre EXATAMENTE esses domínios — e só para o que o player
 * usa. Este guarda trava o tamanho da abertura:
 *
 *  1. ninguém afrouxa com `*` (nem `https:`) em `frame-src`/`img-src`, nem no
 *     `Permissions-Policy`;
 *  2. os domínios de vídeo entram só onde precisam (quadro e miniatura), e
 *     só os de vídeo entram no `Permissions-Policy`;
 *  3. o que já era fechado continua fechado (câmera só do próprio site,
 *     microfone e pagamento desligados, `object-src 'none'`,
 *     `frame-ancestors 'none'`).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const firebase = JSON.parse(readFileSync('firebase.json', 'utf8'));
const sites = Array.isArray(firebase.hosting) ? firebase.hosting : [firebase.hosting];
const site = sites.find((s) => s.site === 'picklerush') || sites[0];
const cabecalhos = Object.fromEntries(
  (site.headers || []).flatMap((h) => h.headers || []).map((h) => [h.key, h.value]),
);

const CSP = cabecalhos['Content-Security-Policy'] || cabecalhos['Content-Security-Policy-Report-Only'];
const diretiva = (nome) => {
  const parte = CSP.split(';').map((p) => p.trim()).find((p) => p.startsWith(`${nome} `));
  return parte ? parte.split(/\s+/).slice(1) : [];
};
const PP = Object.fromEntries(
  cabecalhos['Permissions-Policy'].split(',').map((p) => p.trim()).map((p) => {
    const [nome, valor] = p.split('=');
    return [nome, (valor.match(/^\((.*)\)$/)?.[1] || '').split(/\s+/).filter(Boolean).map((o) => o.replace(/"/g, ''))];
  }),
);

const VIDEO_QUADRO = ['https://www.youtube-nocookie.com', 'https://player.vimeo.com'];
const VIDEO_MINIATURA = ['https://i.ytimg.com', 'https://i.vimeocdn.com'];

describe('cabeçalhos de segurança — o vídeo da ficha de treino', () => {
  it('a CSP existe e libera o quadro e a miniatura dos players', () => {
    expect(CSP).toBeTruthy();
    VIDEO_QUADRO.forEach((d) => expect(diretiva('frame-src')).toContain(d));
    VIDEO_MINIATURA.forEach((d) => expect(diretiva('img-src')).toContain(d));
  });

  it('⭐ nada de curinga aberto em frame-src e img-src', () => {
    ['frame-src', 'img-src'].forEach((nome) => {
      diretiva(nome).forEach((origem) => {
        expect(origem, `${nome}: ${origem}`).not.toBe('*');
        expect(origem, `${nome}: ${origem}`).not.toBe('https:');
        expect(origem, `${nome}: ${origem}`).not.toBe('http:');
      });
    });
  });

  it('os domínios de vídeo não entram em script nem em conexão', () => {
    [...VIDEO_QUADRO, ...VIDEO_MINIATURA].forEach((d) => {
      expect(diretiva('script-src')).not.toContain(d);
      expect(diretiva('connect-src')).not.toContain(d);
    });
  });

  it('⭐ Permissions-Policy: só o próprio site e os players, e só no que o player usa', () => {
    ['autoplay', 'encrypted-media', 'fullscreen', 'picture-in-picture'].forEach((recurso) => {
      const permitidos = PP[recurso] || [];
      VIDEO_QUADRO.forEach((d) => expect(permitidos, recurso).toContain(d));
      permitidos.forEach((o) => expect(['self', ...VIDEO_QUADRO], `${recurso}: ${o}`).toContain(o));
    });
    Object.entries(PP).forEach(([recurso, permitidos]) => {
      expect(permitidos, recurso).not.toContain('*');
      if (!['autoplay', 'encrypted-media', 'fullscreen', 'picture-in-picture'].includes(recurso)) {
        VIDEO_QUADRO.forEach((d) => expect(permitidos, recurso).not.toContain(d));
      }
    });
  });

  it('o que era fechado continua fechado', () => {
    expect(PP.camera).toEqual(['self']);
    expect(PP.microphone).toEqual([]);
    expect(PP.payment).toEqual([]);
    expect(PP.geolocation).toEqual(['self']);
    expect(diretiva('object-src')).toEqual(["'none'"]);
    expect(diretiva('frame-ancestors')).toEqual(["'none'"]);
    expect(diretiva('default-src')).toEqual(["'self'"]);
  });
});
