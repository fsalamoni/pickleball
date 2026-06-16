/*
 * Registro do service worker do PWA — totalmente controlado pela flag
 * VITE_PWA_ENABLED. Quando a flag está desligada (padrão), nenhum service
 * worker é registrado e qualquer registro anterior é removido, garantindo
 * zero impacto no app.
 */

export const PWA_ENABLED = import.meta.env.VITE_PWA_ENABLED === 'true';

export function registerPwa() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  // Flag desligada: garante que não exista SW registrado (segurança / rollback).
  if (!PWA_ENABLED) {
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => regs.forEach((r) => r.unregister()))
      .catch(() => {});
    return;
  }

  // Em dev o SW não traz benefício e pode confundir o HMR; só em produção.
  if (import.meta.env.DEV) return;

  const swUrl = `${import.meta.env.BASE_URL || '/'}sw.js`.replace(/\/{2,}/g, '/');

  window.addEventListener('load', () => {
    navigator.serviceWorker.register(swUrl).catch(() => {
      // Falha no registro não pode afetar o app — silenciosa por design.
    });
  });
}
