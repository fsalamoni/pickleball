/**
 * useAnnounce — avisa o lance NOVO na hora: um TOQUE curto (Web Audio, alguns
 * milissegundos), a vibração e, se a pessoa quiser, a VOZ ("Fora!"). É o juiz
 * de linha que grita: quem está em quadra não precisa olhar a tela.
 *
 * Duas escolhas por pessoa, no navegador (`viewPreference`), separadas para a
 * câmera e para a central: o toque (padrão LIGADO) e a voz (padrão desligada).
 * Nada toca na primeira olhada da lista: só o que chega DEPOIS de a tela abrir.
 *
 * Cada lance que chega é avisado UMA vez (`newArrivals`, pelas marcações que o
 * formam). Chegando vários juntos — o motor solta no mesmo quadro o pé de quem
 * saca e o quique do saque —, o toque, a vibração e a tela que pisca são do
 * mais grave (`pickHeadline`), e a voz diz todos, o mais grave primeiro, numa
 * frase só (cada fala corta a anterior).
 *
 * Só a FALTA grita. "Revisar" é a câmera dizendo que não tem certeza — e bola
 * que não se vê claramente fora segue em jogo (8.D) —, então no aparelho que
 * filma, ao lado da quadra, ele fica calado (`quietReview`): um toque no meio
 * do ponto faria os jogadores pararem. Na central, quem decide ouve.
 */

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { readViewPreference, writeViewPreference } from '@/core/lib/viewPreference';
import { localeAtivo } from '@/core/i18n';
import { tonesFor } from '../domain/alertTones';
import { pickHeadline, headlineFirst, newArrivals } from '../domain/fusion';
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
 * @param {Array<{ id: string, call: string }>|null} items  a lista da tela (os
 *   eventos do motor ou os lances da central); `null` enquanto ela carrega
 * @param {(l) => string} toText  o que falar
 * @param {string} prefKey  onde guardar a escolha
 * @param {{ quietReview?: boolean }} [opts]  `quietReview`: "revisar" sem som, sem voz e sem vibrar
 * @returns {[boolean, (on: boolean) => void, boolean, (on: boolean) => void, object|null]}
 *   voz ligada, liga/desliga a voz, toque ligado, liga/desliga o toque, e o
 *   lance do último aviso (o que a tela pisca, `CallFlash`)
 */
export function useAnnounce(items, toText, prefKey, { quietReview = false } = {}) {
  const { user } = useAuth();
  const uid = user?.uid || null;
  const somKey = `${prefKey}:som`;
  const [on, setOnState] = useState(() => readViewPreference(uid, prefKey) === '1');
  const [som, setSomState] = useState(() => readViewPreference(uid, somKey) !== '0');
  const [flash, setFlash] = useState(null);
  const seen = useRef(null); // as marcações já vistas; `null` antes da primeira olhada

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
    // Carregando (de novo): a próxima olhada é base — o que chegou no meio não toca.
    if (!items) { seen.current = null; return; }
    const { fresh, seen: next } = newArrivals(items, seen.current);
    seen.current = next;
    if (!fresh.length) return;
    setFlash(pickHeadline(fresh));
    const audible = quietReview ? fresh.filter((l) => l.call !== 'review') : fresh;
    const top = pickHeadline(audible);
    if (!top) return;
    if (som) playTones(tonesFor(top.call));
    if (['out', 'fault'].includes(top.call)) vibrate([120, 60, 120]);
    else if (top.call === 'review') vibrate(60);
    if (on) speak(headlineFirst(audible).map(toText).filter(Boolean).join('. '));
  }, [items, on, som, toText, quietReview]);

  return [on, setOn, som, setSom, flash];
}
