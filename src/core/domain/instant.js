/**
 * Um instante vindo do banco, em milissegundos (lógica pura).
 *
 * 🐞 O defeito que isto corrige: o código gravava datas como `Date` e lia com
 * `x instanceof Date ? x.getTime() : Number(x)`. Só que o Firestore NUNCA
 * devolve `Date` — devolve `Timestamp`. E `Number(timestamp)` não dá erro nem
 * `NaN`: dá os SEGUNDOS desde o ano 1 (≈ 6,4 × 10¹⁰), que comparados com
 * `Date.now()` em milissegundos (≈ 1,8 × 10¹²) caem em 1972. Todo prazo lido
 * do banco parecia vencido:
 *
 * - o pacote de horas valia zero — não aparecia e NUNCA era abatido na
 *   reserva (quem comprou horas pagava o preço cheio);
 * - a chamada da fila do jogo aberto vencia no instante em que chegava —
 *   "Aceitar" respondia "Promoção expirou" para todo mundo.
 *
 * Os testes não pegavam porque montavam o dado com número ou `Date`, que é o
 * que o código GRAVA — nunca o que o banco DEVOLVE. Teste de data lida do
 * banco tem de usar `Timestamp` de verdade.
 *
 * Aceita: `Timestamp` do cliente e do Admin SDK (`toMillis`), qualquer coisa
 * com `toDate()`, `{ seconds, nanoseconds }` e `{ _seconds, _nanoseconds }`
 * (o Timestamp serializado), `Date`, número em ms e texto (número ou ISO).
 *
 * @param {*} valor
 * @returns {number} ms desde 1970, ou `NaN` quando não há instante.
 */
export function instanteEmMs(valor) {
  if (valor == null || valor === '') return NaN;
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : NaN;
  if (valor instanceof Date) return valor.getTime();
  if (typeof valor === 'object') {
    if (typeof valor.toMillis === 'function') return valor.toMillis();
    if (typeof valor.toDate === 'function') {
      const d = valor.toDate();
      return d instanceof Date ? d.getTime() : NaN;
    }
    const s = Number.isFinite(valor.seconds) ? valor.seconds : valor._seconds;
    if (Number.isFinite(s)) {
      const ns = Number.isFinite(valor.nanoseconds) ? valor.nanoseconds : (Number(valor._nanoseconds) || 0);
      return s * 1000 + Math.floor(ns / 1e6);
    }
    return NaN;
  }
  if (typeof valor === 'string') {
    const t = valor.trim();
    if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
    const p = Date.parse(t);
    return Number.isFinite(p) ? p : NaN;
  }
  return NaN;
}
