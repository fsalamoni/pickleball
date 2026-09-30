/**
 * As 27 unidades da federação — fonte única.
 *
 * Mora no núcleo, e não na divulgação (`promo`), porque o CADASTRO também
 * precisa dela: a UF é o que a busca por perto e o filtro de região da tela
 * inicial comparam, e UF digitada à mão ("S", "Sao Paulo", "XX") não casa com
 * nada. Arquivo leve de propósito: quem o importa não leva mais nada junto.
 */

export const BR_UFS = Object.freeze([
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]);

const UFS = new Set(BR_UFS);

/** É uma UF de verdade? Aceita minúsculas e espaços ("sp " vale). */
export function isBrazilUF(value) {
  return UFS.has(String(value || '').trim().toUpperCase());
}
