/**
 * Domínio puro de exportação de dados pessoais (LGPD) — flag settings_page.
 *
 * Monta um objeto serializável com os dados do usuário (perfil, inscrições,
 * reservas, aulas) para download em JSON. Sem I/O — a coleta é feita na página.
 */

/** Remove campos internos/pesados e mantém um snapshot limpo. */
function pick(obj, drop = []) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = {};
  Object.keys(obj).forEach((k) => {
    if (drop.includes(k)) return;
    const v = obj[k];
    // Firestore Timestamps → ISO quando possível.
    if (v && typeof v === 'object' && typeof v.toDate === 'function') {
      out[k] = v.toDate().toISOString();
    } else {
      out[k] = v;
    }
  });
  return out;
}

/**
 * Monta o pacote de exportação.
 * @param {{ uid, profile, registrations, bookings, lessons }} input
 * @returns {object}
 */
export function buildDataExport({ uid, profile, registrations = [], bookings = [], lessons = [] } = {}) {
  return {
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
  };
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
