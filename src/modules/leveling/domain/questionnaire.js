/**
 * Formulário de nivelamento importado de fsalamoni/pickleball-nivelamento.
 * Usa 104 afirmações comportamentais em escala Likert, agrupadas por categoria.
 */

export const LIKERT_STATEMENTS = [
  // ─────────────────────────────────────────────────────────────
  // Categoria 9: Conhecimento de Regras (8) — ABA 1
  // ─────────────────────────────────────────────────────────────
  {
    id: 'q96', category: 'Conhecimento de Regras',
    statement: 'Conheço perfeitamente a regra do duplo quique (double bounce rule) e a aplico corretamente em todas as situações de jogo.',
    context: 'A regra do duplo quique exige que tanto o saque quanto a devolução do saque quiquem antes de serem rebatidos. Só após os dois quiques a bola pode ser interceptada no ar (voleio). Jogadores iniciantes frequentemente cometem faltas por desconhecer ou esquecer essa regra.',
  },
  {
    id: 'q97', category: 'Conhecimento de Regras',
    statement: 'Entendo completamente as regras de saque: bola deve ser batida abaixo da cintura, raquete abaixo do pulso, e a bola deve cair na diagonal oposta.',
    context: 'O saque no pickleball tem regras específicas: deve ser executado com movimento de baixo para cima (underhand), a cabeça da raquete deve estar abaixo do pulso no momento do contato, e a bola deve ser batida abaixo da linha da cintura. Violações são faltas comuns mesmo em jogadores intermediários.',
  },
  {
    id: 'q98', category: 'Conhecimento de Regras',
    statement: 'Conheço e respeito a regra da zona de não-voleio (kitchen/cozinha): nunca voleio dentro da zona e sei quando posso entrar nela.',
    context: 'A "kitchen" é a zona de não-voleio de 2,13m de cada lado da rede. Você não pode voleiar (bater a bola no ar) estando dentro dela. Porém, pode entrar na kitchen para bater uma bola que quicou dentro dela. Errar essa regra é uma das faltas mais comuns no pickleball.',
  },
  {
    id: 'q99', category: 'Conhecimento de Regras',
    statement: 'Estou atualizado com as mudanças mais recentes nas regras oficiais (2024-2026) e as aplico corretamente nas partidas.',
    context: 'As regras do pickleball são atualizadas anualmente pela USA Pickleball (USAP) e pela IFP. Mudanças recentes incluem regras sobre o "spin serve" (proibido), "chainsaw serve" (proibido) e clarificações sobre o drop serve. Jogadores que não acompanham as atualizações podem cometer faltas sem saber.',
  },
  {
    id: 'q100', category: 'Conhecimento de Regras',
    statement: 'Conheço as diferentes faltas do pickleball (foot fault, kitchen fault, carry, double hit) e as reconheço quando ocorrem.',
    context: 'Faltas comuns incluem: foot fault (pisar na linha durante o saque), kitchen fault (voleiar dentro da kitchen ou com momentum que leva o pé para dentro), carry (segurar a bola na raquete), double hit (bater duas vezes). Reconhecer essas faltas é essencial para jogar com integridade.',
  },
  {
    id: 'q101', category: 'Conhecimento de Regras',
    statement: 'Sou honesto com meus chamados: se não tenho certeza se uma bola estava dentro ou fora, dou o benefício da dúvida ao oponente.',
    context: 'No pickleball, o jogador que recebe é responsável por chamar as bolas dentro ou fora em seu lado. A regra de fair play determina que, na dúvida, a bola deve ser considerada dentro. Jogadores que chamam bolas fora sem certeza prejudicam a integridade do esporte.',
  },
  {
    id: 'q102', category: 'Conhecimento de Regras',
    statement: 'Conheço as regras de linha: uma bola que toca qualquer parte da linha (exceto a linha de kitchen no saque) é considerada dentro.',
    context: 'No pickleball, qualquer bola que toca a linha é considerada dentro — exceto no saque, onde a bola não pode cair na linha da kitchen (Non-Volley Zone). Essa distinção é importante e frequentemente mal compreendida por iniciantes.',
  },
  {
    id: 'q103', category: 'Conhecimento de Regras',
    statement: 'Entendo as regras de pontuação: apenas o time que saca pode marcar ponto, e o saque passa para o adversário após dois erros (em duplas).',
    context: 'No sistema tradicional de pontuação do pickleball (side-out scoring), apenas o time que está sacando pode marcar pontos. Em duplas, cada jogador do time saca antes de passar o saque ao adversário (exceto no início do jogo, onde apenas um jogador saca). O jogo vai até 11 pontos (vence por 2).',
  },

  // ─────────────────────────────────────────────────────────────
  // Categoria 10: Experiência (6) — ABA 2
  // ─────────────────────────────────────────────────────────────
  {
    id: 'q104', category: 'Experiência',
    statement: 'Tenho participado de torneios oficiais regularmente (pelo menos 2 por ano) e tenho experiência real em jogos sob pressão competitiva.',
    context: 'Experiência competitiva real é diferente de jogar recreativamente. Torneios expõem o jogador a pressões específicas: árbitros, placar público, oponentes desconhecidos e estratégias variadas. Jogadores que nunca competiram tendem a superestimar seu nível quando comparados a jogadores com histórico competitivo.',
  },
  {
    id: 'q105', category: 'Experiência',
    statement: 'Meu histórico com outros esportes de raquete (tênis, padel, squash, badminton) me deu reflexos e leitura corporal que facilitam minha adaptação ao pickleball.',
    context: 'Jogadores com background em esportes de raquete têm vantagens iniciais significativas: timing de bola, reflexos, posicionamento de pés e leitura de trajetória. No entanto, alguns vícios (como bater forte como no tênis) podem ser obstáculos a superar no pickleball.',
  },
  {
    id: 'q106', category: 'Experiência',
    statement: 'Tenho treinado regularmente com jogadores de nível superior ao meu e absorvi técnicas e táticas deles ao longo do tempo.',
    context: 'Treinar com jogadores mais avançados é uma das formas mais eficazes de evolução. Eles expõem suas fraquezas, forçam adaptações táticas e demonstram padrões de jogo que não aparecem em partidas de mesmo nível. Jogadores que só jogam com pares de mesmo nível evoluem mais lentamente.',
  },
  {
    id: 'q108', category: 'Experiência',
    statement: 'Consigo aplicar lições aprendidas de partidas anteriores em novas situações de jogo, ajustando minha estratégia com base no que aprendi.',
    context: 'A capacidade de transferir aprendizado entre partidas é um indicador de maturidade esportiva. Jogadores que repetem os mesmos erros em partidas diferentes demonstram baixa consciência tática. Jogadores avançados analisam suas partidas (mentalmente ou em vídeo) e aplicam ajustes concretos.',
  },
  {
    id: 'q109', category: 'Experiência',
    statement: 'Tenho jogado em diferentes contextos (amistosos, torneios, quadras diferentes, diferentes parceiros) e isso ampliou minha compreensão do jogo.',
    context: 'Diversidade de experiências é fundamental para o desenvolvimento. Jogar em quadras diferentes (indoor/outdoor, superfícies variadas), com diferentes parceiros e em diferentes contextos competitivos expõe o jogador a situações que não aparecem no ambiente habitual de jogo.',
  },
  {
    id: 'q110', category: 'Experiência',
    statement: 'Minha confiança em quadra vem da experiência acumulada: sei o que funciona e o que não funciona em diferentes situações de jogo.',
    context: 'Confiança baseada em experiência é diferente de arrogância. Um jogador experiente sabe quando arriscar e quando ser conservador, baseado em situações vividas anteriormente. Essa confiança situacional é um dos principais diferenciadores entre jogadores intermediários e avançados.',
  },

  // ─────────────────────────────────────────────────────────────
  // Categoria 1: Saque e Recepção (11) — ABA 3
  // ─────────────────────────────────────────────────────────────
  {
    id: 'q1', category: 'Saque e Recepção',
    statement: 'Quando saco, consigo mirar profundamente na quadra adversária e vario a velocidade da bola intencionalmente para dificultar a recepção.',
    context: 'Profundidade no saque é fundamental: bolas curtas permitem que o adversário avance para a rede imediatamente. Variação de velocidade (saques lentos e rápidos) desestabiliza o ritmo do receptor. Jogadores iniciantes sacam sempre com a mesma velocidade e sem mirar profundidade.',
  },
  {
    id: 'q2', category: 'Saque e Recepção',
    statement: 'Minhas devoluções de saque mantêm os oponentes no fundo da quadra e me dão tempo suficiente para avançar imediatamente para a linha da rede.',
    context: 'A devolução do saque deve ser profunda (perto da linha de fundo) para impedir que o sacador avance para a rede. Uma devolução curta permite que o sacador avance e tome posição de ataque. O objetivo é ganhar tempo para avançar você mesmo para a rede.',
  },
  {
    id: 'q3', category: 'Saque e Recepção',
    statement: 'Sinto a mesma confiança e consistência rebatendo do fundo da quadra tanto com meu forehand (direita) quanto com meu backhand (esquerda), sem precisar "fugir" da bola.',
    context: 'Muitos jogadores intermediários têm um lado significativamente mais fraco (geralmente o backhand). "Fugir" da bola (correr para bater de forehand em bolas que deveriam ser de backhand) é um sinal claro de fraqueza técnica e desperdiça energia e posicionamento.',
  },
  {
    id: 'q6', category: 'Saque e Recepção',
    statement: 'Consigo devolver saques com força e profundidade, mesmo quando o saque adversário é rápido ou vem com efeito (spin).',
    context: 'Saques com efeito (topspin, slice) mudam a trajetória da bola após o quique, dificultando a devolução. Jogadores que não conseguem lidar com saques com efeito ficam na defensiva desde o início do ponto.',
  },
  {
    id: 'q7', category: 'Saque e Recepção',
    statement: 'Quando recebo um saque fraco ou curto, reconheço a oportunidade e ataco imediatamente em vez de apenas devolver de forma passiva.',
    context: 'Um saque fraco ou curto é uma oportunidade de ataque. Jogadores que simplesmente devolvem saques fracos de forma passiva desperdiçam vantagens táticas. A capacidade de reconhecer e aproveitar essas oportunidades é um sinal de maturidade tática.',
  },
  {
    id: 'q9', category: 'Saque e Recepção',
    statement: 'Consigo fazer saques com efeito (slice, topspin) com consistência e precisão, variando para desestabilizar o receptor.',
    context: 'Saques com efeito são ferramentas táticas avançadas. O slice faz a bola "escorregar" após o quique; o topspin faz a bola saltar alto. Dominar essas variações dá ao sacador mais opções para criar dificuldades ao receptor.',
  },
  {
    id: 'q11', category: 'Saque e Recepção',
    statement: 'Consigo ler a intenção do saque adversário pela postura e movimento do sacador antes de ele bater a bola.',
    context: 'Jogadores avançados "telegrafam" suas intenções pela postura, posição dos pés e movimento de raquete antes do contato. Ler esses sinais permite ao receptor se posicionar melhor antes do saque, ganhando tempo de reação.',
  },
  {
    id: 'q12', category: 'Saque e Recepção',
    statement: 'Meus saques são consistentes mesmo sob pressão (finais de set, pontos críticos, placar apertado).',
    context: 'Pressão psicológica afeta a mecânica de golpes. Jogadores que sacam bem no aquecimento mas erram em pontos críticos demonstram fragilidade mental. Consistência sob pressão é um dos principais diferenciadores entre níveis.',
  },
  {
    id: 'q13', category: 'Saque e Recepção',
    statement: 'Meu saque tem velocidade e força suficientes para impedir que oponentes avancem facilmente para a rede após a devolução.',
    context: 'Um saque forte e profundo dificulta que o receptor faça uma devolução agressiva e avance para a rede. Saques fracos permitem que o receptor tome a iniciativa e se posicione ofensivamente desde o início do ponto.',
  },
  {
    id: 'q111', category: 'Saque e Recepção',
    statement: 'Meu retorno de saque é agressivo o suficiente para colocar pressão no sacador, mas controlado o suficiente para não cometer erros não forçados.',
    context: 'O equilíbrio entre agressividade e controle no retorno é uma habilidade avançada. Retornos muito passivos dão ao sacador tempo para avançar; retornos muito agressivos geram erros. O retorno ideal é profundo, com margem de segurança e que force o sacador a fazer um terceiro golpe difícil.',
  },

  // ─────────────────────────────────────────────────────────────
  // Categoria 2: Golpes de Fundo (12) — ABA 4
  // ─────────────────────────────────────────────────────────────
  {
    id: 'q14', category: 'Golpes de Fundo',
    statement: 'Meu forehand do fundo é consistente e preciso, mesmo sob pressão ou quando a bola vem com efeito (topspin, slice).',
    context: 'O forehand é geralmente o golpe mais forte dos jogadores. Mas consistência sob pressão — quando a bola vem com efeito, em alta velocidade ou em posição difícil — é o que diferencia jogadores de diferentes níveis. Bolas com topspin saltam alto; bolas com slice ficam baixas.',
  },
  {
    id: 'q15', category: 'Golpes de Fundo',
    statement: 'Meu backhand do fundo é tão confiável quanto meu forehand: não sinto medo ou hesitação quando a bola vem para meu lado esquerdo.',
    context: 'O backhand é o ponto fraco da maioria dos jogadores iniciantes e intermediários. Jogadores que "fogem" do backhand (correndo para bater de forehand) ficam fora de posição e são facilmente explorados. Um backhand sólido é essencial para subir de nível.',
  },
  {
    id: 'q16', category: 'Golpes de Fundo',
    statement: 'Quando estou no fundo da quadra, consigo variar a altura e a profundidade dos meus golpes intencionalmente para desestabilizar oponentes.',
    context: 'Variação é uma ferramenta tática poderosa. Alternar entre bolas altas (lobs) e baixas, profundas e curtas, força o adversário a se adaptar constantemente. Jogadores que batem sempre com a mesma altura e profundidade são previsíveis e fáceis de defender.',
  },
  {
    id: 'q17', category: 'Golpes de Fundo',
    statement: 'Meus golpes do fundo geram profundidade suficiente para manter oponentes recuados, dando-me tempo para avançar para a rede.',
    context: 'Profundidade nos golpes de fundo é essencial para controlar o ritmo do jogo. Bolas que caem perto da linha de fundo forçam o adversário a recuar, dando tempo ao atacante para avançar. Bolas curtas permitem que o adversário avance e tome posição de ataque.',
  },
  {
    id: 'q18', category: 'Golpes de Fundo',
    statement: 'Consigo bater com slice (efeito de costas) com controle e propósito estratégico, não apenas como recurso defensivo de emergência.',
    context: 'O slice é um golpe versátil: pode ser usado defensivamente (para ganhar tempo) ou ofensivamente (para manter a bola baixa e dificultar o ataque adversário). Jogadores que usam o slice apenas como último recurso perdem uma ferramenta tática importante.',
  },
  {
    id: 'q19', category: 'Golpes de Fundo',
    statement: 'Meus golpes do fundo têm boa margem de segurança: raramente cometo erros não forçados do baseline em situações normais de jogo.',
    context: 'Erros não forçados do fundo (bolas na rede ou fora sem pressão adversária) são o principal problema de jogadores iniciantes e intermediários. Consistência — manter a bola em jogo — é mais importante do que força ou velocidade nos níveis iniciais.',
  },
  {
    id: 'q20', category: 'Golpes de Fundo',
    statement: 'Consigo fazer golpes cruzados e paralelos com precisão, movimentando meu oponente lateralmente para criar espaços.',
    context: 'Direcionalidade é uma habilidade técnica avançada. Golpes cruzados (para o lado oposto) e paralelos (pelo mesmo lado) com precisão permitem ao jogador mover o adversário e criar espaços abertos na quadra para atacar.',
  },
  {
    id: 'q21', category: 'Golpes de Fundo',
    statement: 'Meu posicionamento no fundo é correto: fico com os joelhos flexionados, peso nos dedos dos pés e pronto para me mover em qualquer direção.',
    context: 'Postura defensiva correta — joelhos flexionados, peso nos dedos dos pés, raquete na frente do corpo — é fundamental para reagir rapidamente. Jogadores que ficam em pé com os joelhos esticados têm tempo de reação significativamente menor.',
  },
  {
    id: 'q22', category: 'Golpes de Fundo',
    statement: 'Consigo recuperar-me rapidamente de bolas difíceis no fundo (bolas largas, profundas ou com efeito) sem comprometer meu equilíbrio.',
    context: 'Recuperação rápida após bolas difíceis é um indicador de condicionamento físico e técnico. Jogadores que ficam desequilibrados após bolas difíceis ficam fora de posição para o próximo golpe, criando vulnerabilidades táticas.',
  },
  {
    id: 'q23', category: 'Golpes de Fundo',
    statement: 'Meus golpes do fundo mantêm qualidade técnica mesmo quando estou fisicamente cansado ou sob pressão psicológica.',
    context: 'Fadiga física e pressão psicológica degradam a técnica. Jogadores que mantêm a qualidade dos golpes mesmo cansados demonstram tanto condicionamento físico quanto mental. Esse é um dos principais diferenciadores entre níveis intermediário e avançado.',
  },
  {
    id: 'q25', category: 'Golpes de Fundo',
    statement: 'Minha técnica de golpe do fundo é eficiente: não gasto energia desnecessária em movimentos excessivos ou tensão muscular.',
    context: 'Eficiência técnica significa fazer o máximo com o mínimo de esforço. Jogadores com técnica ineficiente ficam mais cansados, cometem mais erros sob fadiga e têm menor consistência em partidas longas. A eficiência é desenvolvida com prática deliberada e correção técnica.',
  },
  {
    id: 'q112', category: 'Golpes de Fundo',
    statement: 'Consigo executar um passing shot (golpe paralelo ou cruzado) com precisão quando meu oponente está na rede tentando interceptar.',
    context: 'O passing shot é usado quando o adversário está na rede: o objetivo é passar a bola ao lado dele antes que consiga interceptar. Requer precisão direcional e velocidade suficiente. É uma das jogadas mais difíceis do pickleball e diferencia jogadores avançados.',
  },

  // ─────────────────────────────────────────────────────────────
  // Categoria 3: Jogo Curto e Dinks (13) — ABA 5
  // ─────────────────────────────────────────────────────────────
  {
    id: 'q26', category: 'Jogo Curto e Dinks',
    statement: 'Quando estou no fundo da quadra e preciso avançar (3º golpe), utilizo com sucesso um amortecimento (drop shot) para chegar à rede, em vez de apenas rebater forte.',
    context: 'O "3rd shot drop" é considerado o golpe mais importante do pickleball. Após o saque e a devolução, o sacador precisa avançar para a rede. O drop shot — uma bola suave que cai na kitchen adversária — é a forma mais eficaz de fazer isso sem dar uma bola atacável ao adversário.',
  },
  {
    id: 'q27', category: 'Jogo Curto e Dinks',
    statement: 'Durante disputas de dinks na rede, sustento ralis longos com paciência extrema, controlando a altura da bola sem levantá-la acidentalmente.',
    context: 'Paciência em ralis de dink é uma das habilidades mais difíceis de desenvolver. A tentação de atacar é constante, mas atacar um dink baixo resulta em erro ou bola fácil para o adversário. Jogadores avançados conseguem sustentar ralis de 20-30 dinks esperando a bola certa para atacar.',
  },
  {
    id: 'q28', category: 'Jogo Curto e Dinks',
    statement: 'Identifico instintivamente quando uma bola na rede não está alta o suficiente para ser atacada e resisto à tentação de cortá-la precipitadamente.',
    context: 'Disciplina em não atacar dinks baixos é fundamental. Uma bola que está abaixo da altura da rede não deve ser atacada — o ângulo desfavorável resulta em erro ou bola fácil. Jogadores que atacam dinks baixos cometem muitos erros não forçados.',
  },
  {
    id: 'q29', category: 'Jogo Curto e Dinks',
    statement: 'Diante de bolas aceleradas e fortes contra meu corpo, consigo usar a raquete como um "escudo" para bloquear e amortecer a bola de volta na kitchen (reset).',
    context: 'O "reset" é uma habilidade defensiva avançada: quando o adversário ataca forte, em vez de contra-atacar (o que resulta em erro), o jogador absorve a velocidade da bola e a devolve suavemente para a kitchen. É uma das habilidades mais difíceis e mais importantes do pickleball avançado.',
  },
  {
    id: 'q30', category: 'Jogo Curto e Dinks',
    statement: 'Uso os dinks de forma ofensiva e intencional (cruzados, paralelos, com efeito) para movimentar meus oponentes e desequilibrá-los, não apenas para manter a bola em jogo.',
    context: 'Dinks ofensivos são usados para criar oportunidades de ataque. Dinks cruzados forçam o adversário a se mover lateralmente; dinks com efeito (slice) ficam baixos e difíceis de atacar. Jogadores que usam dinks apenas defensivamente perdem uma ferramenta tática importante.',
  },
  {
    id: 'q32', category: 'Jogo Curto e Dinks',
    statement: 'Meus dinks têm altura e profundidade controladas: raramente levanto a bola acidentalmente para uma posição atacável pelo adversário.',
    context: 'Controle de altura é a habilidade técnica central do dink. Uma bola que passa acima da altura da rede é uma oportunidade de ataque para o adversário. Manter os dinks baixos — idealmente abaixo da fita da rede — é essencial para não dar pontos fáceis.',
  },
  {
    id: 'q33', category: 'Jogo Curto e Dinks',
    statement: 'Quando meu oponente levanta a bola acidentalmente (dink alto), reconheço a oportunidade imediatamente e ataco com agressividade calculada.',
    context: 'Reconhecer e aproveitar oportunidades de ataque é uma habilidade tática. Uma bola alta na rede é uma oportunidade de smash ou drive agressivo. Jogadores que não reconhecem essas oportunidades perdem pontos que deveriam ganhar.',
  },
  {
    id: 'q34', category: 'Jogo Curto e Dinks',
    statement: 'Meu drop shot (amortecimento) é consistente e cai perto da linha da kitchen, forçando oponentes a avançar e bater de baixo para cima.',
    context: 'Um drop shot eficaz deve cair dentro da kitchen, perto da linha, forçando o adversário a avançar e bater de baixo para cima — o que dificulta o ataque. Drops que caem muito curtos (perto da rede) são fáceis de atacar; drops que caem fora da kitchen são erros.',
  },
  {
    id: 'q35', category: 'Jogo Curto e Dinks',
    statement: 'Consigo fazer dinks com efeito (slice, topspin) para variar o jogo e criar dificuldades adicionais para o adversário.',
    context: 'Dinks com efeito são ferramentas avançadas: o slice mantém a bola baixa e "escorregadia"; o topspin faz a bola saltar mais alto após o quique. Variar o efeito nos dinks desestabiliza o ritmo do adversário e cria oportunidades de ataque.',
  },
  {
    id: 'q36', category: 'Jogo Curto e Dinks',
    statement: 'Minha posição na rede é agressiva: fico próximo à linha da kitchen para interceptar bolas e reduzir os ângulos disponíveis para o adversário.',
    context: 'Posicionamento na rede é crucial. Ficar próximo à kitchen (sem entrar nela para voleiar) reduz o tempo de reação do adversário e aumenta os ângulos de ataque disponíveis para você. Jogadores que ficam muito atrás da kitchen perdem essas vantagens.',
  },
  {
    id: 'q37', category: 'Jogo Curto e Dinks',
    statement: 'Consigo manter os dinks baixos e controlados mesmo quando meu oponente tenta acelerar o ritmo ou me pressionar com bolas mais rápidas.',
    context: 'Manter o controle sob pressão é uma habilidade defensiva avançada. Quando o adversário acelera o ritmo, a tendência é reagir com força — o que resulta em bolas altas e atacáveis. Manter a calma e continuar com dinks baixos é a resposta correta.',
  },
  {
    id: 'q38', category: 'Jogo Curto e Dinks',
    statement: 'Meus dinks são consistentes mesmo em momentos críticos (finais de set, pontos de game, placar apertado).',
    context: 'Consistência sob pressão é um dos principais diferenciadores de nível. Jogadores que dinkam bem no aquecimento mas erram em pontos críticos demonstram fragilidade mental. Manter a técnica sob pressão requer tanto habilidade técnica quanto mental.',
  },
  {
    id: 'q39', category: 'Jogo Curto e Dinks',
    statement: 'Consigo ler a intenção do oponente nos dinks pela postura, ângulo de raquete e movimento corporal antes do contato.',
    context: 'Antecipação em ralis de dink é uma habilidade avançada. Jogadores experientes "telegrafam" suas intenções pela postura e ângulo de raquete. Ler esses sinais permite ao defensor se posicionar antes do golpe, ganhando tempo de reação.',
  },

  // ─────────────────────────────────────────────────────────────
  // Categoria 4: Voleios e Rede (12) — ABA 6
  // ─────────────────────────────────────────────────────────────
  {
    id: 'q41', category: 'Voleios e Rede',
    statement: 'Quando estou na rede, tenho reflexos rápidos o suficiente para bloquear voleios surpresa e manter a bola em jogo mesmo em situações difíceis.',
    context: 'Reflexos na rede são fundamentais no pickleball. Bolas aceleradas chegam em frações de segundo, exigindo reação automática. Jogadores com reflexos lentos ficam na defensiva na rede e cometem muitos erros por falta de tempo de reação.',
  },
  {
    id: 'q42', category: 'Voleios e Rede',
    statement: 'Meus voleios ofensivos são agressivos e precisos: quando tenho uma bola alta na rede, termino o ponto com confiança e sem hesitação.',
    context: 'Finalizar pontos com voleios ofensivos é uma habilidade essencial. Jogadores que hesitam diante de bolas altas ou batem sem precisão perdem oportunidades de ganhar pontos facilmente. A confiança no voleio ofensivo vem de prática específica.',
  },
  {
    id: 'q44', category: 'Voleios e Rede',
    statement: 'Consigo fazer voleios defensivos com controle, mantendo a bola baixa na kitchen adversária mesmo quando estou sendo atacado com força.',
    context: 'Voleios defensivos (bloqueios) são usados quando o adversário ataca forte. O objetivo é absorver a velocidade da bola e devolvê-la suavemente para a kitchen — o "reset". É uma das habilidades mais difíceis do pickleball e diferencia jogadores avançados.',
  },
  {
    id: 'q45', category: 'Voleios e Rede',
    statement: 'Consigo fazer voleios em ambos os lados (forehand e backhand) com igual confiança, precisão e sem preferência por um lado.',
    context: 'Voleios ambidestros são essenciais na rede. Bolas vêm para os dois lados com velocidade, sem tempo para reposicionar. Jogadores com backhand fraco na rede são facilmente explorados por adversários que direcionam para esse lado.',
  },
  {
    id: 'q46', category: 'Voleios e Rede',
    statement: 'Quando meu parceiro está na rede e eu estou atrás, cubro adequadamente minha área e não deixo buracos defensivos no centro da quadra.',
    context: 'Cobertura defensiva em duplas requer sincronização. Quando um parceiro está na rede e o outro está atrás, há uma divisão clara de responsabilidades. Buracos no centro da quadra são explorados por adversários experientes com bolas entre os dois jogadores.',
  },
  {
    id: 'q47', category: 'Voleios e Rede',
    statement: 'Meus voleios têm profundidade adequada: não deixo a bola cair perto da rede adversária, dando tempo ao adversário para se recuperar.',
    context: 'Profundidade em voleios é importante para manter pressão. Voleios curtos (que caem perto da rede) dão tempo ao adversário para avançar e contra-atacar. Voleios profundos (perto da linha de fundo) mantêm o adversário recuado.',
  },
  {
    id: 'q48', category: 'Voleios e Rede',
    statement: 'Consigo fazer voleios com efeito (slice, topspin) para variar o jogo e criar dificuldades adicionais para o adversário.',
    context: 'Voleios com efeito são ferramentas avançadas. O slice no voleio mantém a bola baixa e difícil de atacar; o topspin cria ângulos mais agudos. Variar o efeito nos voleios desestabiliza o adversário e cria oportunidades de finalização.',
  },
  {
    id: 'q49', category: 'Voleios e Rede',
    statement: 'Minha postura na rede é correta: joelhos flexionados, peso nos dedos dos pés, raquete na frente do corpo e pronto para reagir rapidamente.',
    context: 'Postura correta na rede é fundamental para o tempo de reação. Joelhos flexionados e peso nos dedos dos pés permitem movimento lateral rápido. Raquete na frente do corpo reduz o tempo de preparação para o golpe.',
  },
  {
    id: 'q50', category: 'Voleios e Rede',
    statement: 'Consigo fazer voleios de transição (quando estou avançando para a rede) com controle, sem deixar bolas fáceis para o adversário.',
    context: 'Voleios de transição são feitos enquanto o jogador está se movendo para a rede. São tecnicamente mais difíceis que voleios estáticos porque o jogador está em movimento. Errar voleios de transição é comum em jogadores intermediários.',
  },
  {
    id: 'q51', category: 'Voleios e Rede',
    statement: 'Meus voleios mantêm qualidade técnica mesmo em momentos de alta pressão (finais de set, pontos críticos).',
    context: 'Consistência sob pressão é um dos principais diferenciadores de nível. Voleios que funcionam bem no aquecimento mas falham em pontos críticos indicam fragilidade mental. Manter a técnica sob pressão requer tanto habilidade técnica quanto mental.',
  },
  {
    id: 'q52', category: 'Voleios e Rede',
    statement: 'Consigo antecipar para onde meu oponente vai direcionar a bola, baseado em sua postura e movimento de raquete, antes do contato.',
    context: 'Antecipação na rede é uma habilidade avançada que reduz o tempo de reação necessário. Jogadores experientes leem os sinais corporais do adversário antes do contato com a bola, posicionando-se antes do golpe.',
  },
  {
    id: 'q114', category: 'Voleios e Rede',
    statement: 'Consigo executar um smash (ataque aéreo) com precisão e força quando tenho uma bola alta na rede, terminando o ponto de forma confiante.',
    context: 'O smash é o golpe mais poderoso do pickleball: uma bola alta é atacada de cima para baixo com força máxima. Requer timing preciso, posicionamento correto e técnica específica. Errar smashes fáceis é um sinal de falta de prática específica nesse golpe.',
  },

  // ─────────────────────────────────────────────────────────────
  // Categoria 5: Leitura de Jogo (9) — ABA 7
  // ─────────────────────────────────────────────────────────────
  {
    id: 'q53', category: 'Leitura de Jogo',
    statement: 'Sou capaz de mudar completamente meu estilo de jogo no meio da partida, caso perceba um padrão exploitável ou uma fraqueza repetitiva nos oponentes.',
    context: 'Adaptação tática em tempo real é uma habilidade avançada. Jogadores que jogam sempre da mesma forma são previsíveis e fáceis de defender. A capacidade de identificar e explorar fraquezas adversárias durante a partida diferencia jogadores avançados.',
  },
  {
    id: 'q54', category: 'Leitura de Jogo',
    statement: 'Domino e utilizo de forma fluida táticas avançadas como stacking (troca de posicionamento) e poaching/Erne (interceptações surpresa na rede).',
    context: 'Stacking é uma estratégia de duplas onde ambos os jogadores ficam do mesmo lado para manter o jogador mais forte no forehand. Poaching é interceptar a bola do parceiro na rede. Erne é um golpe avançado onde o jogador salta ao lado da kitchen para atacar. Essas táticas são usadas em nível 4.0+.',
  },
  {
    id: 'q55', category: 'Leitura de Jogo',
    statement: 'Identifico rapidamente se meus oponentes preferem bolas altas ou baixas, cruzadas ou paralelas, e ajusto meu jogo para explorar suas fraquezas.',
    context: 'Análise de padrões adversários é fundamental para o jogo tático. Jogadores têm preferências e fraquezas: alguns odeiam bolas no corpo, outros têm backhand fraco, outros não conseguem lidar com bolas baixas. Identificar e explorar essas fraquezas é o que diferencia jogadores táticos.',
  },
  {
    id: 'q56', category: 'Leitura de Jogo',
    statement: 'Reconheço quando um oponente está fisicamente cansado ou mentalmente desconcentrado e aumento a agressividade no momento certo.',
    context: 'Leitura do estado físico e emocional do adversário é uma habilidade tática avançada. Aumentar o ritmo quando o adversário está cansado ou errar quando está desconcentrado são estratégias que jogadores experientes usam conscientemente.',
  },
  {
    id: 'q57', category: 'Leitura de Jogo',
    statement: 'Consigo prever para onde meu oponente vai direcionar a bola, baseado em sua postura corporal, posição dos pés e movimento de raquete.',
    context: 'Antecipação de golpes é uma habilidade que reduz o tempo de reação necessário. Jogadores experientes "leem" o corpo do adversário antes do contato com a bola. Posição dos pés indica direção; ângulo de raquete indica efeito; postura indica força.',
  },
  {
    id: 'q58', category: 'Leitura de Jogo',
    statement: 'Quando estou em desvantagem no rali (fora de posição, sob pressão), reconheço quando devo ser agressivo e quando devo ser paciente e defensivo.',
    context: 'Gestão de risco tática é fundamental. Atacar quando está em desvantagem resulta em erros; ser muito passivo quando está em vantagem desperdiça oportunidades. A capacidade de avaliar o risco de cada golpe é um dos principais diferenciadores de nível.',
  },
  {
    id: 'q60', category: 'Leitura de Jogo',
    statement: 'Meu jogo é adaptável: consigo jogar defensivamente quando necessário e ofensivamente quando a oportunidade surge, sem ser previsível.',
    context: 'Flexibilidade tática — a capacidade de alternar entre estilos de jogo conforme a situação — é uma habilidade avançada. Jogadores previsíveis (sempre defensivos ou sempre agressivos) são fáceis de defender. A imprevisibilidade é uma vantagem tática.',
  },
  {
    id: 'q113', category: 'Leitura de Jogo',
    statement: 'Meu jogo curto (dinks e drops) é tão importante e desenvolvido quanto meu jogo de fundo: dedico tempo significativo ao treinamento específico dessas habilidades.',
    context: 'O jogo curto é o coração do pickleball avançado. Jogadores que negligenciam o treinamento de dinks e drops em favor de golpes de força ficam limitados em nível 3.0-3.5. A maioria dos pontos em nível 4.0+ é decidida no jogo curto.',
  },
  {
    id: 'q115', category: 'Leitura de Jogo',
    statement: 'Reconheço quando devo atacar agressivamente e quando devo consolidar a posição: minha agressividade é calculada e baseada na situação, não em impulso.',
    context: 'Agressividade calculada é diferente de agressividade impulsiva. Atacar na hora certa (bola alta, adversário fora de posição) é correto; atacar na hora errada (bola baixa, adversário bem posicionado) resulta em erro. A capacidade de distinguir as duas situações é fundamental.',
  },

  // ─────────────────────────────────────────────────────────────
  // Categoria 6: Dinâmica de Duplas (11) — ABA 8
  // ─────────────────────────────────────────────────────────────
  {
    id: 'q63', category: 'Dinâmica de Duplas',
    statement: 'Minha comunicação com meu parceiro durante o rali ("minha!", "sua!", "fora!") é automática, constante e antecipada — não reativa.',
    context: 'Comunicação em duplas deve ser proativa, não reativa. "Minha!" antes de bater, "fora!" antes da bola sair. Comunicação reativa (depois que a bola já passou) é ineficaz. Duplas que comunicam bem evitam confusões e cobrem a quadra de forma mais eficiente.',
  },
  {
    id: 'q64', category: 'Dinâmica de Duplas',
    statement: 'Movimento-me em quadra como se estivesse "amarrado" ao meu parceiro: quando ele avança, eu avanço; quando ele recua, eu recuo, fechando o centro.',
    context: 'Sincronização de movimento em duplas é fundamental. A dupla deve se mover como uma unidade, mantendo a distância entre os parceiros constante e fechando o centro da quadra. Duplas que não sincronizam deixam buracos que adversários experientes exploram.',
  },
  {
    id: 'q65', category: 'Dinâmica de Duplas',
    statement: 'Consigo trabalhar bem com diferentes parceiros, adaptando-me rapidamente ao estilo, pontos fortes e fraquezas de cada um.',
    context: 'Flexibilidade em parcerias é uma habilidade valiosa. Jogadores que só funcionam bem com um parceiro específico têm limitações táticas. A capacidade de adaptar o estilo de jogo ao parceiro disponível é um sinal de maturidade esportiva.',
  },
  {
    id: 'q66', category: 'Dinâmica de Duplas',
    statement: 'Quando meu parceiro comete um erro, mantenho a compostura, ofereço encorajamento e não deixo isso afetar meu próprio desempenho.',
    context: 'Resiliência emocional em duplas é fundamental. Jogadores que ficam frustrados com os erros do parceiro criam um ambiente negativo que afeta o desempenho de ambos. A capacidade de manter a compostura e apoiar o parceiro é um sinal de maturidade esportiva.',
  },
  {
    id: 'q67', category: 'Dinâmica de Duplas',
    statement: 'Apoio meu parceiro verbalmente durante o jogo, oferecendo feedback positivo e encorajamento, especialmente em momentos difíceis.',
    context: 'Suporte emocional ao parceiro é parte integrante do jogo em duplas. Duplas que se apoiam mutuamente têm melhor desempenho do que duplas onde um ou ambos os jogadores ficam em silêncio ou negativos após erros.',
  },
  {
    id: 'q68', category: 'Dinâmica de Duplas',
    statement: 'A comunicação com meu parceiro é clara e sem ambiguidades: nunca há dúvida sobre quem vai bater a bola que vem pelo centro.',
    context: 'Bolas pelo centro da quadra são as mais problemáticas em duplas: ambos os jogadores podem bater, resultando em confusão ou nenhum dos dois batendo. Definir claramente quem pega as bolas do centro (geralmente o jogador de forehand) evita esses problemas.',
  },
  {
    id: 'q69', category: 'Dinâmica de Duplas',
    statement: 'Consigo ler a linguagem corporal do meu parceiro e antecipar seus movimentos, posicionando-me de forma complementar.',
    context: 'Sincronização avançada com o parceiro vai além da comunicação verbal. Ler a linguagem corporal do parceiro — onde ele está se movendo, como está posicionado — permite ao outro jogador se posicionar de forma complementar, cobrindo as áreas que o parceiro deixa descobertas.',
  },
  {
    id: 'q70', category: 'Dinâmica de Duplas',
    statement: 'Meu parceiro confia plenamente em mim: ele sabe que vou cobrir minha área, não vou deixar buracos e vou comunicar claramente.',
    context: 'Confiança mútua em duplas é construída com consistência e comunicação. Um parceiro que confia no outro joga com mais liberdade e menos ansiedade. Essa confiança é desenvolvida ao longo do tempo com prática conjunta e comunicação clara.',
  },
  {
    id: 'q71', category: 'Dinâmica de Duplas',
    statement: 'Consigo coordenar com meu parceiro para criar estratégias ofensivas e defensivas específicas para cada dupla adversária.',
    context: 'Coordenação estratégica em duplas é uma habilidade avançada. Duplas que desenvolvem estratégias específicas para cada adversário (explorar o backhand fraco de um, atacar o jogador mais lento, etc.) têm vantagem sobre duplas que jogam sempre da mesma forma.',
  },
  {
    id: 'q72', category: 'Dinâmica de Duplas',
    statement: 'Minha dinâmica com meu parceiro melhora ao longo da partida: desenvolvemos sintonia progressiva e ajustamos nossa estratégia coletivamente.',
    context: 'Desenvolvimento de sintonia ao longo da partida é um sinal de maturidade em duplas. Duplas que se adaptam e melhoram durante a partida — comunicando ajustes, identificando padrões adversários juntos — têm vantagem sobre duplas que jogam sempre da mesma forma.',
  },
  {
    id: 'q116', category: 'Dinâmica de Duplas',
    statement: 'Consigo assumir o papel de líder tático quando necessário, tomando decisões estratégicas sem sobrecarregar ou intimidar meu parceiro.',
    context: 'Liderança tática em duplas é uma habilidade interpessoal importante. Em algumas situações, um dos parceiros precisa tomar a iniciativa de propor ajustes táticos. Fazer isso de forma positiva e colaborativa — não autoritária — é fundamental para manter a dinâmica positiva.',
  },

  // ─────────────────────────────────────────────────────────────
  // Categoria 7: Controle Emocional (12) — ABA 9
  // ─────────────────────────────────────────────────────────────
  {
    id: 'q73', category: 'Controle Emocional',
    statement: 'Ao final das minhas partidas, meu número de winners (pontos ganhos por mérito) é estatisticamente superior à minha quantidade de erros não forçados.',
    context: 'A relação winners/erros não forçados é um indicador objetivo do nível de jogo. Jogadores iniciantes e intermediários cometem mais erros não forçados do que ganham winners. Jogadores avançados invertem essa relação: ganham mais pontos por mérito do que perdem por erro.',
  },
  {
    id: 'q75', category: 'Controle Emocional',
    statement: 'Em momentos de alta pressão (finais de campeonato, placar 10x10), minha mecânica corporal e escolha de golpes permanecem idênticas às do treino.',
    context: 'Consistência sob pressão máxima é o indicador mais preciso de nível mental. Jogadores que "travam" em pontos críticos — mudando a mecânica, escolhendo golpes diferentes, jogando com mais força ou mais medo — demonstram fragilidade mental que limita seu nível real.',
  },
  {
    id: 'q76', category: 'Controle Emocional',
    statement: 'Não sofro de pressa para definir o ponto: sinto conforto em reiniciar uma jogada lenta se for atacado, esperando pacientemente pelo erro adversário ou pela bola certa.',
    context: 'Paciência em pontos críticos é uma das habilidades mentais mais difíceis de desenvolver. A pressão para "fazer algo" é constante, mas jogadores avançados sabem que esperar pela bola certa é mais eficaz do que atacar na hora errada.',
  },
  {
    id: 'q77', category: 'Controle Emocional',
    statement: 'Tenho o hábito de focar na consistência e na margem de segurança, em vez de tentar jogadas de baixo percentual ou golpes de força extrema.',
    context: 'Tomada de decisão conservadora é uma habilidade mental avançada. Jogadores que tentam golpes de baixo percentual (perto das linhas, com muita força) cometem mais erros. Jogadores avançados priorizam consistência e margem de segurança, atacando apenas quando a probabilidade de acerto é alta.',
  },
  {
    id: 'q78', category: 'Controle Emocional',
    statement: 'Quando cometo um erro, consigo "esquecer" rapidamente e focar no próximo ponto, sem deixar emoções negativas contaminar meu jogo.',
    context: 'Recuperação emocional rápida após erros é fundamental. Jogadores que "carregam" erros anteriores ficam distraídos e cometem mais erros subsequentes. A capacidade de "resetar" mentalmente após cada ponto é um dos principais diferenciadores de nível mental.',
  },
  {
    id: 'q79', category: 'Controle Emocional',
    statement: 'Mantenho meu nível de confiança mesmo quando estou perdendo: não fico desesperado, não mudo radicalmente o estilo de jogo e não fico agressivo demais.',
    context: 'Confiança resiliente é diferente de arrogância. Jogadores que ficam desesperados quando perdem — tentando golpes arriscados, aumentando a agressividade sem critério — cometem mais erros. Manter a estratégia e a confiança mesmo perdendo é um sinal de maturidade mental.',
  },
  {
    id: 'q81', category: 'Controle Emocional',
    statement: 'Consigo jogar bem mesmo quando estou fisicamente cansado ou sob estresse externo (pressão de campeonato, expectativas de outros, ambiente hostil).',
    context: 'Desempenho sob múltiplos estressores é um indicador de maturidade mental e física. Jogadores que só jogam bem em condições ideais têm limitações sérias. A capacidade de manter o nível sob condições adversas é o que diferencia jogadores competitivos.',
  },
  {
    id: 'q82', category: 'Controle Emocional',
    statement: 'Meu humor durante a partida é estável: não tenho altos e baixos emocionais visíveis que afetem meu desempenho ou o ambiente da partida.',
    context: 'Estabilidade emocional visível é importante tanto para o desempenho próprio quanto para a dinâmica da partida. Jogadores que demonstram frustração, euforia excessiva ou irritação criam um ambiente negativo e podem perder o foco mais facilmente.',
  },
  {
    id: 'q83', category: 'Controle Emocional',
    statement: 'Minha respiração e postura corporal refletem calma e controle mesmo sob pressão: não demonstro sinais físicos de ansiedade ou frustração.',
    context: 'Controle físico das emoções — respiração controlada, postura ereta, movimentos calmos — é tanto um sinal quanto uma ferramenta de controle emocional. Jogadores que controlam sua respiração e postura sob pressão mantêm melhor controle cognitivo e técnico.',
  },
  {
    id: 'q84', category: 'Controle Emocional',
    statement: 'Consigo lidar com adversidades externas (árbitro ruim, condições de quadra, barulho, vento) sem deixar que afetem meu foco e desempenho.',
    context: 'Resiliência a adversidades externas é uma habilidade mental avançada. Jogadores que reclamam de condições externas ou ficam distraídos por fatores fora do controle perdem foco e desempenho. Aceitar e adaptar-se às condições é mais produtivo.',
  },
  {
    id: 'q85', category: 'Controle Emocional',
    statement: 'Meu mindset é positivo e proativo: acredito que posso vencer mesmo em situações difíceis e busco soluções em vez de desculpas.',
    context: 'Mentalidade positiva e proativa é um diferenciador de nível. Jogadores com mindset negativo ("não consigo", "o árbitro está contra mim", "meu parceiro é fraco") limitam seu próprio desempenho. Jogadores com mindset positivo buscam soluções e mantêm a confiança mesmo em situações adversas.',
  },
  {
    id: 'q117', category: 'Controle Emocional',
    statement: 'Consigo manter a clareza mental e a capacidade de tomar boas decisões táticas mesmo em situações caóticas, ralis longos ou de alta pressão.',
    context: 'Clareza mental sob pressão é a combinação de controle emocional e capacidade cognitiva. Em situações de alta pressão, jogadores menos experientes "congelam" ou tomam decisões impulsivas. Manter a clareza para tomar boas decisões táticas sob pressão é uma habilidade de nível avançado.',
  },

  // ─────────────────────────────────────────────────────────────
  // Categoria 8: Fisiologia (11) — ABA 10
  // ─────────────────────────────────────────────────────────────
  {
    id: 'q86', category: 'Fisiologia',
    statement: 'Minha agilidade lateral me permite fazer deslocamentos rápidos e passadas curtas na linha da rede sem perder o equilíbrio.',
    context: 'Agilidade lateral é fundamental no pickleball, especialmente na rede. Deslocamentos rápidos para os lados — sem cruzar os pés — permitem cobrir mais área sem perder o equilíbrio. Jogadores com baixa agilidade lateral ficam fora de posição frequentemente.',
  },
  {
    id: 'q87', category: 'Fisiologia',
    statement: 'Consigo manter os joelhos flexionados e o centro de gravidade baixo constantemente enquanto aguardo voleios na rede.',
    context: 'Manter a postura defensiva correta — joelhos flexionados, centro de gravidade baixo — por toda a partida requer condicionamento físico específico. Jogadores que ficam em pé com joelhos esticados têm tempo de reação menor e cometem mais erros na rede.',
  },
  {
    id: 'q88', category: 'Fisiologia',
    statement: 'Meu condicionamento cardiovascular suporta partidas intensivas e ralis longos sem que o cansaço deteriore a qualidade técnica dos meus golpes.',
    context: 'Resistência cardiovascular é fundamental para manter a qualidade técnica ao longo da partida. Jogadores com baixo condicionamento cometem mais erros técnicos no final de sets e partidas — não por falta de habilidade, mas por fadiga física.',
  },
  {
    id: 'q89', category: 'Fisiologia',
    statement: 'Tenho explosão muscular suficiente para me deslocar rapidamente de um lado para o outro da quadra, mesmo em ralis longos e intensos.',
    context: 'Explosão lateral — a capacidade de acelerar rapidamente em uma direção — é essencial para cobrir a quadra. Jogadores com baixa explosão chegam atrasados a bolas que deveriam alcançar, comprometendo a qualidade do golpe.',
  },
  {
    id: 'q90', category: 'Fisiologia',
    statement: 'Consigo recuperar-me rapidamente de movimentos bruscos e não perco o equilíbrio facilmente após mudanças de direção.',
    context: 'Estabilidade e recuperação rápida após movimentos bruscos são indicadores de condicionamento físico e coordenação motora. Jogadores que ficam desequilibrados após mudanças de direção ficam fora de posição para o próximo golpe.',
  },
  {
    id: 'q91', category: 'Fisiologia',
    statement: 'Minha flexibilidade me permite alcançar bolas distantes sem comprometer minha mecânica de golpe ou arriscar lesões.',
    context: 'Flexibilidade funcional permite ao jogador alcançar bolas em posições difíceis sem comprometer a técnica ou arriscar lesões. Jogadores com baixa flexibilidade têm um alcance menor e são mais propensos a lesões musculares.',
  },
  {
    id: 'q92', category: 'Fisiologia',
    statement: 'Consigo manter minha velocidade e agilidade durante toda a partida, mesmo nos sets finais ou em torneios com múltiplas partidas no mesmo dia.',
    context: 'Manutenção da agilidade sob fadiga é um indicador de condicionamento físico avançado. Jogadores que ficam mais lentos no final da partida ou em torneios com múltiplas partidas demonstram baixo condicionamento aeróbico e de resistência muscular.',
  },
  {
    id: 'q93', category: 'Fisiologia',
    statement: 'Minha força muscular permite executar golpes poderosos sem comprometer a precisão ou a técnica.',
    context: 'Força com controle é diferente de força bruta. Jogadores que batem forte mas sem controle cometem mais erros. A força deve ser aplicada de forma controlada, com a técnica correta, para gerar potência sem sacrificar a precisão.',
  },
  {
    id: 'q94', category: 'Fisiologia',
    statement: 'Consigo fazer movimentos rápidos e precisos na rede, mesmo em situações de reação rápida a bolas aceleradas.',
    context: 'Precisão em movimentos rápidos é uma combinação de velocidade de reação e controle motor fino. Na rede, bolas chegam em frações de segundo, exigindo movimentos precisos sem tempo para pensar. Essa habilidade é desenvolvida com prática específica de reflexos.',
  },
  {
    id: 'q95', category: 'Fisiologia',
    statement: 'Meu tempo de reação é rápido: consigo reagir a bolas surpresa na rede e a acelerações inesperadas do adversário.',
    context: 'Tempo de reação é parcialmente inato mas pode ser melhorado com treinamento específico. Na rede, onde as bolas chegam mais rápido, um tempo de reação rápido é essencial. Jogadores com tempo de reação lento ficam na defensiva na rede.',
  },
  {
    id: 'q118', category: 'Fisiologia',
    statement: 'Minha recuperação entre pontos é eficiente: respiro adequadamente, reposiciono-me rapidamente e mantenho o foco para o próximo ponto.',
    context: 'Recuperação eficiente entre pontos é uma habilidade física e mental. Jogadores que não respiram adequadamente entre pontos acumulam fadiga mais rapidamente. Reposicionamento rápido e manutenção do foco entre pontos são hábitos que diferenciam jogadores experientes.',
  },
];

export const LIKERT_OPTIONS = [
  { value: 1, label: 'Discordo Totalmente', sublabel: 'Nunca (0-20%)' },
  { value: 2, label: 'Discordo Parcialmente', sublabel: 'Raramente (20-40%)' },
  { value: 3, label: 'Neutro', sublabel: 'Às vezes (40-60%)' },
  { value: 4, label: 'Concordo Parcialmente', sublabel: 'Frequentemente (60-80%)' },
  { value: 5, label: 'Concordo Totalmente', sublabel: 'Sempre (80-100%)' },
];

export const CATEGORY_ORDER = [
  'Conhecimento de Regras',
  'Experiência',
  'Saque e Recepção',
  'Golpes de Fundo',
  'Jogo Curto e Dinks',
  'Voleios e Rede',
  'Leitura de Jogo',
  'Dinâmica de Duplas',
  'Controle Emocional',
  'Fisiologia',
];

export const CATEGORY_KEYS = {
  'Saque e Recepção': 'serve',
  'Golpes de Fundo': 'groundstrokes',
  'Jogo Curto e Dinks': 'kitchen',
  'Voleios e Rede': 'net',
  'Leitura de Jogo': 'tactics',
  'Dinâmica de Duplas': 'doubles',
  'Controle Emocional': 'mental',
  Fisiologia: 'physical',
  'Conhecimento de Regras': 'rules',
  Experiência: 'experience',
};

export const CATEGORY_LABELS = {
  serve: 'Saque',
  groundstrokes: 'Fundo',
  kitchen: 'Dinks',
  net: 'Rede',
  tactics: 'Táticas',
  doubles: 'Duplas',
  mental: 'Mental',
  physical: 'Física',
  rules: 'Regras',
  experience: 'Experiência',
};

export const NEUTRAL_BASELINE_VALUE = 3;

const CATEGORY_WEIGHTS = {
  serve: 0.11,
  groundstrokes: 0.12,
  kitchen: 0.16,
  net: 0.12,
  tactics: 0.11,
  doubles: 0.10,
  mental: 0.12,
  physical: 0.10,
  rules: 0.03,
  experience: 0.03,
};

export const SKILL_LEVELS = {
  novato: { name: 'Novato', usap: '1.0–1.5', color: 'text-slate-700', bg: 'bg-slate-400', border: 'border-slate-400' },
  iniciante: { name: 'Iniciante', usap: '1.6–2.0', color: 'text-sky-700', bg: 'bg-sky-500', border: 'border-sky-500' },
  iniciante_avancado: { name: 'Iniciante Avançado', usap: '2.1–2.5', color: 'text-cyan-700', bg: 'bg-cyan-500', border: 'border-cyan-500' },
  intermediario_basico: { name: 'Intermediário Básico', usap: '2.6–3.0', color: 'text-teal-700', bg: 'bg-teal-500', border: 'border-teal-500' },
  intermediario: { name: 'Intermediário', usap: '3.1–3.5', color: 'text-green-700', bg: 'bg-green-500', border: 'border-green-500' },
  intermediario_avancado: { name: 'Intermediário Avançado', usap: '3.6–4.0', color: 'text-lime-700', bg: 'bg-lime-500', border: 'border-lime-500' },
  avancado: { name: 'Avançado', usap: '4.1–4.5', color: 'text-yellow-700', bg: 'bg-yellow-500', border: 'border-yellow-500' },
  profissional: { name: 'Profissional', usap: '4.6–5.0', color: 'text-orange-700', bg: 'bg-orange-500', border: 'border-orange-500' },
  elite: { name: 'Elite / Open', usap: '5.1+', color: 'text-red-700', bg: 'bg-red-600', border: 'border-red-600' },
};

export const INITIAL_LEVELING_ANSWERS = LIKERT_STATEMENTS.reduce((acc, question) => {
  acc[question.id] = NEUTRAL_BASELINE_VALUE;
  return acc;
}, {});

export const QUESTIONNAIRE_SECTIONS = CATEGORY_ORDER.map((category) => ({
  category,
  key: CATEGORY_KEYS[category],
  questions: LIKERT_STATEMENTS.filter((question) => question.category === category),
}));

function average(ids, answers) {
  // Missing answers use the same neutral baseline as the form's default response state.
  const values = ids.map((id) => Number(answers?.[id] ?? NEUTRAL_BASELINE_VALUE)).filter((v) => Number.isFinite(v) && v >= 1 && v <= 5);
  if (!values.length) return NEUTRAL_BASELINE_VALUE;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

export function getCategoryBreakdown(answers) {
  return QUESTIONNAIRE_SECTIONS.reduce((acc, section) => {
    acc[section.key] = average(section.questions.map((question) => question.id), answers);
    return acc;
  }, {});
}

export function calculateWeightedScore(answers) {
  const breakdown = getCategoryBreakdown(answers);
  const weighted = Object.entries(CATEGORY_WEIGHTS).reduce(
    (sum, [key, weight]) => sum + (breakdown[key] ?? NEUTRAL_BASELINE_VALUE) * weight,
    0,
  );
  // Convert weighted average from the 1–5 Likert scale to a normalized 0–100 score.
  return Math.round(((weighted - 1) / 4) * 100);
}

export function determineLevel(normalizedScore) {
  if (normalizedScore < 12) return 'novato';
  if (normalizedScore < 23) return 'iniciante';
  if (normalizedScore < 34) return 'iniciante_avancado';
  if (normalizedScore < 45) return 'intermediario_basico';
  if (normalizedScore < 55) return 'intermediario';
  if (normalizedScore < 65) return 'intermediario_avancado';
  if (normalizedScore < 76) return 'avancado';
  if (normalizedScore < 90) return 'profissional';
  return 'elite';
}

export function getUSAPEquivalent(normalizedScore) {
  const breakpoints = [
    { score: 0, usap: 1.0 },
    { score: 12, usap: 1.6 },
    { score: 23, usap: 2.1 },
    { score: 34, usap: 2.6 },
    { score: 45, usap: 3.1 },
    { score: 55, usap: 3.6 },
    { score: 65, usap: 4.1 },
    { score: 76, usap: 4.6 },
    { score: 90, usap: 5.1 },
    { score: 100, usap: 5.5 },
  ];
  for (let i = 0; i < breakpoints.length - 1; i += 1) {
    const current = breakpoints[i];
    const next = breakpoints[i + 1];
    if (normalizedScore >= current.score && normalizedScore <= next.score) {
      const ratio = (normalizedScore - current.score) / (next.score - current.score);
      return Math.round((current.usap + ratio * (next.usap - current.usap)) * 10) / 10;
    }
  }
  return 5.5;
}

function getLevelName(level) {
  const display = SKILL_LEVELS[level] || SKILL_LEVELS.novato;
  return `${display.name} (${display.usap})`;
}

export function generateExplanation(level) {
  const explanations = {
    novato: 'Você está dando os primeiros passos no pickleball. O foco agora é aprender as regras básicas, segurar a raquete corretamente e simplesmente colocar a bola no campo. Erros não forçados são frequentes e o posicionamento na quadra ainda está sendo desenvolvido.',
    iniciante: 'Você já conhece as regras básicas e consegue iniciar ralis curtos. O forehand está se desenvolvendo, mas o backhand e o posicionamento ainda são inconsistentes. Os pontos se perdem principalmente por erros não forçados.',
    iniciante_avancado: 'Você já acerta bons golpes de forehand, saca com consistência e começa a entender a importância da rede. No entanto, a impaciência ainda predomina: você tende a bater forte quando deveria amortecer.',
    intermediario_basico: 'Você entende a importância da rede e já tenta usar o drop shot. Consegue sustentar ralis de dinks por alguns golpes, mas a consistência falha sob pressão. A sincronização com o parceiro ainda precisa de desenvolvimento.',
    intermediario: 'Você compreende a essência do jogo e usa o drop shot com regularidade. Movimenta-se bem com seu parceiro e consegue trocar dinks com controle direcional. Porém, quando a pressão aumenta, a consistência ainda falha.',
    intermediario_avancado: 'Você domina os fundamentos e já usa spins e slices com intenção tática. Lê bem as situações de jogo e escolhe entre amortecer ou acelerar conforme a posição dos adversários.',
    avancado: 'Você tem sólido domínio técnico e tático. Domina ambas as faces da raquete, tem reflexos rápidos para bloquear voleios difíceis e usa estratégias de dupla com eficiência.',
    profissional: 'Você é um jogador de alto nível com domínio técnico e tático consistente. Suas decisões são rápidas e precisas, você antecipa os movimentos dos adversários e manipula ralis ao seu favor.',
    elite: 'Maestria técnica aliada à orquestração tática consistente. Suas decisões são automatizadas, você antecipa os movimentos dos adversários e manipula ralis lentos ou frenéticos ao seu favor com tranquilidade.',
  };
  return explanations[level] || explanations.novato;
}

export function generateRecommendations(answers) {
  const recommendations = [];
  const breakdown = getCategoryBreakdown(answers);
  if (breakdown.serve < 3) recommendations.push('Trabalhe intensivamente em saques — profundidade e variação de velocidade são críticas.');
  if (breakdown.groundstrokes < 3) recommendations.push('Dedique tempo ao treinamento de golpes do fundo, especialmente backhand e slice defensivo.');
  if (breakdown.kitchen < 3) recommendations.push('O jogo curto (dinks e drop shots) é o coração do pickleball — pratique paciência e controle diariamente.');
  if (breakdown.net < 3) recommendations.push('Melhore seus reflexos e posicionamento na rede com treinos específicos de voleios e bloqueios.');
  if (breakdown.tactics < 3) recommendations.push('Estude padrões de jogo, aprenda a ler seus oponentes e desenvolva estratégias de duplas.');
  if (breakdown.doubles < 3) recommendations.push('Trabalhe sincronização com seu parceiro — comunicação e cobertura de quadra são essenciais.');
  if (breakdown.mental < 3) recommendations.push('Desenvolva resiliência mental: pratique controle emocional e rotinas entre pontos.');
  if (breakdown.physical < 3) recommendations.push('Melhore sua condição física com agilidade lateral, explosão e resistência cardiovascular.');

  const level = determineLevel(calculateWeightedScore(answers));
  if (['novato', 'iniciante'].includes(level)) {
    recommendations.push('Participe de aulas introdutórias com um instrutor qualificado para aprender os fundamentos corretamente.');
    recommendations.push('Jogue regularmente para desenvolver coordenação motora e familiaridade com a bola.');
  } else if (['iniciante_avancado', 'intermediario_basico'].includes(level)) {
    recommendations.push('Participe de aulas em grupo para corrigir vícios técnicos e aprender o 3rd shot drop.');
    recommendations.push('Jogue regularmente para ganhar experiência prática e desenvolver automatismos.');
  } else if (['intermediario', 'intermediario_avancado'].includes(level)) {
    recommendations.push('Considere treinar com um coach profissional para refinar a técnica e eliminar vícios biomecânicos.');
    recommendations.push('Participe de torneios locais e regionais para testar suas habilidades em situações competitivas reais.');
  } else {
    recommendations.push('Busque parceiros de nível similar ou superior para elevar a qualidade dos seus treinos.');
    recommendations.push('Participe de torneios competitivos e desenvolva estratégias avançadas de duplas.');
  }

  if (recommendations.length < 4) {
    recommendations.push('Continue praticando regularmente para manter e melhorar seu nível.');
    recommendations.push('Assista a vídeos de jogadores profissionais para aprender novas técnicas e padrões táticos.');
  }
  return recommendations.slice(0, 8);
}

export function calculateAssessment(answers) {
  const normalizedScore = calculateWeightedScore(answers);
  const level = determineLevel(normalizedScore);
  const usapEquivalent = getUSAPEquivalent(normalizedScore);
  const score = LIKERT_STATEMENTS.reduce((sum, question) => sum + Number(answers?.[question.id] ?? NEUTRAL_BASELINE_VALUE), 0);
  return {
    level,
    levelName: getLevelName(level),
    usapEquivalent,
    score,
    normalizedScore,
    explanation: generateExplanation(level),
    recommendations: generateRecommendations(answers),
    categoryBreakdown: getCategoryBreakdown(answers),
  };
}

export function countNonNeutralAnswers(answers) {
  return LIKERT_STATEMENTS.filter((question) => Number(answers?.[question.id]) !== NEUTRAL_BASELINE_VALUE).length;
}
