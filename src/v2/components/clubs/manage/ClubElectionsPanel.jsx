/**
 * Eleições do clube (Central → Diretoria → Eleições; permissão `admin`).
 * É o painel de eleições da federação com o clube no lugar dela: o mesmo assistente do edital
 * (cargos, calendário, colégio, comissão), a mesma condução (chapas, impugnações, votação
 * secreta, apuração, ata) e, no fim, a POSSE dos eleitos como cargos da diretoria. Nada é
 * gravado pelo navegador: quem grava é o servidor (`clubElections`). Ver `electionsScope.js`.
 */
import React, { useMemo } from 'react';
import { clubElectionsEntity, useScopedAllElections } from '../../federations/elections/electionsScope';
import FedElectionsPanel from '../../federations/manage/FedElectionsPanel';

export default function ClubElectionsPanel({ club }) {
  const entity = useMemo(() => clubElectionsEntity(club), [club]);
  const q = useScopedAllElections(entity);
  return <FedElectionsPanel federation={entity} electionsQ={q} />;
}
