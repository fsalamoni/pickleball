/**
 * REDE E DESENVOLVIMENTO na Central: `?aba=embaixadores` e `?aba=selo-clubes`
 * (a secretaria e o admin; as regras dos dois programas, só o admin).
 */
import React from 'react';
import AmbassadorsManager from '../development/AmbassadorsManager';
import SealsManager from '../development/SealsManager';

export default function FedDevelopmentPanel({ federation, perms = [], tab }) {
  const admin = perms.includes('admin');
  return tab === 'selo-clubes'
    ? <SealsManager federation={federation} admin={admin} />
    : <AmbassadorsManager federation={federation} admin={admin} />;
}
