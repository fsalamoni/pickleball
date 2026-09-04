/**
 * Tiers do jogador (lógica pura, sem I/O).
 *
 * Cada tier é um "andar" da jornada do usuário na plataforma. Tem nome,
 * cor, ícone, threshold de XP cumulativo e tom visual.
 *
 * **O QUE MUDA vs hoje**:
 *  - Hoje: o usuário vê "Nível 4 · 3020 XP" — número genérico.
 *  - Com tiers: o usuário vê "Nível 4 · Aprendiz · 🌿" — identidade clara.
 *
 * **O QUE NÃO MUDA**:
 *  - Schema de `users/{uid}` (campos novos são opcionais e aditivos).
 *  - Função `levelFromXp` V1.
 *  - A UI atual continua mostrando "Nível X" se a flag `TIERS_NAMED` estiver OFF.
 *
 * Aditivo. Sem I/O. Sem breaking change.
 */

/**
 * @typedef {Object} Tier
 * @property {number}  tier        — número do tier (1, 2, 3, ...)
 * @property {number}  level       — nível "base" onde o tier começa
 * @property {string}  name        — nome do tier em pt-BR
 * @property {string}  icon        — emoji/ícone representativo
 * @property {number}  threshold   — XP cumulativo mínimo para entrar no tier
 * @property {string}  color       — tom visual (token do design system)
 * @property {string}  description — frase curta que descreve o tier
 * @property {string}  tag         — slug para URL/cookie/analytics
 */

/**
 * Tabela de tiers (V2). Congelada.
 *
 * Critério de design:
 *  - Tier 1 (Calouro) = até 2.000 XP — usuário novo, está descobrindo
 *  - Tier 2 (Aprendiz/Jogador) = 2.000–12.000 XP — começa a se engajar
 *  - Tier 3 (Veterano/Expert) = 12.000–35.000 XP — user ativo e experiente
 *  - Tier 4 (Elite/Lenda) = 35.000–100.000 XP — user influente
 *  - Tier 5 (Imortal) = 100.000+ XP — top 0.1% da plataforma
 *
 * Os thresholds batem com `levelFromXp` (mesma curva 500*L). Por exemplo:
 *  - Tier "Aprendiz" começa no Nível 4, que exige 3.000 XP cumulativo.
 *    threshold 2.000 é "preemptivo" (entra no tier com 2k, mesmo que o
 *    nível 4 só "oficialmente" apareça em 3k).
 *  - Justificativa: o tier é mais sobre **percepção de progresso** que
 *    sobre o número exato do nível.
 */
export const TIERS = Object.freeze([
  {
    tier: 1,
    level: 1,
    name: 'Calouro',
    icon: '🌱',
    threshold: 0,
    color: 'gray',
    tag: 'rookie',
    description: 'Primeiros passos na plataforma. Descobrindo o que é o pickleball.',
  },
  {
    tier: 1,
    level: 4,
    name: 'Aprendiz',
    icon: '🌿',
    threshold: 2000,
    color: 'green',
    tag: 'apprentice',
    description: 'Já se encontrou. Começa a frequentar arenas e entrar em clubes.',
  },
  {
    tier: 2,
    level: 7,
    name: 'Jogador',
    icon: '🏓',
    threshold: 6000,
    color: 'teal',
    tag: 'player',
    description: 'Tem jogo frequente. Conhece gente, frequenta quadras, sabe se virar.',
  },
  {
    tier: 2,
    level: 10,
    name: 'Regular',
    icon: '🏸',
    threshold: 12000,
    color: 'cyan',
    tag: 'regular',
    description: 'Já é parte da cena. Participa de torneios, tem rivais, segue a comunidade.',
  },
  {
    tier: 3,
    level: 14,
    name: 'Veterano',
    icon: '🎖️',
    threshold: 22000,
    color: 'blue',
    tag: 'veteran',
    description: 'Mais de 1 ano de plataforma. Reconhecido pela comunidade.',
  },
  {
    tier: 3,
    level: 18,
    name: 'Expert',
    icon: '⭐',
    threshold: 35000,
    color: 'indigo',
    tag: 'expert',
    description: 'Domina várias modalidades. Sobe rating consistentemente.',
  },
  {
    tier: 4,
    level: 22,
    name: 'Elite',
    icon: '💎',
    threshold: 50000,
    color: 'purple',
    tag: 'elite',
    description: 'Top 1% da plataforma. As pessoas conhecem seu nome.',
  },
  {
    tier: 4,
    level: 26,
    name: 'Lenda',
    icon: '👑',
    threshold: 70000,
    color: 'pink',
    tag: 'legend',
    description: 'Hall da Fama provável. Sua história virou referência.',
  },
  {
    tier: 5,
    level: 30,
    name: 'Imortal',
    icon: '🔥',
    threshold: 100000,
    color: 'amber',
    tag: 'immortal',
    description: 'Top 0.1%. 100 mil XP. Modelo pra toda a comunidade.',
  },
]);

/**
 * Nomes oficiais dos tiers, na ordem de progressão.
 *
 * FONTE ÚNICA DE VERDADE: o schema persistido (`progressionV2Schema`), as
 * regras do Firestore e o Hall da Fama derivam desta lista. Não redigite os
 * nomes em outro lugar — a divergência entre esta tabela e cópias manuais já
 * impediu qualquer usuário acima de 12.000 XP de salvar sua progressão.
 *
 * Ao mexer aqui, atualize também `firestore.rules` (match /user_progression_v2).
 *
 * @type {readonly string[]}
 */
export const TIER_NAMES = Object.freeze(TIERS.map((t) => t.name));

/**
 * Retorna o tier atual do usuário baseado no XP cumulativo.
 *
 * @param {number} xp — XP total
 * @returns {Tier} o tier atual
 */
export function tierFromXp(xp) {
  const total = Math.max(0, Math.floor(Number(xp) || 0));
  // TIERS é crescente em threshold, então percorremos do último ao primeiro
  for (let i = TIERS.length - 1; i >= 0; i -= 1) {
    if (total >= TIERS[i].threshold) return TIERS[i];
  }
  return TIERS[0];
}

/**
 * Retorna o próximo tier após o atual.
 *
 * @param {Tier} currentTier
 * @returns {Tier|null} próximo tier, ou null se já está no topo
 */
export function nextTier(currentTier) {
  if (!currentTier) return TIERS[1] || null;
  const idx = TIERS.findIndex((t) => t.tier === currentTier.tier && t.level === currentTier.level);
  if (idx < 0 || idx === TIERS.length - 1) return null;
  return TIERS[idx + 1];
}

/**
 * Calcula o progresso até o próximo tier (0–1).
 *
 * @param {number} xp
 * @returns {{ current: Tier, next: Tier|null, progress: number, xpIntoTier: number, xpForNextTier: number }}
 */
export function tierProgress(xp) {
  const total = Math.max(0, Math.floor(Number(xp) || 0));
  const current = tierFromXp(total);
  const next = nextTier(current);
  if (!next) {
    return { current, next: null, progress: 1, xpIntoTier: 0, xpForNextTier: 0 };
  }
  const xpIntoTier = total - current.threshold;
  const xpForNextTier = next.threshold - current.threshold;
  const progress = xpForNextTier > 0 ? Math.min(1, xpIntoTier / xpForNextTier) : 1;
  return { current, next, progress, xpIntoTier, xpForNextTier };
}

/**
 * Lookup por tag.
 *
 * @param {string} tag
 * @returns {Tier|null}
 */
export function getTierByTag(tag) {
  if (!tag) return null;
  return TIERS.find((t) => t.tag === String(tag).toLowerCase()) || null;
}

/**
 * Lista tiers em ordem cronológica (já é assim por construção, mas
 * explícito para deixar claro o contrato).
 *
 * @returns {Array<Tier>}
 */
export function listTiers() {
  return [...TIERS];
}
