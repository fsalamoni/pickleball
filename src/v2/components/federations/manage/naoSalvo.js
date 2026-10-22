/**
 * Alterações não salvas na Central da federação. Um formulário com mudança
 * pendente chama `useAvisoNaoSalvo(alterado)`: fechar ou recarregar a aba do
 * navegador pergunta (beforeunload), e trocar de aba DENTRO da Central também
 * — `V2FederationManage` consulta `haAlteracaoNaoSalva()` antes de trocar.
 * Antes, um toque noutra aba jogava fora a página, as regras ou o ranking
 * que a pessoa vinha preenchendo, sem aviso.
 */
import { useEffect, useId } from 'react';

const pendentes = new Set();

export const haAlteracaoNaoSalva = () => pendentes.size > 0;
/** Depois que a pessoa confirmou sair sem salvar. */
export const descartarAlteracoes = () => pendentes.clear();

export function useAvisoNaoSalvo(alterado) {
  const id = useId();
  useEffect(() => {
    if (!alterado) return undefined;
    pendentes.add(id);
    const avisar = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', avisar);
    return () => { pendentes.delete(id); window.removeEventListener('beforeunload', avisar); };
  }, [alterado, id]);
}

/** Baixa um CSV que o Excel abre com os acentos certos (BOM UTF-8). */
export function baixarCsv(texto, nome) {
  const url = URL.createObjectURL(new Blob([`\uFEFF${texto}`], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
