/**
 * A MOLDURA de toda página do app (docs/45-MOLDURA-DAS-PAGINAS.md): uma largura
 * só, centralizada, sem recuo próprio. Antes eram 720, 1000, 1200, 1400 px e
 * "a tela toda", e trocar de tela fazia o título, o herói e os botões pularem
 * de lugar. O recuo lateral e o de cima vêm do `<main>` do V2Layout; a barra de
 * abas dos menus usa a mesma moldura, para começar na mesma linha do conteúdo.
 * Arquivo sem dependências de propósito: as telas de erro entram no pacote
 * inicial e importam daqui, não de `primitives.jsx`.
 * Guarda em `src/core/guards/larguraDePagina.test.js`.
 */
export const PAGE_FRAME = 'mx-auto w-full max-w-[1200px]';

/** Título de página (h1) e título sobre o herói escuro: um tamanho só. */
export const TITLE_TYPE = 'font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl';
export const PAGE_TITLE = `${TITLE_TYPE} text-ink`;
export const HERO_TITLE = `${TITLE_TYPE} text-white`;
