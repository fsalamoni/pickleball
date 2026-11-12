/**
 * A RETROSPECTIVA da temporada (docs/54 §4.7): o cartão com o número de
 * torneios, as medalhas e a melhor parceria do ano. ZERO banco — sai da linha
 * do tempo já montada e das fontes que ela leu. PURO.
 *
 * Quando aparece: na temporada FECHADA (ano anterior) e, na corrente, a partir
 * de 1º de dezembro. Antes disso a tela não promete nada.
 */
import { SEAL, TIMELINE_SOURCE } from './timeline.js';
import { isOutsidePlayed } from './careerEvent.js';

const POS = Object.freeze({ champion: 1, runner_up: 2, third: 3 });
const chave = (nome) => String(nome || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** A retrospectiva da temporada `year` já pode ser oferecida em `today` (AAAA-MM-DD)? */
export function seasonRecapOffered(year, today) {
  const y = Number(String(today).slice(0, 4));
  const m = Number(String(today).slice(5, 7));
  return Number.isFinite(year) && (year < y || (year === y && m >= 12));
}

/**
 * A melhor parceria do ano: quem mais jogou com a pessoa (torneios juntos) e,
 * no empate, mais medalhas juntos. Junta as duplas dos torneios de fora e as
 * dos pódios da plataforma (a única fonte daqui que diz a dupla). O torneio de
 * fora ligado a um pódio da plataforma ("É este") conta uma vez só, e a
 * colocação DIGITADA num torneio ligado nunca vira medalha (a oficial é a do
 * pódio). Plano sem resposta e plano de torneio daqui não são torneio jogado.
 */
export function bestPartnership({ year, career = [], trophies = [], me = {} }) {
  const placar = new Map();
  const somar = (pessoa, evento, medalha) => {
    const k = pessoa.uid || chave(pessoa.name);
    if (!k || (me.uid && pessoa.uid === me.uid)) return;
    if (!placar.has(k)) placar.set(k, { name: String(pessoa.name || '').trim(), uid: pessoa.uid || null, eventos: new Set(), medals: 0 });
    const p = placar.get(k);
    p.eventos.add(evento);
    if (medalha) p.medals += 1;
  };
  const podiosDaqui = new Set();
  (trophies || []).filter((tr) => Number.isFinite(tr?.date) && new Date(tr.date).getFullYear() === year).forEach((tr) => {
    podiosDaqui.add(tr.tournamentId);
    (tr.people || []).forEach((p) => somar({ uid: p.user_id || null, name: p.name }, `t:${tr.tournamentId}`, true));
  });
  (career || [])
    .filter((e) => isOutsidePlayed(e) && Number(String(e.start_date).slice(0, 4)) === year)
    .filter((e) => !(e.platform_tournament_id && podiosDaqui.has(e.platform_tournament_id)))
    .forEach((e) => (e.entries || []).forEach((en) => {
      if (en.partner?.name) somar({ uid: en.partner.uid || null, name: en.partner.name }, `c:${e.id}`, !e.platform_tournament_id && Boolean(POS[en.placement]));
    }));
  // A mesma pessoa pode chegar com conta (pódio daqui, dupla escolhida) e só
  // com o nome (digitado num torneio de fora): junta a entrada só de nome à
  // que tem conta com o mesmo nome.
  const contaPorNome = new Map();
  placar.forEach((p, k) => { if (p.uid && !contaPorNome.has(chave(p.name))) contaPorNome.set(chave(p.name), k); });
  [...placar.entries()].filter(([, p]) => !p.uid).forEach(([k, p]) => {
    const alvo = placar.get(contaPorNome.get(k));
    if (!alvo) return;
    p.eventos.forEach((e) => alvo.eventos.add(e));
    alvo.medals += p.medals;
    placar.delete(k);
  });
  const melhor = [...placar.values()]
    .filter((p) => p.name)
    .sort((a, b) => b.eventos.size - a.eventos.size || b.medals - a.medals || a.name.localeCompare(b.name))[0];
  return melhor ? { name: melhor.name, uid: melhor.uid, together: melhor.eventos.size, medals: melhor.medals } : null;
}

/**
 * O modelo da retrospectiva, ou `null` (ainda não é hora, a temporada não tem
 * nada, ou uma fonte da linha do tempo falhou — número parcial num cartão
 * para compartilhar é número errado).
 *
 * @param {{ season: { year: number, items: object[], summary: object }, faltou?: string[],
 *   career?: object[], trophies?: object[], me?: { uid?: string, name?: string }, today: string }} p
 */
export function buildSeasonRecap({ season, faltou = [], career = [], trophies = [], me = {}, today }) {
  if (!season || faltou.length > 0 || !seasonRecapOffered(season.year, today)) return null;
  const s = season.summary || {};
  if (!s.events) return null;
  return {
    year: season.year,
    // Só torneios: o dia de jogo não é torneio e não entra na retrospectiva.
    tournaments: s.tournaments || 0,
    gold: s.gold || 0,
    silver: s.silver || 0,
    bronze: s.bronze || 0,
    partner: bestPartnership({ year: season.year, career, trophies, me }),
    // Há resultado DECLARADO na conta: o cartão diz isso no rodapé.
    declared: (season.items || []).some((i) => i.source === TIMELINE_SOURCE.CAREER && i.seal === SEAL.DECLARED && !i.cancelled && !i.pending),
  };
}
