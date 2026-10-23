/**
 * A FOLHA DE IMPRESSÃO das peças institucionais (dossiê do art. 36,
 * relatório de proteção da infância): o mesmo cabeçalho e rodapé do relatório
 * anual, e a impressão pela folha da plataforma (`cartao-folha-raiz` +
 * `imprimindo-cartao` no body, `src/index.css`). Tela e papel desenham a
 * MESMA folha: `children` vai inline e, oculto, num portal no body.
 */
import React from 'react';
import { createPortal } from 'react-dom';
import { fmtData, t } from '@/core/i18n';

export function imprimirFolha() {
  document.body.classList.add('imprimindo-cartao');
  const fim = () => { document.body.classList.remove('imprimindo-cartao'); window.removeEventListener('afterprint', fim); };
  window.addEventListener('afterprint', fim);
  requestAnimationFrame(() => { window.print(); setTimeout(fim, 2000); });
}

function Folha({ federation: f, title, label, children }) {
  return (
    <article className="space-y-6 bg-white p-6 text-sm text-ink sm:p-8" aria-label={label || title}>
      <header className="flex items-center gap-4 border-b border-gray-200 pb-4">
        {f.logo ? <img src={f.logo} alt="" className="h-14 w-14 rounded-lg object-contain" /> : <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-gray-100 font-display text-lg font-bold" aria-hidden="true">{(f.acronym || f.name || '').slice(0, 3)}</span>}
        <div className="min-w-0">
          <p className="font-display text-lg font-bold leading-tight">{f.name}</p>
          <p className="text-xs text-gray-600">{[f.acronym, f.cnpj ? t('CNPJ {n}', { n: f.cnpj }) : '', f.city].filter(Boolean).join(' · ')}</p>
        </div>
      </header>
      <h2 className="font-display text-xl font-bold">{title}</h2>
      {children}
      <footer className="border-t border-gray-200 pt-4 text-xs text-gray-600">
        {t('Gerado pela PickleRush em {data}, com os dados que a federação mantém na plataforma.', { data: fmtData(new Date()) })}
      </footer>
    </article>
  );
}

/** A folha na tela (moldura clara) e a cópia oculta que vai para o papel. */
export default function PrintSheet(props) {
  return (
    <>
      <div className="tema-claro overflow-hidden rounded-2xl border border-gray-200"><Folha {...props} /></div>
      {createPortal(<div className="cartao-folha-raiz recibo-folha tema-claro hidden" aria-hidden="true"><Folha {...props} /></div>, document.body)}
    </>
  );
}
