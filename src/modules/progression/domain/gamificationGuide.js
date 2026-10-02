/**
 * gamificationGuide — os TEXTOS que explicam a gamificação, num lugar só.
 *
 * Todo número que um texto cita sai da constante que o código de verdade usa
 * (pesos de XP, tiers, missões, prazos, limites) ou da configuração que o admin
 * ajustou. É de propósito: texto de ajuda com número escrito à mão envelhece
 * no dia em que alguém muda a regra, e quem lê passa a confiar menos em tudo.
 * Há teste comparando cada número citado com a sua fonte.
 *
 * ## Quem usa
 *
 *  - `TermHint` — o "?" ao lado de cada conceito nas telas (texto curto);
 *  - a página `/gamification/como-funciona` — o glossário inteiro, por público;
 *  - o cartão da sequência, o "Como funciona" de cada aba e a Central de ajuda.
 *
 * ## Como escrever um termo
 *
 *  - `short`: UMA frase, que cabe num balãozinho no celular. Responde "o que é".
 *  - `body`: parágrafos curtos. O primeiro diz o que a pessoa ganha; os outros,
 *    como funciona de verdade — inclusive o que NÃO acontece.
 *  - Nada de promessa que o sistema não cumpre. Se algo só vale com a flag, o
 *    módulo ligado ou um mínimo de dados, o texto diz.
 *  - pt-BR, sem anglicismo solto ("streak" → "sequência", "health score" →
 *    "saúde").
 *
 * Lógica pura, sem React nem I/O.
 */
import { ACHIEVEMENT_RARITY_META } from '@/modules/achievements/domain/achievementsV2.js';
import {
  DEFAULT_GAMIFICATION_CONFIG, GAMIFICATION_MODULES, normalizeGamificationConfig,
} from './gamificationConfig.js';
import { TIERS } from './tiers.js';
import { XP_WEIGHTS_V2 } from './progressionV2.js';
import { MISSION_BONUS_XP, MISSIONS_PER_SCOPE } from './missions.js';
import { ONBOARDING_MAX_XP, ONBOARDING_STEPS } from './onboarding.js';
import { SKILL_TREE_KEYS, SKILL_TREE_META } from './skillTrees.js';
import { STREAK_VACATION_COOLDOWN_DAYS, STREAK_VACATION_MAX_DAYS } from './weekStreak.js';
import { STREAK_MILESTONES } from './streakProtection.js';
import { REVIEW_MAX_TAGS, REVIEW_TAGS } from './matchReviews.js';
import { LETTER_MAX } from './partnerLetters.js';
import { CREW_MAX_CREWS_PER_USER, CREW_MAX_MEMBERS, MENTOR_MAX_APPRENTICES, RIVALS_MAX } from './socialBonds.js';
import { CHALLENGE_DURATION_DAYS, CHALLENGE_MAX_PRIZES, CHALLENGE_PRIZE_XP_MAX } from './challenges.js';
import { REWARD_KIND_META } from './rewards.js';
import { computeArenaHealth, computeCoachHealth } from './supplyHealth.js';
import { TRACKED_ACHIEVEMENT_COUNT } from './gamificationSnapshot.js';

/** Para quem o termo é. */
export const GUIDE_AUDIENCE = Object.freeze({
  ATHLETE: 'atleta',
  COACH: 'professor',
  ARENA: 'arena',
  CLUB: 'clube',
  ADMIN: 'admin',
});

export const GUIDE_AUDIENCE_META = Object.freeze({
  atleta: { label: 'Atleta', summary: 'Quem joga: XP, missões, temporada, avaliações e recompensas.' },
  professor: { label: 'Professor', summary: 'Quem dá aula: saúde da base, metas, desafios e recompensas para os alunos.' },
  arena: { label: 'Arena', summary: 'Quem gere uma arena: saúde, metas, desafios e recompensas para quem joga lá.' },
  clube: { label: 'Clube', summary: 'Quem administra um clube: a atividade do mês, metas e desafios para os membros.' },
  admin: { label: 'Administração', summary: 'Quem cuida da plataforma: módulos, prêmios, integridade e métricas.' },
});

/** Agrupamento dos termos (a ordem da página). */
export const TERM_GROUP = Object.freeze({
  JOURNEY: 'jornada',
  COMPETE: 'competir',
  SOCIAL: 'social',
  TRUST: 'confianca',
  OFFER: 'oferecer',
  ADMIN: 'administrar',
});

export const TERM_GROUP_META = Object.freeze({
  jornada: { label: 'Sua jornada', summary: 'O que acumula e como você evolui.' },
  competir: { label: 'Competir e ser reconhecido', summary: 'Temporada, desafios, duelos e recompensas.' },
  social: { label: 'Jogar junto', summary: 'Avaliações, cartas e vínculos entre atletas.' },
  confianca: { label: 'Privacidade e justiça', summary: 'O que os outros veem e como o jogo se mantém limpo.' },
  oferecer: { label: 'Para quem oferece', summary: 'Professor, arena e clube.' },
  administrar: { label: 'Para a administração', summary: 'Configurar, revisar e medir.' },
});

const num = (n) => Number(n).toLocaleString('pt-BR');

/** Os tiers como lista legível: "Calouro (0 XP), Aprendiz (2.000 XP)…". */
function tiersEmTexto() {
  return TIERS.map((t) => `${t.icon} ${t.name} (${num(t.threshold)} XP)`).join(' · ');
}

/**
 * As regras da sequência, uma por linha — a mesma lista no cartão da sequência
 * e no glossário. Os números saem das constantes de `weekStreak.js`.
 *
 * @returns {string[]}
 */
export function streakRuleBullets() {
  const semanasFerias = Math.round(STREAK_VACATION_MAX_DAYS / 7);
  return [
    'Conta as semanas seguidas em que você jogou pelo menos uma vez — torneio, dia de jogo ou partida com resultado registrado. A semana vai de segunda a domingo, no horário de Brasília.',
    'A semana atual ainda está aberta: se você ainda não jogou nela, nada se perde até domingo à meia-noite. Ela só entra como “em risco”.',
    'Folga automática: uma semana sem jogar por mês não quebra a sequência. Duas semanas seguidas, ou duas no mesmo mês, quebram. Você não precisa fazer nada — é uma regra, não um saldo para gastar.',
    `Férias: se vai ficar um tempo sem jogar, avise. Até ${semanasFerias} semanas por vez não contam e não quebram, e só dá para começar outras ${STREAK_VACATION_COOLDOWN_DAYS} dias depois.`,
    'Semana de folga ou de férias não soma: “8 semanas” são oito semanas em que você realmente jogou.',
    'O seu recorde fica guardado. As conquistas de sequência usam o recorde; a tela e as recompensas usam a sequência de agora.',
  ];
}

/**
 * Monta o guia inteiro. `config` é a configuração do admin (ou `null`: padrões)
 * — por isso os textos acompanham o que o admin ajustou.
 *
 * @param {object|null} [config]
 */
export function buildGamificationGuide(config = null) {
  const cfg = normalizeGamificationConfig(config || DEFAULT_GAMIFICATION_CONFIG);
  const W = XP_WEIGHTS_V2;
  const trilhas = SKILL_TREE_KEYS.map((k) => SKILL_TREE_META[k].name).join(', ');
  const raridades = Object.values(ACHIEVEMENT_RARITY_META).sort((a, b) => a.order - b.order).map((r) => r.name.toLowerCase()).join(', ');
  const marcosSequencia = STREAK_MILESTONES.map((m) => m.weeks).join(', ');
  const tagsAvaliacao = Object.values(REVIEW_TAGS).map((t) => t.label.toLowerCase()).join(', ');
  const tiposRecompensa = Object.values(REWARD_KIND_META).map((k) => k.label.toLowerCase()).join(', ');
  const dimsArena = computeArenaHealth({}).dimensions.map((d) => `${d.label} (${d.weight}%)`).join(', ');
  const dimsProf = computeCoachHealth({}).dimensions.map((d) => `${d.label} (${d.weight}%)`).join(', ');
  const A = GUIDE_AUDIENCE;
  const G = TERM_GROUP;

  /** @type {Array<{ id: string, group: string, audiences: string[], title: string, short: string, body: string[], steps?: string[], tip?: string, where?: { label: string, to: string }, module?: string }>} */
  const terms = [
    /* ------------------------------------------------------- sua jornada -- */
    {
      id: 'xp', group: G.JOURNEY, audiences: [A.ATHLETE],
      title: 'XP',
      short: 'Pontos que a plataforma soma pelo que você faz de verdade: jogar, vencer, disputar torneios, cumprir missões e conquistar.',
      body: [
        'XP não é um contador que você clica: é recalculado do zero a partir da sua atividade real. Por isso não dá para “ganhar de mentirinha” — e, se um resultado for corrigido, o seu XP acompanha.',
        `Cada jogo disputado vale ${num(W.game_played)} XP e cada vitória acrescenta ${num(W.game_won)} XP. Disputar um torneio vale ${num(W.tournament_attended)} XP; o pódio acrescenta ${num(W.tournament_podium)} XP e o título, ${num(W.tournament_title)} XP.`,
        'Além da quadra, entram o bônus das conquistas, as missões cumpridas, os primeiros passos e os prêmios que o PickleRush concede (temporada, duelo e desafios).',
        'Em “De onde vem o meu XP”, no hub, você vê a conta parcela por parcela.',
      ],
      tip: 'O XP mede a sua trajetória. Ele não é moeda: não se gasta nem se compra nada com ele.',
      where: { label: 'Ver o meu XP', to: '/gamification' },
    },
    {
      id: 'nivel', group: G.JOURNEY, audiences: [A.ATHLETE],
      title: 'Nível',
      short: 'Cada nível pede um pouco mais de XP que o anterior: o nível L exige 500 × L XP.',
      body: [
        'Do nível 1 para o 2 são 500 XP; do 2 para o 3, 1.000; do 3 para o 4, 1.500 — e assim por diante. A barra do hub mostra quanto falta para o próximo.',
        'O nível acompanha o total de XP. Como o XP é recalculado da sua atividade, ele só muda quando a atividade muda (um resultado corrigido, por exemplo).',
        'Não confunda com o seu nível de jogo (2.0–8.0): aquele mede a sua habilidade e vem do nivelamento e dos resultados. O nível da gamificação mede a sua participação.',
      ],
      where: { label: 'Ver o meu nível', to: '/gamification' },
    },
    {
      id: 'tier', group: G.JOURNEY, audiences: [A.ATHLETE],
      title: 'Tier',
      short: 'A faixa da sua jornada, do Calouro ao Imortal. Muda de nome conforme o seu XP total.',
      body: [
        `Os tiers, do primeiro ao último: ${tiersEmTexto()}.`,
        'O tier é identidade, não prêmio: conta a sua trajetória para quem abre o seu perfil e serve de mínimo para algumas recompensas e desafios.',
        `Ele só aparece para os outros se você deixar (veja “Privacidade”). No placar público, quem está abaixo de ${cfg.season.publicMinTier} não aparece, mesmo com a opção ligada.`,
      ],
      where: { label: 'Ver o meu tier', to: '/gamification' },
    },
    {
      id: 'trilhas', group: G.JOURNEY, audiences: [A.ATHLETE],
      title: 'Trilhas',
      short: `Cinco áreas do seu jogo — ${trilhas} — cada uma com nível próprio. Mostram onde você mais se dedica.`,
      body: [
        'Quem joga muito torneio sobe a trilha de Torneiro; quem reserva quadra, a de Arena; quem tem aula, a de Aulas; quem participa de clube, a de Clube; quem interage com a comunidade, a Social.',
        'As trilhas retratam a sua atividade por área. Elas não somam no XP total — servem para você ver, de relance, que tipo de jogador você é.',
        'Uma área que ainda está no nível 1 não é uma falha: é só um convite para experimentar.',
      ],
      where: { label: 'Ver as minhas trilhas', to: '/gamification' },
    },
    {
      id: 'sequencia', group: G.JOURNEY, audiences: [A.ATHLETE],
      title: 'Sequência',
      short: 'Quantas semanas seguidas você jogou. A semana atual ainda está aberta e uma folga por mês é automática.',
      body: streakRuleBullets(),
      tip: `Marcos da sequência: ${marcosSequencia} semanas. As conquistas de sequência usam o seu recorde.`,
      where: { label: 'Ver a minha sequência', to: '/gamification' },
    },
    {
      id: 'ferias', group: G.JOURNEY, audiences: [A.ATHLETE],
      title: 'Férias da sequência',
      short: `Uma pausa avisada: até ${Math.round(STREAK_VACATION_MAX_DAYS / 7)} semanas que não contam nem quebram a sequência.`,
      body: [
        `Use quando for viajar, se machucar ou simplesmente descansar. Enquanto as férias estiverem em andamento, a sequência fica guardada. Elas protegem no máximo ${Math.round(STREAK_VACATION_MAX_DAYS / 7)} semanas por vez; passado isso, é só voltar a jogar.`,
        `Para a pausa não virar um jeito de segurar o número para sempre, só dá para começar outras férias ${STREAK_VACATION_COOLDOWN_DAYS} dias depois do começo das últimas.`,
        'Dá para encerrar quando quiser, jogando ou não. As semanas de férias não somam na sequência — elas só deixam de quebrá-la.',
      ],
      where: { label: 'Gerir as férias', to: '/gamification' },
    },
    {
      id: 'conquistas', group: G.JOURNEY, audiences: [A.ATHLETE],
      title: 'Conquistas',
      short: `Marcos reais da sua trajetória — hoje ${TRACKED_ACHIEVEMENT_COUNT} medidas pela plataforma, em cinco raridades.`,
      body: [
        `Cada conquista é desbloqueada quando um fato verdadeiro acontece — não por clique. Elas vêm em cinco raridades (${raridades}) e muitas dão um bônus de XP, uma vez só.`,
        'As que a plataforma ainda não consegue medir aparecem em “Em breve”, fora da conta: nada fica bloqueado por um motivo que você não controla.',
        'Se uma fonte de dados não carregou, a conquista fica como está e diz que não deu para verificar — nunca “zero”.',
      ],
      where: { label: 'Ver as minhas conquistas', to: '/conquistas' },
    },
    {
      id: 'missoes', group: G.JOURNEY, audiences: [A.ATHLETE], module: 'missions_weekly',
      title: 'Missões',
      short: `${MISSIONS_PER_SCOPE.daily} missões por dia, ${MISSIONS_PER_SCOPE.weekly} por semana e ${MISSIONS_PER_SCOPE.monthly} por mês — cumpridas pelo que você joga, sem botão de marcar.`,
      body: [
        'O progresso é medido pela sua atividade real: jogos, torneios, avaliações, reservas. Não existe botão de “marcar como feita”.',
        `Cumpriu todas as missões do período? Resgate o bônus: +${num(MISSION_BONUS_XP.daily)} XP no dia, +${num(MISSION_BONUS_XP.weekly)} na semana, +${num(MISSION_BONUS_XP.monthly)} no mês.`,
        'O dia vira à meia-noite (horário de Brasília), a semana na segunda-feira e o mês no dia 1º. Missão não cumprida simplesmente expira — sem punição.',
        'O sorteio mistura os tipos — sempre há missões de jogo e sociais — e não sorteia missão de um recurso que esteja desligado.',
      ],
      where: { label: 'Ver as missões', to: '/gamification?aba=missoes' },
    },
    {
      id: 'primeiros-passos', group: G.JOURNEY, audiences: [A.ATHLETE], module: 'onboarding',
      title: 'Primeiros passos',
      short: `${ONBOARDING_STEPS.length} passos para quem chegou agora, espalhados pelos primeiros dias, com até ${num(ONBOARDING_MAX_XP)} XP.`,
      body: [
        'É um roteiro curto, não uma lista de obrigações: nível, foto, cadastro, ranking, atletas, clube, torneio e convite. Cada passo concluído rende XP uma vez.',
        'A plataforma detecta sozinha o que você já fez (a foto de perfil, por exemplo) — você não precisa marcar nada.',
        'O roteiro some quando você conclui tudo ou o dispensa, e quem já tem muita história na plataforma nem chega a vê-lo. Dá para trazê-lo de volta em Preferências.',
      ],
      where: { label: 'Ver o roteiro', to: '/gamification' },
    },
    {
      id: 'revisao', group: G.JOURNEY, audiences: [A.ATHLETE], module: 'weekly_review',
      title: 'Revisão da semana e do mês',
      short: 'Um resumo do que você fez, comparado com o período anterior — sem cobrança.',
      body: [
        'Mostra jogos, vitórias, parceiros, a conquista que está mais perto de sair e como foi em relação ao período anterior.',
        'Semana tranquila ganha um texto gentil, nunca uma cobrança. Se alguma fonte de dados não carregou, a revisão avisa o que ficou de fora.',
        'Na segunda-feira você pode receber um aviso no sino com o resumo (dá para desligar em Preferências).',
      ],
      where: { label: 'Ver a minha revisão', to: '/gamification/revisao' },
    },
    {
      id: 'marcos', group: G.JOURNEY, audiences: [A.ATHLETE], module: 'celebrations',
      title: 'Marcos e comemorações',
      short: 'Um aviso curto quando você cruza uma linha que merece comemoração: subir de tier, bater jogos ou vitórias, emendar semanas.',
      body: [
        'Quem chega já com história não recebe uma chuva de confete: dentro de cada família (tier, jogos, vitórias, semanas) só o marco mais alto é comemorado.',
        'Dá para desligar as comemorações em Preferências — os marcos continuam registrados, para não explodirem de uma vez se você religar.',
      ],
      where: { label: 'Abrir as preferências', to: '/gamification/configuracoes' },
    },

    /* ------------------------------------------- competir e ser reconhecido -- */
    {
      id: 'temporada', group: G.COMPETE, audiences: [A.ATHLETE], module: 'hall_of_fame',
      title: 'Temporada',
      short: 'Cada mês é uma temporada, disputada com o XP ganho NO mês — quem chegou agora também disputa.',
      body: [
        'Todo mundo começa a temporada zerado: vale o XP que você ganhou dentro do mês, não o total da vida. É isso que deixa o placar justo para quem é novo.',
        `Quando o mês fecha (último dia, horário de Brasília), o servidor concede os prêmios em XP: ${num(cfg.season.prizeTop1)} para o 1º lugar e para quem está no 1% do topo, ${num(cfg.season.prizeTop10Percent)} para o top 10% e ${num(cfg.season.prizeParticipation)} para quem participou.`,
        'O banner mostra quantos dias faltam, a sua posição e o prêmio previsto. O prêmio é concedido pelo servidor; o seu aparelho não consegue escrevê-lo.',
        'Você sempre vê a sua própria posição. Aparecer para os outros, com nome e foto, depende da sua privacidade.',
      ],
      where: { label: 'Ver a temporada', to: '/hall-da-fama' },
    },
    {
      id: 'hall', group: G.COMPETE, audiences: [A.ATHLETE], module: 'hall_of_fame',
      title: 'Hall da Fama',
      short: 'O placar público: a temporada do mês e os maiores XP de todos os tempos, com filtro por estado.',
      body: [
        'Só aparece quem aceitou: nome e foto entram no Hall se a sua opção “Aparecer no placar público” estiver ligada. Desligada, você continua ranqueando e recebendo os prêmios, mas ninguém vê.',
        `Há um tier mínimo para aparecer (hoje ${cfg.season.publicMinTier}), e contas em revisão de integridade ficam fora do público até a equipe olhar.`,
        'A regra vale no servidor: o placar já nasce sem quem não deve aparecer — não é só a tela que esconde.',
      ],
      where: { label: 'Abrir o Hall da Fama', to: '/hall-da-fama' },
    },
    {
      id: 'duelo', group: G.COMPETE, audiences: [A.ATHLETE], module: 'duels',
      title: 'Duelo da semana',
      short: 'Toda segunda-feira o servidor emparelha você com alguém de nível parecido. Vence quem somar mais vitórias até domingo.',
      body: [
        `Entram no sorteio quem jogou nos últimos 30 dias, tem nível calculado (2.0–8.0) e aceita duelos. A diferença de nível entre os dois é de no máximo ${cfg.duels.maxLevelGap.toLocaleString('pt-BR')} ponto(s), e a plataforma evita repetir o duelo da semana anterior.`,
        'Vence quem tiver mais vitórias até domingo à meia-noite; no empate, quem jogou mais. Se nenhum dos dois jogar, o duelo é anulado — ninguém ganha nem perde.',
        `Prêmio: ${num(cfg.duels.winnerXp)} XP para quem vence e ${num(cfg.duels.participationXp)} XP para quem joga e não vence. O placar do adversário só aparece no final, para ninguém jogar olhando o outro.`,
        'Recusar é um toque e não tem penalidade. Para não entrar mais nos sorteios, desligue em Preferências.',
      ],
      where: { label: 'Ver o duelo', to: '/gamification?aba=competir' },
    },
    {
      id: 'desafios', group: G.COMPETE, audiences: [A.ATHLETE], module: 'challenges',
      title: 'Desafios e eventos',
      short: 'Competições com começo, fim e placar, criadas pela plataforma, por clubes, arenas e professores. Entrar é opcional.',
      body: [
        'Você vê o que o desafio mede (jogos, vitórias, dias com jogo, reservas ou aulas), o prazo e o prêmio antes de decidir entrar.',
        'Quem calcula o placar é o servidor, a partir dos registros reais — o seu aparelho não escreve posição nem valor. Entrar é um ato seu; competir é do servidor.',
        'Ao fim, o resultado aparece com o XP já creditado. Um desafio de arena, clube ou professor só aparece para o público dele.',
      ],
      where: { label: 'Ver os desafios', to: '/gamification?aba=competir' },
    },
    {
      id: 'recompensas', group: G.COMPETE, audiences: [A.ATHLETE], module: 'rewards',
      title: 'Recompensas',
      short: `Benefícios reais — ${tiposRecompensa} — liberados por marcos. Não se compram com XP.`,
      body: [
        'Uma recompensa é uma porta que se abre quando você cruza um marco: ser de um tier, ter uma conquista, estar entre os melhores da temporada, manter uma sequência, ter jogado um número de partidas.',
        'O XP continua medindo a sua trajetória — ele não é moeda. Por isso nada é “comprado”: ou você atende ao critério, ou ainda não.',
        'Quando é elegível, você pede e recebe um código. Quem oferece (a plataforma, uma arena, um clube ou um professor) confere e marca como usada. Nada é entregue sozinho.',
        'Cada recompensa mostra, critério por critério, o que você já cumpre e o que falta.',
      ],
      where: { label: 'Ver as recompensas', to: '/gamification?aba=recompensas' },
    },

    /* ----------------------------------------------------------- jogar junto -- */
    {
      id: 'avaliacoes', group: G.SOCIAL, audiences: [A.ATHLETE], module: 'match_reviews',
      title: 'Avaliação pós-jogo',
      short: 'Depois do jogo, você avalia o companheiro e os adversários com estrelas e elogios. A nota individual é anônima.',
      body: [
        `Você tem ${cfg.reviews.windowDays} dias, depois do jogo, para avaliar. Cada avaliação leva de 1 a 5 estrelas e até ${REVIEW_MAX_TAGS} elogios (${tagsAvaliacao}). Não há texto livre: estrelas e elogios bastam, sem abrir espaço para ataque.`,
        'Quem recebe vê só a média e os elogios mais citados — nunca quem deu qual nota. A avaliação individual só pode ser lida por quem a escreveu e pela administração.',
        'Nota baixa abre as categorias de problema (conduta, atraso, comunicação, esportividade). Elas só aparecem para a própria pessoa, como um retrato para ela ajustar.',
        'Só avalia quem jogou aquela partida, uma vez por pessoa. O servidor confere isso e marca como suspeita a troca de notas de vingança ou de favor — para a equipe olhar, nunca para punir sozinho.',
      ],
      where: { label: 'Avaliar um jogo', to: '/gamification?aba=social' },
    },
    {
      id: 'reputacao', group: G.SOCIAL, audiences: [A.ATHLETE], module: 'match_reviews',
      title: 'Reputação em quadra',
      short: 'A média das avaliações que você recebeu — só aparece depois de avaliações suficientes.',
      body: [
        `A sua nota só fica pública a partir de ${cfg.reviews.minForPublicScore} avaliações: poucas notas dizem pouco, e uma única nota ruim não deveria definir ninguém.`,
        'Antes disso você vê quantas faltam. Os elogios mais citados aparecem como etiquetas.',
        'Você pode desligar o recebimento de avaliações em Preferências.',
      ],
      where: { label: 'Ver a minha reputação', to: '/gamification?aba=social' },
    },
    {
      id: 'cartas', group: G.SOCIAL, audiences: [A.ATHLETE], module: 'partner_letters',
      title: 'Carta ao companheiro',
      short: `Uma mensagem curta de gratidão (até ${LETTER_MAX} caracteres) ao seu parceiro de dupla. Anônima por padrão.`,
      body: [
        'Depois de um jogo em dupla, você pode escrever uma frase de agradecimento. Quem recebe vê a carta; o seu nome só aparece se você escolher mostrá-lo.',
        'Quem recebe pode apagar a carta ou denunciá-la; a administração revisa as denúncias. Dá para desligar o recebimento em Preferências.',
      ],
      where: { label: 'Escrever uma carta', to: '/gamification?aba=social' },
    },
    {
      id: 'kudos', group: G.SOCIAL, audiences: [A.ATHLETE],
      title: 'Kudos',
      short: 'Um reconhecimento rápido a alguém que jogou bem ou ajudou.',
      body: [
        'Kudos são um “muito bem!” de um toque, ligado a um jogo. Quem recebe vê o contador crescer.',
        'Trocas repetidas entre as mesmas pessoas são marcadas para revisão — a ideia é reconhecer, não combinar pontos.',
      ],
      where: { label: 'Ver os vínculos', to: '/vinculos' },
    },
    {
      id: 'rivais', group: G.SOCIAL, audiences: [A.ATHLETE], module: 'social_bonds',
      title: 'Rivais',
      short: `Até ${RIVALS_MAX} atletas de nível parecido com quem você acompanha o confronto direto.`,
      body: [
        'Rivalidade saudável: você escolhe quem acompanhar e vê o placar de vitórias entre vocês.',
        'A plataforma sugere nomes de nível parecido; a escolha é sua.',
      ],
      where: { label: 'Ver os rivais', to: '/vinculos' },
    },
    {
      id: 'crews', group: G.SOCIAL, audiences: [A.ATHLETE], module: 'social_bonds',
      title: 'Crews',
      short: `Grupos de quem joga junto — até ${CREW_MAX_MEMBERS} pessoas por crew e ${CREW_MAX_CREWS_PER_USER} crews por pessoa.`,
      body: [
        'Uma crew é a sua turma fixa de dupla ou de quadra. Cada uma tem dono e membros.',
        'Dá para sair quando quiser.',
      ],
      where: { label: 'Ver as crews', to: '/vinculos' },
    },
    {
      id: 'mentoria', group: G.SOCIAL, audiences: [A.ATHLETE], module: 'social_bonds',
      title: 'Mentoria',
      short: `Um mentor acompanha até ${MENTOR_MAX_APPRENTICES} aprendizes. O convite precisa ser aceito pela outra pessoa.`,
      body: [
        'Quem convida (mentor ou aprendiz) manda o convite; só a OUTRA pessoa pode aceitar. Enquanto não aceitar, a mentoria fica pendente e nada acontece.',
        'Aceita a mentoria, o mentor registra as aulas e o aprendiz acompanha as metas. Qualquer um dos dois pode pausar ou encerrar.',
      ],
      where: { label: 'Ver as mentorias', to: '/vinculos?aba=mentoria' },
    },
    {
      id: 'convite', group: G.SOCIAL, audiences: [A.ATHLETE],
      title: 'Convite',
      short: 'O seu link pessoal para chamar amigos. Quem entra por ele joga com você.',
      body: [
        'Compartilhar o convite é um dos primeiros passos. O hub mostra quantas pessoas já se cadastraram pelo seu link.',
      ],
      where: { label: 'Pegar o meu convite', to: '/gamification#convite' },
    },

    /* ------------------------------------------------- privacidade e justiça -- */
    {
      id: 'privacidade', group: G.TRUST, audiences: [A.ATHLETE],
      title: 'Privacidade',
      short: 'Você decide o que os outros veem — e a regra vale no servidor, não só na tela.',
      body: [
        'Aparecer no placar público: nome e foto na temporada e no Hall da Fama. Desligado, você continua ranqueando e recebendo os prêmios, mas ninguém vê.',
        'Mostrar tier e conquistas no perfil: desligado, a página de conquistas públicas fica indisponível para quem abrir o seu perfil.',
        'Participar de duelos, receber avaliações e receber cartas: cada um tem o seu interruptor.',
        'Os avisos (resumo da semana, duelo, resultado de desafios) também são seus: o que você desligar, não chega.',
      ],
      where: { label: 'Abrir as preferências', to: '/gamification/configuracoes' },
    },
    {
      id: 'fair-play', group: G.TRUST, audiences: [A.ATHLETE],
      title: 'Jogo limpo',
      short: 'O servidor marca sinais estranhos para a equipe revisar. Ninguém é punido automaticamente.',
      body: [
        'Como o XP vem de fatos que existem uma vez só (jogos, conquistas registradas, missões do dia), não há botão para inflar números.',
        'Mesmo assim, o servidor procura padrões: um salto de XP em pouco tempo, XP acima do que os jogos verificados sustentam, troca de kudos entre as mesmas pessoas e avaliações de vingança.',
        'Um sinal é só um aviso para a equipe. Enquanto um sinal grave está aberto, a conta fica fora do placar PÚBLICO até alguém olhar — mas continua com a posição, o XP e os prêmios dela.',
      ],
    },

    /* ------------------------------------------------------- para quem oferece -- */
    {
      id: 'saude', group: G.OFFER, audiences: [A.COACH, A.ARENA], module: 'supply_panels',
      title: 'Saúde',
      short: 'Um retrato de 0 a 100 de como vai a sua oferta. Só você vê — não é ranking nem selo.',
      body: [
        `Para a arena, a nota combina: ${dimsArena}. Para o professor: ${dimsProf}.`,
        'O total é a média ponderada só das dimensões que dá para medir: uma arena nova, sem avaliações, não tem “nota zero em satisfação” — tem satisfação ainda não medida. A tela diz em quantas dimensões o número se apoia.',
        'Cada dimensão mostra o número que a motivou, e as sugestões trazem um motivo concreto. Nenhuma promete XP.',
        'Se uma fonte falhar ao carregar, a dimensão correspondente fica de fora e a tela avisa — nunca vira zero.',
      ],
    },
    {
      id: 'atividade-clube', group: G.OFFER, audiences: [A.CLUB], module: 'supply_panels',
      title: 'Atividade do clube',
      short: 'Quantos jogos o clube publicou, quantos membros jogaram e quantos entraram no mês.',
      body: [
        'Mede a vida do clube pelo que foi publicado: partidas dos dias de jogo do clube, membros que jogaram e membros novos.',
        'É um retrato para orientar quem administra, visível só para quem administra.',
      ],
    },
    {
      id: 'metas', group: G.OFFER, audiences: [A.COACH, A.ARENA, A.CLUB], module: 'supply_panels',
      title: 'Metas do mês',
      short: 'Números que você mesmo escolhe para o mês, com o progresso medido pelos registros reais.',
      body: [
        'Cada meta tem um valor sugerido que você pode ajustar. O progresso sai dos registros (aulas concluídas, reservas jogadas, partidas publicadas), não de marcação manual.',
        'Passou o mês, a meta recomeça — sem acúmulo nem cobrança.',
      ],
    },
    {
      id: 'oferecer-desafios', group: G.OFFER, audiences: [A.COACH, A.ARENA, A.CLUB, A.ADMIN], module: 'challenges',
      title: 'Criar um desafio',
      short: 'Uma competição para o seu público, com métrica, prazo e prêmio em XP. O servidor mede e premia.',
      body: [
        `Você escolhe o que medir (jogos, vitórias, dias com jogo e, conforme o seu papel, reservas ou aulas), o período (de ${CHALLENGE_DURATION_DAYS.min} a ${CHALLENGE_DURATION_DAYS.max} dias) e até ${CHALLENGE_MAX_PRIZES} prêmios de até ${num(CHALLENGE_PRIZE_XP_MAX)} XP.`,
        'Antes de publicar, o desafio fica em rascunho. Depois de publicado, quem entra vê as regras, o prazo e o prêmio.',
        'Você não calcula nada: o servidor mede a partir dos registros e credita o XP ao fim. Cada emissor vê só os desafios que são seus.',
      ],
    },
    {
      id: 'oferecer-recompensas', group: G.OFFER, audiences: [A.COACH, A.ARENA, A.CLUB, A.ADMIN], module: 'rewards',
      title: 'Criar uma recompensa',
      short: 'Um benefício real (desconto, aula, prioridade…) para quem cruza um marco. Você confere e marca como usado.',
      body: [
        'Você define o benefício e os critérios (tier, nível, conquista, posição na temporada, sequência, jogos). Os critérios somam: a pessoa precisa cumprir todos.',
        'Quando alguém elegível pede, recebe um código; você aprova, confere o código no atendimento e marca como usada. Nada é entregue sozinho.',
        'A conferência usa os dados públicos de progressão da pessoa, nunca dados pessoais.',
      ],
    },

    /* -------------------------------------------------------- administração -- */
    {
      id: 'admin-modulos', group: G.ADMIN, audiences: [A.ADMIN],
      title: 'Módulos',
      short: `A flag gamification_v2 liga tudo; os ${Object.keys(GAMIFICATION_MODULES).length} módulos ligam e desligam cada parte.`,
      body: [
        'Módulo desligado some das telas e o servidor para de rodar a parte dele. Os dados não são apagados: ligar de novo restaura tudo.',
        'Missões que dependem de um módulo desligado (avaliações, cartas) deixam de ser sorteadas.',
        'Comece pelo básico (jornada, missões e Hall da Fama), observe as métricas e vá ligando o resto.',
      ],
    },
    {
      id: 'admin-premios', group: G.ADMIN, audiences: [A.ADMIN],
      title: 'Prêmios e limiares',
      short: 'Os prêmios de XP da temporada e do duelo, o tier mínimo do placar e as janelas de avaliação.',
      body: [
        'Cada número tem uma faixa válida — você não consegue sair dela. O servidor lê estes valores a cada passada; as telas, na hora.',
        'Prêmio de XP inflaciona o placar da temporada seguinte? Não: o XP concedido é descontado do XP da temporada, então o prêmio de um mês não conta como XP do mês seguinte.',
      ],
    },
    {
      id: 'admin-antifarm', group: G.ADMIN, audiences: [A.ADMIN],
      title: 'Integridade (antifarm)',
      short: 'O servidor MARCA sinais; você decide. Nunca pune sozinho.',
      body: [
        `Os limiares ajustam o que vira sinal: um salto de XP por dia (hoje ${num(cfg.antiFarm.xpJumpPerDay)}), uma troca de ${cfg.antiFarm.kudosRingMin} kudos entre as mesmas pessoas e XP acima de ${cfg.antiFarm.unverifiedXpFactor.toLocaleString('pt-BR')} vezes o que os jogos verificados sustentam.`,
        'Sinal de gravidade alta tira a conta do placar público até você decidir; “Está tudo certo” a devolve. A conta continua ranqueando e recebendo prêmios.',
        'Toda decisão fica na auditoria.',
      ],
    },
    {
      id: 'admin-moderacao', group: G.ADMIN, audiences: [A.ADMIN],
      title: 'Moderação de contas',
      short: 'Esconder do público, tirar do placar ou zerar a progressão — com motivo e auditoria.',
      body: [
        'Esconder do público tira a pessoa do Hall e da temporada; tirar do placar a exclui do ranking; zerar apaga missões, conquistas registradas e o resumo de XP, e a pessoa os refaz a partir dos jogos reais.',
        'Prêmios do servidor e preferências nunca são tocados. Tudo exige motivo e fica registrado.',
      ],
    },
    {
      id: 'admin-metricas', group: G.ADMIN, audiences: [A.ADMIN],
      title: 'Métricas',
      short: 'Um retrato por dia, gravado pelo servidor: quantos atletas, quantos ativos, convites, desafios e sinais abertos.',
      body: [
        'Servem para saber se a gamificação funciona: ativos em 7 e 30 dias, convites que viraram cadastro, avaliações e kudos por semana.',
        'O retrato é gravado uma vez por dia; a evolução mostra os últimos dias.',
      ],
    },
  ];

  const byId = Object.fromEntries(terms.map((t) => [t.id, t]));

  /** O ciclo em uma linha — o "em um minuto" da página. */
  const loop = [
    { id: 'jogar', title: 'Você joga', text: 'Jogos, torneios, dias de jogo, reservas, aulas. É daí que tudo sai.' },
    { id: 'xp', title: 'Ganha XP', text: 'A plataforma recalcula o seu XP a partir do que você fez de verdade.' },
    { id: 'nivel', title: 'Sobe de nível e de tier', text: 'O XP vira nível, e o nível vira uma faixa: do Calouro ao Imortal.' },
    { id: 'missoes', title: 'Cumpre missões e conquista', text: 'Metas curtas do dia, da semana e do mês, e marcos raros da sua trajetória.' },
    { id: 'temporada', title: 'Disputa a temporada', text: 'Todo mês o placar zera: vale o XP do mês, e quem chegou agora também disputa.' },
    { id: 'recompensas', title: 'Abre recompensas', text: 'Marcos liberam benefícios reais oferecidos por arenas, clubes e professores.' },
  ];

  /** Perguntas que as pessoas fazem de verdade, por público. */
  const faq = [
    { audience: A.ATHLETE, q: 'Joguei e o meu XP não subiu. Por quê?', a: 'O XP conta os jogos e torneios com resultado registrado, os mesmos que aparecem em “Meu desempenho”. Ao abrir o hub o total é recalculado na hora; o valor que o placar da temporada usa é atualizado ao abrir o hub e, em segundo plano, a cada 12 horas.' },
    { audience: A.ATHLETE, q: 'Por que a minha sequência zerou?', a: 'A sequência conta semanas seguidas jogando, de segunda a domingo. Ela quebra quando passa uma semana inteira sem jogo, depois de usada a folga automática do mês, e não está de férias. O seu recorde continua guardado — e as conquistas de sequência usam o recorde.' },
    { audience: A.ATHLETE, q: 'Posso ficar fora do placar público?', a: 'Pode. Em Preferências, desligue “Aparecer no placar público”. Você continua ranqueando e recebendo os prêmios da temporada, mas ninguém vê o seu nome e a sua foto.' },
    { audience: A.ATHLETE, q: 'Alguém vê a nota que eu dei?', a: 'Não. Quem recebe vê só a média e os elogios mais citados, nunca quem deu qual nota. A avaliação individual só pode ser lida por quem a escreveu e pela administração.' },
    { audience: A.ATHLETE, q: 'O XP compra alguma coisa?', a: 'Não. O XP mede a sua trajetória e não é moeda. As recompensas são portas que se abrem quando você cruza um marco (tier, conquista, posição, sequência ou jogos).' },
    { audience: A.ATHLETE, q: 'E se o sistema achar que eu trapaceei?', a: 'O servidor só marca sinais para a equipe revisar; ninguém é punido automaticamente. Enquanto um sinal grave está aberto, a conta fica fora do placar público, mas mantém posição, XP e prêmios.' },
    { audience: A.ATHLETE, q: 'Dá para desligar tudo isso?', a: 'Dá. Em Preferências você controla a privacidade, as interações (duelos, avaliações e cartas), os avisos e as comemorações. As Dicas da plataforma também têm o seu próprio interruptor.' },
    { audience: A.COACH, q: 'Os meus alunos veem a minha saúde?', a: 'Não. A saúde, as metas e as sugestões aparecem só para você. Não é ranking nem selo de qualidade.' },
    { audience: A.ARENA, q: 'A nota de saúde da minha arena é pública?', a: 'Não. Só quem gere a arena vê. Ela serve para orientar e se apoia só nas dimensões que dá para medir; a tela diz em quantas.' },
    { audience: A.CLUB, q: 'Quem pode ver a atividade do clube?', a: 'Quem administra o clube.' },
    { audience: A.ADMIN, q: 'Se eu desligar um módulo, os dados somem?', a: 'Não. O módulo some das telas e o servidor para de rodar a parte dele, mas nada é apagado. Ao ligar de novo, tudo volta como estava.' },
    { audience: A.ADMIN, q: 'O servidor pune quem aparece nos sinais?', a: 'Nunca. Ele marca e você decide. Sinal de gravidade alta só tira a conta do placar público até a decisão.' },
  ];

  /**
   * O "Como funciona" de cada aba do hub: três ou quatro frases, e os termos
   * que a aba usa (cada um vira um link para o glossário).
   */
  const tabs = {
    jornada: {
      title: 'Como a sua jornada funciona',
      bullets: [
        'Tudo nasce do que você joga: o XP é recalculado da sua atividade real — não há botão para marcar nada.',
        'O XP vira nível e tier; as conquistas e as missões dão marcos pelo caminho.',
        'A sequência conta as semanas seguidas em que você jogou, com uma folga automática por mês e férias que você avisa.',
        'Nada aqui é cobrança: quem fica uma semana sem jogar não perde pontos.',
      ],
      terms: ['xp', 'nivel', 'tier', 'sequencia', 'trilhas', 'conquistas'],
    },
    missoes: {
      title: 'Como as missões funcionam',
      bullets: [
        `${MISSIONS_PER_SCOPE.daily} por dia, ${MISSIONS_PER_SCOPE.weekly} por semana e ${MISSIONS_PER_SCOPE.monthly} por mês, sorteadas para o seu momento.`,
        'O progresso vem do que você joga e faz de verdade; ninguém marca missão à mão.',
        `Cumpriu todas as do período? Resgate o bônus (+${num(MISSION_BONUS_XP.daily)}, +${num(MISSION_BONUS_XP.weekly)} ou +${num(MISSION_BONUS_XP.monthly)} XP).`,
        'Missão que não deu tempo simplesmente expira — sem punição.',
      ],
      terms: ['missoes', 'xp'],
    },
    competir: {
      title: 'Como a competição funciona',
      bullets: [
        'Cada mês é uma temporada: vale o XP ganho no mês, então quem chegou agora também disputa.',
        'Toda segunda-feira o servidor pode emparelhar você num duelo de vitórias com alguém de nível parecido.',
        'Desafios são competições com prazo e prêmio; entrar é sempre uma escolha sua.',
        'Aparecer no placar público é opcional: desligado, você segue ranqueando e recebendo os prêmios.',
      ],
      terms: ['temporada', 'hall', 'duelo', 'desafios', 'privacidade'],
    },
    social: {
      title: 'Como funciona o lado social',
      bullets: [
        'Depois de um jogo você pode avaliar quem jogou com você. Quem recebe vê a média, nunca quem deu qual nota.',
        `A sua nota só fica pública depois de ${cfg.reviews.minForPublicScore} avaliações.`,
        'Uma carta é uma frase de agradecimento ao parceiro de dupla — anônima por padrão.',
        'Rivais, crews e mentorias são vínculos que você escolhe; a mentoria precisa do aceite da outra pessoa.',
      ],
      terms: ['avaliacoes', 'reputacao', 'cartas', 'mentoria'],
    },
    recompensas: {
      title: 'Como as recompensas funcionam',
      bullets: [
        'São benefícios reais — descontos, aulas, prioridade — oferecidos por arenas, clubes, professores e pela plataforma.',
        'Não se compram com XP: abrem quando você cruza um marco (tier, conquista, posição, sequência ou jogos).',
        'Elegível? Você pede e recebe um código. Quem oferece confere e marca como usada.',
        'Cada recompensa mostra, critério por critério, o que você já cumpre e o que falta.',
      ],
      terms: ['recompensas', 'tier', 'conquistas'],
    },
  };

  return { config: cfg, terms, byId, loop, faq, tabs };
}

/** Termos de um público, na ordem do guia. */
export function termsForAudience(guide, audience) {
  return guide.terms.filter((t) => t.audiences.includes(audience));
}

/** Os termos de um público agrupados (grupo vazio some). */
export function groupedTerms(guide, audience, isModuleOn = () => true) {
  const visiveis = termsForAudience(guide, audience).filter((t) => !t.module || isModuleOn(t.module));
  return Object.values(TERM_GROUP)
    .map((g) => ({ group: g, ...TERM_GROUP_META[g], terms: visiveis.filter((t) => t.group === g) }))
    .filter((x) => x.terms.length > 0);
}
