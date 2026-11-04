/**
 * Guarda: toda coleção do TREINO (e o que o professor publica) entra na
 * exclusão de conta — e o que é da pessoa entra na exportação dos dados.
 *
 * A exclusão (`functions/accountDeletion.js`) e a exportação
 * (`trainingExportService.js`) são listas escritas à mão. Coleção nova que
 * ninguém lembra de pôr nelas não dá erro: a conta é "excluída" com o diário
 * de treino no banco, ou a exportação sai "completa" sem ele. Este teste lê o
 * `firestore.rules` e reprova a coleção que ficou de fora — isenção só com
 * motivo escrito.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

const require = createRequire(import.meta.url);
const exclusao = require('../../../functions/accountDeletion.js');

const REGRAS = readFileSync('firestore.rules', 'utf8');
const EXPORTA_ARQ = 'src/modules/training/services/trainingExportService.js';
const EXPORTA = readFileSync(EXPORTA_ARQ, 'utf8');

/** Coleções de topo vigiadas: todo `training_*` do rules + as do professor. */
const DO_TREINO = [...REGRAS.matchAll(/^\s{4}match \/(training_[a-z_]+)\//gm)].map((m) => m[1]);
const DO_PROFESSOR = ['coach_content', 'coach_packages', 'coach_products'];

/**
 * Como cada coleção chega à exportação: a função que a lê, importada pelo
 * serviço da exportação, num arquivo que cita a coleção. Coleção nova do
 * treino sem linha aqui reprova.
 */
const EXPORTADA_POR = {
  training_items: ['listMyItems'],
  training_sessions: ['listMySessions', 'listComments'],
  training_plans: ['listMyPlans'],
  training_debriefs: ['listMyDebriefs'],
  training_meta: ['getMeta'],
  training_shares: ['listSent', 'listInbox'],
  training_questions: ['listMyQuestions', 'listCoachQuestions', 'listMessages'],
  training_reports: ['listMyReports'],
  player_goals: ['listGoals'],
};

/** Fica fora da exportação de propósito — sempre com o motivo. */
const FORA_DA_EXPORTACAO = {
  // vazio: tudo o que é do treino é exportado.
};

function colecoesDaExclusao() {
  const cols = new Set();
  const de = (lista) => lista.forEach((s) => {
    if (s.col) cols.add(s.col);
    (s.cols || []).forEach((c) => cols.add(c));
  });
  de(exclusao.DELETE_BY_ID);
  de(exclusao.DELETE_BY_QUERY);
  de(exclusao.RETAINED_AS_IS);
  de(exclusao.PSEUDO_SPECS);
  return cols;
}

/** Arquivo de onde o serviço da exportação importa `nome`. */
function arquivoDe(nome) {
  const imp = [...EXPORTA.matchAll(/import\s*\{([^}]+)\}\s*from\s*'([^']+)'/g)]
    .find((m) => m[1].split(',').map((s) => s.trim()).includes(nome));
  if (!imp) return null;
  const caminho = imp[2].startsWith('@/')
    ? resolve('src', imp[2].slice(2))
    : resolve(dirname(EXPORTA_ARQ), imp[2]);
  return caminho.endsWith('.js') ? caminho : `${caminho}.js`;
}

describe('a exclusão e a exportação cobrem o treino', () => {
  it('o rules tem as coleções do treino (o guarda está lendo o arquivo certo)', () => {
    expect(DO_TREINO).toEqual(expect.arrayContaining(['training_items', 'training_sessions', 'training_questions']));
  });

  it('⭐ toda coleção do treino e do professor entra na exclusão de conta', () => {
    const cobre = colecoesDaExclusao();
    const faltam = [...DO_TREINO, ...DO_PROFESSOR, 'player_goals'].filter((c) => !cobre.has(c));
    expect(faltam, 'coleção sem tratamento na exclusão de conta').toEqual([]);
  });

  it('⭐ toda coleção do treino tem caminho para a exportação (ou isenção com motivo)', () => {
    const faltam = DO_TREINO.filter((c) => !EXPORTADA_POR[c] && !FORA_DA_EXPORTACAO[c]);
    expect(faltam, 'coleção do treino fora da exportação').toEqual([]);
    Object.values(FORA_DA_EXPORTACAO).forEach((motivo) => expect(String(motivo).length).toBeGreaterThan(20));
  });

  it('⭐ a função declarada é importada pela exportação e lê de fato a coleção', () => {
    Object.entries(EXPORTADA_POR).forEach(([col, funcoes]) => funcoes.forEach((fn) => {
      const arq = arquivoDe(fn);
      expect(arq, `${fn} não é importada por ${EXPORTA_ARQ}`).toBeTruthy();
      expect(readFileSync(arq, 'utf8'), `${fn} (${arq}) não cita '${col}'`).toContain(`'${col}'`);
    }));
  });

  it('o envio de fotos e vídeos sai junto: prefixo do Storage na exclusão e lista na exportação', () => {
    expect(exclusao.STORAGE_PREFIXES.map((f) => f('u1'))).toContain('treino/u1/');
    expect(arquivoDe('listMyUploadPaths')).toBeTruthy();
  });
});

/* ------------------------------------------------------------- Mercado -- */

const DO_MERCADO = [...REGRAS.matchAll(/^\s{4}match \/(market_[a-z_]+)\//gm)].map((m) => m[1]);
const EXPORTA_MERCADO_ARQ = 'src/modules/marketplace/services/marketExportService.js';
const EXPORTA_MERCADO = readFileSync(EXPORTA_MERCADO_ARQ, 'utf8');
/** Como cada coleção do Mercado chega à exportação (a função lida pelo serviço). */
const MERCADO_EXPORTADO_POR = {
  market_sellers: ['getSeller', 'getSellerPrivate'],
  market_listings: ['listSellerListings'],
  market_questions: ['listMyQuestions'],
  market_favorites: ['listMyFavorites'],
  market_follows: ['listMyFollows'],
  market_addresses: ['getMyAddresses'],
  market_saved_searches: ['listSavedSearches'],
  market_carts: ['getCart'],
  market_offers: ['listMyOffers'],
  market_orders: ['listMyOrders', 'listSellerOrders'],
  market_reviews: ['listMyReviews'],
  market_coupons: ['listSellerCoupons'],
  market_gift_cards: ['listMyGiftCards'],
};
const MERCADO_FORA_DA_EXPORTACAO = {
  market_disputes: 'A disputa é do pedido e não guarda nada que o pedido exportado já não diga; a decisão é da moderação.',
  market_reports: 'A denúncia é sobre o anúncio de outra pessoa e serve à moderação; não guarda dado pessoal de quem denunciou além do uid.',
};

describe('a exclusão e a exportação cobrem o Mercado', () => {
  it('o rules tem as coleções do Mercado', () => {
    expect(DO_MERCADO).toEqual(expect.arrayContaining(['market_sellers', 'market_orders', 'market_carts']));
  });

  it('⭐ toda coleção do Mercado entra na exclusão de conta', () => {
    const cobre = colecoesDaExclusao();
    expect(DO_MERCADO.filter((c) => !cobre.has(c)), 'coleção do Mercado sem tratamento na exclusão').toEqual([]);
    expect(exclusao.STORAGE_PREFIXES.map((f) => f('u1'))).toContain('mercado/u1/');
  });

  it('⭐ toda coleção do Mercado tem caminho para a exportação (ou isenção com motivo)', () => {
    expect(DO_MERCADO.filter((c) => !MERCADO_EXPORTADO_POR[c] && !MERCADO_FORA_DA_EXPORTACAO[c])).toEqual([]);
    Object.entries(MERCADO_EXPORTADO_POR).forEach(([col, fns]) => fns.forEach((fn) => {
      expect(EXPORTA_MERCADO, `${fn} não é usada pela exportação do Mercado`).toMatch(new RegExp(`\\b${fn}\\b`));
      const arq = ['marketService.js', 'marketOrderService.js'].map((f) => `src/modules/marketplace/services/${f}`)
        .find((f) => new RegExp(`export async function ${fn}\\b`).test(readFileSync(f, 'utf8')));
      expect(arq, `${fn} não está nos serviços do Mercado`).toBeTruthy();
    }));
  });
});

/* ------------------------------------------- avisos por e-mail e celular -- */

const DAS_MENSAGENS = [...REGRAS.matchAll(/^\s{4}match \/((?:message_[a-z_]+)|phone_verifications)\//gm)].map((m) => m[1]);
const MENSAGENS_EXPORTADAS_POR = {
  message_outbox: ['listMyMessageLog'],
};
const MENSAGENS_FORA_DA_EXPORTACAO = {
  message_suppressions: 'É o bloqueio de um ENDEREÇO (devolução, spam, PARAR), guardado pelo resumo do endereço; a exclusão apaga o endereço e a lista de contas.',
  message_reports: 'A denúncia serve à moderação; quem denunciou fica só pelo uid, como nas denúncias do Mercado.',
  phone_verifications: 'O código em andamento vale 10 minutos e é apagado ao confirmar; o número confirmado já sai no perfil exportado.',
};

describe('a exclusão e a exportação cobrem os avisos por e-mail e celular', () => {
  it('o rules tem as coleções das mensagens', () => {
    expect(DAS_MENSAGENS).toEqual(expect.arrayContaining(['message_outbox', 'message_suppressions', 'message_reports', 'phone_verifications']));
  });

  it('⭐ toda coleção das mensagens entra na exclusão de conta', () => {
    const cobre = colecoesDaExclusao();
    expect(DAS_MENSAGENS.filter((c) => !cobre.has(c)), 'coleção das mensagens sem tratamento na exclusão').toEqual([]);
  });

  it('⭐ toda coleção das mensagens tem caminho para a exportação (ou isenção com motivo)', () => {
    expect(DAS_MENSAGENS.filter((c) => !MENSAGENS_EXPORTADAS_POR[c] && !MENSAGENS_FORA_DA_EXPORTACAO[c])).toEqual([]);
    const servico = readFileSync('src/modules/messaging/services/messagingService.js', 'utf8');
    const tela = readFileSync('src/v2/pages/V2Settings.jsx', 'utf8');
    Object.values(MENSAGENS_EXPORTADAS_POR).flat().forEach((fn) => {
      expect(servico).toMatch(new RegExp(`export async function ${fn}\\b`));
      expect(tela, `${fn} não é usada pela exportação`).toMatch(new RegExp(`\\b${fn}\\b`));
    });
  });
});

/* ---------------------------------------------------------- Federações -- */

const DAS_FEDERACOES = [...REGRAS.matchAll(/^\s{4}match \/((?:federation_[a-z_]+)|federations)\//gm)].map((m) => m[1]);
const EXPORTA_FED_ARQ = 'src/modules/federations/services/federationExportService.js';
const EXPORTA_FED = readFileSync(EXPORTA_FED_ARQ, 'utf8');
/** Como cada coleção da federação chega à exportação (a função lida pelo serviço). */
const FEDERACOES_EXPORTADAS_POR = {
  federations: ['listFederationsCreatedBy'],
  federation_staff: ['listMyStaffRoles'],
  federation_members: ['listMyMemberships'],
  federation_charges: ['listMyCharges'],
  federation_affiliations: ['listAffiliationsRequestedBy'],
  federation_results: ['listResultsWith'],
  federation_points: ['listMyFederationPoints'],
  federation_transfers: ['listMyTransfers'],
  federation_documents_submitted: ['listMyDocuments'],
  federation_course_enrollments: ['listMyEnrollments'],
  federation_credentials: ['listMyCredentials'],
  federation_sanctions: ['listMySanctions'],
  federation_incidents: ['listMyIncidents'],
  federation_final_invites: ['listMyFinalInvites'],
  federation_callup_members: ['listMyCallupInvites'],
  federation_grant_applications: ['listMyGrantApplications'],
  federation_tournament_reports: ['listMyDirectedReports'],
  federation_reports: ['listMyReports'],
  federation_followers: ['listMyAcervoFollows'],
  federation_invites: ['listMyFederationInvites'],
  federation_comments: ['listMyFederationComments'],
  federation_referees: ['listMyRefereeRosters'],
  federation_assignments: ['listMyAssignments'],
  federation_coach_licenses: ['listMyCoachLicenses'],
  federation_safeguarding: ['listMySafeguarding'],
  federation_ambassadors: ['listMyAmbassadorships'],
  federation_adapted_classifications: ['listMyAdaptedClassifications'],
  federation_cup_teams: ['listMyCupTeams'],
  federation_election_voters: ['listMyElectionVoters'],
  federation_candidacies: ['listMyCandidacies'],
  federation_election_endorsements: ['listMyElectionEndorsements'],
};
const FEDERACOES_FORA_DA_EXPORTACAO = {
  federation_plans: 'O plano é da federação (nome, preço, regras), não da pessoa; a filiação exportada já diz o plano escolhido.',
  federation_card_index: 'É só o índice código → filiação para a verificação pública; o código já sai na filiação exportada.',
  federation_rankings: 'Soma anual derivada dos lançamentos de pontos (só o servidor grava) e pública; os pontos da pessoa já saem nos lançamentos exportados.',
  federation_courses: 'O curso é da federação (nome, datas, preço); a inscrição exportada já diz o curso e o resultado.',
  federation_imports: 'Relatório da secretaria: e-mails de quem ainda não tem conta; a pessoa importada já aparece na filiação exportada.',
  federation_news: 'A notícia é da federação (título, texto, público), não da pessoa; quem escreveu é só o uid de equipe.',
  federation_docs: 'O documento do acervo é ato oficial da federação (estatuto, resolução, ata), não dado da pessoa; quem preparou é só o uid de equipe.',
  federation_events: 'O evento é da agenda oficial da federação (data, local, órgão), não dado da pessoa; quem marcou é só o uid de equipe.',
  federation_comment_reports: 'A denúncia é sobre o comentário de outra pessoa e serve à moderação; guarda só o motivo e o uid de quem denunciou.',
  federation_budgets: 'O orçamento é da federação (valores por categoria, aprovação), não da pessoa; quem criou é só o uid de equipe.',
  federation_ledger: 'O lançamento é da contabilidade da federação (receita, despesa, comprovante), não dado da pessoa; quem lançou é só o uid de equipe.',
  federation_national_links: 'O vínculo nacional é entre duas federações (pedido, convite, aprovação), não dado da pessoa; quem agiu é só o uid de equipe.',
  federation_repasses: 'O repasse da cobrança dividida é entre a federação e o clube ou a confederação (valor, porcentagem, data), sem o nome de quem pagou; não é dado da pessoa.',
  federation_dues: 'A anuidade é repasse entre a federação estadual e a confederação (valor, vencimento, pagamento), não dado da pessoa.',
  federation_sponsor_contracts: 'O contrato de patrocínio é da federação com uma empresa (vigência, parcelas, contrapartidas), não dado da pessoa; quem lançou é só o uid de equipe.',
  federation_equipment: 'O equipamento (marca, modelo, situação) é da lista pública de homologação da federação, não dado da pessoa; quem cadastrou é só o uid de equipe.',
  federation_certificates: 'A certidão negativa é da própria federação (CND, FGTS, CNDT), não dado da pessoa; quem anexou é só o uid de equipe.',
  federation_club_seals: 'O pedido de selo é do clube ou da arena (evidências da organização); quem pediu é só o uid de quem a gere, guardado para o histórico.',
  federation_host_bids: 'O edital de sede é da federação (evento, critérios, resultado público sem uid); quem o criou é só o uid de equipe.',
  federation_insurance_certificates: 'O certificado de seguro do evento é do clube ou da arena; quem pediu é só o uid de quem a gere, guardado para o histórico.',
  federation_host_entries: 'A candidatura a sede é do clube ou da arena (carta e proposta da organização); quem mandou é só o uid de quem a gere.',
  federation_host_scores: 'A nota da comissão é ato da federação sobre a proposta de uma organização; o avaliador é só o uid de equipe.',
  federation_cups: 'A Copa das Federações é da confederação; a lista pública dos elencos não tem uid e perde o nome na exclusão de conta.',
  federation_incentive_projects: 'O projeto da Lei de Incentivo é da federação; os aportes são de empresas e doadores (nome e documento do apoiador, como no recibo fiscal); quem lançou é só o uid de equipe.',
  federation_assets: 'O bem é do patrimônio da federação, emprestado a clube, arena ou evento (nunca a uma pessoa); quem emprestou é só o uid de equipe.',
  federation_account_reports: 'A prestação de contas é da federação (totais, parecer, assembleia), não dado da pessoa; quem abriu é só o uid de equipe.',
  federation_elections: 'O edital é ato da federação (cargos, calendário, pesos), não dado da pessoa; a participação dela sai como eleitor e nas chapas.',
  federation_ballots: 'A cédula é SECRETA e não tem uid: não há como ligá-la a ninguém, e por isso ela não sai na exportação.',
  federation_callups: 'A convocação é ato da federação (campeonato, critério, custos), não da pessoa; a lista pública só leva nomes e o convite exportado já diz a convocação.',
  federation_grants: 'O edital é ato da federação (regras, vagas, resultado); a inscrição exportada já diz o edital, a decisão e o pagamento.',
  federation_coach_badges: 'O selo é uma cópia pública e derivada das licenças válidas (só o servidor grava); a licença exportada já diz nível e validade.',
  federation_admin_grants: 'Acesso de suporte do admin da plataforma a uma federação: registro interno e temporário (até 8 h), não é dado do titular.',
};

describe('a exclusão e a exportação cobrem as federações', () => {
  it('o rules tem as coleções das federações', () => {
    expect(DAS_FEDERACOES).toEqual(expect.arrayContaining(['federations', 'federation_staff', 'federation_members', 'federation_charges', 'federation_card_index']));
  });

  it('⭐ toda coleção das federações entra na exclusão de conta', () => {
    const cobre = colecoesDaExclusao();
    expect(DAS_FEDERACOES.filter((c) => !cobre.has(c)), 'coleção da federação sem tratamento na exclusão').toEqual([]);
  });

  it('⭐ toda coleção das federações tem caminho para a exportação (ou isenção com motivo)', () => {
    expect(DAS_FEDERACOES.filter((c) => !FEDERACOES_EXPORTADAS_POR[c] && !FEDERACOES_FORA_DA_EXPORTACAO[c])).toEqual([]);
    Object.values(FEDERACOES_FORA_DA_EXPORTACAO).forEach((motivo) => expect(String(motivo).length).toBeGreaterThan(20));
    const servico = readFileSync('src/modules/federations/services/federationService.js', 'utf8');
    const constantes = readFileSync('src/modules/federations/domain/constants.js', 'utf8');
    const tela = readFileSync('src/v2/pages/V2Settings.jsx', 'utf8');
    expect(tela, 'a exportação da conta não chama collectFederationExport').toMatch(/\bcollectFederationExport\b/);
    Object.entries(FEDERACOES_EXPORTADAS_POR).forEach(([col, fns]) => fns.forEach((fn) => {
      expect(EXPORTA_FED, `${fn} não é usada pela exportação das federações`).toMatch(new RegExp(`\\b${fn}\\b`));
      expect(servico, `${fn} não está no serviço das federações`).toMatch(new RegExp(`export (async )?(function|const) ${fn}\\b`));
      expect(constantes, `FED_COLLECTIONS não cita '${col}'`).toContain(`'${col}'`);
    }));
  });
});

/* ----------------------------------------------------- Minha carreira -- */

const DA_CARREIRA = [...REGRAS.matchAll(/^\s{4}match \/(career_[a-z_]+)\//gm)].map((m) => m[1]);
const EXPORTA_CARREIRA_ARQ = 'src/modules/career/services/careerExportService.js';
const EXPORTA_CARREIRA = readFileSync(EXPORTA_CARREIRA_ARQ, 'utf8');
/** Como cada coleção da carreira chega à exportação (a função lida pelo serviço). */
const CARREIRA_EXPORTADA_POR = {
  career_events: ['listCareerEvents'],
};
const CARREIRA_FORA_DA_EXPORTACAO = {
  // vazio: tudo o que é da carreira é exportado.
};

describe('a exclusão e a exportação cobrem a Minha carreira', () => {
  it('o rules tem as coleções da carreira', () => {
    expect(DA_CARREIRA).toEqual(expect.arrayContaining(['career_events']));
  });

  it('⭐ toda coleção `career_*` entra na exclusão de conta, e as fotos também', () => {
    const cobre = colecoesDaExclusao();
    expect(DA_CARREIRA.filter((c) => !cobre.has(c)), 'coleção da carreira sem tratamento na exclusão').toEqual([]);
    expect(exclusao.STORAGE_PREFIXES.map((f) => f('u1'))).toContain('carreira/u1/');
  });

  it('⭐ toda coleção `career_*` tem caminho para a exportação (ou isenção com motivo), e a lista das fotos vai junto', () => {
    expect(DA_CARREIRA.filter((c) => !CARREIRA_EXPORTADA_POR[c] && !CARREIRA_FORA_DA_EXPORTACAO[c])).toEqual([]);
    const servico = readFileSync('src/modules/career/services/careerService.js', 'utf8');
    const tela = readFileSync('src/v2/pages/V2Settings.jsx', 'utf8');
    expect(tela, 'a exportação da conta não chama collectCareerExport').toMatch(/\bcollectCareerExport\b/);
    expect(EXPORTA_CARREIRA).toMatch(/\blistMyCareerPhotoPaths\b/);
    Object.entries(CARREIRA_EXPORTADA_POR).forEach(([col, fns]) => fns.forEach((fn) => {
      expect(EXPORTA_CARREIRA, `${fn} não é usada pela exportação da carreira`).toMatch(new RegExp(`\\b${fn}\\b`));
      expect(servico, `${fn} não está no serviço da carreira`).toMatch(new RegExp(`export async function ${fn}\\b`));
      expect(servico + readFileSync('src/modules/career/domain/careerEvent.js', 'utf8'), `o serviço não cita '${col}'`).toContain(`'${col}'`);
    }));
  });
});

/* -------------------------------------------------------- Gamificação -- */

/**
 * PR 0b da carreira: onze coleções da gamificação (concessões de XP, cartas,
 * avaliações, reputação, preferências, Hall da Fama, sinais, integridade e
 * moderação) não estavam na exclusão de conta, e nenhuma ia na exportação.
 * O guarda vigia os PREFIXOS da família — coleção nova com o mesmo nome de
 * família sem tratamento reprova.
 */
/**
 * Coleção `user_*` que NÃO é da gamificação (o prefixo é largo): ponha aqui,
 * com o motivo, e ela sai deste bloco — mas continua precisando entrar na
 * exclusão e na exportação pelo caminho do próprio módulo.
 */
const USER_FORA_DA_GAMIFICACAO = {
  // vazio: hoje todo `user_*` do rules é da gamificação.
};
const DA_GAMIFICACAO = [...REGRAS.matchAll(
  /^\s{4}match \/((?:user_[a-z0-9_]+)|(?:gamification_[a-z_]+)|(?:partner_letter[a-z_]*)|match_reviews|hall_of_fame|challenge_entries|duels|reward_claims)\//gm,
)].map((m) => m[1]).filter((c) => !USER_FORA_DA_GAMIFICACAO[c]);
const EXPORTA_GAMIF_ARQ = 'src/modules/progression/services/gamificationExportService.js';
const EXPORTA_GAMIF = readFileSync(EXPORTA_GAMIF_ARQ, 'utf8');
/** Como cada coleção da gamificação chega à exportação (a função lida pelo serviço). */
const GAMIFICACAO_EXPORTADA_POR = {
  user_progression_v2: ['getUserProgressionV2'],
  user_missions: ['listUserMissions'],
  user_achievements_v2: ['listUserAchievementsV2'],
  user_streak_meta: ['getStreakMeta'],
  user_xp_grants: ['listXpGrants'],
  user_gamification_prefs: ['getGamificationPrefs'],
  user_referral_codes: ['getReferralCode'],
  user_referrals: ['listReferralsByReferrer', 'getReferralForReferee'],
  user_kudos: ['listKudosReceivedBy', 'listKudosGivenBy'],
  user_kudos_index: ['getKudoIndex'],
  user_rivals: ['listRivalsFor'],
  match_reviews: ['listMyReviews'],
  user_reputation: ['getReputation'],
  user_reputation_private: ['getMyPrivateReputation'],
  partner_letters: ['listReceivedLetters'],
  partner_letter_authors: ['listSentLetters'],
  hall_of_fame: ['fetchMyHallRow'],
  challenge_entries: ['listMyEntries'],
  duels: ['listMyDuels'],
  reward_claims: ['listMyClaims'],
};
const GAMIFICACAO_FORA_DA_EXPORTACAO = {
  gamification_flags: 'Sinal de integridade que o servidor abre para o admin revisar; a regra não deixa a pessoa ler, e ele não guarda nada que ela forneceu.',
  gamification_integrity: 'Fotografia do XP que só o servidor lê para medir o salto; o XP em si já sai na progressão exportada.',
  gamification_moderation: 'Decisão do admin sobre a conta (só o admin lê); o histórico fica na auditoria.',
  gamification_metrics: 'Retrato diário agregado do funil (contagens da plataforma), sem uid de ninguém.',
  gamification_challenges: 'O desafio é do emissor (texto, regras, prêmios); a participação da pessoa já sai nas entradas exportadas.',
  gamification_rewards: 'A recompensa é do emissor (título, regras, estoque); o pedido da pessoa já sai exportado.',
  gamification_goals: 'Metas do mês do painel de engajamento do professor, da arena ou do clube: são números do negócio, não dado pessoal.',
};
/** Fica fora da EXCLUSÃO de propósito (não há o que achar pela pessoa) — sempre com o motivo. */
const GAMIFICACAO_FORA_DA_EXCLUSAO = {
  gamification_metrics: 'Retrato diário agregado (contagens), sem uid nem nome de ninguém: não há documento da pessoa para apagar.',
};

describe('a exclusão e a exportação cobrem a gamificação', () => {
  it('o rules tem as coleções da gamificação', () => {
    expect(DA_GAMIFICACAO).toEqual(expect.arrayContaining(['user_xp_grants', 'partner_letters', 'match_reviews', 'hall_of_fame', 'gamification_flags']));
  });

  it('⭐ toda coleção da gamificação entra na exclusão de conta', () => {
    const cobre = colecoesDaExclusao();
    expect(DA_GAMIFICACAO.filter((c) => !cobre.has(c) && !GAMIFICACAO_FORA_DA_EXCLUSAO[c]), 'coleção da gamificação sem tratamento na exclusão').toEqual([]);
    Object.keys(GAMIFICACAO_FORA_DA_EXCLUSAO).forEach((c) => expect(cobre.has(c), `${c} está isenta e tratada ao mesmo tempo`).toBe(false));
  });

  it('⭐ toda coleção da gamificação tem caminho para a exportação (ou isenção com motivo)', () => {
    expect(DA_GAMIFICACAO.filter((c) => !GAMIFICACAO_EXPORTADA_POR[c] && !GAMIFICACAO_FORA_DA_EXPORTACAO[c])).toEqual([]);
    Object.values(GAMIFICACAO_FORA_DA_EXPORTACAO).forEach((motivo) => expect(String(motivo).length).toBeGreaterThan(20));
    const tela = readFileSync('src/v2/pages/V2Settings.jsx', 'utf8');
    expect(tela, 'a exportação da conta não chama collectGamificationExport').toMatch(/\bcollectGamificationExport\b/);
    const servicos = ['src/modules/progression/services', 'src/modules/achievements/services'].flatMap((dir) => (
      readdirSync(dir).filter((f) => f.endsWith('.js') && !f.includes('.test.')).map((f) => readFileSync(`${dir}/${f}`, 'utf8'))
    )).join('\n');
    Object.values(GAMIFICACAO_EXPORTADA_POR).flat().forEach((fn) => {
      expect(EXPORTA_GAMIF, `${fn} não é usada pela exportação da gamificação`).toMatch(new RegExp(`\\b${fn}\\(`));
      expect(servicos, `${fn} não está nos serviços da gamificação`).toMatch(new RegExp(`export async function ${fn}\\b`));
    });
  });
});
