/**
 * Onde pôr as câmeras — as POSIÇÕES possíveis e os ARRANJOS (quantas câmeras
 * e em quais posições), com o que cada uma enxerga bem.
 *
 * O que decide cada posição é a geometria, não o gosto:
 *
 * · **Fundo (alta, atrás da linha de fundo)** — vê a quadra inteira e o quique
 *   como uma quina na trajetória (desce na imagem e passa a subir). É a melhor
 *   câmera ÚNICA. Vê os pés de quem está na cozinha do outro lado de frente,
 *   pequenos, e os do seu lado de costas.
 * · **No alto, no centro (de cima para baixo)** — o chão sai quase sem
 *   perspectiva: ONDE a bola caiu fica muito preciso, nos dois fundos igual.
 *   Mas de cima não se vê a bola descer: a altura dela não aparece na imagem.
 *   O motor reconhece o quique pela freada brusca da bola no chão (modo
 *   `overhead`), que é menos certo que a quina vista de lado; e de cima o
 *   corpo esconde os pés, então ela NÃO julga pé na cozinha. Precisa de
 *   7–9 m de altura com celular comum (4–5 m com grande-angular em modo
 *   linear). Ótima como COMPLEMENTO.
 * · **Lateral da rede (baixa, no prolongamento da rede)** — é o olhar do juiz
 *   de linha da cozinha: as duas linhas da cozinha correm para longe da
 *   câmera, e o pé que avança sobre elas anda de lado na imagem, que é onde a
 *   medida é mais precisa. É a melhor para PÉ NA COZINHA (o sistema
 *   profissional aprovado pela ITF usa câmeras nos postes da rede). Os fundos
 *   saem achatados, então ela julga quique com incerteza maior.
 * · **Cantos (altas, na diagonal)** — cada uma vê duas linhas de perto e a
 *   quadra inteira; quatro juntas cobrem todas as linhas por dois ângulos.
 *
 * Com várias câmeras, cada aparelho decide sozinho e a CENTRAL junta (ver
 * `fusion.js`): para o quique vale a de menor incerteza naquele ponto; para o
 * pé, a que vê os pés melhor (`footWeight`). Discordância vira "revisar".
 *
 * O `id` das posições e dos arranjos é contrato (fica no banco e na
 * calibração guardada no aparelho): nunca renomeie.
 */

import { tk } from '@/core/i18n';
import { COURT, COURT_POINTS, CORNER_SET } from './court.js';

const { WIDTH: W, LENGTH: L, NET_Y: N } = COURT;

/**
 * @typedef {object} CameraPosition
 * @property {string} id
 * @property {string} label       nome curto (tk)
 * @property {string} where       onde fica (tk)
 * @property {string} height      a que altura (tk)
 * @property {string} aim         para onde aponta e o que precisa aparecer (tk)
 * @property {'court'|'kitchens'} corners  os pontos da calibração
 * @property {'image'|'overhead'} mode      como o motor acha o quique
 * @property {number} footWeight  quanto ela vale para julgar o pé (0 = não julga)
 * @property {boolean} usesPose   roda o detector de pés e punhos
 * @property {{x:number,y:number}} spot  onde fica no desenho (metros da quadra)
 */

const fundo = (lado) => ({
  label: lado === 'A' ? tk('Fundo — lado A') : tk('Fundo — lado B'),
  where: tk('Atrás da linha de fundo, no meio, 2 a 4 m para trás.'),
  height: tk('3 a 6 m (o mais alto que der: escada, mastro, arquibancada, grade).'),
  aim: tk('Para a rede, com os quatro cantos da quadra e um pouco de chão em volta na tela.'),
  corners: 'court',
  mode: 'image',
  footWeight: 0.6,
  usesPose: true,
});

const rede = (lado) => ({
  label: lado === 1 ? tk('Lateral da rede — lado 1') : tk('Lateral da rede — lado 2'),
  where: tk('Fora da quadra, no prolongamento da rede, 3 a 5 m da lateral.'),
  height: tk('1,5 a 2,5 m (tripé alto).'),
  aim: tk('Para o outro lado da quadra, com as duas cozinhas inteiras na tela.'),
  corners: 'kitchens',
  mode: 'image',
  footWeight: 1,
  usesPose: true,
});

const canto = (label) => ({
  label,
  where: tk('Fora da quadra, 1 a 2 m para trás e para o lado do canto.'),
  height: tk('2,5 a 4 m.'),
  aim: tk('Na diagonal, para o canto oposto, com a quadra inteira na tela.'),
  corners: 'court',
  mode: 'image',
  footWeight: 0.5,
  usesPose: true,
});

/** @type {Readonly<Record<string, CameraPosition>>} */
export const CAMERA_POSITIONS = Object.freeze({
  fundo_a: Object.freeze({ id: 'fundo_a', ...fundo('A'), spot: { x: W / 2, y: -2.6 } }),
  fundo_b: Object.freeze({ id: 'fundo_b', ...fundo('B'), spot: { x: W / 2, y: L + 2.6 } }),
  topo: Object.freeze({
    id: 'topo',
    label: tk('No alto, no centro (de cima)'),
    where: tk('Acima da rede, no meio da quadra: presa no teto, numa viga ou num mastro com braço.'),
    height: tk('7 a 9 m com celular comum; 4 a 5 m com lente grande-angular em modo linear.'),
    aim: tk('Para baixo, com a quadra inteira na tela.'),
    corners: 'court',
    mode: 'overhead',
    footWeight: 0,
    usesPose: false,
    spot: { x: W / 2, y: N },
  }),
  rede_1: Object.freeze({ id: 'rede_1', ...rede(1), spot: { x: -2.6, y: N } }),
  rede_2: Object.freeze({ id: 'rede_2', ...rede(2), spot: { x: W + 2.6, y: N } }),
  canto_a1: Object.freeze({ id: 'canto_a1', ...canto(tk('Canto A1')), spot: { x: -1.6, y: -1.6 } }),
  canto_a2: Object.freeze({ id: 'canto_a2', ...canto(tk('Canto A2')), spot: { x: W + 1.6, y: -1.6 } }),
  canto_b1: Object.freeze({ id: 'canto_b1', ...canto(tk('Canto B1')), spot: { x: -1.6, y: L + 1.6 } }),
  canto_b2: Object.freeze({ id: 'canto_b2', ...canto(tk('Canto B2')), spot: { x: W + 1.6, y: L + 1.6 } }),
});

/**
 * @typedef {object} CameraLayout
 * @property {string} id
 * @property {string} label
 * @property {string[]} positions
 * @property {string} good     para que serve (tk)
 * @property {boolean} [recommended]
 */

const layout = (id, label, positions, good, recommended = false) => Object.freeze({
  id, label, positions: Object.freeze(positions), good, recommended,
});

/** Os arranjos, do mais simples ao mais completo. */
export const CAMERA_LAYOUTS = Object.freeze([
  layout('solo_fundo', tk('Uma câmera no fundo'), ['fundo_a'],
    tk('Dentro/fora na quadra toda e pé na cozinha do lado de lá. O jeito de começar.'), true),
  layout('solo_rede', tk('Uma câmera na lateral da rede'), ['rede_1'],
    tk('A melhor para pé na cozinha, dos dois lados. Dentro/fora com mais "revisar" nos fundos.')),
  layout('solo_topo', tk('Uma câmera no alto, no centro'), ['topo'],
    tk('Onde a bola caiu, com precisão igual nos dois fundos. Não julga pé na cozinha e exige 7–9 m de altura.')),
  layout('fundo_rede', tk('Fundo + lateral da rede'), ['fundo_a', 'rede_1'],
    tk('A dupla mais útil: o fundo cuida das linhas, a lateral cuida da cozinha.'), true),
  layout('dois_fundos', tk('Os dois fundos'), ['fundo_a', 'fundo_b'],
    tk('Cada fundo visto de perto por uma câmera; pé na cozinha visto de frente nos dois lados.')),
  layout('topo_rede', tk('No alto + lateral da rede'), ['topo', 'rede_1'],
    tk('Onde a bola caiu pelo alto e a cozinha pela lateral. Para quadra coberta com teto alto.')),
  layout('fundos_topo', tk('Os dois fundos + no alto'), ['fundo_a', 'fundo_b', 'topo'],
    tk('Três olhares para cada quique: quase nada fica para revisar nas linhas.')),
  layout('fundos_redes', tk('Os dois fundos + as duas laterais da rede'), ['fundo_a', 'fundo_b', 'rede_1', 'rede_2'],
    tk('Cobertura completa com celulares: linhas de perto e a cozinha pelos dois lados, sem um jogador esconder o outro.'), true),
  layout('cantos', tk('Os quatro cantos'), ['canto_a1', 'canto_a2', 'canto_b1', 'canto_b2'],
    tk('Toda linha vista de perto por dois ângulos. A cozinha fica mais longe que na lateral da rede.')),
  layout('fundos_redes_topo', tk('Fundos + laterais da rede + no alto'), ['fundo_a', 'fundo_b', 'rede_1', 'rede_2', 'topo'],
    tk('O máximo que se monta com aparelhos comuns.')),
  layout('cantos_topo', tk('Os quatro cantos + no alto'), ['canto_a1', 'canto_a2', 'canto_b1', 'canto_b2', 'topo'],
    tk('Cada linha por dois ângulos e o ponto do quique pelo alto.')),
]);

export const DEFAULT_LAYOUT = 'solo_fundo';

/** O arranjo pelo id (desconhecido ⇒ o padrão). */
export function layoutById(id) {
  return CAMERA_LAYOUTS.find((l) => l.id === id) || CAMERA_LAYOUTS.find((l) => l.id === DEFAULT_LAYOUT);
}

/** Os arranjos agrupados por número de câmeras: `[[1, [...]], [2, [...]], …]`. */
export function layoutsByCount() {
  const m = new Map();
  CAMERA_LAYOUTS.forEach((l) => {
    const n = l.positions.length;
    if (!m.has(n)) m.set(n, []);
    m.get(n).push(l);
  });
  return [...m.entries()].sort((a, b) => a[0] - b[0]);
}

/**
 * Os quatro pontos que a câmera desta posição toca na calibração, com as
 * coordenadas do chão: `[{ id: 'A1', x, y }, …]`.
 */
export function calibrationPoints(positionId) {
  const set = CORNER_SET[CAMERA_POSITIONS[positionId]?.corners || 'court'];
  return set.map((id) => ({ id, ...COURT_POINTS[id] }));
}

/** O que o arranjo julga: dentro/fora sempre; pé na cozinha só com câmera que vê pés. */
export function layoutJudges(id) {
  const ps = layoutById(id).positions.map((p) => CAMERA_POSITIONS[p]);
  return { bounce: true, feet: ps.some((p) => p.footWeight > 0) };
}
