import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { readViewPreference, writeViewPreference } from '@/core/lib/viewPreference';
import { useGamificationEngine } from '@/modules/progression/hooks/useGamificationEngine';
import { useGamificationPrefs } from '@/modules/progression/hooks/useGamificationPrefs';
import { useGamificationConfig } from '@/modules/progression/hooks/useGamificationConfig';
import { stepForVisit } from '@/modules/progression/domain/onboarding';
import { syncIsDue } from '@/modules/progression/domain/syncSchedule';

/**
 * O motor em segundo plano: recalcula e grava a progressão (e as conquistas e os
 * primeiros passos detectados) quando o app é aberto e a última passada tem mais
 * de 12 h. Sem isto o XP só andava quando a pessoa abria o hub — e o placar da
 * temporada, que lê o XP gravado, ficava parado para quem joga sem abrir o hub.
 */
function BackgroundEngine({ uid }) {
  const engine = useGamificationEngine(uid, { enabled: true, sync: true });
  const marcou = useRef(false);
  useEffect(() => {
    if (!engine.ready || marcou.current) return undefined;
    // Dá tempo às gravações disparadas pelo mesmo ciclo antes de dizer "feito".
    const t = setTimeout(() => {
      marcou.current = true;
      writeViewPreference(uid, SYNC_PREF, String(Date.now()));
    }, 4000);
    return () => clearTimeout(t);
  }, [engine.ready, uid]);
  return null;
}

/**
 * Montado uma vez no layout, só com a flag `gamification_v2` ligada:
 *  1. registra a visita que cumpre um passo do roteiro ("veja o ranking");
 *  2. dispara a sincronização de fundo quando vencida.
 * Não desenha nada.
 */
export default function GamificationBackground() {
  const on = useFeatureFlag(FEATURE_FLAG.GAMIFICATION_V2);
  const { user } = useAuth();
  const uid = on ? user?.uid : null;
  const { pathname } = useLocation();
  const { isModuleOn } = useGamificationConfig();
  const { prefs, loaded, update } = useGamificationPrefs(uid, !!uid);
  const [due] = useState(() => (uid ? syncIsDue(readViewPreference(uid, SYNC_PREF)) : false));
  const [dueNow, setDueNow] = useState(false);

  // a conta pode chegar depois do primeiro desenho
  useEffect(() => { if (uid) setDueNow(syncIsDue(readViewPreference(uid, SYNC_PREF))); }, [uid]);

  const registrados = useRef(new Set());
  useEffect(() => {
    if (!uid || !loaded || !isModuleOn('onboarding')) return;
    const passo = stepForVisit(pathname);
    if (!passo || prefs.onboarding.done[passo] || registrados.current.has(passo)) return;
    registrados.current.add(passo);
    update({ onboarding: { done: { [passo]: Date.now() } } }).then((r) => { if (!r) registrados.current.delete(passo); });
  }, [pathname, uid, loaded, prefs.onboarding.done, update, isModuleOn]);

  if (!uid || !(due || dueNow)) return null;
  return <BackgroundEngine uid={uid} />;
}
