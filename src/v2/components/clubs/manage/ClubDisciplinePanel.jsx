/**
 * Disciplina e ouvidoria do clube (Central → Disciplina; permissão `discipline` ou `admin`).
 * É a disciplina da federação com o clube no lugar dela: as mesmas quatro sanções
 * (advertência, suspensão, multa, exclusão da filiação), o mesmo recurso — uma vez só — e
 * a mesma ouvidoria, com protocolo e manifestação anônima. Nada é gravado pelo navegador:
 * quem grava é o servidor (`clubDiscipline`). Ver `disciplineScope.js`.
 */
import React, { useMemo } from 'react';
import { useClubCases, useClubOmbud } from '@/modules/clubs/hooks/useClubDiscipline';
import { clubDisciplineEntity } from '../../federations/manage/disciplineScope';
import FedDisciplinePanel from '../../federations/manage/FedDisciplinePanel';

export default function ClubDisciplinePanel({ club, affiliationsQ, tab }) {
  const entity = useMemo(() => clubDisciplineEntity(club), [club]);
  // Cada aba consulta só a sua coleção (a outra é lida pela mesma regra, mas é peso à toa).
  const sanctionsQ = useClubCases(club.id, { enabled: tab !== 'ouvidoria' });
  const reportsQ = useClubOmbud(club.id, { enabled: tab === 'ouvidoria' });
  return <FedDisciplinePanel federation={entity} membersQ={affiliationsQ} sanctionsQ={sanctionsQ} reportsQ={reportsQ} tab={tab} />;
}
