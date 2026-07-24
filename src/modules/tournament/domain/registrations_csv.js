/**
 * Domínio puro de exportação de inscrições em CSV (flag registrations_csv).
 *
 * Recebe as inscrições + modalidades + rótulos e devolve uma string CSV com BOM
 * (para o Excel pt-BR reconhecer UTF-8) e separador `;` (padrão brasileiro).
 * Sem I/O — o download é responsabilidade da UI.
 */

const BOM = String.fromCharCode(0xFEFF);
const SEP = ';';

/** Escapa um campo CSV: aspas duplas quando há separador, aspas ou quebra. */
export function csvField(value) {
  const s = String(value ?? '');
  if (s.includes(SEP) || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Monta uma linha CSV a partir de um array de campos. */
export function csvRow(fields) {
  return fields.map(csvField).join(SEP);
}

const HEADERS = [
  'Modalidade', 'Inscrição', 'Jogador A', 'E-mail A', 'Nível A',
  'Jogador B', 'E-mail B', 'Nível B', 'Status', 'Provisória', 'Pagamento',
];

/**
 * Gera o conteúdo CSV das inscrições.
 * @param {Array} registrations
 * @param {object} opts
 * @param {Array} [opts.modalities] para mapear modality_id → nome
 * @param {Record<string,string>} [opts.statusLabels]
 * @param {Record<string,string>} [opts.paymentLabels]
 * @returns {string} CSV (com BOM)
 */
export function buildRegistrationsCsv(registrations = [], opts = {}) {
  const { modalities = [], statusLabels = {}, paymentLabels = {} } = opts;
  const modalityName = new Map(modalities.map((m) => [m.id, m.name]));

  const rows = (registrations || []).map((r) => csvRow([
    modalityName.get(r.modality_id) || r.modality_name || '',
    r.label || `${r.player_a_name || ''}${r.player_b_name ? ` / ${r.player_b_name}` : ''}`,
    r.player_a_name || '',
    r.player_a_email || '',
    r.player_a_level || '',
    r.player_b_name || '',
    r.player_b_email || '',
    r.player_b_level || '',
    statusLabels[r.status] || r.status || '',
    r.is_provisional ? 'Sim' : '',
    r.payment_status ? (paymentLabels[r.payment_status] || r.payment_status) : '',
  ]));

  return BOM + [csvRow(HEADERS), ...rows].join('\r\n');
}

/** Nome de arquivo do CSV a partir do nome do torneio. */
export function registrationsCsvFilename(tournamentName) {
  const base = String(tournamentName || 'torneio')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 50) || 'torneio';
  return `inscricoes-${base}.csv`;
}
