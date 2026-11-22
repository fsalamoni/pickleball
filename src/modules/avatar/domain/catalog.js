/**
 * O CATÁLOGO do avatar (puro). Cada id aqui é GRAVADO na receita
 * (`users.avatar.recipe`) — renomear um id faz a receita antiga cair no
 * padrão daquela parte. Acrescente; não renomeie.
 *
 * Os rótulos saem por `tk()` e viram `t(rotulo)` na tela.
 */
import { tk } from '@/core/i18n';

const opt = (id, label, extra = {}) => Object.freeze({ id, label, ...extra });

/** Tons de pele: do mais claro ao mais escuro. */
export const SKIN_TONES = Object.freeze([
  opt('s1', tk('Porcelana'), { color: '#fbe3d4' }),
  opt('s2', tk('Clara'), { color: '#f6d2bb' }),
  opt('s3', tk('Rosada'), { color: '#f2c4a8' }),
  opt('s4', tk('Dourada'), { color: '#e9b48c' }),
  opt('s5', tk('Morena clara'), { color: '#d99f76' }),
  opt('s6', tk('Bronze'), { color: '#c4875d' }),
  opt('s7', tk('Morena'), { color: '#a96d47' }),
  opt('s8', tk('Canela'), { color: '#8c5636' }),
  opt('s9', tk('Escura'), { color: '#6c3f27' }),
  opt('s10', tk('Retinta'), { color: '#4d2b1b' }),
]);

export const FACE_SHAPES = Object.freeze([
  opt('oval', tk('Oval')),
  opt('round', tk('Redondo')),
  opt('square', tk('Quadrado')),
  opt('heart', tk('Coração')),
]);

export const EYE_SHAPES = Object.freeze([
  opt('round', tk('Redondos')),
  opt('almond', tk('Amendoados')),
  opt('wide', tk('Grandes')),
  opt('hooded', tk('Puxados')),
  opt('lashes', tk('Com cílios')),
]);

export const EYE_COLORS = Object.freeze([
  opt('brown', tk('Castanho'), { color: '#6b3e1f' }),
  opt('dark', tk('Escuro'), { color: '#3a2414' }),
  opt('hazel', tk('Mel'), { color: '#9a6a2c' }),
  opt('green', tk('Verde'), { color: '#4f8a4b' }),
  opt('blue', tk('Azul'), { color: '#3f7fc4' }),
  opt('gray', tk('Cinza'), { color: '#7d8a99' }),
  opt('amber', tk('Âmbar'), { color: '#c48a1d' }),
  opt('teal', tk('Azul-esverdeado'), { color: '#2f8c8a' }),
]);

export const BROWS = Object.freeze([
  opt('natural', tk('Naturais')),
  opt('thick', tk('Grossas')),
  opt('arched', tk('Arqueadas')),
  opt('straight', tk('Retas')),
  opt('thin', tk('Finas')),
]);

export const NOSES = Object.freeze([
  opt('button', tk('Pequeno')),
  opt('soft', tk('Arredondado')),
  opt('wide', tk('Largo')),
  opt('long', tk('Fino')),
]);

export const HAIR_STYLES = Object.freeze([
  opt('buzz', tk('Raspado')),
  opt('short', tk('Curto')),
  opt('quiff', tk('Topete')),
  opt('side', tk('Repartido')),
  opt('curly', tk('Cacheado curto')),
  opt('afro', tk('Black power')),
  opt('ponytail', tk('Rabo de cavalo')),
  opt('bun', tk('Coque')),
  opt('braids', tk('Tranças')),
  opt('bob', tk('Chanel')),
  opt('long', tk('Longo liso')),
  opt('wavy', tk('Ondulado')),
  opt('locs', tk('Dreads')),
  opt('bald', tk('Careca')),
]);

export const HAIR_COLORS = Object.freeze([
  opt('black', tk('Preto'), { color: '#1f1a17' }),
  opt('darkbrown', tk('Castanho-escuro'), { color: '#3b2418' }),
  opt('brown', tk('Castanho'), { color: '#6a3f22' }),
  opt('lightbrown', tk('Castanho-claro'), { color: '#9a6a3f' }),
  opt('blonde', tk('Loiro'), { color: '#d9b26a' }),
  opt('platinum', tk('Platinado'), { color: '#ece0c8' }),
  opt('red', tk('Ruivo'), { color: '#b34a24' }),
  opt('gray', tk('Grisalho'), { color: '#a7a7ad' }),
  opt('white', tk('Branco'), { color: '#eeeef0' }),
  opt('pink', tk('Rosa'), { color: '#e57ba8' }),
  opt('blue', tk('Azul'), { color: '#3c6fd8' }),
  opt('lime', tk('Verde-limão'), { color: '#b9e02a' }),
]);

export const BEARDS = Object.freeze([
  opt('none', tk('Sem barba')),
  opt('stubble', tk('Barba por fazer')),
  opt('mustache', tk('Bigode')),
  opt('goatee', tk('Cavanhaque')),
  opt('short', tk('Curta')),
  opt('full', tk('Cheia')),
]);

export const GLASSES = Object.freeze([
  opt('none', tk('Sem óculos')),
  opt('sport', tk('De sol esportivo')),
  opt('round', tk('Redondo')),
  opt('square', tk('Quadrado')),
]);

export const HEADWEAR = Object.freeze([
  opt('none', tk('Nada')),
  opt('visor', tk('Viseira')),
  opt('cap', tk('Boné')),
  opt('cap_back', tk('Boné para trás')),
  opt('headband', tk('Faixa')),
  opt('bucket', tk('Chapéu bucket')),
]);

export const TOPS = Object.freeze([
  opt('tee', tk('Camiseta')),
  opt('polo', tk('Polo')),
  opt('tank', tk('Regata')),
  opt('longsleeve', tk('Manga longa')),
  opt('dress', tk('Vestido')),
]);

export const TOP_PATTERNS = Object.freeze([
  opt('solid', tk('Lisa')),
  opt('side', tk('Faixa lateral')),
  opt('band', tk('Faixa no peito')),
  opt('chevron', tk('Chevron')),
  opt('split', tk('Duas cores')),
]);

export const CHEST_MARKS = Object.freeze([
  opt('none', tk('Nada')),
  opt('ball', tk('Bola')),
  opt('rush', tk('PickleRush')),
  opt('number', tk('Número')),
]);

export const BOTTOMS = Object.freeze([
  opt('shorts', tk('Short')),
  opt('skort', tk('Saia-short')),
  opt('leggings', tk('Legging')),
  opt('pants', tk('Calça')),
]);

export const SOCKS = Object.freeze([
  opt('low', tk('Soquete')),
  opt('crew', tk('Cano médio')),
]);

export const PADDLE_SHAPES = Object.freeze([
  opt('standard', tk('Padrão')),
  opt('elongated', tk('Alongada')),
  opt('wide', tk('Larga')),
]);

export const PADDLE_ARTS = Object.freeze([
  opt('plain', tk('Lisa')),
  opt('stripes', tk('Listras')),
  opt('flame', tk('Chamas')),
  opt('fade', tk('Degradê')),
  opt('carbon', tk('Carbono')),
  opt('rush', tk('PickleRush')),
]);

export const BALL_COLORS = Object.freeze([
  opt('yellow', tk('Amarela'), { color: '#f4dd2b' }),
  opt('lime', tk('Verde-limão'), { color: '#c9ef3b' }),
  opt('orange', tk('Laranja'), { color: '#ff8a1f' }),
]);

export const EXPRESSIONS = Object.freeze([
  opt('smile', tk('Sorriso')),
  opt('grin', tk('Sorrisão')),
  opt('focus', tk('Focado')),
  opt('wink', tk('Piscadinha')),
  opt('wow', tk('Surpreso')),
  opt('laugh', tk('Gargalhada')),
  opt('cool', tk('Confiante')),
  opt('shout', tk('Vamos!')),
]);

export const POSES = Object.freeze([
  opt('ready', tk('Pronto')),
  opt('serve', tk('Saque')),
  opt('shoulder', tk('Raquete no ombro')),
  opt('celebrate', tk('Comemoração')),
  opt('wave', tk('Aceno')),
]);

export const BACKGROUNDS = Object.freeze([
  opt('acid', tk('Limão'), { from: '#e8fb8c', to: '#b8de1f' }),
  opt('sky', tk('Céu'), { from: '#bfe3ff', to: '#5aa9f0' }),
  opt('sunset', tk('Pôr do sol'), { from: '#ffd59a', to: '#ff7a7a' }),
  opt('court', tk('Quadra'), { from: '#4f8fd6', to: '#2b5fa8', court: true }),
  opt('mint', tk('Menta'), { from: '#c9f5e4', to: '#57c9a0' }),
  opt('grape', tk('Uva'), { from: '#d9c8ff', to: '#8a6be0' }),
  opt('night', tk('Noite'), { from: '#34405e', to: '#0b0f19' }),
  opt('paper', tk('Claro'), { from: '#ffffff', to: '#e9edf3' }),
]);

/**
 * Cores das roupas, da raquete e dos acessórios. A receita aceita qualquer
 * `#rrggbb`; a tela oferece esta paleta (combina com a marca e entre si).
 */
export const GEAR_COLORS = Object.freeze([
  '#d4f82e', '#a6c61a', '#22c55e', '#0f766e', '#14b8a6', '#38bdf8',
  '#2563eb', '#1e3a8a', '#7c3aed', '#c026d3', '#ec4899', '#ef4444',
  '#f97316', '#f59e0b', '#facc15', '#ffffff', '#e5e7eb', '#9ca3af',
  '#4b5563', '#1f2937', '#0b0f19', '#7c2d12', '#d6b48a', '#fbcfe8',
]);

/** As listas por campo da receita — a normalização confere contra elas. */
export const RECIPE_OPTIONS = Object.freeze({
  skin: SKIN_TONES,
  face: FACE_SHAPES,
  eyes: EYE_SHAPES,
  eyeColor: EYE_COLORS,
  brows: BROWS,
  nose: NOSES,
  hair: HAIR_STYLES,
  hairColor: HAIR_COLORS,
  beard: BEARDS,
  glasses: GLASSES,
  headwear: HEADWEAR,
  top: TOPS,
  topPattern: TOP_PATTERNS,
  chestMark: CHEST_MARKS,
  bottom: BOTTOMS,
  socks: SOCKS,
  paddleShape: PADDLE_SHAPES,
  paddleArt: PADDLE_ARTS,
  ball: BALL_COLORS,
  expression: EXPRESSIONS,
  pose: POSES,
  background: BACKGROUNDS,
});

/** Os campos de COR livre (`#rrggbb`) da receita. */
export const RECIPE_COLOR_FIELDS = Object.freeze([
  'glassesColor', 'headwearColor', 'topColor', 'topColor2', 'bottomColor',
  'shoesColor', 'socksColor', 'paddleColor', 'paddleColor2', 'paddleEdge', 'paddleGrip',
]);

/** Acha a opção pelo id (ou a primeira da lista). */
export function optionOf(list, id) {
  return list.find((o) => o.id === id) || list[0];
}
