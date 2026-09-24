/**
 * A lista ÚNICA de professores de uma arena.
 *
 * A arena tinha DOIS cadastros de professor, sem ligação entre eles:
 *
 * - **parceiros da plataforma** (`coach_arenas` → perfil em `coaches/{uid}`):
 *   o professor tem perfil público, aparece na busca, e a arena o divulga;
 * - **quem dá aula aqui** (`arena_coaches`, módulo de aulas): o professor das
 *   aulas da agenda, com comissão, e que pode nem ter conta.
 *
 * O mesmo professor parceiro que dá aula na arena virava dois registros, e o
 * formulário de aulas nem oferecia os parceiros — buscava no diretório de
 * atletas. Aqui os dois se juntam pela conta da pessoa
 * (`arena_coaches.user_id` = `coach_arenas.coach_id` = uid), e cada linha diz
 * o que a pessoa é na arena.
 *
 * PURO. Sem I/O.
 */

/** Estado da parceria, em pt-BR. `pending` é convite ainda não aceito. */
export const PARTNERSHIP_LABEL = Object.freeze({
  active: 'Ativo',
  paused: 'Pausado',
  pending: 'Aguardando o professor aceitar',
});

/** A parceria sem status (documento antigo) vale como ativa. */
export function partnershipStatus(partner) {
  const s = partner?.residency?.status || 'active';
  return PARTNERSHIP_LABEL[s] ? s : 'active';
}

const nomeDe = (p, c) => String(c?.name || p?.display_name || '').trim() || 'Professor';

/**
 * Junta parceiros da plataforma e professores das aulas numa lista só.
 *
 * @param {Array} partners      saída de `listArenaCoaches` (coaches): perfil + `residency`
 * @param {Array} arenaCoaches  documentos de `arena_coaches`
 * @returns {Array<{
 *   key: string, uid: string|null, name: string, photo: string|null,
 *   partner: object|null, partnership: string|null,
 *   arenaCoach: object|null, teaches: boolean, house: boolean,
 *   canEnableClasses: boolean,
 * }>}  em ordem alfabética
 */
export function mergeCoachRoster(partners = [], arenaCoaches = []) {
  const porUid = new Map();
  const linhas = [];

  (partners || []).forEach((p) => {
    if (!p?.id) return;
    const linha = {
      key: `u_${p.id}`,
      uid: p.id,
      partner: p,
      arenaCoach: null,
    };
    porUid.set(p.id, linha);
    linhas.push(linha);
  });

  (arenaCoaches || []).forEach((c) => {
    if (!c?.id) return;
    const uid = c.user_id || null;
    if (uid && porUid.has(uid)) {
      porUid.get(uid).arenaCoach = c;
      return;
    }
    const linha = { key: uid ? `u_${uid}` : `c_${c.id}`, uid, partner: null, arenaCoach: c };
    if (uid) porUid.set(uid, linha);
    linhas.push(linha);
  });

  return linhas
    .map((l) => ({
      ...l,
      name: nomeDe(l.partner, l.arenaCoach),
      photo: l.arenaCoach?.photo_url || l.partner?.photo_url || null,
      partnership: l.partner ? partnershipStatus(l.partner) : null,
      teaches: Boolean(l.arenaCoach && l.arenaCoach.active !== false),
      // "Da casa" é quem dá aula e NÃO paga comissão.
      house: Boolean(l.arenaCoach && !l.arenaCoach.partner),
      // Parceiro que ainda não está nas aulas: um clique o coloca na agenda.
      // Parceria pendente ainda não — o professor nem aceitou ser parceiro.
      canEnableClasses: Boolean(l.partner && !l.arenaCoach && partnershipStatus(l.partner) === 'active'),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

function precoDoPerfil(p) {
  const bruto = p?.hourly_rate ?? p?.price_per_hour;
  if (bruto === null || bruto === undefined || bruto === '') return 0;
  const n = Number(bruto);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * O documento de `arena_coaches` para habilitar um parceiro nas aulas.
 *
 * Parceiro da plataforma é professor de FORA: paga comissão (`partner: true`).
 * Vem com a conta vinculada (`user_id`), que é o que faz a agenda dele
 * aparecer em "Minhas aulas" e ele ser reconhecido como professor nas telas.
 */
export function arenaCoachFromPartner(partner) {
  return {
    name: String(partner?.display_name || '').trim() || 'Professor',
    photo_url: String(partner?.photo_url || '').trim(),
    user_id: partner?.id || null,
    partner: true,
    bio: String(partner?.bio || '').trim().slice(0, 1000),
    // O perfil de professor da plataforma guarda o valor em `hourly_rate`.
    price_per_hour: precoDoPerfil(partner),
    specialties: Array.isArray(partner?.modalities) ? partner.modalities.slice(0, 10) : [],
    active: true,
  };
}

/**
 * Status para gravar ao PAUSAR e ao RETOMAR uma parceria.
 *
 * 🐞 Retomar gravava sempre `active`: um convite PENDENTE, pausado e
 * retomado, virava parceria ativa sem o professor nunca ter aceitado. Pausar
 * guarda o estado anterior; retomar devolve exatamente ele.
 */
export function partnershipToggle(residency = {}) {
  const atual = residency?.status || 'active';
  if (atual === 'paused') {
    const volta = residency?.status_before_pause === 'pending' ? 'pending' : 'active';
    return { status: volta, status_before_pause: null };
  }
  return { status: 'paused', status_before_pause: atual === 'pending' ? 'pending' : 'active' };
}

/**
 * Quem aparece na página PÚBLICA da arena.
 *
 * Parceiro só com a parceria ATIVA (convite pendente ou parceria pausada não
 * é divulgado — o professor nem aceitou, ou a arena suspendeu), e professor
 * das aulas só se estiver ativo. Cada linha diz para onde o toque leva: quem
 * tem perfil de professor na plataforma vai ao perfil; quem só dá aula aqui,
 * à agenda de aulas.
 *
 * @param {Array} rows  saída de `mergeCoachRoster`
 */
export function publicCoachRoster(rows = []) {
  return (rows || [])
    .filter((r) => (r.partner && r.partnership === 'active') || r.teaches)
    .map((r) => ({
      ...r,
      profileLink: r.partner && r.partnership === 'active' ? `/coaches/${r.uid}` : null,
    }));
}
