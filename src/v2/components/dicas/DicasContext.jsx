/**
 * O contexto das DICAS — quem liga, qual guia está em andamento, qual ponto
 * está aberto. Quem monta é o `DicasProvider` (no `V2Layout`).
 *
 * Fora do provedor (telas fora do layout, testes de componente) o hook devolve
 * um contexto INERTE: tudo desligado e as ações sem efeito. Assim qualquer
 * componente pode perguntar `useDicas()` sem se preocupar com onde está.
 */
import { createContext, useContext } from 'react';

const nada = () => {};

/** O contexto quando não há provedor (ou a flag está desligada). */
export const DICAS_INERTES = Object.freeze({
  on: false,
  ligadas: false,
  feitos: Object.freeze([]),
  vistos: Object.freeze([]),
  guia: null,
  painelAberto: false,
  ponto: null,
  alternar: nada,
  iniciarGuia: nada,
  irParaPasso: nada,
  encerrarGuia: nada,
  abrirPainel: nada,
  fecharPainel: nada,
  abrirPonto: nada,
  fecharPonto: nada,
  marcarVisto: nada,
  recomecarVistos: nada,
});

export const DicasContext = createContext(DICAS_INERTES);

/** As dicas desta pessoa, nesta tela. */
export function useDicas() {
  return useContext(DicasContext) || DICAS_INERTES;
}
