/**
 * DUPR OFICIAL — chamadas ao servidor (`duprIntegration`).
 *
 * As credenciais do parceiro e os tokens da pessoa ficam SÓ no servidor; aqui
 * trafega apenas o que o login do DUPR (SSO) entregou, uma vez, no vínculo.
 * Ver docs/51-DUPR.md.
 */
import { httpsCallable } from 'firebase/functions';
import { collection, getDocs } from 'firebase/firestore';
import { db, functions } from '@/core/config/firebase';
import { t } from '@/core/i18n';

async function chamar(action, payload = {}) {
  if (!functions) throw new Error(t('Firebase não está configurado neste ambiente.'));
  try {
    const { data } = await httpsCallable(functions, 'duprIntegration', { timeout: 60_000 })({ action, ...payload });
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
