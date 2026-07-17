/**
 * Owners da plataforma — single source of truth.
 *
 * Lista de e-mails que SEMPRE devem ter `role: 'platform_admin'` e
 * `can_create_pools: true` no `users/{uid}`. A constante é hardcoded porque
 * é a base do modelo de segurança (perder o owner é um incidente sério).
 *
 * Como usar:
 *  - `FirebaseAuthContext` aplica `role: 'platform_admin'` no login se o
 *    `firebaseUser.email` está nesta lista.
 *  - Páginas administrativas sensíveis podem checar `isOwnerEmail(user.email)`
 *    para exibir ferramentas de auto-restore (caso o `users/{uid}.role` tenha
 *    sido corrompido por algum bug).
 *
 * Para adicionar mais owners no futuro, basta incluir o e-mail aqui.
 */

export const PLATFORM_OWNER_EMAILS = Object.freeze([
  'fsalamoni@gmail.com',
]);

const OWNER_SET = new Set(PLATFORM_OWNER_EMAILS.map((e) => e.toLowerCase()));

/**
 * @param {string|null|undefined} email
 * @returns {boolean} true se o email é de um owner da plataforma
 */
export function isOwnerEmail(email) {
  return OWNER_SET.has(String(email || '').trim().toLowerCase());
}
