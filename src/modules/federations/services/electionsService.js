/**
 * ELEIÇÕES — leituras. Toda escrita é do servidor (`electionAction`, em
 * `federationService.js`). Cada consulta filtra pelos campos que a REGRA
 * confere (`federation_id` em igualdade, `public`, `commission_uids`,
 * `user_id`), senão o Firestore recusa a consulta inteira.
 */
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { FED_COLLECTIONS as C } from '../domain/constants.js';

const toDoc = (d) => ({ id: d.id, ...d.data() });
const lista = async (...filtros) => (await getDocs(query(...filtros))).docs.map(toDoc);
const recentes = (xs) => [...xs].sort((a, b) => (b.created_at_ms || 0) - (a.created_at_ms || 0));

/** As eleições publicadas (página pública e área do filiado). */
export async function listPublicElections(fedId) {
  if (!db || !fedId) return [];
  return recentes(await lista(collection(db, C.elections), where('federation_id', '==', fedId), where('public', '==', true)));
}

/** Todas as eleições da federação, rascunhos inclusive (só o admin lê). */
export async function listFederationElections(fedId) {
  if (!db || !fedId) return [];
  return recentes(await lista(collection(db, C.elections), where('federation_id', '==', fedId)));
}

/** As eleições em que a pessoa está na comissão eleitoral. */
export async function listMyCommissionElections(uid) {
  if (!db || !uid) return [];
  return recentes(await lista(collection(db, C.elections), where('commission_uids', 'array-contains', uid)));
}

/** As chapas de uma eleição: as aceitas para todos; `all` (comissão/admin) traz todas. */
export async function listElectionCandidacies(fedId, electionId, { all = false } = {}) {
  if (!db || !fedId || !electionId) return [];
  const filtros = [where('federation_id', '==', fedId), where('election_id', '==', electionId)];
  if (!all) filtros.push(where('public', '==', true));
  const xs = await lista(collection(db, C.candidacies), ...filtros);
  return xs.sort((a, b) => (a.submitted_at_ms || 0) - (b.submitted_at_ms || 0));
}

/** Todas as chapas da federação (a faixa "Precisa de você" do admin). */
export async function listFederationCandidacies(fedId) {
  if (!db || !fedId) return [];
  return lista(collection(db, C.candidacies), where('federation_id', '==', fedId));
}

/** O colégio congelado (só a comissão lê): quem votou, nunca em quem. */
export async function listElectionVoters(fedId, electionId) {
  if (!db || !fedId || !electionId) return [];
  const xs = await lista(collection(db, C.electionVoters), where('federation_id', '==', fedId), where('election_id', '==', electionId));
  return xs.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));
}
