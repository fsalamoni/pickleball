import { describe, it, expect } from 'vitest';
import {
  ART_LAYOUT, ARENA_TEMPLATES_MAX, BANNER_TEMPLATES, BANNER_TEXT_LIMITS, BANNER_UPLOAD_SPEC,
  arenaTemplatesFrom, bannerUploadGuide, checkBannerImage, contrastRatio, designFromTemplate,
  isAllowedImageUrl, isArenaTemplateId, normalizeBannerDesign, platformTemplate, removeArenaTemplate,
  saveArenaTemplate, switchTemplate, withArenaColors,
} from './bannerArt.js';

const URL_OK = 'https://firebasestorage.googleapis.com/v0/b/x/o/uploads%2Fu%2Farena-banners%2Fa.jpg?alt=media';

describe('os cinco modelos da plataforma', () => {
  it('são cinco, um por layout, todos com título e contraste legível', () => {
    expect(BANNER_TEMPLATES).toHaveLength(5);
    expect(new Set(BANNER_TEMPLATES.map((t) => t.design.layout)).size).toBe(5);
    BANNER_TEMPLATES.forEach((t) => {
      const n = normalizeBannerDesign(t.design);
      expect(n.valid, t.id).toBe(true);
      expect(n.warnings, t.id).toEqual([]);
      expect(contrastRatio(t.design.fg, t.design.bg), t.id).toBeGreaterThanOrEqual(4.5);
    });
  });
  it('são imutáveis — ninguém edita o padrão da plataforma por acidente', () => {
    expect(Object.isFrozen(BANNER_TEMPLATES)).toBe(true);
    expect(Object.isFrozen(BANNER_TEMPLATES[0].design)).toBe(true);
    expect(platformTemplate('oferta').name).toBe('Oferta');
    expect(platformTemplate('nao-existe')).toBe(null);
  });
});

describe('o desenho', () => {
  it('corta os textos no limite e tira espaços sobrando', () => {
    const d = normalizeBannerDesign({ title: `  ${'x'.repeat(80)}  `, kicker: 'a   b' }).value;
    expect(d.title).toHaveLength(BANNER_TEXT_LIMITS.title);
    expect(d.kicker).toBe('a b');
  });
  it('sem título é erro', () => {
    expect(normalizeBannerDesign({ title: '  ' }).errors.title).toBeTruthy();
  });
  it('layout desconhecido vira Destaque; cor inválida volta à do modelo', () => {
    const d = normalizeBannerDesign({ title: 'Oi', layout: 'hack', bg: 'azul' }).value;
    expect(d.layout).toBe(ART_LAYOUT.DESTAQUE);
    expect(d.bg).toBe(BANNER_TEMPLATES[0].design.bg);
  });
  it('sem cor de texto, ela sai do contraste com o fundo', () => {
    expect(normalizeBannerDesign({ title: 'Oi', bg: '#ffff00', fg: '' }).value.fg).toBe('#0b0b0c');
    expect(normalizeBannerDesign({ title: 'Oi', bg: '#000080', fg: '' }).value.fg).toBe('#ffffff');
  });
  it('⭐ pouco contraste é AVISO (a arena decide), não erro', () => {
    const n = normalizeBannerDesign({ title: 'Oi', bg: '#ffffff', fg: '#eeeeee' });
    expect(n.valid).toBe(true);
    expect(n.warnings.join(' ')).toMatch(/contraste/);
  });
  it('⭐ imagem de fora do armazenamento da plataforma é descartada, com aviso', () => {
    const n = normalizeBannerDesign({ title: 'Oi', image_url: 'https://site-qualquer.com/x.png' });
    expect(n.value.image_url).toBe('');
    expect(n.warnings.join(' ')).toMatch(/enviada pela plataforma/);
    expect(normalizeBannerDesign({ title: 'Oi', image_url: URL_OK }).value.image_url).toBe(URL_OK);
  });
  it('Oferta e Evento pedem o destaque', () => {
    expect(normalizeBannerDesign({ title: 'Oi', layout: 'oferta' }).warnings.join(' ')).toMatch(/20% OFF/);
    expect(normalizeBannerDesign({ title: 'Oi', layout: 'evento' }).warnings.join(' ')).toMatch(/data/);
  });
  it('um desenho a partir de um modelo, com o que a pessoa mudou por cima', () => {
    const d = designFromTemplate(platformTemplate('evento'), { title: 'Copa da Casa' });
    expect(d.layout).toBe('evento');
    expect(d.title).toBe('Copa da Casa');
    expect(d.highlight).toBe('18 OUT');
  });
  it('as cores da marca da arena, com o texto pelo contraste', () => {
    const d = withArenaColors(designFromTemplate(platformTemplate('destaque')), '#fde047');
    expect(d.bg).toBe('#fde047');
    expect(d.fg).toBe('#0b0b0c');
    expect(withArenaColors(designFromTemplate(platformTemplate('destaque')), 'nada').bg).toBe('#0b0b0c');
  });
});

describe('a imagem enviada', () => {
  it('só aceita o armazenamento da plataforma', () => {
    expect(isAllowedImageUrl(URL_OK)).toBe(true);
    expect(isAllowedImageUrl('https://evil.com/x.png')).toBe(false);
    expect(isAllowedImageUrl('javascript:alert(1)')).toBe(false);
    expect(isAllowedImageUrl('')).toBe(false);
  });
  it('⭐ a instrução diz tamanho, proporção, mínimo, formatos, peso e área segura', () => {
    const guia = bannerUploadGuide().map((l) => `${l.label}: ${l.value}`).join('\n');
    expect(guia).toMatch(/1600 × 800 px/);
    expect(guia).toMatch(/2:1/);
    expect(guia).toMatch(/1200 × 600 px/);
    expect(guia).toMatch(/JPG, PNG, WebP/);
    expect(guia).toMatch(/2 MB/);
    expect(guia).toMatch(/Área segura/);
  });
  it('imagem no tamanho certo passa limpa', () => {
    expect(checkBannerImage({ width: 1600, height: 800, bytes: 800_000, type: 'image/jpeg' }))
      .toEqual({ ok: true, errors: [], warnings: [] });
  });
  it('pequena demais é erro, dizendo o tamanho que ela tem', () => {
    const r = checkBannerImage({ width: 800, height: 400, bytes: 100_000, type: 'image/png' });
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatch(/800 × 400 px/);
  });
  it('proporção errada é aviso (vai cortar), não erro', () => {
    const r = checkBannerImage({ width: 1600, height: 1600, bytes: 100_000, type: 'image/png' });
    expect(r.ok).toBe(true);
    expect(r.warnings[0]).toMatch(/cortada/);
  });
  it('pesada é aviso; pesada demais e formato errado são erro', () => {
    expect(checkBannerImage({ width: 1600, height: 800, bytes: 3 * 1024 * 1024, type: 'image/jpeg' }).warnings).toHaveLength(1);
    expect(checkBannerImage({ width: 1600, height: 800, bytes: 6 * 1024 * 1024, type: 'image/jpeg' }).ok).toBe(false);
    expect(checkBannerImage({ width: 1600, height: 800, bytes: 1, type: 'image/gif' }).ok).toBe(false);
  });
  it('a especificação é imutável', () => {
    expect(Object.isFrozen(BANNER_UPLOAD_SPEC)).toBe(true);
  });
});

describe('⭐ os modelos da arena', () => {
  const design = designFromTemplate(platformTemplate('destaque'), { title: 'Terça do Americano' });
  const novoId = (() => { let n = 0; return () => `t${++n}`; })();

  it('salvar a partir de um modelo da plataforma cria um modelo NOVO da arena', () => {
    const r = saveArenaTemplate([], { id: 'destaque', name: 'Minha terça', design }, { now: 10, newId: novoId });
    expect(r.error).toBe(null);
    expect(r.saved.id).toMatch(/^arena:/);
    expect(r.list).toHaveLength(1);
    expect(platformTemplate('destaque').design.title).toBe('Quadra livre à noite');
  });
  it('salvar um modelo da arena atualiza no lugar', () => {
    const { list } = saveArenaTemplate([], { name: 'A', design }, { now: 10, newId: () => 'x' });
    const r = saveArenaTemplate(list, { id: 'arena:x', name: 'A2', design: { ...design, title: 'Novo' } }, { now: 20 });
    expect(r.list).toHaveLength(1);
    expect(r.saved.name).toBe('A2');
    expect(r.saved.design.title).toBe('Novo');
    expect(r.saved.created_at_ms).toBe(10);
  });
  it('sem nome ou sem título não salva', () => {
    expect(saveArenaTemplate([], { name: '', design }).error).toMatch(/nome/);
    expect(saveArenaTemplate([], { name: 'A', design: { title: '' } }).error).toMatch(/título/);
  });
  it('tem limite de modelos', () => {
    const cheia = Array.from({ length: ARENA_TEMPLATES_MAX }, (_, i) => ({ id: `arena:${i}`, name: `M${i}`, design }));
    expect(saveArenaTemplate(cheia, { name: 'Mais um', design }).error).toMatch(/Cabem/);
  });
  it('⭐ os modelos da plataforma não se apagam', () => {
    const lista = [{ id: 'arena:a', name: 'A', design }];
    expect(removeArenaTemplate(lista, 'destaque')).toBe(lista);
    expect(removeArenaTemplate(lista, 'arena:a')).toEqual([]);
    expect(isArenaTemplateId('oferta')).toBe(false);
  });
  it('lidos do banco: só os válidos, do mais recente ao mais antigo', () => {
    const lidos = arenaTemplatesFrom({ banner_templates: [
      { id: 'arena:a', name: 'A', design, updated_at_ms: 1 },
      { id: 'oferta', name: 'intruso', design },
      { id: 'arena:b', name: 'B', design, updated_at_ms: 5 },
      { id: 'arena:c', name: 'C' },
    ] });
    expect(lidos.map((t) => t.id)).toEqual(['arena:b', 'arena:a']);
    expect(arenaTemplatesFrom(null)).toEqual([]);
  });
});

describe('⭐ trocar de modelo mantém o que a pessoa escreveu', () => {
  const destaque = platformTemplate('destaque').design;
  const oferta = platformTemplate('oferta').design;
  it('texto de exemplo vira o exemplo do modelo novo; texto escrito fica', () => {
    const atual = { ...destaque, title: 'Terça do Americano' };
    const novo = switchTemplate(atual, destaque, oferta);
    expect(novo.layout).toBe('oferta');
    expect(novo.bg).toBe(oferta.bg);
    expect(novo.title).toBe('Terça do Americano');
    expect(novo.subtitle).toBe(oferta.subtitle);
    expect(novo.highlight).toBe('20% OFF');
  });
  it('a foto enviada fica', () => {
    const URL = 'https://firebasestorage.googleapis.com/v0/b/x/o/f.jpg';
    expect(switchTemplate({ ...destaque, image_url: URL }, destaque, oferta).image_url).toBe(URL);
  });
  it('sem modelo de origem, tudo o que tem texto é da pessoa', () => {
    expect(switchTemplate({ title: 'Meu' }, null, oferta).title).toBe('Meu');
  });
});

describe('⭐ o botão do modelo é só exemplo — quem decide é o destino', () => {
  const destaque = platformTemplate('destaque').design;
  const oferta = platformTemplate('oferta').design;
  it('começar por um modelo deixa o botão em branco (vale o do destino)', () => {
    expect(destaque.cta).toBeTruthy();
    expect(designFromTemplate(platformTemplate('destaque')).cta).toBe('');
    expect(designFromTemplate(platformTemplate('destaque'), { cta: 'Garanta já' }).cta).toBe('Garanta já');
  });
  it('trocar de modelo não traz o botão de exemplo do modelo novo', () => {
    expect(switchTemplate(designFromTemplate(platformTemplate('destaque')), destaque, oferta).cta).toBe('');
  });
  it('o botão que a pessoa escreveu fica', () => {
    const atual = { ...designFromTemplate(platformTemplate('destaque')), cta: 'Garanta já' };
    expect(switchTemplate(atual, destaque, oferta).cta).toBe('Garanta já');
  });
});
