/**
 * PROFESSORES da federação (Central → Professores; permissão `courses` ou
 * `admin`; módulo `coach_licenses`): as LICENÇAS (pedidos, renovações,
 * concessão com os requisitos conferidos pelo servidor, suspensão, cassação)
 * e os NÍVEIS da licença. Toda escrita é do servidor (`federationCoaching`);
 * a régua é `domain/coachLicenses.js`.
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, BadgeCheck, Plus, Save, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { coachingAction } from '@/modules/federations/services/coachingService';
import { useFederationMutation } from '@/modules/federations/hooks/useFederations';
import {
  LICENSE_LIMITS, licenseState, normalizeCoachRules, sortLicenses, validateCoachRules,
} from '@/modules/federations/domain/coachLicenses';
import { isoDateBR } from '@/modules/federations/domain/referees';
import FedPersonPicker from '../manage/FedPersonPicker';
import { BuscaLista, MostrarMais, useBuscaLista, useFiltroNaUrl } from '../manage/listTools';
import { useAvisoNaoSalvo } from '../manage/naoSalvo';
import { V2Avatar, V2Button, V2EmptyState, V2ErrorState, V2Field, V2FilterChip, V2Input, V2Select, V2Skeleton, V2Surface, V2Textarea, V2Toggle } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';
import { dataCurta } from '../referees/refUi';
import { LicenseBadge, RequirementsList } from './coachingUi';

/** Conceder (ou renovar) a licença: o servidor confere os requisitos; falta dispensável só com motivo. */
function ConcederDialog({ federation, rules, lic, open, onOpenChange, licenses }) {
  const novo = !lic;
  const [pessoa, setPessoa] = useState([]);
  const [level, setLevel] = useState(lic?.requested_level || lic?.level || rules.levels[0]?.id || '');
  const [motivo, setMotivo] = useState('');
  const [req, setReq] = useState(null);
  const userId = lic?.user_id || pessoa[0]?.id || '';
  const jaTem = useMemo(() => new Map((licenses || []).filter((l) => ['active', 'pending', 'suspended'].includes(l.status)).map((l) => [l.user_id, t('já tem licença')])), [licenses]);
  const conferir = useFederationMutation(() => coachingAction({ federationId: federation.id, action: 'license_check', userId, level }));
  const conceder = useFederationMutation(() => coachingAction({ federationId: federation.id, action: 'license_grant', userId, level, waiverReason: motivo }));
  const verRequisitos = () => conferir.mutate(undefined, { onSuccess: (r) => setReq(r.requirements), onError: (e) => toast.error(e.message) });
  const precisaMotivo = Boolean(req?.waivable?.length);
  const barrado = Boolean(req?.missing?.includes('safeguarding'));
  const enviar = (e) => {
    e.preventDefault();
    if (!userId) { toast.error(t('Escolha a pessoa.')); return; }
    if (!req) { verRequisitos(); return; }
    conceder.mutate(undefined, {
      onSuccess: (r) => { toast.success(r.waived?.length ? t('Licença concedida com dispensa registrada. O professor foi avisado.') : t('Licença concedida. O professor foi avisado.')); onOpenChange(false); },
      onError: (er) => toast.error(er.message),
    });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogTitle>{novo ? t('Conceder licença de professor') : t('Conceder a licença de {nome}', { nome: lic.name })}</DialogTitle>
        <DialogDescription>{t('O servidor confere a credencial do curso de formação, as horas de atualização dos últimos 12 meses e a proteção de menores. Você não concede a sua própria licença.')}</DialogDescription>
        <form onSubmit={enviar} noValidate className="mt-4 space-y-4">
          {novo && (
            <V2Field label={t('Professor')} htmlFor="lic-pessoa" required>
              <FedPersonPicker id="lic-pessoa" selecionados={pessoa} onChange={(p) => { setPessoa(p); setReq(null); }} excluir={jaTem} />
            </V2Field>
          )}
          {lic?.request_note && <p className="rounded-2xl bg-gray-50 p-3 text-sm text-gray-700">{t('Recado do professor: {texto}', { texto: lic.request_note })}</p>}
          <V2Field label={t('Nível')} htmlFor="lic-nivel" required>
            <V2Select id="lic-nivel" value={level} onChange={(e) => { setLevel(e.target.value); setReq(null); }}>
              {rules.levels.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
            </V2Select>
          </V2Field>
          {req && (
            <V2Surface variant="compacto" className="space-y-2 p-3">
              <p className="text-sm font-bold text-ink">{t('Requisitos do nível')}</p>
              <RequirementsList req={req} />
              {barrado && <p className="text-sm font-semibold text-red-700">{t('Sem a proteção de menores em dia a licença não sai: isso não se dispensa.')}</p>}
            </V2Surface>
          )}
          {precisaMotivo && !barrado && (
            <V2Field label={t('Motivo da dispensa')} htmlFor="lic-motivo" required hint={t('Fica registrado na licença e na auditoria. Pelo menos {n} letras.', { n: LICENSE_LIMITS.WAIVER_MIN })}>
              <V2Textarea id="lic-motivo" rows={2} maxLength={LICENSE_LIMITS.REASON_MAX} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            </V2Field>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <V2Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>{t('Cancelar')}</V2Button>
            {!req
              ? <V2Button type="submit" disabled={conferir.isPending || !userId}>{conferir.isPending ? t('Conferindo…') : t('Conferir requisitos')}</V2Button>
              : <V2Button type="submit" disabled={conceder.isPending || barrado || (precisaMotivo && motivo.trim().length < LICENSE_LIMITS.WAIVER_MIN)}><BadgeCheck className="h-4 w-4" />{conceder.isPending ? t('Concedendo…') : t('Conceder')}</V2Button>}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const DECISAO = {
  license_decline: { titulo: 'Recusar o pedido de {nome}', botao: 'Recusar', ok: 'Pedido recusado. O professor foi avisado.' },
  license_suspend: { titulo: 'Suspender a licença de {nome}', botao: 'Suspender', ok: 'Licença suspensa. O selo saiu do perfil.' },
  license_revoke: { titulo: 'Cassar a licença de {nome}', botao: 'Cassar', ok: 'Licença cassada. O professor foi avisado.' },
};

function DecisaoDialog({ federation, lic, acao, onFechar }) {
  const [motivo, setMotivo] = useState('');
  const d = DECISAO[acao];
  const m = useFederationMutation(() => coachingAction({ federationId: federation.id, action: acao, userId: lic.user_id, reason: motivo }));
  const enviar = (e) => {
    e.preventDefault();
    m.mutate(undefined, { onSuccess: () => { toast.success(t(d.ok)); onFechar(); }, onError: (er) => toast.error(er.message) });
  };
  return (
    <Dialog open onOpenChange={(v) => { if (!v) onFechar(); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogTitle>{t(d.titulo, { nome: lic.name })}</DialogTitle>
        <DialogDescription>{t('O motivo vai no aviso ao professor e fica no histórico da licença.')}</DialogDescription>
        <form onSubmit={enviar} noValidate className="mt-4 space-y-4">
          <V2Field label={t('Motivo')} htmlFor="lic-dec-motivo" required>
            <V2Textarea id="lic-dec-motivo" rows={3} maxLength={LICENSE_LIMITS.REASON_MAX} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </V2Field>
          <div className="flex justify-end gap-2">
            <V2Button type="button" variant="ghost" onClick={onFechar}>{t('Voltar')}</V2Button>
            <V2Button type="submit" variant="danger" disabled={m.isPending || motivo.trim().length < 3}>{t(d.botao)}</V2Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LicencaRow({ federation, rules, lic, licenses, hoje }) {
  const [dialogo, setDialogo] = useState(null);
  const s = licenseState(lic, hoje);
  const reativar = useFederationMutation(() => coachingAction({ federationId: federation.id, action: 'license_reinstate', userId: lic.user_id }));
  const pedido = lic.status === 'pending' || s.renewing;
  return (
    <li>
      <V2Surface variant="compacto" className="flex flex-wrap items-start gap-3 p-4">
        <V2Avatar photoUrl={lic.photo_url} name={lic.name} size="sm" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="flex flex-wrap items-center gap-2 font-bold text-ink">{lic.name}<LicenseBadge lic={lic} hoje={hoje} /></p>
          <p className="text-xs text-gray-500">
            {[lic.level_label, lic.valid_until && t('válida até {data}', { data: dataCurta(lic.valid_until) }), lic.city && `${lic.city}${lic.state ? `/${lic.state}` : ''}`].filter(Boolean).join(' · ')}
          </p>
          {pedido && lic.requested_level_label && <p className="text-xs font-semibold text-amber-700">{s.renewing ? t('Pede renovação: {nivel}', { nivel: lic.requested_level_label }) : t('Pede: {nivel}', { nivel: lic.requested_level_label })}</p>}
          {lic.waiver?.reason && <p className="text-xs text-gray-500">{t('Dispensa registrada: {motivo}', { motivo: lic.waiver.reason })}</p>}
          {lic.decision_reason && ['declined', 'suspended', 'revoked'].includes(lic.status) && <p className="text-xs text-gray-500">{t('Motivo: {motivo}', { motivo: lic.decision_reason })}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {(pedido || ['declined', 'expired'].includes(s.status)) && <V2Button type="button" size="sm" onClick={() => setDialogo('conceder')}>{pedido ? t('Analisar') : t('Conceder de novo')}</V2Button>}
          {pedido && <V2Button type="button" size="sm" variant="ghost" onClick={() => setDialogo('license_decline')}>{t('Recusar')}</V2Button>}
          {s.status === 'active' && !s.renewing && <V2Button type="button" size="sm" variant="ghost" onClick={() => setDialogo('license_suspend')}>{t('Suspender')}</V2Button>}
          {lic.status === 'suspended' && <V2Button type="button" size="sm" variant="secondary" disabled={reativar.isPending} onClick={() => reativar.mutate(undefined, { onSuccess: () => toast.success(t('Licença reativada.')), onError: (e) => toast.error(e.message) })}>{t('Reativar')}</V2Button>}
          {['active', 'suspended'].includes(lic.status) && <V2Button type="button" size="sm" variant="ghost" onClick={() => setDialogo('license_revoke')}>{t('Cassar')}</V2Button>}
        </div>
      </V2Surface>
      {dialogo === 'conceder' && <ConcederDialog federation={federation} rules={rules} lic={lic} licenses={licenses} open onOpenChange={(v) => { if (!v) setDialogo(null); }} />}
      {DECISAO[dialogo] && <DecisaoDialog federation={federation} lic={lic} acao={dialogo} onFechar={() => setDialogo(null)} />}
    </li>
  );
}

const FILTROS = ['todas', 'pedidos', 'ativas', 'vencendo', 'outras'];
const noFiltro = (l, filtro, hoje) => {
  const s = licenseState(l, hoje);
  return {
    todas: true,
    pedidos: l.status === 'pending' || s.renewing,
    ativas: s.valid,
    vencendo: s.expiring && !s.renewing,
    outras: !s.valid && l.status !== 'pending',
  }[filtro];
};
const CAMPOS = (l) => `${l.name} ${l.city || ''} ${l.level_label || ''}`;

function LicencasTab({ federation, rules, licensesQ }) {
  const hoje = isoDateBR();
  const [filtro, setFiltro] = useFiltroNaUrl('filtro', 'todas', FILTROS);
  const [novo, setNovo] = useState(false);
  const todas = useMemo(() => sortLicenses(licensesQ.data || [], hoje), [licensesQ.data, hoje]);
  const lista = useMemo(() => todas.filter((l) => noFiltro(l, filtro, hoje)), [todas, filtro, hoje]);
  const busca = useBuscaLista(lista, CAMPOS);
  if (licensesQ.isError) return <V2ErrorState title={t('Não carregaram as licenças')} onRetry={() => licensesQ.refetch()} />;
  if (licensesQ.isLoading) return <V2Skeleton lines={5} />;
  const rotulos = { todas: t('Todas'), pedidos: t('Pedidos'), ativas: t('Licenciados'), vencendo: t('Vencendo'), outras: t('Vencidas, recusadas e cassadas') };
  return (
    <section className="space-y-4" aria-label={t('Licenças')} data-dica="federacao-licencas">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">{FILTROS.map((id) => <V2FilterChip key={id} active={filtro === id} onClick={() => setFiltro(id)}>{`${rotulos[id]} (${todas.filter((l) => noFiltro(l, id, hoje)).length})`}</V2FilterChip>)}</div>
        <V2Button type="button" size="sm" onClick={() => setNovo(true)} data-dica="federacao-licencas-conceder"><Plus className="h-4 w-4" />{t('Conceder licença')}</V2Button>
      </div>
      {lista.length > 0 && <BuscaLista id="lic-busca" value={busca.termo} onChange={busca.setTermo} placeholder={t('Buscar por nome, cidade ou nível')} total={lista.length} achados={busca.filtrados.length} />}
      {!busca.filtrados.length
        ? <V2EmptyState icon={BadgeCheck} title={todas.length ? t('Nenhuma licença neste filtro') : t('Nenhum professor licenciado ainda')} description={todas.length ? undefined : t('O professor pede a licença pela Minha área → Federações, ou a equipe concede aqui.')} />
        : <ul className="space-y-3">{busca.visiveis.map((l) => <LicencaRow key={l.id} federation={federation} rules={rules} lic={l} licenses={todas} hoje={hoje} />)}</ul>}
      <MostrarMais restam={busca.restam} onClick={busca.mostrarMais} />
      {novo && <ConcederDialog federation={federation} rules={rules} licenses={todas} open onOpenChange={setNovo} />}
    </section>
  );
}

/* --------------------------------------------------------------- níveis -- */

const codigo = (label, usados) => {
  const base = String(label || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 16) || 'nivel';
  let id = base;
  for (let i = 2; usados.has(id); i += 1) id = `${base}_${i}`.slice(0, 20);
  return id;
};

function NiveisTab({ federation, rules }) {
  const [levels, setLevels] = useState(() => rules.levels.map((l) => ({ ...l, update_hours: String(l.update_hours), valid_months: String(l.valid_months) })));
  const [base] = useState(levels);
  useAvisoNaoSalvo(JSON.stringify(levels) !== JSON.stringify(base));
  const usados = new Set(levels.map((l) => l.id).filter(Boolean));
  const comCodigo = levels.map((l) => { if (l.id || !l.label.trim()) return l; const id = codigo(l.label, usados); usados.add(id); return { ...l, id }; });
  const r = validateCoachRules({ levels: comCodigo.map((l) => ({ ...l, update_hours: Number(l.update_hours) || 0, valid_months: Number(l.valid_months) || 12 })) });
  const m = useFederationMutation(() => coachingAction({ federationId: federation.id, action: 'license_rules', rules: r.value }));
  const set = (i, campo, v) => setLevels((x) => x.map((l, j) => (j === i ? { ...l, [campo]: v } : l)));
  const mover = (i, d) => setLevels((x) => { const l = [...x]; [l[i], l[i + d]] = [l[i + d], l[i]]; return l; });
  const enviar = (e) => {
    e.preventDefault();
    if (!r.ok) { toast.error(Object.values(r.errors)[0]); return; }
    m.mutate(undefined, { onSuccess: () => { setLevels(comCodigo); toast.success(t('Níveis da licença salvos.')); }, onError: (er) => toast.error(er.message) });
  };
  return (
    <form onSubmit={enviar} noValidate className="space-y-4" aria-label={t('Níveis da licença')} data-dica="federacao-licencas-niveis">
      <V2Surface variant="compacto" className="space-y-3 p-4">
        <p className="text-sm text-gray-500">{t('Para cada nível: se exige a credencial do curso de formação (pelo nome do nível na credencial), quantas horas de atualização nos últimos 12 meses e por quantos meses a licença vale. A proteção de menores vale para todos, quando ligada. Mudar um nível não muda licença já concedida.')}</p>
        <ul className="space-y-4">
          {levels.map((l, i) => (
            <li key={l.id || `novo${i}`} className="space-y-2 rounded-2xl border border-gray-100 p-3">
              <div className="flex flex-wrap items-end gap-2">
                <V2Field label={t('Nome do nível')} htmlFor={`cl-nome-${i}`} className="min-w-0 flex-1" hint={l.id ? t('código: {c}', { c: l.id }) : undefined}>
                  <V2Input id={`cl-nome-${i}`} maxLength={LICENSE_LIMITS.LABEL_MAX} value={l.label} onChange={(e) => set(i, 'label', e.target.value)} />
                </V2Field>
                <V2Button type="button" size="icon" variant="ghost" disabled={i === 0} onClick={() => mover(i, -1)} aria-label={t('Subir {nivel}', { nivel: l.label })}><ArrowUp className="h-4 w-4" /></V2Button>
                <V2Button type="button" size="icon" variant="ghost" disabled={i === levels.length - 1} onClick={() => mover(i, 1)} aria-label={t('Descer {nivel}', { nivel: l.label })}><ArrowDown className="h-4 w-4" /></V2Button>
                <V2Button type="button" size="icon" variant="ghost" disabled={levels.length <= 1} onClick={() => setLevels((x) => x.filter((_, j) => j !== i))} aria-label={t('Tirar {nivel}', { nivel: l.label })}><Trash2 className="h-4 w-4" /></V2Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <V2Field label={t('Horas de atualização por ano')} htmlFor={`cl-horas-${i}`}><V2Input id={`cl-horas-${i}`} type="number" min={0} max={LICENSE_LIMITS.HOURS_MAX} value={l.update_hours} onChange={(e) => set(i, 'update_hours', e.target.value)} /></V2Field>
                <V2Field label={t('Validade (meses)')} htmlFor={`cl-meses-${i}`}><V2Input id={`cl-meses-${i}`} type="number" min={LICENSE_LIMITS.MONTHS_MIN} max={LICENSE_LIMITS.MONTHS_MAX} value={l.valid_months} onChange={(e) => set(i, 'valid_months', e.target.value)} /></V2Field>
              </div>
              <V2Toggle id={`cl-cred-${i}`} checked={l.requires_credential} onChange={(v) => set(i, 'requires_credential', v)} label={t('Exige a credencial do curso de formação deste nível')} />
            </li>
          ))}
        </ul>
        {r.errors.levels && <p className="text-xs font-semibold text-red-600">{r.errors.levels}</p>}
        <V2Button type="button" variant="ghost" size="sm" disabled={levels.length >= LICENSE_LIMITS.LEVELS_MAX} onClick={() => setLevels((x) => [...x, { id: '', label: '', requires_credential: true, update_hours: '0', valid_months: '12' }])}><Plus className="h-4 w-4" />{t('Incluir nível')}</V2Button>
      </V2Surface>
      <div className="flex justify-end"><V2Button type="submit" disabled={m.isPending}><Save className="h-4 w-4" />{m.isPending ? t('Salvando…') : t('Salvar níveis')}</V2Button></div>
    </form>
  );
}

export default function FedCoachingPanel({ federation, tab = 'licencas', licensesQ }) {
  const rules = normalizeCoachRules(federation.coach_rules);
  return (
    <div className="space-y-4" data-dica="federacao-professores">
      <div>
        <h2 className="font-display text-xl font-bold text-ink">{t('Professores')}</h2>
        <p className="text-sm text-gray-500">{t('Licença de professor por nível, com renovação: credencial do curso de formação, horas de atualização e proteção de menores. O professor licenciado ganha o selo da federação no perfil da plataforma.')}</p>
      </div>
      {tab === 'licencas-niveis'
        ? <NiveisTab key={JSON.stringify(federation.coach_rules || {})} federation={federation} rules={rules} />
        : <LicencasTab federation={federation} rules={rules} licensesQ={licensesQ} />}
    </div>
  );
}
