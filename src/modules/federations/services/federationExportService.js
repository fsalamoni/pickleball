/**
 * O que a exportação de dados (LGPD) leva das FEDERAÇÕES. Cada parte falha
 * SOZINHA e vai para `incomplete` — nunca um arquivo "completo" com buraco.
 * O que é da FEDERAÇÃO (planos, equipe, filiados dos outros) fica com ela.
 */
import {
  listAffiliationsRequestedBy, listFederationsCreatedBy, listMyAcervoFollows, listMyCharges, listMyFederationComments, listMyFederationInvites, listMyCredentials, listMyDependents, listMyDocuments, listMyEnrollments, listMyMemberships,
  listMyMembersPrivate, listMyAssignments, listMyRefereeRosters, listMyReports, listMySanctions, listMyStaffRoles, listMyTransfers, listResultsWith,
  listMyCandidacies, listMyElectionEndorsements, listMyElectionVoters,
} from './federationService.js';

/** @returns {Promise<{ federations: object, incomplete: string[] }>} */
export async function collectFederationExport(uid) {
  const partes = [
    ['memberships', 'Filiações em federações', () => listMyMemberships(uid)],
    ['charges', 'Cobranças de federações', () => listMyCharges(uid)],
    ['staff_roles', 'Papéis em equipes de federação', () => listMyStaffRoles(uid)],
    ['federations_created', 'Federações que você pediu para abrir', () => listFederationsCreatedBy(uid)],
    ['affiliation_requests', 'Pedidos de filiação de clube/arena que você fez', () => listAffiliationsRequestedBy(uid)],
    ['official_results', 'Resultados enviados ao ranking oficial em que você aparece', () => listResultsWith(uid)],
    ['dependents', 'Dependentes que você filiou', () => listMyDependents(uid)],
    ['members_private', 'Dados pessoais guardados nas filiações (CPF, nascimento, responsável)', () => listMyMembersPrivate(uid)],
    ['documents', 'Documentos que você enviou a federações (registro; o arquivo fica na sua pasta)', () => listMyDocuments(uid)],
    ['transfers', 'Transferências de clube ou federação', () => listMyTransfers(uid)],
    ['course_enrollments', 'Inscrições em cursos de federação', () => listMyEnrollments(uid)],
    ['credentials', 'Credenciais emitidas por federações', () => listMyCredentials(uid)],
    ['sanctions', 'Sanções disciplinares (suas e dos dependentes)', () => listMySanctions(uid)],
    ['reports', 'Manifestações identificadas na ouvidoria', () => listMyReports(uid)],
    ['acervo_follows', 'Acervos de federação que você segue', () => listMyAcervoFollows(uid)],
    ['invites', 'Convites para filiar que você recebeu', () => listMyFederationInvites(uid)],
    ['comments', 'Seus comentários em documentos e eventos de federação', () => listMyFederationComments(uid)],
    ['referee_rosters', 'Seu cadastro nos quadros de arbitragem', () => listMyRefereeRosters(uid)],
    ['referee_assignments', 'Suas escalas de arbitragem (convocações, súmulas, avaliações e diárias)', () => listMyAssignments(uid)],
    ['election_voters', 'Eleições em que você está no colégio eleitoral (se votou — nunca em quem: o voto é secreto)', () => listMyElectionVoters(uid)],
    ['candidacies', 'Chapas eleitorais de que você faz parte', () => listMyCandidacies(uid)],
    ['election_endorsements', 'Apoios que você deu a chapas eleitorais', () => listMyElectionEndorsements(uid)],
  ];
  const lidas = await Promise.allSettled(partes.map(([, , ler]) => ler()));
  const federations = {};
  const incomplete = [];
  partes.forEach(([chave, rotulo], i) => {
    if (lidas[i].status === 'fulfilled') federations[chave] = lidas[i].value;
    else incomplete.push(rotulo);
  });
  return { federations, incomplete };
}
