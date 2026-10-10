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

export const SKILL_AREAS = Object.freeze([
  'serve', 'groundstrokes', 'kitchen', 'net', 'tactics',
  'doubles', 'mental', 'physical', 'rules', 'experience',
]);

export const SKILL_AREA_LABELS = Object.freeze({
  serve: 'Saque e devolução',
  groundstrokes: 'Golpes de fundo',
  kitchen: 'Jogo curto e dinks',
  net: 'Voleios e rede',
  tactics: 'Leitura de jogo',
  doubles: 'Duplas',
  mental: 'Mental',
  physical: 'Físico',
  rules: 'Regras',
  experience: 'Experiência de jogo',
});

/** Sub-habilidades: `area.slug` → rótulo. A área sozinha também é válida. */
export const SKILLS = Object.freeze({
  'serve.saque_profundo': 'Saque profundo',
  'serve.devolucao_profunda': 'Devolução profunda',
  'serve.consistencia': 'Consistência no saque',
  'serve.efeito': 'Saque com efeito',
  'groundstrokes.drive': 'Drive',
  'groundstrokes.terceira_bola_drop': 'Drop da terceira bola',
  'groundstrokes.terceira_bola_drive': 'Drive da terceira bola',
  'groundstrokes.transicao': 'Transição para a rede',
  'groundstrokes.lob': 'Lob',
  'groundstrokes.backhand': 'Backhand',
  'groundstrokes.efeito': 'Efeito (topspin e slice)',
  'groundstrokes.passada': 'Passada',
  'kitchen.dink_cruzado': 'Dink cruzado',
  'kitchen.dink_paralelo': 'Dink paralelo',
  'kitchen.dink_atacavel': 'Atacar o dink alto',
  'kitchen.paciencia': 'Paciência no jogo curto',
  'net.voleio': 'Voleio',
  'net.reset': 'Reset',
  'net.speed_up': 'Aceleração (speed-up)',
  'net.contra_ataque': 'Contra-ataque',
  'net.smash': 'Smash',
  'net.erne': 'Erne',
  'net.atp': 'ATP (por fora do poste)',
  'net.bloqueio': 'Bloqueio',
  'net.meio_voleio': 'Meio-voleio',
  'net.defesa_corpo': 'Defesa de corpo',
  'tactics.selecao_golpe': 'Escolha do golpe',
  'tactics.alvo': 'Alvos e ângulos',
  'tactics.leitura_adversario': 'Leitura do adversário',
  'doubles.comunicacao': 'Comunicação com a dupla',
  'doubles.posicionamento': 'Posicionamento da dupla',
  'doubles.stacking': 'Stacking',
  'doubles.cobertura_meio': 'Cobertura do meio',
  'mental.rotina_entre_pontos': 'Rotina entre pontos',
  'mental.foco': 'Foco e concentração',
  'mental.pressao': 'Jogar sob pressão',
  'physical.aquecimento': 'Aquecimento',
  'physical.agilidade': 'Agilidade e deslocamento',
  'physical.forca_inferior': 'Força de membros inferiores',
  'physical.ombro_antebraco': 'Ombro e antebraço',
  'physical.core': 'Core',
  'physical.mobilidade': 'Mobilidade',
  'physical.condicionamento': 'Condicionamento',
  'rules.saque': 'Regras do saque',
  'rules.cozinha': 'Regras da cozinha',
  'rules.placar': 'Contagem do placar',
  'rules.faltas': 'Faltas e bolas fora',
  'experience.jogo': 'Jogo e competição',
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
  return SKILLS[v] || SKILL_AREA_LABELS[v] || v;
}

/** Lista para seletores: áreas e suas sub-habilidades, na ordem das áreas. */
export function skillOptions() {
  return SKILL_AREAS.map((area) => ({
    value: area,
    label: SKILL_AREA_LABELS[area],
    children: Object.keys(SKILLS)
      .filter((k) => skillArea(k) === area)
      .map((k) => ({ value: k, label: SKILLS[k] })),
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
  drill: 'Drill',
  treino: 'Treino',
  fundamento: 'Fundamento',
  jogada: 'Jogada',
  fisico: 'Exercício físico',
  estudo: 'Estudo',
});

/** Uma frase do que é cada tipo — aparece ao escolher o tipo no editor. */
export const ITEM_KIND_HINTS = Object.freeze({
  drill: 'Exercício de quadra repetível, com montagem, passo a passo e meta.',
  treino: 'Uma sessão completa em blocos: aquecimento, parte técnica, jogo e volta à calma.',
  fundamento: 'Como executar um golpe: fases do movimento, certo e errado, erros comuns.',
  jogada: 'Quando e como usar uma jogada ou padrão tático, com o diagrama da quadra.',
  fisico: 'Exercício de preparação física ou prevenção, com séries, repetições e descanso.',
  estudo: 'Regra, vídeo ou leitura para estudar, com perguntas para fixar.',
});

export const PLACES = Object.freeze(['quadra', 'parede', 'casa', 'academia']);
export const PLACE_LABELS = Object.freeze({
  quadra: 'Quadra', parede: 'Parede', casa: 'Em casa', academia: 'Academia',
});

export const EQUIPMENT = Object.freeze([
  'bolas', 'cones', 'alvo', 'parede', 'elastico', 'escada', 'cesto', 'maquina', 'raquete', 'rede_portatil',
]);
export const EQUIPMENT_LABELS = Object.freeze({
  bolas: 'Bolas', cones: 'Cones', alvo: 'Alvos', parede: 'Parede', elastico: 'Elástico',
  escada: 'Escada de agilidade', cesto: 'Cesto de bolas', maquina: 'Máquina de bolas',
  raquete: 'Raquete', rede_portatil: 'Rede portátil',
});

export const MOTOR_ABILITIES = Object.freeze([
  'coordenacao', 'equilibrio', 'tempo_reacao', 'agilidade', 'ritmo', 'forca',
  'potencia', 'resistencia', 'mobilidade', 'precisao', 'leitura',
]);
export const MOTOR_ABILITY_LABELS = Object.freeze({
  coordenacao: 'Coordenação', equilibrio: 'Equilíbrio', tempo_reacao: 'Tempo de reação',
  agilidade: 'Agilidade', ritmo: 'Ritmo', forca: 'Força', potencia: 'Potência',
  resistencia: 'Resistência', mobilidade: 'Mobilidade', precisao: 'Precisão',
  leitura: 'Leitura e antecipação',
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
  empunhadura: 'Empunhadura', olhar: 'Olhar', pes: 'Pés', pernas: 'Pernas',
  tronco: 'Quadril e tronco', braco: 'Braço e ombro', punho: 'Punho', raquete: 'Face da raquete',
});

/** Escala de esforço CR-10 (RPE), com rótulos que qualquer pessoa entende. */
export const RPE_LABELS = Object.freeze({
  0: 'Repouso', 1: 'Muito, muito leve', 2: 'Leve', 3: 'Moderado', 4: 'Um pouco puxado',
  5: 'Puxado', 6: 'Puxado', 7: 'Muito puxado', 8: 'Muito puxado', 9: 'Quase o máximo', 10: 'Máximo',
});

export function rpeLabel(value) {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= 0 && n <= 10 ? RPE_LABELS[n] : '';
}

export const BLOCK_TYPES = Object.freeze(['aquecimento', 'tecnica', 'tatica', 'jogo', 'fisico', 'volta_calma']);
export const BLOCK_TYPE_LABELS = Object.freeze({
  aquecimento: 'Aquecimento', tecnica: 'Técnica', tatica: 'Tática', jogo: 'Jogo',
  fisico: 'Físico', volta_calma: 'Volta à calma',
});

export const METRIC_TYPES = Object.freeze(['sequencia', 'percentual', 'placar', 'tempo', 'reps']);
export const METRIC_TYPE_LABELS = Object.freeze({
  sequencia: 'Sequência sem errar', percentual: 'Acertos em %', placar: 'Placar',
  tempo: 'Tempo', reps: 'Repetições',
});

/**
 * Como a prática é organizada (interferência contextual): em bloco para quem
 * está começando; variada/aleatória quando o golpe já sai consistente; jogo
 * reduzido para levar à partida.
 */
export const PRACTICE_MODES = Object.freeze(['bloco', 'variado', 'aleatorio', 'jogo']);
export const PRACTICE_MODE_LABELS = Object.freeze({
  bloco: 'Em bloco (repetição do mesmo golpe)',
  variado: 'Variado (alterna golpes ou alvos)',
  aleatorio: 'Aleatório (não se sabe o que vem)',
  jogo: 'Jogo reduzido (pontuação, situação de jogo)',
});

export const STUDY_TYPES = Object.freeze(['regra', 'video', 'leitura']);
export const STUDY_TYPE_LABELS = Object.freeze({ regra: 'Regra', video: 'Vídeo', leitura: 'Leitura' });

export const LEVEL_MIN = 2;
export const LEVEL_MAX = 8;
