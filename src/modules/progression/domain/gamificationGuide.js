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
import { t, tk, fmtNumero } from '@/core/i18n';
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
  atleta: { label: tk('Atleta'), summary: tk('Quem joga: XP, missões, temporada, avaliações e recompensas.') },
  professor: { label: tk('Professor'), summary: tk('Quem dá aula: saúde da base, metas, desafios e recompensas para os alunos.') },
  arena: { label: tk('Arena'), summary: tk('Quem gere uma arena: saúde, metas, desafios e recompensas para quem joga lá.') },
  clube: { label: tk('Clube'), summary: tk('Quem administra um clube: a atividade do mês, metas e desafios para os membros.') },
  admin: { label: tk('Administração'), summary: tk('Quem cuida da plataforma: módulos, prêmios, integridade e métricas.') },
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
  jornada: { label: tk('Sua jornada'), summary: tk('O que acumula e como você evolui.') },
  competir: { label: tk('Competir e ser reconhecido'), summary: tk('Temporada, desafios, duelos e recompensas.') },
  social: { label: tk('Jogar junto'), summary: tk('Avaliações, cartas e vínculos entre atletas.') },
  confianca: { label: tk('Privacidade e justiça'), summary: tk('O que os outros veem e como o jogo se mantém limpo.') },
  oferecer: { label: tk('Para quem oferece'), summary: tk('Professor, arena e clube.') },
  administrar: { label: tk('Para a administração'), summary: tk('Configurar, revisar e medir.') },
});

const num = (n) => fmtNumero(n);

/** Os tiers como lista legível: "Calouro (0 XP), Aprendiz (2.000 XP)…". */
function tiersEmTexto() {
  return TIERS.map((tier) => `${tier.icon} ${t(tier.name)} (${num(tier.threshold)} XP)`).join(' · ');
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
    t('Conta as semanas seguidas em que você jogou pelo menos uma vez — torneio, dia de jogo ou partida com resultado registrado. A semana vai de segunda a domingo, no horário de Brasília.'),
    t('A semana atual ainda está aberta: se você ainda não jogou nela, nada se perde até domingo à meia-noite. Ela só entra como “em risco”.'),
    t('Folga automática: uma semana sem jogar por mês não quebra a sequência. Duas semanas seguidas, ou duas no mesmo mês, quebram. Você não precisa fazer nada — é uma regra, não um saldo para gastar.'),
    t('Férias: se vai ficar um tempo sem jogar, avise. Até {semanas} semanas por vez não contam e não quebram, e só dá para começar outras {dias} dias depois.', { semanas: semanasFerias, dias: STREAK_VACATION_COOLDOWN_DAYS }),
    t('Semana de folga ou de férias não soma: “8 semanas” são oito semanas em que você realmente jogou.'),
    t('O seu recorde fica guardado. As conquistas de sequência usam o recorde; a tela e as recompensas usam a sequência de agora.'),
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
  const trilhas = SKILL_TREE_KEYS.map((k) => t(SKILL_TREE_META[k].name)).join(', ');
  const raridades = Object.values(ACHIEVEMENT_RARITY_META).sort((a, b) => a.order - b.order).map((r) => t(r.name).toLowerCase()).join(', ');
  const marcosSequencia = STREAK_MILESTONES.map((m) => m.weeks).join(', ');
  const tagsAvaliacao = Object.values(REVIEW_TAGS).map((tag) => t(tag.label).toLowerCase()).join(', ');
  const tiposRecompensa = Object.values(REWARD_KIND_META).map((k) => t(k.label).toLowerCase()).join(', ');
  const dimsArena = computeArenaHealth({}).dimensions.map((d) => `${t(d.label)} (${d.weight}%)`).join(', ');
  const dimsProf = computeCoachHealth({}).dimensions.map((d) => `${t(d.label)} (${d.weight}%)`).join(', ');
  const A = GUIDE_AUDIENCE;
  const G = TERM_GROUP;

  /** @type {Array<{ id: string, group: string, audiences: string[], title: string, short: string, body: string[], steps?: string[], tip?: string, where?: { label: string, to: string }, module?: string }>} */
  const terms = [
    /* ------------------------------------------------------- sua jornada -- */
    {
      id: 'xp', group: G.JOURNEY, audiences: [A.ATHLETE],
      title: t('XP'),
      short: t('Pontos que a plataforma soma pelo que você faz de verdade: jogar, vencer, disputar torneios, cumprir missões e conquistar.'),
      body: [
        t('XP não é um contador que você clica: é recalculado do zero a partir da sua atividade real. Por isso não dá para “ganhar de mentirinha” — e, se um resultado for corrigido, o seu XP acompanha.'),
        t('Cada jogo disputado vale {jogo} XP e cada vitória acrescenta {vitoria} XP. Disputar um torneio vale {torneio} XP; o pódio acrescenta {podio} XP e o título, {titulo} XP.', { jogo: num(W.game_played), vitoria: num(W.game_won), torneio: num(W.tournament_attended), podio: num(W.tournament_podium), titulo: num(W.tournament_title) }),
        t('Além da quadra, entram o bônus das conquistas, as missões cumpridas, os primeiros passos e os prêmios que o PickleRush concede (temporada, duelo e desafios).'),
        t('Em “De onde vem o meu XP”, no hub, você vê a conta parcela por parcela.'),
      ],
      tip: t('O XP mede a sua trajetória. Ele não é moeda: não se gasta nem se compra nada com ele.'),
      where: { label: t('Ver o meu XP'), to: '/gamification' },
    },
    {
      id: 'nivel', group: G.JOURNEY, audiences: [A.ATHLETE],
      title: t('Nível'),
      short: t('Cada nível pede um pouco mais de XP que o anterior: o nível L exige 500 × L XP.'),
      body: [
        t('Do nível 1 para o 2 são 500 XP; do 2 para o 3, 1.000; do 3 para o 4, 1.500 — e assim por diante. A barra do hub mostra quanto falta para o próximo.'),
        t('O nível acompanha o total de XP. Como o XP é recalculado da sua atividade, ele só muda quando a atividade muda (um resultado corrigido, por exemplo).'),
        t('Não confunda com o seu nível de jogo (2.0–8.0): aquele mede a sua habilidade e vem do nivelamento e dos resultados. O nível da gamificação mede a sua participação.'),
      ],
      where: { label: t('Ver o meu nível'), to: '/gamification' },
    },
    {
      id: 'tier', group: G.JOURNEY, audiences: [A.ATHLETE],
      title: t('Tier'),
      short: t('A faixa da sua jornada, do Calouro ao Imortal. Muda de nome conforme o seu XP total.'),
      body: [
        t('Os tiers, do primeiro ao último: {lista}.', { lista: tiersEmTexto() }),
        t('O tier é identidade, não prêmio: conta a sua trajetória para quem abre o seu perfil e serve de mínimo para algumas recompensas e desafios.'),
        t('Ele só aparece para os outros se você deixar (veja “Privacidade”). No placar público, quem está abaixo de {tier} não aparece, mesmo com a opção ligada.', { tier: t(cfg.season.publicMinTier) }),
      ],
      where: { label: t('Ver o meu tier'), to: '/gamification' },
    },
    {
      id: 'trilhas', group: G.JOURNEY, audiences: [A.ATHLETE],
      title: t('Trilhas'),
      short: t('Cinco áreas do seu jogo — {trilhas} — cada uma com nível próprio. Mostram onde você mais se dedica.', { trilhas }),
      body: [
        t('Quem joga muito torneio sobe a trilha de Torneiro; quem reserva quadra, a de Arena; quem tem aula, a de Aulas; quem participa de clube, a de Clube; quem interage com a comunidade, a Social.'),
        t('As trilhas retratam a sua atividade por área. Elas não somam no XP total — servem para você ver, de relance, que tipo de jogador você é.'),
        t('Uma área que ainda está no nível 1 não é uma falha: é só um convite para experimentar.'),
      ],
      where: { label: t('Ver as minhas trilhas'), to: '/gamification' },
    },
    {
      id: 'sequencia', group: G.JOURNEY, audiences: [A.ATHLETE],
      title: t('Sequência'),
      short: t('Quantas semanas seguidas você jogou. A semana atual ainda está aberta e uma folga por mês é automática.'),
      body: streakRuleBullets(),
      tip: t('Marcos da sequência: {marcos} semanas. As conquistas de sequência usam o seu recorde.', { marcos: marcosSequencia }),
      where: { label: t('Ver a minha sequência'), to: '/gamification' },
    },
    {
      id: 'ferias', group: G.JOURNEY, audiences: [A.ATHLETE],
      title: t('Férias da sequência'),
      short: t('Uma pausa avisada: até {semanas} semanas que não contam nem quebram a sequência.', { semanas: Math.round(STREAK_VACATION_MAX_DAYS / 7) }),
      body: [
        t('Use quando for viajar, se machucar ou simplesmente descansar. Enquanto as férias estiverem em andamento, a sequência fica guardada. Elas protegem no máximo {semanas} semanas por vez; passado isso, é só voltar a jogar.', { semanas: Math.round(STREAK_VACATION_MAX_DAYS / 7) }),
        t('Para a pausa não virar um jeito de segurar o número para sempre, só dá para começar outras férias {dias} dias depois do começo das últimas.', { dias: STREAK_VACATION_COOLDOWN_DAYS }),
        t('Dá para encerrar quando quiser, jogando ou não. As semanas de férias não somam na sequência — elas só deixam de quebrá-la.'),
      ],
      where: { label: t('Gerir as férias'), to: '/gamification' },
    },
    {
      id: 'conquistas', group: G.JOURNEY, audiences: [A.ATHLETE],
      title: t('Conquistas'),
      short: t('Marcos reais da sua trajetória — hoje {n} medidas pela plataforma, em cinco raridades.', { n: TRACKED_ACHIEVEMENT_COUNT }),
      body: [
        t('Cada conquista é desbloqueada quando um fato verdadeiro acontece — não por clique. Elas vêm em cinco raridades ({raridades}) e muitas dão um bônus de XP, uma vez só.', { raridades }),
        t('As que a plataforma ainda não consegue medir aparecem em “Em breve”, fora da conta: nada fica bloqueado por um motivo que você não controla.'),
        t('Se uma fonte de dados não carregou, a conquista fica como está e diz que não deu para verificar — nunca “zero”.'),
      ],
      where: { label: t('Ver as minhas conquistas'), to: '/conquistas' },
    },
    {
      id: 'missoes', group: G.JOURNEY, audiences: [A.ATHLETE], module: 'missions_weekly',
      title: t('Missões'),
      short: t('{dia} missões por dia, {semana} por semana e {mes} por mês — cumpridas pelo que você joga, sem botão de marcar.', { dia: MISSIONS_PER_SCOPE.daily, semana: MISSIONS_PER_SCOPE.weekly, mes: MISSIONS_PER_SCOPE.monthly }),
      body: [
        t('O progresso é medido pela sua atividade real: jogos, torneios, avaliações, reservas. Não existe botão de “marcar como feita”.'),
        t('Cumpriu todas as missões do período? Resgate o bônus: +{dia} XP no dia, +{semana} na semana, +{mes} no mês.', { dia: num(MISSION_BONUS_XP.daily), semana: num(MISSION_BONUS_XP.weekly), mes: num(MISSION_BONUS_XP.monthly) }),
        t('O dia vira à meia-noite (horário de Brasília), a semana na segunda-feira e o mês no dia 1º. Missão não cumprida simplesmente expira — sem punição.'),
        t('O sorteio mistura os tipos — sempre há missões de jogo e sociais — e não sorteia missão de um recurso que esteja desligado.'),
      ],
      where: { label: t('Ver as missões'), to: '/gamification?aba=missoes' },
    },
    {
      id: 'primeiros-passos', group: G.JOURNEY, audiences: [A.ATHLETE], module: 'onboarding',
      title: t('Primeiros passos'),
      short: t('{n} passos para quem chegou agora, espalhados pelos primeiros dias, com até {xp} XP.', { n: ONBOARDING_STEPS.length, xp: num(ONBOARDING_MAX_XP) }),
      body: [
        t('É um roteiro curto, não uma lista de obrigações: nível, foto, cadastro, ranking, atletas, clube, torneio e convite. Cada passo concluído rende XP uma vez.'),
        t('A plataforma detecta sozinha o que você já fez (a foto de perfil, por exemplo) — você não precisa marcar nada.'),
        t('O roteiro some quando você conclui tudo ou o dispensa, e quem já tem muita história na plataforma nem chega a vê-lo. Dá para trazê-lo de volta em Preferências.'),
      ],
      where: { label: t('Ver o roteiro'), to: '/gamification' },
    },
    {
      id: 'revisao', group: G.JOURNEY, audiences: [A.ATHLETE], module: 'weekly_review',
      title: t('Revisão da semana e do mês'),
      short: t('Um resumo do que você fez, comparado com o período anterior — sem cobrança.'),
      body: [
        t('Mostra jogos, vitórias, parceiros, a conquista que está mais perto de sair e como foi em relação ao período anterior.'),
        t('Semana tranquila ganha um texto gentil, nunca uma cobrança. Se alguma fonte de dados não carregou, a revisão avisa o que ficou de fora.'),
        t('Na segunda-feira você pode receber um aviso no sino com o resumo (dá para desligar em Preferências).'),
      ],
      where: { label: t('Ver a minha revisão'), to: '/gamification/revisao' },
    },
    {
      id: 'marcos', group: G.JOURNEY, audiences: [A.ATHLETE], module: 'celebrations',
      title: t('Marcos e comemorações'),
      short: t('Um aviso curto quando você cruza uma linha que merece comemoração: subir de tier, bater jogos ou vitórias, emendar semanas.'),
      body: [
        t('Quem chega já com história não recebe uma chuva de confete: dentro de cada família (tier, jogos, vitórias, semanas) só o marco mais alto é comemorado.'),
        t('Dá para desligar as comemorações em Preferências — os marcos continuam registrados, para não explodirem de uma vez se você religar.'),
      ],
      where: { label: t('Abrir as preferências'), to: '/gamification/configuracoes' },
    },

    /* ------------------------------------------- competir e ser reconhecido -- */
    {
      id: 'temporada', group: G.COMPETE, audiences: [A.ATHLETE], module: 'hall_of_fame',
      title: t('Temporada'),
      short: t('Cada mês é uma temporada, disputada com o XP ganho NO mês — quem chegou agora também disputa.'),
      body: [
        t('Todo mundo começa a temporada zerado: vale o XP que você ganhou dentro do mês, não o total da vida. É isso que deixa o placar justo para quem é novo.'),
        t('Quando o mês fecha (último dia, horário de Brasília), o servidor concede os prêmios em XP: {top1} para o 1º lugar e para quem está no 1% do topo, {top10} para o top 10% e {participacao} para quem participou.', { top1: num(cfg.season.prizeTop1), top10: num(cfg.season.prizeTop10Percent), participacao: num(cfg.season.prizeParticipation) }),
        t('O banner mostra quantos dias faltam, a sua posição e o prêmio previsto. O prêmio é concedido pelo servidor; o seu aparelho não consegue escrevê-lo.'),
        t('Você sempre vê a sua própria posição. Aparecer para os outros, com nome e foto, depende da sua privacidade.'),
      ],
      where: { label: t('Ver a temporada'), to: '/hall-da-fama' },
    },
    {
      id: 'hall', group: G.COMPETE, audiences: [A.ATHLETE], module: 'hall_of_fame',
      title: t('Hall da Fama'),
      short: t('O placar público: a temporada do mês e os maiores XP de todos os tempos, com filtro por estado.'),
      body: [
        t('Só aparece quem aceitou: nome e foto entram no Hall se a sua opção “Aparecer no placar público” estiver ligada. Desligada, você continua ranqueando e recebendo os prêmios, mas ninguém vê.'),
        t('Há um tier mínimo para aparecer (hoje {tier}), e contas em revisão de integridade ficam fora do público até a equipe olhar.', { tier: t(cfg.season.publicMinTier) }),
        t('A regra vale no servidor: o placar já nasce sem quem não deve aparecer — não é só a tela que esconde.'),
      ],
      where: { label: t('Abrir o Hall da Fama'), to: '/hall-da-fama' },
    },
    {
      id: 'duelo', group: G.COMPETE, audiences: [A.ATHLETE], module: 'duels',
      title: t('Duelo da semana'),
      short: t('Toda segunda-feira o servidor emparelha você com alguém de nível parecido. Vence quem somar mais vitórias até domingo.'),
      body: [
        t('Entram no sorteio quem jogou nos últimos 30 dias, tem nível calculado (2.0–8.0) e aceita duelos. A diferença de nível entre os dois é de no máximo {gap} ponto(s), e a plataforma evita repetir o duelo da semana anterior.', { gap: fmtNumero(cfg.duels.maxLevelGap) }),
        t('Vence quem tiver mais vitórias até domingo à meia-noite; no empate, quem jogou mais. Se nenhum dos dois jogar, o duelo é anulado — ninguém ganha nem perde.'),
        t('Prêmio: {vence} XP para quem vence e {joga} XP para quem joga e não vence. O placar do adversário só aparece no final, para ninguém jogar olhando o outro.', { vence: num(cfg.duels.winnerXp), joga: num(cfg.duels.participationXp) }),
        t('Recusar é um toque e não tem penalidade. Para não entrar mais nos sorteios, desligue em Preferências.'),
      ],
      where: { label: t('Ver o duelo'), to: '/gamification?aba=competir' },
    },
    {
      id: 'desafios', group: G.COMPETE, audiences: [A.ATHLETE], module: 'challenges',
      title: t('Desafios e eventos'),
      short: t('Competições com começo, fim e placar, criadas pela plataforma, por clubes, arenas e professores. Entrar é opcional.'),
      body: [
        t('Você vê o que o desafio mede (jogos, vitórias, dias com jogo, reservas ou aulas), o prazo e o prêmio antes de decidir entrar.'),
        t('Quem calcula o placar é o servidor, a partir dos registros reais — o seu aparelho não escreve posição nem valor. Entrar é um ato seu; competir é do servidor.'),
        t('Ao fim, o resultado aparece com o XP já creditado. Um desafio de arena, clube ou professor só aparece para o público dele.'),
      ],
      where: { label: t('Ver os desafios'), to: '/gamification?aba=competir' },
    },
    {
      id: 'recompensas', group: G.COMPETE, audiences: [A.ATHLETE], module: 'rewards',
      title: t('Recompensas'),
      short: t('Benefícios reais — {tipos} — liberados por marcos. Não se compram com XP.', { tipos: tiposRecompensa }),
      body: [
        t('Uma recompensa é uma porta que se abre quando você cruza um marco: ser de um tier, ter uma conquista, estar entre os melhores da temporada, manter uma sequência, ter jogado um número de partidas.'),
        t('O XP continua medindo a sua trajetória — ele não é moeda. Por isso nada é “comprado”: ou você atende ao critério, ou ainda não.'),
        t('Quando é elegível, você pede e recebe um código. Quem oferece (a plataforma, uma arena, um clube ou um professor) confere e marca como usada. Nada é entregue sozinho.'),
        t('Cada recompensa mostra, critério por critério, o que você já cumpre e o que falta.'),
      ],
      where: { label: t('Ver as recompensas'), to: '/gamification?aba=recompensas' },
    },

    /* ----------------------------------------------------------- jogar junto -- */
    {
      id: 'avaliacoes', group: G.SOCIAL, audiences: [A.ATHLETE], module: 'match_reviews',
      title: t('Avaliação pós-jogo'),
      short: t('Depois do jogo, você avalia o companheiro e os adversários com estrelas e elogios. A nota individual é anônima.'),
      body: [
        t('Você tem {dias} dias, depois do jogo, para avaliar. Cada avaliação leva de 1 a 5 estrelas e até {max} elogios ({tags}). Não há texto livre: estrelas e elogios bastam, sem abrir espaço para ataque.', { dias: cfg.reviews.windowDays, max: REVIEW_MAX_TAGS, tags: tagsAvaliacao }),
        t('Quem recebe vê só a média e os elogios mais citados — nunca quem deu qual nota. A avaliação individual só pode ser lida por quem a escreveu e pela administração.'),
        t('Nota baixa abre as categorias de problema (conduta, atraso, comunicação, esportividade). Elas só aparecem para a própria pessoa, como um retrato para ela ajustar.'),
        t('Só avalia quem jogou aquela partida, uma vez por pessoa. O servidor confere isso e marca como suspeita a troca de notas de vingança ou de favor — para a equipe olhar, nunca para punir sozinho.'),
      ],
      where: { label: t('Avaliar um jogo'), to: '/gamification?aba=social' },
    },
    {
      id: 'reputacao', group: G.SOCIAL, audiences: [A.ATHLETE], module: 'match_reviews',
      title: t('Reputação em quadra'),
      short: t('A média das avaliações que você recebeu — só aparece depois de avaliações suficientes.'),
      body: [
        t('A sua nota só fica pública a partir de {n} avaliações: poucas notas dizem pouco, e uma única nota ruim não deveria definir ninguém.', { n: cfg.reviews.minForPublicScore }),
        t('Antes disso você vê quantas faltam. Os elogios mais citados aparecem como etiquetas.'),
        t('Você pode desligar o recebimento de avaliações em Preferências.'),
      ],
      where: { label: t('Ver a minha reputação'), to: '/gamification?aba=social' },
    },
    {
      id: 'cartas', group: G.SOCIAL, audiences: [A.ATHLETE], module: 'partner_letters',
      title: t('Carta ao companheiro'),
      short: t('Uma mensagem curta de gratidão (até {n} caracteres) ao seu parceiro de dupla. Anônima por padrão.', { n: LETTER_MAX }),
      body: [
        t('Depois de um jogo em dupla, você pode escrever uma frase de agradecimento. Quem recebe vê a carta; o seu nome só aparece se você escolher mostrá-lo.'),
        t('Quem recebe pode apagar a carta ou denunciá-la; a administração revisa as denúncias. Dá para desligar o recebimento em Preferências.'),
      ],
      where: { label: t('Escrever uma carta'), to: '/gamification?aba=social' },
    },
    {
      id: 'kudos', group: G.SOCIAL, audiences: [A.ATHLETE],
      title: t('Kudos'),
      short: t('Um reconhecimento rápido a alguém que jogou bem ou ajudou.'),
      body: [
        t('Kudos são um “muito bem!” de um toque, ligado a um jogo. Quem recebe vê o contador crescer.'),
        t('Trocas repetidas entre as mesmas pessoas são marcadas para revisão — a ideia é reconhecer, não combinar pontos.'),
      ],
      where: { label: t('Ver os vínculos'), to: '/vinculos' },
    },
    {
      id: 'rivais', group: G.SOCIAL, audiences: [A.ATHLETE], module: 'social_bonds',
      title: t('Rivais'),
      short: t('Até {n} atletas de nível parecido com quem você acompanha o confronto direto.', { n: RIVALS_MAX }),
      body: [
        t('Rivalidade saudável: você escolhe quem acompanhar e vê o placar de vitórias entre vocês.'),
        t('A plataforma sugere nomes de nível parecido; a escolha é sua.'),
      ],
      where: { label: t('Ver os rivais'), to: '/vinculos' },
    },
    {
      id: 'crews', group: G.SOCIAL, audiences: [A.ATHLETE], module: 'social_bonds',
      title: t('Crews'),
      short: t('Grupos de quem joga junto — até {membros} pessoas por crew e {crews} crews por pessoa.', { membros: CREW_MAX_MEMBERS, crews: CREW_MAX_CREWS_PER_USER }),
      body: [
        t('Uma crew é a sua turma fixa de dupla ou de quadra. Cada uma tem dono e membros.'),
        t('Dá para sair quando quiser.'),
      ],
      where: { label: t('Ver as crews'), to: '/vinculos?aba=crews' },
    },
    {
      id: 'mentoria', group: G.SOCIAL, audiences: [A.ATHLETE], module: 'social_bonds',
      title: t('Mentoria'),
      short: t('Um mentor acompanha até {n} aprendizes. O convite precisa ser aceito pela outra pessoa.', { n: MENTOR_MAX_APPRENTICES }),
      body: [
        t('Quem convida (mentor ou aprendiz) manda o convite; só a OUTRA pessoa pode aceitar. Enquanto não aceitar, a mentoria fica pendente e nada acontece.'),
        t('Aceita a mentoria, o mentor registra as aulas e o aprendiz acompanha as metas. Qualquer um dos dois pode pausar ou encerrar.'),
      ],
      where: { label: t('Ver as mentorias'), to: '/vinculos?aba=mentorias' },
    },
    {
      id: 'convite', group: G.SOCIAL, audiences: [A.ATHLETE],
      title: t('Convite'),
      short: t('O seu link pessoal para chamar amigos. Quem entra por ele joga com você.'),
      body: [
        t('Compartilhar o convite é um dos primeiros passos. O hub mostra quantas pessoas já se cadastraram pelo seu link.'),
      ],
      where: { label: t('Pegar o meu convite'), to: '/gamification#convite' },
    },

    /* ------------------------------------------------- privacidade e justiça -- */
    {
      id: 'privacidade', group: G.TRUST, audiences: [A.ATHLETE],
      title: t('Privacidade'),
      short: t('Você decide o que os outros veem — e a regra vale no servidor, não só na tela.'),
      body: [
        t('Aparecer no placar público: nome e foto na temporada e no Hall da Fama. Desligado, você continua ranqueando e recebendo os prêmios, mas ninguém vê.'),
        t('Mostrar tier e conquistas no perfil: desligado, a página de conquistas públicas fica indisponível para quem abrir o seu perfil.'),
        t('Participar de duelos, receber avaliações e receber cartas: cada um tem o seu interruptor.'),
        t('Os avisos (resumo da semana, duelo, resultado de desafios) também são seus: o que você desligar, não chega.'),
      ],
      where: { label: t('Abrir as preferências'), to: '/gamification/configuracoes' },
    },
    {
      id: 'fair-play', group: G.TRUST, audiences: [A.ATHLETE],
      title: t('Jogo limpo'),
      short: t('O servidor marca sinais estranhos para a equipe revisar. Ninguém é punido automaticamente.'),
      body: [
        t('Como o XP vem de fatos que existem uma vez só (jogos, conquistas registradas, missões do dia), não há botão para inflar números.'),
        t('Mesmo assim, o servidor procura padrões: um salto de XP em pouco tempo, XP acima do que os jogos verificados sustentam, troca de kudos entre as mesmas pessoas e avaliações de vingança.'),
        t('Um sinal é só um aviso para a equipe. Enquanto um sinal grave está aberto, a conta fica fora do placar PÚBLICO até alguém olhar — mas continua com a posição, o XP e os prêmios dela.'),
      ],
    },

    /* ------------------------------------------------------- para quem oferece -- */
    {
      id: 'saude', group: G.OFFER, audiences: [A.COACH, A.ARENA], module: 'supply_panels',
      title: t('Saúde'),
      short: t('Um retrato de 0 a 100 de como vai a sua oferta. Só você vê — não é ranking nem selo.'),
      body: [
        t('Para a arena, a nota combina: {arena}. Para o professor: {professor}.', { arena: dimsArena, professor: dimsProf }),
        t('O total é a média ponderada só das dimensões que dá para medir: uma arena nova, sem avaliações, não tem “nota zero em satisfação” — tem satisfação ainda não medida. A tela diz em quantas dimensões o número se apoia.'),
        t('Cada dimensão mostra o número que a motivou, e as sugestões trazem um motivo concreto. Nenhuma promete XP.'),
        t('Se uma fonte falhar ao carregar, a dimensão correspondente fica de fora e a tela avisa — nunca vira zero.'),
      ],
    },
    {
      id: 'atividade-clube', group: G.OFFER, audiences: [A.CLUB], module: 'supply_panels',
      title: t('Atividade do clube'),
      short: t('Quantos jogos o clube publicou, quantos membros jogaram e quantos entraram no mês.'),
      body: [
        t('Mede a vida do clube pelo que foi publicado: partidas dos dias de jogo do clube, membros que jogaram e membros novos.'),
        t('É um retrato para orientar quem administra, visível só para quem administra.'),
      ],
    },
    {
      id: 'metas', group: G.OFFER, audiences: [A.COACH, A.ARENA, A.CLUB], module: 'supply_panels',
      title: t('Metas do mês'),
      short: t('Números que você mesmo escolhe para o mês, com o progresso medido pelos registros reais.'),
      body: [
        t('Cada meta tem um valor sugerido que você pode ajustar. O progresso sai dos registros (aulas concluídas, reservas jogadas, partidas publicadas), não de marcação manual.'),
        t('Passou o mês, a meta recomeça — sem acúmulo nem cobrança.'),
      ],
    },
    {
      id: 'oferecer-desafios', group: G.OFFER, audiences: [A.COACH, A.ARENA, A.CLUB, A.ADMIN], module: 'challenges',
      title: t('Criar um desafio'),
      short: t('Uma competição para o seu público, com métrica, prazo e prêmio em XP. O servidor mede e premia.'),
      body: [
        t('Você escolhe o que medir (jogos, vitórias, dias com jogo e, conforme o seu papel, reservas ou aulas), o período (de {min} a {max} dias) e até {premios} prêmios de até {xp} XP.', { min: CHALLENGE_DURATION_DAYS.min, max: CHALLENGE_DURATION_DAYS.max, premios: CHALLENGE_MAX_PRIZES, xp: num(CHALLENGE_PRIZE_XP_MAX) }),
        t('Antes de publicar, o desafio fica em rascunho. Depois de publicado, quem entra vê as regras, o prazo e o prêmio.'),
        t('Você não calcula nada: o servidor mede a partir dos registros e credita o XP ao fim. Cada emissor vê só os desafios que são seus.'),
      ],
    },
    {
      id: 'oferecer-recompensas', group: G.OFFER, audiences: [A.COACH, A.ARENA, A.CLUB, A.ADMIN], module: 'rewards',
      title: t('Criar uma recompensa'),
      short: t('Um benefício real (desconto, aula, prioridade…) para quem cruza um marco. Você confere e marca como usado.'),
      body: [
        t('Você define o benefício e os critérios (tier, nível, conquista, posição na temporada, sequência, jogos). Os critérios somam: a pessoa precisa cumprir todos.'),
        t('Quando alguém elegível pede, recebe um código; você aprova, confere o código no atendimento e marca como usada. Nada é entregue sozinho.'),
        t('A conferência usa os dados públicos de progressão da pessoa, nunca dados pessoais.'),
      ],
    },

    /* -------------------------------------------------------- administração -- */
    {
      id: 'admin-modulos', group: G.ADMIN, audiences: [A.ADMIN],
      title: t('Módulos'),
      short: t('A flag gamification_v2 liga tudo; os {n} módulos ligam e desligam cada parte.', { n: Object.keys(GAMIFICATION_MODULES).length }),
      body: [
        t('Módulo desligado some das telas e o servidor para de rodar a parte dele. Os dados não são apagados: ligar de novo restaura tudo.'),
        t('Missões que dependem de um módulo desligado (avaliações, cartas) deixam de ser sorteadas.'),
        t('Comece pelo básico (jornada, missões e Hall da Fama), observe as métricas e vá ligando o resto.'),
      ],
    },
    {
      id: 'admin-premios', group: G.ADMIN, audiences: [A.ADMIN],
      title: t('Prêmios e limiares'),
      short: t('Os prêmios de XP da temporada e do duelo, o tier mínimo do placar e as janelas de avaliação.'),
      body: [
        t('Cada número tem uma faixa válida — você não consegue sair dela. O servidor lê estes valores a cada passada; as telas, na hora.'),
        t('Prêmio de XP inflaciona o placar da temporada seguinte? Não: o XP concedido é descontado do XP da temporada, então o prêmio de um mês não conta como XP do mês seguinte.'),
      ],
    },
    {
      id: 'admin-antifarm', group: G.ADMIN, audiences: [A.ADMIN],
      title: t('Integridade (antifarm)'),
      short: t('O servidor MARCA sinais; você decide. Nunca pune sozinho.'),
      body: [
        t('Os limiares ajustam o que vira sinal: um salto de XP por dia (hoje {salto}), uma troca de {kudos} kudos entre as mesmas pessoas e XP acima de {fator} vezes o que os jogos verificados sustentam.', { salto: num(cfg.antiFarm.xpJumpPerDay), kudos: cfg.antiFarm.kudosRingMin, fator: fmtNumero(cfg.antiFarm.unverifiedXpFactor) }),
        t('Sinal de gravidade alta tira a conta do placar público até você decidir; “Está tudo certo” a devolve. A conta continua ranqueando e recebendo prêmios.'),
        t('Toda decisão fica na auditoria.'),
      ],
    },
    {
      id: 'admin-moderacao', group: G.ADMIN, audiences: [A.ADMIN],
      title: t('Moderação de contas'),
      short: t('Esconder do público, tirar do placar ou zerar a progressão — com motivo e auditoria.'),
      body: [
        t('Esconder do público tira a pessoa do Hall e da temporada; tirar do placar a exclui do ranking; zerar apaga missões, conquistas registradas e o resumo de XP, e a pessoa os refaz a partir dos jogos reais.'),
        t('Prêmios do servidor e preferências nunca são tocados. Tudo exige motivo e fica registrado.'),
      ],
    },
    {
      id: 'admin-metricas', group: G.ADMIN, audiences: [A.ADMIN],
      title: t('Métricas'),
      short: t('Um retrato por dia, gravado pelo servidor: quantos atletas, quantos ativos, convites, desafios e sinais abertos.'),
      body: [
        t('Servem para saber se a gamificação funciona: ativos em 7 e 30 dias, convites que viraram cadastro, avaliações e kudos por semana.'),
        t('O funil dos primeiros passos mostra, etapa por etapa, quantas pessoas concluíram o roteiro de quem chegou agora e quantas o dispensaram — é onde dá para ver em que passo as pessoas travam.'),
        t('O retrato é gravado uma vez por dia; a evolução mostra os últimos dias.'),
      ],
    },
  ];

  const byId = Object.fromEntries(terms.map((termo) => [termo.id, termo]));

  /** O ciclo em uma linha — o "em um minuto" da página. */
  const loop = [
    { id: 'jogar', title: t('Você joga'), text: t('Jogos, torneios, dias de jogo, reservas, aulas. É daí que tudo sai.') },
    { id: 'xp', title: t('Ganha XP'), text: t('A plataforma recalcula o seu XP a partir do que você fez de verdade.') },
    { id: 'nivel', title: t('Sobe de nível e de tier'), text: t('O XP vira nível, e o nível vira uma faixa: do Calouro ao Imortal.') },
    { id: 'missoes', title: t('Cumpre missões e conquista'), text: t('Metas curtas do dia, da semana e do mês, e marcos raros da sua trajetória.') },
    { id: 'temporada', title: t('Disputa a temporada'), text: t('Todo mês o placar zera: vale o XP do mês, e quem chegou agora também disputa.') },
    { id: 'recompensas', title: t('Abre recompensas'), text: t('Marcos liberam benefícios reais oferecidos por arenas, clubes e professores.') },
  ];

  /** Perguntas que as pessoas fazem de verdade, por público. */
  const faq = [
    { audience: A.ATHLETE, q: t('Joguei e o meu XP não subiu. Por quê?'), a: t('O XP conta os jogos e torneios com resultado registrado, os mesmos que aparecem em “Meu desempenho”. Ao abrir o hub o total é recalculado na hora; o valor que o placar da temporada usa é atualizado ao abrir o hub e, em segundo plano, a cada 12 horas.') },
    { audience: A.ATHLETE, q: t('Por que a minha sequência zerou?'), a: t('A sequência conta semanas seguidas jogando, de segunda a domingo. Ela quebra quando passa uma semana inteira sem jogo, depois de usada a folga automática do mês, e não está de férias. O seu recorde continua guardado — e as conquistas de sequência usam o recorde.') },
    { audience: A.ATHLETE, q: t('Posso ficar fora do placar público?'), a: t('Pode. Em Preferências, desligue “Aparecer no placar público”. Você continua ranqueando e recebendo os prêmios da temporada, mas ninguém vê o seu nome e a sua foto.') },
    { audience: A.ATHLETE, q: t('Alguém vê a nota que eu dei?'), a: t('Não. Quem recebe vê só a média e os elogios mais citados, nunca quem deu qual nota. A avaliação individual só pode ser lida por quem a escreveu e pela administração.') },
    { audience: A.ATHLETE, q: t('O XP compra alguma coisa?'), a: t('Não. O XP mede a sua trajetória e não é moeda. As recompensas são portas que se abrem quando você cruza um marco (tier, conquista, posição, sequência ou jogos).') },
    { audience: A.ATHLETE, q: t('E se o sistema achar que eu trapaceei?'), a: t('O servidor só marca sinais para a equipe revisar; ninguém é punido automaticamente. Enquanto um sinal grave está aberto, a conta fica fora do placar público, mas mantém posição, XP e prêmios.') },
    { audience: A.ATHLETE, q: t('Dá para desligar tudo isso?'), a: t('Dá. Em Preferências você controla a privacidade, as interações (duelos, avaliações e cartas), os avisos e as comemorações. As Dicas da plataforma também têm o seu próprio interruptor.') },
    { audience: A.COACH, q: t('Os meus alunos veem a minha saúde?'), a: t('Não. A saúde, as metas e as sugestões aparecem só para você. Não é ranking nem selo de qualidade.') },
    { audience: A.ARENA, q: t('A nota de saúde da minha arena é pública?'), a: t('Não. Só quem gere a arena vê. Ela serve para orientar e se apoia só nas dimensões que dá para medir; a tela diz em quantas.') },
    { audience: A.CLUB, q: t('Quem pode ver a atividade do clube?'), a: t('Quem administra o clube.') },
    { audience: A.ADMIN, q: t('Se eu desligar um módulo, os dados somem?'), a: t('Não. O módulo some das telas e o servidor para de rodar a parte dele, mas nada é apagado. Ao ligar de novo, tudo volta como estava.') },
    { audience: A.ADMIN, q: t('O servidor pune quem aparece nos sinais?'), a: t('Nunca. Ele marca e você decide. Sinal de gravidade alta só tira a conta do placar público até a decisão.') },
  ];

  /**
   * O "Como funciona" de cada aba do hub: três ou quatro frases, e os termos
   * que a aba usa (cada um vira um link para o glossário).
   */
  const tabs = {
    jornada: {
      title: t('Como a sua jornada funciona'),
      bullets: [
        t('Tudo nasce do que você joga: o XP é recalculado da sua atividade real — não há botão para marcar nada.'),
        t('O XP vira nível e tier; as conquistas e as missões dão marcos pelo caminho.'),
        t('A sequência conta as semanas seguidas em que você jogou, com uma folga automática por mês e férias que você avisa.'),
        t('Nada aqui é cobrança: quem fica uma semana sem jogar não perde pontos.'),
      ],
      terms: ['xp', 'nivel', 'tier', 'sequencia', 'trilhas', 'conquistas'],
    },
    missoes: {
      title: t('Como as missões funcionam'),
      bullets: [
        t('{dia} por dia, {semana} por semana e {mes} por mês, sorteadas para o seu momento.', { dia: MISSIONS_PER_SCOPE.daily, semana: MISSIONS_PER_SCOPE.weekly, mes: MISSIONS_PER_SCOPE.monthly }),
        t('O progresso vem do que você joga e faz de verdade; ninguém marca missão à mão.'),
        t('Cumpriu todas as do período? Resgate o bônus (+{dia}, +{semana} ou +{mes} XP).', { dia: num(MISSION_BONUS_XP.daily), semana: num(MISSION_BONUS_XP.weekly), mes: num(MISSION_BONUS_XP.monthly) }),
        t('Missão que não deu tempo simplesmente expira — sem punição.'),
      ],
      terms: ['missoes', 'xp'],
    },
    competir: {
      title: t('Como a competição funciona'),
      bullets: [
        t('Cada mês é uma temporada: vale o XP ganho no mês, então quem chegou agora também disputa.'),
        t('Toda segunda-feira o servidor pode emparelhar você num duelo de vitórias com alguém de nível parecido.'),
        t('Desafios são competições com prazo e prêmio; entrar é sempre uma escolha sua.'),
        t('Aparecer no placar público é opcional: desligado, você segue ranqueando e recebendo os prêmios.'),
      ],
      terms: ['temporada', 'hall', 'duelo', 'desafios', 'privacidade'],
    },
    social: {
      title: t('Como funciona o lado social'),
      bullets: [
        t('Depois de um jogo você pode avaliar quem jogou com você. Quem recebe vê a média, nunca quem deu qual nota.'),
        t('A sua nota só fica pública depois de {n} avaliações.', { n: cfg.reviews.minForPublicScore }),
        t('Uma carta é uma frase de agradecimento ao parceiro de dupla — anônima por padrão.'),
        t('Rivais, crews e mentorias são vínculos que você escolhe; a mentoria precisa do aceite da outra pessoa.'),
      ],
      terms: ['avaliacoes', 'reputacao', 'cartas', 'mentoria'],
    },
    recompensas: {
      title: t('Como as recompensas funcionam'),
      bullets: [
        t('São benefícios reais — descontos, aulas, prioridade — oferecidos por arenas, clubes, professores e pela plataforma.'),
        t('Não se compram com XP: abrem quando você cruza um marco (tier, conquista, posição, sequência ou jogos).'),
        t('Elegível? Você pede e recebe um código. Quem oferece confere e marca como usada.'),
        t('Cada recompensa mostra, critério por critério, o que você já cumpre e o que falta.'),
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

/** Sem acento e sem caixa — quem busca "duelo" acha "Duelo da semana". */
export function normalizeText(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/**
 * Busca nos termos. Vários termos de busca ESTREITAM (todos precisam aparecer);
 * o título pesa mais que o corpo, para "tier" trazer o Tier antes de quem só o
 * cita. Busca vazia devolve a lista como veio.
 *
 * @param {Array<object>} terms
 * @param {string} query
 */
export function searchTerms(terms, query) {
  const palavras = normalizeText(query).split(/\s+/).filter((p) => p.length >= 2);
  if (palavras.length === 0) return terms;
  return terms
    .map((t) => {
      const titulo = normalizeText(`${t.title} ${t.id}`);
      const todo = normalizeText([t.title, t.short, ...t.body, t.tip || ''].join(' '));
      if (!palavras.every((p) => todo.includes(p))) return null;
      return { t, peso: palavras.filter((p) => titulo.includes(p)).length };
    })
    .filter(Boolean)
    .sort((a, b) => b.peso - a.peso)
    .map((x) => x.t);
}
