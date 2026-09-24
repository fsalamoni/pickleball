/**
 * Excluir cadastro — as regras puras do lado do painel admin.
 *
 * O pedido: *"há muitos cadastros de exemplo e mock que foram criados e quero
 * poder excluí-los"*. A exclusão em si roda no SERVIDOR (função
 * `adminDeleteAccounts`), porque só o servidor apaga a conta do Firebase
 * Authentication e porque uma exclusão em cascata não pode depender de o
 * navegador do admin continuar aberto até o fim. Este arquivo cuida do que a
 * TELA decide antes de pedir: quem pode ser escolhido, o que a confirmação
 * exige, e quais cadastros parecem ser de teste.
 *
 * O desenho segue o que já estava aprovado para exclusão de conta
 * (`docs/20-SEGURANCA-E-PRIVACIDADE/09-DIREITOS-DO-TITULAR.md` §4 e
 * `11-RETENCAO-E-EXCLUSAO.md`): identificação e contato SOMEM; histórico
 * esportivo é PSEUDONIMIZADO ("Atleta removido") porque apagá-lo reescreveria
 * resultado e rating de outras pessoas; reservas, pagamentos, auditoria e
 * consentimentos FICAM, com o dado pessoal minimizado.
 */

/** A palavra que o admin digita para confirmar. */
export const DELETION_CONFIRM_WORD = 'EXCLUIR';

/**
 * Quantos cadastros cabem numa exclusão.
 *
 * É a "regra de ouro" de `11-RETENCAO-E-EXCLUSAO.md` §4: limite por
 * execução, para um filtro errado não apagar a base inteira de uma vez. Vinte
 * e cinco é o bastante para limpar contas de teste em poucas rodadas, e pouco
 * o bastante para o admin olhar a lista antes de confirmar.
 */
export const DELETION_BATCH_MAX = 25;

/** Motivo mínimo: "teste" é motivo; "a" não é. */
export const DELETION_REASON_MIN = 5;

/** O nome que substitui o de quem foi excluído no histórico esportivo. */
export const REMOVED_ATHLETE_LABEL = 'Atleta removido';

const lower = (v) => String(v || '').trim().toLowerCase();
const texto = (v) => String(v ?? '').trim();

/**
 * Esta conta pode ser escolhida para exclusão?
 *
 * Três portas fechadas, todas pelo mesmo motivo — perder o controle da
 * plataforma é pior do que manter uma conta de teste:
 *
 * - **a própria conta**: o admin se excluindo no meio da operação fica sem
 *   acesso ao resultado dela;
 * - **conta com poder** (`platform_admin`): tirar o poder tem caminho próprio
 *   (Governança → Acessos). Excluir um admin daqui seria revogar poder pela
 *   porta dos fundos, sem o aviso daquela tela;
 * - **e-mail de dono** da plataforma: é re-promovido a admin a cada login, e é
 *   a conta que não pode sumir em hipótese nenhuma.
 *
 * O servidor confere as TRÊS de novo — a tela só evita o clique inútil.
 *
 * @param {object} user                 documento de `users/{uid}`
 * @param {{ actorUid?: string|null, ownerEmails?: string[] }} ctx
 * @returns {{ ok: boolean, reason: string }}
 */
export function deletionBlockedReason(user, { actorUid = null, ownerEmails = [] } = {}) {
  const uid = texto(user?.uid || user?.id);
  if (!uid) return { ok: false, reason: 'Cadastro sem identificador.' };
  if (actorUid && uid === actorUid) {
    return { ok: false, reason: 'Você não pode excluir a própria conta por aqui.' };
  }
  const donos = new Set((ownerEmails || []).map(lower));
  if (user?.email && donos.has(lower(user.email))) {
    return { ok: false, reason: 'Conta de dono da plataforma. Não pode ser excluída.' };
  }
  if (user?.role === 'platform_admin') {
    return {
      ok: false,
      reason: 'Conta com poder de admin. Tire o poder em Governança → Acessos antes.',
    };
  }
  return { ok: true, reason: '' };
}

export const canDeleteAccount = (user, ctx) => deletionBlockedReason(user, ctx).ok;

/**
 * Valida o pedido antes de chamar o servidor.
 *
 * @param {{ uids?: string[], reason?: string, confirmText?: string }} req
 * @returns {{ isValid: boolean, errors: Record<string,string> }}
 */
export function validateDeletionRequest({ uids = [], reason = '', confirmText = '' } = {}) {
  const erros = {};
  const unicos = [...new Set((uids || []).filter(Boolean))];
  if (unicos.length === 0) erros.uids = 'Escolha ao menos um cadastro.';
  if (unicos.length > DELETION_BATCH_MAX) {
    erros.uids = `No máximo ${DELETION_BATCH_MAX} cadastros por vez.`;
  }
  if (texto(reason).length < DELETION_REASON_MIN) {
    erros.reason = `Descreva o motivo (mínimo ${DELETION_REASON_MIN} caracteres).`;
  }
  // Sem diferenciar maiúsculas: o que se quer é a intenção, não a digitação.
  if (texto(confirmText).toUpperCase() !== DELETION_CONFIRM_WORD) {
    erros.confirmText = `Digite ${DELETION_CONFIRM_WORD} para confirmar.`;
  }
  return { isValid: Object.keys(erros).length === 0, errors: erros };
}

/* ------------------------------------------------ cadastros de teste ---- */

/** Domínios que só existem para exemplo — reservados pela RFC 2606 e afins. */
const DOMINIOS_DE_TESTE = [
  'example.com', 'example.org', 'example.net', 'test.com', 'teste.com',
  'mock.com', 'fake.com', 'mailinator.com', 'exemplo.com', 'demo.com',
];

/** Palavras que, no nome ou no e-mail, costumam denunciar conta de exemplo. */
const PALAVRAS_DE_TESTE = ['teste', 'test', 'mock', 'exemplo', 'example', 'demo', 'fake', 'fulano', 'ciclano', 'beltrano', 'seed'];

/**
 * Por que este cadastro PARECE ser de teste — e só "parece".
 *
 * Serve para o filtro "prováveis contas de teste", que é o que torna a
 * limpeza viável: o admin disse que são MUITAS, e procurar uma a uma numa
 * lista de centenas é o tipo de tarefa que não acontece. Devolve os motivos
 * em texto, porque o filtro SUGERE e quem decide é o admin: uma pessoa real
 * chamada "Demóstenes" não pode sumir porque o nome começa com "demo" — e a
 * tela mostra exatamente o que levantou a suspeita.
 *
 * Um aviso: os sinais olham palavras INTEIRAS do nome, não pedaços. "Ernesto"
 * tem "test" dentro e é um nome comum.
 *
 * @param {object} user
 * @returns {string[]} motivos, vazio quando nada levanta suspeita
 */
export function testAccountSignals(user) {
  const motivos = [];
  const email = lower(user?.email);
  const dominio = email.includes('@') ? email.split('@')[1] : '';

  if (user?.hidden === true) motivos.push('Oculto na moderação de atletas');
  if (dominio && DOMINIOS_DE_TESTE.some((d) => dominio === d || dominio.endsWith(`.${d}`))) {
    motivos.push(`E-mail de domínio de exemplo (@${dominio})`);
  }
  const usuarioDoEmail = email.split('@')[0] || '';
  const partesEmail = usuarioDoEmail.split(/[^a-z0-9]+/).filter(Boolean);
  if (partesEmail.some((p) => PALAVRAS_DE_TESTE.includes(p.replace(/\d+$/, '')))) {
    motivos.push('E-mail com cara de teste');
  }
  const nome = lower(user?.full_name || user?.display_name || user?.name);
  const palavrasNome = nome
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/).filter(Boolean);
  if (palavrasNome.some((p) => PALAVRAS_DE_TESTE.includes(p.replace(/\d+$/, '')))) {
    motivos.push('Nome com cara de teste');
  }
  if (!email && !nome) motivos.push('Sem nome e sem e-mail');
  return motivos;
}

export const looksLikeTestAccount = (user) => testAccountSignals(user).length > 0;
