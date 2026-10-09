/**
 * Domínio puro de exportação de dados pessoais (LGPD) — flag settings_page.
 *
 * Monta um objeto serializável com os dados do usuário (perfil, inscrições,
 * reservas, aulas, metas e o Centro de Treino) para download em JSON. Sem
 * I/O — a coleta é feita fora (`collectTrainingExport` e a página).
 *
 * Falha não é vazio: o que não deu para ler entra em `incomplete`, e quem
 * baixa o arquivo sabe o que ficou de fora — em vez de concluir que não tem.
 */

/** Firestore Timestamp → ISO, em qualquer profundidade (listas e mapas). */
function limpo(v) {
  if (!v || typeof v !== 'object') return v;
  if (typeof v.toDate === 'function') return v.toDate().toISOString();
  if (Array.isArray(v)) return v.map(limpo);
  const out = {};
  Object.keys(v).forEach((k) => { out[k] = limpo(v[k]); });
  return out;
}

/** Remove campos internos/pesados e mantém um snapshot limpo. */
function pick(obj, drop = []) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = {};
  Object.keys(obj).forEach((k) => {
    if (!drop.includes(k)) out[k] = limpo(obj[k]);
  });
  return out;
}

const lista = (xs) => (Array.isArray(xs) ? xs : []).map((x) => pick(x));

/**
 * O bloco do Centro de Treino. `training` vem de `collectTrainingExport`:
 * cada lista é só o que a regra deixa a pessoa ler (os itens que ela criou,
 * o diário com os comentários, os envios dos dois lados, as dúvidas com as
 * mensagens, as denúncias que ela fez) e os CAMINHOS da mídia que ela enviou
 * — o arquivo em si fica no Storage; o caminho é o que permite pedi-lo.
 */
function trainingBlock(t = {}) {
  const shares = t.shares || {};
  const bloco = {
    items: lista(t.items),
    sessions: lista(t.sessions),
    plans: lista(t.plans),
    meta: t.meta ? pick(t.meta) : null,
    shares: { sent: lista(shares.sent), received: lista(shares.received) },
    questions: lista(t.questions),
    reports: lista(t.reports),
    media_paths: (Array.isArray(t.media_paths) ? t.media_paths : []).filter((p) => typeof p === 'string'),
    // Dito no arquivo, para ninguém concluir que ele está completo.
    not_included: ['Os comentários que você fez, como professor, no diário dos seus alunos (ficam no diário de cada aluno).'],
  };
  bloco.counts = {
    items: bloco.items.length,
    sessions: bloco.sessions.length,
    plans: bloco.plans.length,
    shares_sent: bloco.shares.sent.length,
    shares_received: bloco.shares.received.length,
    questions: bloco.questions.length,
    reports: bloco.reports.length,
    media: bloco.media_paths.length,
  };
  return bloco;
}

/**
 * Monta o pacote de exportação.
 * @param {{ uid, profile, registrations, bookings, lessons, goals?, training?, incomplete? }} input
 *   `goals` e `training` só entram quando foram coletados; `incomplete` lista,
 *   em pt-BR, as partes que falharam na leitura.
 * @returns {object}
 */
export function buildDataExport({
  uid, profile, registrations = [], bookings = [], lessons = [], goals, training, incomplete = [],
} = {}) {
  const out = {
    schema: 'picklerush.data-export.v1',
    exported_at: new Date().toISOString(),
    user_id: uid || null,
    profile: pick(profile || {}, ['id']),
    registrations: (registrations || []).map((r) => pick(r)),
    bookings: (bookings || []).map((b) => pick(b)),
    lessons: (lessons || []).map((l) => pick(l)),
    counts: {
      registrations: (registrations || []).length,
      bookings: (bookings || []).length,
      lessons: (lessons || []).length,
    },
    incomplete: [...new Set((incomplete || []).filter(Boolean))],
  };
  if (goals !== undefined) out.goals = lista(goals);
  if (training !== undefined) out.training = trainingBlock(training || {});
  return out;
}

/** Nome do arquivo de exportação. */
export function dataExportFilename(name) {
  const base = String(name || 'meus-dados')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 40) || 'meus-dados';
  const stamp = new Date().toISOString().slice(0, 10);
  return `picklerush-${base}-${stamp}.json`;
}
