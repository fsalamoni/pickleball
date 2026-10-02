/**
 * gamificationConfigService — a configuração do admin (`platform_settings/gamification`).
 *
 * Leitura pública (a coleção é `allow read: if true`), escrita só do admin. A
 * normalização é do domínio: documento ausente ou quebrado nunca derruba a
 * gamificação — vira os padrões.
 */
import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { createAuditLog } from '@/core/services/auditService';
import {
  normalizeGamificationConfig, diffGamificationConfig,
} from '@/modules/progression/domain/gamificationConfig';
import { gamificationDb } from './firestoreDb.js';

const COL = 'platform_settings';
const ID = 'gamification';

const ref = () => doc(gamificationDb(), COL, ID);

/** Lê a configuração (ou os padrões). Falha de leitura PROPAGA: quem mostra decide. */
export async function getGamificationConfig() {
  const snap = await getDoc(ref());
  return normalizeGamificationConfig(snap.exists() ? snap.data() : null);
}

/**
 * Observa a configuração. Em erro de leitura, entrega os padrões e segue — a
 * gamificação não pode parar porque o painel do admin não carregou.
 * @returns {() => void}
 */
export function subscribeGamificationConfig(onData, onError) {
  return onSnapshot(
    ref(),
    (snap) => onData(normalizeGamificationConfig(snap.exists() ? snap.data() : null)),
    (err) => { onData(normalizeGamificationConfig(null)); if (onError) onError(err); },
  );
}

/**
 * Salva a configuração inteira (já normalizada) e audita o que mudou.
 * @param {object} next
 * @param {object} atual configuração vigente (para o diff da auditoria)
 * @param {object} actor
 */
export async function saveGamificationConfig(next, atual, actor) {
  const valor = normalizeGamificationConfig(next);
  const mudancas = diffGamificationConfig(atual, valor);
  await setDoc(ref(), { ...valor, updatedAt: Date.now(), updatedBy: actor?.uid || null });
  if (mudancas.length > 0) {
    await createAuditLog({
      action: 'platform_gamification_config_changed',
      actor,
      details: { changes: mudancas.slice(0, 40) },
    });
  }
  return valor;
}
