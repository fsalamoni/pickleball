/**
 * Tabela detalhada de nivelamento importada de fsalamoni/pickleball-nivelamento.
 */

export const LEVEL_TABLE = [
  {
    id: 'iniciante_1',
    usap: '1.0 – 1.5',
    scoreRange: '0 – 10',
    normalizedRange: '0 – 10',
    name: 'Iniciante Absoluto',
    badge: '1.0',
    color: 'gray',
    borderColor: 'border-gray-300',
    bgColor: 'bg-gray-50',
    textColor: 'text-gray-800',
    badgeBg: 'bg-gray-500',
    tagline: 'Primeiros contatos com a raquete',
    description:
      'O jogador ainda está aprendendo as regras básicas, a empunhadura e os movimentos fundamentais. A bola raramente permanece em jogo por mais de 2 ou 3 rebatidas consecutivas. Os deslocamentos são lentos e sem posicionamento estratégico.',
    characteristics: [
      'Não conhece todas as regras (cozinha, duplo quique, saque)',
      'Dificuldade em manter a bola dentro da quadra',
      'Sem controle de direção ou profundidade',
      'Movimentação reativa e desordenada',
      'Usa apenas golpe de direita com frequência',
    ],
    strengths: ['Entusiasmo e disposição para aprender'],
    weaknesses: ['Erros não forçados em quase todos os pontos', 'Sem posicionamento de quadra'],
    nextStep:
      'Foque em aprender as regras, a empunhadura correta e a consistência básica: manter a bola em jogo por pelo menos 4 rebatidas seguidas.',
  },
  {
    id: 'iniciante_2',
    usap: '2.0',
    scoreRange: '11 – 20',
    normalizedRange: '11 – 20',
    name: 'Iniciante',
    badge: '2.0',
    color: 'slate',
    borderColor: 'border-slate-300',
    bgColor: 'bg-slate-50',
    textColor: 'text-slate-800',
    badgeBg: 'bg-slate-500',
    tagline: 'Conhece as regras, ainda sem consistência',
    description:
      'O jogador já compreende as regras do jogo e consegue realizar saques válidos com regularidade. Porém, a consistência ainda é baixa: erros não forçados são frequentes, especialmente no backhand e em bolas que exigem deslocamento lateral. O jogo é predominantemente reativo.',
    characteristics: [
      'Conhece as regras básicas do jogo',
      'Saque válido com regularidade',
      'Forehand funcional, backhand inconsistente',
      'Dificuldade com bolas na cozinha (kitchen)',
      'Posicionamento de quadra ainda em desenvolvimento',
    ],
    strengths: ['Saque consistente', 'Compreensão das regras'],
    weaknesses: ['Backhand fraco', 'Muitos erros não forçados', 'Sem estratégia tática'],
    nextStep:
      'Trabalhe a consistência do backhand e comece a praticar o dink — o golpe suave na rede que é a base do pickleball avançado.',
  },
  {
    id: 'iniciante_plus',
    usap: '2.5',
    scoreRange: '21 – 30',
    normalizedRange: '21 – 30',
    name: 'Iniciante Plus',
    badge: '2.5',
    color: 'blue',
    borderColor: 'border-blue-300',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-800',
    badgeBg: 'bg-blue-500',
    tagline: 'Consistência emergindo, tática ainda ausente',
    description:
      'O jogador já consegue manter ralis mais longos e tem ambos os lados da raquete funcionando. Começa a entender a importância do posicionamento na linha de cozinha, mas ainda comete erros táticos graves: tenta atacar bolas baixas, sobe à rede sem intenção clara e não usa o 3rd shot drop.',
    characteristics: [
      'Ambos os lados da raquete funcionais',
      'Ralis de 5 a 8 rebatidas com regularidade',
      'Começa a se posicionar na linha de cozinha',
      'Dink básico, sem controle direcional',
      'Tenta atacar bolas que não deveria',
    ],
    strengths: ['Consistência básica estabelecida', 'Ambos os lados funcionais'],
    weaknesses: [
      'Impulsividade tática (ataca na hora errada)',
      'Sem 3rd shot drop',
      'Dink sem controle de direção',
    ],
    nextStep:
      'Aprenda e pratique o 3rd shot drop até a exaustão. Esse golpe é o divisor de águas entre iniciantes e intermediários.',
  },
  {
    id: 'intermediario',
    usap: '3.0',
    scoreRange: '31 – 44',
    normalizedRange: '31 – 44',
    name: 'Intermediário',
    badge: '3.0',
    color: 'cyan',
    borderColor: 'border-cyan-400',
    bgColor: 'bg-cyan-50',
    textColor: 'text-cyan-900',
    badgeBg: 'bg-cyan-600',
    tagline: 'Bons golpes, mas impulsividade predomina',
    description:
      'O jogador já acerta bons golpes de direita, saca bem e consegue sustentar o jogo. No entanto, a impaciência e a impulsividade predominam. Costuma bater na bola com força quando não deve — especialmente na transição — ou tenta atacar dinks muito baixos, gerando muitos erros. Ainda não domina o reset (amortecimento defensivo).',
    characteristics: [
      'Forehand forte e confiável',
      'Saque com profundidade e direção',
      'Tenta usar o 3rd shot drop, mas inconsistente',
      'Dink com algum controle direcional',
      'Impulsividade: ataca bolas que deveria amortecer',
      'Reset defensivo ausente ou muito fraco',
    ],
    strengths: ['Forehand agressivo', 'Saque com intenção', 'Resistência física razoável'],
    weaknesses: [
      'Impulsividade tática',
      'Reset defensivo fraco',
      '3rd shot drop inconsistente sob pressão',
    ],
    nextStep:
      'Controle o impulso de atacar. Aprenda que o pickleball exige amortecer a bola (reset) e jogar suavemente na rede. Pratique o "deixar a bola passar" quando estiver fora de posição.',
  },
  {
    id: 'intermediario_plus',
    usap: '3.5',
    scoreRange: '45 – 61',
    normalizedRange: '45 – 61',
    name: 'Intermediário Plus',
    badge: '3.5',
    color: 'emerald',
    borderColor: 'border-emerald-400',
    bgColor: 'bg-emerald-50',
    textColor: 'text-emerald-900',
    badgeBg: 'bg-emerald-600',
    tagline: 'Inteligência tática emergindo',
    description:
      'O jogador compreende a essência da inteligência do jogo. Movimenta-se bem com seu parceiro, já tenta ativamente usar o drop shot e consegue trocar dinks com controle direcional. Porém, quando a pressão aumenta, a consistência falha ou perde a margem tática. O reset ainda não é confiável sob pressão máxima.',
    characteristics: [
      'Compreende e aplica o 3rd shot drop com regularidade',
      'Dink com controle direcional e variação de ritmo',
      'Boa sincronização básica com parceiro',
      'Começa a usar slice e lobs estrategicamente',
      'Reset funcional, mas falha sob pressão máxima',
      'Leitura de jogo em desenvolvimento',
    ],
    strengths: [
      'Inteligência tática básica',
      'Dink direcional',
      '3rd shot drop razoável',
      'Boa movimentação de duplas',
    ],
    weaknesses: [
      'Consistência falha sob pressão',
      'Reset não confiável em situações extremas',
      'Ainda comete erros táticos em momentos decisivos',
    ],
    nextStep:
      'Transforme os golpes que você já sabe fazer "às vezes" em ferramentas que você faz "frequentemente". Foque especialmente no reset defensivo sob pressão máxima.',
  },
  {
    id: 'avancado',
    usap: '4.0',
    scoreRange: '62 – 77',
    normalizedRange: '62 – 77',
    name: 'Avançado',
    badge: '4.0',
    color: 'orange',
    borderColor: 'border-orange-400',
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-900',
    badgeBg: 'bg-orange-500',
    tagline: 'Domínio técnico com margem de erro reduzida',
    description:
      'A margem de erro não forçado despencou estatisticamente. O jogador domina ambas as faces da raquete (spins e slices) e lê perfeitamente as situações táticas, escolhendo amortecer ou acelerar conforme a posição da dupla adversária. Tem reflexos rápidos para bloquear voleios difíceis e usa o stacking com naturalidade.',
    characteristics: [
      'Erros não forçados raros em situações normais',
      'Domínio de spin e slice em ambos os lados',
      'Leitura tática apurada: sabe quando atacar e quando defender',
      'Reset confiável mesmo sob pressão extrema',
      'Usa stacking e posicionamento avançado de duplas',
      'Reflexos rápidos para bloqueios na rede',
    ],
    strengths: [
      'Consistência técnica alta',
      'Leitura tática avançada',
      'Domínio de spin/slice',
      'Stacking e estratégias de duplas',
    ],
    weaknesses: [
      'Pode ainda ter vícios biomecânicos sob exaustão física',
      'Estratégias complexas de desestabilização ainda em refinamento',
    ],
    nextStep:
      'Foque em artifícios de desestabilização contínua (estratégias complexas de dupla) e extinga qualquer vício biomecânico restante sob exaustão física.',
  },
  {
    id: 'pro',
    usap: '4.5',
    scoreRange: '78 – 89',
    normalizedRange: '78 – 89',
    name: 'PRO',
    badge: '4.5',
    color: 'red',
    borderColor: 'border-red-400',
    bgColor: 'bg-red-50',
    textColor: 'text-red-900',
    badgeBg: 'bg-red-600',
    tagline: 'Nível competitivo nacional',
    description:
      'Jogador de nível competitivo nacional. As decisões são automatizadas, o jogador antecipa os movimentos dos adversários e manipula ralis lentos ou frenéticos ao seu favor. Domina perfeitamente estratégias complexas de duplas como o stacking e a interceptação fluida. Raramente entrega pontos fáceis.',
    characteristics: [
      'Decisões táticas automatizadas e instantâneas',
      'Antecipação dos movimentos adversários',
      'Manipulação de ritmo: acelera e desacelera o jogo com intenção',
      'Stacking e interceptação fluida dominados',
      'Serve como arma tática (spin, velocidade, direção)',
      'Resistência física e mental de alto nível',
    ],
    strengths: [
      'Automatização das decisões',
      'Antecipação avançada',
      'Controle total do ritmo do jogo',
      'Excelência física e mental',
    ],
    weaknesses: ['Refinamentos mínimos em situações de elite extrema'],
    nextStep:
      'Compete regularmente em torneios nacionais. Foque em análise de vídeo e coaching especializado para refinamentos de elite.',
  },
  {
    id: 'open',
    usap: '5.0+',
    scoreRange: '90 – 100',
    normalizedRange: '90 – 100',
    name: 'Open / Elite',
    badge: '5.0',
    color: 'purple',
    borderColor: 'border-purple-400',
    bgColor: 'bg-purple-50',
    textColor: 'text-purple-900',
    badgeBg: 'bg-purple-600',
    tagline: 'Maestria absoluta — nível internacional',
    description:
      'Maestria técnica aliada à orquestração tática irretocável. O jogador não entrega pontos fáceis; os adversários precisam suar muito para furar a sua defesa. Compete em nível internacional ou próximo disso. Cada golpe tem intenção clara e é executado com precisão cirúrgica mesmo sob pressão máxima.',
    characteristics: [
      'Precisão cirúrgica em todos os golpes sob qualquer pressão',
      'Orquestração tática irretocável com parceiro',
      'Nunca entrega pontos fáceis',
      'Serve como arma de desequilíbrio constante',
      'Resistência física e mental de nível internacional',
      'Capacidade de adaptar estratégia em tempo real',
    ],
    strengths: ['Excelência absoluta em todos os aspectos do jogo'],
    weaknesses: ['Refinamentos contínuos de elite'],
    nextStep:
      'Compete em torneios internacionais. Considera mentorizar jogadores mais novos para aprofundar sua compreensão do jogo.',
  },
];

export const LEVEL_OPTIONS = LEVEL_TABLE.map((level) => ({
  code: level.id,
  label: `${level.name} — USAP ${level.usap}`,
}));

// Primary lookup is by id; badge/name fallbacks preserve compatibility with stored or displayed values.
export function getLevelByCode(code) {
  return LEVEL_TABLE.find((level) => level.id === code || level.badge === code || level.name === code) || null;
}

export function getLevelByUsap(usapEquivalent) {
  if (!Number.isFinite(Number(usapEquivalent))) return null;
  const value = Number(usapEquivalent);
  return (
    LEVEL_TABLE.find((level) => {
      const [min, max = min] = level.usap
        .replace('+', '')
        .split('–')
        .map((part) => Number(part.trim()));
      return value >= min && value <= max;
    }) || LEVEL_TABLE[LEVEL_TABLE.length - 1]
  );
}
