/**
 * URL de arquivo do Storage do projeto (o que o upload devolve) — a única que
 * a plataforma grava como imagem ou anexo. Link digitado (`javascript:`,
 * página de phishing) não passa.
 */
export function isAllowedImageUrl(url) {
  const u = String(url || '').trim();
  if (!u) return false;
  return /^https:\/\/(firebasestorage\.googleapis\.com|storage\.googleapis\.com)\//i.test(u)
    || /^http:\/\/(127\.0\.0\.1|localhost):\d+\//i.test(u);
}
