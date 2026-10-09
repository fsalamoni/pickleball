/**
 * Configurações do Centro de Treino: `platform_settings/training`.
 *
 * O documento é público para leitura e só o admin escreve (regra que já
 * existia para `platform_settings`). Campo ausente vale o PADRÃO daqui — e a
 * regra do Firestore usa os mesmos padrões em `trainingSetting(chave, padrão)`.
 */

export const TRAINING_SETTINGS_DOC = 'training';

export const DEFAULT_TRAINING_SETTINGS = Object.freeze({
  public_review_atleta: true,
  // Qualquer conta pode se declarar professor; até o admin verificar a
  // pessoa (`verified_professors`), o público dela passa pela revisão.
  public_review_professor: true,
  allow_public_athlete: true,
  allow_uploads: true,
  allow_video_upload: true,
  max_image_mb: 3,
  max_video_mb: 60,
  max_video_seconds: 60,
  max_uploads_per_user: 40,
  allow_sharing: true,
  // Quantos itens a MESMA pessoa pode ter esperando revisão ao mesmo tempo
  // (protege a fila; conferido no serviço).
  max_pending_per_user: 5,
});

const bool = (v, d) => (typeof v === 'boolean' ? v : d);
const num = (v, d, min, max) => {
  // null/'' (campo apagado) valem o PADRÃO, não o mínimo — Number(null) é 0.
  const n = v === null || v === '' ? NaN : Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d;
};

/** Lê o documento (ou `null`) e devolve todas as chaves com padrão. */
export function normalizeTrainingSettings(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const d = DEFAULT_TRAINING_SETTINGS;
  return {
    public_review_atleta: bool(r.public_review_atleta, d.public_review_atleta),
    public_review_professor: bool(r.public_review_professor, d.public_review_professor),
    allow_public_athlete: bool(r.allow_public_athlete, d.allow_public_athlete),
    allow_uploads: bool(r.allow_uploads, d.allow_uploads),
    allow_video_upload: bool(r.allow_video_upload, d.allow_video_upload),
    max_image_mb: num(r.max_image_mb, d.max_image_mb, 0.5, 3),
    max_video_mb: num(r.max_video_mb, d.max_video_mb, 5, 60),
    max_video_seconds: num(r.max_video_seconds, d.max_video_seconds, 10, 120),
    max_uploads_per_user: num(r.max_uploads_per_user, d.max_uploads_per_user, 0, 500),
    allow_sharing: bool(r.allow_sharing, d.allow_sharing),
    max_pending_per_user: num(r.max_pending_per_user, d.max_pending_per_user, 1, 50),
    seed_installed_version: r.seed_installed_version ?? null,
    seed_installed_at: r.seed_installed_at ?? null,
    // Itens da semente que o admin apagou de propósito: a atualização não os recria.
    seed_removed: Array.isArray(r.seed_removed) ? r.seed_removed.filter((x) => typeof x === 'string') : [],
    // Professores que o admin verificou: o público deles entra sem fila. Fora
    // de DEFAULT_TRAINING_SETTINGS de propósito — o "salvar" e o "restaurar
    // padrões" das configurações não tocam a lista; só `setProfessorVerified`.
    verified_professors: Array.isArray(r.verified_professors)
      ? r.verified_professors.filter((x) => typeof x === 'string')
      : [],
  };
}

/** Só as chaves que o admin edita — o que vai para o `setDoc(..., { merge: true })`. */
export function settingsPatch(input = {}) {
  const n = normalizeTrainingSettings(input);
  const out = {};
  for (const k of Object.keys(DEFAULT_TRAINING_SETTINGS)) out[k] = n[k];
  return out;
}
