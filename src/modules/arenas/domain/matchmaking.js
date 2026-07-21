/**
 * Domínio: Matchmaking (Arena V3 — sprint 1).
 *
 * Score de compatibilidade entre atletas baseado em critérios.
 * Sem I/O, testável.
 */

/**
 * Calcula score 0-100 entre um usuário e um candidato.
 * @param {Object} user - { level, city, state, level_change }
 * @param {Object} candidate - { id, level, city, state, ... }
 * @param {Object} criteria - { min_level_diff, max_level_diff, prefer_same_city, ... }
 * @returns {number} 0-100
 */
export function matchScore(user, candidate, criteria = {}) {
  if (!user || !candidate) return 0;
  if (user.uid === candidate.id || user.uid === candidate.uid) return 0;

  let score = 50;  // base

  // 1. Compatibilidade de nível (peso 40)
  if (Number.isFinite(user.level) && Number.isFinite(candidate.level)) {
    const diff = Math.abs(user.level - candidate.level);
    const minDiff = criteria.min_level_diff ?? 0;
    const maxDiff = criteria.max_level_diff ?? 1.5;

    if (diff < minDiff) {
      score -= 10;  // muito perto é chato (jogo sem desafio)
    } else if (diff > maxDiff) {
      score -= 30;  // muito longe é frustrante
    } else {
      // proporcional à proximidade
      const proximity = 1 - (diff / maxDiff);
      score += 40 * proximity;
    }
  } else {
    // sem info de nível, neutro
    score += 0;
  }

  // 2. Mesma cidade (peso 20)
  if (criteria.prefer_same_city !== false) {
    if (user.city && candidate.city && user.city === candidate.city) {
      score += 20;
    } else if (user.state && candidate.state && user.state === candidate.state) {
      score += 10;
    }
  }

  // 3. Mesmo formato preferido (peso 10)
  if (Array.isArray(user.preferred_formats) && Array.isArray(candidate.preferred_formats)) {
    const intersection = user.preferred_formats.filter((f) => candidate.preferred_formats.includes(f));
    if (intersection.length > 0) {
      score += 10;
    }
  }

  // 4. Mesmo objetivo (peso 10)
  if (user.objective && candidate.objective && user.objective === candidate.objective) {
    score += 10;
  }

  // 5. Penalidade por ser novo (sem histórico)
  if (Number.isFinite(candidate.matches_played) && candidate.matches_played < 5) {
    score -= 10;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Filtra candidatos que passam os critérios mínimos.
 */
export function matchesCriteria(user, candidate, criteria = {}) {
  if (!user || !candidate) return false;
  if (user.uid === candidate.id || user.uid === candidate.uid) return false;

  // Diferença de nível dentro do range
  if (Number.isFinite(user.level) && Number.isFinite(candidate.level)) {
    const diff = Math.abs(user.level - candidate.level);
    const maxDiff = criteria.max_level_diff ?? 1.5;
    if (diff > maxDiff) return false;
    if ((criteria.min_level_diff ?? 0) > diff) return false;
  }

  // Cidade preferida
  if (criteria.city) {
    if (candidate.city !== criteria.city && candidate.state !== criteria.city) return false;
  }

  // Estado
  if (criteria.state) {
    if (candidate.state !== criteria.state) return false;
  }

  // Formato
  if (criteria.format && Array.isArray(candidate.preferred_formats)) {
    if (!candidate.preferred_formats.includes(criteria.format)) return false;
  }

  return true;
}

/**
 * Ordena uma lista de candidatos por score (desc).
 */
export function sortByMatchScore(user, candidates, criteria = {}) {
  if (!Array.isArray(candidates)) return [];
  return candidates
    .filter((c) => matchesCriteria(user, c, criteria))
    .map((c) => ({ ...c, _score: matchScore(user, c, criteria) }))
    .sort((a, b) => b._score - a._score);
}

/**
 * Retorna top N sugestões.
 */
export function topMatches(user, candidates, criteria = {}, n = 10) {
  return sortByMatchScore(user, candidates, criteria).slice(0, n);
}

/**
 * Label descritivo do score.
 */
export function scoreLabel(score) {
  if (score >= 80) return 'Excelente match';
  if (score >= 60) return 'Bom match';
  if (score >= 40) return 'Match ok';
  if (score >= 20) return 'Match fraco';
  return 'Sem match';
}

/**
 * Cor sugerida para badge do score.
 */
export function scoreTone(score) {
  if (score >= 80) return 'green';
  if (score >= 60) return 'blue';
  if (score >= 40) return 'amber';
  return 'gray';
}

/**
 * Valida critérios de busca.
 */
export function normalizeMatchmakingCriteria(input = {}) {
  const errors = {};
  const value = {
    min_level_diff: 0,
    max_level_diff: 1.5,
    prefer_same_city: true,
    ...input,
  };

  if (value.min_level_diff < 0 || value.min_level_diff > 5) {
    errors.min_level_diff = 'Deve ser entre 0 e 5.';
  }
  if (value.max_level_diff < 0 || value.max_level_diff > 5) {
    errors.max_level_diff = 'Deve ser entre 0 e 5.';
  }
  if (value.min_level_diff > value.max_level_diff) {
    errors.max_level_diff = 'Máximo deve ser maior que mínimo.';
  }

  return { valid: Object.keys(errors).length === 0, errors, value };
}
