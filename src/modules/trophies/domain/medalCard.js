/**
 * O CARTÃO de campeões/medalhistas: tudo o que está escrito nele sai daqui —
 * a tela só desenha. Puro, sem React.
 *
 * Um cartão é de UM degrau (campeões, vice, 3º) ou do PÓDIO inteiro. As
 * pessoas aparecem com nome e, se tiverem foto e quem gera quiser, com a foto.
 */
import { PODIUM_PLACE } from '@/modules/tournament/domain/podium.js';
import { instanteDoDiaEmMs } from '@/core/domain/instant.js';
import { t, tk, fmtData, fmtLista } from '@/core/i18n';

/** "12 de outubro de 2026" — a partir de qualquer instante do banco. */
export function dataPorExtenso(valor) {
  const ms = instanteDoDiaEmMs(valor);
  if (!Number.isFinite(ms) || ms <= 0) return '';
  return fmtData(new Date(ms), { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Os dizeres de cada degrau — a frase que o cartão diz ao mundo. */
export const PLACE_SAYINGS = Object.freeze({
  1: [tk('Campeões não nascem na final. Chegam nela.'), tk('Quem chega ao topo levou a quadra inteira junto.'), tk('Título conquistado ponto a ponto.')],
  2: [tk('A um ponto do topo — e a uma temporada de voltar.'), tk('Vice é quem fez a final valer a pena.'), tk('Chegou à final. Poucos chegam.')],
  3: [tk('Pódio é para quem não desiste na terceira rodada.'), tk('Bronze de quem jogou até o fim.'), tk('Subiu no pódio. O resto da chave assistiu.')],
});

/** A frase do degrau, estável para a mesma conquista (não troca a cada abertura). */
export function placeSaying(position, seed = '') {
  const lista = PLACE_SAYINGS[position] || PLACE_SAYINGS[3];
  let h = 0;
  for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return t(lista[h % lista.length]);
}

export const CARD_MODE = Object.freeze({ PLACE: 'degrau', PODIUM: 'podio' });

const nomeCurto = (p) => String(p?.name || t('Atleta')).trim();

/**
 * O modelo de um cartão.
 *
 * @param {{
 *   mode?: 'degrau'|'podio',
 *   position?: 1|2|3,
 *   places: Array<{ position: number, label: string, entries: Array<{ label: string, people: Array<{ user_id, name, photo_url }> }> }>,
 *   event: { title: string, subtitle?: string, date?: *, city?: string, state?: string, kind: 'torneio'|'dia_de_jogo' },
 *   host?: { name?: string, logo?: string|null, kind?: 'arena'|'clube' }|null,
 *   showPhotos?: boolean,
 *   origin?: string,
 *   link?: string|null,
 * }} input
 */
export function buildMedalCard(input = {}) {
  const mode = input.mode === CARD_MODE.PODIUM ? CARD_MODE.PODIUM : CARD_MODE.PLACE;
  const places = (input.places || []).filter((p) => p && [1, 2, 3].includes(p.position));
  const degrau = mode === CARD_MODE.PLACE
    ? places.find((p) => p.position === (input.position || 1)) || places[0] || null
    : null;
  const event = input.event || {};
  const showPhotos = input.showPhotos !== false;

  const pessoasDe = (place) => (place?.entries || []).flatMap((e) => e.people || []).map((p) => ({
    ...p, name: nomeCurto(p), photo_url: showPhotos && p.photo_url ? p.photo_url : null,
  }));

  const linhas = places.map((p) => ({
    position: p.position,
    label: p.label || t(PODIUM_PLACE[p.position].um),
    short: t(PODIUM_PLACE[p.position].curto),
    names: (p.entries || []).map((e) => e.label || (e.people || []).map(nomeCurto).join(' / ')),
    people: pessoasDe(p),
  }));

  const pessoas = degrau ? pessoasDe(degrau) : linhas.flatMap((l) => l.people);
  const nomes = degrau ? (degrau.entries || []).map((e) => e.label || (e.people || []).map(nomeCurto).join(' / ')) : [];

  const headline = degrau
    ? (degrau.label || t(PODIUM_PLACE[degrau.position].um))
    : t('Pódio');
  const saying = degrau
    ? placeSaying(degrau.position, `${event.title}|${event.subtitle}|${degrau.position}`)
    : t('Três degraus, um dia inteiro de pickleball.');
  const dateLabel = dataPorExtenso(event.date);
  const where = [event.city, event.state].filter(Boolean).join(' · ');
  const hostLine = input.host?.name ? (input.host.kind === 'clube' ? t('Clube {nome}', { nome: input.host.name }) : t('Arena {nome}', { nome: input.host.name })) : '';

  const origin = String(input.origin || '').replace(/\/$/, '');
  const url = input.link ? `${origin}${input.link}` : '';

  const quem = degrau ? fmtLista(nomes) : linhas.map((l) => `${l.short}: ${fmtLista(l.names)}`).join(' · ');
  const shareText = [
    degrau ? `🏆 ${headline}: ${quem}` : `🏆 ${t('Pódio')} — ${quem}`,
    `${event.title}${event.subtitle ? ` · ${event.subtitle}` : ''}${dateLabel ? ` · ${dateLabel}` : ''}`,
    // O link vai à parte (`url`): o WhatsApp junta texto + link, e com o link
    // também no texto ele aparecia duas vezes.
    url ? t('Veja no PickleRush:') : t('via PickleRush'),
  ].filter(Boolean).join('\n');

  const slug = `${event.title}-${degrau ? headline : 'podio'}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  return {
    mode, position: degrau?.position || null, headline, saying, dateLabel, where, hostLine,
    event: { title: event.title || t('Torneio'), subtitle: event.subtitle || '', kind: event.kind || 'torneio' },
    host: input.host && (input.host.name || input.host.logo) ? { name: input.host.name || '', logo: input.host.logo || null, kind: input.host.kind || 'arena' } : null,
    people: pessoas, names: nomes, lines: linhas,
    url, shareText, fileName: `picklerush-${slug || 'cartao'}.png`,
    showPhotos: showPhotos && pessoas.some((p) => p.photo_url),
  };
}
