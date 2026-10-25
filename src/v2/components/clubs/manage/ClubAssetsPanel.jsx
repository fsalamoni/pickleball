/**
 * Patrimônio do clube (Central → Patrimônio; o financeiro, a diretoria esportiva e a
 * administração gerem; o conselho fiscal só lê). É o patrimônio da federação com o clube no
 * lugar dela: o inventário com a quantidade e o empréstimo com a devolução registrada. Nada é
 * gravado pelo navegador: quem grava é o servidor (`clubManagement`). Ver `managementScope.js`.
 */
import React, { useMemo } from 'react';
import { CLUB_PERM } from '@/modules/clubs/domain/association';
import AssetsManager from '../../federations/management/AssetsManager';
import { clubManagementEntity } from '../../federations/management/managementScope';

export default function ClubAssetsPanel({ club, perms = [] }) {
  const entity = useMemo(() => clubManagementEntity(club), [club]);
  const admin = perms.includes(CLUB_PERM.ADMIN);
  const canEdit = admin || perms.includes(CLUB_PERM.FINANCE) || perms.includes(CLUB_PERM.SPORTS);
  return <AssetsManager federation={entity} canEdit={canEdit} admin={admin} />;
}
