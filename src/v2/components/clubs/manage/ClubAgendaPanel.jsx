/**
 * Agenda oficial do clube (Central → Agenda; permissão `docs`, `sports` ou `admin`).
 * É o calendário da federação com o clube no lugar dela: o mesmo formulário (público,
 * só associados ou só a equipe), o mesmo adiar/cancelar/remarcar com motivo e histórico,
 * o mesmo aviso. A diretoria esportiva (`sports`) marca só a agenda esportiva; a
 * secretaria (`docs`) e a administração, qualquer evento. Nada é gravado pelo
 * navegador — quem grava é o servidor (`clubAgenda`). Ver `agendaScope.js`.
 */
import React, { useMemo } from 'react';
import { clubAgendaPerms } from '@/modules/clubs/domain/agenda';
import { clubAgendaEntity } from '../../federations/agenda/agendaScope';
import FedAgendaPanel from '../../federations/manage/FedAgendaPanel';

export default function ClubAgendaPanel({ club, perms = [] }) {
  const entity = useMemo(() => clubAgendaEntity(club, { staff: true, member: true }), [club]);
  return <FedAgendaPanel federation={entity} perms={clubAgendaPerms(perms)} />;
}
