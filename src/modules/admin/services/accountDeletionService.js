/**
 * Excluir cadastro — a chamada ao servidor.
 *
 * A exclusão roda inteira na função `adminDeleteAccounts`
 * (`functions/accountDeletion.js`): só o servidor apaga a conta de login, e
 * uma cascata não pode depender de uma aba aberta. Aqui só se chama e se
 * traduz a resposta.
 */
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/core/config/firebase';

const NOME_DA_FUNCAO = 'adminDeleteAccounts';

/**
 * Traduz o erro da função para uma frase que o admin consegue agir.
 *
 * O caso que mais importa: a função ainda não publicada. O deploy das
 * Functions no CI não derruba o deploy do site quando falha, então é possível
 * a tela estar no ar e a função não. Sem esta tradução o admin veria
 * "internal" e concluiria que a exclusão quebrou.
 */
export function deletionErrorMessage(err) {
  const code = String(err?.code || '').replace('functions/', '');
  if (code === 'not-found' || code === 'unimplemented') {
    return 'A exclusão roda no servidor, e a função ainda não foi publicada. Ela sai no próximo deploy — tente de novo mais tarde.';
  }
  if (code === 'permission-denied') return err?.message || 'Você não tem permissão para esta operação.';
  if (code === 'invalid-argument') return err?.message || 'Pedido inválido.';
  if (code === 'unavailable' || code === 'deadline-exceeded') {
    return 'O servidor não respondeu a tempo. Nada é apagado pela metade: rode de novo para terminar.';
  }
  if (code === 'internal') {
    return 'O servidor falhou ao processar. Se a função foi publicada agora há pouco, aguarde alguns minutos e tente de novo.';
  }
  return err?.message || 'Não foi possível concluir.';
}

async function chamar(payload) {
  if (!functions) throw new Error('Firebase não está configurado neste ambiente.');
  const fn = httpsCallable(functions, NOME_DA_FUNCAO, { timeout: 540_000 });
  try {
    const { data } = await fn(payload);
    return data;
  } catch (err) {
    const e = new Error(deletionErrorMessage(err));
    e.code = err?.code;
    throw e;
  }
}

/** Só LÊ: o que aconteceria com cada conta. */
export function previewAccountDeletion(uids) {
  return chamar({ mode: 'preview', uids });
}

/** Executa. O servidor refaz a análise antes de apagar. */
export function deleteAccounts(uids, { reason, confirm }) {
  return chamar({ mode: 'execute', uids, reason, confirm });
}
