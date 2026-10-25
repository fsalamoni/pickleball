/**
 * Acervo oficial da federação — a conta PURA (sem banco): tipos, categorias,
 * arquivos aceitos, vídeo por link e a validação do rascunho.
 *
 * ⚠️ CÓPIA de `src/modules/federations/domain/acervo.js` (o pacote de
 * Functions é publicado isolado), com paridade em
 * `federationAcervo.parity.test.js`. Os ids são GRAVADOS: nunca renomeie.
 */
const TITLE_MAX = 200;
const SUMMARY_MAX = 600;
const BODY_MAX = 30000;
const TAGS_MAX = 10;
const RELATIONS_MAX = 10;
const FILES_MAX = 10;
const LINKS_MAX = 5;
const RESTRICTED_FILE_MAX = 9 * 1024 * 1024;
const REASON_MIN = 10;
const WITHDRAW_REASON_MIN = 20;

const STATUS = Object.freeze({ DRAFT: 'draft', PUBLISHED: 'published', WITHDRAWN: 'withdrawn' });
const VISIBILITY = Object.freeze(['public', 'members', 'staff']);
const RELATION = Object.freeze(['revokes', 'amends', 'errata', 'regulates', 'refers']);

/** [id, categoria, numerado, rótulo] — o rótulo vai no código gravado ("Resolução nº 3/2026"). */
const TYPES = Object.freeze(Object.fromEntries([
  ['statute', 'structure', false, 'Estatuto'], ['bylaws', 'structure', false, 'Regimento interno'],
  ['org_chart', 'structure', false, 'Organograma'], ['bodies', 'structure', false, 'Composição dos órgãos'],
  ['ethics_code', 'ethics', false, 'Código de ética'], ['disciplinary_code', 'ethics', false, 'Código disciplinar'],
  ['disciplinary_decision', 'ethics', true, 'Decisão disciplinar'],
  ['game_rules', 'sport_rules', false, 'Regras do jogo'], ['competition_rules', 'sport_rules', false, 'Regulamento geral de competições'],
  ['specific_rules', 'sport_rules', true, 'Regulamento específico'], ['ranking_rules', 'sport_rules', false, 'Regulamento de ranking'],
  ['refereeing_rules', 'sport_rules', false, 'Regulamento de arbitragem'], ['linked_rules', 'sport_rules', false, 'Regulamento vinculado'],
  ['resolution', 'acts', true, 'Resolução'], ['ordinance', 'acts', true, 'Portaria'], ['deliberation', 'acts', true, 'Deliberação'],
  ['presidential_act', 'acts', true, 'Ato da presidência'], ['notice', 'acts', true, 'Edital'], ['official_note', 'acts', true, 'Nota oficial'],
  ['errata', 'acts', true, 'Errata'], ['convocation', 'convocations', true, 'Edital de convocação'],
  ['minutes', 'minutes', true, 'Ata'], ['attendance', 'minutes', false, 'Lista de presença'], ['vote_record', 'minutes', false, 'Registro de votação'],
  ['score_sheet', 'events', false, 'Súmula'], ['results_bulletin', 'events', true, 'Boletim de resultados'],
  ['referee_report', 'events', false, 'Relatório de arbitragem'], ['venue_assessment', 'events', false, 'Avaliação de arena'],
  ['financial_statements', 'transparency', false, 'Demonstrações financeiras'], ['fiscal_opinion', 'transparency', false, 'Parecer do conselho fiscal'],
  ['management_report', 'transparency', false, 'Relatório de gestão'], ['agreements', 'transparency', false, 'Convênio e prestação de contas'],
  ['leaders_pay', 'transparency', false, 'Dirigentes e remuneração'], ['planning', 'transparency', false, 'Planejamento'],
  ['video', 'media', false, 'Vídeo'], ['audio', 'media', false, 'Áudio'], ['gallery', 'media', false, 'Galeria'],
  ['annual_calendar', 'calendar', false, 'Calendário oficial anual'],
].map(([id, category, numbered, label]) => [id, Object.freeze({ category, numbered, label })])));

const FAMILIES = Object.freeze([
  { id: 'document', max: 25 * 1024 * 1024, re: /^(application\/pdf|text\/(plain|csv)|application\/msword|application\/vnd\.ms-excel|application\/vnd\.openxmlformats-officedocument\.[a-z.]+|application\/vnd\.oasis\.opendocument\.[a-z.]+)$/ },
  { id: 'image', max: 10 * 1024 * 1024, re: /^image\/(webp|jpeg|png)$/ },
  { id: 'audio', max: 50 * 1024 * 1024, re: /^audio\/(mpeg|mp4|ogg|wav|x-m4a|webm)$/ },
  { id: 'video', max: 100 * 1024 * 1024, re: /^video\/(mp4|webm|quicktime)$/ },
]);
const familyOf = (ct) => FAMILIES.find((x) => x.re.test(String(ct || ''))) || null;
// `clube-acervo/` é a pasta do acervo do clube-associação (`clubDocs.js`, mesma régua).
const UPLOAD_PATH = /^(federacao|clube)-acervo\/[A-Za-z0-9]+\/[A-Za-z0-9_-]+\.[a-z0-9]{2,4}$/;

function videoEmbed(url) {
  const u = String(url || '').trim();
  let m = u.match(/^https:\/\/(?:www\.|m\.)?youtube\.com\/(?:watch\?(?:.*&)?v=|live\/|shorts\/|embed\/)([A-Za-z0-9_-]{11})/) || u.match(/^https:\/\/youtu\.be\/([A-Za-z0-9_-]{11})/);
  if (m) return { provider: 'youtube', id: m[1], embed: `https://www.youtube-nocookie.com/embed/${m[1]}` };
  m = u.match(/^https:\/\/(?:www\.)?vimeo\.com\/(\d{6,12})/) || u.match(/^https:\/\/player\.vimeo\.com\/video\/(\d{6,12})/);
  if (m) return { provider: 'vimeo', id: m[1], embed: `https://player.vimeo.com/video/${m[1]}` };
  return null;
}

const str = (v, max) => String(v ?? '').replace(/\r\n/g, '\n').trim().slice(0, max);
const line = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d);

/** Mesma conta de `validateDocInput` no cliente: `{ ok, errors (chaves), value }`. */
function validateDoc(input = {}) {
  const errors = {};
  const type = TYPES[input.type] ? input.type : '';
  if (!type) errors.type = 'Escolha o tipo do documento.';
  const category = type ? TYPES[type].category : '';
  const title = line(input.title, TITLE_MAX);
  if (title.length < 3) errors.title = 'Dê um título (mínimo 3 caracteres).';
  const summary = str(input.summary, SUMMARY_MAX);
  const body = str(input.body, BODY_MAX);
  const act_date = line(input.act_date, 10);
  if (act_date && !isDate(act_date)) errors.act_date = 'Data inválida.';
  const visibility = VISIBILITY.includes(input.visibility) ? input.visibility : 'public';
  const tagsIn = Array.isArray(input.tags) ? input.tags : String(input.tags || '').split(',');
  const tags = [...new Set(tagsIn.map((x) => line(x, 30).toLowerCase()).filter(Boolean))];
  if (tags.length > TAGS_MAX) errors.tags = `No máximo ${TAGS_MAX} palavras-chave.`;
  const relIn = Array.isArray(input.relations) ? input.relations : [];
  if (relIn.length > RELATIONS_MAX) errors.relations = `No máximo ${RELATIONS_MAX} relações.`;
  const relations = [];
  relIn.slice(0, RELATIONS_MAX).forEach((r, i) => {
    const kind = RELATION.includes(r && r.kind) ? r.kind : '';
    const doc_id = line(r && r.doc_id, 80);
    if (!kind || !/^[A-Za-z0-9_-]{1,80}$/.test(doc_id)) { errors[`relations.${i}`] = 'Escolha a relação e o documento.'; return; }
    if (!relations.some((x) => x.doc_id === doc_id)) relations.push({ kind, doc_id });
  });
  if (type === 'errata' && !relations.some((r) => r.kind === 'errata')) errors.relations = 'A errata aponta o documento que ela corrige.';
  const filesIn = Array.isArray(input.files) ? input.files : [];
  if (filesIn.length > FILES_MAX) errors.files = `No máximo ${FILES_MAX} arquivos.`;
  const files = filesIn.slice(0, FILES_MAX).map((f) => ({
    name: line(f && f.name, 120) || 'arquivo',
    path: String((f && f.path) || ''),
    size: Math.max(0, Math.floor(Number(f && f.size) || 0)),
    content_type: String((f && f.content_type) || ''),
  }));
  files.forEach((f, i) => {
    const fam = familyOf(f.content_type);
    if (!UPLOAD_PATH.test(f.path) || !fam || !(f.size > 0) || f.size > fam.max) errors[`files.${i}`] = 'Arquivo inválido. Envie de novo.';
  });
  const linksIn = Array.isArray(input.media_links) ? input.media_links : [];
  if (linksIn.length > LINKS_MAX) errors.media_links = `No máximo ${LINKS_MAX} vídeos por link.`;
  const media_links = linksIn.slice(0, LINKS_MAX).map((l, i) => {
    const url = line(l && l.url, 300);
    if (!videoEmbed(url)) errors[`media_links.${i}`] = 'Use um link do YouTube ou do Vimeo.';
    return { url, title: line(l && l.title, 120) };
  });
  if (!body && files.length === 0 && media_links.length === 0) errors.content = 'Anexe um arquivo, cole um vídeo ou escreva o texto do documento.';
  return {
    ok: Object.keys(errors).length === 0,
    errors,
    value: { type, category, title, summary, body, act_date, signed_by: line(input.signed_by, 160), visibility, tags: tags.slice(0, TAGS_MAX), relations, files, media_links },
  };
}

/** O código gravado ("Resolução nº 3/2026"); "" para tipo sem número. */
const codeOf = (type, number, year) => (TYPES[type] && TYPES[type].numbered && number && year ? `${TYPES[type].label} nº ${number}/${year}` : '');

/** A chave do contador (por tipo e ano) em `federations.doc_numbers`. */
const counterKey = (type, year) => `${type}_${year}`;

module.exports = {
  TITLE_MAX, SUMMARY_MAX, BODY_MAX, TAGS_MAX, RELATIONS_MAX, FILES_MAX, LINKS_MAX, RESTRICTED_FILE_MAX, REASON_MIN, WITHDRAW_REASON_MIN,
  STATUS, VISIBILITY, RELATION, TYPES, FAMILIES, familyOf, UPLOAD_PATH, videoEmbed, validateDoc, codeOf, counterKey,
};
