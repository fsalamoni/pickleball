import { getAchievementV2ById } from '@/modules/achievements/domain/achievementsV2';

/** O nome de exibição de uma conquista (ou um texto neutro, nunca o id cru). */
export const achievementName = (id) => getAchievementV2ById(id)?.name || 'Conquista';
