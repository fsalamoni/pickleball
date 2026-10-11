/**
 * Os passos do assistente de cadastro (Fase 3.5 do plano de UX): quais esta
 * pessoa precisa ver, qual pode ficar para depois e por quanto tempo.
 *
 * Essencial é o que o sorteio e a busca por perto usam (dados pessoais,
 * preferências de jogo, nível). Os interesses só personalizam o início — e o
 * início já se vira sem eles (o que a pessoa FAZ vence o que ela DISSE), então
 * esse passo pode ser adiado: o assistente volta a pedir depois de uma semana.
 */
export const PASSOS = Object.freeze(['pessoal', 'jogo', 'interesses', 'nivel']);
export const CAMPOS_DO_PASSO = Object.freeze({
  pessoal: ['platform_name', 'birth_date', 'phone', 'gender', 'city', 'state'],
  jogo: ['pickleball_experience', 'court_side', 'competition_gender'],
  interesses: ['interests'],
  nivel: ['level'],
});
export const PASSOS_ADIAVEIS = Object.freeze(['interesses']);
export const ADIAMENTO_DIAS = 7;

/** Só os passos com algo faltando; nada faltando ⇒ todos (primeiro acesso). */
export function passosPara(faltando = []) {
  const passos = PASSOS.filter((id) => CAMPOS_DO_PASSO[id].some((c) => faltando.includes(c)));
  return passos.length > 0 ? passos : [...PASSOS];
}

export function podeAdiar(passo) {
  return PASSOS_ADIAVEIS.includes(passo);
}

/** O que falta cabe inteiro nos passos adiáveis? */
export function soFaltaAdiavel(faltando = []) {
  if (faltando.length === 0) return false;
  const adiaveis = PASSOS_ADIAVEIS.flatMap((p) => CAMPOS_DO_PASSO[p]);
  return faltando.every((c) => adiaveis.includes(c));
}

/** O adiamento gravado (ISO) ainda vale? */
export function adiamentoVale(iso, agora = Date.now()) {
  const t = Date.parse(iso || '');
  if (!Number.isFinite(t)) return false;
  return agora - t < ADIAMENTO_DIAS * 24 * 60 * 60 * 1000;
}

/** O assistente deve abrir para quem tem isto faltando e este adiamento? */
export function deveAbrir(faltando = [], adiadoEm, agora = Date.now()) {
  if (faltando.length === 0) return false;
  return !(soFaltaAdiavel(faltando) && adiamentoVale(adiadoEm, agora));
}

/** O título de quem volta: diz logo o que falta quando é uma coisa só. */
export function tituloDoRetorno(passos = []) {
  if (passos.length === 1 && passos[0] === 'nivel') return 'Falta só o seu nível';
  if (passos.length === 1 && passos[0] === 'interesses') return 'Falta só dizer o que você quer fazer por aqui';
  return 'Faltam alguns dados no seu cadastro';
}
