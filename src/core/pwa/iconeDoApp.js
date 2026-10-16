/**
 * O ícone do app instalado segue o tema do CELULAR: logo claro (fundo branco)
 * com o aparelho no claro, logo escuro (fundo ink) com ele no escuro.
 *
 * Nenhum sistema troca o ícone da tela inicial sozinho quando o tema muda:
 * Android e iOS gravam o ícone NA INSTALAÇÃO. Então a escolha é feita ali —
 * os links do manifesto e do `apple-touch-icon` apontam para a versão do tema
 * de agora, e mudam junto se o tema mudar com a página aberta.
 *
 * Depois de instalado, a versão fica FIXADA no aparelho: o Chrome confere o
 * manifesto a cada abertura do app e, se o ícone mudasse a cada troca de tema,
 * reinstalaria o ícone (e pediria confirmação) todo dia para quem usa o tema
 * automático. Zero banco: a fixação mora no localStorage.
 */
export const CHAVE_ICONE_FIXADO = 'picklerush:icone-app';

export const MANIFESTO = Object.freeze({
  claro: '/manifest.webmanifest',
  escuro: '/manifest-escuro.webmanifest',
});

export const ICONE_APPLE = Object.freeze({
  claro: '/icones/apple-claro-180-v1.png',
  escuro: '/icones/apple-escuro-180-v1.png',
});

/** A versão do ícone: a fixada na instalação vence o tema de agora. */
export function varianteDoIcone({ fixada, escuro }) {
  if (fixada === 'claro' || fixada === 'escuro') return fixada;
  return escuro ? 'escuro' : 'claro';
}

function ler(storage) {
  try { return storage?.getItem(CHAVE_ICONE_FIXADO); } catch { return null; }
}

function fixar(storage, variante) {
  try { storage?.setItem(CHAVE_ICONE_FIXADO, variante); } catch { /* sem armazenamento: segue o tema */ }
}

/**
 * Aponta os links para a versão certa e mantém isso atualizado.
 * @returns {() => void} desliga os ouvintes (testes)
 */
export function iniciarIconeDoApp(win = globalThis.window) {
  const doc = win?.document;
  if (!doc?.querySelector || !win.matchMedia) return () => {};
  const storage = (() => { try { return win.localStorage; } catch { return null; } })();
  const tema = win.matchMedia('(prefers-color-scheme: dark)');
  const instalado = () => Boolean(win.matchMedia('(display-mode: standalone)').matches || win.navigator?.standalone);

  const atual = () => varianteDoIcone({ fixada: ler(storage), escuro: tema.matches });
  const aplicar = () => {
    const v = atual();
    doc.querySelector('link[rel="manifest"]')?.setAttribute('href', MANIFESTO[v]);
    doc.querySelector('link[rel="apple-touch-icon"]')?.setAttribute('href', ICONE_APPLE[v]);
  };

  // Já aberto como app e ainda sem versão fixada (instalado antes desta regra):
  // fixa a de hoje, para o ícone não ficar trocando.
  if (instalado() && !ler(storage)) fixar(storage, atual());
  aplicar();

  const aoInstalar = () => fixar(storage, atual());
  win.addEventListener?.('appinstalled', aoInstalar);
  tema.addEventListener?.('change', aplicar);
  return () => {
    win.removeEventListener?.('appinstalled', aoInstalar);
    tema.removeEventListener?.('change', aplicar);
  };
}
