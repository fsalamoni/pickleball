/**
 * SELEÇÃO E EDITAIS na Central (Bloco 3): `?aba=convocacoes` (a delegação para
 * os campeonatos nacionais) e `?aba=editais` (apoio ao atleta). Quem prepara é
 * a equipe de competições; o financeiro registra custos pagos e pagamentos dos
 * editais. Toda escrita é do servidor (`federationSelection`).
 */
import React from 'react';
import { FED_PERMISSION } from '@/modules/federations/domain/constants';
import CallupsManager from '../selection/CallupsManager';
import GrantsManager from '../selection/GrantsManager';

export default function FedSelectionPanel({ federation, tab, perms = [] }) {
  const admin = perms.includes(FED_PERMISSION.ADMIN);
  const papel = { equipe: admin || perms.includes(FED_PERMISSION.COMPETITIONS), financeiro: admin || perms.includes(FED_PERMISSION.FINANCE) };
  return tab === 'editais'
    ? <GrantsManager federation={federation} papel={papel} />
    : <CallupsManager federation={federation} papel={papel} />;
}
