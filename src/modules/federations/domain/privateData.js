/**
 * Dados PRIVADOS do filiado (`federation_members/{id}/private/data`) e a regra
 * dos menores (D6, D7): CPF opcional por federação, responsável, documentos
 * exigidos pelo plano. Lógica pura — nada aqui lê o banco.
 *
 *  - CPF só existe se a federação pediu (`federation.rules.ask_cpf`); vai
 *    mascarado para a tela e só a secretaria revela, com auditoria;
 *  - menor de 12 (`GUARDIAN_ONLY_AGE`) só é filiado pelo RESPONSÁVEL
 *    (dependente, na conta dele); de 12 a 17 pede filiação sozinho com o
 *    responsável ciente; a foto do menor só sai na verificação pública com
 *    o consentimento do responsável.
 */
import { t } from '@/core/i18n';
import { DOC_KIND, DOC_MAX_BYTES, DOC_STATUS, GUARDIAN_ONLY_AGE, MINOR_AGE } from './constants.js';

const str = (v, max = 200) => String(v ?? '').trim().slice(0, max);
export const onlyDigits = (v) => String(v ?? '').replace(/\D/g, '');

/** Idade completa em `hoje` ('YYYY-MM-DD'); `null` sem data válida. Cópia no servidor (`idadeDe`). */
export function ageOn(birthISO, hojeISO) {
  const b = String(birthISO || '').slice(0, 10);
  const h = String(hojeISO || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b) || !/^\d{4}-\d{2}-\d{2}$/.test(h)) return null;
  let idade = Number(h.slice(0, 4)) - Number(b.slice(0, 4));
  if (h.slice(5) < b.slice(5)) idade -= 1;
  return idade;
}

/** 'adult' | 'minor' (12–17, pede sozinho com o responsável ciente) | 'child' (só pelo responsável) | 'unknown'. */
export function ageGroup(age) {
  if (age == null) return 'unknown';
  if (age < GUARDIAN_ONLY_AGE) return 'child';
  if (age < MINOR_AGE) return 'minor';
  return 'adult';
}

/** CPF válido pelos dois dígitos verificadores. Aceita com ou sem pontuação. */
export function isValidCpf(raw) {
  const d = onlyDigits(raw);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (len) => {
    let soma = 0;
    for (let i = 0; i < len; i += 1) soma += Number(d[i]) * (len + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

/** `***.***.123-45` — o que a tela mostra sem revelar. */
export function maskCpf(raw) {
  const d = onlyDigits(raw);
  if (d.length !== 11) return '';
  return `***.***.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** `123.456.789-09` — só depois de revelar. */
export function formatCpf(raw) {
  const d = onlyDigits(raw);
  if (d.length !== 11) return '';
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** A federação pede CPF? (`rules.ask_cpf`, D6: opcional POR federação, padrão não). */
export const federationAsksCpf = (federation) => federation?.rules?.ask_cpf === true;

/**
 * O que a pessoa (ou o responsável) grava no subdocumento privado. `cpf` só
 * entra se a federação pede; o responsável só se é menor.
 * @returns {{ ok: boolean, errors: Record<string,string>, value: object }}
 */
export function validatePrivateInput(input = {}, { asksCpf = false, isMinor = false } = {}) {
  const errors = {};
  const value = {};
  if (asksCpf) {
    const cpf = onlyDigits(input.cpf);
    if (!cpf) errors.cpf = t('A federação pede o CPF.');
    else if (!isValidCpf(cpf)) errors.cpf = t('CPF inválido.');
    else value.cpf = cpf;
  }
  if (isMinor) {
    const nome = str(input.guardian_name, 120);
    const contato = str(input.guardian_contact, 160);
    if (nome.length < 3) errors.guardian_name = t('Informe o nome do responsável.');
    if (contato.length < 5) errors.guardian_contact = t('Informe um telefone ou e-mail do responsável.');
    if (input.guardian_consent !== true) errors.guardian_consent = t('O responsável precisa estar ciente da filiação.');
    value.guardian = { name: nome, contact: contato };
    value.guardian_consent = true;
  }
  return { ok: Object.keys(errors).length === 0, errors, value };
}

/** O dependente (menor) que o responsável filia na própria conta. */
export function validateDependentInput(input = {}, { hoje } = {}) {
  const errors = {};
  const name = str(input.name, 120);
  const birth = str(input.birth_date, 10);
  if (name.length < 3) errors.name = t('Informe o nome do dependente.');
  const age = ageOn(birth, hoje);
  if (age == null) errors.birth_date = t('Informe a data de nascimento.');
  else if (age >= MINOR_AGE) errors.birth_date = t('Dependente só até 17 anos. Maior de idade pede a própria filiação.');
  else if (age < 0) errors.birth_date = t('Data de nascimento no futuro.');
  return { ok: Object.keys(errors).length === 0, errors, value: { name, birth_date: birth, age } };
}

/** Arquivo aceito como documento: PDF ou imagem até 5 MB (a regra do Storage confere de novo). */
export function validateDocumentFile(file) {
  if (!file) return t('Escolha um arquivo.');
  const tipo = String(file.type || '');
  if (!/^(application\/pdf|image\/(jpeg|png|webp))$/.test(tipo)) return t('Envie PDF, JPG, PNG ou WebP.');
  if (Number(file.size) > DOC_MAX_BYTES) return t('O arquivo passa de 5 MB.');
  return '';
}

/** Os tipos de documento válidos de um plano (`requires_docs[]`). */
export function requiredDocKinds(plan) {
  const validos = Object.values(DOC_KIND);
  return [...new Set((plan?.requires_docs || []).filter((k) => validos.includes(k)))];
}

/**
 * Cada documento exigido e a situação dele: o mais recente enviado daquele
 * tipo decide. `missing` = falta enviar (ou o último foi recusado).
 * @returns {Array<{ kind: string, status: 'missing'|'pending'|'approved'|'rejected', doc: object|null }>}
 */
export function requiredDocsStatus(plan, docs = []) {
  return requiredDocKinds(plan).map((kind) => {
    const dos = docs.filter((d) => d.kind === kind).sort((a, b) => (b.created_at_ms || 0) - (a.created_at_ms || 0));
    const doc = dos[0] || null;
    if (!doc) return { kind, status: 'missing', doc: null };
    return { kind, status: doc.status === DOC_STATUS.APPROVED ? 'approved' : doc.status === DOC_STATUS.REJECTED ? 'rejected' : 'pending', doc };
  });
}

/** Tudo o que o plano exige está aceito? (plano sem exigência: sim) */
export const docsComplete = (plan, docs) => requiredDocsStatus(plan, docs).every((d) => d.status === 'approved');

/** Caminho do arquivo no Storage: `federacao/{uid}/{id}.{ext}` — o uid de quem envia é a pasta (exclusão de conta apaga). */
export function documentStoragePath(uid, id, contentType) {
  const ext = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[contentType] || 'bin';
  return `federacao/${uid}/${id}.${ext}`;
}
