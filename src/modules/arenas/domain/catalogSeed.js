/**
 * Semente do CATÁLOGO PADRÃO (flag arena_product_catalog).
 *
 * Gera centenas de produtos reais do dia a dia de uma arena/lanchonete BR,
 * combinando marca × embalagem/tamanho por subcategoria. É DADO PURO — o
 * serviço (`catalogService.seedCatalog`) normaliza cada item
 * (`normalizeCatalogProduct`) e grava em `catalog_products`.
 *
 * Manter aditivo: acrescentar itens não quebra nada; o seed é idempotente por
 * `dedup_key` (não recria o que já existe).
 */

import { CATALOG_CATEGORIES } from './productCatalog.js';

const { BEBIDA, COMIDA, ACESSORIOS, BOLA, RAQUETE, VESTUARIO, EQUIPAMENTO } = CATALOG_CATEGORIES;

/**
 * Expande um grupo { category, subcategory, brands[], packs[[packaging,size]] }
 * em uma lista de produtos { name, brand, category, subcategory, packaging, size }.
 * O nome é montado como "Marca [sabor] size".
 */
function expand(group) {
  const out = [];
  const packs = group.packs && group.packs.length ? group.packs : [[group.packaging || '', group.size || '']];
  const brands = group.brands && group.brands.length ? group.brands : [group.brand || ''];
  for (const brand of brands) {
    for (const [packaging, size] of packs) {
      const namePieces = [brand, group.flavor, size].filter(Boolean);
      out.push({
        name: namePieces.join(' ').trim() || brand,
        brand,
        category: group.category,
        subcategory: group.subcategory,
        packaging,
        size,
        unit: group.unit || 'un',
        flavor: group.flavor || '',
      });
    }
  }
  return out;
}

/** Embalagens típicas de refrigerante/bebida gaseificada. */
const SODA_PACKS = [['Lata', '350ml'], ['Lata', '220ml'], ['Garrafa PET', '600ml'], ['Garrafa PET', '2L'], ['Garrafa de vidro', '290ml']];
const WATER_PACKS = [['Garrafa PET', '500ml'], ['Garrafa PET', '1,5L'], ['Copo', '200ml']];
const JUICE_PACKS = [['Caixinha (Tetra Pak)', '200ml'], ['Garrafa PET', '450ml'], ['Garrafa PET', '900ml']];
const BEER_PACKS = [['Lata', '350ml'], ['Lata', '473ml'], ['Long neck', '355ml'], ['Garrafa de vidro', '600ml']];
const ENERGY_PACKS = [['Lata', '250ml'], ['Lata', '473ml']];
const ISO_PACKS = [['Garrafa PET', '500ml']];
const CHIPS_PACKS = [['Pacote', '100g'], ['Pacote', '50g']];
const CHOC_PACKS = [['Unidade', '90g'], ['Unidade', '30g']];

const GROUPS = [
  /* ------------------------------ BEBIDAS ------------------------------ */
  { category: BEBIDA, subcategory: 'Refrigerante', packs: SODA_PACKS, brands: [
    'Coca-Cola', 'Coca-Cola Zero', 'Guaraná Antarctica', 'Guaraná Antarctica Zero', 'Fanta Laranja',
    'Fanta Uva', 'Sprite', 'Pepsi', 'Pepsi Black', 'Guaraná Kuat', 'Schweppes Tônica', 'Soda Limonada', 'Sukita Laranja',
  ] },
  { category: BEBIDA, subcategory: 'Suco', packs: JUICE_PACKS, brands: [
    'Del Valle Uva', 'Del Valle Laranja', 'Del Valle Manga', 'Del Valle Maracujá', 'Del Valle Pêssego',
    'Ades Uva', 'Ades Laranja', 'Natural One Laranja', 'Su Fruit Uva',
  ] },
  { category: BEBIDA, subcategory: 'Água', packs: WATER_PACKS, brands: ['Crystal', 'Bonafont', 'Indaiá', 'Minalba'] },
  { category: BEBIDA, subcategory: 'Água com gás', packs: [['Garrafa PET', '500ml']], brands: ['Crystal com gás', 'Minalba com gás'] },
  { category: BEBIDA, subcategory: 'Água saborizada', packs: [['Garrafa PET', '500ml']], brands: ['Crystal Fresh Limão', 'H2OH! Limoneto', 'H2OH! Limão'] },
  { category: BEBIDA, subcategory: 'Energético', packs: ENERGY_PACKS, brands: ['Red Bull', 'Red Bull Tropical', 'Monster Energy', 'Monster Mango Loco', 'TNT', 'Fusion', 'Baly'] },
  { category: BEBIDA, subcategory: 'Isotônico', packs: ISO_PACKS, brands: ['Gatorade Laranja', 'Gatorade Uva', 'Gatorade Limão', 'Gatorade Maracujá', 'Powerade Mountain Blast', 'Marathon Tangerina'] },
  { category: BEBIDA, subcategory: 'Chá gelado', packs: [['Garrafa PET', '450ml'], ['Lata', '340ml']], brands: ['Lipton Pêssego', 'Lipton Limão', 'Leão Ice Tea Pêssego', 'Leão Ice Tea Limão', 'Matte Leão Natural'] },
  { category: BEBIDA, subcategory: 'Cerveja', packs: BEER_PACKS, brands: ['Heineken', 'Budweiser', 'Brahma', 'Skol', 'Antarctica', 'Amstel', 'Stella Artois', 'Corona', 'Original', 'Spaten'] },
  { category: BEBIDA, subcategory: 'Cerveja sem álcool', packs: [['Lata', '350ml'], ['Long neck', '330ml']], brands: ['Heineken 0.0', 'Budweiser Zero', 'Brahma Zero'] },
  { category: BEBIDA, subcategory: 'Coco', packs: [['Caixinha (Tetra Pak)', '200ml'], ['Caixinha (Tetra Pak)', '1L']], brands: ['Kero Coco', 'Sococo'] },
  { category: BEBIDA, subcategory: 'Achocolatado', packs: [['Caixinha (Tetra Pak)', '200ml']], brands: ['Toddynho', 'Nescau Prontinho'] },
  { category: BEBIDA, subcategory: 'Café', packs: [['Copo', '100ml'], ['Copo', '200ml']], brands: ['Café expresso', 'Café com leite', 'Cappuccino'] },

  /* ------------------------------ COMIDAS ------------------------------ */
  { category: COMIDA, subcategory: 'Salgadinho', packs: CHIPS_PACKS, brands: [
    'Ruffles Original', 'Ruffles Cebola e Salsa', 'Doritos Queijo Nacho', 'Lay\'s Clássica',
    'Cheetos Requeijão', 'Cheetos Lua', 'Fandangos Presunto', 'Torcida Costela', 'Elma Chips Baconzitos',
  ] },
  { category: COMIDA, subcategory: 'Chocolate', packs: CHOC_PACKS, brands: [
    'Kit Kat', 'Chocolate Lacta ao Leite', 'Chocolate Nestlé Classic', 'Talento Amêndoas', 'Bis', 'Trento', 'Baton',
  ] },
  { category: COMIDA, subcategory: 'Biscoito', packs: [['Pacote', '100g'], ['Pacote', '140g']], brands: ['Club Social Original', 'Trakinas Chocolate', 'Oreo', 'Passatempo', 'Bono Chocolate'] },
  { category: COMIDA, subcategory: 'Barra de cereal', packs: [['Unidade', '25g']], brands: ['Trio Castanhas', 'Nutry Banana', 'Ritter Morango', 'Kellogg\'s Chocolate'] },
  { category: COMIDA, subcategory: 'Bala/Goma', packs: [['Pacote', '80g']], brands: ['Fini Beijos', 'Fini Dentaduras', 'Halls Extra Forte', 'Trident Menta'] },
  { category: COMIDA, subcategory: 'Amendoim/Castanha', packs: [['Pacote', '50g'], ['Pacote', '150g']], brands: ['Amendoim Japonês Dori', 'Amendoim Salgado', 'Castanha de Caju', 'Mendorato'] },
  { category: COMIDA, subcategory: 'Salgado', packs: [['Unidade', 'Unidade']], brands: ['Coxinha', 'Pastel de Carne', 'Pastel de Queijo', 'Enroladinho de Salsicha', 'Empada de Frango', 'Kibe', 'Esfiha de Carne'] },
  { category: COMIDA, subcategory: 'Lanche', packs: [['Unidade', 'Unidade']], brands: ['X-Burguer', 'X-Salada', 'X-Bacon', 'Misto Quente', 'Hot Dog', 'Cachorro-quente completo'] },
  { category: COMIDA, subcategory: 'Sanduíche', packs: [['Unidade', 'Unidade']], brands: ['Sanduíche Natural de Frango', 'Sanduíche Natural de Atum'] },
  { category: COMIDA, subcategory: 'Pizza', packs: [['Fatia', 'Fatia'], ['Unidade', 'Broto'], ['Unidade', 'Grande']], brands: ['Pizza Mussarela', 'Pizza Calabresa', 'Pizza Portuguesa', 'Pizza Frango com Catupiry'] },
  { category: COMIDA, subcategory: 'Porção', packs: [['Bandeja', 'Porção']], brands: ['Porção de Batata Frita', 'Porção de Mandioca', 'Porção de Frango a Passarinho', 'Porção de Calabresa'] },
  { category: COMIDA, subcategory: 'Açaí', packs: [['Copo', '300ml'], ['Copo', '500ml']], brands: ['Açaí na Tigela', 'Açaí com Granola'] },
  { category: COMIDA, subcategory: 'Sorvete', packs: [['Unidade', 'Unidade']], brands: ['Picolé Frutas', 'Sorvete de Massa', 'Magnum Clássico', 'Kibon Cornetto'] },
  { category: COMIDA, subcategory: 'Fruta', packs: [['Unidade', 'Unidade']], brands: ['Banana', 'Maçã', 'Laranja'] },

  /* ---------------------- ACESSÓRIOS / ESPORTE ------------------------- */
  { category: ACESSORIOS, subcategory: 'Overgrip', packs: [['Unidade', 'Unidade'], ['Pacote', '3 un']], brands: ['Overgrip Preto', 'Overgrip Branco', 'Overgrip Colorido'] },
  { category: ACESSORIOS, subcategory: 'Grip', packs: [['Unidade', 'Unidade']], brands: ['Grip de Reposição'] },
  { category: ACESSORIOS, subcategory: 'Munhequeira', packs: [['Dupla', 'Par']], brands: ['Munhequeira Curta', 'Munhequeira Longa'] },
  { category: ACESSORIOS, subcategory: 'Toalha', packs: [['Unidade', 'Unidade']], brands: ['Toalha Esportiva'] },
  { category: ACESSORIOS, subcategory: 'Boné', packs: [['Unidade', 'Unidade']], brands: ['Boné da Arena', 'Viseira'] },
  { category: ACESSORIOS, subcategory: 'Meia', packs: [['Dupla', 'Par']], brands: ['Meia Esportiva Cano Médio'] },
  { category: BOLA, subcategory: 'Bola outdoor', packs: [['Unidade', 'Unidade'], ['Pacote', '3 un'], ['Pacote', '6 un']], brands: ['Franklin X-40', 'Onix Pure 2', 'Bola Outdoor Amarela'] },
  { category: BOLA, subcategory: 'Bola indoor', packs: [['Unidade', 'Unidade'], ['Pacote', '3 un']], brands: ['Onix Fuse Indoor', 'Bola Indoor Branca'] },
  { category: RAQUETE, subcategory: 'Raquete', packs: [['Unidade', 'Unidade']], brands: ['Raquete Iniciante', 'Raquete Intermediária', 'Raquete Fibra de Carbono'] },
  { category: RAQUETE, subcategory: 'Case', packs: [['Unidade', 'Unidade']], brands: ['Case para Raquete'] },
  { category: VESTUARIO, subcategory: 'Camiseta', packs: [['Unidade', 'P'], ['Unidade', 'M'], ['Unidade', 'G'], ['Unidade', 'GG']], brands: ['Camiseta Dry da Arena'] },
  { category: EQUIPAMENTO, subcategory: 'Marcador de placar', packs: [['Unidade', 'Unidade']], brands: ['Placar Manual de Mesa'] },
];

/**
 * Constrói a lista completa de produtos-semente (crus, não normalizados).
 * @returns {object[]}
 */
export function buildCatalogSeed() {
  const all = [];
  for (const g of GROUPS) all.push(...expand(g));
  return all;
}

/** Quantidade estimada de itens da semente (para exibir na UI de admin). */
export function catalogSeedCount() {
  return buildCatalogSeed().length;
}
