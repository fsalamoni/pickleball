/**
 * A PASTA do filiado (Etapa 3): as leituras de uma pessoa ou entidade na
 * Central. Cada fonte só consulta com a PERMISSÃO que a regra exige — sem ela
 * a fonte volta `permitido: false` e a tela diz quem vê aquilo, em vez de uma
 * consulta recusada virar "não carregou". As chaves moram sob
 * `['federacoes', …]`: a mutação geral (`useFederationMutation`) as renova.
 */
import { useQuery } from '@tanstack/react-query';
import * as svc from '../services/federationService';
import { getRefereeEntry, listPersonAssignments } from '../services/refereesService';
import { FED_PERMISSION } from '../domain/constants.js';
import { fedModuleOn } from '../domain/federation.js';
import { isOrgMember } from '../domain/memberTypes.js';

const chave = (fedId, id, parte) => ['federacoes', 'federacao', fedId, 'pasta', id, parte];

function useFonte(fedId, id, parte, permitido, fn) {
  const ok = Boolean(permitido);
  const q = useQuery({ queryKey: chave(fedId, id, parte), queryFn: fn, enabled: Boolean(fedId && id) && ok });
  return { permitido: ok, data: q.data, isLoading: ok && q.isLoading, isError: q.isError, refetch: q.refetch };
}

/**
 * @param {object} federation
 * @param {object|null} member a filiação aberta na pasta
 * @param {string[]} perms permissões de quem vê
 * @returns {Record<string, { permitido: boolean, data: any, isLoading: boolean, isError: boolean, refetch: Function }>}
 */
export function useMemberFolder(federation, member, perms = []) {
  const fedId = federation?.id;
  const pode = (...ps) => ps.some((p) => perms.includes(p)) || perms.includes(FED_PERMISSION.ADMIN);
  const uid = member?.user_id || null;
  const org = isOrgMember(member);
  const id = member?.id;
  const pessoa = !org && Boolean(uid);
  const cursos = pessoa && fedModuleOn(federation, 'courses');
  const arbitragem = pessoa && fedModuleOn(federation, 'referees') && pode(FED_PERMISSION.COURSES);
  return {
    cobrancas: useFonte(fedId, id, 'cobrancas', pode(FED_PERMISSION.FINANCE, FED_PERMISSION.MEMBERS, FED_PERMISSION.FISCAL), () => svc.listMemberCharges(fedId, id)),
    sancoes: useFonte(fedId, id, 'sancoes', pode(FED_PERMISSION.DISCIPLINE), () => svc.listMemberSanctions(fedId, id)),
    inscricoes: useFonte(fedId, id, 'cursos', cursos && pode(FED_PERMISSION.COURSES, FED_PERMISSION.FINANCE), () => svc.listPersonEnrollments(fedId, uid)),
    credenciais: useFonte(fedId, id, 'credenciais', cursos && pode(FED_PERMISSION.COURSES), () => svc.listPersonCredentials(fedId, uid)),
    // Os pontos são públicos, como o ranking: qualquer pessoa da equipe vê.
    pontos: useFonte(fedId, id, 'pontos', pessoa && fedModuleOn(federation, 'ranking'), () => svc.listPersonPoints(fedId, uid)),
    quadro: useFonte(fedId, id, 'quadro', arbitragem, () => getRefereeEntry(fedId, uid)),
    escalas: useFonte(fedId, id, 'escalas', arbitragem, () => listPersonAssignments(fedId, uid)),
    pessoas: useFonte(fedId, id, 'pessoas', org, () => svc.listOrgPeople(member.org_kind, member.org_id)),
  };
}
