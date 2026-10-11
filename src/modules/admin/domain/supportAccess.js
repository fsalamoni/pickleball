/**
 * Acesso de suporte com registro de leitura — o lado da tela. A lista de campos
 * e as categorias são CÓPIA de `functions/supportAccess.js` (o pacote de
 * Functions é publicado isolado); há teste de paridade.
 */
export const SENSITIVE_FIELDS = Object.freeze(['email', 'phone', 'birth_date', 'address']);
export const REVEAL_TEXT_MIN = 20;

export const REVEAL_REASON_META = Object.freeze({
  suporte_solicitado: 'A pessoa pediu ajuda',
  correcao_de_dado: 'Correção de dado',
  investigacao_de_abuso: 'Investigação de abuso',
  requisicao_do_titular: 'Requisição do titular (LGPD)',
  ordem_judicial: 'Ordem judicial',
  incidente_de_seguranca: 'Incidente de segurança',
  outro: 'Outro',
});

/** `ana.silva@gmail.com` → `a********@gmail.com`; `51999887766` → `•••••7766`. */
export function maskValue(field, value) {
  const v = String(value || '');
  if (!v) return '';
  if (field === 'email') {
    const [u, d] = v.split('@');
    return d ? `${u[0]}${'*'.repeat(Math.max(1, u.length - 1))}@${d}` : '••••';
  }
  if (field === 'birth_date') return '••/••/' + (v.match(/\d{4}/)?.[0] || '••••');
  return v.length > 4 ? `${'•'.repeat(Math.min(6, v.length - 4))}${v.slice(-4)}` : '••••';
}

export function validateRevealRequest({ fields = [], reason_category = '', reason_text = '' } = {}) {
  const erros = {};
  if (!fields.length || fields.some((f) => !SENSITIVE_FIELDS.includes(f))) erros.fields = 'Escolha o que revelar.';
  if (!REVEAL_REASON_META[reason_category]) erros.reason_category = 'Escolha a categoria.';
  if (String(reason_text).trim().length < REVEAL_TEXT_MIN) erros.reason_text = `Mínimo ${REVEAL_TEXT_MIN} caracteres.`;
  return { isValid: Object.keys(erros).length === 0, errors: erros };
}
