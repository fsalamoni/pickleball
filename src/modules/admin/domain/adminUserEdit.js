/**
 * Edição de cadastro de usuário PELO ADMIN — o contrato, em lógica pura.
 *
 * O pedido: "eu, como admin, quero editar, complementar, corrigir e ajustar os
 * cadastros dos usuários; preencher o que falta e corrigir erros".
 *
 * O limite: um admin corrigindo um dado ERRADO é uma coisa. Um admin decidindo
 * QUEM VÊ o dado de outra pessoa é outra, e não é dele. Por isso a lista de
 * campos editáveis é fechada, e três grupos ficam de fora de propósito:
 *
 *  1. PODER (`role`, `can_create_pools`) — é o que a correção do P0-01 fechou.
 *     Revogar tem caminho próprio (aba Acessos); conceder é só pelo console.
 *  2. PRIVACIDADE (`email_public`, `phone_public`, `address_public`,
 *     `directory_listed`) — é escolha do TITULAR. Um admin ligando
 *     `email_public` exporia o e-mail de alguém contra a vontade dela. Se a
 *     pessoa quer mudar, ela muda no próprio perfil.
 *  3. IDENTIDADE DE LOGIN (`email`) — mora no Firebase Authentication. Mudar
 *     aqui só dessincronizaria o espelho, sem trocar o login de verdade.
 *
 * A regra do Firestore repete essa lista. Se as duas divergirem, a regra
 * ganha — e o teste `adminUserEdit.test.js` existe para elas não divergirem.
 */

import { ATHLETE_GENDER_LABELS } from '@/modules/athletes/domain/constants';
import { COURT_SIDE_OPTIONS } from '@/modules/athletes/domain/profileMeta';
import {
  PICKLEBALL_EXPERIENCE_LABELS, COMPETITION_GENDER_LABELS,
} from '@/modules/tournament/domain/constants';
import { LEVEL_OPTIONS, getLevelByCode } from '@/modules/leveling/data/levels';

/** `{ valor: rótulo }` vira `[{ value, label }]`, o formato do formulário. */
const deRotulos = (labels) => Object.entries(labels).map(([value, label]) => ({ value, label }));

/**
 * As listas de seleção são AS MESMAS do cadastro normal, importadas da fonte —
 * nunca recopiadas. Se o admin pudesse digitar texto livre onde o resto do
 * sistema espera um código (`male`, `right`, `1-2-anos`), ele gravaria um valor
 * que nenhuma tela entende e que nenhum sorteio consegue usar.
 */
export const FIELD_OPTIONS = Object.freeze({
  gender: deRotulos(ATHLETE_GENDER_LABELS),
  competition_gender: deRotulos(COMPETITION_GENDER_LABELS),
  pickleball_experience: deRotulos(PICKLEBALL_EXPERIENCE_LABELS),
  court_side: COURT_SIDE_OPTIONS.map(({ value, label }) => ({ value, label })),
  leveling_level: LEVEL_OPTIONS.map(({ code, label }) => ({ value: code, label })),
});

/** Campos que o admin PODE corrigir, com rótulo e tipo para montar o formulário. */
export const ADMIN_EDITABLE_FIELDS = Object.freeze([
  { key: 'platform_name', label: 'Nome de exibição', type: 'text', group: 'identidade', required: true },
  { key: 'full_name', label: 'Nome completo', type: 'text', group: 'identidade' },
  { key: 'birth_date', label: 'Data de nascimento', type: 'date', group: 'identidade', required: true },
  { key: 'phone', label: 'Telefone', type: 'text', group: 'identidade', required: true },
  { key: 'gender', label: 'Gênero', type: 'select', group: 'identidade' },
  { key: 'city', label: 'Cidade', type: 'text', group: 'local' },
  { key: 'state', label: 'Estado (UF)', type: 'text', group: 'local', maxLength: 2 },
  { key: 'address', label: 'Endereço', type: 'text', group: 'local' },
  { key: 'pickleball_experience', label: 'Experiência no pickleball', type: 'select', group: 'jogo', required: true },
  { key: 'competition_gender', label: 'Categoria competitiva', type: 'select', group: 'jogo' },
  { key: 'court_side', label: 'Lado na quadra', type: 'select', group: 'jogo' },
  { key: 'leveling_level', label: 'Nível declarado', type: 'select', group: 'jogo' },
  { key: 'dupr_id', label: 'DUPR ID', type: 'text', group: 'jogo' },
  { key: 'dupr_rating', label: 'DUPR rating', type: 'number', group: 'jogo' },
  { key: 'photo_url', label: 'URL da foto', type: 'text', group: 'jogo' },
]);

const EDITAVEIS = new Set(ADMIN_EDITABLE_FIELDS.map((f) => f.key));

/**
 * Campos que o admin NÃO pode tocar por esta via, e o motivo. Esta lista é
 * documentação executável: o teste confere que nenhum deles é editável.
 */
export const ADMIN_FORBIDDEN_FIELDS = Object.freeze({
  role: 'Poder. Revogar é pela aba Acessos; conceder, só pelo console.',
  can_create_pools: 'Poder. Mesmo caminho de `role`.',
  hidden: 'Moderação de exibição, com caminho próprio.',
  hidden_at: 'Moderação de exibição, com caminho próprio.',
  hidden_by: 'Moderação de exibição, com caminho próprio.',
  email: 'Identidade de login: vive no Firebase Authentication, não aqui.',
  email_public: 'Preferência de privacidade — escolha do titular.',
  phone_public: 'Preferência de privacidade — escolha do titular.',
  address_public: 'Preferência de privacidade — escolha do titular.',
  directory_listed: 'Preferência de privacidade — escolha do titular.',
  uid: 'Identificador. Nunca muda.',
  created_at: 'Histórico.',
  last_login: 'Histórico.',
});

/** Campos exigidos para o cadastro ser considerado completo. */
const OBRIGATORIOS = ADMIN_EDITABLE_FIELDS.filter((f) => f.required);

const texto = (v) => String(v ?? '').trim();

/** As opções de um campo, ou `null` se ele for de texto livre. */
export function fieldOptions(key) {
  return FIELD_OPTIONS[key] || null;
}

/** O valor pertence à lista do campo? Vazio conta como válido (é "não informado"). */
export function isValidOptionValue(key, value) {
  const opcoes = fieldOptions(key);
  if (!opcoes) return true;
  const v = texto(value);
  if (v === '') return true;
  return opcoes.some((o) => o.value === v);
}

/**
 * Campos IRMÃOS que precisam acompanhar uma mudança, senão o cadastro fica
 * internamente inconsistente.
 *
 * O caso real: o formulário normal, ao salvar o nível, grava QUATRO campos —
 * `leveling_level` (o código), `level` (o texto que as telas exibem),
 * `leveling_method` e `leveling_manual_level`. Gravar só o código deixaria o
 * texto exibido apontando para o nível ANTIGO, inclusive no espelho público.
 * É a mesma armadilha de `birth_date` / `birth_date_at`.
 */
export function derivedFieldsFor(key, value) {
  if (key !== 'leveling_level') return {};
  const codigo = texto(value);
  if (!codigo) return { level: '', leveling_manual_level: '' };
  const nivel = getLevelByCode(codigo);
  return {
    level: nivel ? `${nivel.name} (USAP ${nivel.usap})` : codigo,
    leveling_method: 'manual',
    leveling_manual_level: codigo,
  };
}

/**
 * Número ou AUSÊNCIA — nunca zero por acidente.
 *
 * `Number('')` é 0 e é finito, então tratar campo numérico com `Number()` cru
 * transforma "não informado" em "zero". Um normalizador só, usado tanto na
 * limpeza quanto na comparação, mantém `''`, `null` e `undefined` sendo a
 * mesma coisa — e um zero digitado de verdade continua sendo zero.
 */
function numeroOuNulo(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Fica só com o que o admin pode editar, já normalizado. Qualquer chave fora
 * da lista é DESCARTADA em silêncio — a regra do Firestore recusaria a escrita
 * inteira, e derrubar a correção por causa de um campo a mais seria pior.
 *
 * @param {object} patch
 * @returns {{ patch: object, ignored: string[] }}
 */
export function sanitizeAdminUserPatch(patch = {}) {
  const limpo = {};
  const ignorados = [];
  Object.entries(patch || {}).forEach(([k, v]) => {
    if (!EDITAVEIS.has(k)) { ignorados.push(k); return; }
    const campo = ADMIN_EDITABLE_FIELDS.find((f) => f.key === k);
    if (campo.type === 'number') { limpo[k] = numeroOuNulo(v); return; }
    let s = texto(v);
    if (campo.maxLength) s = s.slice(0, campo.maxLength);
    if (k === 'state') s = s.toUpperCase();
    // Campo de lista só aceita valor DA lista. Um valor fora dela é
    // DESCARTADO, não zerado: se o documento já tem um valor legado inválido,
    // apagá-lo em silêncio ao abrir a tela seria pior do que deixá-lo.
    if (campo.type === 'select' && !isValidOptionValue(k, s)) { ignorados.push(k); return; }
    limpo[k] = s;
    Object.assign(limpo, derivedFieldsFor(k, s));
  });
  return { patch: limpo, ignored: ignorados };
}

/**
 * O que MUDA de fato. Serve para dois propósitos: não gravar escrita vazia, e
 * registrar na auditoria o antes/depois de cada campo — sem isso, "o admin
 * editou o cadastro" não diz nada a quem for investigar depois.
 *
 * @returns {Array<{field:string,label:string,from:*,to:*}>}
 */
export function diffAdminUserPatch(before = {}, patch = {}) {
  const mudancas = [];
  Object.entries(patch || {}).forEach(([k, to]) => {
    const campo = ADMIN_EDITABLE_FIELDS.find((f) => f.key === k);
    if (!campo) return;
    const from = before?.[k];
    // Nos dois lados a mesma normalização, senão `''` e `null` (que significam
    // a mesma coisa) apareceriam como alteração e o botão de salvar ficaria
    // habilitado sozinho num cadastro que ninguém tocou.
    const iguais = campo.type === 'number'
      ? numeroOuNulo(from) === numeroOuNulo(to)
      : texto(from) === texto(to);
    if (!iguais) {
      // O valor REPORTADO vai normalizado também: a auditoria não deve
      // registrar `undefined` nem `''` conforme o campo exista ou não.
      mudancas.push({
        field: k,
        label: campo.label,
        from: campo.type === 'number' ? numeroOuNulo(from) : texto(from),
        to: campo.type === 'number' ? numeroOuNulo(to) : texto(to),
      });
    }
  });
  return mudancas;
}

/**
 * O que falta preencher no cadastro. É a parte "complementar" do pedido: em
 * vez de o admin caçar campo vazio, a tela aponta.
 *
 * @returns {Array<{key:string,label:string,required:boolean}>}
 */
export function missingUserFields(user = {}) {
  return ADMIN_EDITABLE_FIELDS
    .filter((f) => {
      const v = user?.[f.key];
      if (f.type === 'number') return v == null || v === '';
      return texto(v) === '';
    })
    .map((f) => ({ key: f.key, label: f.label, required: Boolean(f.required) }));
}

/** O cadastro está completo no que é obrigatório? */
export function isUserRecordComplete(user = {}) {
  return OBRIGATORIOS.every((f) => texto(user?.[f.key]) !== '');
}

/**
 * Resumo de completude, para a lista de cadastros: quantos campos faltam e se
 * algum obrigatório está entre eles.
 */
export function userRecordStatus(user = {}) {
  const faltando = missingUserFields(user);
  const obrigatoriosFaltando = faltando.filter((f) => f.required);
  return {
    missing: faltando,
    missingCount: faltando.length,
    missingRequired: obrigatoriosFaltando,
    complete: obrigatoriosFaltando.length === 0,
    filledCount: ADMIN_EDITABLE_FIELDS.length - faltando.length,
    totalCount: ADMIN_EDITABLE_FIELDS.length,
  };
}

/** O motivo é obrigatório: edição de dado alheio sem justificativa não é suporte. */
export function validateAdminEdit({ changes = [], reason = '' } = {}) {
  const erros = {};
  if (changes.length === 0) erros.changes = 'Nenhuma alteração para salvar.';
  if (texto(reason).length < 5) erros.reason = 'Descreva o motivo da correção (mínimo 5 caracteres).';
  return { isValid: Object.keys(erros).length === 0, errors: erros };
}
