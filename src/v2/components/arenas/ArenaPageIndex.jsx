/**
 * "Nesta página" — o índice da página da arena.
 *
 * Com os módulos integrados (Ondas BE a BO), a página da arena passou a juntar
 * dia de jogo, jogos abertos, reserva, torneios, aulas, preços, promoções,
 * planos, loja, avaliações e quadras — uma rolagem longa, sem índice. Quem
 * chega procurando a aula ou a loja precisava rolar tudo, e boa parte do que a
 * integração trouxe ficava abaixo da dobra, onde ninguém vê.
 *
 * O índice é montado a partir do que DE FATO renderizou: cada seção da página
 * vem num envoltório com `data-secao-arena` (o rótulo) e um `id` estável, e só
 * entra aqui o envoltório com conteúdo. Módulo desligado não aparece, seção
 * que não tem o que mostrar também não — o índice nunca promete o que a página
 * não tem. Com menos de 3 seções não há o que indexar, e ele some.
 *
 * Os ids também servem a links vindos de fora (`/arenas/:id#arena-loja`): a
 * página rola até a seção quando ela aparece — uma vez por âncora.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

/** Com menos que isto, a página é curta e o índice só ocupa espaço. */
export const MIN_SECOES_NO_INDICE = 3;

/**
 * As seções presentes dentro de `raiz`, na ordem da página.
 * Envoltório sem texto (a seção devolveu `null`, ou só um contêiner vazio)
 * não entra.
 * @param {Element|null} raiz
 * @returns {Array<{ id: string, rotulo: string }>}
 */
export function secoesPresentes(raiz) {
  if (!raiz) return [];
  return [...raiz.querySelectorAll('[data-secao-arena]')]
    .filter((el) => el.id && (el.textContent || '').trim() !== '')
    .map((el) => ({ id: el.id, rotulo: el.getAttribute('data-secao-arena') || el.id }));
}

const mesmaLista = (a, b) => a.length === b.length && a.every((s, i) => s.id === b[i].id && s.rotulo === b[i].rotulo);

function irPara(id) {
  const alvo = typeof document !== 'undefined' ? document.getElementById(id) : null;
  if (alvo && typeof alvo.scrollIntoView === 'function') {
    alvo.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

export default function ArenaPageIndex({ containerRef }) {
  const [secoes, setSecoes] = useState([]);
  const { hash } = useLocation();
  // A âncora para a qual já rolamos: uma âncora NOVA (outro link, na mesma
  // página) rola de novo; a mesma não rola a cada mudança da página.
  const rolouPara = useRef('');

  useEffect(() => {
    const raiz = containerRef?.current;
    if (!raiz) return undefined;
    let pedido = null;
    const ler = () => {
      pedido = null;
      const lista = secoesPresentes(raiz);
      setSecoes((antes) => (mesmaLista(antes, lista) ? antes : lista));
      // Link com âncora (`#arena-loja`): rola quando a seção aparece — ela
      // costuma chegar depois da página, com a consulta do módulo.
      const alvo = (hash || '').replace(/^#/, '');
      if (alvo && rolouPara.current !== alvo && lista.some((s) => s.id === alvo)) {
        rolouPara.current = alvo;
        irPara(alvo);
      }
    };
    ler();
    if (typeof MutationObserver === 'undefined') return undefined;
    // As seções chegam em momentos diferentes (cada módulo tem a sua
    // consulta); junta as mudanças de um quadro numa leitura só.
    const observador = new MutationObserver(() => {
      if (pedido != null) return;
      pedido = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(ler) : setTimeout(ler, 16);
    });
    observador.observe(raiz, { childList: true, subtree: true, characterData: true });
    return () => {
      observador.disconnect();
      if (pedido != null) {
        if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(pedido);
        clearTimeout(pedido);
      }
    };
  }, [containerRef, hash]);

  if (secoes.length < MIN_SECOES_NO_INDICE) return null;

  return (
    <nav aria-label="Seções desta arena" className="mt-4">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-gray-400">Nesta página</p>
      {/* No celular desliza (uma linha só, para não empurrar a reserva para
          baixo da dobra); da tela pequena para cima, quebra em linhas e mostra
          tudo — atalho escondido à direita é atalho que ninguém usa. */}
      <ul className="hide-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
        {secoes.map((s) => (
          <li key={s.id} className="shrink-0">
            <a
              href={`#${s.id}`}
              onClick={(e) => { e.preventDefault(); irPara(s.id); }}
              className="inline-flex items-center rounded-full border border-gray-200 bg-paper-pure px-3 py-1.5 text-xs font-semibold text-ink hover:border-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
            >
              {s.rotulo}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
