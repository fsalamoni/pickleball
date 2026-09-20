/**
 * Junta o estado de VÁRIAS consultas numa resposta só (lógica pura).
 *
 * Uma tela quase nunca depende de uma consulta: o dia de jogo precisa do
 * documento E dos participantes, o torneio precisa das modalidades E dos
 * jogos. Escrever `a.isError || b.isError || c.isError` à mão em cada tela é
 * como a cadeia de bloqueios da arena antes do `mergeArenaBlocks`: a consulta
 * que ficar de fora não dá erro — dá uma tela afirmando que não existe nada.
 *
 * ⚠️ `isPending` x `isLoading`: no React Query v5, `isLoading` é
 * `isPending && isFetching`, então uma consulta DESABILITADA (`enabled: false`)
 * fica `isPending` para sempre e nunca `isLoading`. Aqui usamos `isLoading`
 * de propósito — consulta que nem chegou a sair não pode deixar a tela num
 * esqueleto eterno.
 */

/**
 * @param {Array<{isLoading?:boolean, isPending?:boolean, isError?:boolean, refetch?:Function}>} consultas
 * @returns {{ carregando: boolean, falhou: boolean, recarregar: () => void }}
 */
export function combinarConsultas(consultas = []) {
  const lista = consultas.filter(Boolean);
  return {
    carregando: lista.some((q) => q.isLoading === true),
    falhou: lista.some((q) => q.isError === true),
    recarregar: () => {
      lista.forEach((q) => {
        if (typeof q.refetch === 'function') q.refetch();
      });
    },
  };
}

/**
 * A pergunta que as telas realmente fazem: **posso afirmar que está vazio?**
 *
 * Só quando a consulta terminou E não falhou. Enquanto carrega ou depois de
 * falhar, "vazio" é um palpite — e palpite apresentado como fato é o defeito
 * que este arquivo existe para impedir.
 *
 * @param {{isLoading?:boolean, isPending?:boolean, isError?:boolean}} consulta
 * @returns {boolean}
 */
export function podeAfirmarVazio(consulta) {
  if (!consulta) return false;
  return consulta.isLoading !== true && consulta.isError !== true;
}
