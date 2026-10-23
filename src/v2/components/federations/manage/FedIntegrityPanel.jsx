/**
 * JOGO LIMPO na Central: `?aba=equipamentos` (a lista homologada, competições
 * e admin) e `?aba=antidopagem` (o texto da página, só o admin).
 */
import React from 'react';
import EquipmentManager from '../integrity/EquipmentManager';
import AntidopingSettings from '../integrity/AntidopingSettings';

export default function FedIntegrityPanel({ federation, perms = [], tab }) {
  return tab === 'antidopagem'
    ? <AntidopingSettings federation={federation} />
    : <EquipmentManager federation={federation} admin={perms.includes('admin')} />;
}
