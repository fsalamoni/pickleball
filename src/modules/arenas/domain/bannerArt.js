/**
 * A ARTE dos banners (Onda CC) — os modelos, o que se edita neles e o que se
 * exige de uma imagem enviada.
 *
 * Um banner criado na plataforma NÃO é uma imagem: é um desenho (`design`) —
 * modelo + textos + cores (+ uma foto opcional) — que a tela monta na hora.
 * Três razões:
 *  - texto de verdade é nítido em qualquer tela e o leitor de tela o lê;
 *  - o mesmo banner se ajusta ao celular e ao computador (imagem com texto
 *    "desenhado" vira letra miúda no celular);
 *  - não há arquivo para subir, gerar nem guardar.
 *
 * Quem prefere a própria arte ENVIA a imagem, e aí vale `BANNER_UPLOAD_SPEC`:
 * o tamanho, a proporção, os formatos e a área segura estão escritos na tela
 * ANTES do envio, e a imagem é conferida depois.
 *
 * Modelos: CINCO da plataforma (código — ninguém os apaga nem altera) e os da
 * ARENA (`arena_settings.banner_templates`, que só a arena lê e escreve).
 * Editar um modelo da plataforma e salvar cria um modelo da arena; o original
 * fica como estava.
 *
 * PURO. Sem React, sem Firebase.
 */
import { luminance, normalizeHex, readableInk } from './whiteLabel.js';

/* ------------------------------------------------------------------ */
/*  Os layouts                                                        */
/* ------------------------------------------------------------------ */

export const ART_LAYOUT = Object.freeze({
  DESTAQUE: 'destaque',
  OFERTA: 'oferta',
  EVENTO: 'evento',
  VITRINE: 'vitrine',
  CHAMADO: 'chamado',
});

/** Até quantos caracteres cada texto vai — além disso o banner quebra feio. */
export const BANNER_TEXT_LIMITS = Object.freeze({
  kicker: 32,
  title: 48,
  subtitle: 110,
  highlight: 14,
  cta: 24,
});

/**
 * Os cinco modelos da plataforma. Cada um resolve um tipo de campanha, e o
 * texto de exemplo já ensina o que escrever ali.
 */
export const BANNER_TEMPLATES = Object.freeze([
  Object.freeze({
    id: 'destaque',
    name: 'Destaque',
    description: 'Título forte e um botão. Serve para quase tudo.',
    design: Object.freeze({
      layout: ART_LAYOUT.DESTAQUE,
      kicker: 'Nesta semana',
      title: 'Quadra livre à noite',
      subtitle: 'Horários das 19h às 22h com vaga. Reserve pelo aplicativo em dois toques.',
      highlight: '',
      cta: 'Reservar agora',
      bg: '#0b0b0c',
      fg: '#ffffff',
      accent: '#d4f631',
      image_url: '',
    }),
  }),
  Object.freeze({
    id: 'oferta',
    name: 'Oferta',
    description: 'Um número grande: desconto, preço ou brinde.',
    design: Object.freeze({
      layout: ART_LAYOUT.OFERTA,
      kicker: 'Só até domingo',
      title: 'Na reserva de terça e quinta',
      subtitle: 'Vale para qualquer quadra, das 7h às 17h.',
      highlight: '20% OFF',
      cta: 'Quero o desconto',
      bg: '#d4f631',
      fg: '#0b0b0c',
      accent: '#0b0b0c',
      image_url: '',
    }),
  }),
  Object.freeze({
    id: 'evento',
    name: 'Evento',
    description: 'Data em destaque: torneio, jogo aberto, clínica.',
    design: Object.freeze({
      layout: ART_LAYOUT.EVENTO,
      kicker: 'Sábado · 14h',
      title: 'Americano da casa',
      subtitle: 'Todos os níveis. Inscrição pelo aplicativo — as vagas são limitadas.',
      highlight: '18 OUT',
      cta: 'Garantir a vaga',
      bg: '#1d3a8a',
      fg: '#ffffff',
      accent: '#fbbf24',
      image_url: '',
    }),
  }),
  Object.freeze({
    id: 'vitrine',
    name: 'Vitrine',
    description: 'Texto e uma foto: produto, estrutura, novidade.',
    design: Object.freeze({
      layout: ART_LAYOUT.VITRINE,
      kicker: 'Chegou na loja',
      title: 'Raquetes para testar',
      subtitle: 'Experimente antes de comprar. Peça no balcão ou pelo aplicativo.',
      highlight: '',
      cta: 'Ver na loja',
      bg: '#f4f1ea',
      fg: '#0b0b0c',
      accent: '#0f766e',
      image_url: '',
    }),
  }),
  Object.freeze({
    id: 'chamado',
    name: 'Chamado',
    description: 'Mensagem curta e central, para convidar a comunidade.',
    design: Object.freeze({
      layout: ART_LAYOUT.CHAMADO,
      kicker: 'Seja membro',
      title: 'Jogue mais pagando menos',
      subtitle: 'Planos com horas de quadra, desconto e prioridade na reserva.',
      highlight: '',
      cta: 'Conhecer os planos',
      bg: '#5b21b6',
      fg: '#ffffff',
      accent: '#f0abfc',
      image_url: '',
    }),
  }),
]);

/** O modelo da plataforma pelo id (`null` se não for um deles). */
export function platformTemplate(id) {
  return BANNER_TEMPLATES.find((t) => t.id === id) || null;
}

/* ------------------------------------------------------------------ */
/*  Cores e contraste                                                 */
/* ------------------------------------------------------------------ */

/**
 * O contraste entre duas cores (1 a 21), pela fórmula da WCAG.
 * @returns {number}
 */
export function contrastRatio(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  const [claro, escuro] = la > lb ? [la, lb] : [lb, la];
  return (claro + 0.05) / (escuro + 0.05);
}

/** Texto legível pede 4,5:1 (WCAG AA). */
export const MIN_TEXT_CONTRAST = 4.5;

/* ------------------------------------------------------------------ */
/*  A imagem                                                          */
/* ------------------------------------------------------------------ */

/**
 * O endereço de imagem aceito num banner: só o armazenamento da plataforma.
 * Endereço de fora faria a página da arena carregar o que ninguém conferiu
 * (e contar quem abriu).
 */
export function isAllowedImageUrl(url) {
  const u = String(url || '').trim();
  if (!u) return false;
  return /^https:\/\/(firebasestorage\.googleapis\.com|storage\.googleapis\.com)\//i.test(u)
    || /^http:\/\/(127\.0\.0\.1|localhost):\d+\//i.test(u);
}

/**
 * O que se exige de um banner ENVIADO — escrito na tela antes do envio.
 *
 * 2:1 porque é o formato em que o banner aparece no computador; no celular
 * ele é mostrado em 16:9, cortando um pouco das laterais — daí a área segura.
 */
export const BANNER_UPLOAD_SPEC = Object.freeze({
  ratio: 2,
  ratioLabel: '2:1',
  recommended: Object.freeze({ width: 1600, height: 800 }),
  minimum: Object.freeze({ width: 1200, height: 600 }),
  formats: Object.freeze(['JPG', 'PNG', 'WebP']),
  mimeTypes: Object.freeze(['image/jpeg', 'image/png', 'image/webp']),
  idealBytes: 2 * 1024 * 1024,
  maxBytes: 5 * 1024 * 1024,
  safeArea: Object.freeze({ width: 0.8, height: 0.7 }),
  /** Quanto a proporção pode fugir de 2:1 antes de o corte ficar visível. */
  ratioTolerance: 0.08,
});

/** As instruções do envio, na ordem em que a pessoa precisa delas. */
export function bannerUploadGuide(spec = BANNER_UPLOAD_SPEC) {
  const mb = (b) => `${Math.round(b / (1024 * 1024))} MB`;
  return [
    { label: 'Tamanho ideal', value: `${spec.recommended.width} × ${spec.recommended.height} px` },
    { label: 'Proporção', value: `${spec.ratioLabel} (a largura é o dobro da altura)` },
    { label: 'Mínimo', value: `${spec.minimum.width} × ${spec.minimum.height} px — menor que isso fica borrado` },
    { label: 'Formatos', value: spec.formats.join(', ') },
    { label: 'Peso', value: `até ${mb(spec.idealBytes)} (máximo ${mb(spec.maxBytes)}) — pesado demora a abrir no 4G` },
    {
      label: 'Área segura',
      value: `texto e logo dentro dos ${Math.round(spec.safeArea.width * 100)}% centrais da largura e ${Math.round(spec.safeArea.height * 100)}% da altura — no celular as laterais são cortadas`,
    },
    { label: 'Botão', value: 'não desenhe botão: o banner inteiro já é clicável e leva ao destino escolhido' },
    { label: 'Texto', value: 'pouco e grande; o que estiver escrito na imagem precisa ir também na descrição (para quem usa leitor de tela)' },
  ];
}

/**
 * Confere uma imagem escolhida contra a especificação.
 *
 * @param {{ width?: number, height?: number, bytes?: number, type?: string }} img
 * @returns {{ ok: boolean, errors: string[], warnings: string[] }}
 */
export function checkBannerImage({ width, height, bytes, type } = {}, spec = BANNER_UPLOAD_SPEC) {
  const errors = [];
  const warnings = [];
  const mb = (b) => (b / (1024 * 1024)).toFixed(1).replace('.', ',');

  if (type && !spec.mimeTypes.includes(String(type).toLowerCase())) {
    errors.push(`Formato não aceito. Use ${spec.formats.join(', ')}.`);
  }
  const b = Number(bytes) || 0;
  if (b > spec.maxBytes) errors.push(`A imagem tem ${mb(b)} MB; o máximo é ${mb(spec.maxBytes)} MB.`);
  else if (b > spec.idealBytes) warnings.push(`A imagem tem ${mb(b)} MB. Até ${mb(spec.idealBytes)} MB ela abre mais rápido.`);

  const w = Number(width) || 0;
  const h = Number(height) || 0;
  if (w > 0 && h > 0) {
    if (w < spec.minimum.width || h < spec.minimum.height) {
      errors.push(`A imagem tem ${w} × ${h} px; o mínimo é ${spec.minimum.width} × ${spec.minimum.height} px.`);
    }
    const proporcao = w / h;
    if (Math.abs(proporcao - spec.ratio) / spec.ratio > spec.ratioTolerance) {
      const txt = proporcao.toFixed(2).replace('.', ',');
      warnings.push(`A proporção é ${txt}:1; ${spec.noun || 'o banner'} é ${spec.ratioLabel}. Parte da imagem vai ser cortada.`);
    }
  }
  return { ok: errors.length === 0, errors, warnings };
}

/* ------------------------------------------------------------------ */
/*  O desenho                                                         */
/* ------------------------------------------------------------------ */

function texto(v, max) {
  return String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

/**
 * O desenho normalizado.
 *
 * - layout desconhecido vira Destaque;
 * - cor inválida volta à do modelo; sem cor de texto, ela é escolhida pelo
 *   contraste com o fundo;
 * - contraste abaixo de 4,5:1 é AVISO (a arena decide), não erro;
 * - imagem de fora do armazenamento da plataforma é descartada.
 *
 * @returns {{ valid: boolean, errors: object, warnings: string[], value: object }}
 */
export function normalizeBannerDesign(input = {}) {
  const errors = {};
  const warnings = [];
  const layouts = Object.values(ART_LAYOUT);
  const layout = layouts.includes(input.layout) ? input.layout : ART_LAYOUT.DESTAQUE;
  const base = (BANNER_TEMPLATES.find((t) => t.design.layout === layout) || BANNER_TEMPLATES[0]).design;

  const bg = normalizeHex(input.bg) || base.bg;
  const fg = normalizeHex(input.fg) || normalizeHex(readableInk(bg));
  const accent = normalizeHex(input.accent) || base.accent;

  const value = {
    layout,
    kicker: texto(input.kicker, BANNER_TEXT_LIMITS.kicker),
    title: texto(input.title, BANNER_TEXT_LIMITS.title),
    subtitle: texto(input.subtitle, BANNER_TEXT_LIMITS.subtitle),
    highlight: texto(input.highlight, BANNER_TEXT_LIMITS.highlight),
    cta: texto(input.cta, BANNER_TEXT_LIMITS.cta),
    bg,
    fg,
    accent,
    image_url: isAllowedImageUrl(input.image_url) ? String(input.image_url).trim().slice(0, 1000) : '',
    image_path: isAllowedImageUrl(input.image_url) ? String(input.image_path || '').slice(0, 300) : '',
  };

  if (!value.title) errors.title = 'O banner precisa de um título.';
  if (input.image_url && !value.image_url) {
    warnings.push('A imagem precisa ser enviada pela plataforma — o endereço colado foi ignorado.');
  }
  if (contrastRatio(value.fg, value.bg) < MIN_TEXT_CONTRAST) {
    warnings.push('O texto tem pouco contraste com o fundo e vai ficar difícil de ler. Troque uma das cores.');
  }
  if (layout === ART_LAYOUT.OFERTA && !value.highlight) {
    warnings.push('O modelo Oferta pede o número em destaque (ex.: "20% OFF").');
  }
  if (layout === ART_LAYOUT.EVENTO && !value.highlight) {
    warnings.push('O modelo Evento pede a data em destaque (ex.: "18 OUT").');
  }
  return { valid: Object.keys(errors).length === 0, errors, warnings, value };
}

/** Um desenho a partir de um modelo, com o que a pessoa já mudou por cima. */
export function designFromTemplate(template, overrides = {}) {
  const base = template?.design || BANNER_TEMPLATES[0].design;
  // O botão do modelo é só EXEMPLO: numa campanha, o texto do botão vem do
  // destino escolhido ("Inscrever-se" num torneio), a não ser que a arena
  // escreva outro. Herdar "Reservar agora" de um modelo e levar a pessoa a um
  // torneio seria o banner prometendo uma coisa e entregando outra.
  return normalizeBannerDesign({ ...base, cta: '', ...overrides }).value;
}

/**
 * As cores da marca da arena aplicadas ao modelo — o ponto de partida mais
 * provável, e o que faz o banner parecer DA arena, não da plataforma.
 */
export function withArenaColors(design, brandColor) {
  const cor = normalizeHex(brandColor);
  if (!cor) return design;
  return normalizeBannerDesign({ ...design, bg: cor, fg: readableInk(cor) }).value;
}

/* ------------------------------------------------------------------ */
/*  Os modelos da ARENA                                               */
/* ------------------------------------------------------------------ */

/** Quantos modelos próprios uma arena guarda. */
export const ARENA_TEMPLATES_MAX = 20;

/** O id de um modelo da arena, distinto dos da plataforma. */
export function isArenaTemplateId(id) {
  return typeof id === 'string' && id.startsWith('arena:');
}

/**
 * Salva (ou atualiza) um modelo da arena. Nunca toca nos da plataforma: salvar
 * a partir de um deles cria um modelo NOVO da arena.
 *
 * @param {Array<object>} lista os modelos atuais da arena
 * @param {{ id?: string, name: string, design: object }} modelo
 * @param {{ now?: number, newId?: () => string }} [ctx]
 * @returns {{ list: Array<object>, saved: object|null, error: string|null }}
 */
export function saveArenaTemplate(lista = [], modelo = {}, {
  now = Date.now(), newId, normalize = normalizeBannerDesign,
} = {}) {
  const nome = texto(modelo.name, 40);
  if (!nome) return { list: lista, saved: null, error: 'Dê um nome ao modelo.' };
  // `normalize` troca o desenho conferido: o do banner por padrão; o cupom
  // (Onda CD) passa o dele, e a regra de nome, limite e ids é a mesma.
  const { value: design, valid } = normalize(modelo.design || {});
  if (!valid) return { list: lista, saved: null, error: 'O modelo precisa de um título.' };

  const atuais = (Array.isArray(lista) ? lista : []).filter((t) => isArenaTemplateId(t?.id));
  const existente = isArenaTemplateId(modelo.id) ? atuais.find((t) => t.id === modelo.id) : null;

  if (!existente && atuais.length >= ARENA_TEMPLATES_MAX) {
    return { list: lista, saved: null, error: `Cabem ${ARENA_TEMPLATES_MAX} modelos. Apague um para salvar outro.` };
  }
  const id = existente ? existente.id : `arena:${newId ? newId() : now.toString(36)}`;
  const salvo = { id, name: nome, design, updated_at_ms: now, created_at_ms: existente?.created_at_ms ?? now };
  const nova = existente
    ? atuais.map((t) => (t.id === id ? salvo : t))
    : [salvo, ...atuais];
  return { list: nova, saved: salvo, error: null };
}

/** Apaga um modelo da arena (os da plataforma não se apagam). */
export function removeArenaTemplate(lista = [], id) {
  if (!isArenaTemplateId(id)) return Array.isArray(lista) ? lista : [];
  return (Array.isArray(lista) ? lista : []).filter((t) => t?.id !== id);
}

/**
 * Os modelos da arena lidos do banco, só os válidos, do mais recente ao mais
 * antigo. `field`/`normalize` servem aos modelos de CUPOM (Onda CD), que moram
 * em outro campo de `arena_settings` e têm outro desenho.
 */
export function arenaTemplatesFrom(settings, { field = 'banner_templates', normalize = normalizeBannerDesign } = {}) {
  const lista = Array.isArray(settings?.[field]) ? settings[field] : [];
  return lista
    .filter((t) => isArenaTemplateId(t?.id) && t?.design)
    .map((t) => ({ ...t, design: normalize(t.design).value }))
    .sort((a, b) => (Number(b.updated_at_ms) || 0) - (Number(a.updated_at_ms) || 0));
}

/* ------------------------------------------------------------------ */
/*  Trocar de modelo sem perder o que foi escrito                     */
/* ------------------------------------------------------------------ */

const CAMPOS_DE_TEXTO = ['kicker', 'title', 'subtitle', 'highlight', 'cta'];

/**
 * Troca o modelo MANTENDO os textos que a pessoa escreveu.
 *
 * Texto igual ao exemplo do modelo anterior é exemplo — vira o exemplo do
 * novo. Texto diferente foi escrito pela pessoa, e trocar o visual não pode
 * apagá-lo (é o que faz alguém desistir de experimentar os modelos). O visual
 * (layout e cores) vem sempre do modelo novo; a foto fica, se houver.
 *
 * @param {object} atual o desenho de agora
 * @param {object|null} de o desenho do modelo de onde se partiu
 * @param {object} para o desenho do modelo escolhido
 */
export function switchTemplate(atual = {}, de = null, para = BANNER_TEMPLATES[0].design) {
  // O botão do modelo novo é só exemplo (ver `designFromTemplate`): fica o que
  // a arena escreveu, ou em branco — e aí vale o do destino.
  const saida = { ...para, cta: '' };
  CAMPOS_DE_TEXTO.forEach((campo) => {
    const escrito = String(atual?.[campo] || '').trim();
    const exemplo = String(de?.[campo] || '').trim();
    if (escrito && escrito !== exemplo) saida[campo] = escrito;
  });
  if (atual?.image_url) {
    saida.image_url = atual.image_url;
    saida.image_path = atual.image_path || '';
  }
  return normalizeBannerDesign(saida).value;
}
