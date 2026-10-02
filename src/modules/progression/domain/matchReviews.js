/**
 * matchReviews — a avaliação pós-jogo.
 *
 * Depois do jogo, cada pessoa pode dizer, em segundos, como foi jogar com o
 * companheiro e contra os adversários: de 1 a 5 estrelas e algumas tags. É o
 * que dá reputação ao atleta — "joga limpo", "pontual", "bom companheiro" — e é
 * isso, mais que o rating, que faz alguém querer jogar com você de novo.
 *
 * ## O desenho que evita a crueldade
 *
 *  1. **Tags positivas são o caminho principal.** O que se diz de bom é
 *     específico (pontual, joga limpo); o que se diz de ruim, só quando a
 *     nota é baixa, e nas quatro categorias de ISSUE, nunca em texto livre
 *     contra a pessoa.
 *  2. **Nota baixa precisa de motivo.** 1 ou 2 estrelas exigem ao menos uma
 *     categoria de problema — "justificada", como pede o estudo.
 *  3. **O público só vê o agregado, e só com amostra.** A nota só aparece no
 *     perfil com `minForPublicScore` (padrão 5) avaliações — com 1 avaliação
 *     a "nota" é a opinião de uma pessoa, não uma reputação. A avaliação
 *     individual só é legível por quem a escreveu e pelo admin: o avaliado vê
 *     o agregado, nunca "quem deu quanto". E não há texto livre — estrelas,
 *     elogios e categorias de problema bastam, sem abrir espaço para ataque.
 *  4. **O servidor confere.** Só vale avaliação de quem jogou aquela partida,
 *     uma por par; o servidor agrega e marca como suspeita a combinação "1★
 *     de um lado, 5★ do outro" (vingança) e o padrão de uma pessoa que só dá
 *     nota máxima a um mesmo grupo (troca de favores).
 *
 * Lógica pura, sem I/O.
 */

/** Tags positivas — o id é contrato (está no documento). */
export const REVIEW_TAGS = Object.freeze({
  companheiro: { label: 'Bom companheiro', emoji: '🤝' },
  educado: { label: 'Educado', emoji: '🙂' },
  justo: { label: 'Joga limpo', emoji: '⚖️' },
  pontual: { label: 'Pontual', emoji: '⏰' },
  esportista: { label: 'Bom esportista', emoji: '🏅' },
  energia: { label: 'Energia boa', emoji: '⚡' },
});

/** Categorias de problema — só aparecem quando a nota é baixa. */
export const REVIEW_ISSUES = Object.freeze({
  conduta: { label: 'Conduta', emoji: '🚫' },
  pontualidade: { label: 'Atraso ou falta', emoji: '⌛' },
  comunicacao: { label: 'Comunicação', emoji: '💬' },
  esportividade: { label: 'Esportividade', emoji: '🎾' },
});

export const REVIEW_MAX_TAGS = 4;
export const LOW_RATING = 2;

/**
 * Quem pode ser avaliado numa partida: os outros jogadores, com a relação
 * (companheiro/adversário). Convidado sem conta não tem como receber.
 *
 * @param {{ partnerUids?: string[], opponentUids?: string[] }} record
 * @param {string} myUid
 * @returns {Array<{ uid: string, relation: 'partner'|'opponent' }>}
 */
export function reviewableTargets(record, myUid) {
  const out = [];
  const vistos = new Set([myUid]);
  (record?.partnerUids || []).forEach((u) => {
    if (u && !vistos.has(u)) { vistos.add(u); out.push({ uid: u, relation: 'partner' }); }
  });
  (record?.opponentUids || []).forEach((u) => {
    if (u && !vistos.has(u)) { vistos.add(u); out.push({ uid: u, relation: 'opponent' }); }
  });
  return out;
}

/** Id determinístico: uma avaliação por partida e por par (autor → avaliado). */
export function reviewDocId(matchKey, fromUid, toUid) {
  return `${String(matchKey).replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 90)}__${fromUid}__${toUid}`;
}

/**
 * Valida e normaliza uma avaliação antes de gravar.
 * @returns {{ ok: true, value: object } | { ok: false, error: string }}
 */
export function validateReview({ fromUid, toUid, matchKey, rating, tags = [], issues = [], relation = null } = {}) {
  if (!fromUid || !toUid || fromUid === toUid) return { ok: false, error: 'Não dá para avaliar a si mesmo.' };
  if (!matchKey) return { ok: false, error: 'Informe o jogo avaliado.' };
  const nota = Math.round(Number(rating));
  if (!(nota >= 1 && nota <= 5)) return { ok: false, error: 'Escolha de 1 a 5 estrelas.' };
  const tagsOk = [...new Set(tags)].filter((t) => REVIEW_TAGS[t]).slice(0, REVIEW_MAX_TAGS);
  const issuesOk = [...new Set(issues)].filter((t) => REVIEW_ISSUES[t]).slice(0, REVIEW_MAX_TAGS);
  if (nota <= LOW_RATING && issuesOk.length === 0) {
    return { ok: false, error: 'Para uma nota baixa, escolha ao menos um motivo.' };
  }
  return {
    ok: true,
    value: {
      fromUid, toUid, matchKey, rating: nota,
      // nota alta não carrega "problema"; nota baixa não carrega elogio
      tags: nota >= 3 ? tagsOk : [],
      issues: nota <= 3 ? issuesOk : [],
      relation: relation === 'partner' || relation === 'opponent' ? relation : null,
    },
  };
}

/**
 * As avaliações que a pessoa ainda pode fazer: jogos recentes, com alguém a
 * avaliar, que ela ainda não avaliou.
 *
 * @param {Array<{ matchKey: string, at: number, partnerUids?: string[], opponentUids?: string[], label?: string }>} records
 * @param {Array<{ matchKey: string, toUid: string }>} myReviews
 * @param {{ now?: number, windowDays?: number, uid: string, max?: number }} opts
 * @returns {Array<{ matchKey: string, at: number, label?: string, targets: Array<{ uid: string, relation: string }> }>}
 */
export function pendingReviews(records, myReviews, { now = Date.now(), windowDays = 14, uid, max = 5 } = {}) {
  const feitas = new Set((myReviews || []).map((r) => `${r.matchKey}__${r.toUid}`));
  const limite = now - windowDays * 86_400_000;
  return (records || [])
    .filter((r) => r?.matchKey && Number(r.at) >= limite && Number(r.at) <= now)
    .map((r) => ({
      matchKey: r.matchKey,
      at: Number(r.at),
      label: r.label,
      targets: reviewableTargets(r, uid).filter((t) => !feitas.has(`${r.matchKey}__${t.uid}`)),
    }))
    .filter((r) => r.targets.length > 0)
    .sort((a, b) => b.at - a.at)
    .slice(0, max);
}

/**
 * Agrega as avaliações RECEBIDAS por uma pessoa. O servidor faz o mesmo para o
 * número público; a tela usa esta para a visão do próprio atleta.
 *
 * @param {Array<{ rating: number, tags?: string[], issues?: string[] }>} reviews
 * @param {{ minForPublicScore?: number, minTagVotes?: number }} [opts]
 */
export function aggregateReviews(reviews, { minForPublicScore = 5, minTagVotes = 3 } = {}) {
  const lista = Array.isArray(reviews) ? reviews.filter((r) => Number(r?.rating) >= 1 && Number(r?.rating) <= 5) : [];
  const count = lista.length;
  const soma = lista.reduce((s, r) => s + Number(r.rating), 0);
  const tagCounts = {};
  lista.forEach((r) => (r.tags || []).forEach((t) => { if (REVIEW_TAGS[t]) tagCounts[t] = (tagCounts[t] || 0) + 1; }));
  const topTags = Object.entries(tagCounts)
    .filter(([, n]) => n >= minTagVotes)
    .sort((a, b) => b[1] - a[1])
    .map(([tag, n]) => ({ tag, count: n }));
  return {
    count,
    average: count >= minForPublicScore ? Math.round((soma / count) * 10) / 10 : null,
    publicScore: count >= minForPublicScore,
    remainingForScore: Math.max(0, minForPublicScore - count),
    fiveStarCount: lista.filter((r) => Number(r.rating) === 5).length,
    topTags,
  };
}

/**
 * Pares suspeitos para a revisão humana: A deu 1–2★ a B e B deu 5★ a A no
 * mesmo jogo (vingança ou combinação). Nunca pune sozinho.
 *
 * @param {Array<{ matchKey: string, fromUid: string, toUid: string, rating: number }>} reviews
 * @returns {Array<{ matchKey: string, a: string, b: string, kind: 'retaliation' }>}
 */
export function suspiciousPairs(reviews) {
  const porChave = new Map();
  (reviews || []).forEach((r) => porChave.set(`${r.matchKey}|${r.fromUid}|${r.toUid}`, r));
  const out = [];
  const vistos = new Set();
  (reviews || []).forEach((r) => {
    const volta = porChave.get(`${r.matchKey}|${r.toUid}|${r.fromUid}`);
    if (!volta) return;
    const par = [r.fromUid, r.toUid].sort().join('|') + r.matchKey;
    if (vistos.has(par)) return;
    const baixa = Number(r.rating) <= LOW_RATING && Number(volta.rating) === 5;
    const baixaVolta = Number(volta.rating) <= LOW_RATING && Number(r.rating) === 5;
    if (baixa || baixaVolta) {
      vistos.add(par);
      out.push({ matchKey: r.matchKey, a: r.fromUid, b: r.toUid, kind: 'retaliation' });
    }
  });
  return out;
}
