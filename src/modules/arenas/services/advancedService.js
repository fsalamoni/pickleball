/**
 * Service: IoT + Multi-Unit + White Label + AI (Arena V3 — sprints 8-11).
 *
 * Consolidado para otimizar contexto. Cada sprint tem sua função.
 */

import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp, limit,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { logger } from '@/core/lib/logger';
import { createAuditLog } from '@/core/services/auditService';
import { normalizeDeviceInput, calculateDynamicPrice, aggregateNetworkStats, forecastDemand } from '../domain/arenaV3Advanced.js';
import { normalizeBranding } from '../domain/whiteLabel.js';

const COL_DEVICES = 'arena_devices';
const COL_NETWORKS = 'arena_networks';
const COL_NETWORK_MEMBERSHIPS = 'arena_network_memberships';

/* --------------------- IoT Devices --------------------- */

export async function listArenaDevices(arenaId, { lim = 50 } = {}) {
  if (!db || !arenaId) return [];
  const snap = await getDocs(query(collection(db, COL_DEVICES), where('arena_id', '==', arenaId), orderBy('name', 'asc'), limit(lim)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createDevice(arenaId, input, actor) {
  if (!arenaId) throw new Error('arenaId obrigatório.');
  const { valid, errors, value } = normalizeDeviceInput(input);
  if (!valid) throw new Error(Object.values(errors)[0] || 'Dados inválidos.');
  const id = doc(collection(db, COL_DEVICES)).id;
  await setDoc(doc(db, COL_DEVICES, id), {
    id, arena_id: arenaId, ...value, status: 'offline', last_seen: null, created_at: serverTimestamp(), updated_at: serverTimestamp(),
  });
  await createAuditLog({ action: 'arena_device_created', actor, details: { arena_id: arenaId, name: value.name } });
  return id;
}

export async function updateDeviceStatus(deviceId, status, actor) {
  if (!deviceId) return;
  await updateDoc(doc(db, COL_DEVICES, deviceId), {
    status,
    last_seen: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
}

/* --------------------- Multi-Unit (Network) --------------------- */

/**
 * As MINHAS redes.
 *
 * 🐞 `listNetworks()` listava **todas as redes da plataforma** para qualquer
 * conta autenticada, ordenadas por nome. Numa tela de gestão isso é o pior
 * dos dois mundos: mostra o negócio dos outros e não ajuda em nada quem só
 * quer ver a rede dele.
 *
 * Um `where` só (`owner_id`), ordenação em memória: sem índice composto.
 */
export async function listMyNetworks(uid) {
  if (!db || !uid) return [];
  const snap = await getDocs(query(collection(db, COL_NETWORKS), where('owner_id', '==', uid)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));
}

/** A rede de que ESTA arena faz parte, se houver. */
export async function getArenaNetwork(arenaId) {
  if (!db || !arenaId) return null;
  const snap = await getDocs(
    query(collection(db, COL_NETWORK_MEMBERSHIPS), where('arena_id', '==', arenaId)),
  );
  if (snap.empty) return null;
  const vinculo = snap.docs[0].data();
  const rede = await getDoc(doc(db, COL_NETWORKS, vinculo.network_id));
  return rede.exists() ? { id: rede.id, ...rede.data() } : null;
}

/**
 * Cria a rede desta arena.
 *
 * 🐞 A regra do Firestore só deixava o ADMIN DA PLATAFORMA escrever
 * `arena_networks`, e o módulo é oferecido à arena: ela ligava, abria a tela,
 * clicava e recebia permissão negada. A regra passou a aceitar o gestor —
 * dono da rede é quem a cria, e ele precisa gerir a arena fundadora.
 *
 * `owner_arena_id` é o que a regra confere; sem ele a criação é recusada.
 */
export async function createNetwork(name, arenaId, actor) {
  const nome = String(name || '').trim().slice(0, 80);
  if (!nome) throw new Error('Dê um nome à rede.');
  if (!arenaId) throw new Error('Informe a arena que funda a rede.');
  const id = doc(collection(db, COL_NETWORKS)).id;
  await setDoc(doc(db, COL_NETWORKS, id), {
    id,
    name: nome,
    owner_id: actor?.uid || null,
    owner_arena_id: arenaId,
    arenas: [arenaId],
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  // A arena fundadora entra na rede junto — uma rede vazia não tem sentido, e
  // deixar a inclusão para um segundo clique é o tipo de coisa que faz o
  // usuário achar que não funcionou.
  await setDoc(doc(db, COL_NETWORK_MEMBERSHIPS, `${id}_${arenaId}`), {
    id: `${id}_${arenaId}`, network_id: id, arena_id: arenaId, joined_at: serverTimestamp(),
  });
  await createAuditLog({
    action: 'arena_network_created', actor,
    details: { network_id: id, name: nome, arena_id: arenaId },
  });
  return id;
}

export async function addArenaToNetwork(networkId, arenaId, actor) {
  if (!networkId || !arenaId) return;
  const ref = doc(db, COL_NETWORKS, networkId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Rede não encontrada.');
  const atuais = snap.data().arenas || [];
  if (atuais.includes(arenaId)) return;

  // O vínculo vem ANTES da lista: é ele que a regra confere, e é ele que a
  // consulta usa. Se a atualização da lista falhar, sobra um vínculo válido —
  // ao contrário, sobraria uma unidade na lista sem vínculo nenhum.
  await setDoc(doc(db, COL_NETWORK_MEMBERSHIPS, `${networkId}_${arenaId}`), {
    id: `${networkId}_${arenaId}`, network_id: networkId, arena_id: arenaId, joined_at: serverTimestamp(),
  });
  await updateDoc(ref, { arenas: [...atuais, arenaId], updated_at: serverTimestamp() });
  await createAuditLog({
    action: 'arena_added_to_network', actor,
    details: { network_id: networkId, arena_id: arenaId },
  });
}

/** Tira uma unidade da rede. Direito de quem administra a unidade. */
export async function removeArenaFromNetwork(networkId, arenaId, actor) {
  if (!networkId || !arenaId) return;
  await deleteDoc(doc(db, COL_NETWORK_MEMBERSHIPS, `${networkId}_${arenaId}`)).catch(() => {});
  const ref = doc(db, COL_NETWORKS, networkId);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const atuais = (snap.data().arenas || []).filter((a) => a !== arenaId);
    await updateDoc(ref, { arenas: atuais, updated_at: serverTimestamp() }).catch(() => {});
  }
  await createAuditLog({
    action: 'arena_removed_from_network', actor,
    details: { network_id: networkId, arena_id: arenaId },
  });
}

/* --------------------- White Label --------------------- */

/**
 * Grava a marca da arena.
 *
 * 🐞 Antes escrevia em `arena_settings.branding`, e aquela coleção só o GESTOR
 * consegue ler — a cor e o logo nunca teriam como chegar à página pública nem
 * ao telão, por mais código de exibição que se escrevesse (e não havia
 * nenhum: o campo era gravado e nunca lido por nada).
 *
 * Agora vai para `arenas/{id}.branding`, campo opcional do documento da arena,
 * que é `allow read: if true`. **O que é público tem de estar onde o público
 * lê.**
 */
export async function updateBranding(arenaId, branding, actor) {
  if (!arenaId) return;
  const { valid, errors, value } = normalizeBranding(branding);
  if (!valid) throw new Error(Object.values(errors)[0] || 'Dados inválidos.');
  await setDoc(doc(db, 'arenas', arenaId), {
    branding: value, updated_at: serverTimestamp(),
  }, { merge: true });
  await createAuditLog({
    action: 'arena_branding_updated', actor,
    details: { arena_id: arenaId, cor: value.primary_color, tem_logo: Boolean(value.logo_url) },
  });
  return value;
}

/**
 * A marca que ficou gravada no lugar antigo (`arena_settings`).
 *
 * Existe só para a tela de gestão poder pré-preencher o formulário de quem já
 * tinha salvo antes — ninguém nunca viu esses valores em tela, mas jogá-los
 * fora seria fazer a arena digitar de novo. Só o gestor lê, que é quem abre
 * essa tela.
 */
export async function getLegacyBranding(arenaId) {
  if (!db || !arenaId) return null;
  try {
    const snap = await getDoc(doc(db, 'arena_settings', arenaId));
    return snap.exists() ? (snap.data()?.branding || null) : null;
  } catch {
    return null;
  }
}

/* --------------------- AI (forecasting) --------------------- */

/**
 * As reservas por dia, dos últimos `days` dias.
 *
 * 🐞 Esta função devolvia `return []` com o comentário "só para satisfazer a
 * interface". Ou seja: a previsão da IA era calculada sobre uma lista vazia e
 * dava **sempre zero**, e o preço sugerido não tinha histórico nenhum em que
 * se basear. O painel mostrava um número inventado com cara de análise.
 *
 * Agora lê as reservas de verdade. A data mora dentro de `slots` (vetor), o
 * que impede recortar no servidor — então o recorte é em memória, como no
 * resto do módulo.
 *
 * @param {string} arenaId
 * @param {number} days
 * @returns {Promise<Array<{ date: string, count: number, hours: number, revenue: number }>>}
 *   um item por dia COM movimento, do mais antigo para o mais novo
 */
export async function getHistoricalBookings(arenaId, days = 30) {
  if (!db || !arenaId) return [];
  const { listArenaBookings } = await import('./bookingService.js');
  const reservas = await listArenaBookings(arenaId).catch(() => []);

  const corte = new Date(Date.now() - Math.max(1, days) * 86_400_000);
  const p = (n) => String(n).padStart(2, '0');
  const corteISO = `${corte.getFullYear()}-${p(corte.getMonth() + 1)}-${p(corte.getDate())}`;
  const hojeISO = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  })();

  const porDia = new Map();
  reservas
    // Pedido recusado não é movimento: contar como demanda inflaria a
    // previsão com o que a arena nem aceitou.
    .filter((b) => ['confirmed', 'completed'].includes(b.status))
    .forEach((b) => {
      (b.slots || []).forEach((s) => {
        const data = s?.date;
        if (!data || data < corteISO || data > hojeISO) return;
        const atual = porDia.get(data) || { date: data, count: 0, hours: 0, revenue: 0 };
        atual.count += 1;
        atual.hours += 1;
        porDia.set(data, atual);
      });
      const dias = [...new Set((b.slots || []).map((s) => s?.date).filter(Boolean))];
      const porDiaValor = dias.length > 0 ? (Number(b.agreed_price ?? b.proposed_price) || 0) / dias.length : 0;
      dias.forEach((data) => {
        if (data < corteISO || data > hojeISO) return;
        const atual = porDia.get(data);
        if (atual) atual.revenue = Math.round((atual.revenue + porDiaValor) * 100) / 100;
      });
    });

  return [...porDia.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export { calculateDynamicPrice, aggregateNetworkStats, forecastDemand };
