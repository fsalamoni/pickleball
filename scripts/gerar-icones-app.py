#!/usr/bin/env python3
"""
Gera os ícones do app instalado (PWA) a partir dos dois logos da marca.

    python3 scripts/gerar-icones-app.py      (precisa do Pillow)

- `public/logo-claro.png`  (metade ink)    → ícone CLARO: fundo branco.
- `public/logo-escuro.png` (metade branca) → ícone ESCURO: fundo ink.

Saída em `public/icones/`. O cache do Hosting e do service worker guarda
imagem por 1 ano pelo NOME: se o logo mudar, troque o sufixo `-v1` dos nomes
(aqui, nos dois manifestos, no index.html, em src/core/pwa/iconeDoApp.js e nos
avisos de push) e suba o VERSION do public/sw.js. Ver docs/04-ARCHITECTURE.md §7.
"""
import os
from PIL import Image

RAIZ = os.path.join(os.path.dirname(__file__), '..', 'public')
SAIDA = os.path.join(RAIZ, 'icones')
V = 'v1'
FUNDO = {'claro': (255, 255, 255, 255), 'escuro': (11, 15, 25, 255)}  # #FFFFFF, ink #0B0F19


def logo(variante):
    im = Image.open(os.path.join(RAIZ, f'logo-{variante}.png')).convert('RGBA')
    return im.crop(im.getbbox())


def raio_do_logo(im):
    """Maior distância do centro a um pixel visível, em fração do lado maior."""
    w, h = im.size
    a = im.getchannel('A').load()
    cx, cy, r2 = w / 2, h / 2, 0
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            if a[x, y] > 20:
                r2 = max(r2, (x - cx) ** 2 + (y - cy) ** 2)
    return (r2 ** 0.5) / max(w, h)


def compor(im, lado, raio, fundo=None):
    """Logo centralizado cabendo num círculo de `raio` (fração do lado)."""
    escala = raio / raio_do_logo(im)  # fração do lado ocupada pelo lado maior do logo
    w, h = im.size
    k = lado * escala / max(w, h)
    peca = im.resize((max(1, round(w * k)), max(1, round(h * k))), Image.LANCZOS)
    base = Image.new('RGBA', (lado, lado), fundo or (0, 0, 0, 0))
    base.alpha_composite(peca, ((lado - peca.width) // 2, (lado - peca.height) // 2))
    return base


def silhueta(im):
    """Branco com a transparência do logo (ícone monocromático / badge)."""
    branco = Image.new('RGBA', im.size, (255, 255, 255, 255))
    branco.putalpha(im.getchannel('A'))
    return branco


def salvar(im, nome):
    im.save(os.path.join(SAIDA, nome), optimize=True)


os.makedirs(SAIDA, exist_ok=True)
for variante in ('claro', 'escuro'):
    im, fundo = logo(variante), FUNDO[variante]
    # "any": quadrado cheio, margem para o arredondamento do iOS/desktop.
    for lado in (192, 512):
        salvar(compor(im, lado, 0.46, fundo), f'app-{variante}-{lado}-{V}.png')
    # "maskable": tudo dentro da zona segura (círculo de 40% do lado).
    for lado in (192, 512):
        salvar(compor(im, lado, 0.38, fundo), f'app-{variante}-maskable-{lado}-{V}.png')
    salvar(compor(im, 180, 0.46, fundo), f'apple-{variante}-180-{V}.png')
    # Aba do navegador: sem fundo, o logo inteiro.
    salvar(compor(im, 64, 0.5), f'favicon-{variante}-64-{V}.png')

mono = silhueta(logo('claro'))
salvar(compor(mono, 512, 0.34), f'app-monocromatico-512-{V}.png')  # ícones temáticos (Android 13+)
salvar(compor(mono, 96, 0.48), f'aviso-badge-96-{V}.png')  # selo da barra de notificações (Android)

# O iOS também pede /apple-touch-icon.png sozinho em alguns caminhos: o claro.
compor(logo('claro'), 180, 0.46, FUNDO['claro']).save(os.path.join(RAIZ, 'apple-touch-icon.png'), optimize=True)
print('ícones gerados em', os.path.relpath(SAIDA))
