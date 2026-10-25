/**
 * Documentos oficiais do clube (Central → Documentos; permissão `docs` ou `admin`).
 * É o acervo da federação com o clube no lugar dela: o mesmo rascunho → publicação
 * (número, código de integridade, endereço próprio), a mesma retificação com motivo,
 * errata, revogação e retirada (só o admin). Nada é gravado pelo navegador — quem
 * grava é o servidor (`clubDocs`). Ver `acervoScope.js`.
 */
import React, { useMemo } from 'react';
import { CLUB_PERM } from '@/modules/clubs/domain/association';
import { useClubDocsAll } from '@/modules/clubs/hooks/useClubDocs';
import { clubDocsEntity } from '../../federations/acervo/acervoScope';
import { DocumentosTab } from '../../federations/manage/FedAcervoPanel';

export default function ClubDocsPanel({ club, perms = [] }) {
  const docsQ = useClubDocsAll(club.id);
  const entity = useMemo(() => clubDocsEntity(club), [club]);
  return <DocumentosTab federation={entity} docsQ={docsQ} isAdmin={perms.includes(CLUB_PERM.ADMIN)} />;
}
