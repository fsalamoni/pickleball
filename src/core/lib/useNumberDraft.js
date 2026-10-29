import { useEffect, useRef, useState } from 'react';

const comoTexto = (v) => (v == null || (typeof v === 'number' && !Number.isFinite(v)) ? '' : String(v));

/**
 * Deixa apagar e redigitar um campo numérico (`type="number"`) controlado.
 *
 * 🐞 Muita tela converte já no `onChange` (`Number(v) || 1`, `Math.max(1, …)`,
 * `normalizePlayCourts`). Apagar o último dígito dá `''`, a conversão devolve
 * 1 (ou 0), o campo volta a mostrar o número e o apagar "não pega" — no
 * celular só funcionava selecionar tudo e digitar por cima.
 *
 * Enquanto o campo está em foco ele mostra o que a pessoa DIGITOU (o
 * rascunho); a tela continua recebendo o evento de sempre e guarda o que
 * quiser. Ao sair do campo, volta a valer o valor da tela (já ajustado ao
 * mínimo/máximo dela). Mudança que vem de FORA enquanto o campo está em foco
 * (limpar o formulário, botão de − e +) substitui o rascunho.
 *
 * Campo não controlado (`value` indefinido) não muda nada.
 *
 * @param {{ value?: unknown, onChange?: Function, onFocus?: Function, onBlur?: Function }} props
 * @returns {object} props a espalhar no `<input>` por cima das recebidas
 */
export function useNumberDraft({ value, onChange, onFocus, onBlur }) {
  const [rascunho, setRascunho] = useState(null); // null = fora de edição
  const digitando = useRef(false);

  // Roda antes do efeito de baixo (ordem de declaração): numa renderização
  // causada pela digitação, `digitando` ainda vale true e o rascunho fica.
  useEffect(() => {
    if (rascunho !== null && !digitando.current) setRascunho(comoTexto(value));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    digitando.current = false;
  });

  if (value === undefined) return {};
  return {
    value: rascunho ?? comoTexto(value),
    onFocus: (e) => {
      setRascunho(comoTexto(value));
      onFocus?.(e);
    },
    onChange: (e) => {
      digitando.current = true;
      setRascunho(e.target.value);
      onChange?.(e);
    },
    onBlur: (e) => {
      setRascunho(null);
      onBlur?.(e);
    },
  };
}
