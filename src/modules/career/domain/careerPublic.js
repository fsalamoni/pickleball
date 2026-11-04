/**
 * MINHA CARREIRA — a VITRINE pública (`career_public/{eventoId}`, PR 7, docs/54 §2.8).
 *
 * PURO (sem React, sem Firebase). A vitrine é uma CÓPIA ESCOLHIDA de um torneio
 * de fora, que só o SERVIDOR grava (`functions/careerPublic.js`). O id do
 * documento é o id do `career_events` (`{uid}_{sufixo}`). Aqui ficam:
 *  - a projeção (`showcaseItem`): a LISTA FECHADA de campos que podem ser
 *    públicos. Anotação, link, custo, meta, foco, balanço e a visão da dupla
 *    (crítica) NUNCA entram — não há caminho para elas. Cópia no servidor
 *    (`functions/careerPublicPolicy.js`) com teste de paridade;
 *  - o nome da dupla só com o CONSENTIMENTO dela (`partners` traz só quem
 *    consentiu); sem ele, a participação diz "com dupla", sem nome;
 *  - o que a tela deriva: ordem, parabéns por troféu de fora (kudo, sem conta
 *    de pontos nova) e as PARCERIAS (quem mais jogou junto, das participações
 *    com o nome publicado — ou seja, confirmadas e consentidas).
 *
 * O resultado aqui é DECLARADO: nunca pontua (guarda `carreiraNaoPontua`).
 */
import { isAdult } from './careerPartner.js';

export const CAREER_PUBLIC = 'career_public';

/** Até 20 torneios publicados e 6 fotos na vitrine inteira (a pessoa escolhe quais). */
export const SHOWCASE_LIMITS = Object.freeze({ items: 20, photos: 6, partnerships: 5 });

/** Os campos do torneio que vão à vitrine. Nada fora daqui. */
export const SHOWCASE_EVENT_FIELDS = Object.freeze([
  'name', 'start_date', 'end_date', 'date_precision', 'city', 'state',
  'federated', 'federation_name', 'federation_acronym', 'stage_tier',
]);
/** Os campos de cada participação que vão à vitrine (a dupla é tratada à parte). */
export const SHOWCASE_ENTRY_FIELDS = Object.freeze([
  'format', 'gender', 'age', 'age_label', 'level_bracket', 'level_label', 'placement', 'placement_n',
]);

const vazio = (v) => v === undefined || v === null || v === '';

/**
 * A projeção pública de um torneio de fora.
 * @param {object} event  o `career_events` (com `id` e `uid`)
 * @param {{ seal: string, partners?: Record<string, { name: string, photo_url?: string|null }>, photos?: object[] }} opts
 *   `partners`: só as duplas que CONSENTIRAM (confirmadas, maiores, com o "sim" delas).
 */
export function showcaseItem(event, { seal, partners = {}, photos = [] } = {}) {
  const ev = event || {};
  const out = { uid: ev.uid, event_id: ev.id, seal: ['official', 'confirmed'].includes(seal) ? seal : 'declared' };
  // O selo Oficial confere só que a pessoa JOGOU o torneio da plataforma: a colocação
  // declarada não vai junto (a oficial é a do pódio, na estante). docs/54 §7.
  const oficial = out.seal === 'official';
  SHOWCASE_EVENT_FIELDS.forEach((k) => { if (!vazio(ev[k])) out[k] = ev[k]; });
  out.entries = (Array.isArray(ev.entries) ? ev.entries : []).slice(0, 6).map((e) => {
    const x = {};
    SHOWCASE_ENTRY_FIELDS.forEach((k) => { if (e && !vazio(e[k]) && !(oficial && k.startsWith('placement'))) x[k] = e[k]; });
    if (e && e.format === 'doubles' && e.partner && !vazio(e.partner.name)) {
      const p = e.partner.uid ? partners[e.partner.uid] : null;
      if (p && p.name) x.partner = { uid: e.partner.uid, name: String(p.name).slice(0, 80), photo_url: p.photo_url || null };
      else x.with_partner = true;
    }
    return x;
  });
  // Quem aparece com NOME: a exclusão de conta acha a vitrine de OUTRA pessoa por aqui, sem depender de gatilho.
  out.named_uids = [...new Set(out.entries.map((x) => x.partner && x.partner.uid).filter(Boolean))];
  out.photos = (photos || []).slice(0, SHOWCASE_LIMITS.photos).map((p) => ({
    path: p.path, url: p.url, kind: p.kind || 'other', alt: String(p.alt || '').slice(0, 140),
  }));
  return out;
}

/**
 * A cópia pública de uma foto: `carreira-publica/{uid}/{evento}__{arquivo}`.
 * O caminho privado de origem NÃO vai ao documento público: sai do nome.
 */
export const publicPhotoPath = (uid, eventId, srcPath, nonce = '') => `carreira-publica/${uid}/${eventId}__${nonce ? `${nonce}__` : ''}${String(srcPath).split('/').pop()}`;

/**
 * O torneio PODE ir à vitrine? Já jogado (nem planejado — também o planejado cuja
 * data passou e ainda espera o "Como foi?" —, nem cancelado), com a data até hoje
 * e que não seja o plano de um torneio do PickleRush (lá vale o oficial).
 * A tela e o servidor perguntam a mesma coisa (cópia com paridade).
 */
export function canShowcaseEvent(ev, today) {
  return Boolean(ev) && ev.status !== 'cancelled' && ev.status !== 'planned' && !ev.planned_passed
    && Boolean(ev.start_date) && String(ev.start_date) <= String(today) && !String(ev.origin_ref || '').startsWith('tor:');
}
export function sourceOfPublicPhoto(uid, path) {
  const nome = String(path || '').split('/').pop();
  const i = nome.lastIndexOf('__');
  return i > 0 ? `carreira/${uid}/${nome.slice(i + 2)}` : '';
}

/** As fotos da ficha que PODEM ir à vitrine: da pasta da própria pessoa e com descrição (o `alt` é obrigatório). */
export function publishablePhotos(event) {
  const uid = event?.uid;
  return (event?.photos || []).filter((p) => uid && String(p?.path || '').startsWith(`carreira/${uid}/`) && String(p?.alt || '').trim());
}

/** Só maior de 18 publica (nascimento desconhecido conta como menor). O servidor confere de novo. */
export const canPublishShowcase = (profile, today) => isAdult(profile?.birth_date, today);

/** A vitrine em ordem: do torneio mais novo ao mais antigo. */
export function sortShowcase(items) {
  return [...(items || [])].sort((a, b) => String(b.start_date || '').localeCompare(String(a.start_date || '')));
}

const POS = Object.freeze({ champion: 1, runner_up: 2, third: 3 });

/**
 * `contextId` do kudo de parabéns por um troféu de fora: um por participação
 * no pódio (`trofeu:ext:{evento}:{participação}:{posição}`). É o kudo `positive`
 * de sempre — a mesma máquina de XP e antifarm; nenhuma conta de pontos nova.
 */
export function showcaseTrophyContextId(item, entryIndex) {
  const pos = POS[item?.entries?.[entryIndex]?.placement];
  return pos && item?.event_id ? `trofeu:ext:${item.event_id}:${entryIndex}:${pos}` : '';
}

/** O degrau do pódio de uma participação (1, 2, 3) ou `null`. */
export const showcasePodium = (entry) => POS[entry?.placement] || null;

/**
 * PARCERIAS: com quem a pessoa mais jogou, contando só as participações em que
 * o nome da dupla está na vitrine (a dupla confirmou e consentiu). Lista que não
 * carregou chega `undefined` e volta `undefined` — nunca "nenhuma parceria".
 * `[{ uid, name, photo_url, together }]`, quem mais jogou primeiro.
 */
export function showcasePartnerships(items, limit = SHOWCASE_LIMITS.partnerships) {
  if (!Array.isArray(items)) return undefined;
  const m = new Map();
  items.forEach((it) => (it?.entries || []).forEach((e) => {
    const p = e?.partner;
    if (!p?.uid || !p.name) return;
    if (!m.has(p.uid)) m.set(p.uid, { uid: p.uid, name: p.name, photo_url: p.photo_url || null, eventos: new Set() });
    m.get(p.uid).eventos.add(it.event_id);
  }));
  return [...m.values()]
    .map((p) => ({ uid: p.uid, name: p.name, photo_url: p.photo_url, together: p.eventos.size }))
    .sort((a, b) => b.together - a.together || a.name.localeCompare(b.name))
    .slice(0, limit);
}
