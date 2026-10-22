/**
 * Central → Filiados e cadastrados → SEGURO E OCORRÊNCIAS (módulo `insurance`).
 *
 * A apólice (o admin cadastra; filiado vê em Minha filiação) e a fila de
 * ocorrências: lesão, acidente ou mal súbito em treino ou evento, registrados
 * pela pessoa ou pela equipe, com o andamento (aberta → sinistro → encerrada).
 * As ocorrências só o servidor grava (`federationRegularity`).
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { LifeBuoy, Plus } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFederationMutation } from '@/modules/federations/hooks/useFederations';
import { useFederationIncidents } from '@/modules/federations/hooks/useRegularity';
import { regularityAction, updateFederationInsurance } from '@/modules/federations/services/regularityService';
import {
  INCIDENT_STATUS, INCIDENT_STATUS_LABELS, INSURANCE_COVERS, INSURANCE_COVERS_LABELS, insuranceState, validateInsurance,
} from '@/modules/federations/domain/regularity';
import { isoDate } from '@/modules/federations/domain/membership';
import { FED_PERMISSION } from '@/modules/federations/domain/constants';
import { V2Badge, V2Button, V2ErrorState, V2Field, V2Input, V2Select, V2Skeleton, V2Surface, V2Textarea } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';
import { quando } from '../federationUi';
import { IncidentDialog, IncidentItem } from '../FedRegularity';

const VAZIA = { insurer: '', policy: '', valid_from: '', valid_until: '', coverage: '', phone: '', how_to_claim: '', covers: INSURANCE_COVERS.ACTIVE };

function Apolice({ federation, podeEditar }) {
  const { user } = useAuth();
  const ins = federation.insurance;
  const [editando, setEditando] = useState(false);
  const [f, setF] = useState({ ...VAZIA, ...(ins || {}), valid_from: ins?.valid_from || '' });
  const [erros, setErros] = useState({});
  const set = (p) => { setF((x) => ({ ...x, ...p })); setErros({}); };
  const salvar = useFederationMutation((valor) => updateFederationInsurance(federation.id, valor, { uid: user?.uid }));
  const estado = insuranceState(ins, isoDate());
  const enviar = (e) => {
    e.preventDefault();
    const r = validateInsurance(f);
    if (!r.ok) { setErros(r.errors); return; }
    salvar.mutate(r.value, { onSuccess: () => { toast.success(t('Apólice salva.')); setEditando(false); }, onError: (er) => toast.error(er.message) });
  };
  if (editando) {
    return (
      <form onSubmit={enviar} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <V2Field label={t('Seguradora')} htmlFor="ap-seg" error={erros.insurer}><V2Input id="ap-seg" maxLength={80} value={f.insurer} onChange={(e) => set({ insurer: e.target.value })} /></V2Field>
          <V2Field label={t('Número da apólice')} htmlFor="ap-num"><V2Input id="ap-num" maxLength={40} value={f.policy} onChange={(e) => set({ policy: e.target.value })} /></V2Field>
          <V2Field label={t('Início da vigência (opcional)')} htmlFor="ap-ini" error={erros.valid_from}><V2Input id="ap-ini" type="date" value={f.valid_from || ''} onChange={(e) => set({ valid_from: e.target.value })} /></V2Field>
          <V2Field label={t('Fim da vigência')} htmlFor="ap-fim" error={erros.valid_until}><V2Input id="ap-fim" type="date" value={f.valid_until} onChange={(e) => set({ valid_until: e.target.value })} /></V2Field>
          <V2Field label={t('Quem está coberto')} htmlFor="ap-pub"><V2Select id="ap-pub" value={f.covers} onChange={(e) => set({ covers: e.target.value })}>{Object.values(INSURANCE_COVERS).map((c) => <option key={c} value={c}>{t(INSURANCE_COVERS_LABELS[c])}</option>)}</V2Select></V2Field>
          <V2Field label={t('Telefone da seguradora')} htmlFor="ap-tel"><V2Input id="ap-tel" type="tel" maxLength={30} value={f.phone} onChange={(e) => set({ phone: e.target.value })} /></V2Field>
        </div>
        <V2Field label={t('O que a apólice cobre')} htmlFor="ap-cob"><V2Textarea id="ap-cob" rows={3} maxLength={800} value={f.coverage} onChange={(e) => set({ coverage: e.target.value })} placeholder={t('Ex.: morte acidental R$ 20 mil, invalidez, despesas médicas até R$ 3 mil.')} /></V2Field>
        <V2Field label={t('Como acionar')} htmlFor="ap-acio"><V2Textarea id="ap-acio" rows={3} maxLength={800} value={f.how_to_claim} onChange={(e) => set({ how_to_claim: e.target.value })} placeholder={t('Ex.: avise a federação em até 48 h e guarde laudos e notas fiscais.')} /></V2Field>
        <div className="flex flex-wrap justify-end gap-2">
          {ins && <V2Button type="button" variant="danger" disabled={salvar.isPending} onClick={() => salvar.mutate(null, { onSuccess: () => { toast.success(t('Apólice removida.')); setEditando(false); }, onError: (er) => toast.error(er.message) })}>{t('Remover a apólice')}</V2Button>}
          <V2Button type="button" variant="ghost" onClick={() => setEditando(false)}>{t('Voltar')}</V2Button>
          <V2Button type="submit" disabled={salvar.isPending}>{t('Salvar apólice')}</V2Button>
        </div>
      </form>
    );
  }
  return (
    <div className="space-y-2 text-sm">
      {estado.state === 'none' ? <p className="text-gray-600">{t('Nenhuma apólice cadastrada. Filiados verão as instruções de como acionar o seguro assim que você cadastrar.')}</p> : (
        <>
          <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">{ins.insurer}{ins.policy ? ` · ${t('apólice {n}', { n: ins.policy })}` : ''}
            <V2Badge tone={{ active: estado.days_left <= 30 ? 'amber' : 'green', expired: 'red', future: 'blue' }[estado.state]}>{estado.state === 'expired' ? t('Vencida em {data}', { data: quando(ins.valid_until) }) : estado.state === 'future' ? t('Começa em {data}', { data: quando(ins.valid_from) }) : t('Vigente até {data}', { data: quando(ins.valid_until) })}</V2Badge>
          </p>
          <p className="text-gray-600">{t(INSURANCE_COVERS_LABELS[ins.covers] || INSURANCE_COVERS_LABELS.active_members)}</p>
          {ins.coverage && <p className="whitespace-pre-line text-gray-700">{ins.coverage}</p>}
        </>
      )}
      {podeEditar && <V2Button type="button" size="sm" variant="secondary" onClick={() => setEditando(true)}>{ins ? t('Editar a apólice') : t('Cadastrar a apólice')}</V2Button>}
    </div>
  );
}

function Andamento({ federation, incident }) {
  const [f, setF] = useState({ status: incident.status, claimNumber: incident.claim_number || '', note: '' });
  const m = useFederationMutation((payload) => regularityAction(federation.id, 'incident_update', payload));
  const mudou = f.status !== incident.status || f.claimNumber !== (incident.claim_number || '') || f.note.trim();
  return (
    <form className="grid gap-3 pt-2 sm:grid-cols-[10rem_10rem_1fr_auto] sm:items-end" onSubmit={(e) => {
      e.preventDefault();
      if (f.status === INCIDENT_STATUS.CLAIM && !f.claimNumber.trim()) { toast.error(t('Informe o número do sinistro.')); return; }
      m.mutate({ incidentId: incident.id, ...f }, { onSuccess: () => { toast.success(t('Ocorrência atualizada.')); setF((x) => ({ ...x, note: '' })); }, onError: (er) => toast.error(er.message) });
    }}>
      <V2Field label={t('Situação')} htmlFor={`oc-st-${incident.id}`}><V2Select id={`oc-st-${incident.id}`} value={f.status} onChange={(e) => setF((x) => ({ ...x, status: e.target.value }))}>{Object.values(INCIDENT_STATUS).map((s) => <option key={s} value={s}>{t(INCIDENT_STATUS_LABELS[s])}</option>)}</V2Select></V2Field>
      <V2Field label={t('Nº do sinistro')} htmlFor={`oc-sin-${incident.id}`}><V2Input id={`oc-sin-${incident.id}`} maxLength={40} value={f.claimNumber} onChange={(e) => setF((x) => ({ ...x, claimNumber: e.target.value }))} /></V2Field>
      <V2Field label={t('Anotação (opcional)')} htmlFor={`oc-nota-${incident.id}`}><V2Input id={`oc-nota-${incident.id}`} maxLength={300} value={f.note} onChange={(e) => setF((x) => ({ ...x, note: e.target.value }))} /></V2Field>
      <V2Button type="submit" size="sm" disabled={!mudou || m.isPending}>{t('Salvar')}</V2Button>
    </form>
  );
}

export default function FedInsurancePanel({ federation, membersQ, perms = [] }) {
  const [registrando, setRegistrando] = useState(false);
  const [filtro, setFiltro] = useState('abertas');
  const incidentsQ = useFederationIncidents(federation.id);
  const podeEditar = perms.includes(FED_PERMISSION.ADMIN);
  const podeAtender = podeEditar || perms.includes(FED_PERMISSION.MEMBERS) || perms.includes(FED_PERMISSION.COMPETITIONS);
  const lista = useMemo(() => (incidentsQ.data || []).filter((x) => (filtro === 'todas' ? true : x.status !== INCIDENT_STATUS.CLOSED)), [incidentsQ.data, filtro]);
  return (
    <div className="space-y-4">
      <V2Surface className="space-y-3" data-dica="federacao-seguro-apolice">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink"><LifeBuoy className="h-5 w-5" aria-hidden="true" />{t('Apólice do seguro esportivo')}</h2>
        <Apolice key={JSON.stringify(federation.insurance || {})} federation={federation} podeEditar={podeEditar} />
      </V2Surface>
      <V2Surface className="space-y-3" data-dica="federacao-seguro-ocorrencias">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold text-ink">{t('Ocorrências')}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <V2Select aria-label={t('Mostrar')} value={filtro} onChange={(e) => setFiltro(e.target.value)}><option value="abertas">{t('Em andamento')}</option><option value="todas">{t('Todas')}</option></V2Select>
            {podeAtender && <V2Button type="button" size="sm" onClick={() => setRegistrando(true)}><Plus className="h-4 w-4" aria-hidden="true" />{t('Registrar ocorrência')}</V2Button>}
          </div>
        </div>
        {incidentsQ.isError ? <V2ErrorState inline title={t('As ocorrências não carregaram')} onRetry={() => incidentsQ.refetch()} />
          : incidentsQ.isLoading ? <V2Skeleton lines={3} />
            : !lista.length ? <p className="text-sm text-gray-500">{filtro === 'todas' ? t('Nenhuma ocorrência registrada.') : t('Nenhuma ocorrência em andamento.')}</p>
              : <ul className="space-y-2">{lista.map((x) => <IncidentItem key={x.id} incident={x}>{podeAtender && <Andamento federation={federation} incident={x} />}</IncidentItem>)}</ul>}
      </V2Surface>
      {registrando && <IncidentDialog federation={federation} members={membersQ?.data || []} onClose={() => setRegistrando(false)} />}
    </div>
  );
}
