/**
 * O que a exportação de dados (LGPD) leva das FEDERAÇÕES. Cada parte falha
 * SOZINHA e vai para `incomplete` — nunca um arquivo "completo" com buraco.
 * O que é da FEDERAÇÃO (planos, equipe, filiados dos outros) fica com ela.
 */
import { listFederationsCreatedBy, listMyCharges, listMyMemberships, listMyStaffRoles } from './federationService.js';

/** @returns {Promise<{ federations: object, incomplete: string[] }>} */
export async function collectFederationExport(uid) {
  const partes = [
    ['memberships', 'Filiações em federações', () => listMyMemberships(uid)],
    ['charges', 'Cobranças de federações', () => listMyCharges(uid)],
    ['staff_roles', 'Papéis em equipes de federação', () => listMyStaffRoles(uid)],
    ['federations_created', 'Federações que você pediu para abrir', () => listFederationsCreatedBy(uid)],
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
