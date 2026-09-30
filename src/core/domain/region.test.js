import { describe, it, expect } from 'vitest';
import {
  REGION_MODE, REGION_ORIGIN, REGION_MISSING, DEFAULT_RADIUS_KM,
  normalizeRegionPreference, parseRegionPreference, serializeRegionPreference,
  resolveRegion, regionLimits, regionLabel, regionShortLabel, regionPhrase,
  haversineKm, distanceLabel, regionMatcher, splitByRegion, placeInfo, byDistance,
} from './region.js';
import { normalizeLocality, cityKey, parsePlaceText, ufOf } from './locality.js';
import { buildCityGeo } from '../geo/cidadesBR.js';

// Um pedaço do mapa de verdade (coordenadas do IBGE, 2 casas).
const geo = buildCityGeo({
  RS: 'Porto Alegre|-30.03|-51.23;Canoas|-29.92|-51.18;Gramado|-29.38|-50.87;Pelotas|-31.77|-52.34;Bom Jesus|-28.67|-50.43',
  SC: 'Florianópolis|-27.6|-48.55;Bom Jesus|-26.73|-52.39',
  SP: 'São Paulo|-23.53|-46.64',
});

const perfil = { city: 'Porto Alegre', state: 'RS' };

describe('locality', () => {
  it('compara sem acento, caixa nem espaço', () => {
    expect(normalizeLocality('  São  Paulo ')).toBe('sao paulo');
    expect(cityKey('Florianópolis', 'sc')).toBe('SC|florianopolis');
    expect(ufOf(' rs ')).toBe('RS');
  });
  it('lê lugar escrito à mão, sem partir nome com hífen', () => {
    expect(parsePlaceText('Porto Alegre/RS')).toEqual({ city: 'Porto Alegre', state: 'RS' });
    expect(parsePlaceText('Canoas - RS')).toEqual({ city: 'Canoas', state: 'RS' });
    expect(parsePlaceText('Gramado, rs')).toEqual({ city: 'Gramado', state: 'RS' });
    expect(parsePlaceText('Embu-Guaçu')).toEqual({ city: 'Embu-Guaçu', state: '' });
    expect(parsePlaceText('Xangri-lá (RS)')).toEqual({ city: 'Xangri-lá', state: 'RS' });
  });
});

describe('preferência', () => {
  it('guarda e lê de volta; lixo vira "sem escolha"', () => {
    const txt = serializeRegionPreference({ modo: 'raio', origem: 'outra', cidade: ' Gramado ', uf: 'rs', raioKm: 25 });
    expect(parseRegionPreference(txt)).toEqual({ modo: 'raio', origem: 'outra', cidade: 'Gramado', uf: 'RS', raioKm: 25 });
    expect(parseRegionPreference('{lixo')).toBeNull();
    expect(parseRegionPreference(JSON.stringify({ v: 99, modo: 'raio' }))).toBeNull();
    expect(normalizeRegionPreference({ modo: 'marte' })).toBeNull();
    expect(serializeRegionPreference(null)).toBeNull();
  });
  it('do perfil, a cidade NUNCA é copiada (quem muda de cidade vê a nova)', () => {
    expect(normalizeRegionPreference({ modo: 'cidade', origem: 'perfil', cidade: 'X', uf: 'SP' }))
      .toMatchObject({ cidade: '', uf: '' });
  });
  it('raio fora da faixa volta ao padrão ou ao teto', () => {
    expect(normalizeRegionPreference({ modo: 'raio', raioKm: -3 }).raioKm).toBe(DEFAULT_RADIUS_KM);
    expect(normalizeRegionPreference({ modo: 'raio', raioKm: 99999 }).raioKm).toBe(1000);
  });
});

describe('resolveRegion', () => {
  it('⭐ padrão: a cidade do perfil e até 50 km', () => {
    expect(resolveRegion(null, perfil)).toMatchObject({
      modo: REGION_MODE.RAIO, cidade: 'Porto Alegre', uf: 'RS', raioKm: 50, padrao: true, falta: null,
    });
  });
  it('sem cidade no perfil cai para o estado; sem nada, todo lugar — e diz o que falta', () => {
    expect(resolveRegion(null, { state: 'RS' })).toMatchObject({ modo: 'estado', uf: 'RS', falta: REGION_MISSING.CIDADE });
    expect(resolveRegion(null, {})).toMatchObject({ modo: 'todos', falta: REGION_MISSING.CIDADE });
    expect(resolveRegion({ modo: 'estado' }, {})).toMatchObject({ modo: 'todos', falta: REGION_MISSING.ESTADO });
  });
  it('outro lugar usa a cidade escolhida, não a do perfil', () => {
    const r = resolveRegion({ modo: 'cidade', origem: REGION_ORIGIN.OUTRA, cidade: 'Gramado', uf: 'RS' }, perfil);
    expect(r).toMatchObject({ modo: 'cidade', cidade: 'Gramado', padrao: false });
  });
  it('todo lugar não limita', () => {
    expect(regionLimits(resolveRegion({ modo: 'todos' }, perfil))).toBe(false);
    expect(regionLimits(resolveRegion(null, perfil))).toBe(true);
  });
});

describe('rótulos', () => {
  it('dizem a região em português', () => {
    expect(regionLabel(resolveRegion(null, perfil))).toBe('Porto Alegre / RS e até 50 km');
    expect(regionShortLabel(resolveRegion(null, perfil))).toBe('Porto Alegre + 50 km');
    expect(regionLabel(resolveRegion({ modo: 'estado' }, perfil))).toBe('Rio Grande do Sul (todo o estado)');
    expect(regionPhrase(resolveRegion({ modo: 'estado' }, perfil))).toBe('em todo o estado (RS)');
    expect(regionLabel(resolveRegion({ modo: 'todos' }, perfil))).toBe('Todo lugar');
    expect(regionLabel(resolveRegion({ modo: 'raio', raioKm: 1000 }, perfil))).toBe('Porto Alegre / RS e até 1.000 km');
  });
  it('distância', () => {
    expect(distanceLabel(0)).toBe('na sua cidade');
    expect(distanceLabel(13.6)).toBe('a 14 km');
    expect(distanceLabel(null)).toBeNull();
  });
});

describe('haversine', () => {
  it('Porto Alegre → Canoas ≈ 13 km; Porto Alegre → São Paulo ≈ 850 km', () => {
    const poa = geo.coordsOf('Porto Alegre', 'RS');
    expect(haversineKm(poa, geo.coordsOf('Canoas', 'RS'))).toBeGreaterThan(10);
    expect(haversineKm(poa, geo.coordsOf('Canoas', 'RS'))).toBeLessThan(16);
    expect(haversineKm(poa, geo.coordsOf('São Paulo', 'SP'))).toBeGreaterThan(800);
    expect(haversineKm(poa, geo.coordsOf('São Paulo', 'SP'))).toBeLessThan(900);
  });
});

describe('regionMatcher', () => {
  it('⭐ raio: a cidade e as vizinhas entram; a distante não', () => {
    const juiz = regionMatcher(resolveRegion(null, perfil), geo);
    expect(juiz({ city: 'porto alegre', state: 'rs' })).toMatchObject({ dentro: true, km: 0 });
    expect(juiz({ city: 'Canoas', state: 'RS' }).dentro).toBe(true);
    expect(juiz({ city: 'Gramado', state: 'RS' }).dentro).toBe(false); // ≈ 85 km
    expect(juiz({ city: 'Pelotas', state: 'RS' }).dentro).toBe(false);
    expect(regionMatcher(resolveRegion({ modo: 'raio', raioKm: 100 }, perfil), geo)({ city: 'Gramado', state: 'RS' }).dentro).toBe(true);
  });
  it('cidade sem UF que só existe num estado é achada; a ambígua não é inventada', () => {
    const juiz = regionMatcher(resolveRegion(null, perfil), geo);
    expect(juiz({ city: 'Canoas' }).dentro).toBe(true);
    // "Bom Jesus" existe no RS e em SC: sem UF, não dá para medir.
    expect(juiz({ city: 'Bom Jesus' }).km).toBeNull();
  });
  it('sem o mapa (ainda carregando), o raio vale só para a própria cidade', () => {
    const juiz = regionMatcher(resolveRegion(null, perfil), null);
    expect(juiz({ city: 'Porto Alegre', state: 'RS' }).dentro).toBe(true);
    expect(juiz({ city: 'Canoas', state: 'RS' })).toMatchObject({ dentro: false, km: null });
  });
  it('estado, cidade e todo lugar', () => {
    const est = regionMatcher(resolveRegion({ modo: 'estado' }, perfil), geo);
    expect(est({ city: 'Pelotas', state: 'RS' }).dentro).toBe(true);
    expect(est({ city: 'Pelotas' }).dentro).toBe(true); // UF pelo mapa
    expect(est({ city: 'Florianópolis', state: 'SC' }).dentro).toBe(false);
    const cid = regionMatcher(resolveRegion({ modo: 'cidade' }, perfil), geo);
    expect(cid({ city: 'Canoas', state: 'RS' }).dentro).toBe(false);
    expect(cid({ city: 'Porto Alegre', state: 'SC' }).dentro).toBe(false);
    const todos = regionMatcher(resolveRegion({ modo: 'todos' }, perfil), geo);
    expect(todos({}).dentro).toBe(true);
    expect(todos({ city: 'São Paulo', state: 'SP' }).km).toBeGreaterThan(800);
  });
  it('lugar desconhecido fica fora de uma região que limita', () => {
    const juiz = regionMatcher(resolveRegion(null, perfil), geo);
    expect(juiz({})).toMatchObject({ dentro: false, conhecido: false });
  });
});

describe('splitByRegion / placeInfo / byDistance', () => {
  const juiz = regionMatcher(resolveRegion(null, perfil), geo);
  const lugar = (x) => ({ city: x.city, state: x.state });
  it('separa preservando a ordem', () => {
    const itens = [
      { id: 'sp', city: 'São Paulo', state: 'SP' },
      { id: 'poa', city: 'Porto Alegre', state: 'RS' },
      { id: 'semLocal' },
      { id: 'canoas', city: 'Canoas', state: 'RS' },
    ];
    const { dentro, fora } = splitByRegion(itens, lugar, juiz);
    expect(dentro.map((i) => i.id)).toEqual(['poa', 'canoas']);
    expect(fora.map((i) => i.id)).toEqual(['sp', 'semLocal']);
    expect([...itens].sort(byDistance(lugar, juiz)).map((i) => i.id)).toEqual(['poa', 'canoas', 'sp', 'semLocal']);
  });
  it('vários lugares: basta um dentro, e a distância é a menor', () => {
    const professor = { lugares: [{ city: 'São Paulo', state: 'SP' }, { city: 'Canoas', state: 'RS' }] };
    const info = placeInfo(professor, (p) => p.lugares, juiz);
    expect(info.dentro).toBe(true);
    expect(info.km).toBeLessThan(20);
  });
});

describe('mapa das cidades', () => {
  it('busca por nome, sem acento, com a UF', () => {
    expect(geo.search('flor').map((c) => c.nome)).toEqual(['Florianópolis']);
    expect(geo.search('bom jes').map((c) => c.uf)).toEqual(['RS', 'SC']);
    expect(geo.search('bom jes', { uf: 'sc' }).map((c) => c.uf)).toEqual(['SC']);
    expect(geo.search('a')).toEqual([]);
  });
  it('acha a cidade mais próxima de um ponto (a localização do aparelho)', () => {
    expect(geo.nearest(-29.95, -51.19).nome).toBe('Canoas');
    expect(geo.nearest(NaN, 0)).toBeNull();
  });
  it('lista as vizinhas dentro do raio, sem o próprio centro', () => {
    const vizinhas = geo.within(geo.coordsOf('Porto Alegre', 'RS'), 50);
    expect(vizinhas.map((c) => c.nome)).toEqual(['Canoas']);
  });
  it('⭐ o arquivo de verdade tem todas as cidades e as capitais nos lugares certos', async () => {
    const { default: dados } = await import('../geo/cidadesBR.data.js');
    const real = buildCityGeo(dados);
    expect(real.total).toBeGreaterThan(5500);
    expect(Object.keys(dados)).toHaveLength(27);
    const poa = real.coordsOf('porto alegre', 'RS');
    expect(poa.lat).toBeCloseTo(-30.03, 1);
    expect(real.coordsOf('Brasília', 'DF')).not.toBeNull();
    expect(real.coordsOf('São Paulo', 'SP')).not.toBeNull();
    // Canoas fica na região metropolitana
    expect(real.within(poa, 25).map((c) => c.nome)).toContain('Canoas');
  });
});
