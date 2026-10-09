/**
 * Treinos vindos da avaliação do pacote "100 drills" (o modelo de sessão de 60
 * minutos e a sequência de duplas). Mesmo formato de `treinos.js`: o drill é
 * citado pelo nome, a semente não liga itens.
 */

const QUADRA = ['quadra'];
const SEGURANCA = 'Água por perto e pausas para beber. Quadra molhada ou escorregadia: não treine. Para buscar o lob, vire e corra; nunca recue de costas. Sentiu dor, tontura ou falta de ar fora do normal? Pare.';

const bloco = (type, title, duration_min, notes) => ({ type, title, duration_min, item_id: null, notes });

const AQUECIMENTO = (min) => bloco('aquecimento', 'Aquecimento dinâmico', min, 'Siga o "Aquecimento dinâmico de 10 minutos": movimento leve, depois amplo, depois no ritmo do jogo, terminando com dinks leves.');
const VOLTA_CALMA = (min) => bloco('volta_calma', 'Volta à calma', min, 'Siga a "Volta à calma depois do jogo": caminhada leve, alongamentos parados até tensão leve e água.');

export const TREINOS_IMPORTADOS = [
  {
    slug: 'treino-sessao-completa-cozinha-ao-fundo',
    version: 1,
    kind: 'treino',
    title: 'Sessão completa: cozinha, terceira bola e transição',
    summary: 'Uma hora que passa pelas três partes do ponto: dink na cozinha, drop da terceira bola e a subida pela zona de transição, terminando em jogo.',
    objective: 'Ao final, o atleta sustenta 20 dinks seguidos em cooperação, coloca o drop na cozinha em 6 de 10 tentativas e para em split step antes de amortecer na transição.',
    skills: ['kitchen.dink_cruzado', 'kitchen.paciencia', 'groundstrokes.terceira_bola_drop', 'groundstrokes.transicao', 'net.reset'],
    level_min: 2.5,
    level_max: 3.5,
    players_min: 2,
    players_max: 4,
    duration_min: 60,
    intensity: 5,
    place: QUADRA,
    equipment: ['bolas', 'cones', 'cesto'],
    practice_mode: 'variado',
    blocks: [
      AQUECIMENTO(10),
      bloco('tecnica', 'Dink paralelo e cruzado', 14, 'Siga "Dink paralelo junto à lateral" e depois "Dink cruzado no pé de dentro". Meta: 20 dinks seguidos antes de qualquer aceleração. É o bloco mais longo de propósito.'),
      bloco('tecnica', 'Drop com alimentador', 12, 'Siga "Drop da terceira bola com alimentador" em rodadas de 10, trocando os papéis. Meta: 6 de 10 na cozinha, com a bola subindo do seu lado da rede.'),
      bloco('tatica', 'Reset na zona de transição', 9, 'Siga "Reset na zona de transição": avance, pare em split step quando o atacante bater, amorteça para a cozinha e só então avance de novo.'),
      bloco('jogo', 'Jogo 7-11', 10, 'Siga "Jogo 7-11: chegar à rede contra quem está nela". Troquem os papéis a cada jogo.'),
      VOLTA_CALMA(5),
    ],
    when_to_use: 'Para a semana em que não há um ponto fraco definido: passa pelas três partes do ponto na mesma hora. Se você chega à rede e perde o ponto logo em seguida, dê mais tempo aos dois últimos blocos e menos ao dink.',
    safety: SEGURANCA,
    media: [],
  },
  {
    slug: 'treino-dupla-chamada-meio-e-cobertura',
    version: 1,
    kind: 'treino',
    title: 'Dupla em sintonia: chamada, meio e cobertura',
    summary: 'Uma hora e quinze para a dupla funcionar como um sistema: mover-se junta, decidir a bola do meio com chamada e cobrir o lado do parceiro no poach.',
    objective: 'Ao final, a dupla se desloca junta, resolve a bola do meio com a chamada antes do contato e cobre o lado deixado pelo parceiro em todo poach combinado.',
    skills: ['doubles.comunicacao', 'doubles.cobertura_meio', 'doubles.posicionamento'],
    level_min: 3.0,
    level_max: 4.5,
    players_min: 4,
    players_max: 4,
    duration_min: 75,
    intensity: 5,
    place: QUADRA,
    equipment: ['bolas', 'cesto'],
    practice_mode: 'variado',
    blocks: [
      AQUECIMENTO(10),
      bloco('tatica', 'A dupla como uma corda', 10, 'Siga a jogada "A dupla como uma corda": primeiro sem bola, deslocando juntos para os lados e para a frente; depois com dinks, mantendo a mesma distância entre os dois.'),
      bloco('tatica', 'Bola do meio: quem chama?', 15, 'Siga "Bola do meio: quem chama?". Combinem a regra antes: bola lenta no meio é de quem tem o forehand ali; bola rápida é de quem está na diagonal de quem bateu. Chamem cedo.'),
      bloco('tatica', 'Poach no dink cruzado com cobertura', 15, 'Siga "Poach no dink cruzado" com o sinal combinado antes do saque. Quem não faz o poach troca de lado na hora e cobre o espaço deixado, como em "Cobertura do lob: troca de lado".'),
      bloco('jogo', 'Pontos com chamada obrigatória', 20, 'Jogos até 11. Bola do meio sem chamada vale ponto para o adversário; poach só depois do sinal. Troquem as duplas a cada jogo.'),
      VOLTA_CALMA(5),
    ],
    when_to_use: 'Quando a dupla perde pontos com a bola passando entre os dois ou com os dois indo na mesma bola. Faça este antes de "Padrões de duplas: poach, drive e stacking": sem chamada e cobertura, o poach custa mais pontos do que ganha.',
    safety: `Óculos de proteção são recomendados nas trocas rápidas na rede. ${SEGURANCA}`,
    media: [],
  },
];
