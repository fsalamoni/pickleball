/**
 * "Funções no ar": o registro que a vigilância e o deploy gravam em
 * `platform_settings/functions_health` (`scripts/functions-health.cjs`), dito
 * para gente. Do #315 ao #321 o passo de deploy das funções (não fatal)
 * falhou calado e as funções novas da federação não subiram; nada na
 * plataforma dizia isso.
 *
 * Puro: sem React, sem Firebase.
 */

/** A vigilância roda a cada 30 min; sem conferência há mais que isto, ela parou. */
export const CONFERENCIA_VELHA_MS = 90 * 60 * 1000;

function emMs(valor) {
  if (!valor) return 0;
  if (typeof valor === 'number') return valor;
  if (typeof valor.toMillis === 'function') return valor.toMillis();
  if (typeof valor.seconds === 'number') return valor.seconds * 1000;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

const lista = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);

/**
 * @param {object|null} doc documento `platform_settings/functions_health` (ou null)
 * @param {number} agoraMs
 * @returns {{
 *   estado: 'ok'|'atencao'|'sem_registro',
 *   conferencia: null | { ms: number, velha: boolean, esperadas: number, publicadas: number, faltando: string[], semRotulo: string[], runUrl: string|null },
 *   deploy: null | { ms: number, ok: boolean, erro: string|null, ultimoOkMs: number, commit: string|null, runUrl: string|null },
 * }}
 */
export function describeFunctionsHealth(doc, agoraMs) {
  const c = doc && typeof doc.check === 'object' ? doc.check : null;
  const d = doc && typeof doc.deploy === 'object' ? doc.deploy : null;
  const conferencia = c && emMs(c.at) ? {
    ms: emMs(c.at),
    velha: agoraMs - emMs(c.at) > CONFERENCIA_VELHA_MS,
    esperadas: Number(c.expected) || 0,
    publicadas: Number(c.published) || 0,
    faltando: lista(c.missing),
    semRotulo: lista(c.unlabeled),
    runUrl: c.run_url || null,
  } : null;
  const deploy = d && emMs(d.at) ? {
    ms: emMs(d.at),
    ok: d.ok === true,
    erro: d.ok === true ? null : (d.error ? String(d.error) : null),
    ultimoOkMs: emMs(d.last_ok_at),
    commit: d.commit || null,
    runUrl: d.run_url || null,
  } : null;
  if (!conferencia && !deploy) return { estado: 'sem_registro', conferencia, deploy };
  const atencao = (conferencia && (conferencia.velha || conferencia.faltando.length > 0)) || (deploy && !deploy.ok);
  return { estado: atencao ? 'atencao' : 'ok', conferencia, deploy };
}
