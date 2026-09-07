/**
 * Nome público de exibição — nunca revela o e-mail completo.
 *
 * MOTIVO (achado P1-02, `docs/20-SEGURANCA-E-PRIVACIDADE/01-AUDITORIA-ACHADOS.md`):
 * várias coleções que guardam o nome do usuário são de **leitura pública**
 * (`tournaments`, `tournament_registrations`) ou legíveis por qualquer
 * autenticado (`tournament_admins`). Os serviços de torneio caíam em
 * `user.email` como último recurso, então quem ainda não tinha preenchido o
 * nome tinha o **endereço de e-mail completo publicado** como nome.
 *
 * O critério aqui é o mesmo que o diretório de atletas já aplica em
 * `athletes/domain/publicProfile.js`: usar a parte ANTES do '@' como último
 * recurso, e só então um rótulo genérico. Assim o usuário continua
 * identificável na tela, sem expor o endereço.
 *
 * Função pura, sem I/O.
 */

const trimmed = (value) => String(value ?? '').trim();

/** Parte local do e-mail (antes do '@'), já limitada e sem espaços. */
export function emailLocalPart(email) {
  const raw = trimmed(email);
  if (!raw) return '';
  const local = raw.split('@')[0] || '';
  return local.trim().slice(0, 60);
}

/**
 * Resolve o nome a exibir publicamente, na ordem de preferência informada.
 *
 * @param {Object} input
 * @param {string} [input.platformName] nome de exibição escolhido na plataforma
 * @param {string} [input.fullName]     nome completo do perfil
 * @param {string} [input.displayName]  nome vindo do provedor de autenticação
 * @param {string} [input.email]        e-mail — usado SÓ como parte local
 * @param {string} [input.fallback]     rótulo final quando não há nada
 * @returns {string} nome seguro para publicação
 */
export function publicDisplayName({
  platformName,
  fullName,
  displayName,
  email,
  fallback = 'Atleta',
} = {}) {
  return (
    trimmed(platformName)
    || trimmed(fullName)
    || trimmed(displayName)
    || emailLocalPart(email)
    || fallback
  );
}
