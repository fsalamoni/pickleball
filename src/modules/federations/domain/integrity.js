/**
 * JOGO LIMPO (rodada 3, Bloco 1, `docs/50` §36) — a conta PURA da integridade
 * esportiva:
 *
 *  - Equipamentos homologados (módulo `equipment`): a lista de raquetes, bolas
 *    e redes que a federação aprovou, reprovou ou descertificou, com a data.
 *    A confederação publica a lista da REDE: a página da estadual filiada
 *    mostra as duas (`equipmentList`). Só o servidor grava
 *    (`federation_equipment`, `functions/federationIntegrity.js`).
 *  - Antidopagem (módulo `antidoping`, #JogoLimpo): o texto, o contato e os
 *    links da página pública (`federations.antidoping`, o admin grava) e as
 *    cláusulas padrão que o torneio chancelado mostra no regulamento.
 *
 * A parte que o servidor confere tem CÓPIA em
 * `functions/federationIntegrityPolicy.js`, com paridade em
 * `federationIntegrity.parity.test.js`. Tipos e situações são GRAVADOS:
 * nunca renomeie.
 */
import { t, tk } from '@/core/i18n';

const str = (v, max = 500) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const txt = (v, max) => String(v ?? '').trim().slice(0, max);
const isIso = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));

/* ----------------------------------------------------- equipamentos -- */

export const EQUIPMENT_KINDS = Object.freeze(['paddle', 'ball', 'net', 'other']);
export const EQUIPMENT_KIND_LABELS = Object.freeze({ paddle: tk('Raquete'), ball: tk('Bola'), net: tk('Rede'), other: tk('Outro') });
export const EQUIPMENT_STATUS = Object.freeze({ APPROVED: 'approved', REJECTED: 'rejected', DECERTIFIED: 'decertified' });
export const EQUIPMENT_STATUS_LABELS = Object.freeze({ approved: tk('Homologado'), rejected: tk('Reprovado'), decertified: tk('Descertificado') });
export const EQUIPMENT_NOTES_MAX = 500;
export const EQUIPMENT_HISTORY_MAX = 30;

/** Marca, modelo e o resto do cadastro (a situação muda à parte, com data e motivo). */
export function validateEquipment(input = {}) {
  const v = {
    kind: EQUIPMENT_KINDS.includes(input.kind) ? input.kind : 'paddle',
    brand: str(input.brand, 60),
    model: str(input.model, 80),
    reference: str(input.reference, 60),
    source: str(input.source, 120),
    notes: txt(input.notes, EQUIPMENT_NOTES_MAX),
  };
  const errors = {};
  if (v.brand.length < 2) errors.brand = t('Informe a marca.');
  if (!v.model) errors.model = t('Informe o modelo.');
  return { ok: !Object.keys(errors).length, errors, value: v };
}

/** Reprovar, descertificar e voltar a homologar um descertificado pedem motivo. */
export const statusNeedsReason = (from, to) => to !== EQUIPMENT_STATUS.APPROVED || from === EQUIPMENT_STATUS.DECERTIFIED;

/**
 * A situação nova (`item` nulo = cadastro): diferente da atual, com data que
 * não é futura nem anterior à situação atual, e motivo quando pedido.
 */
export function validateStatusChange(item, input = {}, hoje) {
  const from = item ? item.status : null;
  const status = Object.values(EQUIPMENT_STATUS).includes(input.status) ? input.status : (item ? '' : EQUIPMENT_STATUS.APPROVED);
  const date = isIso(input.date) ? input.date : hoje;
  const reason = str(input.reason, 300);
  const errors = {};
  if (!status) errors.status = t('Escolha a situação.');
  else if (from === status) errors.status = t('O equipamento já está nessa situação.');
  if (date > hoje) errors.date = t('A data não pode ser no futuro.');
  else if (item && isIso(item.status_at) && date < item.status_at) errors.date = t('A data não pode ser anterior à situação atual.');
  if (status && statusNeedsReason(from, status) && reason.length < 5) errors.reason = t('Diga o motivo (aparece na lista pública).');
  return { ok: !Object.keys(errors).length, errors, value: { status, date, reason } };
}

const tem = (perms, ...ps) => Array.isArray(perms) && ps.some((p) => perms.includes(p));
/** A lista é das competições (e do admin). */
export const canManageEquipment = (perms) => tem(perms, 'competitions', 'admin');

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const ORDEM = { approved: 0, decertified: 1, rejected: 2 };

/**
 * A lista que a página mostra: a da federação e, na estadual filiada, a da
 * confederação (`origin: 'network'`). Homologados primeiro, depois por marca
 * e modelo.
 */
export function equipmentList(own = [], network = []) {
  const marcar = (lista, origin) => (Array.isArray(lista) ? lista : []).map((x) => ({ ...x, origin }));
  return [...marcar(own, 'own'), ...marcar(network, 'network')].sort((a, b) => (ORDEM[a.status] ?? 9) - (ORDEM[b.status] ?? 9)
    || String(a.brand || '').localeCompare(String(b.brand || ''), 'pt-BR')
    || String(a.model || '').localeCompare(String(b.model || ''), 'pt-BR'));
}

/** Busca por marca, modelo ou referência (sem acento), com filtro de tipo e situação. */
export function searchEquipment(list = [], { query = '', kind = '', status = '' } = {}) {
  const q = norm(query).trim();
  return list.filter((x) => (!kind || x.kind === kind) && (!status || x.status === status)
    && (!q || norm(`${x.brand} ${x.model} ${x.reference}`).includes(q)));
}

/** Quantos em cada situação. */
export function equipmentCounts(list = []) {
  const out = { approved: 0, rejected: 0, decertified: 0 };
  list.forEach((x) => { if (x.status in out) out[x.status] += 1; });
  return out;
}

/* ------------------------------------------------------- antidopagem -- */

/** Os links oficiais, sempre na página (os da federação vêm depois). */
export const ABCD_LINKS = Object.freeze([
  { label: tk('ABCD: Autoridade Brasileira de Controle de Dopagem'), url: 'https://www.gov.br/abcd/pt-br' },
  { label: tk('Lista de substâncias e métodos proibidos (WADA)'), url: 'https://www.wada-ama.org/en/prohibited-list' },
  { label: tk('ADEL: cursos de educação antidopagem (WADA)'), url: 'https://adel.wada-ama.org' },
]);

export const ANTIDOPING_DEFAULT_TEXT = tk('Esta federação apoia o #JogoLimpo. Os atletas estão sujeitos ao controle de dopagem do Código Brasileiro Antidopagem, aplicado pela ABCD, em competição e fora dela. Na dúvida sobre um remédio ou suplemento, consulte a lista proibida antes de usar e, se precisar de um medicamento da lista, peça a Autorização de Uso Terapêutico (AUT) à ABCD.');

/** As cláusulas que o torneio chancelado mostra no regulamento. */
export const ANTIDOPING_CLAUSES = Object.freeze([
  tk('Os atletas estão sujeitos ao controle de dopagem do Código Brasileiro Antidopagem e às regras da ABCD, em competição e fora dela.'),
  tk('Ao se inscrever, o atleta declara conhecer a lista de substâncias e métodos proibidos da WADA e responde pelo que usa.'),
  tk('Quem usa medicamento da lista proibida pede a Autorização de Uso Terapêutico (AUT) à ABCD antes do evento.'),
  tk('A lista de inscritos é publicada até 30 dias antes do torneio, para permitir o controle.'),
  tk('Atleta suspenso por violação antidopagem não se inscreve enquanto durar a suspensão.'),
]);

export const ANTIDOPING_LINKS_MAX = 5;
const urlOk = (u) => /^https:\/\/[^\s<>"']{3,300}$/.test(u);

/** O que o admin escreve (`federations.antidoping`). */
export function validateAntidoping(input = {}) {
  const errors = {};
  const links = (Array.isArray(input.links) ? input.links : []).slice(0, ANTIDOPING_LINKS_MAX)
    .map((l) => ({ label: str(l?.label, 80), url: str(l?.url, 300) }))
    .filter((l) => l.label || l.url);
  if (links.some((l) => l.label.length < 2 || !urlOk(l.url))) errors.links = t('Cada link precisa de um nome e de um endereço que comece com https://.');
  return {
    ok: !Object.keys(errors).length,
    errors,
    value: { note: txt(input.note, 2000), contact: str(input.contact, 160), show_clauses: input.show_clauses !== false, links },
  };
}

/** O que a página e o torneio mostram: o texto da federação (ou o padrão), os links oficiais e os dela. */
export function antidopingView(federation) {
  const a = (federation && federation.antidoping) || {};
  const proprios = (Array.isArray(a.links) ? a.links : []).filter((l) => l && urlOk(String(l.url || '')));
  return {
    text: String(a.note || '').trim() || t(ANTIDOPING_DEFAULT_TEXT),
    contact: String(a.contact || ''),
    links: [...ABCD_LINKS.map((l) => ({ ...l, label: t(l.label), official: true })), ...proprios],
    clauses: a.show_clauses === false ? [] : ANTIDOPING_CLAUSES.map((c) => t(c)),
  };
}
