/**
 * Ferramentas de LISTA da Central da federação — as mesmas em todo painel:
 *  - `useBuscaLista(itens, campos)`: busca por texto (sem acento, sem caixa)
 *    e "Mostrar mais" (30 por vez), para a lista não parar no 20º item;
 *  - `useFiltroNaUrl(chave, padrao)`: o filtro mora na URL (`?filtro=`), então
 *    a faixa "Precisa de você" abre a lista já filtrada e recarregar não perde;
 *  - `<BuscaLista>` e `<MostrarMais>`: as peças de tela.
 * Zero banco: tudo sobre o que o painel já carregou.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { V2Button, V2SearchInput } from '@/v2/ui/primitives';
import { t, tn } from '@/core/i18n';

export const POR_VEZ = 30;

export const normalizaBusca = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Itens cujo texto (os `campos`, função ou nomes de chave) contém o termo. */
export function filtraPorTermo(itens = [], termo = '', campos = []) {
  const q = normalizaBusca(termo.trim());
  if (!q) return itens;
  const texto = typeof campos === 'function' ? campos : (x) => campos.map((c) => x?.[c]).join(' ');
  return itens.filter((x) => normalizaBusca(texto(x)).includes(q));
}

export function useBuscaLista(itens = [], campos = [], { porVez = POR_VEZ } = {}) {
  const [termo, setTermo] = useState('');
  const [limite, setLimite] = useState(porVez);
  useEffect(() => { setLimite(porVez); }, [termo, porVez]);
  const filtrados = useMemo(() => filtraPorTermo(itens, termo, campos), [itens, termo, campos]);
  return {
    termo, setTermo, filtrados,
    visiveis: filtrados.slice(0, limite),
    restam: Math.max(0, filtrados.length - limite),
    mostrarMais: () => setLimite((n) => n + porVez),
  };
}

/** O filtro em `?{chave}=`; o padrão não vai para a URL. Preserva os outros parâmetros (a aba). */
export function useFiltroNaUrl(chave, padrao, validos) {
  const [params, setParams] = useSearchParams();
  const bruto = params.get(chave);
  const valor = bruto && (!validos || validos.includes(bruto)) ? bruto : padrao;
  const set = useCallback((v) => {
    setParams((p) => { const n = new URLSearchParams(p); if (!v || v === padrao) n.delete(chave); else n.set(chave, v); return n; }, { replace: true });
  }, [setParams, chave, padrao]);
  return [valor, set];
}

export function BuscaLista({ id, value, onChange, placeholder, total, achados, className = '' }) {
  return (
    <div className={className}>
      <V2SearchInput id={id} type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder || t('Buscar')} aria-label={placeholder || t('Buscar')} />
      {value.trim() && total != null && <p className="mt-1 text-xs text-gray-500" aria-live="polite">{tn(achados, '{n} encontrado', '{n} encontrados')}</p>}
    </div>
  );
}

export function MostrarMais({ restam, onClick }) {
  if (!(restam > 0)) return null;
  return (
    <div className="flex justify-center">
      <V2Button type="button" variant="secondary" size="sm" onClick={onClick}>{t('Mostrar mais ({n})', { n: Math.min(restam, POR_VEZ) })}</V2Button>
    </div>
  );
}
