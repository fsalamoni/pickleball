/**
 * Taxonomia do Centro de Treino (flag `training_center`).
 *
 * As ÁREAS são as dez do nivelamento (`CATEGORY_KEYS` de
 * `leveling/domain/questionnaire.js`), copiadas aqui com teste de paridade:
 * aquele arquivo tem 66 kB e não pode entrar no pacote do treino.
 *
 * Na interface a palavra é "Habilidade" — nunca "skill", que na plataforma já
 * é a trilha de XP da gamificação.
 */
import { t, tk } from '@/core/i18n';

export const SKILL_AREAS = Object.freeze([
  'serve', 'groundstrokes', 'kitchen', 'net', 'tactics',
  'doubles', 'mental', 'physical', 'rules', 'experience',
]);

export const SKILL_AREA_LABELS = Object.freeze({
  serve: tk('Saque e devolução'),
  groundstrokes: tk('Golpes de fundo'),
  kitchen: tk('Jogo curto e dinks'),
  net: tk('Voleios e rede'),
  tactics: tk('Leitura de jogo'),
  doubles: tk('Duplas'),
  mental: tk('Mental'),
  physical: tk('Físico'),
  rules: tk('Regras'),
  experience: tk('Experiência de jogo'),
});

/** Sub-habilidades: `area.slug` → rótulo. A área sozinha também é válida. */
export const SKILLS = Object.freeze({
  'serve.saque_profundo': tk('Saque profundo'),
  'serve.devolucao_profunda': tk('Devolução profunda'),
  'serve.consistencia': tk('Consistência no saque'),
  'serve.efeito': tk('Saque com efeito'),
  'groundstrokes.drive': tk('Drive'),
  'groundstrokes.terceira_bola_drop': tk('Drop da terceira bola'),
  'groundstrokes.terceira_bola_drive': tk('Drive da terceira bola'),
  'groundstrokes.transicao': tk('Transição para a rede'),
  'groundstrokes.lob': tk('Lob'),
  'groundstrokes.backhand': tk('Backhand'),
  'groundstrokes.efeito': tk('Efeito (topspin e slice)'),
  'groundstrokes.passada': tk('Passada'),
  'kitchen.dink_cruzado': tk('Dink cruzado'),
  'kitchen.dink_paralelo': tk('Dink paralelo'),
  'kitchen.dink_atacavel': tk('Atacar o dink alto'),
  'kitchen.paciencia': tk('Paciência no jogo curto'),
  'net.voleio': tk('Voleio'),
  'net.reset': tk('Reset'),
  'net.speed_up': tk('Aceleração (speed-up)'),
  'net.contra_ataque': tk('Contra-ataque'),
  'net.smash': tk('Smash'),
  'net.erne': tk('Erne'),
  'net.atp': tk('ATP (por fora do poste)'),
  'net.bloqueio': tk('Bloqueio'),
  'net.meio_voleio': tk('Meio-voleio'),
  'net.defesa_corpo': tk('Defesa de corpo'),
  'tactics.selecao_golpe': tk('Escolha do golpe'),
  'tactics.alvo': tk('Alvos e ângulos'),
  'tactics.leitura_adversario': tk('Leitura do adversário'),
  'doubles.comunicacao': tk('Comunicação com a dupla'),
  'doubles.posicionamento': tk('Posicionamento da dupla'),
  'doubles.stacking': tk('Stacking'),
  'doubles.cobertura_meio': tk('Cobertura do meio'),
  'mental.rotina_entre_pontos': tk('Rotina entre pontos'),
  'mental.foco': tk('Foco e concentração'),
  'mental.pressao': tk('Jogar sob pressão'),
  'physical.aquecimento': tk('Aquecimento'),
  'physical.agilidade': tk('Agilidade e deslocamento'),
  'physical.forca_inferior': tk('Força de membros inferiores'),
  'physical.ombro_antebraco': tk('Ombro e antebraço'),
  'physical.core': tk('Core'),
  'physical.mobilidade': tk('Mobilidade'),
  'physical.condicionamento': tk('Condicionamento'),
  'rules.saque': tk('Regras do saque'),
  'rules.cozinha': tk('Regras da cozinha'),
  'rules.placar': tk('Contagem do placar'),
  'rules.faltas': tk('Faltas e bolas fora'),
  'experience.jogo': tk('Jogo e competição'),
});

export function isValidSkill(value) {
  const v = String(value ?? '').trim();
  return SKILL_AREAS.includes(v) || Object.prototype.hasOwnProperty.call(SKILLS, v);
}

export function skillArea(value) {
  return String(value ?? '').split('.')[0];
}

export function skillLabel(value) {
  const v = String(value ?? '').trim();
  const rotulo = SKILLS[v] || SKILL_AREA_LABELS[v];
  return rotulo ? t(rotulo) : v;
}

/** Lista para seletores: áreas e suas sub-habilidades, na ordem das áreas. */
export function skillOptions() {
  return SKILL_AREAS.map((area) => ({
    value: area,
    label: t(SKILL_AREA_LABELS[area]),
    children: Object.keys(SKILLS)
      .filter((k) => skillArea(k) === area)
      .map((k) => ({ value: k, label: t(SKILLS[k]) })),
  }));
}

export const ITEM_KIND = Object.freeze({
  DRILL: 'drill',
  TREINO: 'treino',
  FUNDAMENTO: 'fundamento',
  JOGADA: 'jogada',
  FISICO: 'fisico',
  ESTUDO: 'estudo',
});

export const ITEM_KINDS = Object.freeze(Object.values(ITEM_KIND));

export const ITEM_KIND_LABELS = Object.freeze({
  drill: tk('Drill'),
  treino: tk('Treino'),
  fundamento: tk('Fundamento'),
  jogada: tk('Jogada'),
  fisico: tk('Exercício físico'),
  estudo: tk('Estudo'),
});

/** Uma frase do que é cada tipo — aparece ao escolher o tipo no editor. */
export const ITEM_KIND_HINTS = Object.freeze({
  drill: tk('Exercício de quadra repetível, com montagem, passo a passo e meta.'),
  treino: tk('Uma sessão completa em blocos: aquecimento, parte técnica, jogo e volta à calma.'),
  fundamento: tk('Como executar um golpe: fases do movimento, certo e errado, erros comuns.'),
  jogada: tk('Quando e como usar uma jogada ou padrão tático, com o diagrama da quadra.'),
  fisico: tk('Exercício de preparação física ou prevenção, com séries, repetições e descanso.'),
  estudo: tk('Regra, vídeo ou leitura para estudar, com perguntas para fixar.'),
});

export const PLACES = Object.freeze(['quadra', 'parede', 'casa', 'academia']);
export const PLACE_LABELS = Object.freeze({
  quadra: tk('Quadra'), parede: tk('Parede'), casa: tk('Em casa'), academia: tk('Academia'),
});

export const EQUIPMENT = Object.freeze([
  'bolas', 'cones', 'alvo', 'parede', 'elastico', 'escada', 'cesto', 'maquina', 'raquete', 'rede_portatil',
]);
export const EQUIPMENT_LABELS = Object.freeze({
  bolas: tk('Bolas'), cones: tk('Cones'), alvo: tk('Alvos'), parede: tk('Parede'), elastico: tk('Elástico'),
  escada: tk('Escada de agilidade'), cesto: tk('Cesto de bolas'), maquina: tk('Máquina de bolas'),
  raquete: tk('Raquete'), rede_portatil: tk('Rede portátil'),
});

export const MOTOR_ABILITIES = Object.freeze([
  'coordenacao', 'equilibrio', 'tempo_reacao', 'agilidade', 'ritmo', 'forca',
  'potencia', 'resistencia', 'mobilidade', 'precisao', 'leitura',
]);
export const MOTOR_ABILITY_LABELS = Object.freeze({
  coordenacao: tk('Coordenação'), equilibrio: tk('Equilíbrio'), tempo_reacao: tk('Tempo de reação'),
  agilidade: tk('Agilidade'), ritmo: tk('Ritmo'), forca: tk('Força'), potencia: tk('Potência'),
  resistencia: tk('Resistência'), mobilidade: tk('Mobilidade'), precisao: tk('Precisão'),
  leitura: tk('Leitura e antecipação'),
});

/**
 * As partes do gesto que a TÉCNICA de um golpe descreve, ponto a ponto
 * (`technique.checkpoints`). Aqui falar do corpo é o certo — é o que se
 * ensina ao aprender o golpe; as DICAS curtas continuam com foco externo.
 */
export const TECHNIQUE_PARTS = Object.freeze([
  'empunhadura', 'olhar', 'pes', 'pernas', 'tronco', 'braco', 'punho', 'raquete',
]);
export const TECHNIQUE_PART_LABELS = Object.freeze({
  empunhadura: tk('Empunhadura'), olhar: tk('Olhar'), pes: tk('Pés'), pernas: tk('Pernas'),
  tronco: tk('Quadril e tronco'), braco: tk('Braço e ombro'), punho: tk('Punho'), raquete: tk('Face da raquete'),
});

/** Escala de esforço CR-10 (RPE), com rótulos que qualquer pessoa entende. */
export const RPE_LABELS = Object.freeze({
  0: tk('Repouso'), 1: tk('Muito, muito leve'), 2: tk('Leve'), 3: tk('Moderado'), 4: tk('Um pouco puxado'),
  5: tk('Puxado'), 6: tk('Puxado'), 7: tk('Muito puxado'), 8: tk('Muito puxado'), 9: tk('Quase o máximo'), 10: tk('Máximo'),
});

export function rpeLabel(value) {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= 0 && n <= 10 ? t(RPE_LABELS[n]) : '';
}

export const BLOCK_TYPES = Object.freeze(['aquecimento', 'tecnica', 'tatica', 'jogo', 'fisico', 'volta_calma']);
export const BLOCK_TYPE_LABELS = Object.freeze({
  aquecimento: tk('Aquecimento'), tecnica: tk('Técnica'), tatica: tk('Tática'), jogo: tk('Jogo'),
  fisico: tk('Físico'), volta_calma: tk('Volta à calma'),
});

export const METRIC_TYPES = Object.freeze(['sequencia', 'percentual', 'placar', 'tempo', 'reps']);
export const METRIC_TYPE_LABELS = Object.freeze({
  sequencia: tk('Sequência sem errar'), percentual: tk('Acertos em %'), placar: tk('Placar'),
  tempo: tk('Tempo'), reps: tk('Repetições'),
});

/**
 * Como a prática é organizada (interferência contextual): em bloco para quem
 * está começando; variada/aleatória quando o golpe já sai consistente; jogo
 * reduzido para levar à partida.
 */
export const PRACTICE_MODES = Object.freeze(['bloco', 'variado', 'aleatorio', 'jogo']);
export const PRACTICE_MODE_LABELS = Object.freeze({
  bloco: tk('Em bloco (repetição do mesmo golpe)'),
  variado: tk('Variado (alterna golpes ou alvos)'),
  aleatorio: tk('Aleatório (não se sabe o que vem)'),
  jogo: tk('Jogo reduzido (pontuação, situação de jogo)'),
});

export const STUDY_TYPES = Object.freeze(['regra', 'video', 'leitura']);
export const STUDY_TYPE_LABELS = Object.freeze({ regra: tk('Regra'), video: tk('Vídeo'), leitura: tk('Leitura') });

export const LEVEL_MIN = 2;
export const LEVEL_MAX = 8;
