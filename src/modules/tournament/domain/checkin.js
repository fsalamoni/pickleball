/**
 * Check-in no torneio — do organizador e do próprio atleta.
 *
 * O check-in é OPCIONAL: confirma a presença de quem está no local, e nada
 * além disso. Uma inscrição com check-in feito joga exatamente como uma
 * confirmada sem check-in — entra no sorteio, nas fases, nas vagas e na
 * contagem. A pergunta "esta inscrição joga?" tem UMA resposta, aqui
 * (`isActiveRegistration`); escrevê-la à mão em cada tela é como uma delas
 * acaba esquecendo o check-in (há guarda de fonte travando isso).
 *
 * Puro — sem Firebase.
 */

import { REGISTRATION_STATUS, TOURNAMENT_STATUS } from './constants.js';

/** Os status de quem JOGA: confirmada, com ou sem check-in. */
export const ACTIVE_REGISTRATION_STATUSES = Object.freeze([
  REGISTRATION_STATUS.CONFIRMED,
  REGISTRATION_STATUS.CHECKED_IN,
]);

/**
 * A inscrição está valendo para jogar? Confirmada ou com check-in feito.
 * Pagamento pendente, lista de espera, cancelada e desistência ficam de fora.
 */
export function isActiveRegistration(registration) {
  return ACTIVE_REGISTRATION_STATUSES.includes(registration?.status);
}

/**
 * Em que pé está o check-in do próprio atleta nesta inscrição.
 *
 * A regra do banco só deixa QUEM CRIOU a inscrição alterá-la (além da
 * organização). Por isso o botão é oferecido só a quem a criou: oferecer
 * também ao jogador vinculado por outra pessoa (a organização inscreveu, ou
 * a dupla inscreveu a dupla) produzia um "permissão negada" na cara do
 * atleta — como se ele não estivesse inscrito. Para essa pessoa, a tela
 * diz o caminho (`motivo: 'outra_pessoa'`).
 *
 * @returns {{ pode: boolean, motivo: null|'feito'|'fora_do_dia'|'nao_confirmada'|'outra_pessoa'|'nao_e_minha' }}
 */
export function selfCheckInState({ tournament, registration, uid } = {}) {
  if (!tournament || !registration || !uid) return { pode: false, motivo: 'nao_e_minha' };
  const minha = registration.created_by === uid
    || registration.user_id === uid
    || registration.player_a_user_id === uid
    || registration.player_b_user_id === uid;
  if (!minha) return { pode: false, motivo: 'nao_e_minha' };
  if (registration.status === REGISTRATION_STATUS.CHECKED_IN) return { pode: false, motivo: 'feito' };
  if (registration.status !== REGISTRATION_STATUS.CONFIRMED) return { pode: false, motivo: 'nao_confirmada' };
  if (tournament.status !== TOURNAMENT_STATUS.IN_PROGRESS) return { pode: false, motivo: 'fora_do_dia' };
  if (registration.created_by !== uid) return { pode: false, motivo: 'outra_pessoa' };
  return { pode: true, motivo: null };
}

/**
 * O usuário pode fazer o próprio check-in desta inscrição?
 * Torneio em andamento, inscrição confirmada (ainda sem check-in) e o usuário
 * é quem a criou — o mesmo que a regra do banco aceita.
 */
export function canSelfCheckIn(input = {}) {
  return selfCheckInState(input).pode;
}

/** A inscrição do usuário já está com check-in feito? */
export function hasCheckedIn(registration) {
  return registration?.status === REGISTRATION_STATUS.CHECKED_IN;
}
