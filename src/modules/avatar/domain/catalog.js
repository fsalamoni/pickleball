/**
 * O CATÁLOGO do avatar (puro). Cada id aqui é GRAVADO na receita
 * (`users.avatar.recipe`) e tem um par no servidor
 * (`functions/avatarAiPolicy.js`, que traduz o id no pedido da imagem — há
 * teste de paridade). Renomear um id faz a receita antiga cair no padrão
 * daquela parte. Acrescente no fim; não renomeie.
 *
 * Os rótulos saem por `tk()` e viram `t(rotulo)` na tela.
 */
import { tk } from '@/core/i18n';

const opt = (id, label, extra = {}) => Object.freeze({ id, label, ...extra });

export const BODIES = Object.freeze([
  opt('f', tk('Feminino')),
  opt('m', tk('Masculino')),
  opt('n', tk('Neutro')),
]);

export const AGES = Object.freeze([
  opt('young', tk('Jovem')),
  opt('adult', tk('Adulto')),
  opt('mature', tk('Maduro')),
  opt('senior', tk('Sênior')),
]);

export const BUILDS = Object.freeze([
  opt('slim', tk('Magro')),
  opt('average', tk('Médio')),
  opt('athletic', tk('Atlético')),
  opt('broad', tk('Forte')),
]);

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
  opt('longcurly', tk('Cacheado longo')),
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

export const BOTTOMS = Object.freeze([
  opt('shorts', tk('Short')),
  opt('skort', tk('Saia-short')),
  opt('leggings', tk('Legging')),
  opt('pants', tk('Calça')),
]);

/** Cores de roupa, acessório e raquete: a receita guarda o id, nunca o hex. */
export const GEAR_COLORS = Object.freeze([
  opt('lime', tk('Verde-limão'), { color: '#d4f82e' }),
  opt('green', tk('Verde'), { color: '#22c55e' }),
  opt('teal', tk('Azul-esverdeado'), { color: '#14b8a6' }),
  opt('sky', tk('Azul-claro'), { color: '#38bdf8' }),
  opt('blue', tk('Azul'), { color: '#2563eb' }),
  opt('navy', tk('Azul-marinho'), { color: '#1e3a8a' }),
  opt('purple', tk('Roxo'), { color: '#7c3aed' }),
  opt('pink', tk('Rosa'), { color: '#ec4899' }),
  opt('coral', tk('Coral'), { color: '#fb7185' }),
  opt('red', tk('Vermelho'), { color: '#ef4444' }),
  opt('orange', tk('Laranja'), { color: '#f97316' }),
  opt('yellow', tk('Amarelo'), { color: '#facc15' }),
  opt('white', tk('Branco'), { color: '#ffffff' }),
  opt('gray', tk('Cinza'), { color: '#9ca3af' }),
  opt('black', tk('Preto'), { color: '#0b0f19' }),
]);

/** Formatos da raquete de MARCA (cadastro do admin; a receita não os guarda). */
export const PADDLE_SHAPES = Object.freeze([
  opt('standard', tk('Padrão')),
  opt('elongated', tk('Alongada')),
  opt('wide', tk('Larga')),
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
  opt('thumbsup', tk('Joinha')),
]);

export const BACKGROUNDS = Object.freeze([
  opt('acid', tk('Limão'), { from: '#e8fb8c', to: '#b8de1f' }),
  opt('sky', tk('Céu'), { from: '#bfe3ff', to: '#5aa9f0' }),
  opt('sunset', tk('Pôr do sol'), { from: '#ffd59a', to: '#ff7a7a' }),
  opt('court', tk('Quadra'), { from: '#4f8fd6', to: '#2b5fa8' }),
  opt('mint', tk('Menta'), { from: '#c9f5e4', to: '#57c9a0' }),
  opt('grape', tk('Uva'), { from: '#d9c8ff', to: '#8a6be0' }),
  opt('night', tk('Noite'), { from: '#34405e', to: '#0b0f19' }),
  opt('paper', tk('Claro'), { from: '#ffffff', to: '#e9edf3' }),
]);

export const FRAMES = Object.freeze([
  opt('bust', tk('Rosto e ombros')),
  opt('full', tk('Corpo inteiro')),
]);

/** As listas por campo da receita — a normalização confere contra elas. */
export const RECIPE_OPTIONS = Object.freeze({
  body: BODIES,
  age: AGES,
  build: BUILDS,
  skin: SKIN_TONES,
  face: FACE_SHAPES,
  eyeColor: EYE_COLORS,
  hair: HAIR_STYLES,
  hairColor: HAIR_COLORS,
  beard: BEARDS,
  glasses: GLASSES,
  headwear: HEADWEAR,
  headwearColor: GEAR_COLORS,
  top: TOPS,
  topColor: GEAR_COLORS,
  bottom: BOTTOMS,
  bottomColor: GEAR_COLORS,
  paddleColor: GEAR_COLORS,
  expression: EXPRESSIONS,
  pose: POSES,
  background: BACKGROUNDS,
  frame: FRAMES,
});

/**
 * O que é da PESSOA (fica igual em "manter o rosto") e o que é do VISUAL
 * (o que a edição troca). O servidor usa a mesma divisão.
 */
export const IDENTITY_FIELDS = Object.freeze(['body', 'age', 'build', 'skin', 'face', 'eyeColor', 'hair', 'hairColor', 'beard', 'freckles']);
