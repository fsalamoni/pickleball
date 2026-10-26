/**
 * SELEÇÃO DO CLUBE (Central → Seleção; permissão `sports` ou `admin`): as convocações de
 * associados (atletas e comissão técnica) para um evento, com prazo para responder, tamanho de
 * uniforme, documentos de viagem e a lista pública da delegação. Toda escrita é do servidor
 * (`clubSelection`), que também impõe a TRAVA DE PROTEÇÃO: menor de idade só com o responsável
 * legal autorizando e comissão de convocação com menores só com a proteção de menores em dia.
 * Falha de consulta diz que não carregou — nunca "nenhuma convocação".
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CalendarDays, MapPin, Plus, Shield, Trophy, UserPlus } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useCallupMembers, useClubCallups, useClubSelectionAction } from '@/modules/clubs/hooks/useClubSelection';
import {
  CALLUP_LIMITS, CALLUP_ROLES, CALLUP_ROLE_LABELS, CALLUP_STATUS, CALLUP_STATUS_LABELS, MEMBER_STATUS, MEMBER_STATUS_LABELS, TRAVEL_DOCS, TRAVEL_DOC_LABELS,
  normalizeCallup, occupies, validateCallup,
} from '@/modules/clubs/domain/selection';
import { LIVE_MEMBER_STATUSES } from '@/modules/federations/domain/membership';
import { normalizaBusca as normaliza } from '../../federations/manage/listTools';
import { dataCurta } from '../../federations/referees/refUi';
import { V2Avatar, V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Field, V2Input, V2SearchInput, V2Select, V2Skeleton, V2Surface, V2Textarea, V2Toggle } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';

const TOM_STATUS = { draft: 'neutral', open: 'green', closed: 'blue', cancelled: 'red' };
const TOM_CONVITE = { invited: 'amber', accepted: 'green', declined: 'red', expired: 'neutral', cancelled: 'neutral' };

const periodo = (cu) => (cu.ends_at && cu.ends_at !== cu.starts_at ? `${dataCurta(cu.starts_at)} – ${dataCurta(cu.ends_at)}` : dataCurta(cu.starts_at));

/* ------------------------------------------------------------------ dialogs -- */

function ConvocacaoDialog({ club, cu, onFechar }) {
  const aberta = cu && cu.status !== CALLUP_STATUS.DRAFT;
  const [f, setF] = useState(() => ({ ...normalizeCallup(cu || {}), slots: cu?.slots ? String(cu.slots) : '' }));
  const [tentou, setTentou] = useState(false);
  const m = useClubSelectionAction(club.id);
  const v = validateCallup(f);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const alterna = (doc) => setF((x) => ({ ...x, travel_docs: x.travel_docs.includes(doc) ? x.travel_docs.filter((d) => d !== doc) : [...x.travel_docs, doc] }));
  const enviar = (e) => {
    e.preventDefault();
    setTentou(true);
    if (!v.ok) return;
    m.mutate({ action: 'save', callupId: cu?.id, ...v.value }, {
      onSuccess: () => { toast.success(cu ? t('Convocação atualizada.') : t('Rascunho criado. Publique quando estiver pronto.')); onFechar(); },
      onError: (er) => toast.error(er.message),
    });
  };
  const err = (k) => (tentou ? v.errors[k] : undefined);
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onFechar(); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogTitle>{cu ? t('Editar a convocação') : t('Nova convocação')}</DialogTitle>
        <DialogDescription>{aberta ? t('Já publicada: o que foi anunciado (prazo, vagas e se há menores) fica como está; o resto pode mudar.') : t('Monte a convocação e publique para começar a chamar os associados.')}</DialogDescription>
        <form onSubmit={enviar} noValidate className="mt-4 space-y-4">
          <V2Field label={t('Nome da convocação')} htmlFor="cs-titulo" required error={err('title')}><V2Input id="cs-titulo" maxLength={CALLUP_LIMITS.TITLE} value={f.title} onChange={set('title')} placeholder={t('Ex.: Seleção para o Interclubes')} /></V2Field>
          <V2Field label={t('Evento')} htmlFor="cs-evento" required error={err('event_name')}><V2Input id="cs-evento" maxLength={CALLUP_LIMITS.TEXT} value={f.event_name} onChange={set('event_name')} /></V2Field>
          <V2Field label={t('Local')} htmlFor="cs-local"><V2Input id="cs-local" maxLength={CALLUP_LIMITS.TEXT} value={f.place} onChange={set('place')} /></V2Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <V2Field label={t('Começa em')} htmlFor="cs-inicio" required error={err('starts_at')}><V2Input id="cs-inicio" type="date" value={f.starts_at} onChange={set('starts_at')} /></V2Field>
            <V2Field label={t('Termina em')} htmlFor="cs-fim" error={err('ends_at')}><V2Input id="cs-fim" type="date" value={f.ends_at} min={f.starts_at || undefined} onChange={set('ends_at')} /></V2Field>
            <V2Field label={t('Dias para responder')} htmlFor="cs-prazo" hint={t('O convite vence depois disso.')}><V2Input id="cs-prazo" type="number" min={1} max={CALLUP_LIMITS.ACCEPT_DAYS_MAX} value={f.accept_days} disabled={aberta} onChange={set('accept_days')} /></V2Field>
            <V2Field label={t('Vagas de atleta')} htmlFor="cs-vagas" hint={t('Em branco, sem limite.')}><V2Input id="cs-vagas" type="number" min={1} max={CALLUP_LIMITS.SLOTS_MAX} value={f.slots} disabled={aberta} onChange={set('slots')} /></V2Field>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-ink">{t('Documentos de viagem')}</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-2">{TRAVEL_DOCS.map((d) => <label key={d} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.travel_docs.includes(d)} onChange={() => alterna(d)} />{t(TRAVEL_DOC_LABELS[d])}</label>)}</div>
          </fieldset>
          <V2Toggle id="cs-uniforme" checked={f.collect_uniform} onChange={(x) => setF((s) => ({ ...s, collect_uniform: x }))} label={t('Pedir o tamanho do uniforme')} hint={t('Quem aceitar escolhe o tamanho.')} />
          <V2Toggle id="cs-menores" checked={f.involves_minors} disabled={aberta} onChange={(x) => setF((s) => ({ ...s, involves_minors: x }))} label={t('A convocação inclui menores de idade')} hint={t('A comissão técnica só entra com a proteção de menores em dia (compromisso e certidão).')} />
          <V2Field label={t('Recado aos convocados')} htmlFor="cs-recado" hint={t('Aparece na página pública do clube junto com a lista dos confirmados.')}><V2Textarea id="cs-recado" rows={3} maxLength={CALLUP_LIMITS.MESSAGE} value={f.message} onChange={set('message')} /></V2Field>
          <div className="flex justify-end gap-2">
            <V2Button type="button" variant="ghost" onClick={onFechar}>{t('Voltar')}</V2Button>
            <V2Button type="submit" disabled={m.isPending}>{m.isPending ? t('Salvando…') : t('Salvar')}</V2Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ConvocarDialog({ club, cu, affiliationsQ, jaConvocados, onFechar }) {
  const [busca, setBusca] = useState('');
  const [alvo, setAlvo] = useState(null);
  const [papel, setPapel] = useState('athlete');
  const [rotulo, setRotulo] = useState('');
  const m = useClubSelectionAction(club.id);
  const termo = normaliza(busca.trim());
  const candidatos = useMemo(
    () => (affiliationsQ.data || []).filter((mb) => LIVE_MEMBER_STATUSES.includes(mb.status) && mb.user_id && !jaConvocados.has(mb.user_id) && (!termo || normaliza(mb.user_name).includes(termo))).slice(0, 8),
    [affiliationsQ.data, jaConvocados, termo],
  );
  const enviar = (e) => {
    e.preventDefault();
    if (!alvo) return;
    m.mutate({ action: 'add', callupId: cu.id, userId: alvo.user_id, role: papel, label: rotulo }, {
      onSuccess: () => { toast.success(t('Convocado. A pessoa foi avisada.')); onFechar(); },
      onError: (er) => toast.error(er.message),
    });
  };
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onFechar(); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogTitle>{t('Convocar para {titulo}', { titulo: cu.title })}</DialogTitle>
        <DialogDescription>{t('A pessoa é avisada e tem {dias} dias para responder. Menor de idade só é convocado com o responsável legal registrado e autorizando.', { dias: cu.accept_days })}</DialogDescription>
        <form onSubmit={enviar} noValidate className="mt-4 space-y-4">
          <V2Field label={t('Associado')} htmlFor="cs-conv-busca" required>
            {alvo ? (
              <div className="flex items-center gap-2 text-sm"><span className="font-bold text-ink">{alvo.user_name}</span><V2Button type="button" size="sm" variant="ghost" onClick={() => setAlvo(null)}>{t('Trocar')}</V2Button></div>
            ) : (
              <>
                <V2SearchInput id="cs-conv-busca" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={t('Nome do associado')} aria-label={t('Buscar associado')} />
                {affiliationsQ.isError && <p className="mt-1 text-xs text-red-600">{t('Não carregaram os associados.')}</p>}
                {termo && candidatos.length > 0 && <ul className="mt-2 divide-y divide-gray-100 rounded-2xl border border-gray-100">{candidatos.map((mb) => <li key={mb.id}><button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50" onClick={() => setAlvo(mb)}>{mb.user_name}</button></li>)}</ul>}
                {termo && affiliationsQ.isSuccess && !candidatos.length && <p className="mt-1 text-xs text-gray-500">{t('Ninguém com esse nome entre os associados.')}</p>}
              </>
            )}
          </V2Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <V2Field label={t('Como vai')} htmlFor="cs-conv-papel"><V2Select id="cs-conv-papel" value={papel} onChange={(e) => setPapel(e.target.value)}>{CALLUP_ROLES.map((r) => <option key={r} value={r}>{t(CALLUP_ROLE_LABELS[r])}</option>)}</V2Select></V2Field>
            <V2Field label={t('Função (opcional)')} htmlFor="cs-conv-rotulo" hint={t('Ex.: Duplas 4.0, Capitão, Treinador.')}><V2Input id="cs-conv-rotulo" maxLength={CALLUP_LIMITS.LABEL} value={rotulo} onChange={(e) => setRotulo(e.target.value)} /></V2Field>
          </div>
          <div className="flex justify-end gap-2">
            <V2Button type="button" variant="ghost" onClick={onFechar}>{t('Voltar')}</V2Button>
            <V2Button type="submit" disabled={m.isPending || !alvo}>{t('Convocar')}</V2Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Pede o motivo e manda a ação (cancelar a convocação ou retirar alguém). */
function MotivoDialog({ club, titulo, descricao, payload, rotuloBotao, sucesso, onFechar }) {
  const [motivo, setMotivo] = useState('');
  const m = useClubSelectionAction(club.id);
  const enviar = (e) => {
    e.preventDefault();
    m.mutate({ ...payload, reason: motivo }, { onSuccess: () => { toast.success(sucesso); onFechar(); }, onError: (er) => toast.error(er.message) });
  };
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onFechar(); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogTitle>{titulo}</DialogTitle>
        <DialogDescription>{descricao}</DialogDescription>
        <form onSubmit={enviar} noValidate className="mt-4 space-y-4">
          <V2Field label={t('Motivo')} htmlFor="cs-motivo" required hint={t('Vai para quem foi avisado.')}><V2Textarea id="cs-motivo" rows={3} maxLength={CALLUP_LIMITS.REASON} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></V2Field>
          <div className="flex justify-end gap-2">
            <V2Button type="button" variant="ghost" onClick={onFechar}>{t('Voltar')}</V2Button>
            <V2Button type="submit" variant="danger" disabled={m.isPending || motivo.trim().length < 3}>{rotuloBotao}</V2Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ detalhe -- */

function ConvidadoRow({ club, cu, row, editavel }) {
  const [retirar, setRetirar] = useState(false);
  const m = useClubSelectionAction(club.id);
  const docs = cu.travel_docs || [];
  const marca = (doc, valor) => m.mutate({ action: 'member_update', memberId: row.id, docs_ok: { ...row.docs_ok, [doc]: valor }, staff_note: row.staff_note }, { onError: (er) => toast.error(er.message) });
  return (
    <li>
      <V2Surface variant="compacto" className="space-y-2 p-4">
        <div className="flex flex-wrap items-start gap-3">
          <V2Avatar photoUrl={row.photo_url} name={row.name} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 font-bold text-ink">
              {row.name}
              <V2Badge tone={TOM_CONVITE[row.status]}>{t(MEMBER_STATUS_LABELS[row.status] || row.status)}</V2Badge>
              {row.is_minor && <V2Badge tone="purple">{t('Menor de idade')}</V2Badge>}
            </p>
            <p className="text-xs text-gray-500">{t(CALLUP_ROLE_LABELS[row.role] || row.role)}{row.label ? ` · ${row.label}` : ''}{cu.collect_uniform && row.uniform_size ? ` · ${t('Uniforme {tam}', { tam: row.uniform_size })}` : ''}</p>
          </div>
          {editavel && occupies(row) && <V2Button type="button" size="sm" variant="ghost" onClick={() => setRetirar(true)}>{t('Retirar')}</V2Button>}
        </div>
        {docs.length > 0 && row.status === MEMBER_STATUS.ACCEPTED && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-gray-100 pt-2">
            {docs.map((d) => (
              <label key={d} className="flex items-center gap-2 text-xs text-gray-600">
                <input type="checkbox" checked={row.docs_ok?.[d] === true} disabled={!editavel || m.isPending} onChange={(e) => marca(d, e.target.checked)} />{t(TRAVEL_DOC_LABELS[d])}
              </label>
            ))}
          </div>
        )}
      </V2Surface>
      {retirar && <MotivoDialog club={club} titulo={t('Retirar {nome} da convocação', { nome: row.name })} descricao={t('A pessoa é avisada e a vaga volta.')} payload={{ action: 'remove', memberId: row.id }} rotuloBotao={t('Retirar')} sucesso={t('Retirado da convocação.')} onFechar={() => setRetirar(false)} />}
    </li>
  );
}

function Detalhe({ club, cu, affiliationsQ, onVoltar }) {
  const q = useCallupMembers(club.id, cu.id);
  const m = useClubSelectionAction(club.id);
  const [dialogo, setDialogo] = useState(null);
  const rows = q.data?.rows || [];
  const jaConvocados = useMemo(() => new Set(rows.filter(occupies).map((r) => r.user_id)), [rows]);
  const aberta = cu.status === CALLUP_STATUS.OPEN;
  const rascunho = cu.status === CALLUP_STATUS.DRAFT;
  const age = (payload, ok) => m.mutate(payload, { onSuccess: () => toast.success(ok), onError: (er) => toast.error(er.message) });
  const grupos = CALLUP_ROLES.map((r) => ({ papel: r, itens: rows.filter((x) => x.role === r) })).filter((g) => g.itens.length);
  return (
    <section className="space-y-4" aria-label={cu.title}>
      <V2Button type="button" size="sm" variant="ghost" onClick={onVoltar}>{t('← Todas as convocações')}</V2Button>
      <V2Surface className="space-y-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="flex flex-wrap items-center gap-2 font-display text-xl font-bold text-ink">{cu.title}<V2Badge tone={TOM_STATUS[cu.status]}>{t(CALLUP_STATUS_LABELS[cu.status] || cu.status)}</V2Badge></h3>
            <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
              <span className="inline-flex items-center gap-1"><Trophy className="h-4 w-4" aria-hidden="true" />{cu.event_name}</span>
              <span className="inline-flex items-center gap-1"><CalendarDays className="h-4 w-4" aria-hidden="true" />{periodo(cu)}</span>
              {cu.place && <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" aria-hidden="true" />{cu.place}</span>}
            </p>
            {cu.involves_minors && <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-purple-700"><Shield className="h-3.5 w-3.5" aria-hidden="true" />{t('Inclui menores: a comissão técnica precisa da proteção de menores em dia.')}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {cu.status !== CALLUP_STATUS.CANCELLED && cu.status !== CALLUP_STATUS.CLOSED && <V2Button type="button" size="sm" variant="secondary" onClick={() => setDialogo('editar')}>{t('Editar')}</V2Button>}
            {rascunho && <V2Button type="button" size="sm" disabled={m.isPending} onClick={() => age({ action: 'publish', callupId: cu.id }, t('Convocação publicada.'))} data-dica="clube-selecao-publicar">{t('Publicar')}</V2Button>}
            {aberta && <V2Button type="button" size="sm" onClick={() => setDialogo('convocar')} data-dica="clube-selecao-convocar"><UserPlus className="h-4 w-4" />{t('Convocar')}</V2Button>}
            {aberta && <V2Button type="button" size="sm" variant="secondary" disabled={m.isPending} onClick={() => age({ action: 'close', callupId: cu.id }, t('Convocação encerrada.'))}>{t('Encerrar')}</V2Button>}
            {cu.status !== CALLUP_STATUS.CANCELLED && !rascunho && <V2Button type="button" size="sm" variant="ghost" onClick={() => setDialogo('cancelar')}>{t('Cancelar')}</V2Button>}
          </div>
        </div>
        {cu.counts && <p className="text-sm text-gray-600">{t('{c} confirmados ({a} atletas, {s} na comissão) · {p} aguardando · {r} recusaram', { c: cu.counts.accepted, a: cu.counts.athletes, s: cu.counts.staff, p: cu.counts.invited, r: cu.counts.declined })}{cu.slots ? ` · ${t('{n} vagas de atleta', { n: cu.slots })}` : ''}</p>}
      </V2Surface>
      {q.isError ? <V2ErrorState title={t('Não carregaram os convocados')} onRetry={() => q.refetch()} />
        : q.isLoading ? <V2Skeleton lines={4} />
          : !rows.length ? <V2EmptyState icon={UserPlus} title={rascunho ? t('Publique para começar a convocar') : t('Ninguém convocado ainda')} description={rascunho ? t('Rascunho: ninguém é avisado até a publicação.') : t('Use Convocar para chamar atletas e a comissão técnica.')} />
            : grupos.map((g) => (
              <div key={g.papel} className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">{t(CALLUP_ROLE_LABELS[g.papel])} ({g.itens.length})</h4>
                <ul className="space-y-2">{g.itens.map((r) => <ConvidadoRow key={r.id} club={club} cu={cu} row={r} editavel={aberta} />)}</ul>
              </div>
            ))}
      {dialogo === 'editar' && <ConvocacaoDialog club={club} cu={cu} onFechar={() => setDialogo(null)} />}
      {dialogo === 'convocar' && <ConvocarDialog club={club} cu={cu} affiliationsQ={affiliationsQ} jaConvocados={jaConvocados} onFechar={() => setDialogo(null)} />}
      {dialogo === 'cancelar' && <MotivoDialog club={club} titulo={t('Cancelar a convocação')} descricao={t('Quem está convocado é avisado e a convocação sai da página pública.')} payload={{ action: 'cancel', callupId: cu.id }} rotuloBotao={t('Cancelar a convocação')} sucesso={t('Convocação cancelada.')} onFechar={() => setDialogo(null)} />}
    </section>
  );
}

/* ------------------------------------------------------------------ lista -- */

export default function ClubSelectionPanel({ club, affiliationsQ }) {
  const q = useClubCallups(club.id);
  const [aberta, setAberta] = useState(null);
  const [nova, setNova] = useState(false);
  const rows = q.data?.rows || [];
  const atual = aberta && rows.find((r) => r.id === aberta);
  return (
    <div className="space-y-4" data-dica="clube-selecao-painel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-bold text-ink">{t('Seleção do clube')}</h2>
          <p className="text-sm text-gray-500">{t('Convoque associados e a comissão técnica para campeonatos, interclubes e amistosos. Cada convocado responde dentro do prazo e a lista dos confirmados aparece na página do clube.')}</p>
        </div>
        {q.isSuccess && !atual && <V2Button type="button" size="sm" onClick={() => setNova(true)} data-dica="clube-selecao-nova"><Plus className="h-4 w-4" />{t('Nova convocação')}</V2Button>}
      </div>
      {q.isError ? <V2ErrorState title={t('Não carregaram as convocações')} onRetry={() => q.refetch()} />
        : q.isLoading ? <V2Skeleton lines={4} />
          : atual ? <Detalhe club={club} cu={atual} affiliationsQ={affiliationsQ} onVoltar={() => setAberta(null)} />
            : !rows.length ? <V2EmptyState icon={Trophy} title={t('Nenhuma convocação ainda')} description={t('Crie a primeira para convocar a seleção do clube.')} action={<V2Button type="button" onClick={() => setNova(true)}><Plus className="h-4 w-4" />{t('Nova convocação')}</V2Button>} />
              : (
                <ul className="space-y-3">
                  {rows.map((cu) => (
                    <li key={cu.id}>
                      <V2Surface variant="compacto" className="flex flex-wrap items-center gap-3 p-4">
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-2 font-bold text-ink">{cu.title}<V2Badge tone={TOM_STATUS[cu.status]}>{t(CALLUP_STATUS_LABELS[cu.status] || cu.status)}</V2Badge></p>
                          <p className="text-xs text-gray-500">{cu.event_name} · {periodo(cu)}{cu.counts ? ` · ${t('{n} confirmados', { n: cu.counts.accepted })}` : ''}</p>
                        </div>
                        <V2Button type="button" size="sm" variant="secondary" onClick={() => setAberta(cu.id)}>{t('Abrir')}</V2Button>
                      </V2Surface>
                    </li>
                  ))}
                </ul>
              )}
      {nova && <ConvocacaoDialog club={club} cu={null} onFechar={() => setNova(false)} />}
    </div>
  );
}
