/**
 * Peças comuns da SELEÇÃO E EDITAIS (Bloco 3): rótulos, tons e o botão de
 * abrir um arquivo da inscrição. A régua é `domain/selection.js`.
 */
import React, { useState } from 'react';
import { toast } from 'sonner';
import { Paperclip } from 'lucide-react';
import { MANUAL_CATEGORY } from '@/modules/federations/domain/selection';
import { openGrantFile } from '@/modules/federations/services/selectionService';
import { V2Button } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';
import { classeLabel } from '../FedPublicBlocks';
import { baixarBlob } from '../acervo/acervoFiles';

export const TOM_CONVITE = { invited: 'amber', accepted: 'green', declined: 'neutral', expired: 'neutral', cancelled: 'red' };
export const TOM_CONVOCACAO = { draft: 'neutral', open: 'amber', closed: 'green', cancelled: 'red' };
export const TOM_EDITAL = { draft: 'neutral', open: 'green', review: 'amber', result: 'amber', final: 'neutral', cancelled: 'red' };
export const TOM_INSCRICAO = { submitted: 'amber', withdrawn: 'neutral', approved: 'green', waitlisted: 'amber', rejected: 'red' };

/** A categoria de um convite (a escolhida a dedo diz o que a comissão escreveu). */
export const categoriaDoConvite = (inv) => (inv?.category_key === MANUAL_CATEGORY ? (inv.label || t('Escolha da comissão')) : classeLabel(inv || {}));

/** "12/03 a 15/03/2027 · Brasília". */
export function periodoDoEvento(c) {
  const br = (iso) => (iso ? String(iso).split('-').reverse().join('/') : '');
  const datas = c?.ends_at && c.ends_at !== c.starts_at ? t('{de} a {ate}', { de: br(c.starts_at), ate: br(c.ends_at) }) : br(c?.starts_at);
  return [datas, c?.place].filter(Boolean).join(' · ');
}

/** Abre um arquivo da inscrição (o servidor confere quem pode e registra o acesso da equipe). */
export function GrantFileButton({ applicationId, fileKey, file }) {
  const [abrindo, setAbrindo] = useState(false);
  const abrir = async () => {
    setAbrindo(true);
    try {
      const r = await openGrantFile(applicationId, fileKey);
      const bytes = Uint8Array.from(atob(r.base64), (c) => c.charCodeAt(0));
      baixarBlob(new Blob([bytes], { type: r.contentType }), file?.name || `${file?.label || t('Documento')}.${(r.contentType || '').split('/')[1] || 'bin'}`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setAbrindo(false);
    }
  };
  return (
    <V2Button type="button" size="sm" variant="ghost" onClick={abrir} disabled={abrindo}>
      <Paperclip className="h-4 w-4" aria-hidden="true" />{abrindo ? t('Abrindo…') : (file?.label || t('Documento'))}
    </V2Button>
  );
}
