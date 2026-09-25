/**
 * A arte do cupom (Onda CD).
 *
 * O que protege:
 *  1. ⭐ cinco modelos da plataforma, congelados, com título e texto EM BRANCO
 *     (vale o benefício e a descrição do próprio cupom — a arte não desmente o
 *     cupom);
 *  2. o desenho conferido: estilo conhecido, cor válida, texto no limite, e o
 *     aviso de contraste;
 *  3. ⭐ a imagem enviada exige URL da plataforma e descrição;
 *  4. ⭐ cupom sem arte é desenhado como Clássico (todo cupom anterior);
 *  5. trocar de modelo mantém o que a pessoa escreveu;
 *  6. ⭐ os modelos da arena: moram em `coupon_templates`, nunca tocam nos da
 *     plataforma, e não se misturam com os de banner.
 */
import { describe, it, expect } from 'vitest';
import {
  COUPON_ART_SOURCE, COUPON_ART_STYLE, COUPON_ART_TEMPLATES, COUPON_TEXT_LIMITS, COUPON_UPLOAD_SPEC,
  arenaCouponTemplatesFrom, couponArtOf, couponArtTexts, couponDesignFromTemplate, couponTemplate,
  couponUploadGuide, normalizeCouponArt, normalizeCouponArtDesign, removeArenaCouponTemplate,
  saveArenaCouponTemplate, stubInk, switchCouponTemplate, withArenaCouponColors,
} from './couponArt.js';
import { checkBannerImage } from './bannerArt.js';

const URL_OK = 'https://firebasestorage.googleapis.com/v0/b/x/o/cupom.jpg';

describe('⭐ os cinco modelos da plataforma', () => {
  it('são cinco, com estilos diferentes, congelados', () => {
    expect(COUPON_ART_TEMPLATES.map((t) => t.id)).toEqual(['classico', 'neon', 'quadra', 'festa', 'sol']);
    expect(new Set(COUPON_ART_TEMPLATES.map((t) => t.design.style)).size).toBe(5);
    expect(Object.isFrozen(COUPON_ART_TEMPLATES)).toBe(true);
    expect(Object.isFrozen(COUPON_ART_TEMPLATES[0].design)).toBe(true);
  });

  it('⭐ título e texto vêm em branco — valem os do cupom', () => {
    COUPON_ART_TEMPLATES.forEach((t) => {
      expect(t.design.title).toBe('');
      expect(t.design.subtitle).toBe('');
    });
  });

  it('todo modelo tem texto legível sobre o fundo', () => {
    COUPON_ART_TEMPLATES.forEach((t) => {
      expect(normalizeCouponArtDesign(t.design).warnings).toEqual([]);
    });
  });
});

describe('o desenho conferido', () => {
  it('estilo desconhecido vira o Clássico; cor inválida vira a do modelo', () => {
    const v = normalizeCouponArtDesign({ style: 'hackeado', bg: 'azul', accent: '#ABC' }).value;
    expect(v.style).toBe(COUPON_ART_STYLE.CLASSICO);
    expect(v.bg).toBe('#f4f1ea');
    expect(v.accent).toBe('#aabbcc');
  });

  it('corta os textos no limite e tira espaços repetidos', () => {
    const v = normalizeCouponArtDesign({ title: `  ${'a'.repeat(80)}  `, kicker: 'Só   hoje' }).value;
    expect(v.title).toHaveLength(COUPON_TEXT_LIMITS.title);
    expect(v.kicker).toBe('Só hoje');
  });

  it('sem cor de texto, escolhe por contraste', () => {
    expect(normalizeCouponArtDesign({ bg: '#0b0b0c' }).value.fg).toBe('#ffffff');
    expect(normalizeCouponArtDesign({ bg: '#fde047' }).value.fg).toBe('#0b0b0c');
  });

  it('avisa quando o texto some no fundo', () => {
    expect(normalizeCouponArtDesign({ bg: '#ffffff', fg: '#f4f1ea' }).warnings).toHaveLength(1);
  });

  it('o código no canhoto é escrito na cor que se lê', () => {
    expect(stubInk('#d4f631')).toBe('#0b0b0c');
    expect(stubInk('#0f766e')).toBe('#ffffff');
  });

  it('a cor da arena vira o fundo, com texto por contraste', () => {
    const d = withArenaCouponColors(couponDesignFromTemplate(couponTemplate('classico')), '#1d3a8a');
    expect(d.bg).toBe('#1d3a8a');
    expect(d.fg).toBe('#ffffff');
  });
});

describe('⭐ a arte inteira', () => {
  it('nula é nula (o cupom sem arte)', () => {
    expect(normalizeCouponArt(null)).toEqual({ valid: true, errors: {}, value: null });
  });

  it('desenho: guarda o modelo e o desenho conferido', () => {
    const r = normalizeCouponArt({ source: 'design', template_id: 'neon', design: { style: 'neon', title: 'Oi' } });
    expect(r.valid).toBe(true);
    expect(r.value.template_id).toBe('neon');
    expect(r.value.design.title).toBe('Oi');
  });

  it('modelo desconhecido não é gravado como id', () => {
    expect(normalizeCouponArt({ source: 'design', template_id: 'x', design: {} }).value.template_id).toBeNull();
    expect(normalizeCouponArt({ source: 'design', template_id: 'arena:m1', design: {} }).value.template_id).toBe('arena:m1');
  });

  it('⭐ imagem: só da plataforma, e com descrição', () => {
    expect(normalizeCouponArt({ source: 'upload', image_url: 'https://site.com/a.jpg', alt: 'x' }).errors.image_url).toBeTruthy();
    expect(normalizeCouponArt({ source: 'upload', image_url: URL_OK, alt: '' }).errors.alt).toBeTruthy();
    const ok = normalizeCouponArt({ source: 'upload', image_url: URL_OK, alt: '1 água de coco', width: 1200, height: 600 });
    expect(ok.valid).toBe(true);
    expect(ok.value).toMatchObject({ source: 'upload', width: 1200, height: 600, alt: '1 água de coco' });
  });

  it('origem desconhecida é recusada', () => {
    expect(normalizeCouponArt({ source: 'video' }).valid).toBe(false);
  });

  it('⭐ cupom sem arte é desenhado como Clássico', () => {
    const a = couponArtOf({ code: 'X' });
    expect(a.source).toBe(COUPON_ART_SOURCE.DESIGN);
    expect(a.design.style).toBe(COUPON_ART_STYLE.CLASSICO);
  });

  it('a arte do formulário vence a gravada (pré-visualização)', () => {
    const gravada = { source: 'design', design: { style: 'neon' } };
    const nova = { source: 'design', design: { style: 'festa' } };
    expect(couponArtOf({ art: gravada }, nova).design.style).toBe('festa');
    expect(couponArtOf({ art: gravada }).design.style).toBe('neon');
  });
});

describe('⭐ os textos do tíquete vêm do cupom quando em branco', () => {
  it('título = benefício; texto = descrição', () => {
    const t = couponArtTexts({ kicker: 'Cupom' }, { benefit: '10% de desconto', description: 'Na primeira reserva' });
    expect(t).toEqual({ kicker: 'Cupom', title: '10% de desconto', subtitle: 'Na primeira reserva' });
  });

  it('o que a arena escreveu vence', () => {
    expect(couponArtTexts({ title: 'Terça amiga' }, { benefit: '10% de desconto' }).title).toBe('Terça amiga');
  });
});

describe('trocar de modelo', () => {
  it('mantém o que a pessoa escreveu; exemplo vira o exemplo do novo', () => {
    const classico = couponTemplate('classico').design;
    const festa = couponTemplate('festa').design;
    const novo = switchCouponTemplate({ ...classico, title: 'Aniversariante' }, classico, festa);
    expect(novo.style).toBe('festa');
    expect(novo.title).toBe('Aniversariante');
    expect(novo.kicker).toBe(festa.kicker);
  });
});

describe('a imagem enviada', () => {
  it('a especificação fala do código — que NÃO vai na imagem', () => {
    const guia = couponUploadGuide();
    expect(guia.find((l) => l.label === 'Código').value).toMatch(/NÃO escreva o código/);
    expect(guia.find((l) => l.label === 'Tamanho ideal').value).toBe('1200 × 600 px');
  });

  it('a conferência usa a especificação do cupom', () => {
    expect(checkBannerImage({ width: 700, height: 350 }, COUPON_UPLOAD_SPEC).ok).toBe(false);
    expect(checkBannerImage({ width: 800, height: 400 }, COUPON_UPLOAD_SPEC).ok).toBe(true);
    expect(checkBannerImage({ width: 800, height: 800 }, COUPON_UPLOAD_SPEC).warnings[0]).toMatch(/a arte do cupom é 2:1/);
  });
});

describe('⭐ os modelos da arena', () => {
  const design = couponDesignFromTemplate(couponTemplate('neon'), { title: 'Terça amiga' });

  it('salvar a partir de um da plataforma cria um da arena', () => {
    const r = saveArenaCouponTemplate([], { id: 'neon', name: 'Terças', design }, { now: 1, newId: () => 'm1' });
    expect(r.error).toBeNull();
    expect(r.saved.id).toBe('arena:m1');
    expect(r.list).toHaveLength(1);
    expect(couponTemplate('neon').design.title).toBe('');
  });

  it('título em branco é permitido (vale o do cupom)', () => {
    const r = saveArenaCouponTemplate([], { name: 'Meu', design: couponTemplate('classico').design }, { now: 1, newId: () => 'm2' });
    expect(r.error).toBeNull();
  });

  it('apagar só apaga modelo da arena', () => {
    const lista = [{ id: 'arena:m1', name: 'A', design }];
    expect(removeArenaCouponTemplate(lista, 'classico')).toHaveLength(1);
    expect(removeArenaCouponTemplate(lista, 'arena:m1')).toHaveLength(0);
  });

  it('⭐ leem-se de `coupon_templates` — os de banner não se misturam', () => {
    const settings = {
      coupon_templates: [{ id: 'arena:c1', name: 'Cupom', design, updated_at_ms: 2 }],
      banner_templates: [{ id: 'arena:b1', name: 'Banner', design: { layout: 'destaque', title: 'x' } }],
    };
    expect(arenaCouponTemplatesFrom(settings).map((t) => t.id)).toEqual(['arena:c1']);
    expect(arenaCouponTemplatesFrom(null)).toEqual([]);
  });
});
