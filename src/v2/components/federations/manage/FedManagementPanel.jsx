/**
 * ADMINISTRAÇÃO na Central (Bloco 5): `?aba=contratos-patrocinio` (os
 * contratos de patrocínio, módulo `sponsors`) e `?aba=patrimonio` (o
 * inventário com empréstimos, módulo `assets`). Toda escrita é do servidor
 * (`federationManagement`); o conselho fiscal só lê.
 */
import React from 'react';
import { canManageAssets, canManageContracts } from '@/modules/federations/domain/management';
import ContractsManager from '../management/ContractsManager';
import AssetsManager from '../management/AssetsManager';

export default function FedManagementPanel({ federation, perms = [], tab }) {
  return tab === 'patrimonio'
    ? <AssetsManager federation={federation} canEdit={canManageAssets(perms)} admin={perms.includes('admin')} />
    : <ContractsManager federation={federation} canEdit={canManageContracts(perms)} admin={perms.includes('admin')} />;
}
