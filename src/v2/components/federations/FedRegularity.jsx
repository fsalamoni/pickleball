/**
 * REGULARIDADE do filiado (Bloco 1) — as peças da pasta (equipe) e da aba
 * "Minha filiação" (a pessoa):
 *
 *  - `DocsStateBadge`: a situação dos documentos que o servidor espelha na
 *    filiação (`docs_state`) — vencido, vencendo, incompleto, em dia;
 *  - `StaffRegularity`: nível oficial (definir, histórico, decidir revisão),
 *    autorizações (só leitura) e cobertura do seguro;
 *  - `MemberRegularity`: o nível (e o pedido de revisão), as autorizações que
 *    a pessoa marca ou desmarca e o seguro, com o registro de ocorrência;
 *  - `IncidentDialog`: registrar lesão/acidente (a pessoa ou a equipe).
 *
 * Toda escrita é do servidor (`federationRegularity`); a régua é
 * `domain/regularity.js`.
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { History, LifeBuoy, Medal, ShieldCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useFederationMutation } from '@/modules/federations/hooks/useFederations';
import { useMyIncidents } from '@/modules/federations/hooks/useRegularity';
import { useUnifiedLevels } from '@/modules/rating/hooks/useMyUnifiedLevel';
import { regularityAction } from '@/modules/federations/services/regularityService';
import { useInsuranceAction } from '@/modules/federations/hooks/useInsurance';
import { termState } from '@/modules/federations/domain/insurance';
import {
  DOCS_STATE_LABELS, INCIDENT_KIND, INCIDENT_KIND_LABELS, INCIDENT_STATUS_LABELS, consentGranted, consentItems, insuranceState,
  levelReviewPending, memberInsured, normalizeLevels, suggestLevel, validateIncident, validateLevelInput, validateLevelReview,
} from '@/modules/federations/domain/regularity';
import { isoDate, membershipState } from '@/modules/federations/domain/membership';
import { fedModuleOn } from '@/modules/federations/domain/federation';
import { FED_PERMISSION, MEMBER_STATUS } from '@/modules/federations/domain/constants';
import { V2Badge, V2Button, V2ErrorState, V2Field, V2Input, V2Select, V2Skeleton, V2Textarea, V2Toggle } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';
import { quando } from './federationUi';
import { InsuranceTermDialog } from './insurance/InsuranceTerm';

const DOCS_TOM = { expired: 'red', expiring: 'amber', incomplete: 'amber', ok: 'green' };

/** A situação dos documentos da filiação (nada quando o plano não pede documento ou o servidor ainda não resumiu). */
export function DocsStateBadge({ member }) {
  const s = member?.docs_state;
  if (!s || s.state === 'none' || !DOCS_STATE_LABELS[s.state]) return null;
  const texto = s.state === 'expiring' && s.next_expiry ? t('Documento vence em {data}', { data: quando(s.next_expiry) }) : t(DOCS_STATE_LABELS[s.state]);
  return <V2Badge tone={DOCS_TOM[s.state] || 'neutral'}>{texto}</V2Badge>;
}

const ehPessoa = (mb) => !mb?.org_kind;

/* ---------------------------------------------------------------- nível -- */

function NivelForm({ federation, member, inicial = '', revisao = false, onFeito }) {
  const escala = normalizeLevels(federation.rules?.levels);
  const [f, setF] = useState({ label: inicial || '', reason: '' });
  const [erros, setErros] = useState({});
  const m = useFederationMutation((payload) => regularityAction(federation.id, revisao ? 'level_review_decide' : 'level_set', payload));
  const enviar = (e) => {
    e.preventDefault();
    const r = validateLevelInput(f, escala);
    if (!r.ok) { setErros(r.errors); return; }
    m.mutate({ memberId: member.id, ...r.value, ...(revisao ? { decision: 'accept' } : {}) }, { onSuccess: () => { toast.success(t('Nível oficial salvo. O atleta foi avisado.')); onFeito(); }, onError: (er) => toast.error(er.message) });
  };
  return (
    <form onSubmit={enviar} noValidate className="grid gap-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
      <V2Field label={t('Nível')} htmlFor={`nv-${member.id}`} error={erros.label}>
        <V2Select id={`nv-${member.id}`} value={f.label} onChange={(e) => { setF((x) => ({ ...x, label: e.target.value })); setErros({}); }}>
          <option value="">{t('Escolha')}</option>
          {escala.map((l) => <option key={l} value={l}>{l}</option>)}
        </V2Select>
      </V2Field>
      <V2Field label={t('Motivo')} htmlFor={`nv-mot-${member.id}`} error={erros.reason}><V2Input id={`nv-mot-${member.id}`} maxLength={300} value={f.reason} onChange={(e) => { setF((x) => ({ ...x, reason: e.target.value })); setErros({}); }} placeholder={t('Ex.: avaliação técnica, resultados no circuito')} /></V2Field>
      <V2Button type="submit" size="sm" disabled={m.isPending}>{revisao ? t('Aceitar e definir') : t('Salvar nível')}</V2Button>
    </form>
  );
}

function RecusarRevisao({ federation, member, onFeito }) {
  const [motivo, setMotivo] = useState('');
  const m = useFederationMutation(() => regularityAction(federation.id, 'level_review_decide', { memberId: member.id, decision: 'reject', reason: motivo }));
  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (motivo.trim().length < 3) { toast.error(t('Diga o motivo (mínimo 3 caracteres).')); return; } m.mutate(undefined, { onSuccess: () => { toast.success(t('Pedido recusado. O atleta foi avisado.')); onFeito(); }, onError: (er) => toast.error(er.message) }); }}>
      <V2Field label={t('Motivo da recusa')} htmlFor={`nv-rec-${member.id}`} className="min-w-0 flex-1"><V2Input id={`nv-rec-${member.id}`} maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></V2Field>
      <V2Button type="submit" size="sm" variant="danger" disabled={m.isPending}>{t('Manter o nível')}</V2Button>
    </form>
  );
}

function Historico({ member }) {
  const lista = member.official_level_history || [];
  if (!lista.length) return null;
  return (
    <details className="text-sm">
      <summary className="inline-flex cursor-pointer items-center gap-1 text-gray-600"><History className="h-4 w-4" aria-hidden="true" />{t('Histórico do nível')}</summary>
      <ul className="mt-2 space-y-1">{lista.map((h) => (
        <li key={`${h.at_ms}-${h.label}`} className="text-gray-700">
          <span className="font-semibold text-ink">{h.previous ? `${h.previous} → ${h.label}` : h.label}</span> · {quando(h.at_ms)} · {h.by_name || t('federação')}{h.reason ? ` · “${h.reason}”` : ''}
        </li>
      ))}</ul>
    </details>
  );
}

/* --------------------------------------------------------------- equipe -- */

/** Na pasta do filiado: nível oficial, autorizações e seguro. */
export function StaffRegularity({ member: mb, federation, perms = [] }) {
  const [editando, setEditando] = useState(false);
  const pode = perms.includes(FED_PERMISSION.MEMBERS) || perms.includes(FED_PERMISSION.COMPETITIONS) || perms.includes(FED_PERMISSION.ADMIN);
  const { levels } = useUnifiedLevels(mb.user_id ? [mb.user_id] : [], { enabled: pode && ehPessoa(mb) });
  const sugerido = suggestLevel(levels[mb.user_id], federation.rules?.levels);
  const hoje = isoDate();
  const segurado = fedModuleOn(federation, 'insurance') ? memberInsured(mb, federation, hoje, membershipState(mb).status === 'active') : null;
  const itens = consentItems(federation);
  if (!ehPessoa(mb)) return null;
  const nivel = mb.official_level;
  const revisao = levelReviewPending(mb) ? mb.level_review : null;
  return (
    <section className="space-y-4" data-dica="federacao-pasta-regularidade">
      <div className="space-y-2">
        <h3 className="flex items-center gap-2 font-display text-lg font-bold text-ink"><Medal className="h-5 w-5" aria-hidden="true" />{t('Nível oficial')}</h3>
        <p className="text-sm text-gray-700">
          {nivel ? t('{nivel} · definido em {data} por {quem}', { nivel: nivel.label, data: quando(nivel.set_at_ms), quem: nivel.set_by_name || t('federação') }) : t('Sem nível oficial definido.')}
          {sugerido && <span className="text-gray-500"> · {t('a régua da plataforma sugere {nivel}', { nivel: sugerido })}</span>}
        </p>
        {revisao && (
          <div className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm">
            <p className="font-semibold text-ink">{t('Pedido de revisão em {data}', { data: quando(revisao.requested_at_ms) })}{revisao.wanted ? ` · ${t('pede {nivel}', { nivel: revisao.wanted })}` : ''}</p>
            <p className="text-gray-700">“{revisao.reason}”</p>
            {pode && <NivelForm federation={federation} member={mb} inicial={revisao.wanted || nivel?.label || ''} revisao onFeito={() => undefined} />}
            {pode && <RecusarRevisao federation={federation} member={mb} onFeito={() => undefined} />}
          </div>
        )}
        {pode && !revisao && (editando
          ? <NivelForm federation={federation} member={mb} inicial={nivel?.label || sugerido || ''} onFeito={() => setEditando(false)} />
          : <V2Button type="button" size="sm" variant="secondary" onClick={() => setEditando(true)}>{nivel ? t('Mudar o nível') : t('Definir o nível')}</V2Button>)}
        <Historico member={mb} />
      </div>
      <div className="space-y-2">
        <h3 className="flex items-center gap-2 font-display text-lg font-bold text-ink"><ShieldCheck className="h-5 w-5" aria-hidden="true" />{t('Autorizações (LGPD)')}</h3>
        <ul className="space-y-1 text-sm">{itens.map((c) => {
          const v = mb.consents?.[c.id];
          return <li key={c.id} className="flex flex-wrap items-center justify-between gap-2"><span className="text-ink">{c.label}</span><V2Badge tone={v?.granted ? 'green' : 'neutral'}>{v ? (v.granted ? t('Autorizou em {data}', { data: quando(v.at_ms) }) : t('Não autorizou ({data})', { data: quando(v.at_ms) })) : t('Não respondeu')}</V2Badge></li>;
        })}</ul>
        <p className="text-xs text-gray-500">{t('Quem marca é a própria pessoa (ou o responsável), em Minha filiação. Sem autorização, não use a imagem nem mande novidades.')}</p>
      </div>
      {segurado != null && (
        <p className="flex items-center gap-2 text-sm text-gray-700"><LifeBuoy className="h-4 w-4" aria-hidden="true" />{segurado ? t('Coberto pelo seguro da federação hoje.') : t('Não está coberto pelo seguro hoje (filiação fora do prazo, apólice vencida ou fora do público da apólice).')}</p>
      )}
    </section>
  );
}

/* --------------------------------------------------------------- pessoa -- */

function PedirRevisao({ federation, member, onClose }) {
  const escala = normalizeLevels(federation.rules?.levels);
  const [f, setF] = useState({ wanted: '', reason: '' });
  const [erro, setErro] = useState('');
  const m = useFederationMutation((payload) => regularityAction(federation.id, 'level_review', payload));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent sheet className="max-h-[90dvh] max-w-md overflow-y-auto">
        <DialogTitle>{t('Pedir revisão do nível')}</DialogTitle>
        <DialogDescription>{t('A federação analisa e responde com o motivo. Enquanto isso, o nível atual continua valendo.')}</DialogDescription>
        <form className="space-y-4" onSubmit={(e) => {
          e.preventDefault();
          const r = validateLevelReview(f);
          if (!r.ok) { setErro(r.error); return; }
          m.mutate({ memberId: member.id, ...r.value }, { onSuccess: () => { toast.success(t('Pedido enviado à federação.')); onClose(); }, onError: (er) => toast.error(er.message) });
        }}>
          <V2Field label={t('Nível que você acha certo (opcional)')} htmlFor="rv-nivel"><V2Select id="rv-nivel" value={f.wanted} onChange={(e) => setF((x) => ({ ...x, wanted: e.target.value }))}><option value="">{t('Deixo a federação decidir')}</option>{escala.map((l) => <option key={l} value={l}>{l}</option>)}</V2Select></V2Field>
          <V2Field label={t('Por quê?')} htmlFor="rv-motivo" error={erro}><V2Textarea id="rv-motivo" rows={4} maxLength={600} value={f.reason} onChange={(e) => { setF((x) => ({ ...x, reason: e.target.value })); setErro(''); }} placeholder={t('Ex.: venci dois torneios 4.0 este ano e meu DUPR subiu.')} /></V2Field>
          <div className="flex justify-end gap-2"><V2Button type="button" variant="ghost" onClick={onClose}>{t('Voltar')}</V2Button><V2Button type="submit" disabled={m.isPending}>{t('Enviar pedido')}</V2Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Autorizacoes({ federation, member }) {
  const itens = consentItems(federation);
  const inicial = useMemo(() => Object.fromEntries(itens.map((c) => [c.id, consentGranted(member, c.id)])), [itens, member]);
  const [f, setF] = useState(inicial);
  const mudou = itens.some((c) => f[c.id] !== inicial[c.id] || !member.consents?.[c.id]);
  const m = useFederationMutation(() => regularityAction(federation.id, 'consents', { memberId: member.id, consents: f }));
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); m.mutate(undefined, { onSuccess: () => toast.success(t('Autorizações salvas.')), onError: (er) => toast.error(er.message) }); }} data-dica="federacao-minha-autorizacoes">
      {itens.map((c) => <V2Toggle key={c.id} id={`cs-${member.id}-${c.id}`} checked={Boolean(f[c.id])} onChange={(v) => setF((x) => ({ ...x, [c.id]: v }))} label={c.label} hint={c.text} />)}
      <p className="text-xs text-gray-500">{t('Você muda quando quiser. Cada mudança fica registrada com a data. Os avisos da filiação (vencimento, cobrança, decisões) chegam sempre.')}</p>
      {mudou && <div className="flex justify-end"><V2Button type="submit" size="sm" disabled={m.isPending}>{t('Salvar autorizações')}</V2Button></div>}
    </form>
  );
}

/** O termo do seguro da filiação: aceito (com a data) ou o botão que pede o aceite. */
function TermoDoSeguro({ federation, member }) {
  const st = termState(member, federation);
  const [lendo, setLendo] = useState(false);
  const m = useInsuranceAction(federation.id);
  if (!st.required) return null;
  if (st.accepted) return <p className="text-gray-700">{t('Termo do seguro aceito em {data}.', { data: quando(st.accepted_at_ms) })}</p>;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3">
      <p className="text-amber-900">{st.outdated ? t('O termo do seguro mudou: leia e aceite a versão nova.') : t('Falta aceitar o termo do seguro da federação.')}</p>
      <V2Button type="button" size="sm" onClick={() => setLendo(true)}>{t('Ler e aceitar')}</V2Button>
      {lendo && (
        <InsuranceTermDialog
          federation={federation}
          loading={m.isPending}
          onCancel={() => setLendo(false)}
          onAccept={(version) => m.mutate({ action: 'term_accept', memberId: member.id, version }, { onSuccess: () => { toast.success(t('Termo aceito.')); setLendo(false); }, onError: (er) => toast.error(er.message) })}
        />
      )}
    </div>
  );
}

function Seguro({ federation, member }) {
  const [registrando, setRegistrando] = useState(false);
  const incidentsQ = useMyIncidents();
  const ins = federation.insurance;
  const hoje = isoDate();
  const estado = insuranceState(ins, hoje);
  const coberto = memberInsured(member, federation, hoje, membershipState(member).status === 'active');
  const minhas = (incidentsQ.data || []).filter((x) => x.member_id === member.id);
  return (
    <div className="space-y-3 text-sm" data-dica="federacao-minha-seguro">
      {estado.state === 'none' ? <p className="text-gray-600">{t('A federação ainda não cadastrou a apólice do seguro.')}</p> : (
        <div className="space-y-1 rounded-2xl bg-paper p-3">
          <p className="font-semibold text-ink">{ins.insurer}{ins.policy ? ` · ${t('apólice {n}', { n: ins.policy })}` : ''}</p>
          <p className="text-gray-700">{estado.state === 'expired' ? t('Apólice vencida em {data}.', { data: quando(ins.valid_until) }) : estado.state === 'future' ? t('Começa em {data}.', { data: quando(ins.valid_from) }) : t('Vigente até {data}.', { data: quando(ins.valid_until) })} {coberto ? t('Você está coberto.') : t('Você não está coberto agora.')}</p>
          {ins.coverage && <p className="whitespace-pre-line text-gray-700">{ins.coverage}</p>}
          {ins.how_to_claim && <p className="whitespace-pre-line text-gray-700"><span className="font-semibold">{t('Como acionar:')}</span> {ins.how_to_claim}</p>}
          {ins.phone && <p className="text-gray-700"><span className="font-semibold">{t('Telefone da seguradora:')}</span> <a className="underline" href={`tel:${ins.phone.replace(/[^\d+]/g, '')}`}>{ins.phone}</a></p>}
        </div>
      )}
      <TermoDoSeguro federation={federation} member={member} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-ink">{t('Ocorrências')}</p>
        <V2Button type="button" size="sm" variant="secondary" onClick={() => setRegistrando(true)}>{t('Registrar ocorrência')}</V2Button>
      </div>
      {incidentsQ.isError ? <V2ErrorState inline title={t('As ocorrências não carregaram')} onRetry={() => incidentsQ.refetch()} />
        : incidentsQ.isLoading ? <V2Skeleton lines={2} />
          : !minhas.length ? <p className="text-gray-500">{t('Nenhuma ocorrência registrada.')}</p>
            : <ul className="space-y-2">{minhas.map((x) => <IncidentItem key={x.id} incident={x} />)}</ul>}
      {registrando && <IncidentDialog federation={federation} member={member} onClose={() => setRegistrando(false)} />}
    </div>
  );
}

export function IncidentItem({ incident: x, children = null }) {
  return (
    <li className="space-y-1 rounded-2xl border border-gray-100 px-4 py-3 text-sm">
      <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">{t(INCIDENT_KIND_LABELS[x.kind] || x.kind)} · {quando(x.date)}<V2Badge tone={{ open: 'amber', claim: 'blue', closed: 'neutral' }[x.status] || 'neutral'}>{t(INCIDENT_STATUS_LABELS[x.status] || x.status)}</V2Badge>{x.insured ? <V2Badge tone="green">{t('coberto')}</V2Badge> : <V2Badge tone="neutral">{t('sem cobertura')}</V2Badge>}</p>
      <p className="text-xs text-gray-500">{[x.athlete_name, x.event_name, x.place, x.body_part, x.claim_number && t('sinistro {n}', { n: x.claim_number })].filter(Boolean).join(' · ')}</p>
      <p className="whitespace-pre-line text-gray-700">{x.description}</p>
      {children}
    </li>
  );
}

/** Registrar uma ocorrência. `member` fixo (a pessoa) ou escolhido na lista (`members`, a equipe). */
export function IncidentDialog({ federation, member = null, members = null, onClose }) {
  const hoje = isoDate();
  const [memberId, setMemberId] = useState(member?.id || '');
  const [f, setF] = useState({ date: hoje, kind: INCIDENT_KIND.INJURY, event_name: '', place: '', body_part: '', description: '', first_aid: false, hospital: false });
  const [erros, setErros] = useState({});
  const set = (p) => { setF((x) => ({ ...x, ...p })); setErros({}); };
  const m = useFederationMutation((payload) => regularityAction(federation.id, 'incident_create', payload));
  const pessoas = (members || []).filter((x) => ehPessoa(x) && x.status !== MEMBER_STATUS.CANCELLED).sort((a, b) => String(a.user_name).localeCompare(String(b.user_name)));
  const enviar = (e) => {
    e.preventDefault();
    const r = validateIncident(f, hoje);
    const err = { ...r.errors, ...(memberId ? {} : { member: t('Escolha o filiado.') }) };
    if (Object.keys(err).length) { setErros(err); return; }
    m.mutate({ memberId, ...r.value }, { onSuccess: () => { toast.success(t('Ocorrência registrada.')); onClose(); }, onError: (er) => toast.error(er.message) });
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent sheet className="max-h-[90dvh] max-w-lg overflow-y-auto">
        <DialogTitle>{t('Registrar ocorrência')}</DialogTitle>
        <DialogDescription>{t('Lesão, acidente ou mal súbito em treino ou evento. A federação acompanha e, se for o caso, aciona o seguro.')}</DialogDescription>
        <form className="space-y-4" onSubmit={enviar} noValidate>
          {!member && (
            <V2Field label={t('Filiado')} htmlFor="oc-membro" error={erros.member}>
              <V2Select id="oc-membro" value={memberId} onChange={(e) => { setMemberId(e.target.value); setErros({}); }}>
                <option value="">{t('Escolha')}</option>
                {pessoas.map((x) => <option key={x.id} value={x.id}>{x.user_name}{x.member_number ? ` · ${x.member_number}` : ''}</option>)}
              </V2Select>
            </V2Field>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <V2Field label={t('Data')} htmlFor="oc-data" error={erros.date}><V2Input id="oc-data" type="date" max={hoje} value={f.date} onChange={(e) => set({ date: e.target.value })} /></V2Field>
            <V2Field label={t('Tipo')} htmlFor="oc-tipo"><V2Select id="oc-tipo" value={f.kind} onChange={(e) => set({ kind: e.target.value })}>{Object.values(INCIDENT_KIND).map((k) => <option key={k} value={k}>{t(INCIDENT_KIND_LABELS[k])}</option>)}</V2Select></V2Field>
            <V2Field label={t('Evento (opcional)')} htmlFor="oc-evento"><V2Input id="oc-evento" maxLength={120} value={f.event_name} onChange={(e) => set({ event_name: e.target.value })} /></V2Field>
            <V2Field label={t('Local (opcional)')} htmlFor="oc-local"><V2Input id="oc-local" maxLength={120} value={f.place} onChange={(e) => set({ place: e.target.value })} /></V2Field>
            <V2Field label={t('Parte do corpo (opcional)')} htmlFor="oc-corpo"><V2Input id="oc-corpo" maxLength={60} value={f.body_part} onChange={(e) => set({ body_part: e.target.value })} /></V2Field>
          </div>
          <V2Field label={t('O que aconteceu')} htmlFor="oc-desc" error={erros.description}><V2Textarea id="oc-desc" rows={4} maxLength={2000} value={f.description} onChange={(e) => set({ description: e.target.value })} /></V2Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <V2Toggle id="oc-socorro" checked={f.first_aid} onChange={(v) => set({ first_aid: v })} label={t('Teve primeiros socorros no local')} />
            <V2Toggle id="oc-hospital" checked={f.hospital} onChange={(v) => set({ hospital: v })} label={t('Foi para hospital ou pronto-socorro')} />
          </div>
          <div className="flex justify-end gap-2"><V2Button type="button" variant="ghost" onClick={onClose}>{t('Voltar')}</V2Button><V2Button type="submit" disabled={m.isPending}>{t('Registrar')}</V2Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Na aba "Minha filiação": nível, autorizações e seguro da pessoa. */
export function MemberRegularity({ federation, member }) {
  const [pedindo, setPedindo] = useState(false);
  if (!ehPessoa(member) || member.status === MEMBER_STATUS.CANCELLED) return null;
  const nivel = member.official_level;
  const revisao = member.level_review;
  const podePedir = [MEMBER_STATUS.ACTIVE, MEMBER_STATUS.EXPIRED].includes(member.status) && !levelReviewPending(member);
  return (
    <div className="space-y-5">
      <section className="space-y-2" data-dica="federacao-minha-nivel">
        <h3 className="flex items-center gap-2 font-display font-bold text-ink"><Medal className="h-4 w-4" aria-hidden="true" />{t('Nível oficial')}</h3>
        <p className="text-sm text-gray-700">{nivel ? t('{nivel}, definido pela federação em {data}.', { nivel: nivel.label, data: quando(nivel.set_at_ms) }) : t('A federação ainda não definiu o seu nível oficial.')}</p>
        {revisao?.status === 'pending' && <p className="text-sm text-amber-700">{t('Pedido de revisão enviado em {data}. A federação vai responder.', { data: quando(revisao.requested_at_ms) })}</p>}
        {revisao?.status === 'rejected' && <p className="text-sm text-gray-600">{t('Último pedido de revisão: nível mantido. Motivo: {motivo}', { motivo: revisao.decided_reason || '—' })}</p>}
        {podePedir && <V2Button type="button" size="sm" variant="secondary" onClick={() => setPedindo(true)}>{t('Pedir revisão do nível')}</V2Button>}
        <Historico member={member} />
      </section>
      <section className="space-y-2">
        <h3 className="flex items-center gap-2 font-display font-bold text-ink"><ShieldCheck className="h-4 w-4" aria-hidden="true" />{t('Autorizações')}</h3>
        <Autorizacoes key={JSON.stringify(member.consents || {})} federation={federation} member={member} />
      </section>
      {fedModuleOn(federation, 'insurance') && (
        <section className="space-y-2">
          <h3 className="flex items-center gap-2 font-display font-bold text-ink"><LifeBuoy className="h-4 w-4" aria-hidden="true" />{t('Seguro esportivo')}</h3>
          <Seguro federation={federation} member={member} />
        </section>
      )}
      {pedindo && <PedirRevisao federation={federation} member={member} onClose={() => setPedindo(false)} />}
    </div>
  );
}
