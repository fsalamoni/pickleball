/**
 * ACERVO OFICIAL da federação (módulo `official_docs`) — lógica pura.
 *
 * Cada documento é um `federation_docs` que SÓ o servidor grava
 * (`functions/federationAcervo.js`): rascunho → publicado; publicado não se
 * edita — corrige-se por RETIFICAÇÃO (nova versão, a anterior visível com o
 * motivo), por ERRATA (um ato novo ligado a ele) ou por um ato que ALTERA ou
 * REVOGA (o revogado não some: fica com a faixa "Revogado por …"). Os atos
 * numerados ganham número por tipo e ano no servidor (Resolução nº 3/2026), e
 * cada arquivo publicado leva o SHA-256 — a página do documento confere um
 * arquivo baixado contra ele.
 *
 * ⚠️ Os ids de categoria, tipo, visibilidade e relação são GRAVADOS: nunca
 * renomeie. A tabela de tipos e a validação têm cópia no servidor
 * (`functions/federationAcervoPolicy.js`, paridade em
 * `federationAcervo.parity.test.js`).
 */
import { t, tk } from '@/core/i18n';

export const DOC_TITLE_MAX = 200;
export const DOC_SUMMARY_MAX = 600;
export const DOC_BODY_MAX = 30000;
export const DOC_TAGS_MAX = 10;
export const DOC_RELATIONS_MAX = 10;
export const DOC_FILES_MAX = 10;
export const DOC_LINKS_MAX = 5;
/** Arquivo de documento restrito (filiados/equipe) é entregue pelo servidor: até 9 MB. */
export const DOC_RESTRICTED_FILE_MAX = 9 * 1024 * 1024;
export const DOC_REASON_MIN = 10;
export const DOC_WITHDRAW_REASON_MIN = 20;

export const DOC_STATUS = Object.freeze({ DRAFT: 'draft', PUBLISHED: 'published', WITHDRAWN: 'withdrawn' });
export const DOC_STATUS_LABELS = Object.freeze({ draft: tk('Rascunho'), published: tk('Publicado'), withdrawn: tk('Retirado do ar') });

export const DOC_VISIBILITY = Object.freeze({ PUBLIC: 'public', MEMBERS: 'members', STAFF: 'staff' });
export const DOC_VISIBILITY_LABELS = Object.freeze({ public: tk('Público'), members: tk('Só filiados'), staff: tk('Só a equipe') });
export const DOC_VISIBILITY_HINTS = Object.freeze({
  public: tk('Qualquer pessoa lê e baixa, sem conta.'),
  members: tk('Quem tem filiação ativa nesta federação.'),
  staff: tk('Só quem é da equipe da federação.'),
});

export const DOC_CATEGORIES = Object.freeze([
  { id: 'structure', label: tk('Estrutura e organização') },
  { id: 'ethics', label: tk('Ética e disciplina') },
  { id: 'sport_rules', label: tk('Regulamentos esportivos') },
  { id: 'acts', label: tk('Atos e deliberações') },
  { id: 'convocations', label: tk('Convocações') },
  { id: 'minutes', label: tk('Atas e registros') },
  { id: 'events', label: tk('Eventos e competições') },
  { id: 'transparency', label: tk('Transparência e finanças') },
  { id: 'media', label: tk('Mídia') },
  { id: 'calendar', label: tk('Calendário') },
]);

/** Tipo → categoria e se é numerado (número por tipo e ano, dado pelo servidor). */
export const DOC_TYPES = Object.freeze([
  { id: 'statute', category: 'structure', label: tk('Estatuto'), numbered: false },
  { id: 'bylaws', category: 'structure', label: tk('Regimento interno'), numbered: false },
  { id: 'org_chart', category: 'structure', label: tk('Organograma'), numbered: false },
  { id: 'bodies', category: 'structure', label: tk('Composição dos órgãos'), numbered: false },
  { id: 'ethics_code', category: 'ethics', label: tk('Código de ética'), numbered: false },
  { id: 'disciplinary_code', category: 'ethics', label: tk('Código disciplinar'), numbered: false },
  { id: 'disciplinary_decision', category: 'ethics', label: tk('Decisão disciplinar'), numbered: true },
  { id: 'game_rules', category: 'sport_rules', label: tk('Regras do jogo'), numbered: false },
  { id: 'competition_rules', category: 'sport_rules', label: tk('Regulamento geral de competições'), numbered: false },
  { id: 'specific_rules', category: 'sport_rules', label: tk('Regulamento específico'), numbered: true },
  { id: 'ranking_rules', category: 'sport_rules', label: tk('Regulamento de ranking'), numbered: false },
  { id: 'refereeing_rules', category: 'sport_rules', label: tk('Regulamento de arbitragem'), numbered: false },
  { id: 'linked_rules', category: 'sport_rules', label: tk('Regulamento vinculado'), numbered: false },
  { id: 'resolution', category: 'acts', label: tk('Resolução'), numbered: true },
  { id: 'ordinance', category: 'acts', label: tk('Portaria'), numbered: true },
  { id: 'deliberation', category: 'acts', label: tk('Deliberação'), numbered: true },
  { id: 'presidential_act', category: 'acts', label: tk('Ato da presidência'), numbered: true },
  { id: 'notice', category: 'acts', label: tk('Edital'), numbered: true },
  { id: 'official_note', category: 'acts', label: tk('Nota oficial'), numbered: true },
  { id: 'errata', category: 'acts', label: tk('Errata'), numbered: true },
  { id: 'convocation', category: 'convocations', label: tk('Edital de convocação'), numbered: true },
  { id: 'minutes', category: 'minutes', label: tk('Ata'), numbered: true },
  { id: 'attendance', category: 'minutes', label: tk('Lista de presença'), numbered: false },
  { id: 'vote_record', category: 'minutes', label: tk('Registro de votação'), numbered: false },
  { id: 'score_sheet', category: 'events', label: tk('Súmula'), numbered: false },
  { id: 'results_bulletin', category: 'events', label: tk('Boletim de resultados'), numbered: true },
  { id: 'referee_report', category: 'events', label: tk('Relatório de arbitragem'), numbered: false },
  { id: 'venue_assessment', category: 'events', label: tk('Avaliação de arena'), numbered: false },
  { id: 'financial_statements', category: 'transparency', label: tk('Demonstrações financeiras'), numbered: false },
  { id: 'fiscal_opinion', category: 'transparency', label: tk('Parecer do conselho fiscal'), numbered: false },
  { id: 'management_report', category: 'transparency', label: tk('Relatório de gestão'), numbered: false },
  { id: 'agreements', category: 'transparency', label: tk('Convênio e prestação de contas'), numbered: false },
  { id: 'leaders_pay', category: 'transparency', label: tk('Dirigentes e remuneração'), numbered: false },
  { id: 'planning', category: 'transparency', label: tk('Planejamento'), numbered: false },
  { id: 'video', category: 'media', label: tk('Vídeo'), numbered: false },
  { id: 'audio', category: 'media', label: tk('Áudio'), numbered: false },
  { id: 'gallery', category: 'media', label: tk('Galeria'), numbered: false },
  { id: 'annual_calendar', category: 'calendar', label: tk('Calendário oficial anual'), numbered: false },
]);

const TYPE_BY_ID = Object.freeze(Object.fromEntries(DOC_TYPES.map((x) => [x.id, x])));
const CATEGORY_BY_ID = Object.freeze(Object.fromEntries(DOC_CATEGORIES.map((x) => [x.id, x])));
export const docType = (id) => TYPE_BY_ID[id] || null;
export const docCategory = (id) => CATEGORY_BY_ID[id] || null;
export const typesOfCategory = (category) => DOC_TYPES.filter((x) => x.category === category);

/**
 * Relação de um ato NOVO com um já publicado. Ao publicar, o servidor marca
 * o alvo: revoga → "Revogado por"; altera → "Alterado por"; errata → "Errata".
 */
export const DOC_RELATION = Object.freeze({ REVOKES: 'revokes', AMENDS: 'amends', ERRATA: 'errata', REGULATES: 'regulates', REFERS: 'refers' });
export const DOC_RELATION_LABELS = Object.freeze({
  revokes: tk('Revoga'), amends: tk('Altera'), errata: tk('Errata de'), regulates: tk('Regulamenta'), refers: tk('Faz referência a'),
});
/** Como o ALVO mostra a relação recebida. */
export const DOC_RELATION_INVERSE_LABELS = Object.freeze({
  revokes: tk('Revogado por'), amends: tk('Alterado por'), errata: tk('Errata publicada'), regulates: tk('Regulamentado por'), refers: tk('Citado por'),
});

/** Tipos de arquivo aceitos e o teto de cada família (a regra do Storage tem os mesmos números). */
export const ACERVO_FILE_FAMILIES = Object.freeze([
  { id: 'document', max: 25 * 1024 * 1024, re: /^(application\/pdf|text\/(plain|csv)|application\/msword|application\/vnd\.ms-excel|application\/vnd\.openxmlformats-officedocument\.[a-z.]+|application\/vnd\.oasis\.opendocument\.[a-z.]+)$/ },
  { id: 'image', max: 10 * 1024 * 1024, re: /^image\/(webp|jpeg|png)$/ },
  { id: 'audio', max: 50 * 1024 * 1024, re: /^audio\/(mpeg|mp4|ogg|wav|x-m4a|webm)$/ },
  { id: 'video', max: 100 * 1024 * 1024, re: /^video\/(mp4|webm|quicktime)$/ },
]);
export const ACERVO_ACCEPT = '.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx,.odt,.ods,.odp,.pptx,.webp,.jpg,.jpeg,.png,.mp3,.m4a,.ogg,.wav,.mp4,.webm,.mov';

const EXT = {
  'application/pdf': 'pdf', 'text/plain': 'txt', 'text/csv': 'csv', 'application/msword': 'doc', 'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx', 'application/vnd.oasis.opendocument.text': 'odt',
  'application/vnd.oasis.opendocument.spreadsheet': 'ods', 'application/vnd.oasis.opendocument.presentation': 'odp',
  'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a',
  'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/webm': 'weba', 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov',
};

export const fileFamilyOf = (contentType) => ACERVO_FILE_FAMILIES.find((x) => x.re.test(String(contentType || ''))) || null;

/** O arquivo pode entrar no acervo? `{ ok, error }`. */
export function validateAcervoFile(file) {
  const fam = fileFamilyOf(file?.type);
  if (!fam) return { ok: false, error: t('Formato não aceito. Use PDF, documento, planilha, imagem, áudio ou vídeo.') };
  if (!(file.size > 0)) return { ok: false, error: t('O arquivo está vazio.') };
  if (file.size > fam.max) return { ok: false, error: t('Arquivo grande demais: até {mb} MB para este formato.', { mb: Math.round(fam.max / 1024 / 1024) }) };
  return { ok: true, error: null };
}

/** Onde o rascunho sobe: a pasta privada de quem envia (só ela lê; o servidor copia ao publicar). */
export const acervoUploadPath = (uid, id, contentType) => `federacao-acervo/${uid}/${id}.${EXT[contentType] || 'bin'}`;
const UPLOAD_PATH = /^federacao-acervo\/[A-Za-z0-9]+\/[A-Za-z0-9_-]+\.[a-z0-9]{2,4}$/;

/** YouTube ou Vimeo → endereço de incorporação (o CSP só libera youtube-nocookie e player.vimeo). */
export function videoEmbed(url) {
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

/**
 * O rascunho que a tela manda ao servidor.
 * @returns {{ ok: boolean, errors: Record<string,string>, value: object }}
 */
export function validateDocInput(input = {}) {
  const errors = {};
  const type = docType(input.type) ? input.type : '';
  if (!type) errors.type = t('Escolha o tipo do documento.');
  const category = type ? docType(type).category : '';
  const title = line(input.title, DOC_TITLE_MAX);
  if (title.length < 3) errors.title = t('Dê um título (mínimo 3 caracteres).');
  const summary = str(input.summary, DOC_SUMMARY_MAX);
  const body = str(input.body, DOC_BODY_MAX);
  const act_date = line(input.act_date, 10);
  if (act_date && !isDate(act_date)) errors.act_date = t('Data inválida.');
  const visibility = Object.values(DOC_VISIBILITY).includes(input.visibility) ? input.visibility : DOC_VISIBILITY.PUBLIC;
  const tagsIn = Array.isArray(input.tags) ? input.tags : String(input.tags || '').split(',');
  const tags = [...new Set(tagsIn.map((x) => line(x, 30).toLowerCase()).filter(Boolean))];
  if (tags.length > DOC_TAGS_MAX) errors.tags = t('No máximo {n} palavras-chave.', { n: DOC_TAGS_MAX });
  const relIn = Array.isArray(input.relations) ? input.relations : [];
  if (relIn.length > DOC_RELATIONS_MAX) errors.relations = t('No máximo {n} relações.', { n: DOC_RELATIONS_MAX });
  const relations = [];
  relIn.slice(0, DOC_RELATIONS_MAX).forEach((r, i) => {
    const kind = Object.values(DOC_RELATION).includes(r?.kind) ? r.kind : '';
    const doc_id = line(r?.doc_id, 80);
    if (!kind || !/^[A-Za-z0-9_-]{1,80}$/.test(doc_id)) { errors[`relations.${i}`] = t('Escolha a relação e o documento.'); return; }
    if (!relations.some((x) => x.doc_id === doc_id)) relations.push({ kind, doc_id });
  });
  if (type === 'errata' && !relations.some((r) => r.kind === DOC_RELATION.ERRATA)) errors.relations = t('A errata aponta o documento que ela corrige.');
  const filesIn = Array.isArray(input.files) ? input.files : [];
  if (filesIn.length > DOC_FILES_MAX) errors.files = t('No máximo {n} arquivos.', { n: DOC_FILES_MAX });
  const files = filesIn.slice(0, DOC_FILES_MAX).map((f) => ({
    name: line(f?.name, 120) || 'arquivo',
    path: String(f?.path || ''),
    size: Math.max(0, Math.floor(Number(f?.size) || 0)),
    content_type: String(f?.content_type || ''),
  }));
  files.forEach((f, i) => {
    const fam = fileFamilyOf(f.content_type);
    if (!UPLOAD_PATH.test(f.path) || !fam || !(f.size > 0) || f.size > fam.max) errors[`files.${i}`] = t('Arquivo inválido. Envie de novo.');
  });
  const linksIn = Array.isArray(input.media_links) ? input.media_links : [];
  if (linksIn.length > DOC_LINKS_MAX) errors.media_links = t('No máximo {n} vídeos por link.', { n: DOC_LINKS_MAX });
  const media_links = linksIn.slice(0, DOC_LINKS_MAX).map((l, i) => {
    const url = line(l?.url, 300);
    if (!videoEmbed(url)) errors[`media_links.${i}`] = t('Use um link do YouTube ou do Vimeo.');
    return { url, title: line(l?.title, 120) };
  });
  if (!body && files.length === 0 && media_links.length === 0) errors.content = t('Anexe um arquivo, cole um vídeo ou escreva o texto do documento.');
  return {
    ok: Object.keys(errors).length === 0,
    errors,
    value: { type, category, title, summary, body, act_date, signed_by: line(input.signed_by, 160), visibility, tags: tags.slice(0, DOC_TAGS_MAX), relations, files, media_links },
  };
}

/** "Resolução nº 3/2026" (numerado e publicado) ou "" — o número é do servidor. */
export function docCode(doc) {
  const tipo = docType(doc?.type);
  if (!tipo || !tipo.numbered || !doc.number || !doc.year) return '';
  return t('{tipo} nº {n}/{ano}', { tipo: t(tipo.label), n: doc.number, ano: doc.year });
}

/** O nome completo para listas: código (quando há) + título. */
export const docDisplayTitle = (doc) => [docCode(doc), doc?.title].filter(Boolean).join(' — ');

/** Data de referência do documento (do ato; senão a de publicação; senão a de criação). */
export function docDateMs(doc) {
  const d = doc?.act_date ? Date.parse(`${doc.act_date}T12:00:00Z`) : 0;
  return d || Number(doc?.published_at_ms) || Number(doc?.created_at_ms) || 0;
}

export const docYear = (doc) => { const ms = docDateMs(doc); return ms ? new Date(ms).getUTCFullYear() : null; };

/** Está em vigor? Revogado e retirado não estão. */
export const isDocCurrent = (doc) => doc?.status === DOC_STATUS.PUBLISHED && !doc?.revoked_by;

/** Do mais novo para o mais antigo. */
export const sortDocs = (list = []) => [...(list || [])].sort((a, b) => docDateMs(b) - docDateMs(a) || (Number(b.published_at_ms) || 0) - (Number(a.published_at_ms) || 0));

const sem = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Busca e filtros do acervo (na memória: a consulta é por igualdades, sem índice).
 * @param {object[]} docs
 * @param {{ q?: string, category?: string, type?: string, year?: string|number, status?: string, onlyCurrent?: boolean }} f
 */
export function filterDocs(docs = [], { q = '', category = '', type = '', year = '', status = '', onlyCurrent = false } = {}) {
  const termos = sem(q).split(/\s+/).filter(Boolean);
  return sortDocs((docs || []).filter((d) => {
    if (category && d.category !== category) return false;
    if (type && d.type !== type) return false;
    if (status && d.status !== status) return false;
    if (year && String(docYear(d)) !== String(year)) return false;
    if (onlyCurrent && !isDocCurrent(d)) return false;
    if (!termos.length) return true;
    const alvo = sem([d.title, d.summary, d.code, (d.tags || []).join(' '), docType(d.type) ? t(docType(d.type).label) : ''].join(' '));
    return termos.every((x) => alvo.includes(x));
  }));
}

/** Os anos que aparecem no acervo (para o filtro). */
export const docYears = (docs = []) => [...new Set((docs || []).map(docYear).filter(Boolean))].sort((a, b) => b - a);

/** As categorias com pelo menos um documento, na ordem do catálogo. */
export const docCategoriesIn = (docs = []) => DOC_CATEGORIES.filter((c) => (docs || []).some((d) => d.category === c.id));

/**
 * Transparência: o que a Lei Geral do Esporte (Lei 14.597/2023, art. 36) pede
 * publicado e as boas práticas. Mostra "não publicado" em vez de esconder.
 * `fresh`: só vale documento do ano passado para cá (contas, calendário).
 */
export const TRANSPARENCY_ITEMS = Object.freeze([
  { id: 'statute', label: tk('Estatuto vigente'), types: ['statute'], basis: tk('Lei 14.597/2023, art. 36, § 4º, I') },
  { id: 'leaders', label: tk('Dirigentes e remuneração'), types: ['leaders_pay', 'bodies'], basis: tk('Lei 14.597/2023, art. 36, § 4º, II') },
  { id: 'agreements', label: tk('Convênios e prestações de contas'), types: ['agreements'], basis: tk('Lei 14.597/2023, art. 36, § 4º, III') },
  { id: 'accounts', label: tk('Demonstrações financeiras'), types: ['financial_statements'], basis: tk('Lei 14.597/2023, art. 36, § 4º, IV'), fresh: true },
  { id: 'fiscal', label: tk('Parecer do conselho fiscal'), types: ['fiscal_opinion'], basis: tk('Lei 14.597/2023, art. 36, IX e X, f'), fresh: true },
  { id: 'management', label: tk('Relatório de gestão e atos de gestão'), types: ['management_report', 'resolution', 'ordinance', 'presidential_act'], basis: tk('Lei 14.597/2023, art. 36, § 4º, IV') },
  { id: 'calendar', label: tk('Calendário das assembleias'), types: ['annual_calendar', 'convocation'], basis: tk('Lei 14.597/2023, art. 36, X, j'), fresh: true },
  { id: 'minutes', label: tk('Atas das assembleias'), types: ['minutes'], basis: tk('Lei 14.597/2023, art. 36, X, j') },
  { id: 'competition', label: tk('Regulamento de competições'), types: ['competition_rules', 'game_rules'], basis: tk('Boa prática') },
  { id: 'ethics', label: tk('Código de ética e disciplinar'), types: ['ethics_code', 'disciplinary_code'], basis: tk('Boa prática (Lei 14.597/2023, art. 59)') },
]);

/**
 * @param {object[]} docs os documentos que a pessoa vê
 * @param {{ nowMs?: number }} [opts]
 * @returns {Array<{ id, label, basis, ok: boolean, doc: object|null }>}
 */
export function transparencyChecklist(docs = [], { nowMs = Date.now() } = {}) {
  const anoMin = new Date(nowMs).getUTCFullYear() - 1;
  const vigentes = sortDocs((docs || []).filter((d) => isDocCurrent(d) && d.visibility === DOC_VISIBILITY.PUBLIC));
  return TRANSPARENCY_ITEMS.map((item) => {
    const doc = vigentes.find((d) => item.types.includes(d.type) && (!item.fresh || (docYear(d) || 0) >= anoMin)) || null;
    return { id: item.id, label: item.label, basis: item.basis, ok: Boolean(doc), doc };
  });
}

/** O endereço público do documento (o QR e o compartilhar levam a ele). */
export const docPublicPath = (federation, docId) => `/f/${encodeURIComponent(federation?.slug || federation?.id || '')}/acervo/${encodeURIComponent(docId)}`;

/** O endereço público do acervo (o mural da federação). */
export const acervoPublicPath = (federation) => `/f/${encodeURIComponent(federation?.slug || federation?.id || '')}/acervo`;

/** Como o arquivo abre na página: `pdf`, `image`, `audio`, `video` ou `download` (só baixar). */
export function fileViewKind(contentType) {
  const ct = String(contentType || '');
  if (ct === 'application/pdf') return 'pdf';
  const fam = fileFamilyOf(ct)?.id;
  return fam === 'image' || fam === 'audio' || fam === 'video' ? fam : 'download';
}

/** Os documentos de várias listas (público + filiados + equipe), sem repetir. */
export function mergeDocLists(...listas) {
  const vistos = new Map();
  listas.flat().filter(Boolean).forEach((d) => { if (d?.id && !vistos.has(d.id)) vistos.set(d.id, d); });
  return [...vistos.values()];
}

/** O mural: os publicados mais recentes primeiro (pela publicação, não pela data do ato). */
export const muralDocs = (docs = [], limite = 20) => [...(docs || [])]
  .filter((d) => d.status === DOC_STATUS.PUBLISHED)
  .sort((a, b) => (Number(b.version_at_ms) || Number(b.published_at_ms) || 0) - (Number(a.version_at_ms) || Number(a.published_at_ms) || 0))
  .slice(0, limite);

/** "Novo" no mural: publicado ou retificado nos últimos 7 dias. */
export const isDocNew = (doc, nowMs = Date.now()) => nowMs - (Number(doc?.version_at_ms) || Number(doc?.published_at_ms) || 0) < 7 * 86400000;

/**
 * Confere um SHA-256 (de um arquivo que a pessoa tem) contra os arquivos do
 * documento — a versão atual e as anteriores.
 * @returns {{ file: object, version: number, current: boolean } | null}
 */
export function findFileByHash(doc, hash) {
  const h = String(hash || '').trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(h) || !doc) return null;
  const atual = (doc.files || []).find((x) => x.sha256 === h);
  if (atual) return { file: atual, version: Number(doc.version) || 1, current: true };
  for (const v of [...(doc.versions || [])].reverse()) {
    const antigo = (v.files || []).find((x) => x.sha256 === h);
    if (antigo) return { file: antigo, version: Number(v.version) || 1, current: false };
  }
  return null;
}

/** Ações possíveis sobre um documento, para quem tem a permissão do acervo. */
export function docActions(doc, { isAdmin = false } = {}) {
  const draft = doc?.status === DOC_STATUS.DRAFT;
  const pub = doc?.status === DOC_STATUS.PUBLISHED;
  return {
    edit: draft, publish: draft, remove: draft,
    rectify: pub && !doc.revoked_by, errata: pub, revoke: pub && !doc.revoked_by,
    visibility: pub, withdraw: pub && isAdmin,
  };
}

/** O tamanho legível ("2,4 MB"). */
export function fileSizeLabel(bytes) {
  const n = Number(bytes) || 0;
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}
