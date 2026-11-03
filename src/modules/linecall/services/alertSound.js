/**
 * Toca os toques de `domain/alertTones.js` pelo Web Audio — sem arquivo de
 * áudio, sem rede, alguns milissegundos depois do lance.
 *
 * O navegador só deixa tocar som depois de um gesto da pessoa: `unlockAlertSound`
 * é chamado no toque que liga o som e, por garantia, no primeiro toque na tela.
 */

let ctx = null;

function audio() {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    try { ctx = new AC(); } catch { return null; }
  }
  return ctx;
}

export const canPlayAlertSound = () => typeof window !== 'undefined'
  && Boolean(window.AudioContext || window.webkitAudioContext);

/** Destrava o áudio (precisa vir de um gesto da pessoa). */
export function unlockAlertSound() {
  const a = audio();
  if (a && a.state === 'suspended') a.resume().catch(() => {});
}

if (typeof window !== 'undefined') {
  const once = () => { unlockAlertSound(); window.removeEventListener('pointerdown', once, true); };
  window.addEventListener('pointerdown', once, true);
}

/** @param {import('../domain/alertTones').Note[]} notes */
export function playTones(notes) {
  const a = audio();
  if (!a || !notes?.length) return;
  if (a.state === 'suspended') a.resume().catch(() => {});
  let t = a.currentTime + 0.005;
  for (const n of notes) {
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = n.type || 'square';
    osc.frequency.value = n.hz;
    const end = t + n.ms / 1000;
    // Ataque e queda de 5 ms: sem o "clique" de ligar e desligar seco.
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.25, t + 0.005);
    gain.gain.setValueAtTime(0.25, end - 0.005);
    gain.gain.linearRampToValueAtTime(0, end);
    osc.connect(gain).connect(a.destination);
    osc.start(t);
    osc.stop(end + 0.01);
    t = end + (n.gapMs || 0) / 1000;
  }
}
