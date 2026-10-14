/**
 * Tabela detalhada de nivelamento importada de fsalamoni/pickleball-nivelamento.
 */
import { tk } from '../../../core/i18n/index.js';

export const LEVEL_TABLE = [
  {
    id: 'iniciante_1',
    usap: '1.0 – 1.5',
    scoreRange: '0 – 10',
    normalizedRange: '0 – 10',
    name: tk('Iniciante Absoluto'),
    badge: '1.0',
    color: 'gray',
    borderColor: 'border-gray-300',
    bgColor: 'bg-gray-50',
    textColor: 'text-gray-800',
    badgeBg: 'bg-gray-500',
    tagline: tk('Primeiros contatos com a raquete'),
    description:
      tk('O jogador ainda está aprendendo as regras básicas, a empunhadura e os movimentos fundamentais. A bola raramente permanece em jogo por mais de 2 ou 3 rebatidas consecutivas. Os deslocamentos são lentos e sem posicionamento estratégico.'),
    characteristics: [
      tk('Não conhece todas as regras (cozinha, duplo quique, saque)'),
      tk('Dificuldade em manter a bola dentro da quadra'),
      tk('Sem controle de direção ou profundidade'),
      tk('Movimentação reativa e desordenada'),
      tk('Usa apenas golpe de direita com frequência'),
    ],
    strengths: [tk('Entusiasmo e disposição para aprender')],
    weaknesses: [tk('Erros não forçados em quase todos os pontos'), tk('Sem posicionamento de quadra')],
    nextStep:
      tk('Foque em aprender as regras, a empunhadura correta e a consistência básica: manter a bola em jogo por pelo menos 4 rebatidas seguidas.'),
  },
  {
    id: 'iniciante_2',
    usap: '2.0',
    scoreRange: '11 – 20',
    normalizedRange: '11 – 20',
    name: tk('Iniciante'),
    badge: '2.0',
    color: 'slate',
    borderColor: 'border-slate-300',
    bgColor: 'bg-slate-50',
    textColor: 'text-slate-800',
    badgeBg: 'bg-slate-500',
    tagline: tk('Conhece as regras, ainda sem consistência'),
    description:
      tk('O jogador já compreende as regras do jogo e consegue realizar saques válidos com regularidade. Porém, a consistência ainda é baixa: erros não forçados são frequentes, especialmente no backhand e em bolas que exigem deslocamento lateral. O jogo é predominantemente reativo.'),
    characteristics: [
      tk('Conhece as regras básicas do jogo'),
      tk('Saque válido com regularidade'),
      tk('Forehand funcional, backhand inconsistente'),
      tk('Dificuldade com bolas na cozinha (kitchen)'),
      tk('Posicionamento de quadra ainda em desenvolvimento'),
    ],
    strengths: [tk('Saque consistente'), tk('Compreensão das regras')],
    weaknesses: [tk('Backhand fraco'), tk('Muitos erros não forçados'), tk('Sem estratégia tática')],
    nextStep:
      tk('Trabalhe a consistência do backhand e comece a praticar o dink — o golpe suave na rede que é a base do pickleball avançado.'),
  },
  {
    id: 'iniciante_plus',
    usap: '2.5',
    scoreRange: '21 – 30',
    normalizedRange: '21 – 30',
    name: tk('Iniciante Plus'),
    badge: '2.5',
    color: 'blue',
    borderColor: 'border-blue-300',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-800',
    badgeBg: 'bg-blue-500',
    tagline: tk('Consistência emergindo, tática ainda ausente'),
    description:
      tk('O jogador já consegue manter ralis mais longos e tem ambos os lados da raquete funcionando. Começa a entender a importância do posicionamento na linha de cozinha, mas ainda comete erros táticos graves: tenta atacar bolas baixas, sobe à rede sem intenção clara e não usa o 3rd shot drop.'),
    characteristics: [
      tk('Ambos os lados da raquete funcionais'),
      tk('Ralis de 5 a 8 rebatidas com regularidade'),
      tk('Começa a se posicionar na linha de cozinha'),
      tk('Dink básico, sem controle direcional'),
      tk('Tenta atacar bolas que não deveria'),
    ],
    strengths: [tk('Consistência básica estabelecida'), tk('Ambos os lados funcionais')],
    weaknesses: [
      tk('Impulsividade tática (ataca na hora errada)'),
      tk('Sem 3rd shot drop'),
      tk('Dink sem controle de direção'),
    ],
    nextStep:
      tk('Aprenda e pratique o 3rd shot drop até a exaustão. Esse golpe é o divisor de águas entre iniciantes e intermediários.'),
  },
  {
    id: 'intermediario',
    usap: '3.0',
    scoreRange: '31 – 44',
    normalizedRange: '31 – 44',
    name: tk('Intermediário'),
    badge: '3.0',
    color: 'cyan',
    borderColor: 'border-cyan-400',
    bgColor: 'bg-cyan-50',
    textColor: 'text-cyan-900',
    badgeBg: 'bg-cyan-600',
    tagline: tk('Bons golpes, mas impulsividade predomina'),
    description:
      tk('O jogador já acerta bons golpes de direita, saca bem e consegue sustentar o jogo. No entanto, a impaciência e a impulsividade predominam. Costuma bater na bola com força quando não deve — especialmente na transição — ou tenta atacar dinks muito baixos, gerando muitos erros. Ainda não domina o reset (amortecimento defensivo).'),
    characteristics: [
      tk('Forehand forte e confiável'),
      tk('Saque com profundidade e direção'),
      tk('Tenta usar o 3rd shot drop, mas inconsistente'),
      tk('Dink com algum controle direcional'),
      tk('Impulsividade: ataca bolas que deveria amortecer'),
      tk('Reset defensivo ausente ou muito fraco'),
    ],
    strengths: [tk('Forehand agressivo'), tk('Saque com intenção'), tk('Resistência física razoável')],
    weaknesses: [
      tk('Impulsividade tática'),
      tk('Reset defensivo fraco'),
      tk('3rd shot drop inconsistente sob pressão'),
    ],
    nextStep:
      tk('Controle o impulso de atacar. Aprenda que o pickleball exige amortecer a bola (reset) e jogar suavemente na rede. Pratique o "deixar a bola passar" quando estiver fora de posição.'),
  },
  {
    id: 'intermediario_plus',
    usap: '3.5',
    scoreRange: '45 – 61',
    normalizedRange: '45 – 61',
    name: tk('Intermediário Plus'),
    badge: '3.5',
    color: 'emerald',
    borderColor: 'border-emerald-400',
    bgColor: 'bg-emerald-50',
    textColor: 'text-emerald-900',
    badgeBg: 'bg-emerald-600',
    tagline: tk('Inteligência tática emergindo'),
    description:
      tk('O jogador compreende a essência da inteligência do jogo. Movimenta-se bem com seu parceiro, já tenta ativamente usar o drop shot e consegue trocar dinks com controle direcional. Porém, quando a pressão aumenta, a consistência falha ou perde a margem tática. O reset ainda não é confiável sob pressão máxima.'),
    characteristics: [
      tk('Compreende e aplica o 3rd shot drop com regularidade'),
      tk('Dink com controle direcional e variação de ritmo'),
      tk('Boa sincronização básica com parceiro'),
      tk('Começa a usar slice e lobs estrategicamente'),
      tk('Reset funcional, mas falha sob pressão máxima'),
      tk('Leitura de jogo em desenvolvimento'),
    ],
    strengths: [
      tk('Inteligência tática básica'),
      tk('Dink direcional'),
      tk('3rd shot drop razoável'),
      tk('Boa movimentação de duplas'),
    ],
    weaknesses: [
      tk('Consistência falha sob pressão'),
      tk('Reset não confiável em situações extremas'),
      tk('Ainda comete erros táticos em momentos decisivos'),
    ],
    nextStep:
      tk('Transforme os golpes que você já sabe fazer "às vezes" em ferramentas que você faz "frequentemente". Foque especialmente no reset defensivo sob pressão máxima.'),
  },
  {
    id: 'avancado',
    usap: '4.0',
    scoreRange: '62 – 77',
    normalizedRange: '62 – 77',
    name: tk('Avançado'),
    badge: '4.0',
    color: 'orange',
    borderColor: 'border-orange-400',
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-900',
    badgeBg: 'bg-orange-500',
    tagline: tk('Domínio técnico com margem de erro reduzida'),
    description:
      tk('A margem de erro não forçado despencou estatisticamente. O jogador domina ambas as faces da raquete (spins e slices) e lê perfeitamente as situações táticas, escolhendo amortecer ou acelerar conforme a posição da dupla adversária. Tem reflexos rápidos para bloquear voleios difíceis e usa o stacking com naturalidade.'),
    characteristics: [
      tk('Erros não forçados raros em situações normais'),
      tk('Domínio de spin e slice em ambos os lados'),
      tk('Leitura tática apurada: sabe quando atacar e quando defender'),
      tk('Reset confiável mesmo sob pressão extrema'),
      tk('Usa stacking e posicionamento avançado de duplas'),
      tk('Reflexos rápidos para bloqueios na rede'),
    ],
    strengths: [
      tk('Consistência técnica alta'),
      tk('Leitura tática avançada'),
      tk('Domínio de spin/slice'),
      tk('Stacking e estratégias de duplas'),
    ],
    weaknesses: [
      tk('Pode ainda ter vícios biomecânicos sob exaustão física'),
      tk('Estratégias complexas de desestabilização ainda em refinamento'),
    ],
    nextStep:
      tk('Foque em artifícios de desestabilização contínua (estratégias complexas de dupla) e extinga qualquer vício biomecânico restante sob exaustão física.'),
  },
  {
    id: 'pro',
    usap: '4.5',
    scoreRange: '78 – 89',
    normalizedRange: '78 – 89',
    name: tk('PRO'),
    badge: '4.5',
    color: 'red',
    borderColor: 'border-red-400',
    bgColor: 'bg-red-50',
    textColor: 'text-red-900',
    badgeBg: 'bg-red-600',
    tagline: tk('Nível competitivo nacional'),
    description:
      tk('Jogador de nível competitivo nacional. As decisões são automatizadas, o jogador antecipa os movimentos dos adversários e manipula ralis lentos ou frenéticos ao seu favor. Domina perfeitamente estratégias complexas de duplas como o stacking e a interceptação fluida. Raramente entrega pontos fáceis.'),
    characteristics: [
      tk('Decisões táticas automatizadas e instantâneas'),
      tk('Antecipação dos movimentos adversários'),
      tk('Manipulação de ritmo: acelera e desacelera o jogo com intenção'),
      tk('Stacking e interceptação fluida dominados'),
      tk('Serve como arma tática (spin, velocidade, direção)'),
      tk('Resistência física e mental de alto nível'),
    ],
    strengths: [
      tk('Automatização das decisões'),
      tk('Antecipação avançada'),
      tk('Controle total do ritmo do jogo'),
      tk('Excelência física e mental'),
    ],
    weaknesses: [tk('Refinamentos mínimos em situações de elite extrema')],
    nextStep:
      tk('Compete regularmente em torneios nacionais. Foque em análise de vídeo e coaching especializado para refinamentos de elite.'),
  },
  {
    id: 'open',
    usap: '5.0+',
    scoreRange: '90 – 100',
    normalizedRange: '90 – 100',
    name: tk('Open / Elite'),
    badge: '5.0',
    color: 'purple',
    borderColor: 'border-purple-400',
    bgColor: 'bg-purple-50',
    textColor: 'text-purple-900',
    badgeBg: 'bg-purple-600',
    tagline: tk('Maestria absoluta — nível internacional'),
    description:
      tk('Maestria técnica aliada à orquestração tática irretocável. O jogador não entrega pontos fáceis; os adversários precisam suar muito para furar a sua defesa. Compete em nível internacional ou próximo disso. Cada golpe tem intenção clara e é executado com precisão cirúrgica mesmo sob pressão máxima.'),
    characteristics: [
      tk('Precisão cirúrgica em todos os golpes sob qualquer pressão'),
      tk('Orquestração tática irretocável com parceiro'),
      tk('Nunca entrega pontos fáceis'),
      tk('Serve como arma de desequilíbrio constante'),
      tk('Resistência física e mental de nível internacional'),
      tk('Capacidade de adaptar estratégia em tempo real'),
    ],
    strengths: [tk('Excelência absoluta em todos os aspectos do jogo')],
    weaknesses: [tk('Refinamentos contínuos de elite')],
    nextStep:
      tk('Compete em torneios internacionais. Considera mentorizar jogadores mais novos para aprofundar sua compreensão do jogo.'),
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
