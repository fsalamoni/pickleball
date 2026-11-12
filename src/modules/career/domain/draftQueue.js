/**
 * Rascunho SEM SINAL: o torneio que a pessoa salvou sem conexão fica guardado
 * no navegador, por usuário (`viewPreference`, zero banco), e é reenviado
 * quando a conexão volta. Ginásio costuma ter sinal ruim.
 *
 * Cada rascunho já tem o `id` definitivo: reenviar duas vezes grava o MESMO
 * documento (idempotente). PURO — quem lê e grava o navegador é o hook.
 */

/** Preferência por usuário (contrato: mudar o id perde os rascunhos guardados). */
export const CAREER_PENDING_PREF = 'carreira:pendentes';
/** A estimativa de "quantos torneios você já jogou fora do PickleRush?". */
export const CAREER_ESTIMATE_PREF = 'carreira:estimativa';
/** Teto de rascunhos guardados (o `localStorage` é pequeno). */
export const MAX_PENDING = 20;

/** Lê a fila guardada; texto estragado vira fila vazia. */
export function parsePending(raw) {
  try {
    const v = JSON.parse(raw || '[]');
    return Array.isArray(v) ? v.filter((x) => x && typeof x.id === 'string' && x.id) : [];
  } catch {
    return [];
  }
}

/**
 * A fila está cheia para ESTE rascunho? (Trocar um que já está nela sempre
 * cabe.) Quem guarda pergunta ANTES e avisa a pessoa — nunca se descarta um
 * rascunho antigo para caber o novo: a tela já disse "guardado".
 */
export function pendingFull(fila, evento) {
  const l = fila || [];
  return l.length >= MAX_PENDING && !l.some((x) => x.id === evento?.id);
}

/** Põe (ou troca, pelo id) um rascunho na fila. Nunca corta o que já estava guardado. */
export function addPending(fila, evento) {
  if (!evento?.id) return fila || [];
  return [...(fila || []).filter((x) => x.id !== evento.id), evento];
}

/** Tira da fila o que já foi gravado. */
export function removePending(fila, ids) {
  const fora = new Set(ids || []);
  return (fila || []).filter((x) => !fora.has(x.id));
}

/**
 * Os arquivos que o registro GRAVADO deixou de apontar: a foto tirada com a
 * ficha na fila fica no Storage de propósito (o documento do servidor ainda
 * aponta para ela) e só pode ser apagada quando o envio chega. `antes` é o
 * torneio como o servidor o tinha; só caminhos da pasta da própria pessoa.
 */
export function orphanPhotoPaths(antes, gravado, uid) {
  const ficam = new Set((gravado?.photos || []).map((p) => p?.path));
  return [...new Set((antes?.photos || []).map((p) => p?.path))]
    .filter((p) => typeof p === 'string' && p.startsWith(`carreira/${uid}/`) && !ficam.has(p));
}

/** O texto para guardar; fila vazia apaga a preferência. */
export function serializePending(fila) {
  return fila && fila.length ? JSON.stringify(fila) : null;
}
