/**
 * Pés e punhos de quem está em quadra — MediaPipe Pose Landmarker (Google,
 * licença Apache-2.0), rodando NO NAVEGADOR (WebAssembly + GPU quando há).
 *
 * Carregado só quando o controle de linhas começa (import dinâmico): o pacote
 * e o modelo (~6 MB) nunca entram no pacote de quem não usa. O motor de
 * execução vem do jsDelivr e o modelo do repositório oficial do MediaPipe,
 * ambos com a versão FIXADA — atualizar é trocar os números aqui.
 */

const TASKS_VERSION = '1.2.0';
const WASM_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VERSION}/wasm`;
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

// Índices dos 33 pontos do modelo.
const WRISTS = [15, 16];
const FEET = [29, 30, 31, 32]; // calcanhar e ponta, esquerdo e direito

/**
 * Cria o detector. Até 4 pessoas (duplas).
 * @returns {Promise<{ detect: (video: HTMLVideoElement, tMs: number) => Array<{ feet, wrists }>, close: () => void }>}
 */
export async function createPoseDetector() {
  const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision');
  const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
  const make = (delegate) => PoseLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL_URL, delegate },
    runningMode: 'VIDEO',
    numPoses: 4,
  });
  // GPU quando o aparelho tem; senão, CPU (mais lento, mas funciona).
  const landmarker = await make('GPU').catch(() => make('CPU'));
  return {
    detect(video, tMs) {
      const w = video.videoWidth;
      const h = video.videoHeight;
      const res = landmarker.detectForVideo(video, tMs);
      return (res?.landmarks || []).map((lm) => ({
        // `v`: o quanto o detector VÊ o ponto (pé escondido atrás de alguém é palpite).
        feet: FEET.map((i) => ({ x: lm[i].x * w, y: lm[i].y * h, v: lm[i].visibility ?? 1 })),
        wrists: WRISTS.map((i) => ({ x: lm[i].x * w, y: lm[i].y * h })),
      }));
    },
    close() { landmarker.close(); },
  };
}
