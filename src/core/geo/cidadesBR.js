/**
 * O MAPA DAS CIDADES do Brasil — para medir "até N km" entre cidades.
 *
 * Os dados (5.571 cidades, latitude e longitude do IBGE) moram em
 * `cidadesBR.data.js`, que é GRANDE (≈ 57 kB compactado) e por isso é baixado
 * SÓ quando alguém precisa medir distância — nunca no pacote que todo mundo
 * baixa. `buildCityGeo` é pura (recebe os dados), para o teste não depender do
 * arquivo inteiro.
 *
 * Nada aqui toca o banco, e nada sai do aparelho: a localização do aparelho,
 * quando a pessoa pede, é convertida AQUI na cidade mais próxima.
 */
import { normalizeLocality, ufOf } from '../domain/locality.js';
import { haversineKm } from '../domain/region.js';

/**
 * @param {Record<string, string>} dados `{ UF: 'Nome|lat|lon;…' }`
 * @returns {{
 *   total: number,
 *   coordsOf: (cidade: string, uf?: string) => ({ nome, uf, lat, lon }|null),
 *   nearest: (lat: number, lon: number) => ({ nome, uf, lat, lon, km }|null),
 *   search: (texto: string, opts?: { uf?: string, limite?: number }) => Array<{ nome, uf, lat, lon }>,
 *   within: (centro: { lat, lon }, km: number, opts?: { limite?: number }) => Array<{ nome, uf, km }>,
 * }}
 */
export function buildCityGeo(dados = {}) {
  const todas = [];
  const porChave = new Map();
  const porNome = new Map();
  Object.entries(dados || {}).forEach(([uf, texto]) => {
    String(texto || '').split(';').forEach((parte) => {
      if (!parte) return;
      const [nome, lat, lon] = parte.split('|');
      const c = Object.freeze({ nome, uf, lat: Number(lat), lon: Number(lon), n: normalizeLocality(nome) });
      if (!c.n || !Number.isFinite(c.lat) || !Number.isFinite(c.lon)) return;
      todas.push(c);
      porChave.set(`${uf}|${c.n}`, c);
      const lista = porNome.get(c.n) || [];
      lista.push(c);
      porNome.set(c.n, lista);
    });
  });

  return {
    total: todas.length,

    /** Coordenadas da cidade. Sem UF, só quando o nome existe num estado só. */
    coordsOf(cidade, uf) {
      const n = normalizeLocality(cidade);
      if (!n) return null;
      const u = ufOf(uf);
      if (u) return porChave.get(`${u}|${n}`) || null;
      const lista = porNome.get(n);
      return lista && lista.length === 1 ? lista[0] : null;
    },

    /** A cidade mais próxima de um ponto (a localização do aparelho). */
    nearest(lat, lon) {
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
      let melhor = null;
      let melhorKm = Infinity;
      todas.forEach((c) => {
        const d = haversineKm({ lat, lon }, c);
        if (d < melhorKm) { melhor = c; melhorKm = d; }
      });
      return melhor ? { ...melhor, km: melhorKm } : null;
    },

    /** Busca por nome (para escolher "outro lugar"): começa com, depois contém. */
    search(texto, { uf = '', limite = 8 } = {}) {
      const n = normalizeLocality(texto);
      if (n.length < 2) return [];
      const u = ufOf(uf);
      const doEstado = (c) => !u || c.uf === u;
      const comeca = [];
      const contem = [];
      todas.forEach((c) => {
        if (!doEstado(c)) return;
        if (c.n.startsWith(n)) comeca.push(c);
        else if (c.n.includes(n)) contem.push(c);
      });
      const ordem = (a, b) => a.n.localeCompare(b.n) || a.uf.localeCompare(b.uf);
      return [...comeca.sort(ordem), ...contem.sort(ordem)].slice(0, limite);
    },

    /** As cidades a até `km` do centro (sem o próprio centro), mais perto primeiro. */
    within(centro, km, { limite = 60 } = {}) {
      if (!centro || !Number.isFinite(km)) return [];
      return todas
        .map((c) => ({ nome: c.nome, uf: c.uf, km: haversineKm(centro, c) }))
        .filter((c) => c.km > 0.5 && c.km <= km)
        .sort((a, b) => a.km - b.km)
        .slice(0, limite);
    },
  };
}

let carregando = null;

/**
 * Baixa (uma vez por sessão) e monta o mapa das cidades. Falhou (sem rede,
 * versão velha pós-deploy)? A próxima chamada tenta de novo.
 */
export function loadCityGeo() {
  if (!carregando) {
    carregando = import('./cidadesBR.data.js')
      .then((m) => buildCityGeo(m.default))
      .catch((err) => {
        carregando = null;
        throw err;
      });
  }
  return carregando;
}
