/**
 * Os documentos que o plano exige, um campo de arquivo para cada (PDF ou
 * imagem até 5 MB). Usado no pedido de filiação da pessoa e no do clube ou
 * arena: os arquivos ficam escolhidos aqui e sobem depois que o servidor
 * grava a filiação (a regra do documento exige a filiação existindo).
 */
import React from 'react';
import { toast } from 'sonner';
import { FileUp, Trash2 } from 'lucide-react';
import { docLabel, validateDocumentFile } from '@/modules/federations/domain/privateData';
import { V2Button, V2Surface } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';

export default function DocumentsUploadList({ docs, arquivos, onChange, descricao, titulo }) {
  const escolher = (key, file) => {
    if (!file) return;
    const erro = validateDocumentFile(file);
    if (erro) { toast.error(erro); return; }
    onChange({ ...arquivos, [key]: file });
  };
  const tirar = (key) => { const x = { ...arquivos }; delete x[key]; onChange(x); };
  return (
    <V2Surface className="space-y-4" data-dica="federacao-filiar-documentos">
      <div>
        <h2 className="font-display text-lg font-bold text-ink">{titulo || t('Documentos do plano')}</h2>
        <p className="text-sm text-gray-600">{descricao || t('PDF ou imagem, até 5 MB cada. Só você e a secretaria da federação veem os arquivos. O que faltar agora dá para enviar depois, pela página da federação.')}</p>
      </div>
      <ul className="space-y-3">
        {docs.map((d) => {
          const arq = arquivos[d.key];
          const id = `fj-doc-${d.key}`;
          return (
            <li key={d.key} className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-100 p-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">{docLabel(d)}</p>
                <p className="truncate text-xs text-gray-500">{arq ? arq.name : t('Nenhum arquivo escolhido')}</p>
              </div>
              {arq && <V2Button type="button" size="sm" variant="ghost" aria-label={t('Tirar o arquivo de {doc}', { doc: docLabel(d) })} onClick={() => tirar(d.key)}><Trash2 className="h-4 w-4" /></V2Button>}
              <label htmlFor={id} className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full border border-gray-200 px-3 py-1.5 text-sm font-semibold text-ink hover:border-ink focus-within:ring-4 focus-within:ring-acid/30 coarse:min-h-11">
                <FileUp className="h-4 w-4" aria-hidden="true" />{arq ? t('Trocar') : t('Escolher arquivo')}
                <input id={id} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only" aria-label={t('Arquivo do documento: {tipo}', { tipo: docLabel(d) })} onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; escolher(d.key, file); }} />
              </label>
            </li>
          );
        })}
      </ul>
    </V2Surface>
  );
}
