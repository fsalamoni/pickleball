/**
 * useAnnounce — fala o lance em voz alta ("Fora!") e vibra o aparelho quando
 * chega um lance NOVO. É o juiz de linha que grita: quem está em quadra não
 * precisa olhar a tela.
 *
 * A escolha (ligado/desligado) é por pessoa, no navegador (`viewPreference`),
 * separada para a câmera e para a central. Nada abre sozinho na primeira
 * renderização: só o que chega DEPOIS de a tela abrir é anunciado.
 */

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { readViewPreference, writeViewPreference } from '@/core/lib/viewPreference';
import { localeAtivo } from '@/core/i18n';

export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

/** Fala `text` no idioma da tela, interrompendo o anúncio anterior. */
export function speak(text, { rate = 1.1 } = {}) {
  if (!canSpeak() || !text) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = localeAtivo();
    u.rate = rate;
    window.speechSynthesis.speak(u);
  } catch { /* o navegador pode recusar sem gesto da pessoa */ }
}

const vibrate = (pattern) => {
  try { navigator.vibrate?.(pattern); } catch { /* sem vibração */ }
};

/**
 * @param {{ id: string, call: string }|null} latest  o lance mais recente
 * @param {(l) => string} toText  o que falar
 * @param {string} prefKey  onde guardar a escolha
 * @returns {[boolean, (on: boolean) => void]}
 */
export function useAnnounce(latest, toText, prefKey) {
  const { user } = useAuth();
  const uid = user?.uid || null;
  const [on, setOnState] = useState(() => readViewPreference(uid, prefKey) === '1');
  const seen = useRef(latest?.id ?? null);

  const setOn = (v) => {
    setOnState(v);
    writeViewPreference(uid, prefKey, v ? '1' : '0');
    // O primeiro anúncio precisa de um gesto da pessoa (Safari): este é ele.
    if (v) speak(' ');
  };

  useEffect(() => {
    if (!latest?.id || latest.id === seen.current) return;
    seen.current = latest.id;
    if (!on) return;
    speak(toText(latest));
    if (['out', 'fault'].includes(latest.call)) vibrate([120, 60, 120]);
    else if (latest.call === 'review') vibrate(60);
  }, [latest, on, toText]);

  return [on, setOn];
}
