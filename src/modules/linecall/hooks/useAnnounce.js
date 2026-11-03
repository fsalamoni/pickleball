/**
 * useAnnounce — avisa o lance NOVO na hora: um TOQUE curto (Web Audio, alguns
 * milissegundos), a vibração e, se a pessoa quiser, a VOZ ("Fora!"). É o juiz
 * de linha que grita: quem está em quadra não precisa olhar a tela.
 *
 * Duas escolhas por pessoa, no navegador (`viewPreference`), separadas para a
 * câmera e para a central: o toque (padrão LIGADO) e a voz (padrão desligada).
 * Nada toca na primeira renderização: só o que chega DEPOIS de a tela abrir.
 *
 * Só a FALTA grita. "Revisar" é a câmera dizendo que não tem certeza — e bola
 * que não se vê claramente fora segue em jogo —, então no aparelho que filma,
 * ao lado da quadra, ele fica calado (`quietReview`): um toque no meio do
 * ponto faria os jogadores pararem. Na central, quem decide ouve.
 */

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { readViewPreference, writeViewPreference } from '@/core/lib/viewPreference';
import { localeAtivo } from '@/core/i18n';
import { tonesFor } from '../domain/alertTones';
import { playTones, unlockAlertSound } from '../services/alertSound';

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
 * @param {{ quietReview?: boolean }} [opts]  `quietReview`: "revisar" sem som, sem voz e sem vibrar
 * @returns {[boolean, (on: boolean) => void, boolean, (on: boolean) => void]}
 *   voz ligada, liga/desliga a voz, toque ligado, liga/desliga o toque
 */
export function useAnnounce(latest, toText, prefKey, { quietReview = false } = {}) {
  const { user } = useAuth();
  const uid = user?.uid || null;
  const somKey = `${prefKey}:som`;
  const [on, setOnState] = useState(() => readViewPreference(uid, prefKey) === '1');
  const [som, setSomState] = useState(() => readViewPreference(uid, somKey) !== '0');
  const seen = useRef(latest?.id ?? null);

  const setOn = (v) => {
    setOnState(v);
    writeViewPreference(uid, prefKey, v ? '1' : '0');
    // O primeiro anúncio precisa de um gesto da pessoa (Safari): este é ele.
    if (v) { speak(' '); unlockAlertSound(); }
  };
  const setSom = (v) => {
    setSomState(v);
    writeViewPreference(uid, somKey, v ? '1' : '0');
    if (v) { unlockAlertSound(); playTones(tonesFor('out')); }
  };

  useEffect(() => {
    if (!latest?.id || latest.id === seen.current) return;
    seen.current = latest.id;
    if (quietReview && latest.call === 'review') return;
    if (som) playTones(tonesFor(latest.call));
    if (['out', 'fault'].includes(latest.call)) vibrate([120, 60, 120]);
    else if (latest.call === 'review') vibrate(60);
    if (on) speak(toText(latest));
  }, [latest, on, som, toText, quietReview]);

  return [on, setOn, som, setSom];
}
