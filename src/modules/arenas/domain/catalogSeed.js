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

import {
  CATALOG_CATEGORIES, buildDedupKey, normalizeCatalogProduct, stringHash,
  CATALOG_PRODUCT_SOURCE, CATALOG_PRODUCT_STATUS,
} from './productCatalog.js';

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

  /* ---------------- BEBIDAS — nacionais + regionais RS ---------------- */
  { category: BEBIDA, subcategory: 'Refrigerante', packs: SODA_PACKS, brands: [
    'Coca-Cola Sem Açúcar', 'Fanta Guaraná', 'Fanta Laranja Zero', 'Sprite Zero', 'Guaraná Antarctica Black',
    'Guaraná Jesus', 'Dolly Guaraná', 'Dolly Cola', 'Pureza Guaraná', 'Refrigerante Convenção Guaraná',
    'Refrigerante Convenção Laranja', 'Refrigerante Charrua Guaraná', 'Tri Legal Guaraná', 'Grapette Uva',
  ] },
  // Suco de uva integral — forte no RS (Serra Gaúcha, vinícolas/cooperativas).
  { category: BEBIDA, subcategory: 'Suco de uva integral', packs: [['Garrafa de vidro', '1,5L'], ['Garrafa de vidro', '1L'], ['Garrafa de vidro', '300ml'], ['Garrafa PET', '1,5L']], brands: [
    'Aurora Integral', 'Garibaldi Integral', 'Salton Integral', 'Casa Perini Integral', 'Cooperativa Garibaldi',
    'Dom Bosco Integral', 'Val Suco de Uva', 'Vinícola Perini', 'São João Integral',
  ] },
  { category: BEBIDA, subcategory: 'Suco', packs: JUICE_PACKS, brands: [
    'Del Valle Uva', 'Del Valle Caju', 'Del Valle Goiaba', 'Del Valle Abacaxi', 'Ades Maçã',
    'Ades Morango', 'Sufresh Laranja', 'Sufresh Uva', 'Maguary Néctar Manga', 'Camp Groselha',
  ] },
  { category: BEBIDA, subcategory: 'Suco em pó', packs: [['Sachê', '25g']], brands: [
    'Tang Laranja', 'Tang Uva', 'Tang Abacaxi', 'Clight Limão', 'Fresh Maracujá', 'MID Uva',
  ] },
  { category: BEBIDA, subcategory: 'Água', packs: WATER_PACKS, brands: [
    'Água da Pedra', 'Fonte Ijuí', 'Sarandi', 'Charrua Água Mineral', 'Nestlé Pureza Vital', 'São Lourenço',
  ] },
  { category: BEBIDA, subcategory: 'Água com gás', packs: [['Garrafa PET', '500ml'], ['Garrafa de vidro', '300ml']], brands: ['Água da Pedra com gás', 'Charrua com gás', 'Perrier'] },
  { category: BEBIDA, subcategory: 'Água saborizada', packs: [['Garrafa PET', '500ml']], brands: ['Crystal Fresh Tangerina', 'H2OH! Limoneto', 'H2OH! Maçã Verde', 'Aquarius Fresh Limão'] },
  { category: BEBIDA, subcategory: 'Água de coco', packs: [['Caixinha (Tetra Pak)', '200ml'], ['Caixinha (Tetra Pak)', '1L'], ['Garrafa PET', '500ml']], brands: ['Kero Coco', 'Sococo', 'Ducoco', 'Obrigado'] },
  { category: BEBIDA, subcategory: 'Energético', packs: ENERGY_PACKS, brands: ['Red Bull Melancia', 'Monster Ultra', 'TNT Energy', 'Fusion Tropical', 'Baly Melancia', 'Reef', 'Flying Horse'] },
  { category: BEBIDA, subcategory: 'Isotônico', packs: ISO_PACKS, brands: ['Gatorade Frutas Cítricas', 'Gatorade Morango e Maracujá', 'Powerade Ice', 'Powerade Morango', 'i9 Sport'] },
  // Repositores / hidratação com sais (esporte).
  { category: BEBIDA, subcategory: 'Repositor hidroeletrolítico', packs: [['Sachê', '30g'], ['Garrafa PET', '500ml']], brands: ['Hidrafix Coco', 'Hidrafix Uva', 'Rehidrat Laranja', 'Repomax', 'Pedialyte'] },
  { category: BEBIDA, subcategory: 'Bebida esportiva', packs: [['Garrafa PET', '500ml'], ['Sachê', '30g']], brands: ['Carb Up Gel Morango', 'Whey Shake Baunilha', 'BCAA Drink Limão', 'Isotônico em pó Laranja'] },
  { category: BEBIDA, subcategory: 'Kombucha', packs: [['Garrafa de vidro', '355ml']], brands: ['Kombucha Gengibre', 'Kombucha Hibisco', 'Kombucha Frutas Vermelhas'] },
  { category: BEBIDA, subcategory: 'Chá gelado', packs: [['Garrafa PET', '450ml'], ['Lata', '340ml']], brands: ['Lipton Verde', 'Leão Ice Tea Manga', 'Feel Good Pêssego', 'Chá Mate Leão Gelado Natural', 'Matte Couro Gelado'] },
  { category: BEBIDA, subcategory: 'Cerveja', packs: BEER_PACKS, brands: [
    'Polar Export', 'Polar Pilsen', 'Serramalte', 'Bohemia', 'Itaipava', 'Petra', 'Coruja Extra',
    'Eisenbahn Pilsen', 'Patagonia', 'Colônia',
  ] },
  { category: BEBIDA, subcategory: 'Cerveja sem álcool', packs: [['Lata', '350ml'], ['Long neck', '330ml']], brands: ['Heineken 0.0', 'Budweiser Zero', 'Ambev Zero', 'Beck\'s Zero'] },
  // Chimarrão / erva-mate — cultura forte no RS.
  { category: BEBIDA, subcategory: 'Erva-mate (chimarrão)', packs: [['Pacote', '1kg'], ['Pacote', '500g']], brands: ['Ximango', 'Barão', 'Madrugada', 'Nobre', 'Canarinho', 'Piporé', 'Aymoré Erva-Mate'] },
  { category: BEBIDA, subcategory: 'Chá mate (tererê)', packs: [['Pacote', '500g']], brands: ['Mate para Tererê Natural', 'Mate para Tererê Limão'] },
  { category: BEBIDA, subcategory: 'Café', packs: [['Copo', '100ml'], ['Copo', '200ml'], ['Caixinha (Tetra Pak)', '200ml']], brands: ['Café Expresso', 'Café com Leite', 'Cappuccino', 'Café Coado', 'Café Gelado'] },
  { category: BEBIDA, subcategory: 'Achocolatado', packs: [['Caixinha (Tetra Pak)', '200ml']], brands: ['Toddynho', 'Nescau Prontinho', 'Chocomil', 'Italac Achocolatado'] },
  { category: BEBIDA, subcategory: 'Iogurte líquido', packs: [['Garrafa PET', '170g'], ['Garrafa PET', '900g']], brands: ['Danone Morango', 'Yakult', 'Activia Líquido', 'Elegê Bewin', 'Nestlé Chamyto'] },

  /* ------------------- COMIDAS — nacionais + RS ---------------------- */
  { category: COMIDA, subcategory: 'Salgadinho', packs: CHIPS_PACKS, brands: [
    'Ruffles Queijo', 'Doritos Sweet Chili', 'Doritos Nacho', 'Lay\'s Churrasco', 'Cheetos Onda Requeijão',
    'Cheetos Bola Queijo', 'Fandangos Queijo', 'Torcida Churrasco', 'Torcida Cebola', 'Pingo d\'Ouro Original',
    'Stiksy', 'Baconzitos', 'Doritos Queijo Nacho Dinamite',
  ] },
  { category: COMIDA, subcategory: 'Salgadinho assado', packs: [['Pacote', '50g']], brands: ['Passatempo Salgadinho', 'Club Social Integral', 'Pipoca Doce', 'Pipoca Salgada', 'Snack de Grão-de-bico'] },
  { category: COMIDA, subcategory: 'Chocolate', packs: CHOC_PACKS, brands: [
    'Neugebauer ao Leite', 'Neugebauer Amargo 70%', 'Neugebauer Branco', 'Neugebauer Bib\'s', 'Neugebauer Talismã',
    'Kit Kat', 'Lacta ao Leite', 'Nestlé Classic', 'Garoto Talento', 'Baton', 'Bis Xtra', 'Chokito', 'Prestígio', 'Sonho de Valsa',
  ] },
  { category: COMIDA, subcategory: 'Biscoito', packs: [['Pacote', '100g'], ['Pacote', '140g'], ['Pacote', '200g']], brands: [
    'Isabela Cream Cracker', 'Isabela Maisena', 'Isabela Wafer Chocolate', 'Isabela Salclic', 'Club Social Original',
    'Trakinas Morango', 'Oreo Original', 'Passatempo Recheado', 'Bono Morango', 'Negresco', 'Maria Aymoré', 'Zabet',
  ] },
  { category: COMIDA, subcategory: 'Barra de cereal', packs: [['Unidade', '25g']], brands: ['Trio Original', 'Nutry Coco', 'Ritter Castanhas', 'Kellogg\'s Frutas', 'Nesfit Banana'] },
  { category: COMIDA, subcategory: 'Barra de proteína', packs: [['Unidade', '30g'], ['Unidade', '45g']], brands: ['Bold Bar Amendoim', 'Whey Bar Chocolate', 'Integral Médica Protein Crisp', 'Probiótica Top Whey Bar', 'Barra Proteica Coco'] },
  { category: COMIDA, subcategory: 'Bala/Goma', packs: [['Pacote', '80g']], brands: ['Fini Bananinha', 'Fini Tubes', 'Halls Menta', 'Halls Melancia', 'Trident Melancia', 'Mentos Menta', 'Bala Juquinha'] },
  { category: COMIDA, subcategory: 'Amendoim/Castanha', packs: [['Pacote', '50g'], ['Pacote', '150g']], brands: ['Amendoim Japonês Dori', 'Amendoim Doce', 'Castanha de Caju', 'Castanha-do-pará', 'Mix de Castanhas', 'Nozes', 'Mendorato Pé de Moleque'] },
  { category: COMIDA, subcategory: 'Fruta seca / mix saudável', packs: [['Pacote', '100g'], ['Pote', '150g']], brands: ['Mix de Frutas Secas', 'Uva-passa', 'Damasco Seco', 'Banana-passa', 'Chips de Banana'] },
  { category: COMIDA, subcategory: 'Salgado', packs: [['Unidade', 'Unidade']], brands: [
    'Coxinha de Frango', 'Coxinha com Catupiry', 'Pastel de Carne', 'Pastel de Queijo', 'Pastel de Palmito',
    'Enroladinho de Salsicha', 'Empada de Frango', 'Empada de Palmito', 'Kibe', 'Esfiha de Carne', 'Esfiha de Queijo',
    'Croquete de Carne', 'Bolinha de Queijo', 'Risole de Camarão', 'Bauru', 'Joelho de Presunto',
  ] },
  { category: COMIDA, subcategory: 'Salgado assado', packs: [['Unidade', 'Unidade']], brands: ['Pão de Queijo', 'Chipa', 'Empada Assada de Frango', 'Croissant de Presunto e Queijo', 'Enroladinho Assado'] },
  { category: COMIDA, subcategory: 'Lanche', packs: [['Unidade', 'Unidade']], brands: [
    'Xis Salada', 'Xis Bacon', 'Xis Coração', 'Xis Egg', 'Xis Tudo', 'X-Burguer', 'X-Salada', 'X-Bacon',
    'Cachorro-quente Simples', 'Cachorro-quente Completo', 'Bauru no Pão', 'Misto Quente', 'Beirute',
  ] },
  { category: COMIDA, subcategory: 'Sanduíche natural', packs: [['Unidade', 'Unidade']], brands: ['Sanduíche Natural de Frango', 'Sanduíche Natural de Atum', 'Sanduíche Natural Vegetariano', 'Wrap de Frango'] },
  { category: COMIDA, subcategory: 'Tapioca', packs: [['Unidade', 'Unidade']], brands: ['Tapioca de Queijo', 'Tapioca de Frango', 'Tapioca Doce (banana)', 'Tapioca de Coco'] },
  { category: COMIDA, subcategory: 'Pizza', packs: [['Fatia', 'Fatia'], ['Unidade', 'Broto'], ['Unidade', 'Grande']], brands: ['Pizza Mussarela', 'Pizza Calabresa', 'Pizza Portuguesa', 'Pizza Frango com Catupiry', 'Pizza Marguerita', 'Pizza Quatro Queijos'] },
  { category: COMIDA, subcategory: 'Porção', packs: [['Bandeja', 'Porção']], brands: ['Batata Frita', 'Batata com Cheddar e Bacon', 'Mandioca Frita', 'Frango a Passarinho', 'Isca de Peixe', 'Polenta Frita', 'Calabresa Acebolada', 'Nuggets'] },
  { category: COMIDA, subcategory: 'Açaí', packs: [['Copo', '300ml'], ['Copo', '500ml'], ['Pote', '300ml']], brands: ['Açaí na Tigela', 'Açaí com Granola', 'Açaí com Banana', 'Açaí com Morango', 'Açaí Zero Açúcar'] },
  { category: COMIDA, subcategory: 'Sorvete', packs: [['Unidade', 'Unidade'], ['Pote', '1L']], brands: ['Picolé de Fruta', 'Magnum Amêndoas', 'Kibon Cornetto', 'Eskimó Casquinha', 'Sorvete de Massa Chocolate', 'Açaí Gelado'] },
  { category: COMIDA, subcategory: 'Doce', packs: [['Unidade', 'Unidade']], brands: ['Brigadeiro', 'Beijinho', 'Cuca de Banana (fatia)', 'Cuca de Uva (fatia)', 'Sonho', 'Pastel de Nata', 'Doce de Leite Colonial', 'Bolo de Pote', 'Pudim (fatia)'] },
  { category: COMIDA, subcategory: 'Fruta', packs: [['Unidade', 'Unidade']], brands: ['Banana', 'Maçã', 'Laranja', 'Mexerica', 'Uva (cacho)'] },
  { category: COMIDA, subcategory: 'Iogurte', packs: [['Pote', '170g']], brands: ['Iogurte Natural', 'Iogurte Grego', 'Iogurte com Granola', 'Danone Morango Pote'] },
  { category: COMIDA, subcategory: 'Ovo/Snack proteico', packs: [['Unidade', 'Unidade'], ['Pacote', '2 un']], brands: ['Ovo de Codorna (pacote)', 'Ovo Cozido', 'Snack de Grão-de-bico'] },

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
  const seen = new Set();
  for (const g of GROUPS) {
    for (const p of expand(g)) {
      const key = buildDedupKey(p);
      if (seen.has(key)) continue; // evita duplicatas entre grupos (mesmo item)
      seen.add(key);
      all.push(p);
    }
  }
  return all;
}

/** Quantidade estimada de itens da semente (para exibir na UI de admin). */
export function catalogSeedCount() {
  return buildCatalogSeed().length;
}

let _seedProductsCache = null;

/**
 * Produtos-semente já NORMALIZADOS e com id sintético estável (`seed_<hash>`
 * derivado da `dedup_key`). É o que torna o catálogo padrão SEMPRE disponível
 * nos mercados das arenas — sem depender de "popular" nada no Firestore. O
 * serviço mescla esta lista com as contribuições/edições guardadas no Firestore.
 * @returns {object[]}
 */
export function buildSeedCatalogProducts() {
  if (_seedProductsCache) return _seedProductsCache;
  const out = [];
  for (const raw of buildCatalogSeed()) {
    const { valid, value } = normalizeCatalogProduct({
      ...raw,
      source: CATALOG_PRODUCT_SOURCE.PLATFORM,
      status: CATALOG_PRODUCT_STATUS.ACTIVE,
    });
    if (!valid) continue;
    out.push({ id: `seed_${stringHash(value.dedup_key)}`, seed: true, ...value });
  }
  _seedProductsCache = out;
  return out;
}
