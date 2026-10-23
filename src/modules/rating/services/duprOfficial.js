/**
 * DUPR OFICIAL — chamadas ao servidor (`duprIntegration`).
 *
 * As credenciais do parceiro e os tokens da pessoa ficam SÓ no servidor; aqui
 * trafega apenas o que o login do DUPR (SSO) entregou, uma vez, no vínculo.
 * Ver docs/51-DUPR.md.
 */
import { httpsCallable } from 'firebase/functions';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db, functions } from '@/core/config/firebase';
import { t } from '@/core/i18n';

async function chamar(action, payload = {}, timeout = 60_000) {
  if (!functions) throw new Error(t('Firebase não está configurado neste ambiente.'));
  try {
    const { data } = await httpsCallable(functions, 'duprIntegration', { timeout })({ action, ...payload });
    return data;
  } catch (err) {
    // O servidor já escreve a mensagem em português; só ela chega à tela.
    const generica = !err?.message || /^internal$/i.test(err.message);
    const e = new Error(generica ? t('Não foi possível falar com o DUPR agora. Tente de novo em instantes.') : err.message);
    e.code = err?.code;
    throw e;
  }
}

/** `{ enabled, configured, env, linked, ssoUrl? }` — o que a tela precisa para oferecer o vínculo. */
export const getDuprConfig = () => chamar('config');

/** Vincula a conta DUPR com os tokens do login (SSO). */
export const linkDuprAccount = ({ accessToken, refreshToken, duprId }) => chamar('link', { accessToken, refreshToken, duprId });

/** Desvincula (cancela a assinatura de rating e apaga os tokens). */
export const unlinkDuprAccount = () => chamar('unlink');

/** Resumo do vínculo, com as assinaturas renovadas se passou de 24 h. */
export const getDuprStatus = () => chamar('status');

/*
 * PILOTO (Painel admin → DUPR → Piloto): jogadores e partidas de teste que
 * existem só ali. Só o admin lê; quem escreve é o servidor (`pilot_*`).
 */
export const pilotAction = (acao, payload) => chamar(`pilot_${acao}`, payload);

async function listar(colecao) {
  if (!db) return [];
  const snap = await getDocs(collection(db, colecao));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export const listPilotPlayers = async () => (await listar('dupr_pilot_players'))
  .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));
export const listPilotMatches = async () => (await listar('dupr_pilot_matches'))
  .sort((a, b) => (b.created_at_ms || 0) - (a.created_at_ms || 0));

/*
 * ENVIOS (Painel admin → DUPR → Envios): o livro `dupr_submissions` que a
 * varredura do servidor mantém. Só o servidor escreve (`submissions_*`).
 */
export const submissionAction = (acao, payload) => chamar(`submissions_${acao}`, payload, acao === 'run' ? 300_000 : 60_000);

/**
 * O livro inteiro + a última passada + o nome de quem falta conectar (só
 * desses: o resto da tela não mostra pessoas).
 * ponytail: lê a coleção toda; paginar por situação quando passar de milhares.
 */
export async function listDuprSubmissions() {
  if (!db) return { rows: [], lastRun: null, names: {} };
  const [rows, estado] = await Promise.all([listar('dupr_submissions'), getDoc(doc(db, 'platform_settings', 'dupr_submissions'))]);
  rows.sort((a, b) => (b.updated_at_ms || 0) - (a.updated_at_ms || 0));
  const faltam = [...new Set(rows.flatMap((r) => [...(r.missing_uids || []), ...(r.no_entitlement_uids || [])]))].slice(0, 200);
  // O nome é enfeite: perfil que não veio aparece como "Atleta", a lista segue.
  const perfis = await Promise.allSettled(faltam.map((uid) => getDoc(doc(db, 'athlete_profiles', uid))));
  const names = {};
  perfis.forEach((p, i) => { names[faltam[i]] = (p.status === 'fulfilled' && p.value.exists() && p.value.data().platform_name) || ''; });
  const e = estado.exists() ? estado.data() : {};
  return { rows, lastRun: e.last_run_ms ? { at: e.last_run_ms, result: e.last_result || {} } : null, names };
}
