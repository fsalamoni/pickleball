/**
 * O COMPROVANTE do "Já paguei" (Etapa 3): o campo de anexar (quem paga) e o
 * botão de abrir (quem paga e o financeiro/secretaria). O arquivo fica na pasta
 * de quem pagou no Storage — só ele lê —, e a equipe o abre pelo servidor
 * (`federationDocument` com `chargeId`), que registra o acesso.
 */
import React, { useState } from 'react';
import { toast } from 'sonner';
import { Paperclip } from 'lucide-react';
import { fetchChargeProof } from '@/modules/federations/services/federationService';
import { validateDocumentFile } from '@/modules/federations/domain/privateData';
import { V2Button } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';
import { baixarBlob } from './acervo/acervoFiles';

export const temComprovante = (charge) => Boolean(charge?.declared_proof?.path);

/** Baixa o comprovante da cobrança (o servidor confere quem pode). */
export async function abrirComprovante(charge) {
  const r = await fetchChargeProof(charge.id);
  const bytes = Uint8Array.from(atob(r.base64), (c) => c.charCodeAt(0));
  const ext = (r.contentType || '').split('/')[1]?.replace('jpeg', 'jpg') || 'bin';
  baixarBlob(new Blob([bytes], { type: r.contentType }), charge.declared_proof?.name || `${t('Comprovante')} - ${charge.payer_name || ''}.${ext}`);
}

export function ChargeProofButton({ charge, size = 'sm' }) {
  const [abrindo, setAbrindo] = useState(false);
  if (!temComprovante(charge)) return null;
  const ver = async () => { setAbrindo(true); try { await abrirComprovante(charge); } catch (e) { toast.error(e.message); } finally { setAbrindo(false); } };
  return (
    <V2Button type="button" size={size} variant="ghost" onClick={ver} disabled={abrindo}>
      <Paperclip className="h-4 w-4" aria-hidden="true" />{abrindo ? t('Abrindo…') : t('Comprovante')}
    </V2Button>
  );
}

/** Campo de arquivo do comprovante: PDF ou imagem até 5 MB; o erro aparece na hora. */
export function ChargeProofField({ file, onChange, id = 'comprovante-pagamento' }) {
  const [erro, setErro] = useState('');
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-semibold text-ink">{t('Comprovante (opcional)')}</label>
      <input
        id={id}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-full file:border-0 file:bg-paper file:px-4 file:py-2 file:text-sm file:font-semibold file:text-ink"
        onChange={(e) => {
          const f = e.target.files?.[0] || null;
          const msg = f ? validateDocumentFile(f) : '';
          setErro(msg);
          onChange(msg ? null : f);
        }}
      />
      <p className={erro ? 'text-xs text-red-600' : 'text-xs text-gray-500'}>{erro || (file ? file.name : t('PDF ou imagem até 5 MB. Ajuda o financeiro a confirmar mais rápido.'))}</p>
    </div>
  );
}
