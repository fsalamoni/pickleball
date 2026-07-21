/**
 * Domínio puro da Arena: normalização/validação do perfil e helpers de
 * apresentação (endereço, links sociais, agregação de avaliações).
 * Sem I/O — testável isoladamente.
 */

function str(value) {
  return String(value ?? '').trim();
}

/** Garante uma URL http(s) segura ou string vazia. */
export function normalizeUrl(value) {
  const v = str(value);
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  return `https://${v}`;
}

/** Extrai o @handle do Instagram a partir de um handle ou URL. */
export function normalizeInstagram(value) {
  const v = str(value).replace(/^@/, '');
  if (!v) return '';
  const m = v.match(/instagram\.com\/([^/?#]+)/i);
  return (m ? m[1] : v).replace(/[^A-Za-z0-9._]/g, '');
}

/**
 * Normaliza e valida os dados de entrada de uma arena.
 * @returns {{ valid: boolean, errors: Record<string,string>, value: object }}
 */
export function normalizeArenaInput(input = {}) {
  const errors = {};
  const name = str(input.name);
  if (!name) errors.name = 'Informe o nome da arena.';
  if (name.length > 120) errors.name = 'Nome muito longo (máx. 120).';

  const website = normalizeUrl(input.website);

  const value = {
    name,
    description: str(input.description).slice(0, 2000),
    city: str(input.city),
    state: str(input.state).toUpperCase().slice(0, 2),
    address: str(input.address).slice(0, 240),
    neighborhood: str(input.neighborhood).slice(0, 120),
    contact_phone: str(input.contact_phone).slice(0, 40),
    contact_whatsapp: str(input.contact_whatsapp).slice(0, 40),
    contact_email: str(input.contact_email).slice(0, 160),
    instagram: normalizeInstagram(input.instagram),
    website,
    hours: str(input.hours).slice(0, 400),
    court_count: Number.isFinite(Number(input.court_count)) ? Math.max(0, Math.trunc(Number(input.court_count))) : 0,
    base_price: (() => {
      const n = Number(input.base_price);
      if (!Number.isFinite(n) || n < 0) return null;
      return n;
    })(),
    active: input.active !== false,
  };

  return { valid: Object.keys(errors).length === 0, errors, value };
}

/** Monta uma string de endereço legível. */
export function formatArenaAddress(arena) {
  if (!arena) return '';
  return [arena.address, arena.neighborhood, [arena.city, arena.state].filter(Boolean).join(' / ')]
    .map(str)
    .filter(Boolean)
    .join(' · ');
}

/** Links sociais/contatos prontos para uso na UI (href). */
export function arenaContactLinks(arena) {
  if (!arena) return {};
  const links = {};
  const wa = str(arena.contact_whatsapp || arena.contact_phone).replace(/\D/g, '');
  if (wa) {
    const phone = wa.length <= 11 ? `55${wa}` : wa;
    links.whatsapp = `https://wa.me/${phone}`;
  }
  if (str(arena.contact_phone)) links.phone = `tel:${str(arena.contact_phone).replace(/\s/g, '')}`;
  if (str(arena.contact_email)) links.email = `mailto:${str(arena.contact_email)}`;
  if (str(arena.instagram)) links.instagram = `https://instagram.com/${normalizeInstagram(arena.instagram)}`;
  if (str(arena.website)) links.website = normalizeUrl(arena.website);
  return links;
}

/**
 * Agrega uma lista de avaliações num resumo de nota.
 * Considera apenas itens do tipo "review" com nota 1..5.
 * @param {Array<{ rating?: number, type?: string }>} reviews
 * @returns {{ average: number|null, count: number, distribution: number[] }}
 */
export function aggregateRatings(reviews = []) {
  const distribution = [0, 0, 0, 0, 0];
  let sum = 0;
  let count = 0;
  reviews.forEach((r) => {
    const n = Number(r?.rating);
    if ((r?.type ?? 'review') !== 'review') return;
    if (Number.isFinite(n) && n >= 1 && n <= 5) {
      distribution[Math.round(n) - 1] += 1;
      sum += Math.round(n);
      count += 1;
    }
  });
  return {
    average: count > 0 ? Math.round((sum / count) * 10) / 10 : null,
    count,
    distribution,
  };
}

/**
 * Filtra e ordena arenas para o diretório (ativas primeiro, por nome),
 * aplicando busca textual por nome/cidade/estado.
 */
export function filterAndSortArenas(arenas = [], { search = '', city = '' } = {}) {
  const q = str(search).toLowerCase();
  const cityQ = str(city).toLowerCase();
  return arenas
    .filter((a) => a && a.active !== false)
    .filter((a) => {
      if (cityQ && str(a.city).toLowerCase() !== cityQ) return false;
      if (!q) return true;
      return [a.name, a.city, a.state, a.neighborhood]
        .map(str)
        .join(' ')
        .toLowerCase()
        .includes(q);
    })
    .sort((a, b) => str(a.name).localeCompare(str(b.name)));
}
