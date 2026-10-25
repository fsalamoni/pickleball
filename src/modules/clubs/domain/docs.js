/**
 * ACERVO DO CLUBE-ASSOCIAÇÃO (Bloco D2) — lógica pura. O documento, os arquivos e as
 * relações são os da federação (`modules/federations/domain/acervo.js`); o clube só
 * usa uma lista MENOR de tipos e mostra o que a pessoa pode ler pela marca que o
 * servidor mantém (`pub`/`members`).
 *
 * ⚠️ CÓPIA de `functions/clubDocsPolicy.js` (o pacote de Functions é publicado
 * isolado), com paridade em `functions/clubDocs.parity.test.js`. Os ids de tipo são
 * GRAVADOS: nunca renomeie.
 */
import { DOC_CATEGORIES, DOC_STATUS, DOC_TYPES, DOC_VISIBILITY, sortDocs } from '@/modules/federations/domain/acervo';

export const CLUB_DOC_TYPE_IDS = Object.freeze([
  'statute', 'bylaws', 'org_chart', 'bodies', 'ethics_code', 'disciplinary_code', 'disciplinary_decision',
  'game_rules', 'competition_rules', 'specific_rules', 'ranking_rules',
  'resolution', 'ordinance', 'deliberation', 'presidential_act', 'notice', 'official_note', 'errata',
  'convocation', 'minutes', 'attendance', 'vote_record', 'results_bulletin',
  'financial_statements', 'fiscal_opinion', 'management_report', 'agreements', 'leaders_pay', 'planning',
  'video', 'audio', 'gallery', 'annual_calendar',
]);

const TIPOS = new Set(CLUB_DOC_TYPE_IDS);

/** Os tipos que o clube oferece (na ordem do catálogo da federação). */
export const clubDocTypes = () => DOC_TYPES.filter((x) => TIPOS.has(x.id));

/** As categorias que ainda têm algum tipo no clube. */
export const clubDocCategories = () => DOC_CATEGORIES.filter((c) => clubDocTypes().some((x) => x.category === c.id));

/** Mesma conta do servidor: as marcas que a regra lê. */
export function readFlags(status, visibility) {
  const publicado = status === DOC_STATUS.PUBLISHED;
  return { pub: publicado && visibility === DOC_VISIBILITY.PUBLIC, members: publicado && visibility !== DOC_VISIBILITY.STAFF };
}

/**
 * O endereço do documento na página do clube (o aviso, o "copiar link" e o QR levam a ele).
 * `publica`: a vitrine sem login (`/c/:clubId?doc=`), em vez da página do app.
 */
export function clubDocPath(clubId, docId, { publica = false } = {}) {
  const id = encodeURIComponent(clubId);
  if (publica) return `/c/${id}${docId ? `?doc=${encodeURIComponent(docId)}` : ''}`;
  return `/clubes/${id}?tab=documentos${docId ? `&doc=${encodeURIComponent(docId)}` : ''}`;
}

/** O aviso aos associados já saiu para esta versão? */
export const docNotified = (doc) => Number(doc?.notified_version) === (Number(doc?.version) || 1);

/** Dá para avisar os associados? Publicado, não "só a equipe" e ainda não avisado nesta versão. */
export const canNotifyDoc = (doc) => doc?.status === DOC_STATUS.PUBLISHED && doc.visibility !== DOC_VISIBILITY.STAFF && !docNotified(doc);

/** O que um visitante vê: só o publicado (a regra já filtra; isto é para a ordem e para uma lista antiga em cache). */
export const visibleClubDocs = (docs = []) => sortDocs((docs || []).filter((d) => d.status === DOC_STATUS.PUBLISHED));
