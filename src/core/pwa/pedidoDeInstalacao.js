/**
 * O convite nativo de instalar (Android/Chrome/Edge: `beforeinstallprompt`)
 * chega UMA vez, logo depois de a página carregar. Escutá-lo só dentro do
 * botão perdia o evento sempre que o botão montava depois (a pessoa entra pela
 * página inicial e a faixa "Instale o PickleRush" aparece já logada): o toque
 * caía nas instruções manuais em vez de abrir a instalação. Por isso ele é
 * guardado aqui, desde a inicialização (`registerPwa`), para qualquer botão.
 */
let pedido = null;
let instalado = false;
const ouvintes = new Set();
const avisar = () => ouvintes.forEach((f) => f());

export function capturarPedidoDeInstalacao(win = globalThis.window) {
  if (!win?.addEventListener) return;
  win.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    pedido = e;
    avisar();
  });
  win.addEventListener('appinstalled', () => {
    instalado = true;
    pedido = null;
    avisar();
  });
}

export function assinarPedidoDeInstalacao(f) {
  ouvintes.add(f);
  return () => ouvintes.delete(f);
}

export const lerPedidoDeInstalacao = () => pedido;
export const appFoiInstalado = () => instalado;

/** Abre o convite nativo. @returns {Promise<'accepted'|'dismissed'|null>} */
export async function abrirPedidoDeInstalacao() {
  const atual = pedido;
  if (!atual) return null;
  pedido = null; // o mesmo evento não pode ser usado duas vezes
  avisar();
  atual.prompt();
  const escolha = await atual.userChoice.catch(() => null);
  return escolha?.outcome ?? null;
}
