/**
 * useCelebrationListener — escuta mudanças no Firestore e dispara toasts.
 *
 * Detecta:
 *  - Missão recém-completada (current === target e ainda não tinha)
 *  - Achievement recém-desbloqueado (chama onAchievementUnlocked)
 *
 * Não persiste (toasts são efêmeros).
 */
import { useEffect, useRef } from 'react';

/**
 * Função pura que computa os novos eventos a partir de um snapshot
 * e o estado seen anterior. Exportada para testes sem hook.
 */
export function computeCelebrationDiff(seen, missions, unlocked) {
  const newlyCompleted = [];
  const newlyUnlocked = [];
  for (const m of missions) {
    if (seen.missions.has(m.id)) continue;
    if ((m.current || 0) >= (m.target || 1)) {
      seen.missions.add(m.id);
      newlyCompleted.push({
        id: m.id,
        title: m.title || m.description,
        xp: m.xp,
        bonus: m.bonus,
      });
    }
  }
  for (const a of unlocked) {
    if (seen.achievements.has(a.achievementId)) continue;
    seen.achievements.add(a.achievementId);
    newlyUnlocked.push(a);
  }
  return { newlyCompleted, newlyUnlocked };
}

/**
 * @param {Object} args
 * @param {Array} args.missions — missões do Firestore (com current/target)
 * @param {Array} args.unlockedAchievements — do useUserAchievementsV2
 * @param {(ach: any) => void} args.onAchievementUnlocked
 * @param {(mission: any) => void} args.onMissionCompleted
 */
export function useCelebrationListener({
  missions = [],
  unlockedAchievements = [],
  onAchievementUnlocked,
  onMissionCompleted,
}) {
  const seen = useRef({ missions: new Set(), achievements: new Set() });
  const initialized = useRef(false);

  // Inicializa seen com o que já tem (não dispara toasts retroativos)
  useEffect(() => {
    if (initialized.current) return;
    missions.forEach((m) => {
      if ((m.current || 0) >= (m.target || 1)) seen.current.missions.add(m.id);
    });
    unlockedAchievements.forEach((a) => seen.current.achievements.add(a.achievementId));
    initialized.current = true;
  }, []); // mount only

  // detecta diffs
  useEffect(() => {
    if (!initialized.current) return;
    const { newlyCompleted, newlyUnlocked } = computeCelebrationDiff(seen.current, missions, unlockedAchievements);
    newlyCompleted.forEach((m) => onMissionCompleted?.(m));
    newlyUnlocked.forEach((a) => onAchievementUnlocked?.(a));
  }, [missions, unlockedAchievements, onMissionCompleted, onAchievementUnlocked]);
}

