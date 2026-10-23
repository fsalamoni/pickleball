/**
 * CERTIDÕES E INCENTIVO (Central → Certidões e incentivo): o cofre de certidões e os projetos
 * da Lei de Incentivo ao Esporte. Financeiro e admin gerem; o conselho fiscal
 * lê; só a administração apaga.
 */
import React from 'react';
import { canManageInstitutional } from '@/modules/federations/domain/institutional';
import CertificatesVault from '../institutional/CertificatesVault';
import IncentiveProjects from '../institutional/IncentiveProjects';

export default function FedInstitutionalPanel({ federation, perms, tab }) {
  const canEdit = canManageInstitutional(perms);
  const admin = perms.includes('admin');
  return tab === 'lei-incentivo'
    ? <IncentiveProjects federation={federation} canEdit={canEdit} admin={admin} />
    : <CertificatesVault federation={federation} canEdit={canEdit} admin={admin} />;
}
