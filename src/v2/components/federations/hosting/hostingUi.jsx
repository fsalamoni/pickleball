/**
 * Peças comuns de SEDES E COPA (rodada 3, Bloco 3b): tons, datas e o botão
 * que abre um arquivo da proposta. A régua é `domain/hosting.js`.
 */
import React, { useState } from 'react';
import { toast } from 'sonner';
import { Paperclip } from 'lucide-react';
import { openProposalFile } from '@/modules/federations/services/hostingService';
import { V2Button } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';
import { baixarBlob } from '../acervo/acervoFiles';

export const TOM_EDITAL_SEDE = { draft: 'neutral', intent: 'green', proposal: 'amber', review: 'amber', result: 'neutral', cancelled: 'red' };
export const TOM_CANDIDATURA = { intent: 'amber', shortlisted: 'green', not_shortlisted: 'neutral', proposal: 'amber', withdrawn: 'neutral', winner: 'green', not_selected: 'neutral' };
export const TOM_COPA = { draft: 'neutral', open: 'green', closed: 'amber', cancelled: 'red' };
export const TOM_ELENCO = { draft: 'neutral', submitted: 'amber', approved: 'green', returned: 'red', withdrawn: 'neutral' };

export const br = (iso) => (iso ? String(iso).split('-').reverse().join('/') : '');

/** "12/03 a 15/03/2027". */
export function periodo(de, ate) {
  return ate && ate !== de ? t('{de} a {ate}', { de: br(de), ate: br(ate) }) : br(de);
}

/** "Porto Alegre/RS". */
export const cidadeUf = (x) => [x?.org_city, x?.org_state].filter(Boolean).join('/');

/** Abre um arquivo da proposta (o servidor confere quem pode e registra o acesso da equipe). */
export function ProposalFileButton({ federationId, entryId, index, file }) {
  const [abrindo, setAbrindo] = useState(false);
  const abrir = async () => {
    setAbrindo(true);
    try {
      const r = await openProposalFile(federationId, entryId, index);
      const bytes = Uint8Array.from(atob(r.base64), (c) => c.charCodeAt(0));
      baixarBlob(new Blob([bytes], { type: r.contentType }), r.name || file?.name || t('Documento'));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setAbrindo(false);
    }
  };
  return (
    <V2Button type="button" size="sm" variant="ghost" onClick={abrir} disabled={abrindo}>
      <Paperclip className="h-4 w-4" aria-hidden="true" />{abrindo ? t('Abrindo…') : (file?.name || t('Documento'))}
    </V2Button>
  );
}
