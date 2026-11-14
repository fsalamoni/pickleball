/**
 * A calibração PELA CENTRAL (docs/53 §5d): `{quadra}/line_calib/{camId}`.
 *
 * O id é o da câmera (`{uid}_{posição}`, o mesmo de `line_cams`). A câmera
 * grava a foto da quadra e o que ela tem; quem organiza grava a calibração, o
 * pedido de foto nova e o começar/pausar — e toda escrita de quem organiza
 * apaga a foto (a regra exige). Só a própria câmera e quem organiza leem: a
 * foto mostra a quadra e quem está nela. Ao sair, a câmera apaga a FOTO e o
 * documento fica: a calibração (`cur`) é a que está GUARDADA NA QUADRA e volta
 * na próxima vez que alguém filmar dali.
 */
import {
  doc, setDoc, updateDoc, deleteDoc, deleteField, onSnapshot, getDoc, getDocs, collection, query, where,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { hostPath, camDocId } from './lineCallSync.js';
import { SNAP_MAX_CHARS, snapScale, calibForDb } from '../domain/remoteCalib.js';

const calibRef = (host, camId) => doc(db, hostPath(host), 'line_calib', camId);

/**
 * A foto atual do vídeo, em JPEG (data URL), com o maior lado até
 * `SNAP_MAX_W` e abaixo do teto do banco. `null` se o vídeo não tem imagem.
 */
export function grabSnap(video) {
  const w = video?.videoWidth;
  const h = video?.videoHeight;
  if (!w || !h) return null;
  const k = snapScale(w, h);
  const cv = document.createElement('canvas');
  cv.width = Math.round(w * k);
  cv.height = Math.round(h * k);
  cv.getContext('2d').drawImage(video, 0, 0, cv.width, cv.height);
  for (const q of [0.82, 0.7, 0.55, 0.4]) {
    const url = cv.toDataURL('image/jpeg', q);
    if (url.length < SNAP_MAX_CHARS) return { snap: url, vw: w, vh: h };
  }
  return null;
}

/** O lado da câmera COM CONTA: grava (mesclando) e acompanha o próprio documento. */
export function cameraCalibSync(host, uid, position) {
  const ref = calibRef(host, camDocId(uid, position));
  return {
    write: (fields) => setDoc(ref, { ...fields, uid, position }, { merge: true }),
    watch: (cb, onError) => onSnapshot(ref, (s) => cb(s.exists() ? s.data() : null), onError),
    remove: () => deleteDoc(ref),
    /**
     * A calibração que ficou guardada NA QUADRA para esta posição: o próprio
     * documento e — para quem organiza, que lê os de todos — o das outras
     * câmeras que já filmaram dali. Quem não organiza recebe só o seu.
     */
    saved: async () => {
      const own = await getDoc(ref).then((s) => (s.exists() ? s.data() : null));
      const others = await getDocs(query(collection(db, hostPath(host), 'line_calib'), where('position', '==', position)))
        .then((q) => q.docs.map((d) => d.data()))
        .catch(() => []);
      return { own, all: [own, ...others].filter(Boolean) };
    },
    // Ao sair, só a FOTO sai do banco: a calibração fica guardada na quadra.
    release: () => updateDoc(ref, { snap: deleteField() }),
  };
}

/** A central acompanha o documento de uma câmera. */
export function watchCameraCalib(host, camId, cb, onError) {
  return onSnapshot(calibRef(host, camId), (s) => cb(s.exists() ? s.data() : null), onError);
}

/** Toda escrita de quem organiza leva `by` e apaga a foto. */
const orgWrite = (host, camId, uid, fields) => updateDoc(calibRef(host, camId), { ...fields, by: uid, snap: deleteField() });

/** Pede à câmera uma foto nova da quadra. */
export const requestCameraSnap = (host, camId, uid) => orgWrite(host, camId, uid, { snap_req_ms: Date.now() });

/**
 * Manda a calibração (pontos em pixels do VÍDEO da câmera) e, se `run` vier,
 * já começa ou pausa a análise.
 */
export function sendCameraCalib(host, camId, uid, calib, run = null) {
  const now = Date.now();
  const fields = { calib: calibForDb(calib), calib_ms: now };
  if (typeof run === 'boolean') { fields.run = run; fields.run_ms = now; }
  return orgWrite(host, camId, uid, fields).then(() => now);
}

/** Começa ou pausa a análise de uma câmera, pela central. */
export const setCameraRun = (host, camId, uid, run) => orgWrite(host, camId, uid, { run: run === true, run_ms: Date.now() });
